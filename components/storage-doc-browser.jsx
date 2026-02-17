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
                      onClick={() => handleDownload(doc)}
                    >
                      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{doc.filename}</p>
                        <p className="text-xs text-gray-400 truncate">{doc.original_path}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(doc.size_bytes)}</span>
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
