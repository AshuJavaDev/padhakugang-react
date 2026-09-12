import { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import React from "react";

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

function StudyRoom() {
    const [joined, setJoined] = useState(false);

    const [joinData, setJoinData] = useState({
        name: "",
        mood: "",
        exam: "",
        college: "",
        city: "",
        subject: "",
        bio: "",
        lookingFor: "",
        room: ROOMS[0].id,
    });

    const [messages, setMessages] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [messageInput, setMessageInput] = useState("");
    const [uploading, setUploading] = useState(false);
    const stompClientRef = useRef(null);
    const fileInputRef = useRef(null);

    function updateField(field, value) {
        setJoinData((prev) => ({ ...prev, [field]: value }));
    }

    function handleJoin() {
        if (!joinData.name.trim()) return;
        setJoined(true);
    }

    useEffect(() => {
        if (!joined) return;

        fetch(`http://localhost:8080/api/rooms/${joinData.room}/participants`)
            .then((res) => res.json())
            .then((data) => {
                setParticipants(data);
            })
            .catch((err) => {
                console.error("Failed to fetch participants:", err);
            });

            fetch(`http://localhost:8080/api/rooms/${joinData.room}/messages`)
            .then((res) => res.json())
            .then((data) => {
                setMessages(data);
            })
            .catch((err) => {
                console.error("Failed to fetch message history:", err);
            });

        const stompClient = new Client({
            webSocketFactory: () => new SockJS("http://localhost:8080/ws"),
            reconnectDelay: 5000,
            onConnect: () => {
                stompClient.subscribe(`/topic/room/${joinData.room}`, (message) => {
                    const received = JSON.parse(message.body);

                    if (received.type === "JOIN") {
                        setParticipants((prev) => {
                            const exists = prev.some(
                                (p) => p.studentName === received.studentName
                            );
                            if (exists) return prev;
                            return [...prev, received];
                        });
                    } else if (received.type === "LEAVE") {
                        setParticipants((prev) =>
                            prev.filter((p) => p.studentName !== received.studentName)
                        );
                    } else {
                        // Covers both CHAT and FILE message types
                        setMessages((prev) => [...prev, received]);
                    }
                });

                const joinMessage = {
                    type: "JOIN",
                    studentName: joinData.name,
                    roomId: joinData.room,
                    mood: joinData.mood,
                    exam: joinData.exam,
                    college: joinData.college,
                    city: joinData.city,
                    subject: joinData.subject,
                    bio: joinData.bio,
                    lookingFor: joinData.lookingFor,
                };

                stompClient.publish({
                    destination: `/app/chat/${joinData.room}`,
                    body: JSON.stringify(joinMessage),
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
            type: "CHAT",
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

    function handleAttachClick() {
        fileInputRef.current.click();
    }

    async function handleFileChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(
                `http://localhost:8080/api/files/upload/${joinData.room}`,
                {
                    method: "POST",
                    body: formData,
                }
            );

            if (!res.ok) {
                const errorData = await res.json();
                alert(errorData.error || "Upload failed");
                setUploading(false);
                return;
            }

            const data = await res.json();

            const fileMessage = {
                type: "FILE",
                studentName: joinData.name,
                roomId: joinData.room,
                content: data.fileName,
                fileUrl: data.downloadUrl,
            };

            stompClientRef.current.publish({
                destination: `/app/chat/${joinData.room}`,
                body: JSON.stringify(fileMessage),
            });
        } catch (err) {
            console.error("Upload error:", err);
            alert("Upload failed. Please try again.");
        }

        setUploading(false);
        e.target.value = "";
    }

    const currentMood = MOODS.find((m) => m.id === joinData.mood);

    if (!joined) {
        return (
            <div style={{ maxWidth: 420, margin: "0 auto" }}>
                <h2>Join a Study Room</h2>

                <input
                    type="text"
                    placeholder="Your name *"
                    value={joinData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                />

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

                <div style={{ marginTop: 10 }}>
                    <input
                        type="text"
                        placeholder="Name of upcoming exam preparing for"
                        value={joinData.exam}
                        onChange={(e) => updateField("exam", e.target.value)}
                    />
                </div>

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
        <div style={{ display: "flex", maxWidth: 700, margin: "0 auto", gap: 20 }}>
            {/* LEFT: Chat */}
            <div style={{ flex: 2 }}>
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
                    {messages.map((msg, index) => {
                        if (msg.type === "FILE") {
                            return (
                                <p key={index}>
                                    <strong>{msg.studentName}: </strong>
                                    shared a file —{" "}
                                    {React.createElement(
                                        "a",
                                        {
                                        href: `http://localhost:8080${msg.fileUrl}`,
                                        target: "_blank",
                                        rel: "noreferrer",
                                      },
                                        msg.content
                                        )}
                                </p>
                            );
                        }
                        return (
                            <p key={index}>
                                <strong>{msg.studentName}: </strong> {msg.content}
                            </p>
                        );
                    })}
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept="image/png,image/jpeg,application/pdf"
                    onChange={handleFileChange}
                />
                <button
                    onClick={handleAttachClick}
                    disabled={uploading}
                    style={{ marginRight: 6 }}
                    title="Attach image or PDF"
                >
                    📎
                </button>
                <input
                    type="text"
                    placeholder="Type a message"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                />
                <button onClick={handleSend}>Send</button>
                {uploading && <p style={{ fontSize: 12, color: "#888" }}>Uploading...</p>}
            </div>

            {/* RIGHT: Who's in this room */}
            <div style={{ flex: 1, borderLeft: "1px solid #ddd", paddingLeft: 16 }}>
                <h4>Who's here ({participants.length})</h4>
                {participants.map((p, index) => {
                    const pMood = MOODS.find((m) => m.id === p.mood);
                    return (
                        <div
                            key={index}
                            style={{
                                marginBottom: 12,
                                paddingBottom: 8,
                                borderBottom: "1px solid #eee",
                            }}
                        >
                            <strong>{p.studentName}</strong>
                            {pMood && (
                                <span
                                    title={pMood.label}
                                    style={{
                                        display: "inline-block",
                                        width: 10,
                                        height: 10,
                                        borderRadius: "50%",
                                        background: pMood.color,
                                        marginLeft: 6,
                                    }}
                                />
                            )}
                            {p.exam && (
                                <p style={{ fontSize: 12, margin: "2px 0" }}>📘 {p.exam}</p>
                            )}
                            {p.college && (
                                <p style={{ fontSize: 12, margin: "2px 0" }}>🎓 {p.college}</p>
                            )}
                            {p.city && (
                                <p style={{ fontSize: 12, margin: "2px 0" }}>📍 {p.city}</p>
                            )}
                            {p.subject && (
                                <p style={{ fontSize: 12, margin: "2px 0" }}>
                                    📖 Studying: {p.subject}
                                </p>
                            )}
                            {p.bio && (
                                <p style={{ fontSize: 12, margin: "2px 0", fontStyle: "italic" }}>
                                    "{p.bio}"
                                </p>
                            )}
                            {p.lookingFor && (
                                <p style={{ fontSize: 12, margin: "2px 0", color: "#3498db" }}>
                                    🎯 {p.lookingFor}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default StudyRoom;