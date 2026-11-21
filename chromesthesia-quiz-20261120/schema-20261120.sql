-- Paper Girl's chromesthesia quiz: one row per answer. A player is a random id kept in that browser.
-- share = 1: this player agreed (on this answer) that other players may compare with their colors.
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player TEXT NOT NULL,
  name TEXT NOT NULL,
  note INTEGER NOT NULL,
  h INTEGER NOT NULL,
  s INTEGER NOT NULL,
  l INTEGER NOT NULL,
  at INTEGER NOT NULL,
  share INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS answers_player_note ON answers (player, note, id);
