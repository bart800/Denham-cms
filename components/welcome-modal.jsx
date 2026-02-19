"use client";
import { useState, useEffect } from "react";

const TIPS = [
  { icon: "📋", title: "Case Management", desc: "Track all your cases from intake to settlement. Use the dashboard for a bird's-eye view of your caseload." },
  { icon: "📅", title: "Calendar & Deadlines", desc: "Never miss a statute of limitations. The SOL Tracker automatically monitors critical dates and sends alerts." },
  { icon: "📧", title: "Email Integration", desc: "Connect Microsoft 365 to auto-file emails to cases. All correspondence is tracked in one place." },
  { icon: "🔍", title: "Smart Search", desc: "Use the universal search (Ctrl+K) to find cases, contacts, documents, and more across the entire CMS." },
];

export default function WelcomeModal({ memberName, onClose }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("welcome-dismissed");
    if (!dismissed) setVisible(true);
  }, []);

  const handleClose = () => {
    localStorage.setItem("welcome-dismissed", "true");
    setVisible(false);
    onClose?.();
  };

  if (!visible) return null;

  const tip = TIPS[step - 1];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "#111119", border: "1px solid #1e1e2e", borderRadius: 20,
        padding: "40px 36px", maxWidth: 480, width: "100%",
        animation: "fadeIn 0.3s ease",
      }}>
        {step === 0 ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>👋</div>
              <h2 style={{ color: "#e8e8f0", margin: "0 0 8px", fontSize: 24 }}>
                Welcome{memberName ? `, ${memberName.split(" ")[0]}` : ""}!
              </h2>
              <p style={{ color: "#a0a0b0", margin: 0, fontSize: 15, lineHeight: 1.5 }}>
                You&apos;re all set up in the Denham Law CMS. Here are a few tips to get you started.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              style={{
                width: "100%", padding: 14, background: "#ebb003", color: "#08080f",
                border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer",
              }}
            >
              Show Me Around →
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{tip.icon}</div>
              <h3 style={{ color: "#ebb003", margin: "0 0 8px", fontSize: 20 }}>{tip.title}</h3>
              <p style={{ color: "#a0a0b0", margin: 0, fontSize: 15, lineHeight: 1.6 }}>{tip.desc}</p>
            </div>

            {/* Progress dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
              {TIPS.map((_, i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: i + 1 === step ? "#ebb003" : "#1e1e2e",
                  transition: "background 0.2s",
                }} />
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleClose}
                style={{
                  flex: 1, padding: 12, background: "transparent",
                  border: "1px solid #1e1e2e", borderRadius: 10, color: "#a0a0b0",
                  fontSize: 14, cursor: "pointer",
                }}
              >
                Skip
              </button>
              <button
                onClick={() => step < TIPS.length ? setStep(step + 1) : handleClose()}

                style={{
                  flex: 1, padding: 12, background: "#ebb003", color: "#08080f",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >
                {step < TIPS.length ? "Next →" : "Get Started"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
