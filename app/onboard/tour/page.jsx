"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

/* ───────────────── constants ───────────────── */
const BG = "#08080f", CARD = "#111119", BORDER = "#1e1e2e", GOLD = "#ebb003",
  TEXT = "#e8e8f0", MUTED = "#a0a0b0", DARK_GOLD = "#8a6a02";

const STEPS = [
  { id: "m365",     label: "Microsoft 365" },
  { id: "overview", label: "CMS Overview" },
  { id: "features", label: "Key Features" },
  { id: "role",     label: "Your Role" },
  { id: "ready",    label: "Ready to Go" },
];

const OVERVIEW_SLIDES = [
  {
    title: "Dashboard",
    icon: "📊",
    desc: "This is your firm dashboard — see case stats, financial summary, and alerts at a glance.",
    mockup: { sections: ["Active Cases: 47", "Settled This Month: 12", "Total Demand Value: $3.2M", "⚠ 3 SOL Warnings"] },
  },
  {
    title: "Cases",
    icon: "📋",
    desc: "Browse and manage all active cases. Click any case to see full details.",
    mockup: { sections: ["Smith v. Acme Corp — Pre-Lit", "Johnson v. State Farm — Litigation", "Williams v. Metro — Settlement"] },
  },
  {
    title: "Case Detail",
    icon: "📁",
    desc: "Each case has documents, emails, negotiations, timeline, and more — all in one place.",
    mockup: { sections: ["📄 Documents (23)", "📧 Emails (18)", "💰 Negotiations", "📅 Timeline", "📝 Notes"] },
  },
  {
    title: "Calendar",
    icon: "📅",
    desc: "Your synced calendar events and court deadlines. Never miss a hearing.",
    mockup: { sections: ["Feb 20 — Deposition: Smith v. Acme", "Feb 24 — Mediation: Johnson", "Mar 1 — SOL Deadline: Williams"] },
  },
  {
    title: "Universal Search",
    icon: "🔍",
    desc: "Use ⌘K (or Ctrl+K) to search across cases, documents, and emails instantly.",
    mockup: { sections: ["⌘K  Search cases, docs, emails…", "Recent: Smith v. Acme", "Recent: Medical records upload"] },
  },
];

const FEATURES = [
  { icon: "🔄", title: "Change Case Status", desc: "Drag cards between columns or use the dropdown to update a case's status — Pre-Lit, Litigation, Settlement, or Closed." },
  { icon: "📝", title: "Add Notes", desc: "Click into any case and add notes from the Notes tab. Your team can see updates in real-time." },
  { icon: "📤", title: "Upload Documents", desc: "Drag files into the Documents tab or click Upload. Files are automatically linked to the case." },
  { icon: "⏱️", title: "Activity Timeline", desc: "Every action is logged — emails filed, documents uploaded, status changes. Full audit trail." },
  { icon: "🔔", title: "SOL Warnings", desc: "The notification center alerts you when a statute of limitations is approaching. Never miss a deadline." },
];

const ROLE_INFO = {
  Admin: {
    emoji: "👑",
    abilities: ["Full system access", "Manage team members & roles", "Configure firm settings", "View all cases and financials", "Manage integrations (M365, Filevine)"],
  },
  Attorney: {
    emoji: "⚖️",
    abilities: ["View & manage assigned cases", "Access all case documents & emails", "Add notes, negotiations, and settlement info", "View calendar & deadlines", "Generate demand letters"],
  },
  Paralegal: {
    emoji: "📑",
    abilities: ["View assigned cases", "Upload & organize documents", "File emails to cases", "Manage calendar events", "Update case timelines & notes"],
  },
};

/* ───────────────── helpers ───────────────── */
const btn = (bg, color, extra = {}) => ({
  padding: "14px 28px", background: bg, color, border: "none",
  borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer",
  transition: "all 0.2s", ...extra,
});

const card = (extra = {}) => ({
  background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, ...extra,
});

/* ───────────────── component ───────────────── */
function TourContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const memberId = searchParams.get("memberId");
  const startStep = parseInt(searchParams.get("step") || "1", 10) - 1;

  const [step, setStep] = useState(Math.max(0, Math.min(startStep, STEPS.length - 1)));
  const [overviewSlide, setOverviewSlide] = useState(0);
  const [m365Connected, setM365Connected] = useState(false);
  const [role, setRole] = useState("Paralegal");
  const [memberName, setMemberName] = useState("");
  const [animating, setAnimating] = useState(false);
  const [slideDir, setSlideDir] = useState("right");

  // Load persisted state
  useEffect(() => {
    if (!memberId) return;
    const saved = localStorage.getItem(`onboard-tour-${memberId}`);
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (startStep === 0 && s.step != null) setStep(s.step);
        if (s.m365Connected) setM365Connected(true);
      } catch {}
    }
    // Fetch member info
    fetch(`/api/team/members`)
      .then(r => r.json())
      .then(data => {
        const m = (data.members || data || []).find(x => x.id === memberId);
        if (m) {
          setRole(m.role || "Paralegal");
          setMemberName(m.name || "");
          if (m.m365_user_id) setM365Connected(true);
        }
      })
      .catch(() => {});
  }, [memberId, startStep]);

  // If arriving at step=3 from M365 redirect, mark connected
  useEffect(() => {
    if (startStep === 2) setM365Connected(true);
  }, [startStep]);

  // Persist progress
  useEffect(() => {
    if (!memberId) return;
    localStorage.setItem(`onboard-tour-${memberId}`, JSON.stringify({ step, m365Connected }));
  }, [step, m365Connected, memberId]);

  const goStep = useCallback((dir) => {
    setSlideDir(dir > 0 ? "right" : "left");
    setAnimating(true);
    setTimeout(() => {
      setStep(s => Math.max(0, Math.min(s + dir, STEPS.length - 1)));
      setOverviewSlide(0);
      setAnimating(false);
    }, 250);
  }, []);

  const completeOnboarding = async () => {
    if (memberId) {
      try {
        await fetch("/api/team/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId, onboarding_completed_at: new Date().toISOString() }),
        });
      } catch {}
      localStorage.removeItem(`onboard-tour-${memberId}`);
    }
    router.push("/");
  };

  if (!memberId) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...card(), maxWidth: 440, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: TEXT, margin: "0 0 12px" }}>Missing member ID</h2>
        <p style={{ color: MUTED }}>This link appears to be invalid.</p>
      </div>
    </div>
  );

  const currentStep = STEPS[step];
  const roleInfo = ROLE_INFO[role] || ROLE_INFO.Paralegal;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT }}>
      {/* Progress bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: BG, borderBottom: `1px solid ${BORDER}`, padding: "16px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                  background: i < step ? GOLD : i === step ? "rgba(235,176,3,0.2)" : "transparent",
                  color: i < step ? BG : i === step ? GOLD : MUTED,
                  border: i === step ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
                  transition: "all 0.3s",
                }}>
                  {i < step ? "✓" : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < step ? GOLD : BORDER, transition: "background 0.3s", borderRadius: 1 }} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {STEPS.map((s, i) => (
              <span key={s.id} style={{ fontSize: 11, color: i === step ? GOLD : MUTED, fontWeight: i === step ? 600 : 400, transition: "color 0.3s", textAlign: "center", flex: 1 }}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div style={{
        maxWidth: 720, margin: "0 auto", padding: "40px 20px 100px",
        opacity: animating ? 0 : 1,
        transform: animating ? `translateX(${slideDir === "right" ? "-30px" : "30px"})` : "translateX(0)",
        transition: "opacity 0.25s, transform 0.25s",
      }}>
        {/* ── Step 1: M365 ── */}
        {currentStep.id === "m365" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none"><path d="M11.5 3v8.5H3V3h8.5zm1 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z" fill={GOLD}/></svg>
            </div>
            <h1 style={{ color: TEXT, margin: "0 0 12px", fontSize: 28 }}>Connect Microsoft 365</h1>
            <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.6, maxWidth: 500, margin: "0 auto 32px" }}>
              Connecting your Microsoft 365 account lets the CMS sync your <strong style={{ color: GOLD }}>emails</strong> and <strong style={{ color: GOLD }}>calendar</strong> — so every client email is auto-filed and court deadlines appear right in the app.
            </p>

            {m365Connected ? (
              <div style={{ ...card(), maxWidth: 400, margin: "0 auto 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <h3 style={{ color: GOLD, margin: "0 0 8px" }}>Microsoft 365 Connected</h3>
                <p style={{ color: MUTED, margin: 0, fontSize: 14 }}>Your email and calendar are syncing.</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", maxWidth: 380, margin: "0 auto" }}>
                  <div style={{ ...card(), width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", textAlign: "left" }}>
                    <span style={{ fontSize: 24 }}>📧</span>
                    <div><div style={{ color: TEXT, fontWeight: 600, fontSize: 14 }}>Email Sync</div><div style={{ color: MUTED, fontSize: 13 }}>Auto-file emails to cases</div></div>
                  </div>
                  <div style={{ ...card(), width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", textAlign: "left" }}>
                    <span style={{ fontSize: 24 }}>📅</span>
                    <div><div style={{ color: TEXT, fontWeight: 600, fontSize: 14 }}>Calendar Sync</div><div style={{ color: MUTED, fontSize: 13 }}>Court dates & deadlines in one place</div></div>
                  </div>
                </div>
                <div style={{ marginTop: 32 }}>
                  <a
                    href={`/api/auth/m365/authorize?memberId=${memberId}&redirect=/onboard/tour?memberId=${memberId}&step=3`}
                    style={{ ...btn(GOLD, BG), display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "16px 32px", fontSize: 17 }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M11.5 3v8.5H3V3h8.5zm1 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z" fill="currentColor"/></svg>
                    Connect Microsoft 365
                  </a>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: CMS Overview ── */}
        {currentStep.id === "overview" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{ color: TEXT, margin: "0 0 8px", fontSize: 28 }}>Your CMS at a Glance</h1>
              <p style={{ color: MUTED, fontSize: 15 }}>Let&apos;s walk through the main areas you&apos;ll use every day.</p>
            </div>

            {/* Slide */}
            {(() => {
              const slide = OVERVIEW_SLIDES[overviewSlide];
              return (
                <div style={{ ...card(), marginBottom: 24, minHeight: 320 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 32 }}>{slide.icon}</span>
                    <h2 style={{ color: GOLD, margin: 0, fontSize: 22 }}>{slide.title}</h2>
                  </div>
                  <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>{slide.desc}</p>
                  {/* Mockup */}
                  <div style={{ background: BG, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
                    <div style={{ background: "rgba(235,176,3,0.06)", padding: "8px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 6, alignItems: "center" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e06c75" }} />
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e5c07b" }} />
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#98c379" }} />
                      <span style={{ color: MUTED, fontSize: 12, marginLeft: 8 }}>{slide.title}</span>
                    </div>
                    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                      {slide.mockup.sections.map((s, i) => (
                        <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", color: TEXT, fontSize: 14 }}>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Slide nav */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
              <button onClick={() => setOverviewSlide(s => Math.max(0, s - 1))} disabled={overviewSlide === 0}
                style={{ ...btn("transparent", overviewSlide === 0 ? BORDER : GOLD, { border: `1px solid ${overviewSlide === 0 ? BORDER : GOLD}`, padding: "8px 16px", fontSize: 14, opacity: overviewSlide === 0 ? 0.4 : 1 }) }}>
                ← Prev
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                {OVERVIEW_SLIDES.map((_, i) => (
                  <div key={i} onClick={() => setOverviewSlide(i)} style={{
                    width: 10, height: 10, borderRadius: "50%", cursor: "pointer",
                    background: i === overviewSlide ? GOLD : BORDER, transition: "background 0.2s",
                  }} />
                ))}
              </div>
              <button onClick={() => setOverviewSlide(s => Math.min(OVERVIEW_SLIDES.length - 1, s + 1))} disabled={overviewSlide === OVERVIEW_SLIDES.length - 1}
                style={{ ...btn("transparent", overviewSlide === OVERVIEW_SLIDES.length - 1 ? BORDER : GOLD, { border: `1px solid ${overviewSlide === OVERVIEW_SLIDES.length - 1 ? BORDER : GOLD}`, padding: "8px 16px", fontSize: 14, opacity: overviewSlide === OVERVIEW_SLIDES.length - 1 ? 0.4 : 1 }) }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Key Features ── */}
        {currentStep.id === "features" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{ color: TEXT, margin: "0 0 8px", fontSize: 28 }}>Key Features</h1>
              <p style={{ color: MUTED, fontSize: 15 }}>Here&apos;s what you can do inside the CMS.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {FEATURES.map((f, i) => (
                <div key={i} style={{ ...card(), display: "flex", gap: 16, alignItems: "flex-start", padding: "20px 24px" }}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{f.icon}</span>
                  <div>
                    <h3 style={{ color: GOLD, margin: "0 0 6px", fontSize: 16, fontWeight: 600 }}>{f.title}</h3>
                    <p style={{ color: MUTED, margin: 0, fontSize: 14, lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 4: Role ── */}
        {currentStep.id === "role" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>{roleInfo.emoji}</div>
            <h1 style={{ color: TEXT, margin: "0 0 8px", fontSize: 28 }}>Your Role: <span style={{ color: GOLD }}>{role}</span></h1>
            <p style={{ color: MUTED, fontSize: 15, marginBottom: 32 }}>Here&apos;s what you can do as {role === "Admin" ? "an" : "a"} {role}.</p>
            <div style={{ ...card(), maxWidth: 440, margin: "0 auto", textAlign: "left" }}>
              <h3 style={{ color: GOLD, margin: "0 0 16px", fontSize: 16 }}>Your Abilities</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                {roleInfo.abilities.map((a, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, color: TEXT, fontSize: 15 }}>
                    <span style={{ color: GOLD, fontSize: 14 }}>✦</span> {a}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ ...card(), maxWidth: 440, margin: "20px auto 0", textAlign: "left", background: "rgba(235,176,3,0.05)", border: `1px solid rgba(235,176,3,0.15)` }}>
              <p style={{ color: MUTED, margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                <strong style={{ color: GOLD }}>Need help?</strong> Reach out to your firm administrator or email <span style={{ color: TEXT }}>bart@denhamlaw.com</span>.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 5: Ready ── */}
        {currentStep.id === "ready" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 72, marginBottom: 16 }}>🚀</div>
            <h1 style={{ color: TEXT, margin: "0 0 8px", fontSize: 32 }}>You&apos;re All Set{memberName ? `, ${memberName.split(" ")[0]}` : ""}!</h1>
            <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 32px" }}>
              Your account is ready. Here&apos;s a summary of what&apos;s set up:
            </p>
            <div style={{ ...card(), maxWidth: 400, margin: "0 auto 24px", textAlign: "left" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: MUTED, fontSize: 14 }}>Microsoft 365</span>
                  <span style={{ color: m365Connected ? "#98c379" : "#e5c07b", fontSize: 14, fontWeight: 600 }}>
                    {m365Connected ? "✓ Connected" : "⏭ Skipped"}
                  </span>
                </div>
                <div style={{ height: 1, background: BORDER }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: MUTED, fontSize: 14 }}>Role</span>
                  <span style={{ color: GOLD, fontSize: 14, fontWeight: 600 }}>{role}</span>
                </div>
                <div style={{ height: 1, background: BORDER }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: MUTED, fontSize: 14 }}>CMS Tour</span>
                  <span style={{ color: "#98c379", fontSize: 14, fontWeight: 600 }}>✓ Complete</span>
                </div>
              </div>
            </div>

            {/* Quick reference */}
            <div style={{ ...card(), maxWidth: 400, margin: "0 auto 32px", textAlign: "left", background: "rgba(235,176,3,0.04)", border: `1px solid rgba(235,176,3,0.12)` }}>
              <h4 style={{ color: GOLD, margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>⚡ Quick Reference</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: MUTED }}>
                <div><strong style={{ color: TEXT }}>⌘K / Ctrl+K</strong> — Universal search</div>
                <div><strong style={{ color: TEXT }}>Dashboard</strong> — Case stats & alerts</div>
                <div><strong style={{ color: TEXT }}>🔔 Notifications</strong> — SOL warnings & updates</div>
                <div><strong style={{ color: TEXT }}>Settings</strong> — Profile & M365 connection</div>
              </div>
            </div>

            <button onClick={completeOnboarding} style={{ ...btn(GOLD, BG), padding: "16px 48px", fontSize: 18 }}>
              Go to Dashboard →
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      {currentStep.id !== "ready" && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: BG, borderTop: `1px solid ${BORDER}`, padding: "16px 24px",
          display: "flex", justifyContent: "center", gap: 12,
        }}>
          <div style={{ maxWidth: 720, width: "100%", display: "flex", justifyContent: "space-between" }}>
            {step > 0 ? (
              <button onClick={() => goStep(-1)} style={{ ...btn("transparent", MUTED, { border: `1px solid ${BORDER}`, padding: "12px 24px" }) }}>
                ← Back
              </button>
            ) : <div />}
            <div style={{ display: "flex", gap: 10 }}>
              {currentStep.id === "m365" && !m365Connected && (
                <button onClick={() => goStep(1)} style={{ ...btn("transparent", MUTED, { border: `1px solid ${BORDER}`, padding: "12px 24px" }) }}>
                  Skip for now
                </button>
              )}
              <button onClick={() => goStep(1)} style={{ ...btn(GOLD, BG, { padding: "12px 28px" }) }}>
                {currentStep.id === "m365" && m365Connected ? "Continue →" : currentStep.id === "m365" ? "Continue →" : "Next Step →"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        button:hover { filter: brightness(1.1); }
        a:hover { filter: brightness(1.1); }
      `}</style>
    </div>
  );
}

export default function TourPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#08080f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#e8e8f0", fontSize: 18 }}>Loading tour...</div>
      </div>
    }>
      <TourContent />
    </Suspense>
  );
}
