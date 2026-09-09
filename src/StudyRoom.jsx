import { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// Admin-defined rooms (hardcoded for now — later can come from backend/admin panel)
const ROOMS = [
    { id: "bpsc-teacher", label: "BPSC Teacher Prep" },
    { id: "bihar-police", label: "Bihar Police / Daroga" },
    { id: "railway-rrb", label: "Railway RRB" },
];

const MOODS = [
    { id: "awesome", label: "Awesome", color: "#2ecc71" },
    { id: "just-ok", label: "Just ok", color: "#3498db" },
    { id: "ok-ok", label: "Ok ok", color: "#f1c40f" },
    { id: "very-sad", label: "Very sad", color: "#e74c3c" },
];

const LOOKING_FOR_OPTIONS = [
    "Just here to focus",
    "Need a study partner",
    "Open to doubt-solving",
];

const EXAM_OPTIONS = [
    "BPSC Teacher",
    "Bihar Police Constable",
    "Bihar Police Daroga",
    "Railway RRB",
    "Other",
];

function StudyRoom() {
    const [joined, setJoined] = useState(false);

    // All join form fields live in one object — easier to manage than 8 separate useStates
    const [joinData, setJoinData] = useState({
        name: "",
        mood: "",
        exam: "",
        examOther: "",
        college: "",
        city: "",
        subject: "",
        bio: "",
        lookingFor: "",
        room: ROOMS[0].id, // default to first room
    });

    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState("");
    const stompClientRef = useRef(null);

    function updateField(field, value) {
        setJoinData((prev) => ({ ...prev, [field]: value }));
    }

    function handleJoin() {
        if (!joinData.name.trim()) return;
        setJoined(true);
    }

    useEffect(() => {
        if (!joined) return;

        const stompClient = new Client({
            webSocketFactory: () => new SockJS("http://localhost:8080/ws"),
            reconnectDelay: 5000,
            onConnect: () => {
                stompClient.subscribe(`/topic/room/${joinData.room}`, (message) => {
                    const received = JSON.parse(message.body);
                    setMessages((prev) => [...prev, received]);
                });
            },
        });

        stompClient.activate();
        stompClientRef.current = stompClient;

        return () => {
            stompClient.deactivate();
        };
    }, [joined, joinData.room]);

    function handleSend() {
        if (!messageInput.trim()) return;

        const chatMessage = {
            studentName: joinData.name,
            content: messageInput,
            roomId: joinData.room,
        };

        stompClientRef.current.publish({
            destination: `/app/chat/${joinData.room}`,
            body: JSON.stringify(chatMessage),
        });

        setMessageInput("");
    }

    const currentMood = MOODS.find((m) => m.id === joinData.mood);

    if (!joined) {
        return (
            <div style={{ maxWidth: 420, margin: "0 auto" }}>
                <h2>Join a Study Room</h2>

                {/* Required */}
                <input
                    type="text"
                    placeholder="Your name *"
                    value={joinData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                />

                {/* Room selection */}
                <div style={{ marginTop: 10 }}>
                    <label>Room: </label>
                    <select
                        value={joinData.room}
                        onChange={(e) => updateField("room", e.target.value)}
                    >
                        {ROOMS.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Mood quick-select */}
                <div style={{ marginTop: 10 }}>
                    <label>Mood today: </label>
                    {MOODS.map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => updateField("mood", m.id)}
                            style={{
                                marginRight: 6,
                                border:
                                    joinData.mood === m.id
                                        ? "2px solid black"
                                        : "1px solid #ccc",
                                background: m.color,
                                color: "white",
                            }}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Exam preparing for */}
                <div style={{ marginTop: 10 }}>
                    <label>Exam preparing for: </label>
                    <select
                        value={joinData.exam}
                        onChange={(e) => updateField("exam", e.target.value)}
                    >
                        <option value="">-- Select --</option>
                        {EXAM_OPTIONS.map((ex) => (
                            <option key={ex} value={ex}>
                                {ex}
                            </option>
                        ))}
                    </select>
                    {joinData.exam === "Other" && (
                        <input
                            type="text"
                            placeholder="Which exam?"
                            value={joinData.examOther}
                            onChange={(e) => updateField("examOther", e.target.value)}
                            style={{ marginLeft: 6 }}
                        />
                    )}
                </div>

                {/* Free text fields */}
                <div style={{ marginTop: 10 }}>
                    <input
                        type="text"
                        placeholder="College / University"
                        value={joinData.college}
                        onChange={(e) => updateField("college", e.target.value)}
                    />
                </div>
                <div style={{ marginTop: 10 }}>
                    <input
                        type="text"
                        placeholder="City / State"
                        value={joinData.city}
                        onChange={(e) => updateField("city", e.target.value)}
                    />
                </div>
                <div style={{ marginTop: 10 }}>
                    <input
                        type="text"
                        placeholder="Subject/topic studying right now"
                        value={joinData.subject}
                        onChange={(e) => updateField("subject", e.target.value)}
                    />
                </div>
                <div style={{ marginTop: 10 }}>
                    <input
                        type="text"
                        placeholder="One-line bio"
                        value={joinData.bio}
                        onChange={(e) => updateField("bio", e.target.value)}
                    />
                </div>

                {/* Looking for */}
                <div style={{ marginTop: 10 }}>
                    <label>Looking for: </label>
                    <select
                        value={joinData.lookingFor}
                        onChange={(e) => updateField("lookingFor", e.target.value)}
                    >
                        <option value="">-- Select --</option>
                        {LOOKING_FOR_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>

                <div style={{ marginTop: 16 }}>
                    <button onClick={handleJoin}>Join</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <h2>
                Welcome, {joinData.name}!
                {currentMood && (
                    <span
                        title={currentMood.label}
                        style={{
                            display: "inline-block",
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: currentMood.color,
                            marginLeft: 8,
                        }}
                    />
                )}
            </h2>
            <p style={{ fontSize: 12, color: "#666" }}>
                Room: {ROOMS.find((r) => r.id === joinData.room)?.label}
            </p>

            <div>
                {messages.map((msg, index) => (
                    <p key={index}>
                        <strong>{msg.studentName}: </strong> {msg.content}
                    </p>
                ))}
            </div>

            <input
                type="text"
                placeholder="Type a message"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
            />
            <button onClick={handleSend}>Send</button>
        </div>
    );
}

export default StudyRoom;