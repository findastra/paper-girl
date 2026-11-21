// Paper Girl's chromesthesia quiz: serves the quiz page, the results page, and a small answers API backed by D1.
// Anyone can play and see the crowd averages. Only someone holding RESULTS_KEY (Astra) can see each player's answers.
import QUIZ from "./quiz-20261120.html";
import RESULTS from "./results-20261120.html";

const MAX_ANSWERS_PER_PLAYER = 1000;

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https://findastra.github.io",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function page(html) {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "cache-control": "no-cache",
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function cleanName(v) {
  if (typeof v !== "string") return null;
  const n = v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40);
  return n.length ? n : null;
}

function circularAverage(picks) {
  if (!picks.length) return null;
  let x = 0, y = 0, s = 0, l = 0, wsum = 0;
  for (const p of picks) {
    const w = Math.max(p.s, 1) / 100;
    x += Math.cos((p.h * Math.PI) / 180) * w;
    y += Math.sin((p.h * Math.PI) / 180) * w;
    wsum += w; s += p.s; l += p.l;
  }
  let h = (Math.atan2(y, x) * 180) / Math.PI;
  if (h < 0) h += 360;
  const agree = Math.min(1, Math.hypot(x, y) / wsum); // disagreement on hue greys the average out
  return { h: Math.round(h), s: Math.round((s / picks.length) * agree), l: Math.round(l / picks.length) };
}

// Each player's latest answer for each note.
async function latestRows(db) {
  const { results } = await db.prepare(
    `SELECT a.player, a.name, a.note, a.h, a.s, a.l, a.at FROM answers a
     JOIN (SELECT MAX(id) AS mid FROM answers GROUP BY player, note) m ON a.id = m.mid`
  ).all();
  return results;
}

function keyMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !expected.length) return false;
  const a = new TextEncoder().encode(given), b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "GET" && path === "/") return page(QUIZ);
      if (request.method === "GET" && path === "/results") return page(RESULTS);

      if (request.method === "GET" && path === "/api/crowd") {
        const rows = await latestRows(env.DB);
        const notes = Array.from({ length: 12 }, (_, i) => {
          const picks = rows.filter((r) => r.note === i);
          return { avg: circularAverage(picks), n: picks.length };
        });
        const players = new Set(rows.map((r) => r.player)).size;
        return json({ notes, players });
      }

      if (request.method === "GET" && path === "/api/mine") {
        const player = url.searchParams.get("player") || "";
        if (!/^[a-z0-9]{16,40}$/.test(player)) return json({ error: "bad player id" }, 400);
        const { results } = await env.DB.prepare(
          "SELECT note, h, s, l, at FROM answers WHERE player = ? ORDER BY id DESC LIMIT 300"
        ).bind(player).all();
        return json({ history: results });
      }

      if (request.method === "POST" && path === "/api/answer") {
        if ((request.headers.get("content-type") || "").split(";")[0].trim() !== "application/json") return json({ error: "send JSON" }, 415);
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin) return json({ error: "wrong site" }, 403);
        let body;
        try { body = await request.json(); } catch { return json({ error: "send JSON" }, 400); }
        const { player, note, h, s, l } = body || {};
        const name = cleanName(body?.name);
        if (typeof player !== "string" || !/^[a-z0-9]{16,40}$/.test(player)) return json({ error: "bad player id" }, 400);
        if (!name) return json({ error: "Add your name first." }, 400);
        if (!intIn(note, 0, 11) || !intIn(h, 0, 360) || !intIn(s, 0, 100) || !intIn(l, 0, 100)) return json({ error: "bad answer" }, 400);
        const count = await env.DB.prepare("SELECT COUNT(*) AS c FROM answers WHERE player = ?").bind(player).first("c");
        if (count >= MAX_ANSWERS_PER_PLAYER) return json({ error: "That's the most answers one player can save." }, 429);
        await env.DB.prepare("INSERT INTO answers (player, name, note, h, s, l, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(player, name, note, h, s, l, Date.now()).run();
        return json({ ok: true });
      }

      if (request.method === "GET" && path === "/api/results") {
        const auth = request.headers.get("authorization") || "";
        const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!keyMatches(given.trim(), (env.RESULTS_KEY || "").trim())) return json({ error: "This results link is not valid." }, 401);
        const rows = await latestRows(env.DB);
        const { results: counts } = await env.DB.prepare(
          "SELECT player, COUNT(*) AS answers, MAX(at) AS last FROM answers GROUP BY player"
        ).all();
        const byPlayer = new Map(counts.map((c) => [c.player, { player: c.player, name: "", answers: c.answers, last: c.last, latest: {} }]));
        for (const r of rows) {
          const p = byPlayer.get(r.player);
          if (!p) continue;
          p.latest[r.note] = { h: r.h, s: r.s, l: r.l, at: r.at };
          if (!p.nameAt || r.at > p.nameAt) { p.name = r.name; p.nameAt = r.at; }
        }
        const players = [...byPlayer.values()].map(({ nameAt, ...p }) => p).sort((a, b) => b.last - a.last);
        return json({ players });
      }

      return json({ error: "not found" }, 404);
    } catch (err) {
      return json({ error: "Something went wrong on the server." }, 500);
    }
  },
};
