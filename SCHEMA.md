# Denham CMS Database Schema Reference

**ALWAYS reference this file when writing API routes or components that query Supabase.**

## cases (305 rows)
- id UUID PK
- ref TEXT (e.g. "DC-2024-0001")
- client_name TEXT
- client_phone TEXT
- client_email TEXT
- type TEXT (Fire, Water, Wind, Hail, Other)
- status TEXT (Open, Presuit Demand, Litigation-Filed, Settled, etc.)
- jurisdiction TEXT (KY, OH, TN, FL, TX, etc.)
- attorney_id UUID FK → team_members
- support_id UUID FK → team_members
- date_of_loss DATE
- date_opened DATE
- statute_of_limitations DATE
- insurer TEXT
- claim_number TEXT
- policy_number TEXT
- total_recovery NUMERIC
- attorney_fees NUMERIC
- property_address TEXT
- cause_of_loss TEXT
- adjuster_name TEXT
- adjuster_phone TEXT
- adjuster_email TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

## team_members (12 rows)
- id UUID PK
- name TEXT
- email TEXT
- role TEXT
- title TEXT
- color TEXT (hex color)
- created_at TIMESTAMPTZ

## documents (37K+ rows)
- id UUID PK
- case_id UUID FK → cases
- storage_path TEXT
- original_path TEXT
- filename TEXT
- extension TEXT
- category TEXT
- size_bytes BIGINT
- mime_type TEXT
- modified_at TIMESTAMPTZ
- uploaded_at TIMESTAMPTZ

## case_notes
- id UUID PK
- case_id UUID FK → cases
- author_id UUID FK → team_members
- content TEXT
- pinned BOOLEAN
- created_at, updated_at TIMESTAMPTZ

## case_emails
- id UUID PK
- case_id UUID FK → cases
- subject, from_address, to_address, cc_address TEXT
- body_text, body_html TEXT
- received_at TIMESTAMPTZ
- direction TEXT ('inbound'/'outbound')
- read, starred BOOLEAN
- created_at TIMESTAMPTZ

## case_tasks
- id UUID PK
- case_id UUID FK → cases
- title TEXT, description TEXT
- assigned_to UUID FK → team_members
- due_date DATE
- priority TEXT ('low'/'medium'/'high'/'urgent')
- status TEXT ('pending'/'in_progress'/'completed'/'cancelled')
- created_by UUID FK → team_members
- created_at, updated_at, completed_at TIMESTAMPTZ

## negotiations
- id UUID PK
- case_id UUID FK → cases
- type TEXT (demand/offer/counter)
- amount NUMERIC
- date DATE
- notes TEXT
- created_at TIMESTAMPTZ

## estimates
- id UUID PK
- case_id UUID FK → cases
- type TEXT, source TEXT
- amount NUMERIC
- date DATE
- notes TEXT
- created_at TIMESTAMPTZ

## discovery_sets
- id UUID PK
- case_id UUID FK → cases
- type TEXT, direction TEXT, title TEXT
- served_date, due_date, response_date DATE
- status TEXT, notes TEXT
- created_at, updated_at TIMESTAMPTZ

## discovery_items
- id UUID PK
- set_id UUID FK → discovery_sets
- item_number INT
- request_text, response_text, objection_text, notes TEXT
- status TEXT
- created_at TIMESTAMPTZ

## activity_log
- id UUID PK
- case_id UUID FK → cases
- user_id UUID FK → team_members
- type TEXT
- description TEXT
- created_at TIMESTAMPTZ

## claim_details
- id UUID PK
- case_id UUID FK → cases
- (various claim-specific fields)

## litigation_details
- id UUID PK
- case_id UUID FK → cases
- (various litigation-specific fields)
