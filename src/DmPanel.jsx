// #3 DM — direct messages inside a study room.
// useDm()  = all DM state + what to do with each message from the server (private letterbox /user/queue/dm)
// DmPanel  = the ✉️ Messages tab: settings, Approach Gate answers, Requests, Sent, Chats, one open conversation
import { useState } from "react";
import { STAGES, titledName } from "./rooms";
import { GATE_QUESTIONS, DEFAULT_GATE, CUSTOM_ID, buildGate } from "./dmQuestions";

const DM_SETTINGS_KEY = "pg_dm_settings";
const MINOR_STAGES = ["class-6-8", "class-9-10", "class-11", "class-12"];

// 3d: same reasons as reporting a room message
const DM_REPORT_REASONS = [
    { id: "SPAM", label: "Spam" },
    { id: "ABUSE", label: "Abusive or inappropriate" },
    { id: "ILLEGAL", label: "Illegal or dangerous" },
    { id: "DANGER", label: "Someone may be in danger" },
    { id: "OTHER", label: "Other" },
];

function readDmSettings(stage) {
    try {
        const raw = localStorage.getItem(DM_SETTINGS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        // storage blocked → defaults
    }
    // default: Privacy Mode ON for school / Class 11–12 students, Gate OFF
    return { privacy: MINOR_STAGES.includes(stage), sameGenderOnly: false, gateOn: false, gate: DEFAULT_GATE };
}

export function useDm({ stompClientRef, joinData, isTabOpen }) {
    const [requests, setRequests] = useState([]);    // incoming request cards
    const [sent, setSent] = useState([]);            // names I asked, waiting
    const [chats, setChats] = useState([]);          // { with, messages, unread, closed, note }
    const [activeChat, setActiveChat] = useState(null);
    const [notice, setNotice] = useState("");
    const [gatePrompt, setGatePrompt] = useState(null);   // { to, questions, answers, error }
    const [settings, setSettings] = useState(() => readDmSettings(joinData.stage));

    function publish(body) {
        const client = stompClientRef.current;
        if (!client || !client.connected) {
            setNotice("Not connected. Please wait a moment and try again.");
            return;
        }
        client.publish({ destination: "/app/dm", body: JSON.stringify(body) });
    }

    // sent right after JOIN on every (re)connect — gender travels ONLY here, never in the room JOIN
    function sendSettings(s = settings) {
        publish({
            type: "SETTINGS",
            gender: joinData.gender || null,
            privacy: s.privacy,
            sameGenderOnly: s.sameGenderOnly,
            gate: s.gateOn ? buildGate(s.gate) : [],
        });
    }

    function saveSettings(s) {
        setSettings(s);
        try {
            localStorage.setItem(DM_SETTINGS_KEY, JSON.stringify(s));
        } catch (e) {
            // ignore
        }
        sendSettings(s);
        setNotice("✅ DM settings saved.");
    }

    // a new connection = a new session on the server → old DM state is gone there, so clear it here too
    function reset() {
        setRequests([]);
        setSent([]);
        setChats([]);
        setActiveChat(null);
        setGatePrompt(null);
    }

    function updateChat(name, fn) {
        setChats((prev) => prev.map((c) => (c.with === name ? fn(c) : c)));
    }

    // every message from my private letterbox
    function handleIncoming(m) {
        switch (m.type) {
            case "SETTINGS_SAVED":
                setSettings((prev) => ({ ...prev, privacy: m.privacy, sameGenderOnly: m.sameGenderOnly }));
                break;
            case "REQUEST_SENT":
                setSent((prev) => (prev.includes(m.to) ? prev : [...prev, m.to]));
                setGatePrompt(null);
                setNotice(`📨 Request sent to ${m.to}.`);
                break;
            case "REQUEST_IN":
                setRequests((prev) => [...prev.filter((r) => r.from !== m.from), m]);
                break;
            case "REQUEST_GONE":
                setRequests((prev) => prev.filter((r) => r.from !== m.from));
                break;
            case "REQUEST_CLOSED":
                setSent((prev) => prev.filter((n) => n !== m.to));
                if (m.text) setNotice(m.text);
                break;
            case "NOT_AVAILABLE":
                setSent((prev) => prev.filter((n) => n !== m.to));
                setGatePrompt(null);
                setNotice(m.to ? `${m.to} isn't available for messages right now.` : m.text);   // name, so you know WHO
                break;
            case "GATE_REQUIRED":
                setGatePrompt({ to: m.to, questions: m.questions, answers: m.questions.map(() => ""), error: "" });
                setNotice("");   // an old notice above the questions only confuses
                break;
            case "CHAT_OPEN":
                setChats((prev) =>
                    prev.some((c) => c.with === m.with)
                        ? prev.map((c) => (c.with === m.with ? { ...c, closed: false, note: "" } : c))
                        : [...prev, { with: m.with, messages: [], unread: 0, closed: false, note: "" }]
                );
                setSent((prev) => prev.filter((n) => n !== m.with));
                setRequests((prev) => prev.filter((r) => r.from !== m.with));
                setNotice(`💬 Chat with ${m.with} is open.`);
                break;
            case "DM": {
                const viewing = isTabOpen && activeChat === m.with;
                const mine = m.from === joinData.name;
                updateChat(m.with, (c) => ({
                    ...c,
                    messages: [...c.messages, m],
                    unread: viewing || mine ? c.unread : c.unread + 1,
                }));
                break;
            }
            case "CHAT_CLOSED":
                if (m.reason === "YOU") {
                    // 3d: keep the closed chat on screen, so it can still be reported for 30 min
                    updateChat(m.with, (c) => ({ ...c, closed: true, note: "You closed this chat." }));
                    setNotice(`Chat with ${m.with} closed.`);
                } else {
                    const note =
                        m.reason === "LEFT" ? `${m.with} left the room. This chat has ended.`
                        : m.reason === "CLOSED" ? `${m.with} closed this chat.`
                        : "This chat has ended.";
                    updateChat(m.with, (c) => ({ ...c, closed: true, note }));
                    setNotice(note);   // replace an old "chat is open" notice
                }
                break;
            case "DM_REPORTED":   // 3d
                updateChat(m.with, (c) => ({ ...c, closed: true, reported: true, note: m.text }));
                setNotice(m.text);
                break;
            case "DM_ERROR":
                setNotice(m.text);
                break;
            default:
                break;
        }
    }

    // ----- actions -----
    function requestDm(name) {
        const open = chats.find((c) => c.with === name && !c.closed);
        if (open) {
            openChatView(name);
            return;
        }
        publish({ type: "REQUEST", to: name });
    }

    function setGateAnswer(i, value) {
        setGatePrompt((g) => ({ ...g, answers: g.answers.map((a, j) => (j === i ? value : a)), error: "" }));
    }

    function submitGate() {
        if (gatePrompt.answers.some((a) => !a.trim())) {
            setGatePrompt((g) => ({ ...g, error: "Please answer every question." }));
            return;
        }
        publish({ type: "REQUEST", to: gatePrompt.to, answers: gatePrompt.answers });
    }

    function openChatView(name) {
        setActiveChat(name);
        updateChat(name, (c) => ({ ...c, unread: 0 }));
    }

    function dismissChat(name) {
        setChats((prev) => prev.filter((c) => c.with !== name));
        if (activeChat === name) setActiveChat(null);
    }

    const unreadCount = requests.length + chats.reduce((n, c) => n + c.unread, 0);

    return {
        requests, sent, chats, activeChat, notice, gatePrompt, settings, unreadCount,
        handleIncoming, sendSettings, saveSettings, reset,
        requestDm, setGateAnswer, submitGate, cancelGate: () => setGatePrompt(null),
        cancelRequest: (name) => publish({ type: "CANCEL", to: name }),
        accept: (name) => publish({ type: "ACCEPT", to: name }),
        decline: (name) => publish({ type: "DECLINE", to: name }),
        sendDm: (name, text) => publish({ type: "SEND", to: name, text }),
        closeChat: (name) => publish({ type: "CLOSE", to: name }),
        reportChat: (name, reason) => publish({ type: "REPORT", to: name, reason }),   // 3d
        openChatView, closeChatView: () => setActiveChat(null), dismissChat,
        clearNotice: () => setNotice(""),
    };
}

// ===================== the ✉️ Messages tab =====================

const box = { padding: 10, border: "1px solid #ddd", borderRadius: 8, marginBottom: 10, textAlign: "left" };
const small = { fontSize: 12, color: "#666", margin: "2px 0" };
const sectionTitle = { margin: "12px 0 6px", fontSize: 14 };

export function DmPanel({ dm, room, myName, myGender }) {
    const [showSettings, setShowSettings] = useState(false);
    const [draft, setDraft] = useState(dm.settings);
    const [text, setText] = useState("");
    const [reportReason, setReportReason] = useState(null);   // 3d: null = report box hidden

    const chat = dm.chats.find((c) => c.with === dm.activeChat);

    // ---------- one open conversation ----------
    if (chat) {
        return (
            <div style={{ textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <button onClick={dm.closeChatView}>← Back</button>
                    <strong>💬 {titledName(room, chat.with)}</strong>
                    <span>
                        {!chat.reported && chat.messages.some((m) => m.from === chat.with) && (
                            <button title="Report this chat" onClick={() => setReportReason("")}>🚩</button>
                        )}{" "}
                        {chat.closed ? (
                            <button onClick={() => dm.dismissChat(chat.with)}>Remove</button>
                        ) : (
                            <button onClick={() => dm.closeChat(chat.with)}>Close chat</button>
                        )}
                    </span>
                </div>
                {reportReason !== null && !chat.reported && (
                    <div style={{ ...box, background: "#fff5f5" }}>
                        <p style={{ margin: "0 0 6px" }}>
                            🚩 Report {chat.with}? Mentors will see the last messages of this chat. The chat will end and{" "}
                            {chat.with} won't be able to message you again.
                        </p>
                        <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                            <option value="">Choose a reason…</option>
                            {DM_REPORT_REASONS.map((r) => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>{" "}
                        <button
                            disabled={!reportReason}
                            onClick={() => {
                                dm.reportChat(chat.with, reportReason);
                                setReportReason(null);
                            }}
                        >
                            Send report
                        </button>{" "}
                        <button onClick={() => setReportReason(null)}>Cancel</button>
                    </div>
                )}
                <p style={{ ...small, fontSize: 11 }}>Live chat: it ends when either of you leaves the room. Nothing is saved.</p>
                <div style={{ ...box, minHeight: 120 }}>
                    {chat.messages.length === 0 && <p style={small}>Say hi 👋</p>}
                    {chat.messages.map((m) => (
                        <p key={m.id} style={{ margin: "4px 0", textAlign: m.from === myName ? "right" : "left" }}>
                            <span
                                style={{
                                    display: "inline-block",
                                    padding: "4px 10px",
                                    borderRadius: 10,
                                    background: m.from === myName ? "#dbeafe" : "#f1f1f1",
                                    whiteSpace: "pre-line",
                                }}
                            >
                                {m.text}
                            </span>
                        </p>
                    ))}
                    {chat.closed && <p style={{ ...small, color: "#e74c3c" }}>{chat.note}</p>}
                </div>
                {!chat.closed && (
                    <div>
                        <input
                            type="text"
                            placeholder="Type a message"
                            value={text}
                            maxLength={1000}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && text.trim()) {
                                    dm.sendDm(chat.with, text);
                                    setText("");
                                }
                            }}
                        />
                        <button
                            onClick={() => {
                                if (!text.trim()) return;
                                dm.sendDm(chat.with, text);
                                setText("");
                            }}
                        >
                            Send
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ---------- the list view ----------
    return (
        <div style={{ textAlign: "left" }}>
            {dm.notice && (
                <div style={{ ...box, background: "#eef6ff", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13 }}>{dm.notice}</span>
                    <button onClick={dm.clearNotice} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button>
                </div>
            )}

            {/* Approach Gate: answer the other student's questions before the request goes */}
            {dm.gatePrompt && (
                <div style={{ ...box, borderColor: "#1F7AE0" }}>
                    <strong>✍️ {titledName(room, dm.gatePrompt.to)} asks a few questions first</strong>
                    <p style={{ ...small, marginTop: 4 }}>Answer all {dm.gatePrompt.questions.length} to send your request.</p>
                    {dm.gatePrompt.questions.map((q, i) => (
                        <div key={i} style={{ marginTop: 10 }}>
                            <p style={{ margin: "0 0 2px", fontSize: 13 }}>
                                <strong>Q{i + 1}.</strong> {q.text}
                            </p>
                            <p style={{ ...small, fontSize: 11, color: "#1F7AE0" }}>
                                {q.type === "MCQ" ? "👉 Choose one option" : "👉 Write your answer below"}
                            </p>
                            {q.type === "MCQ" ? (
                                q.options.map((o) => (
                                    <label key={o} style={{ display: "block", fontSize: 13 }}>
                                        <input
                                            type="radio"
                                            name={`gate-${i}`}
                                            checked={dm.gatePrompt.answers[i] === o}
                                            onChange={() => dm.setGateAnswer(i, o)}
                                        />{" "}
                                        {o}
                                    </label>
                                ))
                            ) : (
                                <textarea
                                    rows={2}
                                    style={{ width: "100%" }}
                                    maxLength={300}
                                    placeholder="✍️ Please write your answer here (max 300 characters)"
                                    value={dm.gatePrompt.answers[i]}
                                    onChange={(e) => dm.setGateAnswer(i, e.target.value)}
                                />
                            )}
                        </div>
                    ))}
                    {dm.gatePrompt.error && <p style={{ color: "#e74c3c", fontSize: 12 }}>{dm.gatePrompt.error}</p>}
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <button onClick={dm.submitGate}>Send request</button>
                        <button onClick={dm.cancelGate}>Cancel</button>
                    </div>
                </div>
            )}

            <h4 style={sectionTitle}>Requests ({dm.requests.length})</h4>
            {dm.requests.length === 0 && <p style={small}>No requests right now.</p>}
            {dm.requests.map((r) => {
                const stage = STAGES.find((s) => s.id === r.stage);
                return (
                    <div key={r.from} style={box}>
                        <strong>{titledName(room, r.from)}</strong>
                        <span style={{ ...small, marginLeft: 6 }}>· {r.gender}</span>
                        <p style={small}>
                            {[stage && stage.label, r.exam, r.city].filter(Boolean).join(" · ")}
                        </p>
                        {r.subject && <p style={small}>📖 Studying: {r.subject}</p>}
                        {r.bio && <p style={{ ...small, fontStyle: "italic" }}>"{r.bio}"</p>}
                        {r.answers && r.answers.map((qa, i) => (
                            <div key={i} style={{ marginTop: 6, padding: 6, background: "#eef6ff", borderRadius: 6, fontSize: 12 }}>
                                <div style={{ color: "#555" }}>{qa.question}</div>
                                <div><strong>{qa.answer}</strong></div>
                            </div>
                        ))}
                        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <button onClick={() => dm.accept(r.from)}>Accept</button>
                            <button onClick={() => dm.decline(r.from)}>Not now</button>
                        </div>
                    </div>
                );
            })}

            <h4 style={sectionTitle}>Sent ({dm.sent.length})</h4>
            {dm.sent.length === 0 && <p style={small}>No requests waiting.</p>}
            {dm.sent.map((name) => (
                <p key={name} style={{ fontSize: 13, margin: "4px 0" }}>
                    {titledName(room, name)} · waiting…{" "}
                    <button onClick={() => dm.cancelRequest(name)} style={{ fontSize: 11 }}>Cancel</button>
                </p>
            ))}

            <h4 style={sectionTitle}>Chats ({dm.chats.length})</h4>
            {dm.chats.length === 0 && <p style={small}>Tap "✉️ Message" next to someone in Who's here to start.</p>}
            {dm.chats.map((c) => {
                const last = c.messages[c.messages.length - 1];
                return (
                    <div
                        key={c.with}
                        onClick={() => dm.openChatView(c.with)}
                        style={{ ...box, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
                    >
                        <span>
                            <strong>{titledName(room, c.with)}</strong>
                            {last && <span style={{ fontSize: 12, color: "#666" }}> · {last.text.slice(0, 30)}</span>}
                        </span>
                        <span style={{ fontSize: 12 }}>
                            {c.closed ? <span style={{ color: "#999" }}>ended</span>
                                : c.unread > 0 ? <span style={{ color: "#e74c3c" }}>{c.unread} new</span> : ""}
                        </span>
                    </div>
                );
            })}

            {/* settings */}
            <div style={{ marginTop: 16 }}>
                <button onClick={() => { setDraft(dm.settings); setShowSettings((s) => !s); }}>
                    ⚙️ DM settings {showSettings ? "▲" : "▼"}
                </button>
                {showSettings && (
                    <SettingsEditor
                        draft={draft}
                        setDraft={setDraft}
                        hasGender={!!myGender}
                        onSave={() => { dm.saveSettings(draft); setShowSettings(false); }}
                    />
                )}
            </div>
        </div>
    );
}

// shows the student choosing a question exactly what the other person will have to do
function GatePreview({ q }) {
    if (q.id === CUSTOM_ID) {
        return <p style={{ ...small, fontSize: 11 }}>They will write their own answer (max 300 characters).</p>;
    }
    const g = GATE_QUESTIONS.find((x) => x.id === q.id);
    if (!g) return null;
    if (g.type === "MCQ") {
        return (
            <p style={{ ...small, fontSize: 11 }}>
                They will choose one: {g.options.join(" / ")}
            </p>
        );
    }
    return <p style={{ ...small, fontSize: 11 }}>They will write their own answer (max 300 characters).</p>;
}

function SettingsEditor({ draft, setDraft, hasGender, onSave }) {
    const set = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

    function setQuestion(i, value) {
        set("gate", draft.gate.map((q, j) => (j === i ? { id: value, text: "" } : q)));
    }
    function setCustom(i, value) {
        set("gate", draft.gate.map((q, j) => (j === i ? { ...q, text: value } : q)));
    }

    return (
        <div style={{ ...box, marginTop: 8 }}>
            <label style={{ display: "block", fontSize: 13 }}>
                <input type="checkbox" checked={draft.privacy} onChange={(e) => set("privacy", e.target.checked)} />{" "}
                🔒 Privacy Mode: no one can send me a request (I can still message others)
            </label>

            <div style={{ marginTop: 8, fontSize: 13 }}>
                Requests from:{" "}
                <select
                    value={draft.sameGenderOnly ? "same" : "all"}
                    onChange={(e) => set("sameGenderOnly", e.target.value === "same")}
                    disabled={!hasGender}
                >
                    <option value="all">Everyone</option>
                    <option value="same">Same gender only</option>
                </select>
                {!hasGender && <p style={small}>To use this, choose your gender in the join form (it stays private).</p>}
            </div>

            <label style={{ display: "block", fontSize: 13, marginTop: 8 }}>
                <input type="checkbox" checked={draft.gateOn} onChange={(e) => set("gateOn", e.target.checked)} />{" "}
                ✍️ Approach Gate: people answer my questions before their request reaches me
            </label>

            {draft.gateOn && (
                <div style={{ marginTop: 6 }}>
                    <p style={small}>
                        Choose up to 3 questions. Anyone who wants to message you must answer all of them first.
                        [MCQ] = they pick one option · [Text] = they write their own answer.
                    </p>
                    {draft.gate.map((q, i) => (
                        <div key={i} style={{ marginBottom: 10 }}>
                            <p style={{ margin: "4px 0 2px", fontSize: 12 }}><strong>Q{i + 1}</strong></p>
                            <select value={q.id} onChange={(e) => setQuestion(i, e.target.value)} style={{ maxWidth: "100%" }}>
                                {GATE_QUESTIONS.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.type === "MCQ" ? "[MCQ] " : "[Text] "}{g.text}
                                    </option>
                                ))}
                                <option value={CUSTOM_ID}>[Text] ➕ My own question</option>
                            </select>
                            <GatePreview q={q} />
                            {q.id === CUSTOM_ID && (
                                <input
                                    type="text"
                                    placeholder="Your question (max 150 characters)"
                                    maxLength={150}
                                    value={q.text || ""}
                                    onChange={(e) => setCustom(i, e.target.value)}
                                    style={{ width: "100%" }}
                                />
                            )}
                            <button
                                onClick={() => set("gate", draft.gate.filter((_, j) => j !== i))}
                                style={{ fontSize: 11 }}
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    {draft.gate.length < 3 && (
                        <button onClick={() => set("gate", [...draft.gate, { id: "t-stuck" }])} style={{ fontSize: 12 }}>
                            + Add question
                        </button>
                    )}
                </div>
            )}

            <div style={{ marginTop: 10 }}>
                <button onClick={onSave}>Save</button>
            </div>
        </div>
    );
}
