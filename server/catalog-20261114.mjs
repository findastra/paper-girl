// The Card Catalog (Astra, 2026-11-14: "I want to see all the cards everyone's doing ... the library of all time").
// In code it is the shared card database: every card Papermon has ever made, once per paper, so the next friend who
// draws that paper gets the same card for free (card plan Q5, "reuse saves money"). Also keeps each friend's draws
// (for the five-a-day rule), their thumbs, notes and reports, and what the day's new cards cost.
// Lives in one SQLite file in Astra's PC data folder, never in the repo.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

export function openCatalog(file) {
  mkdirSync(dirname(file), {recursive: true});
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cards (
      no INTEGER PRIMARY KEY,           -- card number, in minting order (starters are 1-5)
      pmcid TEXT NOT NULL UNIQUE,       -- one card per paper
      subject TEXT NOT NULL,
      lv INTEGER NOT NULL,              -- reading difficulty, 1-4 stars
      json TEXT NOT NULL,               -- the whole card, the same shape as lib/data/sample-deck-20261114.json
      writer TEXT NOT NULL,             -- which AI wrote it ('starter' for the five made by hand)
      artist TEXT NOT NULL,
      cost_usd REAL NOT NULL DEFAULT 0,
      made_by TEXT,                     -- the anonymous reader id that drew it first (never a name)
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cards_pick ON cards(subject, lv);
    CREATE TABLE IF NOT EXISTS draws (
      id INTEGER PRIMARY KEY,
      reader TEXT NOT NULL,
      who TEXT NOT NULL,                -- a salted hash of the network address, so one person can't dodge the limit
      day TEXT NOT NULL,
      no INTEGER,
      kind TEXT NOT NULL,               -- 'catalog' (an existing card) or 'new'
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_draws_day ON draws(day, reader);
    CREATE TABLE IF NOT EXISTS votes (
      reader TEXT NOT NULL,
      no INTEGER NOT NULL,
      thumb INTEGER NOT NULL,           -- 1 up, -1 down
      reason TEXT,
      note TEXT,
      at INTEGER NOT NULL,
      PRIMARY KEY (reader, no)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,               -- 'report' (Report a problem) or 'author' (I wrote this paper)
      no INTEGER,
      reader TEXT NOT NULL,
      body TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS spend (
      id INTEGER PRIMARY KEY,
      day TEXT NOT NULL,
      usd REAL NOT NULL,
      what TEXT NOT NULL,
      at INTEGER NOT NULL
    );
  `);
  const q = sql => db.prepare(sql);
  const parse = row => row && {...JSON.parse(row.json), no: cardNumber(row.no)};
  return {
    db,
    count: () => q('SELECT COUNT(*) n FROM cards').get().n,
    nextNumber: () => (q('SELECT MAX(no) m FROM cards').get().m || 0) + 1,
    byPmcid: pmcid => parse(q('SELECT * FROM cards WHERE pmcid = ?').get(pmcid)),
    byNumber: no => parse(q('SELECT * FROM cards WHERE no = ?').get(no)),
    add(card, {writer, artist, cost, reader}) {
      const no = numberOf(card.no);
      q(`INSERT INTO cards (no, pmcid, subject, lv, json, writer, artist, cost_usd, made_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(no, card.pmcid, card.subject, card.lv, JSON.stringify(card), writer, artist, cost || 0, reader || null, Date.now());
      return no;
    },
    /** A catalog card that fits the draw and that this reader doesn't hold yet, picked at random. */
    pick({subject, lv, have}) {
      const rows = q(`SELECT * FROM cards WHERE (? = '' OR subject = ?) AND (? = 0 OR lv = ?)`).all(subject, subject, lv, lv);
      const held = new Set((have || []).map(numberOf));
      const free = rows.filter(r => !held.has(r.no));
      return free.length ? parse(free[Math.floor(Math.random() * free.length)]) : null;
    },
    all: () => q('SELECT * FROM cards ORDER BY no').all().map(parse),
    /** Every card with who drew it, what it cost and its feedback, for Astra's own page. */
    allForOwner: () => q('SELECT * FROM cards ORDER BY no DESC').all().map(r => ({
      card: parse(r), writer: r.writer, artist: r.artist, cost: r.cost_usd, madeBy: r.made_by, createdAt: r.created_at,
    })),
    drawsToday: (day, reader, who) => q(`SELECT
        SUM(CASE WHEN reader = ? THEN 1 ELSE 0 END) byReader,
        SUM(CASE WHEN who = ? THEN 1 ELSE 0 END) byWho
      FROM draws WHERE day = ?`).get(reader, who, day),
    recordDraw: (d) => q('INSERT INTO draws (reader, who, day, no, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(d.reader, d.who, d.day, d.no ?? null, d.kind, Date.now()),
    vote({reader, no, thumb, reason, note}) {
      if (!thumb) return q('DELETE FROM votes WHERE reader = ? AND no = ?').run(reader, no);
      q(`INSERT INTO votes (reader, no, thumb, reason, note, at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(reader, no) DO UPDATE SET thumb = excluded.thumb, reason = excluded.reason, note = excluded.note, at = excluded.at`)
        .run(reader, no, thumb, reason || null, note || null, Date.now());
    },
    tallies: () => Object.fromEntries(q(`SELECT no, SUM(thumb = 1) up, SUM(thumb = -1) down FROM votes GROUP BY no`).all()
      .map(r => [cardNumber(r.no), {up: r.up, down: r.down}])),
    votes: () => q('SELECT * FROM votes ORDER BY at DESC').all(),
    addMessage: m => q('INSERT INTO messages (kind, no, reader, body, at) VALUES (?, ?, ?, ?, ?)')
      .run(m.kind, m.no ?? null, m.reader, JSON.stringify(m.body), Date.now()),
    messages: () => q('SELECT * FROM messages ORDER BY at DESC').all().map(m => ({...m, body: JSON.parse(m.body)})),
    addSpend: (day, usd, what) => q('INSERT INTO spend (day, usd, what, at) VALUES (?, ?, ?, ?)').run(day, usd, what, Date.now()),
    spentOn: day => q('SELECT COALESCE(SUM(usd), 0) s FROM spend WHERE day = ?').get(day).s,
    // What Astra's mint pass spent (its spend rows start with "pass: "), left out of friends' daily budget.
    passSpentOn: day => q("SELECT COALESCE(SUM(usd), 0) s FROM spend WHERE day = ? AND what LIKE 'pass:%'").get(day).s,
    spendByDay: () => q('SELECT day, ROUND(SUM(usd), 4) usd, COUNT(*) items FROM spend GROUP BY day ORDER BY day DESC LIMIT 30').all(),
  };
}

/** "000,006" (the card's printed number) from 6, and back. */
export function cardNumber(n) { return String(n).padStart(6, '0').replace(/^(\d{3})(\d{3})$/, '$1,$2'); }
export function numberOf(no) { return typeof no === 'number' ? no : Number(String(no).replace(/\D/g, '')); }
