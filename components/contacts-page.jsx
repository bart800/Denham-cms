"use client";
import { useState, useEffect, useCallback } from "react";

const ROLES = [
  "adjuster", "opposing_counsel", "mortgage_company", "contractor",
  "public_adjuster", "expert", "witness", "defendant",
  "registered_agent", "referred_by", "client", "other",
];

const TAG_COLORS = {
  adjuster: "#e74c3c",
  opposing_counsel: "#e67e22",
  mortgage_company: "#3498db",
  contractor: "#2ecc71",
  public_adjuster: "#9b59b6",
  expert: "#1abc9c",
  witness: "#f39c12",
  defendant: "#e74c3c",
  registered_agent: "#34495e",
  referred_by: "#ebb003",
  client: "#386f4a",
  other: "#7f8c8d",
};

const EMPTY_CONTACT = {
  type: "person", first_name: "", last_name: "", company: "", title: "",
  email: "", phone: "", fax: "", address_line1: "", address_line2: "",
  city: "", state: "", zip: "", notes: "", tags: [],
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_CONTACT });
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (tagFilter) params.set("tag", tagFilter);
    if (typeFilter) params.set("type", typeFilter);
    params.set("page", page);
    params.set("limit", "50");
    try {
      const res = await fetch(`/api/contacts?${params}`);
      const json = await res.json();
      setContacts(json.contacts || []);
      setTotal(json.total || 0);
    } catch {}
    setLoading(false);
  }, [search, tagFilter, typeFilter, page]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const fetchExpanded = async (id) => {
    if (expanded === id) { setExpanded(null); setExpandedData(null); return; }
    setExpanded(id);
    try {
      const res = await fetch(`/api/contacts/${id}`);
      setExpandedData(await res.json());
    } catch { setExpandedData(null); }
  };

  const handleSave = async () => {
    const method = editing ? "PATCH" : "POST";
    const url = editing ? `/api/contacts/${editing}` : "/api/contacts";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false); setEditing(null); setForm({ ...EMPTY_CONTACT });
    fetchContacts();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this contact?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    fetchContacts();
  };

  const startEdit = (c) => {
    setForm({ ...c, tags: c.tags || [] });
    setEditing(c.id);
    setShowForm(true);
  };

  const addTag = () => {
    if (tagInput && !form.tags.includes(tagInput)) {
      setForm({ ...form, tags: [...form.tags, tagInput] });
    }
    setTagInput("");
  };

  const displayName = (c) => c.type === "company" ? (c.company || "Unnamed") : [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";

  const s = {
    page: { padding: 24, minHeight: "100vh", background: "#0a0a2e", color: "#e0e0e0", fontFamily: "system-ui, sans-serif" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    title: { fontSize: 28, fontWeight: 700, color: "#ebb003", margin: 0 },
    row: { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" },
    input: { padding: "8px 14px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#e0e0e0", fontSize: 14, flex: 1, minWidth: 200 },
    select: { padding: "8px 12px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#e0e0e0", fontSize: 14 },
    btn: { padding: "8px 18px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 },
    btnGold: { background: "#ebb003", color: "#000" },
    btnGreen: { background: "#386f4a", color: "#fff" },
    btnRed: { background: "#c0392b", color: "#fff", padding: "4px 12px", fontSize: 12 },
    btnSmall: { padding: "4px 12px", fontSize: 12, background: "#333", color: "#e0e0e0" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 },
    card: { background: "#000066", borderRadius: 10, padding: 16, cursor: "pointer", border: "1px solid #1a1a5e", transition: "border-color 0.2s" },
    badge: (color) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: color || "#555", color: "#fff", marginRight: 4, marginBottom: 4 }),
    formOverlay: { background: "#0d0d3a", borderRadius: 12, padding: 24, marginBottom: 24, border: "1px solid #ebb003" },
    formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    label: { fontSize: 12, color: "#999", marginBottom: 2 },
    fieldInput: { width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #333", background: "#111", color: "#e0e0e0", fontSize: 13, boxSizing: "border-box" },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>📇 Contacts</h1>
        <button style={{ ...s.btn, ...s.btnGold }} onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ ...EMPTY_CONTACT }); }}>
          {showForm ? "✕ Cancel" : "+ Add Contact"}
        </button>
      </div>

      {showForm && (
        <div style={s.formOverlay}>
          <h3 style={{ color: "#ebb003", marginTop: 0 }}>{editing ? "Edit Contact" : "New Contact"}</h3>
          <div style={{ marginBottom: 12 }}>
            <select style={s.select} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="person">Person</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div style={s.formGrid}>
            {form.type === "person" && <>
              <div><div style={s.label}>First Name</div><input style={s.fieldInput} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><div style={s.label}>Last Name</div><input style={s.fieldInput} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            </>}
            <div><div style={s.label}>Company</div><input style={s.fieldInput} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div><div style={s.label}>Title</div><input style={s.fieldInput} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><div style={s.label}>Email</div><input style={s.fieldInput} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><div style={s.label}>Phone</div><input style={s.fieldInput} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><div style={s.label}>Fax</div><input style={s.fieldInput} value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
            <div><div style={s.label}>Address Line 1</div><input style={s.fieldInput} value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} /></div>
            <div><div style={s.label}>Address Line 2</div><input style={s.fieldInput} value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} /></div>
            <div><div style={s.label}>City</div><input style={s.fieldInput} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><div style={s.label}>State</div><input style={s.fieldInput} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div><div style={s.label}>ZIP</div><input style={s.fieldInput} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={s.label}>Tags</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {(form.tags || []).map((t) => (
                <span key={t} style={s.badge(TAG_COLORS[t])}>
                  {t} <span style={{ cursor: "pointer", marginLeft: 4 }} onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })}>×</span>
                </span>
              ))}
              <select style={{ ...s.select, fontSize: 12 }} value={tagInput} onChange={(e) => setTagInput(e.target.value)}>
                <option value="">Add tag...</option>
                {ROLES.filter((r) => !(form.tags || []).includes(r)).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {tagInput && <button style={{ ...s.btn, ...s.btnSmall }} onClick={addTag}>+</button>}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={s.label}>Notes</div>
            <textarea style={{ ...s.fieldInput, height: 60, resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div style={{ marginTop: 16 }}>
            <button style={{ ...s.btn, ...s.btnGreen }} onClick={handleSave}>{editing ? "Update" : "Create"}</button>
          </div>
        </div>
      )}

      <div style={s.row}>
        <input style={s.input} placeholder="Search contacts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select style={s.select} value={tagFilter} onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}>
          <option value="">All Tags</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select style={s.select} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="person">Person</option>
          <option value="company">Company</option>
        </select>
      </div>

      {loading && <div style={{ color: "#999", padding: 20 }}>Loading...</div>}

      <div style={s.grid}>
        {contacts.map((c) => (
          <div key={c.id} style={{ ...s.card, borderColor: expanded === c.id ? "#ebb003" : "#1a1a5e" }}>
            <div onClick={() => fetchExpanded(c.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{displayName(c)}</div>
                  {c.type === "person" && c.company && <div style={{ fontSize: 13, color: "#aaa" }}>{c.company}</div>}
                  {c.title && <div style={{ fontSize: 12, color: "#888" }}>{c.title}</div>}
                </div>
                <span style={s.badge(c.type === "company" ? "#3498db" : "#386f4a")}>{c.type}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                {(c.tags || []).map((t) => <span key={t} style={s.badge(TAG_COLORS[t])}>{t.replace("_", " ")}</span>)}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: "#bbb" }}>
                {c.phone && <div>📞 {c.phone}</div>}
                {c.email && <div>✉️ {c.email}</div>}
              </div>
            </div>

            {expanded === c.id && expandedData && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #333" }}>
                {expandedData.fax && <div style={{ fontSize: 13, color: "#bbb" }}>Fax: {expandedData.fax}</div>}
                {(expandedData.address_line1 || expandedData.city) && (
                  <div style={{ fontSize: 13, color: "#bbb", marginTop: 4 }}>
                    {[expandedData.address_line1, expandedData.address_line2].filter(Boolean).join(", ")}
                    {expandedData.city && <>, {expandedData.city}</>} {expandedData.state} {expandedData.zip}
                  </div>
                )}
                {expandedData.notes && <div style={{ fontSize: 13, color: "#999", marginTop: 8, fontStyle: "italic" }}>{expandedData.notes}</div>}

                {expandedData.linked_cases?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#ebb003", marginBottom: 4 }}>Linked Cases:</div>
                    {expandedData.linked_cases.map((lc, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#bbb", padding: "2px 0" }}>
                        <span style={{ color: "#ebb003" }}>{lc.ref}</span> — {lc.client_name} <span style={s.badge(TAG_COLORS[lc.role])}>{lc.role}</span> <span style={{ color: "#777" }}>({lc.status})</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button style={{ ...s.btn, ...s.btnSmall }} onClick={(e) => { e.stopPropagation(); startEdit(expandedData); }}>Edit</button>
                  <button style={{ ...s.btn, ...s.btnRed }} onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {total > 50 && (
        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", alignItems: "center" }}>
          <button style={{ ...s.btn, ...s.btnSmall }} disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span style={{ color: "#999" }}>Page {page} of {Math.ceil(total / 50)}</span>
          <button style={{ ...s.btn, ...s.btnSmall }} disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
