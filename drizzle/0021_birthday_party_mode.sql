-- 0021_birthday_party_mode.sql
-- Party mode is opt-in per birthday/anniversary record. Every installation
-- starts with all events disabled; each household chooses its own events in
-- Settings -> Party Mode.

ALTER TABLE public.birthdays
  ADD COLUMN IF NOT EXISTS party_mode_enabled boolean DEFAULT false NOT NULL;
