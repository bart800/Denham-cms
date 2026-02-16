import { supabase } from "./supabase";

// ============================================================
// AUTH
// ============================================================
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// ============================================================
// TEAM MEMBERS
// ============================================================
export async function listTeamMembers() {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .order("legacy_id");
  if (error) throw error;
  return data;
}

// ============================================================
// CASES
// ============================================================
export async function listCases({ status, jurisdiction, search, attorney_id, support_id } = {}) {
  let q = supabase
    .from("cases")
    .select(`
      *,
      attorney:team_members!cases_attorney_id_fkey(*),
      support:team_members!cases_support_id_fkey(*),
      claim_details(*),
      litigation_details(*)
    `)
    .order("date_opened", { ascending: false });

  if (status && status !== "All") q = q.eq("status", status);
  if (jurisdiction && jurisdiction !== "All") q = q.eq("jurisdiction", jurisdiction);
  if (attorney_id) q = q.eq("attorney_id", attorney_id);
  if (support_id) q = q.eq("support_id", support_id);
  if (search) {
    q = q.or(`client_name.ilike.%${search}%,ref.ilike.%${search}%,insurer.ilike.%${search}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getCase(id) {
  const { data, error } = await supabase
    .from("cases")
    .select(`
      *,
      attorney:team_members!cases_attorney_id_fkey(*),
      support:team_members!cases_support_id_fkey(*),
      claim_details(*),
      litigation_details(*),
      negotiations(*),
      estimates(*),
      pleadings(*),
      activity_log(*)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCase(caseData) {
  const { data, error } = await supabase
    .from("cases")
    .insert(caseData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCase(id, updates) {
  const { data, error } = await supabase
    .from("cases")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// CLAIM DETAILS
// ============================================================
export async function getClaimDetails(caseId) {
  const { data, error } = await supabase
    .from("claim_details")
    .select("*")
    .eq("case_id", caseId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function upsertClaimDetails(caseId, details) {
  const { data, error } = await supabase
    .from("claim_details")
    .upsert({ case_id: caseId, ...details }, { onConflict: "case_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// LITIGATION DETAILS
// ============================================================
export async function getLitigationDetails(caseId) {
  const { data, error } = await supabase
    .from("litigation_details")
    .select("*")
    .eq("case_id", caseId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function upsertLitigationDetails(caseId, details) {
  const { data, error } = await supabase
    .from("litigation_details")
    .upsert({ case_id: caseId, ...details }, { onConflict: "case_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// NEGOTIATIONS
// ============================================================
export async function listNegotiations(caseId) {
  const { data, error } = await supabase
    .from("negotiations")
    .select("*")
    .eq("case_id", caseId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createNegotiation(neg) {
  const { data, error } = await supabase
    .from("negotiations")
    .insert(neg)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// ESTIMATES
// ============================================================
export async function listEstimates(caseId) {
  const { data, error } = await supabase
    .from("estimates")
    .select("*")
    .eq("case_id", caseId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createEstimate(est) {
  const { data, error } = await supabase
    .from("estimates")
    .insert(est)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// PLEADINGS
// ============================================================
export async function listPleadings(caseId) {
  const { data, error } = await supabase
    .from("pleadings")
    .select("*")
    .eq("case_id", caseId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPleading(pleading) {
  const { data, error } = await supabase
    .from("pleadings")
    .insert(pleading)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// ACTIVITY LOG
// ============================================================
export async function listActivity(caseId, { type } = {}) {
  let q = supabase
    .from("activity_log")
    .select("*")
    .eq("case_id", caseId)
    .order("date", { ascending: false });

  if (type && type !== "all") q = q.eq("type", type);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createActivity(activity) {
  const { data, error } = await supabase
    .from("activity_log")
    .insert(activity)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// DISCOVERY SETS & ITEMS
// ============================================================
export async function listDiscoverySets(caseId) {
  const { data, error } = await supabase
    .from("discovery_sets")
    .select(`*, discovery_items(*)`)
    .eq("case_id", caseId)
    .order("set_number");
  if (error) throw error;
  // Sort items by item_number within each set
  return (data || []).map(set => ({
    ...set,
    items: (set.discovery_items || []).sort((a, b) => a.item_number - b.item_number),
  }));
}

export async function createDiscoverySet(set) {
  const { data, error } = await supabase
    .from("discovery_sets")
    .insert(set)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createDiscoveryItem(item) {
  const { data, error } = await supabase
    .from("discovery_items")
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDiscoveryItem(id, updates) {
  const { data, error } = await supabase
    .from("discovery_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// TASKS
// ============================================================
export async function listTasks({ case_id, assigned_to, status } = {}) {
  let q = supabase
    .from("tasks")
    .select(`*, assigned:team_members!tasks_assigned_to_fkey(*), creator:team_members!tasks_created_by_fkey(*)`)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (case_id) q = q.eq("case_id", case_id);
  if (assigned_to) q = q.eq("assigned_to", assigned_to);
  if (status && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createTask(task) {
  const { data, error } = await supabase
    .from("tasks")
    .insert(task)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// DOCUMENTS
// ============================================================
export async function listDocuments({ case_id, type } = {}) {
  let q = supabase
    .from("documents")
    .select(`*, uploader:team_members!documents_uploaded_by_fkey(*)`)
    .order("created_at", { ascending: false });

  if (case_id) q = q.eq("case_id", case_id);
  if (type && type !== "all") q = q.eq("type", type);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createDocument(doc) {
  const { data, error } = await supabase
    .from("documents")
    .insert(doc)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDocument(id, updates) {
  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
