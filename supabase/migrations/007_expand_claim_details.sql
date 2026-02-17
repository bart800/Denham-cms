-- Migration 007: Expand claim_details to match full Filevine intake form
-- Run this in Supabase SQL Editor

-- Claim status and loss details
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS claim_status TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS type_of_loss TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS type_of_loss_detail TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS areas_of_damage TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS how_noticed_damage TEXT;

-- Property details
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS insured_property_state TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS insured_property_zip TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS insured_county TEXT;

-- Policy coverage (A=Dwelling, B=Other Structure, C=Contents, ALE)
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS coverage_dwelling NUMERIC;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS coverage_other_structure NUMERIC;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS coverage_contents NUMERIC;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS coverage_ale NUMERIC;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS coverage_loss_of_income NUMERIC;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS policy_period_start DATE;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS policy_period_end DATE;

-- Other insured / defendant
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS other_insured_on_policy BOOLEAN;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS third_party_insurance BOOLEAN;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS third_party_policy_number TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS third_party_claim_number TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS third_party_liability_status TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS additional_endorsement_amounts TEXT;

-- Mortgage
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS has_mortgage BOOLEAN;

-- Estimates
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS estimate_total NUMERIC;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS estimate_interior NUMERIC;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS estimate_date DATE;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS has_pa_contractor_estimates BOOLEAN;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS estimates_still_needed BOOLEAN;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS count_estimates_upload INT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS count_denial_letter INT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS count_carrier_estimate INT;

-- Repairs and damage
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS has_interior_damage BOOLEAN;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS has_made_repairs BOOLEAN;

-- Payments
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS has_prior_payments BOOLEAN;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS amount_of_payments TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS check_cashed BOOLEAN;

-- Prior claims
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS has_prior_claim BOOLEAN;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS prior_claim_date TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS prior_claim_with TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS prior_claim_reason TEXT;

-- Property info
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS where_damage TEXT;

-- Intake/referral
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS date_of_intake DATE;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS date_contract_signed DATE;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS marketing_source TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS other_explanation TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS additional_information TEXT;

-- Filevine Person IDs (for cross-reference)
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS fv_adjuster_id TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS fv_defendant_id TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS fv_mortgage_id TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS fv_other_insured_id TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS fv_registered_agent_id TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS fv_referred_by_id TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS fv_third_party_insurer_id TEXT;
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS fv_third_party_adjuster_id TEXT;

-- Phase from Filevine
ALTER TABLE claim_details ADD COLUMN IF NOT EXISTS phase TEXT;

-- Expand litigation_details for court/case info from caseSummary
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS court_caption TEXT;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS plaintiff_caption TEXT;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS defendant_caption TEXT;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS case_description TEXT;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS contract_signed DATE;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS completed_date DATE;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS primary_attorney TEXT;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS support_staff TEXT;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS sol_date DATE;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS sol_basis TEXT;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS certificate_of_service TEXT;
ALTER TABLE litigation_details ADD COLUMN IF NOT EXISTS secondary_attorney TEXT;
