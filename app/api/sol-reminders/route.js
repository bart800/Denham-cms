import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://amyttoowrroajffqubpd.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFteXR0b293cnJvYWpmZnF1YnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTQwOTYsImV4cCI6MjA4NjY3MDA5Nn0.tp97U9MmMG1Lz6-XaYg5WIqbaUrbC7V2LcqlJXgw1jM";

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const today = new Date();
    const d30 = new Date(today.getTime() + 30 * 86400000).toISOString().split("T")[0];
    const d60 = new Date(today.getTime() + 60 * 86400000).toISOString().split("T")[0];
    const d90 = new Date(today.getTime() + 90 * 86400000).toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("cases")
      .select(`
        id, ref, client_name, status, jurisdiction, insurer, statute_of_limitations,
        attorney:team_members!cases_attorney_id_fkey(id, name, initials, color),
        support:team_members!cases_support_id_fkey(id, name, initials, color)
      `)
      .not("status", "in", '("Settled","Closed")')
      .gte("statute_of_limitations", todayStr)
      .lte("statute_of_limitations", d90)
      .order("statute_of_limitations", { ascending: true });

    if (error) return Response.json({ error: error.message }, { status: 500 });

    const critical = [], warning = [], attention = [];
    for (const c of data || []) {
      const days = Math.ceil((new Date(c.statute_of_limitations + "T00:00:00") - today) / 86400000);
      const item = {
        id: c.id, ref: c.ref, client: c.client_name, status: c.status,
        jurisdiction: c.jurisdiction, insurer: c.insurer,
        sol: c.statute_of_limitations, daysRemaining: days,
        attorney: c.attorney?.name || "Unassigned",
        attorneyInitials: c.attorney?.initials || "?",
        attorneyColor: c.attorney?.color || "#888",
      };
      if (days <= 30) critical.push(item);
      else if (days <= 60) warning.push(item);
      else attention.push(item);
    }

    return Response.json({
      critical, warning, attention,
      total: critical.length + warning.length + attention.length,
      generated: today.toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { case_id, reminder_type, channel, sent_to } = await request.json();
    const { data, error } = await supabase
      .from("sol_reminders")
      .insert({ case_id, reminder_type, channel: channel || "system", sent_to })
      .select()
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ reminder: data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
