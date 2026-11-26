import React, { useEffect, useState } from "react";
import "./RoomFiles.css";

// Set to true to use sample files when the GET API fails.
// Keep false for production.
const MOCK = false;
const MOCK_FILES = [
  { id: 12, originalName: "Polity notes.pdf", sizeBytes: 2048000, mimeType: "application/pdf", uploaderName: "Rahul", uploadedAt: "2026-11-25T18:30:00", pinned: true, pageCount: 14, thumbUrl: null, downloadUrl: "/api/files/12/download" },
  { id: 13, originalName: "Modern History Revision.pdf", sizeBytes: 1250000, mimeType: "application/pdf", uploaderName: "Priya", uploadedAt: "2026-11-25T17:20:00", pinned: false, pageCount: 22, thumbUrl: null, downloadUrl: "/api/files/13/download" },
  { id: 14, originalName: "Geography Map.png", sizeBytes: 450000, mimeType: "image/png", uploaderName: "Amit", uploadedAt: "2026-11-25T15:00:00", pinned: false, pageCount: null, thumbUrl: null, downloadUrl: "/api/files/14/download" },
];
// values are what the backend accepts
const REPORT_REASONS = [
  { value: "ILLEGAL", label: "Illegal or copyright-infringing" },
  { value: "ABUSE", label: "Abusive or inappropriate" },
  { value: "SPAM", label: "Spam" },
  { value: "DANGER", label: "Someone may be in danger" },
  { value: "OTHER", label: "Other" },
];
// the backend answers errors as JSON {"error": "..."} or as plain text
async function errorText(response, fallback) {
  try {
    const text = await response.text();
    if (!text) return fallback;
    try { const j = JSON.parse(text); return j.error || j.message || fallback; } catch (e) { return text; }
  } catch (e) { return fallback; }
}
function buildApiUrl(apiUrl, path) {
  const base = String(apiUrl || "").replace(/\/+$/, "");
  return `${base}${path}`;
}
function buildFileUrl(apiUrl, path) {
  if (!path || typeof path !== "string") return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return buildApiUrl(apiUrl, path);
}
function getHeaders(token, includeJson = false) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}
function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "Unknown size";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function formatTimeAgo(dateString) {
  if (!dateString) return "Unknown date";
  const uploadedDate = new Date(dateString);
  if (Number.isNaN(uploadedDate.getTime())) return "Unknown date";
  const seconds = Math.max(0, Math.floor((Date.now() - uploadedDate.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
function isPdf(file) {
  return file.mimeType === "application/pdf" || /\.pdf$/i.test(file.originalName || "");
}
function isImage(file) {
  return Boolean(file.mimeType?.startsWith("image/"));
}
function FileThumbnail({ file, apiUrl }) {
  const [imageFailed, setImageFailed] = useState(false);
  const thumbnailUrl = buildFileUrl(apiUrl, file.thumbUrl);
  useEffect(() => { setImageFailed(false); }, [thumbnailUrl]);
  let fileType = "FILE";
  if (isPdf(file)) fileType = "PDF";
  else if (isImage(file)) fileType = "IMG";
  return (
    <div className="rf-thumbnail" aria-hidden="true">
      {thumbnailUrl && !imageFailed ? (
        <img src={thumbnailUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
      ) : (
        <div className="rf-thumbnail-placeholder">
          <span className="rf-thumbnail-icon">{isPdf(file) ? "📄" : isImage(file) ? "🖼️" : "📁"}</span>
          <span className="rf-thumbnail-type">{fileType}</span>
        </div>
      )}
    </div>
  );
}
function FileCard({ file, roomId, apiUrl, isMentor, canPin, canDelete, studentName, token, onPinChange, onDelete }) {
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [reportError, setReportError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const downloadUrl = buildFileUrl(apiUrl, file.downloadUrl);
  function stopEvent(event) { event.stopPropagation(); }
  function openFile() {
    if (!downloadUrl) return;
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }
  function handleCardKeyDown(event) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFile();
    }
  }
  async function handlePin(event) {
    stopEvent(event);
    if (!canPin || busyAction) return;
    setBusyAction("pin");
    setActionError("");
    try {
      const response = await fetch(buildApiUrl(apiUrl, `/admin/files/${file.id}/pin`), {
        method: "POST", headers: getHeaders(token, true), body: JSON.stringify({ pinned: !file.pinned }),
      });
      if (!response.ok) throw new Error(await errorText(response, "Could not update this file."));
      onPinChange(file.id, !file.pinned);
    } catch (error) { setActionError(error.message || "Pin update failed."); }
    finally { setBusyAction(""); }
  }
  async function handleDelete(event) {
    stopEvent(event);
    if (!canDelete || busyAction) return;
    if (!window.confirm(`Delete "${file.originalName}"?\n\nThis action cannot be undone.`)) return;
    setBusyAction("delete");
    setActionError("");
    try {
      const response = await fetch(buildApiUrl(apiUrl, `/admin/files/${file.id}`), {
        method: "DELETE", headers: getHeaders(token),
      });
      if (!response.ok) throw new Error(await errorText(response, "Could not delete this file."));
      onDelete(file.id);
    } catch (error) { setActionError(error.message || "Delete failed."); }
    finally { setBusyAction(""); }
  }
  async function handleReport(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!reportReason || busyAction) return;
    setBusyAction("report");
    setReportError("");
    setReportStatus("");
    try {
      const response = await fetch(buildApiUrl(apiUrl, `/api/rooms/${encodeURIComponent(roomId)}/files/${file.id}/report`), {
        method: "POST", headers: getHeaders(token, true),
        body: JSON.stringify({ reason: reportReason, reporterName: studentName }),
      });
      if (!response.ok) throw new Error(await errorText(response, "Could not submit your report."));
      setReportStatus("Report submitted. Thank you.");
      setShowReport(false);
      setReportReason("");
    } catch (error) { setReportError(error.message || "Report failed."); }
    finally { setBusyAction(""); }
  }
  function toggleReport(event) {
    stopEvent(event);
    setShowReport((previous) => !previous);
    setReportReason("");
    setReportError("");
    setReportStatus("");
  }
  const hasPages = isPdf(file) && file.pageCount !== null && file.pageCount !== undefined;
  return (
    <article className="rf-card">
      <div className={`rf-card-main ${downloadUrl ? "rf-clickable" : ""}`}
        role={downloadUrl ? "link" : undefined} tabIndex={downloadUrl ? 0 : undefined}
        aria-label={downloadUrl ? `Open ${file.originalName} in a new tab` : undefined}
        onClick={openFile} onKeyDown={handleCardKeyDown}>
        <FileThumbnail file={file} apiUrl={apiUrl} />
        <div className="rf-file-info">
          <div className="rf-file-name-row"><h3 className="rf-file-name" title={file.originalName}>{file.originalName}</h3></div>
          <div className="rf-file-details">
            <span>{formatFileSize(file.sizeBytes)}</span>
            {hasPages && <><span className="rf-dot">·</span><span>{file.pageCount} {file.pageCount === 1 ? "page" : "pages"}</span></>}
          </div>
          <div className="rf-file-uploader">by {file.uploaderName || "Unknown"} · {formatTimeAgo(file.uploadedAt)}</div>
          {file.pinned && <span className="rf-pinned-label">⭐ Important</span>}
        </div>
      </div>
      <div className="rf-card-actions">
        {!isMentor && <button type="button" className="rf-action-button rf-report-button" onClick={toggleReport} disabled={Boolean(busyAction)} aria-expanded={showReport}>🚩 Report</button>}
        {canPin && <button type="button" className="rf-action-button rf-pin-button" onClick={handlePin} disabled={Boolean(busyAction)}>{busyAction === "pin" ? "Saving..." : file.pinned ? "⭐ Unpin" : "⭐ Pin"}</button>}
        {canDelete && <button type="button" className="rf-action-button rf-delete-button" onClick={handleDelete} disabled={Boolean(busyAction)}>{busyAction === "delete" ? "Deleting..." : "🗑 Delete"}</button>}
      </div>
      {!isMentor && showReport && <form className="rf-report-form" onClick={stopEvent} onSubmit={handleReport}>
        <label htmlFor={`rf-reason-${file.id}`}>Why are you reporting this file?</label>
        <select id={`rf-reason-${file.id}`} value={reportReason} onChange={(event) => setReportReason(event.target.value)} disabled={Boolean(busyAction)} required>
          <option value="">Select a reason</option>
          {REPORT_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
        </select>
        <div className="rf-report-form-actions">
          <button type="button" className="rf-cancel-button" onClick={toggleReport} disabled={Boolean(busyAction)}>Cancel</button>
          <button type="submit" className="rf-submit-button" disabled={!reportReason || Boolean(busyAction)}>{busyAction === "report" ? "Submitting..." : "Submit report"}</button>
        </div>
        {reportError && <p className="rf-message-error" role="alert">{reportError}</p>}
      </form>}
      {reportStatus && <p className="rf-message-success" role="status">{reportStatus}</p>}
      {actionError && <p className="rf-message-error" role="alert">{actionError}</p>}
    </article>
  );
}
export default function RoomFiles({ roomId, apiUrl, token, isMentor, canPin = false, canDelete = false, studentName }) {
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingMock, setUsingMock] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    async function loadFiles() {
      setLoading(true); setError(""); setUsingMock(false);
      try {
        const params = new URLSearchParams();
        params.set("q", debouncedSearch);
        const url = buildApiUrl(apiUrl, `/api/rooms/${encodeURIComponent(roomId)}/files?${params}`);
        const response = await fetch(url, { method: "GET", headers: getHeaders(token), signal: controller.signal });
        if (!response.ok) throw new Error("Could not load room files.");
        const result = await response.json();
        if (!Array.isArray(result)) throw new Error("Invalid file list received.");
        if (controller.signal.aborted) return;
        setFiles(result);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        if (MOCK) {
          const query = debouncedSearch.toLowerCase();
          setFiles(MOCK_FILES.filter((file) => file.originalName.toLowerCase().includes(query)));
          setUsingMock(true);
        } else {
          setFiles([]);
          setError(fetchError.message || "Something went wrong while loading files.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadFiles();
    return () => controller.abort();
  }, [roomId, apiUrl, token, debouncedSearch, retryKey]);
  function handlePinChange(fileId, pinned) {
    setFiles((previousFiles) => previousFiles.map((file) => file.id === fileId ? { ...file, pinned } : file));
  }
  function handleDelete(fileId) { setFiles((previousFiles) => previousFiles.filter((file) => file.id !== fileId)); }
  function handleRetry() { setRetryKey((previous) => previous + 1); }
  const pinnedFiles = files.filter((file) => file.pinned);
  const regularFiles = files.filter((file) => !file.pinned);
  function renderCards(items) {
    return <div className="rf-grid">{items.map((file) => <FileCard key={file.id} file={file} roomId={roomId} apiUrl={apiUrl} token={token} isMentor={isMentor} canPin={canPin} canDelete={canDelete} studentName={studentName} onPinChange={handlePinChange} onDelete={handleDelete} />)}</div>;
  }
  return (
    <section className="room-files">
      <div className="rf-header">
        <div className="rf-heading"><h2>📁 Files</h2><p>Study notes and files shared in this room</p></div>
        <span className="rf-file-count" aria-live="polite">{loading ? "Loading..." : `${files.length} ${files.length === 1 ? "file" : "files"}`}</span>
      </div>
      <div className="rf-search-container">
        <span className="rf-search-icon" aria-hidden="true">🔍</span>
        <input type="search" className="rf-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search files..." aria-label="Search room files" />
      </div>
      {usingMock && !loading && <p className="rf-mock-notice">Demo mode: Showing sample files because the API is unavailable.</p>}
      {loading && <div className="rf-state" role="status"><div className="rf-spinner" aria-hidden="true" /><p>Loading files...</p></div>}
      {!loading && error && <div className="rf-state rf-error-state" role="alert"><span className="rf-state-icon">⚠️</span><h3>Unable to load files</h3><p>{error}</p><button type="button" className="rf-retry-button" onClick={handleRetry}>Retry</button></div>}
      {!loading && !error && files.length === 0 && <div className="rf-state rf-empty-state"><span className="rf-state-icon">📂</span><h3>{debouncedSearch ? "No matching files" : "No files shared yet"}</h3><p>{debouncedSearch ? "Try searching with a different file name." : "Files shared in this study room will appear here."}</p></div>}
      {!loading && !error && files.length > 0 && <div className="rf-content">
        {pinnedFiles.length > 0 && <section className="rf-section rf-important-section" aria-label="Important files"><div className="rf-section-header"><h3>⭐ Important</h3><span>{pinnedFiles.length}</span></div>{renderCards(pinnedFiles)}</section>}
        {regularFiles.length > 0 && <section className="rf-section" aria-label="Room files"><div className="rf-section-header"><h3>All Files</h3><span>{regularFiles.length}</span></div>{renderCards(regularFiles)}</section>}
      </div>}
    </section>
  );
}
