"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function OnboardForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    confirmPassword: "",
    bar_number: "",
  });
  const [profilePic, setProfilePic] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!token) { setError("No invite token provided"); setLoading(false); return; }
    fetch(`/api/onboard?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setInvite(data.invite);
      })
      .catch(() => setError("Failed to validate invite"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setProfilePic(file);
    const reader = new FileReader();
    reader.onload = (e) => setProfilePreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!profilePic) { setError("Profile picture is required"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    if (invite.role === "Attorney" && !form.bar_number) { setError("Bar number is required for attorneys"); return; }

    setSubmitting(true);
    try {
      // Upload profile picture
      const fd = new FormData();
      fd.append("file", profilePic);
      const uploadRes = await fetch("/api/team/profile-picture", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(uploadData.error);

      // Complete onboarding
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: form.name,
          phone: form.phone,
          password: form.password,
          profile_picture_url: uploadData.url,
          bar_number: form.bar_number || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px", background: "#111119",
    border: "1px solid #1e1e2e", borderRadius: 8, color: "#e8e8f0",
    fontSize: 15, outline: "none", transition: "border-color 0.2s",
  };
  const labelStyle = { display: "block", marginBottom: 6, color: "#a0a0b0", fontSize: 13, fontWeight: 500 };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#08080f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#e8e8f0", fontSize: 18 }}>Validating invite...</div>
    </div>
  );

  if (error && !invite) return (
    <div style={{ minHeight: "100vh", background: "#08080f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111119", border: "1px solid #1e1e2e", borderRadius: 16, padding: "48px 40px", maxWidth: 440, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: "#e8e8f0", margin: "0 0 12px" }}>Invalid Invite</h2>
        <p style={{ color: "#a0a0b0" }}>{error}</p>
      </div>
    </div>
  );

  if (success) return (
    <div style={{ minHeight: "100vh", background: "#08080f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111119", border: "1px solid #1e1e2e", borderRadius: 16, padding: "48px 40px", maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h2 style={{ color: "#e8e8f0", margin: "0 0 12px" }}>Welcome to Denham Law!</h2>
        <p style={{ color: "#a0a0b0", marginBottom: 32 }}>Your account has been created. Connect Microsoft 365 to sync your email and calendar.</p>
        <a
          href="/"
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "14px 28px", background: "#ebb003", color: "#08080f",
            borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: "none",
          }}
        >
          Go to CMS →
        </a>
        <p style={{ color: "#666", fontSize: 12, marginTop: 16 }}>Microsoft 365 email sync will be configured by your administrator.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#08080f", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#111119", border: "1px solid #1e1e2e", borderRadius: 16, padding: "40px 36px", maxWidth: 520, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ color: "#ebb003", margin: "0 0 8px", fontSize: 28, fontWeight: 700 }}>Welcome Aboard</h1>
          <p style={{ color: "#a0a0b0", margin: 0, fontSize: 15 }}>
            You&apos;ve been invited to join as <strong style={{ color: "#ebb003" }}>{invite.role}</strong>
          </p>
        </div>

        {error && (
          <div style={{ background: "rgba(224,108,117,0.1)", border: "1px solid rgba(224,108,117,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 20, color: "#e06c75", fontSize: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Profile Picture */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Profile Picture *</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("profile-upload").click()}
              style={{
                border: `2px dashed ${dragOver ? "#ebb003" : "#1e1e2e"}`,
                borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer",
                background: dragOver ? "rgba(235,176,3,0.05)" : "transparent",
              }}
            >
              {profilePreview ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <img src={profilePreview} alt="Preview" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid #ebb003" }} />
                  <span style={{ color: "#a0a0b0", fontSize: 13 }}>Click or drag to replace</span>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                  <p style={{ color: "#a0a0b0", margin: "0 0 4px", fontSize: 14 }}>Drag & drop your photo here</p>
                  <p style={{ color: "#666", margin: 0, fontSize: 12 }}>or click to browse</p>
                </div>
              )}
              <input id="profile-upload" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Full Name *</label>
            <input style={inputStyle} required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }} readOnly value={invite.email} />
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 123-4567" />
          </div>

          {/* Bar Number - Attorney only */}
          {invite.role === "Attorney" && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Bar Number *</label>
              <input style={inputStyle} required value={form.bar_number} onChange={(e) => setForm(f => ({ ...f, bar_number: e.target.value }))} placeholder="12345678" />
            </div>
          )}

          {/* Password */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password *</label>
            <input style={inputStyle} type="password" required minLength={8} value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Confirm Password *</label>
            <input style={inputStyle} type="password" required value={form.confirmPassword} onChange={(e) => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Confirm password" />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", padding: "14px", background: submitting ? "#8a6a02" : "#ebb003",
              color: "#08080f", border: "none", borderRadius: 10, fontSize: 16,
              fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Creating your account..." : "Complete Onboarding"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#08080f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#e8e8f0", fontSize: 18 }}>Loading...</div>
      </div>
    }>
      <OnboardForm />
    </Suspense>
  );
}
