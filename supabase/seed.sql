-- =============================================================
-- Denham CMS — Comprehensive Seed Data
-- Mirrors genData() from denham-staff-portal.jsx (seed=42)
-- =============================================================

-- Seed: Team Members
INSERT INTO team_members (legacy_id, name, role, title, initials, color) VALUES
  (1,  'Bart Denham',        'Admin',           'Principal Attorney',   'BD', '#ebb003'),
  (2,  'Joey',               'Attorney',        'Associate Attorney',   'JY', '#5b8def'),
  (3,  'Chad',               'Attorney',        'Associate Attorney',   'CH', '#e07850'),
  (4,  'Daniel Kwiatkowski', 'Attorney',        'Associate Attorney',   'DK', '#50c878'),
  (5,  'Eliza',              'Paralegal',       'Paralegal',            'EL', '#c77dba'),
  (6,  'Kristen',            'Case Manager',    'Case Manager',         'KR', '#e0a050'),
  (7,  'Shelby',             'Legal Assistant',  'Legal Assistant',     'SH', '#50b8c8'),
  (8,  'Kami',               'Legal Assistant',  'Legal Assistant',     'KM', '#d4708f'),
  (9,  'Martin',             'Attorney',        'Of Counsel',           'MR', '#7eb87e'),
  (10, 'Justin',             'Legal Assistant',  'Legal Assistant',     'JT', '#8888cc'),
  (11, 'Caroline',           'Legal Assistant',  'Legal Assistant',     'CR', '#cc8888'),
  (12, 'Ariana',             'Paralegal',       'Paralegal',            'AR', '#88ccaa')
ON CONFLICT (legacy_id) DO NOTHING;

-- =============================================================
-- Generate all case data via PL/pgSQL (deterministic PRNG)
-- =============================================================
DO $$
DECLARE
  -- PRNG state (same seed=42 as JS)
  _seed BIGINT := 42;

  -- Loop vars
  i INT;
  n INT;
  e INT;
  p INT;
  a INT;
  d INT;

  -- Picked values
  v_juris TEXT;
  v_type TEXT;
  v_status TEXT;
  v_insurer TEXT;
  v_first TEXT;
  v_last TEXT;
  v_is_property BOOLEAN;
  v_is_litigation BOOLEAN;
  v_is_closed BOOLEAN;
  v_sol_yrs INT;
  v_min_dol_year INT;
  v_dol DATE;
  v_dop DATE;
  v_sol DATE;
  v_ref TEXT;
  v_cn TEXT;
  v_pn TEXT;
  v_att_legacy INT;
  v_sup_legacy INT;
  v_att_id UUID;
  v_sup_id UUID;
  v_case_id UUID;
  v_total_rec NUMERIC(12,2);
  v_att_fees NUMERIC(12,2);
  v_client_phone TEXT;
  v_client_email TEXT;

  -- Claim detail vars
  v_adj_first TEXT;
  v_adj_last TEXT;
  v_date_reported DATE;
  v_date_denied DATE;
  v_policy_type TEXT;
  v_cause TEXT;
  v_prop_addr TEXT;
  v_city TEXT;

  -- Litigation vars
  v_case_num TEXT;
  v_court TEXT;
  v_judge TEXT;
  v_filed_date DATE;
  v_opp_counsel TEXT;
  v_opp_firm TEXT;
  v_opp_phone TEXT;
  v_opp_email TEXT;
  v_trial_date DATE;
  v_med_date DATE;
  v_disc_deadline DATE;

  -- Negotiation vars
  v_neg_count INT;
  v_neg_date DATE;
  v_neg_type TEXT;
  v_neg_amount NUMERIC(12,2);
  v_neg_by TEXT;

  -- Estimate vars
  v_est_count INT;
  v_est_date DATE;
  v_est_type TEXT;
  v_est_amount NUMERIC(12,2);
  v_est_vendor TEXT;
  v_est_notes TEXT;

  -- Pleading vars
  v_plea_count INT;
  v_plea_date DATE;
  v_plea_type TEXT;
  v_plea_filed_by TEXT;
  v_plea_status TEXT;
  v_plea_notes TEXT;
  v_plea_doc TEXT;

  -- Activity vars
  v_act_count INT;
  v_act_date DATE;
  v_act_time TEXT;
  v_act_type TEXT;
  v_act_actor_legacy INT;
  v_act_actor_name TEXT;
  v_act_actor_ini TEXT;
  v_act_actor_clr TEXT;
  v_act_title TEXT;
  v_act_desc TEXT;

  -- Discovery vars
  v_disc_set_id UUID;
  v_disc_type TEXT;
  v_disc_served DATE;
  v_disc_due DATE;
  v_disc_from TEXT;
  v_disc_status TEXT;
  v_item_count INT;
  v_item_text TEXT;
  v_item_status TEXT;

  -- Temp
  v_rand FLOAT;
  v_idx INT;

  -- Arrays matching JS constants
  arr_juris TEXT[] := ARRAY['KY','TN','MT','NC','TX','CA','WA','CO','NY'];
  arr_ctypes TEXT[] := ARRAY['Property - Wind/Hail','Property - Fire','Property - Water','Property - Theft','Property - Mold','Personal Injury - Auto','Personal Injury - Slip & Fall','Personal Injury - Dog Bite'];
  arr_cstats TEXT[] := ARRAY['Intake','Investigation','Presuit Demand','Presuit Negotiation','Litigation - Filed','Litigation - Discovery','Litigation - Mediation','Litigation - Trial Prep','Appraisal','Settled','Closed'];
  arr_insurers TEXT[] := ARRAY['State Farm','Allstate','USAA','Liberty Mutual','Nationwide','Travelers','Progressive','Erie','QBE','Citizens','Farmers','American Family','Auto-Owners','Cincinnati Financial','Westfield'];
  arr_fn TEXT[] := ARRAY['James','Mary','Robert','Linda','Michael','Barbara','William','Susan','David','Jessica','Thomas','Sarah','Richard','Karen','Joseph','Lisa','Charles','Nancy','Daniel','Betty','Mark','Dorothy','Paul','Sandra','Steven','Ashley','Kevin','Kimberly','Brian','Emily'];
  arr_ln TEXT[] := ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin'];
  arr_st TEXT[] := ARRAY['Main St','Oak Ave','Maple Dr','Cedar Ln','Pine Rd','Elm St','Walnut Ct','Birch Way'];
  arr_ptypes TEXT[] := ARRAY['Complaint','Answer','Motion to Dismiss','Motion for Summary Judgment','Motion to Compel','Interrogatories','Requests for Production','Requests for Admission','Deposition Notice','Subpoena','Motion in Limine','Pretrial Order','Mediation Brief','Trial Brief'];
  arr_etypes TEXT[] := ARRAY['Contractor Estimate','Public Adjuster Estimate','Insurance Estimate','Supplement','Engineer Report','Independent Estimate'];
  arr_atypes TEXT[] := ARRAY['note','call','email','task','document','negotiation','pleading','estimate','status_change','deadline'];
  arr_ntypes TEXT[] := ARRAY['bottom_line','plaintiff_offer','defendant_offer','presuit_demand','settlement','undisputed_payment','denial','appraisal_award'];
  arr_att_ids INT[] := ARRAY[1,2,3,4,9]; -- Admin + Attorney legacy_ids
  arr_sup_ids INT[] := ARRAY[5,6,7,8,10,11,12]; -- non-attorney legacy_ids
  arr_all_ids INT[] := ARRAY[1,2,3,4,5,6,7,8,9,10,11,12];
  arr_plea_statuses TEXT[] := ARRAY['Filed','Served','Pending','Granted','Denied','Withdrawn'];
  arr_plea_notes TEXT[] := ARRAY['E-filed','Served via email','Hearing scheduled','Awaiting ruling',''];
  arr_vendor_prefix TEXT[] := ARRAY['Premier','National','Apex','Summit'];
  arr_vendor_suffix TEXT[] := ARRAY['Roofing','Construction','Restoration','Engineering'];
  arr_est_notes TEXT[] := ARRAY['Full scope','Partial - supplement pending','Depreciation included','Emergency repairs only'];
  arr_disc_types TEXT[] := ARRAY['Interrogatories','Requests for Production','Requests for Admission'];
  arr_disc_statuses TEXT[] := ARRAY['pending','in_progress','completed','overdue'];
  arr_item_statuses TEXT[] := ARRAY['pending','drafted','reviewed','final','objection_only'];
  arr_objections TEXT[] := ARRAY['Overly broad','Unduly burdensome','Not reasonably calculated','Attorney-client privilege','Work product doctrine','Vague and ambiguous'];

  -- City arrays per jurisdiction
  arr_cities_ky TEXT[] := ARRAY['Lexington','Louisville','Frankfort'];
  arr_cities_tn TEXT[] := ARRAY['Nashville','Memphis','Knoxville'];
  arr_cities_mt TEXT[] := ARRAY['Billings','Missoula','Helena'];
  arr_cities_nc TEXT[] := ARRAY['Charlotte','Raleigh','Asheville'];
  arr_cities_tx TEXT[] := ARRAY['Houston','Dallas','Austin'];
  arr_cities_ca TEXT[] := ARRAY['Los Angeles','San Francisco','San Diego'];
  arr_cities_wa TEXT[] := ARRAY['Seattle','Tacoma','Spokane'];
  arr_cities_co TEXT[] := ARRAY['Denver','Boulder','Colorado Springs'];
  arr_cities_ny TEXT[] := ARRAY['New York','Buffalo','Albany'];

  arr_court_types TEXT[] := ARRAY['Circuit','District','Superior'];
  arr_email_domains TEXT[] := ARRAY['gmail','yahoo','outlook'];
  arr_policy_prop TEXT[] := ARRAY['HO-3','HO-5','HO-6','Commercial Property'];
  arr_policy_pi TEXT[] := ARRAY['Auto Liability','Premises Liability'];
  arr_cause_prop TEXT[] := ARRAY['Wind/Hail','Fire','Water Damage','Theft','Mold'];
  arr_cause_pi TEXT[] := ARRAY['Auto Collision','Slip & Fall','Dog Bite'];
  arr_deductible TEXT[] := ARRAY['1,000','2,500','5,000'];

  -- Note/title arrays per activity type
  arr_note_titles TEXT[] := ARRAY['Case note added','Internal memo','Client update'];
  arr_call_titles TEXT[] := ARRAY['Called client','Called adjuster','Conference call'];
  arr_email_titles TEXT[] := ARRAY['Email to adjuster','Email from client','Demand sent'];
  arr_task_titles TEXT[] := ARRAY['Task created','Task completed'];
  arr_doc_titles TEXT[] := ARRAY['Doc uploaded','Doc signed','Policy uploaded'];
  arr_neg_titles TEXT[] := ARRAY['Offer received','Counter sent','Demand issued'];
  arr_plea_titles TEXT[] := ARRAY['Motion filed','Response served','Discovery sent'];
  arr_est_titles TEXT[] := ARRAY['Estimate received','Supplement submitted'];
  arr_act_descs TEXT[] := ARRAY['','Details attached','Follow up required','No action needed','Awaiting response'];

  arr_disc_item_texts_interrog TEXT[] := ARRAY[
    'State the full legal name of each person who investigated the claim.',
    'Describe in detail the basis for each coverage denial.',
    'Identify all documents reviewed in making the coverage determination.',
    'State the total amount of each payment made under the policy.',
    'Describe the qualifications of each adjuster assigned to this claim.',
    'Identify all communications between you and any reinsurer regarding this claim.',
    'State whether you contend any policy exclusion applies and the factual basis.',
    'Describe all inspections of the subject property conducted by you or your agents.',
    'State the amount of depreciation applied to each line item and the basis.',
    'Identify all experts retained in connection with this claim.'
  ];
  arr_disc_item_texts_rfp TEXT[] := ARRAY[
    'The complete claim file for claim number referenced in the Complaint.',
    'All photographs taken of the subject property.',
    'All correspondence between you and the insured regarding this claim.',
    'All estimates, bids, or repair scopes prepared or obtained by you.',
    'The complete underwriting file for the subject policy.',
    'All training materials provided to adjusters handling similar claims.',
    'All internal memoranda regarding this claim.',
    'All communications with any independent adjuster regarding this claim.',
    'The personnel file of each adjuster who handled this claim.',
    'All documents reflecting payments made under this policy.'
  ];
  arr_disc_item_texts_rfa TEXT[] := ARRAY[
    'Admit that the subject property sustained damage from the claimed peril.',
    'Admit that you received timely notice of the claim.',
    'Admit that the policy was in full force and effect on the date of loss.',
    'Admit that no policy exclusion bars coverage for the claimed damages.',
    'Admit that you failed to pay the full replacement cost value.',
    'Admit that your estimate understated the cost of repairs.',
    'Admit that you did not inspect the property within 15 days of the claim.',
    'Admit that depreciation was improperly applied to non-depreciable items.',
    'Admit that you failed to provide a written coverage determination within 30 days.',
    'Admit that you retained an engineer who did not physically inspect the property.'
  ];

BEGIN
  -- Main loop: 200 cases
  FOR i IN 0..199 LOOP
    -- PRNG: next random
    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_juris, 1))::INT;
    IF v_idx > array_length(arr_juris, 1) THEN v_idx := array_length(arr_juris, 1); END IF;
    v_juris := arr_juris[v_idx];

    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_ctypes, 1))::INT;
    IF v_idx > array_length(arr_ctypes, 1) THEN v_idx := array_length(arr_ctypes, 1); END IF;
    v_type := arr_ctypes[v_idx];

    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_cstats, 1))::INT;
    IF v_idx > array_length(arr_cstats, 1) THEN v_idx := array_length(arr_cstats, 1); END IF;
    v_status := arr_cstats[v_idx];

    v_is_property := v_type LIKE 'Property%';
    v_is_litigation := v_status LIKE 'Litigation%';
    v_is_closed := v_status IN ('Settled','Closed');

    -- Attorney pick
    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_att_ids, 1))::INT;
    IF v_idx > array_length(arr_att_ids, 1) THEN v_idx := array_length(arr_att_ids, 1); END IF;
    v_att_legacy := arr_att_ids[v_idx];

    -- Support pick
    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_sup_ids, 1))::INT;
    IF v_idx > array_length(arr_sup_ids, 1) THEN v_idx := array_length(arr_sup_ids, 1); END IF;
    v_sup_legacy := arr_sup_ids[v_idx];

    -- Insurer pick
    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_insurers, 1))::INT;
    IF v_idx > array_length(arr_insurers, 1) THEN v_idx := array_length(arr_insurers, 1); END IF;
    v_insurer := arr_insurers[v_idx];

    -- First name
    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_fn, 1))::INT;
    IF v_idx > array_length(arr_fn, 1) THEN v_idx := array_length(arr_fn, 1); END IF;
    v_first := arr_fn[v_idx];

    -- Last name
    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_ln, 1))::INT;
    IF v_idx > array_length(arr_ln, 1) THEN v_idx := array_length(arr_ln, 1); END IF;
    v_last := arr_ln[v_idx];

    -- Claim/policy numbers
    _seed := (_seed * 16807) % 2147483647;
    v_cn := upper(left(v_insurer, 2)) || '-' || (100000 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 900000)::INT)::TEXT;
    _seed := (_seed * 16807) % 2147483647;
    v_pn := 'POL-' || (1000000 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 9000000)::INT)::TEXT;

    -- SOL years
    v_sol_yrs := CASE v_juris
      WHEN 'KY' THEN 5 WHEN 'TN' THEN 1 WHEN 'MT' THEN 5 WHEN 'NC' THEN 3
      WHEN 'TX' THEN 2 WHEN 'CA' THEN 2 WHEN 'WA' THEN 3 WHEN 'CO' THEN 2
      WHEN 'NY' THEN 3 ELSE 3
    END;

    -- Date of loss
    v_min_dol_year := CASE WHEN v_is_closed THEN 2022 ELSE GREATEST(2024, 2026 - v_sol_yrs) END;
    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_dol := (make_date(v_min_dol_year, 1, 1) + (v_rand * (make_date(2025, 12, 31) - make_date(v_min_dol_year, 1, 1)))::INT)::DATE;

    -- Date opened
    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_dop := (make_date(GREATEST(2024, EXTRACT(YEAR FROM v_dol)::INT), 1, 1) +
              (v_rand * (make_date(2026, 12, 31) - make_date(GREATEST(2024, EXTRACT(YEAR FROM v_dol)::INT), 1, 1)))::INT)::DATE;
    -- Clamp dop to not be before dol
    IF v_dop < v_dol THEN v_dop := v_dol + 7; END IF;

    -- SOL date
    v_sol := v_dol + (v_sol_yrs * 365)::INT;

    -- Ref
    v_ref := 'DEN-' || right((2024 + (i / 80))::TEXT, 2) || '-' || lpad((i + 1)::TEXT, 4, '0');

    -- Client contact
    _seed := (_seed * 16807) % 2147483647;
    v_client_phone := '(' || (200 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 800)::INT)::TEXT || ') ';
    _seed := (_seed * 16807) % 2147483647;
    v_client_phone := v_client_phone || (200 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 800)::INT)::TEXT || '-';
    _seed := (_seed * 16807) % 2147483647;
    v_client_phone := v_client_phone || (1000 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 9000)::INT)::TEXT;

    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_email_domains, 1))::INT;
    IF v_idx > array_length(arr_email_domains, 1) THEN v_idx := array_length(arr_email_domains, 1); END IF;
    v_client_email := lower(v_first) || '.' || lower(v_last) || '@' || arr_email_domains[v_idx] || '.com';

    -- Recovery amounts
    IF v_is_closed AND v_status = 'Settled' THEN
      _seed := (_seed * 16807) % 2147483647;
      v_total_rec := 15000 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 735000);
      _seed := (_seed * 16807) % 2147483647;
      v_att_fees := 5000 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 245000);
    ELSE
      v_total_rec := 0;
      v_att_fees := 0;
    END IF;

    -- Lookup UUIDs
    SELECT id INTO v_att_id FROM team_members WHERE legacy_id = v_att_legacy;
    SELECT id INTO v_sup_id FROM team_members WHERE legacy_id = v_sup_legacy;

    -- INSERT case
    INSERT INTO cases (id, ref, client_name, client_phone, client_email, type, status,
      jurisdiction, attorney_id, support_id, date_of_loss, date_opened,
      statute_of_limitations, insurer, claim_number, policy_number, total_recovery, attorney_fees)
    VALUES (uuid_generate_v4(), v_ref, v_first || ' ' || v_last, v_client_phone, v_client_email,
      v_type, v_status, v_juris, v_att_id, v_sup_id, v_dol, v_dop, v_sol,
      v_insurer, v_cn, v_pn, v_total_rec, v_att_fees)
    RETURNING id INTO v_case_id;

    -- =========================================================
    -- CLAIM DETAILS
    -- =========================================================
    -- Adjuster name
    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_fn, 1))::INT;
    IF v_idx > array_length(arr_fn, 1) THEN v_idx := array_length(arr_fn, 1); END IF;
    v_adj_first := arr_fn[v_idx];

    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    v_idx := 1 + floor(v_rand * array_length(arr_ln, 1))::INT;
    IF v_idx > array_length(arr_ln, 1) THEN v_idx := array_length(arr_ln, 1); END IF;
    v_adj_last := arr_ln[v_idx];

    -- Date reported (1-30 days after DOL)
    _seed := (_seed * 16807) % 2147483647;
    v_date_reported := v_dol + (1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 30))::INT;

    -- Date denied (60% chance, 30-120 days after DOL)
    _seed := (_seed * 16807) % 2147483647;
    v_rand := (_seed - 1)::FLOAT / 2147483646.0;
    IF v_rand > 0.6 THEN
      _seed := (_seed * 16807) % 2147483647;
      v_date_denied := v_dol + (30 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 90))::INT;
    ELSE
      v_date_denied := NULL;
    END IF;

    -- Policy type
    IF v_is_property THEN
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_policy_prop, 1))::INT;
      IF v_idx > array_length(arr_policy_prop, 1) THEN v_idx := array_length(arr_policy_prop, 1); END IF;
      v_policy_type := arr_policy_prop[v_idx];
    ELSE
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_policy_pi, 1))::INT;
      IF v_idx > array_length(arr_policy_pi, 1) THEN v_idx := array_length(arr_policy_pi, 1); END IF;
      v_policy_type := arr_policy_pi[v_idx];
    END IF;

    -- Cause of loss
    IF v_is_property THEN
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_cause_prop, 1))::INT;
      IF v_idx > array_length(arr_cause_prop, 1) THEN v_idx := array_length(arr_cause_prop, 1); END IF;
      v_cause := arr_cause_prop[v_idx];
    ELSE
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_cause_pi, 1))::INT;
      IF v_idx > array_length(arr_cause_pi, 1) THEN v_idx := array_length(arr_cause_pi, 1); END IF;
      v_cause := arr_cause_pi[v_idx];
    END IF;

    -- Property address (only for property cases)
    IF v_is_property THEN
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_st, 1))::INT;
      IF v_idx > array_length(arr_st, 1) THEN v_idx := array_length(arr_st, 1); END IF;

      _seed := (_seed * 16807) % 2147483647;
      v_prop_addr := (100 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 9900)::INT)::TEXT || ' ' || arr_st[v_idx] || ', ';

      -- City
      CASE v_juris
        WHEN 'KY' THEN
          _seed := (_seed * 16807) % 2147483647;
          v_idx := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT;
          IF v_idx > 3 THEN v_idx := 3; END IF;
          v_city := arr_cities_ky[v_idx];
        WHEN 'TN' THEN
          _seed := (_seed * 16807) % 2147483647;
          v_idx := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT;
          IF v_idx > 3 THEN v_idx := 3; END IF;
          v_city := arr_cities_tn[v_idx];
        WHEN 'MT' THEN
          _seed := (_seed * 16807) % 2147483647;
          v_idx := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT;
          IF v_idx > 3 THEN v_idx := 3; END IF;
          v_city := arr_cities_mt[v_idx];
        WHEN 'NC' THEN
          _seed := (_seed * 16807) % 2147483647;
          v_idx := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT;
          IF v_idx > 3 THEN v_idx := 3; END IF;
          v_city := arr_cities_nc[v_idx];
        WHEN 'TX' THEN
          _seed := (_seed * 16807) % 2147483647;
          v_idx := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT;
          IF v_idx > 3 THEN v_idx := 3; END IF;
          v_city := arr_cities_tx[v_idx];
        WHEN 'CA' THEN
          _seed := (_seed * 16807) % 2147483647;
          v_idx := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT;
          IF v_idx > 3 THEN v_idx := 3; END IF;
          v_city := arr_cities_ca[v_idx];
        WHEN 'WA' THEN
          _seed := (_seed * 16807) % 2147483647;
          v_idx := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT;
          IF v_idx > 3 THEN v_idx := 3; END IF;
          v_city := arr_cities_wa[v_idx];
        WHEN 'CO' THEN
          _seed := (_seed * 16807) % 2147483647;
          v_idx := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT;
          IF v_idx > 3 THEN v_idx := 3; END IF;
          v_city := arr_cities_co[v_idx];
        WHEN 'NY' THEN
          _seed := (_seed * 16807) % 2147483647;
          v_idx := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT;
          IF v_idx > 3 THEN v_idx := 3; END IF;
          v_city := arr_cities_ny[v_idx];
        ELSE v_city := 'Unknown';
      END CASE;
      v_prop_addr := v_prop_addr || v_city || ', ' || v_juris;
    ELSE
      v_prop_addr := NULL;
    END IF;

    -- Adjuster contact
    _seed := (_seed * 16807) % 2147483647;

    INSERT INTO claim_details (case_id, policy_number, claim_number, insurer,
      adjuster_name, adjuster_phone, adjuster_email, date_of_loss, date_reported,
      date_denied, policy_type, policy_limits, deductible, cause_of_loss, property_address)
    VALUES (v_case_id, v_pn, v_cn, v_insurer,
      v_adj_first || ' ' || v_adj_last,
      '(' || (200 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 800)::INT)::TEXT || ') ' ||
        (200 + floor(((_seed * 16807 % 2147483647 - 1)::FLOAT / 2147483646.0) * 800)::INT)::TEXT || '-' ||
        (1000 + floor(((_seed * 16807 * 16807 % 2147483647 - 1)::FLOAT / 2147483646.0) * 9000)::INT)::TEXT,
      'adj' || (100 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 900)::INT)::TEXT || '@' || lower(replace(v_insurer, ' ', '')) || '.com',
      v_dol, v_date_reported, v_date_denied, v_policy_type,
      '$' || (100 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 1900)::INT)::TEXT || 'K',
      CASE WHEN v_is_property THEN '$' || arr_deductible[1 + (floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT % 3)] ELSE 'N/A' END,
      v_cause, v_prop_addr);

    -- Advance seed past the claim detail randoms
    _seed := (_seed * 16807) % 2147483647;
    _seed := (_seed * 16807) % 2147483647;

    -- =========================================================
    -- LITIGATION DETAILS (only for litigation-status cases)
    -- =========================================================
    IF v_is_litigation THEN
      -- Case number
      _seed := (_seed * 16807) % 2147483647;
      v_case_num := (20 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 7)::INT)::TEXT || '-CI-' ||
                    (10000 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 90000)::INT)::TEXT;

      -- Court
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      -- Get a city for the court
      CASE v_juris
        WHEN 'KY' THEN v_city := arr_cities_ky[1 + floor(v_rand * 3)::INT % 3];
        WHEN 'TN' THEN v_city := arr_cities_tn[1 + floor(v_rand * 3)::INT % 3];
        WHEN 'MT' THEN v_city := arr_cities_mt[1 + floor(v_rand * 3)::INT % 3];
        WHEN 'NC' THEN v_city := arr_cities_nc[1 + floor(v_rand * 3)::INT % 3];
        WHEN 'TX' THEN v_city := arr_cities_tx[1 + floor(v_rand * 3)::INT % 3];
        WHEN 'CA' THEN v_city := arr_cities_ca[1 + floor(v_rand * 3)::INT % 3];
        WHEN 'WA' THEN v_city := arr_cities_wa[1 + floor(v_rand * 3)::INT % 3];
        WHEN 'CO' THEN v_city := arr_cities_co[1 + floor(v_rand * 3)::INT % 3];
        WHEN 'NY' THEN v_city := arr_cities_ny[1 + floor(v_rand * 3)::INT % 3];
        ELSE v_city := 'Unknown';
      END CASE;

      _seed := (_seed * 16807) % 2147483647;
      v_idx := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * array_length(arr_court_types, 1))::INT;
      IF v_idx > array_length(arr_court_types, 1) THEN v_idx := array_length(arr_court_types, 1); END IF;
      v_court := v_city || ' ' || arr_court_types[v_idx] || ' Court';

      -- Judge
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_fn, 1))::INT;
      IF v_idx > array_length(arr_fn, 1) THEN v_idx := array_length(arr_fn, 1); END IF;
      v_judge := 'Hon. ' || arr_fn[v_idx];
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_ln, 1))::INT;
      IF v_idx > array_length(arr_ln, 1) THEN v_idx := array_length(arr_ln, 1); END IF;
      v_judge := v_judge || ' ' || arr_ln[v_idx];

      -- Filed date
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_filed_date := make_date(2024, 1, 1) + floor(v_rand * (make_date(2026, 12, 31) - make_date(2024, 1, 1)))::INT;

      -- Opposing counsel
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_fn, 1))::INT;
      IF v_idx > array_length(arr_fn, 1) THEN v_idx := array_length(arr_fn, 1); END IF;
      v_opp_counsel := arr_fn[v_idx];
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_ln, 1))::INT;
      IF v_idx > array_length(arr_ln, 1) THEN v_idx := array_length(arr_ln, 1); END IF;
      v_opp_counsel := v_opp_counsel || ' ' || arr_ln[v_idx];

      -- Opposing firm
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_ln, 1))::INT;
      IF v_idx > array_length(arr_ln, 1) THEN v_idx := array_length(arr_ln, 1); END IF;
      v_opp_firm := arr_ln[v_idx];
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_ln, 1))::INT;
      IF v_idx > array_length(arr_ln, 1) THEN v_idx := array_length(arr_ln, 1); END IF;
      v_opp_firm := v_opp_firm || ' & ' || arr_ln[v_idx] || ', PLLC';

      -- Opposing phone
      _seed := (_seed * 16807) % 2147483647;
      v_opp_phone := '(' || (200 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 800)::INT)::TEXT || ') ';
      _seed := (_seed * 16807) % 2147483647;
      v_opp_phone := v_opp_phone || (200 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 800)::INT)::TEXT || '-';
      _seed := (_seed * 16807) % 2147483647;
      v_opp_phone := v_opp_phone || (1000 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 9000)::INT)::TEXT;

      -- Opposing email
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_ln, 1))::INT;
      IF v_idx > array_length(arr_ln, 1) THEN v_idx := array_length(arr_ln, 1); END IF;
      v_opp_email := 'atty' || (100 + floor(v_rand * 900)::INT)::TEXT || '@' || lower(arr_ln[v_idx]) || 'law.com';

      -- Trial date (50% chance)
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      IF v_rand > 0.5 THEN
        _seed := (_seed * 16807) % 2147483647;
        v_trial_date := make_date(2026, 1, 1) + floor(((_seed - 1)::FLOAT / 2147483646.0) * 730)::INT;
      ELSE
        v_trial_date := NULL;
      END IF;

      -- Mediation date (60% chance)
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      IF v_rand > 0.4 THEN
        _seed := (_seed * 16807) % 2147483647;
        v_med_date := make_date(2026, 1, 1) + floor(((_seed - 1)::FLOAT / 2147483646.0) * 730)::INT;
      ELSE
        v_med_date := NULL;
      END IF;

      -- Discovery deadline
      _seed := (_seed * 16807) % 2147483647;
      v_disc_deadline := make_date(2026, 1, 1) + floor(((_seed - 1)::FLOAT / 2147483646.0) * 730)::INT;

      INSERT INTO litigation_details (case_id, case_number, court, judge, filed_date,
        opposing_counsel, opposing_firm, opposing_phone, opposing_email,
        trial_date, mediation_date, discovery_deadline)
      VALUES (v_case_id, v_case_num, v_court, v_judge, v_filed_date,
        v_opp_counsel, v_opp_firm, v_opp_phone, v_opp_email,
        v_trial_date, v_med_date, v_disc_deadline);
    END IF;

    -- =========================================================
    -- NEGOTIATIONS (0-8 per case)
    -- =========================================================
    _seed := (_seed * 16807) % 2147483647;
    v_neg_count := floor(((_seed - 1)::FLOAT / 2147483646.0) * 9)::INT; -- 0-8
    v_neg_date := v_dop;

    FOR n IN 1..v_neg_count LOOP
      -- Advance date 7-60 days
      _seed := (_seed * 16807) % 2147483647;
      v_neg_date := v_neg_date + (7 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 54)::INT);

      -- Type
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_ntypes, 1))::INT;
      IF v_idx > array_length(arr_ntypes, 1) THEN v_idx := array_length(arr_ntypes, 1); END IF;
      v_neg_type := arr_ntypes[v_idx];

      -- Amount
      IF v_neg_type = 'denial' THEN
        v_neg_amount := 0;
      ELSE
        _seed := (_seed * 16807) % 2147483647;
        v_neg_amount := 5000 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 495000);
      END IF;

      -- By (random team member)
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_all_ids, 1))::INT;
      IF v_idx > array_length(arr_all_ids, 1) THEN v_idx := array_length(arr_all_ids, 1); END IF;
      SELECT name INTO v_neg_by FROM team_members WHERE legacy_id = arr_all_ids[v_idx];

      INSERT INTO negotiations (case_id, type, amount, date, notes, by_name)
      VALUES (v_case_id, v_neg_type, v_neg_amount, v_neg_date,
        CASE WHEN v_neg_type = 'denial' THEN 'Full denial' ELSE 'Settlement reached' END,
        v_neg_by);
    END LOOP;

    -- =========================================================
    -- ESTIMATES (property: 1-5, PI: 0-2)
    -- =========================================================
    IF v_is_property THEN
      _seed := (_seed * 16807) % 2147483647;
      v_est_count := 1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 5)::INT;
      IF v_est_count > 5 THEN v_est_count := 5; END IF;
    ELSE
      _seed := (_seed * 16807) % 2147483647;
      v_est_count := floor(((_seed - 1)::FLOAT / 2147483646.0) * 3)::INT; -- 0-2
    END IF;

    FOR e IN 1..v_est_count LOOP
      -- Date
      _seed := (_seed * 16807) % 2147483647;
      v_est_date := make_date(2024, 1, 1) + floor(((_seed - 1)::FLOAT / 2147483646.0) * (make_date(2026, 12, 31) - make_date(2024, 1, 1)))::INT;

      -- Type
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_etypes, 1))::INT;
      IF v_idx > array_length(arr_etypes, 1) THEN v_idx := array_length(arr_etypes, 1); END IF;
      v_est_type := arr_etypes[v_idx];

      -- Amount
      _seed := (_seed * 16807) % 2147483647;
      v_est_amount := 8000 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 342000);

      -- Vendor
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * 4)::INT;
      IF v_idx > 4 THEN v_idx := 4; END IF;
      v_est_vendor := arr_vendor_prefix[v_idx];
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * 4)::INT;
      IF v_idx > 4 THEN v_idx := 4; END IF;
      v_est_vendor := v_est_vendor || ' ' || arr_vendor_suffix[v_idx];

      -- Notes
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_est_notes, 1))::INT;
      IF v_idx > array_length(arr_est_notes, 1) THEN v_idx := array_length(arr_est_notes, 1); END IF;
      v_est_notes := arr_est_notes[v_idx];

      INSERT INTO estimates (case_id, type, vendor, amount, date, notes)
      VALUES (v_case_id, v_est_type, v_est_vendor, v_est_amount, v_est_date, v_est_notes);
    END LOOP;

    -- =========================================================
    -- PLEADINGS (2-8 for litigation cases only)
    -- =========================================================
    IF v_is_litigation THEN
      _seed := (_seed * 16807) % 2147483647;
      v_plea_count := 2 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 7)::INT;
      IF v_plea_count > 8 THEN v_plea_count := 8; END IF;
      v_plea_date := v_dop;

      FOR p IN 1..v_plea_count LOOP
        -- Advance date 5-45 days
        _seed := (_seed * 16807) % 2147483647;
        v_plea_date := v_plea_date + (5 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 41)::INT);

        -- Type
        _seed := (_seed * 16807) % 2147483647;
        v_rand := (_seed - 1)::FLOAT / 2147483646.0;
        v_idx := 1 + floor(v_rand * array_length(arr_ptypes, 1))::INT;
        IF v_idx > array_length(arr_ptypes, 1) THEN v_idx := array_length(arr_ptypes, 1); END IF;
        v_plea_type := arr_ptypes[v_idx];

        -- Filed by
        _seed := (_seed * 16807) % 2147483647;
        v_rand := (_seed - 1)::FLOAT / 2147483646.0;
        v_plea_filed_by := CASE WHEN v_rand > 0.5 THEN 'Plaintiff' ELSE 'Defendant' END;

        -- Status
        _seed := (_seed * 16807) % 2147483647;
        v_rand := (_seed - 1)::FLOAT / 2147483646.0;
        v_idx := 1 + floor(v_rand * array_length(arr_plea_statuses, 1))::INT;
        IF v_idx > array_length(arr_plea_statuses, 1) THEN v_idx := array_length(arr_plea_statuses, 1); END IF;
        v_plea_status := arr_plea_statuses[v_idx];

        -- Notes
        _seed := (_seed * 16807) % 2147483647;
        v_rand := (_seed - 1)::FLOAT / 2147483646.0;
        v_idx := 1 + floor(v_rand * array_length(arr_plea_notes, 1))::INT;
        IF v_idx > array_length(arr_plea_notes, 1) THEN v_idx := array_length(arr_plea_notes, 1); END IF;
        v_plea_notes := arr_plea_notes[v_idx];

        -- Doc URL (70% chance)
        _seed := (_seed * 16807) % 2147483647;
        v_rand := (_seed - 1)::FLOAT / 2147483646.0;
        v_plea_doc := CASE WHEN v_rand > 0.3 THEN '#' ELSE NULL END;

        INSERT INTO pleadings (case_id, type, date, filed_by, status, notes, doc_url)
        VALUES (v_case_id, v_plea_type, v_plea_date, v_plea_filed_by, v_plea_status, v_plea_notes, v_plea_doc);
      END LOOP;
    END IF;

    -- =========================================================
    -- ACTIVITY LOG (5-25 per case)
    -- =========================================================
    _seed := (_seed * 16807) % 2147483647;
    v_act_count := 5 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 21)::INT;
    IF v_act_count > 25 THEN v_act_count := 25; END IF;
    v_act_date := v_dop;

    FOR a IN 1..v_act_count LOOP
      -- Advance date 1-14 days
      _seed := (_seed * 16807) % 2147483647;
      v_act_date := v_act_date + (1 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 14)::INT);

      -- Activity type
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_atypes, 1))::INT;
      IF v_idx > array_length(arr_atypes, 1) THEN v_idx := array_length(arr_atypes, 1); END IF;
      v_act_type := arr_atypes[v_idx];

      -- Actor (random team member)
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_all_ids, 1))::INT;
      IF v_idx > array_length(arr_all_ids, 1) THEN v_idx := array_length(arr_all_ids, 1); END IF;
      SELECT name, initials, color INTO v_act_actor_name, v_act_actor_ini, v_act_actor_clr
        FROM team_members WHERE legacy_id = arr_all_ids[v_idx];

      -- Title based on type
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      CASE v_act_type
        WHEN 'note' THEN
          v_idx := 1 + floor(v_rand * array_length(arr_note_titles, 1))::INT;
          IF v_idx > array_length(arr_note_titles, 1) THEN v_idx := array_length(arr_note_titles, 1); END IF;
          v_act_title := arr_note_titles[v_idx];
        WHEN 'call' THEN
          v_idx := 1 + floor(v_rand * array_length(arr_call_titles, 1))::INT;
          IF v_idx > array_length(arr_call_titles, 1) THEN v_idx := array_length(arr_call_titles, 1); END IF;
          v_act_title := arr_call_titles[v_idx];
        WHEN 'email' THEN
          v_idx := 1 + floor(v_rand * array_length(arr_email_titles, 1))::INT;
          IF v_idx > array_length(arr_email_titles, 1) THEN v_idx := array_length(arr_email_titles, 1); END IF;
          v_act_title := arr_email_titles[v_idx];
        WHEN 'task' THEN
          v_idx := 1 + floor(v_rand * array_length(arr_task_titles, 1))::INT;
          IF v_idx > array_length(arr_task_titles, 1) THEN v_idx := array_length(arr_task_titles, 1); END IF;
          v_act_title := arr_task_titles[v_idx];
        WHEN 'document' THEN
          v_idx := 1 + floor(v_rand * array_length(arr_doc_titles, 1))::INT;
          IF v_idx > array_length(arr_doc_titles, 1) THEN v_idx := array_length(arr_doc_titles, 1); END IF;
          v_act_title := arr_doc_titles[v_idx];
        WHEN 'negotiation' THEN
          v_idx := 1 + floor(v_rand * array_length(arr_neg_titles, 1))::INT;
          IF v_idx > array_length(arr_neg_titles, 1) THEN v_idx := array_length(arr_neg_titles, 1); END IF;
          v_act_title := arr_neg_titles[v_idx];
        WHEN 'pleading' THEN
          v_idx := 1 + floor(v_rand * array_length(arr_plea_titles, 1))::INT;
          IF v_idx > array_length(arr_plea_titles, 1) THEN v_idx := array_length(arr_plea_titles, 1); END IF;
          v_act_title := arr_plea_titles[v_idx];
        WHEN 'estimate' THEN
          v_idx := 1 + floor(v_rand * array_length(arr_est_titles, 1))::INT;
          IF v_idx > array_length(arr_est_titles, 1) THEN v_idx := array_length(arr_est_titles, 1); END IF;
          v_act_title := arr_est_titles[v_idx];
        WHEN 'status_change' THEN
          v_idx := 1 + floor(v_rand * array_length(arr_cstats, 1))::INT;
          IF v_idx > array_length(arr_cstats, 1) THEN v_idx := array_length(arr_cstats, 1); END IF;
          v_act_title := 'Status → ' || arr_cstats[v_idx];
        WHEN 'deadline' THEN
          _seed := (_seed * 16807) % 2147483647;
          v_rand := (_seed - 1)::FLOAT / 2147483646.0;
          v_act_title := CASE WHEN v_rand > 0.5 THEN 'SOL approaching' ELSE 'Hearing date set' END;
        ELSE
          v_act_title := 'Activity logged';
      END CASE;

      -- Time
      _seed := (_seed * 16807) % 2147483647;
      v_act_time := (8 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 11)::INT)::TEXT || ':' ||
                    lpad(floor(((_seed - 1)::FLOAT / 2147483646.0) * 60)::INT::TEXT, 2, '0');

      -- Description
      _seed := (_seed * 16807) % 2147483647;
      v_rand := (_seed - 1)::FLOAT / 2147483646.0;
      v_idx := 1 + floor(v_rand * array_length(arr_act_descs, 1))::INT;
      IF v_idx > array_length(arr_act_descs, 1) THEN v_idx := array_length(arr_act_descs, 1); END IF;
      v_act_desc := arr_act_descs[v_idx];

      INSERT INTO activity_log (case_id, type, actor_name, actor_initials, actor_color,
        title, description, date, time)
      VALUES (v_case_id, v_act_type, v_act_actor_name, v_act_actor_ini, v_act_actor_clr,
        v_act_title, NULLIF(v_act_desc, ''), v_act_date, v_act_time);
    END LOOP;

    -- =========================================================
    -- DISCOVERY SETS & ITEMS (litigation cases only, 1-3 sets)
    -- =========================================================
    IF v_is_litigation THEN
      FOR d IN 1..3 LOOP
        _seed := (_seed * 16807) % 2147483647;
        v_rand := (_seed - 1)::FLOAT / 2147483646.0;

        -- ~70% chance per set type
        IF v_rand < 0.7 THEN
          v_disc_type := arr_disc_types[d];

          -- Served date
          _seed := (_seed * 16807) % 2147483647;
          v_disc_served := v_filed_date + (30 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 180)::INT);

          -- Due date (30 days after served)
          v_disc_due := v_disc_served + 30;

          -- From
          _seed := (_seed * 16807) % 2147483647;
          v_rand := (_seed - 1)::FLOAT / 2147483646.0;
          v_disc_from := CASE WHEN v_rand > 0.5 THEN v_opp_firm ELSE 'Denham Law' END;

          -- Status
          _seed := (_seed * 16807) % 2147483647;
          v_rand := (_seed - 1)::FLOAT / 2147483646.0;
          v_idx := 1 + floor(v_rand * array_length(arr_disc_statuses, 1))::INT;
          IF v_idx > array_length(arr_disc_statuses, 1) THEN v_idx := array_length(arr_disc_statuses, 1); END IF;
          v_disc_status := arr_disc_statuses[v_idx];

          INSERT INTO discovery_sets (case_id, type, set_number, served_date, due_date, from_name, status)
          VALUES (v_case_id, v_disc_type, 1, v_disc_served, v_disc_due, v_disc_from, v_disc_status)
          RETURNING id INTO v_disc_set_id;

          -- Items (5-10 per set)
          _seed := (_seed * 16807) % 2147483647;
          v_item_count := 5 + floor(((_seed - 1)::FLOAT / 2147483646.0) * 6)::INT;
          IF v_item_count > 10 THEN v_item_count := 10; END IF;

          FOR n IN 1..v_item_count LOOP
            -- Item text based on discovery type
            CASE v_disc_type
              WHEN 'Interrogatories' THEN
                v_idx := 1 + ((n - 1) % array_length(arr_disc_item_texts_interrog, 1));
                v_item_text := arr_disc_item_texts_interrog[v_idx];
              WHEN 'Requests for Production' THEN
                v_idx := 1 + ((n - 1) % array_length(arr_disc_item_texts_rfp, 1));
                v_item_text := arr_disc_item_texts_rfp[v_idx];
              WHEN 'Requests for Admission' THEN
                v_idx := 1 + ((n - 1) % array_length(arr_disc_item_texts_rfa, 1));
                v_item_text := arr_disc_item_texts_rfa[v_idx];
              ELSE
                v_item_text := 'Discovery item ' || n;
            END CASE;

            -- Item status
            _seed := (_seed * 16807) % 2147483647;
            v_rand := (_seed - 1)::FLOAT / 2147483646.0;
            v_idx := 1 + floor(v_rand * array_length(arr_item_statuses, 1))::INT;
            IF v_idx > array_length(arr_item_statuses, 1) THEN v_idx := array_length(arr_item_statuses, 1); END IF;
            v_item_status := arr_item_statuses[v_idx];

            INSERT INTO discovery_items (discovery_set_id, item_number, text, status, objections, response, due_date)
            VALUES (v_disc_set_id, n, v_item_text, v_item_status,
              CASE WHEN v_item_status = 'objection_only' THEN
                ARRAY[arr_objections[1 + floor(v_rand * 3)::INT % array_length(arr_objections, 1)],
                      arr_objections[1 + floor(v_rand * 5)::INT % array_length(arr_objections, 1)]]
              ELSE '{}'::TEXT[] END,
              CASE WHEN v_item_status IN ('drafted','reviewed','final') THEN 'Response drafted for item ' || n ELSE '' END,
              v_disc_due);
          END LOOP;
        END IF;
      END LOOP;
    END IF;

  END LOOP;

  RAISE NOTICE 'Seed complete: 200 cases with all related data inserted.';
END $$;
