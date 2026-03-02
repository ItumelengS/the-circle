-- Add savings pool group type support
ALTER TABLE groups ADD COLUMN group_type text NOT NULL DEFAULT 'rotation';
ALTER TABLE groups ADD COLUMN payout_months integer;
ALTER TABLE groups ADD COLUMN start_date timestamptz;
