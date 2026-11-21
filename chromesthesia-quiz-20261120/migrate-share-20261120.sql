-- Adds the compare-with-me choice to a database made from the first schema. Answers saved before this
-- were saved when players were told only the maker could see them, so they stay unshared (0).
ALTER TABLE answers ADD COLUMN share INTEGER NOT NULL DEFAULT 0;
