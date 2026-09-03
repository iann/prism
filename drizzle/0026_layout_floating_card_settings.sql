-- Per-dashboard overlay preferences. Integration credentials remain encrypted
-- in api_credentials and are never stored in this column.
ALTER TABLE layouts ADD COLUMN IF NOT EXISTS floating_card_settings jsonb;
