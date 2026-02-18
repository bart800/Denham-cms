"use client";
import { Component } from "react";
import DenhamStaffPortal from "../components/denham-staff-portal";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, retrying: false };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("CMS Error:", error, info);
    // Auto-retry on ChunkLoadError (stale deployment)
    if (
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Failed to fetch dynamically imported module")
    ) {
      this.handleChunkRetry();
    }
  }
  handleChunkRetry = () => {
    const retryCount = parseInt(sessionStorage.getItem("chunk_retry") || "0", 10);
    if (retryCount < 2) {
      sessionStorage.setItem("chunk_retry", String(retryCount + 1));
      this.setState({ retrying: true });
      // Hard reload to get fresh chunks
      window.location.reload();
    }
  };
  render() {
    if (this.state.retrying) {
      return (
        <div style={{ padding: 40, fontFamily: "system-ui", color: "#e8e8f0", background: "#08080f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>🔄</div>
            <p style={{ color: "#ebb003" }}>Updating to latest version...</p>
          </div>
        </div>
      );
    }
    if (this.state.error) {
      const isChunkError =
        this.state.error?.name === "ChunkLoadError" ||
        this.state.error?.message?.includes("Loading chunk") ||
        this.state.error?.message?.includes("Failed to fetch dynamically imported module");
      return (
        <div style={{ padding: 40, fontFamily: "system-ui", color: "#e8e8f0", background: "#08080f", minHeight: "100vh" }}>
          <h1 style={{ color: "#e04050", fontSize: 20 }}>⚠️ Something went wrong</h1>
          {isChunkError ? (
            <>
              <p style={{ color: "#888", fontSize: 14, marginTop: 12 }}>
                A new version of the app was deployed. Please reload to get the latest version.
              </p>
              <button
                onClick={() => {
                  sessionStorage.removeItem("chunk_retry");
                  window.location.reload();
                }}
                style={{ marginTop: 20, padding: "10px 24px", background: "#ebb003", color: "#000", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
              >
                🔄 Reload App
              </button>
            </>
          ) : (
            <>
              <pre style={{ color: "#888", fontSize: 12, whiteSpace: "pre-wrap", marginTop: 16 }}>{this.state.error.message}</pre>
              <pre style={{ color: "#555", fontSize: 11, whiteSpace: "pre-wrap", marginTop: 8 }}>{this.state.error.stack}</pre>
              <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, padding: "8px 16px", background: "#ebb003", color: "#000", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Retry</button>
            </>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// Clear retry counter on successful load
if (typeof window !== "undefined") {
  sessionStorage.removeItem("chunk_retry");
}

export default function Home() {
  return <ErrorBoundary><DenhamStaffPortal /></ErrorBoundary>;
}
