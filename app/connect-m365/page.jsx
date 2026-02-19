"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ConnectM365Inner() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const searchParams = useSearchParams();
  const memberId = searchParams.get("memberId");
  const m365Result = searchParams.get("m365");
  const errorParam = searchParams.get("error");

  useEffect(() => {
    if (errorParam) setError(decodeURIComponent(errorParam));
    if (m365Result === "connected") setStatus("connected");
    
    if (memberId && !m365Result) {
      fetch(`/api/auth/m365/status?memberId=${memberId}`)
        .then(r => r.json())
        .then(data => {
          if (data.connected) setStatus("connected");
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [memberId, m365Result, errorParam]);

  const S = {
    page: { minHeight: "100vh", background: "#08080f", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
    card: { background: "#111119", border: "1px solid #1e1e2e", borderRadius: 16, padding: "48px 40px", maxWidth: 480, textAlign: "center", width: "100%" },
    btn: { display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 28px", background: "#ebb003", color: "#08080f", borderRadius: 10, fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", textDecoration: "none" },
    err: { background: "#2a1520", border: "1px solid #e53935", borderRadius: 8, padding: 12, marginBottom: 16, color: "#ff6b6b", fontSize: 13 },
  };

  if (loading) return <div style={S.page}><div style={S.card}><div style={{ color: "#a0a0b0" }}>Loading...</div></div></div>;

  if (!memberId) return (
    <div style={S.page}><div style={S.card}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ color: "#e8e8f0", margin: "0 0 12px" }}>Missing Member ID</h2>
      <p style={{ color: "#a0a0b0" }}>This link is invalid. Please use the link provided during onboarding.</p>
    </div></div>
  );

  if (status === "connected") return (
    <div style={S.page}><div style={S.card}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h2 style={{ color: "#e8e8f0", margin: "0 0 12px" }}>Microsoft 365 Connected!</h2>
      <p style={{ color: "#a0a0b0", marginBottom: 24 }}>Your email and calendar are now syncing to the CMS.</p>
      <a href="/" style={{ ...S.btn }}>Go to CMS →</a>
    </div></div>
  );

  return (
    <div style={S.page}><div style={S.card}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
      <h2 style={{ color: "#e8e8f0", margin: "0 0 12px" }}>Connect Microsoft 365</h2>
      <p style={{ color: "#a0a0b0", marginBottom: 32 }}>Sign in with your Microsoft account to sync your emails and calendar to the CMS.</p>
      {error && <div style={S.err}>{error}</div>}
      <a href={`/api/auth/m365/authorize?memberId=${memberId}&redirect=/connect-m365?memberId=${memberId}`} style={S.btn}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M11.5 3v8.5H3V3h8.5zm1 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z" fill="currentColor"/></svg>
        Connect Microsoft 365
      </a>
      <div style={{ marginTop: 24 }}>
        <a href="/" style={{ color: "#666", fontSize: 14 }}>Skip for now</a>
      </div>
    </div></div>
  );
}

export default function ConnectM365Page() {
  return <Suspense fallback={<div style={{ minHeight: "100vh", background: "#08080f" }} />}><ConnectM365Inner /></Suspense>;
}
