# Draw Card says what went wrong, and the gold stays smooth · 2026-11-20

Astra, 2026-11-19: "Draw card is not working with that link. its still showing older cards. and the sheen on teh gold
gets very glitchy when drawing."

- **No quiet old cards.** When the card server didn't answer, Draw Card handed out a starter card without a word, and
  one failed check was kept for a minute. Now a failed check is asked again on the next draw (8 s to answer instead of
  4), the mint pass never falls back to an old card but says why ("This browser couldn't reach your card server ...
  If Tailscale is on, turn it off (or use Safari)"), and friends see that the server isn't answering before their
  starter card (`lib/card-server-20261114.ts`, `app/page.tsx`).
- **The paper search copes with a slow Europe PMC.** On 2026-11-20 Europe PMC took 5-21 s for one row of its "core"
  search, over a minute for 25 rows, and 8-40 s for one paper's text, so the page's 12 s limit stopped every draw. Lists
  now use the quick "lite" search (under a second when Europe PMC is well), each checked paper's full record is read by
  PMCID beside its text (so retractions and corrections are still caught), one answer may take 25 s and a whole search
  60 s, and the message says whether Europe PMC was slow or couldn't be reached (`lib/browser-library.ts`,
  `lib/publisher.ts`, `lib/science.ts`). While Europe PMC is as slow as on 2026-11-20 no card can be made; the page now
  says so.
- **Smoother gold.** The one gold sheet (`components/gold-surface-20261114.tsx`) found every gold thing again and
  measured each one right after moving the one before, every frame, so the browser laid the page out again for each of
  them; and it used on-screen boxes, which follow a card while it flips or a reel while it spins, so the gold slid
  across them. It now finds the gold things again only when the page changes, measures all before moving any, writes
  only what changed, and uses layout positions without transforms. At rest every visible gold thing lines up exactly
  as before (checked on the phone-size page at three scroll places; only the hidden backs of unflipped cards and the
  tilted message line differ).

Claude Opus 5.5 (`claude-opus-5-5`), 2026-11-20.
