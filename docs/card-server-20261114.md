# Papermon card server

Astra, 2026-11-14: "I want to send this link to my friends so they can start generating cards and then tell me if
these cards are good or bad. And I want to see these cards that my friends generate."

## What it does

- **Friends keep the normal Papermon link.** When the page can reach the server, Draw Card asks it first:
  1. a card from the **Card Catalog** that fits the friend's choices and isn't in their deck yet (free), or
  2. a **brand-new card**: the page finds a fresh paper as before, then the server has Claude write the card and OpenAI
     draw its picture (about a minute; the page shows each step), or
  3. after the day's budget is spent, any catalog card the friend doesn't have yet.
  The same paper always gives the same card, so nobody pays twice for one paper.
- **Five draws a day per person**, counted on the server too (and at most 15 a day from one network, so clearing the
  browser doesn't reset it). A card that fails to be made doesn't use up a draw.
- **Feedback reaches Astra** (deck Q6, thumbs + reason + note): a thumbs down opens "What's wrong with this card?"
  with five reasons (wrong about the science, hard to follow, boring, picture doesn't fit, other) and an optional
  one-line note; after a thumbs up, "Add a note" takes the place of "Good card?". "Report a problem" and "I wrote this
  paper" go to the server too. When the server can't be reached they stay in the friend's browser and the pop-up says so.
- **The Card Catalog for friends** (deck Q4 and Q5; **off** since Astra changed Q5: friends see only their own and
  traded cards): a **Card Catalog** button beside Rules, shown only while the server answers and the catalog is public, opens every card anyone has drawn with its thumbs counts and an "In your deck" mark, by subject and
  newest, card number or most liked. Notes, reports and who drew what never leave Astra's page
  (`components/card-catalog-20261114.tsx`, `app/card-catalog-20261114.css`).
- **Astra's page** (`/owner`) lists every card with who drew it first (an anonymous id, never a name), its thumbs,
  reasons and notes, every report and author message, and what each day cost. It opens only on her PC, with the owner
  key the server prints when it starts.
- Without the server (no address in the build, or the PC asleep) the page works exactly as before.

## Where things are

| What | Where |
|---|---|
| Server code | `server/` in this repo (`papermon-server-20261114.mjs`, `card-maker-20261114.mjs`, `catalog-20261114.mjs`, `owner-page-20261114.html`) |
| Page side | `lib/card-server-20261114.ts`, `components/card-catalog-20261114.tsx`; small hooks in `app/page.tsx` and `components/my-deck-20261114.tsx` |
| The catalog, new card pictures, owner key | Astra's PC only: `%USERPROFILE%\Documents\Astra's PetOS Data\papermon\` (never in the repo) |
| Card rules Claude follows | `RULES` in `server/card-maker-20261114.mjs`, written from [card-plan-20261113.md](card-plan-20261113.md) |

`server/package.json` and `server/package-lock.json` keep npm's required names; every other new file is dated.

## Run it on the PC

```powershell
cd "$env:USERPROFILE\Documents\Astra's PetOS\paper-girl\server"
npm ci
$env:PAPER_GIRL_ANTHROPIC_API_KEY = [Environment]::GetEnvironmentVariable('PAPER_GIRL_ANTHROPIC_API_KEY', 'User')
$env:PAPERGIRL_PATTY_OPENAI_API_KEY = [Environment]::GetEnvironmentVariable('PAPERGIRL_PATTY_OPENAI_API_KEY', 'User')
npm start
```

Once API Fairy renames the OpenAI key to `PAPERMON_PATTY_OPENAI_API_KEY` (the rename PR's name), the server uses that
name first.

The keys are read from Windows by name and never written to a file. The first start puts the starter cards in
the catalog under their own numbers (ten since PR #21: No. 1 to 10), so new cards start at No. 11.

| Setting (environment) | Default | What it does |
|---|---|---|
| `PAPERMON_DAILY_BUDGET_USD` | `2` | Money friends' new cards may cost a day (America/Denver days). After it, draws hand out catalog cards. |
| `PAPERMON_PASS_BUDGET_USD` | `25` | The daily stop for Astra's mint pass (below), kept apart from friends' budget. Only there in case the pass link leaks. |
| `PAPERMON_DRAWS_PER_DAY` | `5` | Draws per person a day (decided). |
| `PAPERMON_PUBLIC_CATALOG` | off | `1` makes `/api/catalog` public and shows friends the Card Catalog button. Off since Astra's 2026-11-14 change: friends see only their own cards. |
| `PAPERMON_ORIGINS` | the Papermon site | Pages allowed to talk to the server. |
| `PAPERMON_WRITER` | `claude` | `dry` = a free stand-in writer for testing on this PC (no AI, the bat pup picture). Never for friends. |
| `PAPERMON_PORT`, `PAPERMON_DATA` | | Loopback port and data folder. |

## Reaching it from friends' phones

The server listens on 127.0.0.1 only. A tunnel carries friends' requests to it (deck question 1, decided:
Tailscale Funnel: `tailscale funnel --bg 8830`; its address is set as `VITE_PAPERMON_SERVER` in
`.github/workflows/pages.yml`), and the site is built with the tunnel's address in `VITE_PAPERMON_SERVER`. On this PC a working
copy can be pointed at a local server with `?server=http://127.0.0.1:PORT` (only loopback addresses are accepted).

## Astra's mint pass

Astra, 2026-11-17: "can you please open up unlimited mints for me? I am going to lay in bed and just spawn a bunch".

- The server keeps a `mintPass` in `papermon-server-20261114.json` (her PC data folder, made on the first start of this
  version). Her **pass link** is the site address + `#mint=<pass>`. Only she gets it; anyone holding it can mint on her
  money, so it never goes into the repo, a page or a chat with anyone else.
- The browser that opens the link keeps the pass (`papermon:mint-pass:v1`), takes it out of the address bar, and sends
  it with each draw (`X-Papermon-Pass`). The part after `#` never reaches GitHub, only her server.
- With the pass: no five-a-day or per-network limit, the button reads "Draw Card (no limit)", and every draw mints a
  brand-new card (no catalog hand-outs). Its spending is marked `pass: ` in the spend table and kept out of friends' $2;
  it stops at `PAPERMON_PASS_BUDGET_USD` a day.
- A new pass: delete `mintPass` from the JSON file and restart the server; browsers with the old one go back to five a
  day.

## Checks

- `npm test` in `server/`: offline, no AI, no money (rules check, article text, a whole card made and saved, the mint
  pass's limits and budget).
- With `PAPERMON_WRITER=dry`: the whole draw, a new card, reuse, five-a-day, thumbs, reports and the owner lock, end
  to end, at no cost.

## Safety

Loopback only; the owner page needs the key and a request typed on this PC (tunnel requests are refused); request
bodies capped at 64 KB; friends' text is stored as text and shown with `textContent`; no names, emails or addresses are
kept (network addresses only as a salted hash, for the per-network limit); at most two new cards are made at once and
one per friend; the daily budget stops new cards before the cap is passed.

## The first five real cards (2026-11-17)

Claude's key is in Windows, Funnel is on, and the server ran for real from Astra's data folder. Five cards were drawn
the way a new friend would, in fresh browsers through the Funnel address, and checked against their papers' abstracts
and the card plan:

| No. | Name | Subject, level | Journal | Words | Picture | Card |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | Ancient Swappable Homologous Exon | Genetics, LV4 | PLOS Computational Biology | $0.130 | $0.054 | $0.184 |
| 12 | Structure-aware Methyl-spotting Transformer | Computer science, LV4 | PLOS Computational Biology | $0.098 | $0.054 | $0.152 |
| 13 | Recombinant Multiclonal Plasmodium | Medicine, LV4 | PLOS Computational Biology | $0.125 | $0.054 | $0.179 |
| 14 | Prophylactic Registered Dogbite | Medicine, LV2 | PLOS Neglected Tropical Diseases | $0.107 | $0.054 | $0.161 |
| 15 | Silent Gallstone Stowaway | Medicine, LV3 | PLOS Neglected Tropical Diseases | $0.061 | $0.054 | $0.115 |

- About **$0.16 a card** (Claude's words $0.06-0.13, OpenAI's picture $0.054). The $2 a day buys about 12 cards.
- **Two papers were turned down** by Claude's safety check for disease-causing germs (both *PLOS Pathogens*: a
  trypanosome killing immune cells, a Toxoplasma invasion enzyme). A refusal still costs the reading, $0.10-0.13.
  Since then a refusal (or any other problem with that one paper) is marked `retry`, the page quietly tries up to
  three papers, and a draw that ends with no card is given back.
- Every fact on the five cards matches its abstract. Pictures follow style E with no text; No. 13 shows two parasites
  and No. 14 makes a record folder the hero though the paper has a dog (the guide says the living thing comes first).
- A friend who already holds a card in the catalog gets it free in about 2 seconds; new cards took 80-100 seconds.

## Still to do (2026-11-17)

1. Done: PR #20 merged (e1c8a46); the live site's build has the Funnel address, and the server answers it from outside
   the tailnet.
2. Keep the server running on the PC (now from a `%TEMP%` worktree; Server Salamander can host it later). A Node.js
   update closes it (Windows' installer stops every running Node program), so restart it after one.
3. On a device that is on Astra's tailnet, the Funnel name points at the PC's private address, and Chrome and Edge's
   Local Network Access check blocks the public site from calling it (`LocalNetworkAccessPermissionDenied`). Friends
   off the tailnet are not affected. Safari does not have this check.
4. A failed paper search says "The journal library is taking too long" whatever went wrong (`lib/browser-library.ts`);
   seen four times in a row on 2026-11-17 while Europe PMC answered in about 3 seconds.

## Known limits

- New cards' pictures load from the server. While the PC is asleep, a friend sees pictures only for the cards their
  browser has already loaded.
- One server, on Astra's desktop until the home server box arrives (card plan Q5).

Written by Claude Opus 5.5 (`claude-opus-5-5`), 2026-11-14.
