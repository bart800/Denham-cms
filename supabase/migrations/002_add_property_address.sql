-- Add enrichment columns to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS property_address TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS cause_of_loss TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS adjuster_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS adjuster_phone TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS adjuster_email TEXT;
