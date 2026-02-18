"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, FileText, Download, Folder, FolderOpen, File,
  ChevronRight, ChevronDown, Loader2, AlertCircle, X,
  FileImage, FileSpreadsheet, FileVideo, FileAudio,
} from "lucide-react";

const EXT_ICONS = {
  pdf: FileText, doc: FileText, docx: FileText, txt: FileText, rtf: FileText,
  jpg: FileImage, jpeg: FileImage, png: FileImage, gif: FileImage, webp: FileImage, tiff: FileImage, bmp: FileImage,
  xls: FileSpreadsheet, xlsx: FileSpreadsheet, csv: FileSpreadsheet,
  mp4: FileVideo, mov: FileVideo, avi: FileVideo, mkv: FileVideo,
  mp3: FileAudio, wav: FileAudio, m4a: FileAudio,
};

function getIcon(ext) {
  return EXT_ICONS[ext?.toLowerCase()] || File;
}

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StorageDocBrowser({ caseId, className = "" }) {
  const [documents, setDocuments] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  const [downloading, setDownloading] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(null);

  const handleAnalyze = async (doc, e) => {
    if (e) e.stopPropagation();
    setAnalyzing(doc.id);
    setAnalysisResult(null);
    try {
      const res = await fetch("/api/docs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: doc.id, storage_path: doc.storage_path }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysisResult(data.analysis);
        setShowAnalysis(doc.id);
      }
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setAnalyzing(null);
    }
  };

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (caseId) params.set("case_id", caseId);
      if (search) params.set("search", search);
      params.set("page", page.toString());
      params.set("limit", "100");

      const res = await fetch(`/api/storage-docs?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch documents");

      setDocuments(data.documents || []);
      setGrouped(data.grouped || {});
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);

      // Auto-expand all categories
      const cats = {};
      for (const cat of Object.keys(data.grouped || {})) cats[cat] = true;
      setExpandedCats(cats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [caseId, search, page]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleDownload = async (doc) => {
    setDownloading(doc.id);
    try {
      const res = await fetch(`/api/storage-docs?id=${doc.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.document?.download_url) {
        window.open(data.document.download_url, "_blank");
      } else {
        throw new Error("No download URL available");
      }
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const toggleCat = (cat) =>
    setExpandedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const categories = Object.keys(grouped).sort();

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Folder className="w-5 h-5 text-blue-600" />
            Documents {caseId && <span className="text-sm font-normal text-gray-500">— Case {caseId}</span>}
          </h3>
          <span className="text-sm text-gray-500">{total} document{total !== 1 ? "s" : ""}</span>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by filename..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-8 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Search
          </button>
        </form>
      </div>

      {/* Content */}
      <div className="max-h-[600px] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading documents...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {!loading && !error && documents.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            {search ? "No documents match your search." : "No documents found."}
          </div>
        )}

        {!loading && categories.map((cat) => (
          <div key={cat} className="border-b last:border-b-0">
            <button
              onClick={() => toggleCat(cat)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {expandedCats[cat] ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              {expandedCats[cat] ? (
                <FolderOpen className="w-4 h-4 text-yellow-500" />
              ) : (
                <Folder className="w-4 h-4 text-yellow-500" />
              )}
              {cat}
              <span className="text-xs text-gray-400 ml-1">({grouped[cat].length})</span>
            </button>

            {expandedCats[cat] && (
              <div className="pb-1">
                {grouped[cat].map((doc) => {
                  const Icon = getIcon(doc.extension);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 px-4 pl-12 py-2 hover:bg-blue-50 group cursor-pointer"
                      style={{ position: "relative" }}
                      onClick={() => handleDownload(doc)}
                    >
                      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{doc.filename}</p>
                        <p className="text-xs text-gray-400 truncate">{doc.original_path}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(doc.size_bytes)}</span>
                      <button
                        onClick={(e) => handleAnalyze(doc, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-green-600 hover:text-green-800"
                        title="Analyze document"
                      >
                        {analyzing === doc.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span style={{ fontSize: 14 }}>🔍</span>
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:text-blue-800"
                        title="Download"
                      >
                        {downloading === doc.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                      {showAnalysis === doc.id && analysisResult && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute", right: 0, top: "100%", zIndex: 50,
                            background: "#111119", border: "1px solid #2a2a3a", borderRadius: 8,
                            padding: 16, width: 360, maxHeight: 400, overflowY: "auto",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5)", color: "#e8e8f0", fontSize: 13,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                            <span style={{ fontWeight: 700, color: "#ebb003" }}>
                              {analysisResult.docType || "Document"} Analysis
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); setShowAnalysis(null); }} style={{ background: "none", border: "none", color: "#8888a0", cursor: "pointer", fontSize: 16 }}>✕</button>
                          </div>
                          {analysisResult.summary && <p style={{ marginBottom: 10, lineHeight: 1.5 }}>{analysisResult.summary}</p>}
                          {analysisResult.amounts?.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <span style={{ color: "#386f4a", fontWeight: 600, fontSize: 11 }}>💰 AMOUNTS</span>
                              <div>{analysisResult.amounts.map((a, i) => <span key={i} style={{ display: "inline-block", background: "rgba(56,111,74,0.15)", padding: "2px 8px", borderRadius: 12, margin: "2px 4px 2px 0", fontSize: 12 }}>{a}</span>)}</div>
                            </div>
                          )}
                          {analysisResult.dates?.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <span style={{ color: "#ebb003", fontWeight: 600, fontSize: 11 }}>📅 DATES</span>
                              <div>{analysisResult.dates.map((d, i) => <span key={i} style={{ display: "inline-block", background: "rgba(235,176,3,0.1)", padding: "2px 8px", borderRadius: 12, margin: "2px 4px 2px 0", fontSize: 12 }}>{d}</span>)}</div>
                            </div>
                          )}
                          {analysisResult.parties?.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <span style={{ color: "#7c5cbf", fontWeight: 600, fontSize: 11 }}>👤 PARTIES</span>
                              <div>{analysisResult.parties.map((p, i) => <span key={i} style={{ display: "inline-block", background: "rgba(124,92,191,0.1)", padding: "2px 8px", borderRadius: 12, margin: "2px 4px 2px 0", fontSize: 12 }}>{p}</span>)}</div>
                            </div>
                          )}
                          {analysisResult.denialReason && (
                            <div style={{ background: "rgba(224,64,80,0.1)", border: "1px solid rgba(224,64,80,0.3)", borderRadius: 6, padding: 10, marginBottom: 8 }}>
                              <span style={{ color: "#e04050", fontWeight: 600, fontSize: 11 }}>⚠️ DENIAL REASON</span>
                              <p style={{ marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>{analysisResult.denialReason}</p>
                            </div>
                          )}
                          {analysisResult.flags?.length > 0 && (
                            <div>{analysisResult.flags.map((f, i) => <div key={i} style={{ color: "#ebb003", fontSize: 12 }}>⚡ {f}</div>)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
