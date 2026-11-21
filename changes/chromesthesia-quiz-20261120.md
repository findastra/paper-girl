# The chromesthesia quiz is Paper Girl's own website (2026-11-20)

Astra, 2026-11-20: "i want this to be on a server so anybody can use it give live link", then "I think it needs to go
under Journal Jelly or like somewhere else idk... studying people...". She picked Paper Patty from three choices
(Paper Patty, Drum Dog, a new pet): Paper Girl is her science desk, and a quiz that studies how people hear color is a
small science study. Journal Jellyfish keeps a private travel diary, so a public study did not fit her.

**What it is:** a native program of Paper Girl, `paper-girl-v1.0-chromesthesia-quiz-v1.0`. A game is 12 rounds, one
per note (Round X/12). Each round plays a hidden note, the player picks a color on a wheel, then sees their color,
everyone's average for that note, and the color Scriabin gave it. "History and every note" opens to their past answers
and the crowd average for all 12 notes.

**Live:** https://paper-girl-chromesthesia.findastra.workers.dev (Cloudflare Worker `paper-girl-chromesthesia`, on
Astra's Cloudflare account, with the D1 database `paper-girl-chromesthesia`). Anyone with the link can play; no
account is needed.

**Results:** `/results#<key>` shows each player's name, their latest color for every note, how many answers they gave
and their match with Scriabin. The key is the Worker secret `RESULTS_KEY`; it is not in this repo, and Astra was given
the full link in chat. Players see a line saying their name and colors are saved and that the maker can see them.

**Files:** `chromesthesia-quiz-20261120/` holds the Worker (`worker-20261120.js`), the quiz and results pages, the
table (`schema-20261120.sql`) and the Cloudflare settings (`wrangler-20261120.jsonc`, no secrets). To deploy again:
`npx wrangler@4.166.0 deploy --config chromesthesia-quiz-20261120/wrangler-20261120.jsonc` (from a short folder path
on Windows; a very long path makes wrangler fail with "A file or directory could not be found").

**Footer:** the unified footer, as in astras-pet-os on 2026-11-20: By Astra, a sparkle, her photostar (never a link),
a sparkle, Find Out More, and only the GitHub link.

**Limits:** a player is a random id kept in that browser, so clearing site data or switching devices starts a new
player with the same name. Names are what people type; they are not checked. One player can save at most 1,000
answers. The crowd average uses each player's latest answer for each note.

**Second pass, same day.** Astra: "make it so that when you say next note it doesnt automatically play ... the
background needs to be pitch black and all of the accents gray scale, and color wheel doest show until you play the
sound so it doesnt skew the readers eyes. also, make this piano keys. also, get other studies to comapare your results
to, and you can compare between other uses who have visited the site."

- Next note waits for Play. The wheel, the brightness slider and the swatch stay hidden until the note has played.
- The background is #000 and every control is gray, white or black. The only color left is the wheel and the answers;
  the photostar in the footer is shown in grayscale. The results page matches.
- The tone is a piano sound: a fast hammer attack, slightly stretched overtones that fade faster the higher they are,
  and a soft felt thump. The reveal and the comparisons show one octave of piano keys colored by the answers.
- Studies to compare with: Itoh et al. 2017 (Sci Rep, doi:10.1038/s41598-017-18150-y; 15 pitch-class synesthetes,
  rainbow hues from do red to si violet). The paper gives a hue rule, not per-note colors, so its colors are
  estimated from that rule and labelled that way. Also Scriabin 1910, Castel 1734 and Newton 1704, each labelled as
  a design rather than a study of people.
- Players can compare with each other. `GET /api/players` lists other players' names and latest colors, never their
  ids, and only players whose newest answer says "Let other players compare their colors with mine" (ticked by
  default, untickable). The table gained `share` (`migrate-share-20261120.sql`). Answers saved before this pass stay
  unshared, because those players were told only the maker could see them.

**Not recorded yet:** the hub's records for a new native program (`system-map.json`, the pet program page's tool
panel, TOOLS-AND-TRICKS.md, the new-pet-or-tool decisions table) are not changed by this pull request.

Claude Opus 5.5 (`claude-opus-5-5`), 2026-11-20. The first version was a claude.ai artifact, made earlier the same day.
