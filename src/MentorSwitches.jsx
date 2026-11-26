import React, { useState, useEffect } from "react";
import { adminFetch } from "./adminAuth.js";
import { roomLabel } from "./rooms.js";

// Super admin only: one row per mentor, one tick-box per power. A tick saves at once and
// works on that mentor's very next click (no logout needed).
export default function MentorSwitches({ onExpired }) {
  const [switches, setSwitches] = useState([]);   // [{key, label, defaultOn}]
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    const [a, b] = await Promise.all([adminFetch("/admin/permissions"), adminFetch("/admin/mentors")]);
    if (a.expired || b.expired) { onExpired && onExpired(); return; }
    if (!a.ok || !b.ok || !Array.isArray(a.data) || !Array.isArray(b.data)) {
      setError("Could not load the mentor list.");
    } else {
      setSwitches(a.data);
      setMentors(b.data);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(mentor, key) {
    if (busyId) return;
    const has = mentor.permissions.includes(key);
    const next = has ? mentor.permissions.filter((k) => k !== key) : [...mentor.permissions, key];
    setBusyId(mentor.id);
    setError("");
    const res = await adminFetch(`/admin/mentors/${mentor.id}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: next }),
    });
    if (res.expired) { onExpired && onExpired(); return; }
    if (res.ok) {
      setMentors((list) => list.map((m) => (m.id === mentor.id ? { ...m, permissions: next } : m)));
    } else {
      setError(typeof res.data === "string" && res.data ? res.data : "Could not save. Try again.");
    }
    setBusyId(null);
  }

  if (loading) return <p style={{ color: "#888" }}>Loading mentors…</p>;

  return (
    <div>
      <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
        Tick a power to give it to that mentor. It saves at once and works on their very next click.
        You (super admin) always have every power.
      </p>
      {error && (
        <div style={{ background: "#fff0f0", color: "#b3261e", border: "1px solid #f3b8b4", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}
      {mentors.length === 0 && <p style={{ color: "#888" }}>No mentors yet.</p>}
      {mentors.map((m) => (
        <div key={m.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: "10px 12px", marginBottom: 10, opacity: m.active ? 1 : 0.55, textAlign: "left" }}>
          <div style={{ marginBottom: 6 }}>
            <strong>{m.displayName || m.username}</strong>{" "}
            <span style={{ fontSize: 12, color: "#888" }}>
              ({m.username}){!m.active && " · switched off"}
            </span>
            <div style={{ fontSize: 12, color: "#888" }}>
              Rooms: {(m.assignedRooms || []).map((r) => roomLabel(r)).join(", ") || "none"}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
            {switches.map((sw) => (
              <label key={sw.key} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, minHeight: 32, cursor: busyId ? "wait" : "pointer" }}>
                <input
                  type="checkbox"
                  checked={m.permissions.includes(sw.key)}
                  disabled={Boolean(busyId)}
                  onChange={() => toggle(m, sw.key)}
                />
                {sw.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
