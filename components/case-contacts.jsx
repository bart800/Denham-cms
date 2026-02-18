"use client";
import { useState, useEffect, useCallback } from "react";

const ROLES = [
  "adjuster", "opposing_counsel", "mortgage_company", "contractor",
  "public_adjuster", "expert", "witness", "defendant",
  "registered_agent", "referred_by", "client", "other",
];

const ROLE_COLORS = {
  adjuster: "#e74c3c", opposing_counsel: "#e67e22", mortgage_company: "#3498db",
  contractor: "#2ecc71", public_adjuster: "#9b59b6", expert: "#1abc9c",
  witness: "#f39c12", defendant: "#e74c3c", registered_agent: "#34495e",
  referred_by: "#ebb003", client: "#386f4a", other: "#7f8c8d",
};

const EMPTY = { first_name: "", last_name: "", company: "", email: "", phone: "", type: "person" };

export default function CaseContacts({ caseId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRole, setSelectedRole] = useState("other");
  const [createNew, setCreateNew] = useState(false);
  const [newContact, setNewContact] = useState({ ...EMPTY });
  const [expanded, setExpanded] = useState(null);

  const fetchContacts = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/contacts`);
      const json = await res.json();
      setContacts(json.contacts || []);
    } catch {}
    setLoading(false);
  }, [caseId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const searchContacts = async (q) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}&limit=10`);
      const json = await res.json();
      setSearchResults(json.contacts || []);
    } catch {}
  };

  const linkExisting = async (contactId) => {
    await fetch(`/api/cases/${caseId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contactId, role: selectedRole }),
    });
    setShowLink(false); setSearchQ(""); setSearchResults([]);
    fetchContacts();
  };

  const linkNew = async () => {
    await fetch(`/api/cases/${caseId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact: newContact, role: selectedRole }),
    });
    setShowLink(false); setCreateNew(false); setNewContact({ ...EMPTY });
    fetchContacts();
  };

  const unlink = async (contactId, role) => {
    await fetch(`/api/cases/${caseId}/contacts`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: contactId, role }),
    });
    fetchContacts();
  };

  const displayName = (c) => c.type === "company" ? (c.company || "Unnamed") : [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";

  const s = {
    wrap: { padding: 16, background: "#0a0a2e", borderRadius: 10, color: "#e0e0e0", fontFamily: "system-ui, sans-serif" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    title: { fontSize: 18, fontWeight: 700, color: "#ebb003", margin: 0 },
    btn: { padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 },
    btnGold: { background: "#ebb003", color: "#000" },
    btnRed: { background: "#c0392b", color: "#fff", padding: "3px 10px", fontSize: 11 },
    card: { background: "#000066", borderRadius: 8, padding: 12, marginBottom: 8, border: "1px solid #1a1a5e" },
    badge: (color) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: color || "#555", color: "#fff", marginLeft: 6 }),
    input: { padding: "6px 10px", borderRadius: 4, border: "1px solid #333", background: "#111", color: "#e0e0e0", fontSize: 13, width: "100%", boxSizing: "border-box" },
    select: { padding: "6px 10px", borderRadius: 4, border: "1px solid #333", background: "#111", color: "#e0e0e0", fontSize: 13 },
    overlay: { background: "#0d0d3a", borderRadius: 8, padding: 16, marginBottom: 12, border: "1px solid #ebb003" },
    label: { fontSize: 11, color: "#999", marginBottom: 2 },
    resultItem: { padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #222", fontSize: 13 },
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h3 style={s.title}>📇 Case Contacts</h3>
        <button style={{ ...s.btn, ...s.btnGold }} onClick={() => setShowLink(!showLink)}>
          {showLink ? "✕ Cancel" : "+ Link Contact"}
        </button>
      </div>

      {showLink && (
        <div style={s.overlay}>
          <div style={{ marginBottom: 8 }}>
            <div style={s.label}>Role</div>
            <select style={s.select} value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </div>

          {!createNew ? (
            <>
              <div style={s.label}>Search existing contacts</div>
              <input style={s.input} placeholder="Type to search..." value={searchQ} onChange={(e) => searchContacts(e.target.value)} />
              {searchResults.length > 0 && (
                <div style={{ background: "#111", borderRadius: 4, marginTop: 4, maxHeight: 200, overflowY: "auto" }}>
                  {searchResults.map((c) => (
                    <div key={c.id} style={s.resultItem} onClick={() => linkExisting(c.id)}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#1a1a5e"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      {displayName(c)} {c.company && c.type === "person" ? `(${c.company})` : ""} {c.email ? `— ${c.email}` : ""}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <button style={{ ...s.btn, background: "#333", color: "#e0e0e0", fontSize: 12 }} onClick={() => setCreateNew(true)}>
                  Or create new contact →
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div><div style={s.label}>First Name</div><input style={s.input} value={newContact.first_name} onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })} /></div>
                <div><div style={s.label}>Last Name</div><input style={s.input} value={newContact.last_name} onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })} /></div>
                <div><div style={s.label}>Company</div><input style={s.input} value={newContact.company} onChange={(e) => setNewContact({ ...newContact, company: e.target.value })} /></div>
                <div><div style={s.label}>Email</div><input style={s.input} value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} /></div>
                <div><div style={s.label}>Phone</div><input style={s.input} value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} /></div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...s.btn, background: "#386f4a", color: "#fff" }} onClick={linkNew}>Create & Link</button>
                <button style={{ ...s.btn, background: "#333", color: "#e0e0e0" }} onClick={() => setCreateNew(false)}>← Back to search</button>
              </div>
            </>
          )}
        </div>
      )}

      {loading && <div style={{ color: "#999" }}>Loading...</div>}

      {contacts.length === 0 && !loading && <div style={{ color: "#777", fontSize: 14, padding: 12 }}>No contacts linked to this case.</div>}

      {contacts.map((c) => (
        <div key={`${c.id}-${c.role}`} style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ fontWeight: 600, color: "#fff", cursor: "pointer" }} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                {displayName(c)}
              </span>
              <span style={s.badge(ROLE_COLORS[c.role])}>{c.role.replace(/_/g, " ")}</span>
            </div>
            <button style={{ ...s.btn, ...s.btnRed }} onClick={() => unlink(c.id, c.role)}>Unlink</button>
          </div>
          {c.company && c.type === "person" && <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{c.company}</div>}
          <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>
            {c.phone && <span style={{ marginRight: 12 }}>📞 {c.phone}</span>}
            {c.email && <span>✉️ {c.email}</span>}
          </div>
          {expanded === c.id && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #333", fontSize: 12, color: "#999" }}>
              {c.title && <div>Title: {c.title}</div>}
              {c.fax && <div>Fax: {c.fax}</div>}
              {c.address_line1 && <div>{c.address_line1} {c.address_line2}</div>}
              {c.city && <div>{c.city}, {c.state} {c.zip}</div>}
              {c.notes && <div style={{ marginTop: 4, fontStyle: "italic" }}>{c.notes}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
