import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { readAdminSession, clearAdminSession, adminFetch } from "./adminAuth.js";
import { ROOMS, roomLabel } from "./rooms.js";

const NAVY = "#0B1F3A";
const BLUE = "#1F7AE0";

const card = {
  background: "#fff",
  border: "1px solid #e3e8ef",
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
  textAlign: "left",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};
const badge = {
  marginLeft: 8,
  background: "#fff4e5",
  color: "#b26a00",
  borderRadius: 10,
  padding: "1px 8px",
  fontSize: 11,
};
const primaryBtn = {
  marginTop: 8,
  background: BLUE,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  cursor: "pointer",
};
const secondaryBtn = {
  marginTop: 8,
  background: "transparent",
  color: BLUE,
  border: `1px solid ${BLUE}`,
  borderRadius: 6,
  padding: "6px 12px",
  cursor: "pointer",
};
const textBox = {
  width: "100%",
  boxSizing: "border-box",
  padding: 8,
  borderRadius: 6,
  border: "1px solid #ccd",
  marginTop: 8,
};

function formatTime(t) {
  if (!t) return "";
  return new Date(t).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function AdminDashboard() {
  const navigate = useNavigate();
  const session = readAdminSession();

  const isSuper = session?.role === "SUPER_ADMIN";
  const myRooms = !session
    ? []
    : isSuper
    ? ROOMS.map((r) => r.id)
    : session.assignedRooms || [];

  const [room, setRoom] = useState(myRooms[0] || "");
  const [tab, setTab] = useState("pending");
  const [pending, setPending] = useState([]);
  const [answered, setAnswered] = useState([]);
  const [drafts, setDrafts] = useState({}); // question id → text being typed
  const [openAdd, setOpenAdd] = useState(null); // which question's "Add your answer" box is open
  const [notice, setNotice] = useState("");
  const [expired, setExpired] = useState(false);

  async function loadLists() {
    if (!room) return;
    const p = await adminFetch(`/admin/rooms/${room}/questions`);
    if (p.expired) {
      setExpired(true);
      return;
    }
    if (p.ok) setPending(p.data);
    else setNotice("⚠️ " + p.data);

    const a = await adminFetch(`/admin/rooms/${room}/answered`);
    if (a.expired) {
      setExpired(true);
      return;
    }
    if (a.ok) setAnswered(a.data);
  }

  // load now, then refresh every 30 seconds; stop the timer when the room changes or the page closes
  useEffect(() => {
    loadLists();
    const timer = setInterval(loadLists, 30000);
    return () => clearInterval(timer);
  }, [room]);

  async function sendAnswer(questionId) {
    const text = (drafts[questionId] || "").trim();
    if (!text) return;
    const res = await adminFetch(`/admin/questions/${questionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerText: text }),
    });
    if (res.expired) {
      setExpired(true);
      return;
    }
    if (res.ok) {
      setNotice("✅ Answer sent.");
      setDrafts((d) => ({ ...d, [questionId]: "" }));
      setOpenAdd(null);
    } else {
      setNotice("⚠️ " + res.data); // e.g. "You have already answered this question."
    }
    loadLists();
  }

  function logout() {
    clearAdminSession();
    navigate("/admin/login", { replace: true });
  }

  // no session, or the backend rejected the token → back to login
  if (!session || expired) {
    return <Navigate to="/admin/login" replace state={{ expired }} />;
  }

  // group answers by question: a copy points to its original via originalQuestionId
  const groups = [];
  const byRoot = {};
  for (const q of answered) {
    const rootId = q.originalQuestionId ?? q.id;
    if (!byRoot[rootId]) {
      byRoot[rootId] = { rootId, question: q, answers: [] };
      groups.push(byRoot[rootId]);
    }
    byRoot[rootId].answers.push(q);
  }
  groups.forEach((g) =>
    g.answers.sort((x, y) => new Date(x.answeredAt) - new Date(y.answeredAt))
  );

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 40px" }}>
      {/* header bar */}
      <div
        style={{
          background: NAVY,
          color: "#fff",
          borderRadius: 10,
          padding: "14px 18px",
          marginTop: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 20, fontWeight: "bold" }}>
            PadhakuGang <span style={{ color: BLUE }}>·</span> Mentor Dashboard
          </div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Logged in as <b>{session.displayName || session.username}</b> ·{" "}
            {isSuper ? "Super Admin" : "Mentor"}
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            background: "transparent",
            color: "#fff",
            border: "1px solid #fff",
            borderRadius: 6,
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      {/* room picker */}
      <div style={{ margin: "16px 0", textAlign: "left" }}>
        {myRooms.length === 0 ? (
          <p>No rooms are assigned to you yet. Please contact the admin.</p>
        ) : (
          <label>
            Room:{" "}
            <select
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                setNotice("");
                setOpenAdd(null);
              }}
              style={{ padding: 6, borderRadius: 6 }}
            >
              {myRooms.map((id) => (
                <option key={id} value={id}>
                  {roomLabel(id)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {notice && (
        <div
          style={{
            background: "#eef6ff",
            border: `1px solid ${BLUE}`,
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 12,
            textAlign: "left",
          }}
        >
          {notice}
        </div>
      )}

      {/* tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[
          { id: "pending", label: `⏳ Pending (${pending.length})` },
          { id: "answered", label: `✅ Recently answered (${groups.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "10px 4px",
              border: "none",
              borderBottom: tab === t.id ? `3px solid ${BLUE}` : "3px solid #ddd",
              background: "transparent",
              fontWeight: tab === t.id ? "bold" : "normal",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* PENDING */}
      {tab === "pending" && (
        <div>
          {pending.length === 0 && (
            <p style={{ color: "#888" }}>🎉 No pending questions in this room.</p>
          )}
          {pending.map((q) => (
            <div key={q.id} style={card}>
              <div style={{ fontSize: 12, color: "#888" }}>
                {q.studentName} · {formatTime(q.createdAt)}
                {q.privateQuestion && <span style={badge}>🔒 Private</span>}
              </div>
              <p style={{ margin: "8px 0", fontWeight: 500 }}>{q.questionText}</p>
              <textarea
                rows={3}
                maxLength={2000}
                placeholder="Write your answer..."
                value={drafts[q.id] || ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                style={textBox}
              />
              <button onClick={() => sendAnswer(q.id)} style={primaryBtn}>
                Send answer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* RECENTLY ANSWERED — one card per question, all answers under it */}
      {tab === "answered" && (
        <div>
          {groups.length === 0 && (
            <p style={{ color: "#888" }}>No answered questions in this room yet.</p>
          )}
          {groups.map((g) => {
            const iAnswered = g.answers.some((a) => a.answeredBy === session.username);
            return (
              <div key={g.rootId} style={card}>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {g.question.studentName} · asked {formatTime(g.question.createdAt)}
                  {g.question.privateQuestion && <span style={badge}>🔒 Private</span>}
                </div>
                <p style={{ margin: "8px 0", fontWeight: 500 }}>{g.question.questionText}</p>

                {g.answers.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      background: "#f4f8fd",
                      borderLeft: `3px solid ${BLUE}`,
                      borderRadius: 6,
                      padding: "8px 10px",
                      marginTop: 8,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#555" }}>
                      🎓 <b>{a.answeredByLabel}</b> · {formatTime(a.answeredAt)}
                    </div>
                    <div style={{ whiteSpace: "pre-line", marginTop: 4 }}>{a.answerText}</div>
                  </div>
                ))}

                {iAnswered && (
                  <div style={{ fontSize: 12, color: "#2e7d32", marginTop: 8 }}>
                    ✔ You have answered this question
                  </div>
                )}

                {!iAnswered && openAdd !== g.rootId && (
                  <button onClick={() => setOpenAdd(g.rootId)} style={secondaryBtn}>
                    ➕ Add your answer
                  </button>
                )}

                {!iAnswered && openAdd === g.rootId && (
                  <div>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      placeholder="Your perspective on this question..."
                      value={drafts[g.rootId] || ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [g.rootId]: e.target.value }))
                      }
                      style={textBox}
                    />
                    <button onClick={() => sendAnswer(g.rootId)} style={primaryBtn}>
                      Send answer
                    </button>{" "}
                    <button onClick={() => setOpenAdd(null)} style={secondaryBtn}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;