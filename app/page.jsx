"use client";
import { Component } from "react";
import DenhamStaffPortal from "../components/denham-staff-portal";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("CMS Error:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: "system-ui", color: "#e8e8f0", background: "#08080f", minHeight: "100vh" }}>
          <h1 style={{ color: "#e04050", fontSize: 20 }}>⚠️ Something went wrong</h1>
          <pre style={{ color: "#888", fontSize: 12, whiteSpace: "pre-wrap", marginTop: 16 }}>{this.state.error.message}</pre>
          <pre style={{ color: "#555", fontSize: 11, whiteSpace: "pre-wrap", marginTop: 8 }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, padding: "8px 16px", background: "#ebb003", color: "#000", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  return <ErrorBoundary><DenhamStaffPortal /></ErrorBoundary>;
}
