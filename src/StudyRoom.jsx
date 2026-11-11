import { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import React from "react";
import { saveCode } from "./savedCodes";
import { ROOMS, STAGES, roomLabel, canJoin, roomsForStage, openToText, titledName } from "./rooms";   // #2 + #2c
import { useDm, DmPanel } from "./DmPanel";   // #3 DM
import { API_URL } from "./config";   // deploy: backend address in one place



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

// #1: gender — private (never broadcast), required only for "Need a study partner"
const GENDERS = ["Female", "Male", "Other"];

// E3 step 2: report reasons (ids must match the backend list)
const REPORT_REASONS = [
    { id: "SPAM", label: "Spam" },
    { id: "ABUSE", label: "Abusive or inappropriate" },
    { id: "ILLEGAL", label: "Illegal or dangerous" },
    { id: "DANGER", label: "Someone may be in danger" },
    { id: "OTHER", label: "Other" },
];

// #2b: remember the join form on this device (mood is never saved — it's picked fresh each day)
const SAVED_PROFILE_KEY = "pg_join_profile";

const EMPTY_JOIN = {
    name: "",
    mood: "",
    exam: "",
    college: "",
    city: "",
    subject: "",
    bio: "",
    lookingFor: "",
    room: "",         // #2: student picks the exam room first
    stage: "",        // #1
    gender: "",       // #1 (private)
    agreed: false,    // #1 T&C checkbox
};

// MUST #4 same-name fix: a secret random code for THIS browser. Sent with JOIN, never shown to anyone.
// Same code + same name = same person (reload / new tab). Another device using the name gets "Name NN".
const DEVICE_KEY = "pg_device";
// "Rahul 27" remembered for THIS tab only, so a page reload (or a phone reopening the tab) keeps the same number
const GIVEN_NAME_KEY = "pg_given_name";
// Upload rules accepted on this device (bump the version if the wording changes, so everyone confirms again)
const UPLOAD_RULES_KEY = "pg_upload_rules_v1";

function getDeviceCode() {
    try {
        let code = localStorage.getItem(DEVICE_KEY);
        if (!code) {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);   // works on http too (randomUUID needs https)
            code = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
            localStorage.setItem(DEVICE_KEY, code);
        }
        return code;
    } catch (e) {
        return null;   // storage blocked → server treats every visit as a new device
    }
}

// Upload helper: shrink a photo before upload (longest side 1600 px, JPEG ~80% quality).
// Keeps the original if the shrunk copy isn't smaller or anything fails.
async function shrinkImage(file) {
    if (file.size < 300 * 1024) return file;                 // already small
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";                            // PNG transparency → white, not black
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
        if (!blob || blob.size >= file.size) return file;
        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
    } catch (e) {
        return file;                                          // old browser → upload the original
    }
}

function readSavedProfile() {
    try {
        const raw = localStorage.getItem(SAVED_PROFILE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;   // storage blocked or broken data → just start empty
    }
}


function StudyRoom() {
    const [joined, setJoined] = useState(false);

    // #2b: start with the saved details (if any), but always with an empty mood
    const [joinData, setJoinData] = useState(() => ({
        ...EMPTY_JOIN,
        ...(readSavedProfile() || {}),
        mood: "",
    }));

    const [remember, setRemember] = useState(true);   // #2b
    const [joinError, setJoinError] = useState("");   // #1: small red message instead of a popup
    const [messages, setMessages] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [messageInput, setMessageInput] = useState("");
    const [uploading, setUploading] = useState(false);
    const [questionText, setQuestionText] = useState("");
    const [questionPrivate, setQuestionPrivate] = useState(false);
    const [askingMentor, setAskingMentor] = useState(false);
    const [myQuestion, setMyQuestion] = useState(null);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState("chat");
    const [mentorAnswers, setMentorAnswers] = useState([]);
    const [answersPage, setAnswersPage] = useState(0);
    const [hasOlderAnswers, setHasOlderAnswers] = useState(false);
    const [unreadAnswers, setUnreadAnswers] = useState(0);
    const [connected, setConnected] = useState(false);
    const [reportFor, setReportFor] = useState(null);
    const [reportReason, setReportReason] = useState("SPAM");
    const stompClientRef = useRef(null);
    const myNameRef = useRef("");                       // MUST #4: the name the SERVER gave me (may be "Rahul 27")
    const [nameNotice, setNameNotice] = useState("");   // "Rahul is already in this room, so you joined as Rahul 27"
    const fileInputRef = useRef(null);

    // race fix: who joined / left while the participants fetch was on its way
    const joinedDuringFetch = useRef(new Map());   // name → participant
    const leftDuringFetch = useRef(new Set());     // names

    // #3 DM: all DM state lives in useDm; the ref gives WebSocket callbacks the latest version
    const dm = useDm({ stompClientRef, joinData, isTabOpen: activeTab === "messages" });
    const dmRef = useRef(dm);
    dmRef.current = dm;

    function updateField(field, value) {
        setJoinData((prev) => ({ ...prev, [field]: value }));
        setJoinError("");   // #1: clear the message as soon as the student edits
    }

    // #2b: forget the saved details (for shared computers in libraries / cafés)
    function clearSavedProfile() {
        try {
            localStorage.removeItem(SAVED_PROFILE_KEY);
            localStorage.removeItem(DEVICE_KEY);   // MUST #4: next person on this computer = a new device code
            localStorage.removeItem(UPLOAD_RULES_KEY);   // next person confirms the upload rules themselves
        } catch (e) {
            // ignore
        }
        setJoinData(EMPTY_JOIN);
        setJoinError("");
    }

    // #1 + #2: check the required fields and the room's "open to" list before joining
    function handleJoin() {
        if (!joinData.name.trim()) {
            setJoinError("Please enter your name.");
            return;
        }
        if (!joinData.room) {
            setJoinError("Please choose the exam room you want to join.");
            return;
        }
        if (!joinData.stage) {
            setJoinError("Please choose your class / stage.");
            return;
        }
        if (!canJoin(joinData.room, joinData.stage)) {
            const options = roomsForStage(joinData.stage).map((r) => r.label).join(", ");
            setJoinError(
                `${roomLabel(joinData.room)} is open to: ${openToText(joinData.room)}. ` +
                `For your stage you can join: ${options}.`
            );
            return;
        }
        if (joinData.lookingFor === "Need a study partner" && !joinData.gender) {
            setJoinError("Please choose your gender — it is needed to find a study partner.");
            return;
        }
        if (!joinData.agreed) {
            setJoinError("Please agree to the Terms and Conditions to join.");
            return;
        }

        // #2b: save (or forget) the details on this device — everything except today's mood
        try {
            if (remember) {
                const { mood, ...toSave } = joinData;
                localStorage.setItem(SAVED_PROFILE_KEY, JSON.stringify(toSave));
            } else {
                localStorage.removeItem(SAVED_PROFILE_KEY);
            }
        } catch (e) {
            // storage blocked → joining still works
        }

        setJoinError("");
        myNameRef.current = joinData.name.trim();   // MUST #4: the server may still change it (NAME_ASSIGNED)
        setNameNotice("");
        // MUST #4: this tab was "Rahul 27" in this room before a reload → come back as "Rahul 27", not a new number
        try {
            const given = JSON.parse(sessionStorage.getItem(GIVEN_NAME_KEY) || "null");
            if (given && given.room === joinData.room && given.asked === myNameRef.current) {
                myNameRef.current = given.given;
                setJoinData((prev) => ({ ...prev, name: given.given }));
            }
        } catch (e) {
            // storage blocked → a new number is fine
        }
        setJoined(true);
    }

    function loadAnswers(page) {
        fetch(`${API_URL}/api/rooms/${joinData.room}/answers?page=${page}`)
            .then((res) => res.json())
            .then((data) => {
                // page 0 = fresh list, later pages = add below the old ones
                setMentorAnswers((prev) => (page === 0 ? data : [...prev, ...data]));
                setAnswersPage(page);
                setHasOlderAnswers(data.length === 20);   // a full page means there may be more
            })
            .catch((err) => {
                console.error("Failed to fetch mentor answers:", err);
            });
    }

    function switchTab(tab) {
        if (tab === "mentor" || activeTab === "mentor") {
            setUnreadAnswers(0);
        }
        setActiveTab(tab);
    }

    function loadRoomData() {
        // start a fresh diary for this fetch
        joinedDuringFetch.current.clear();
        leftDuringFetch.current.clear();

        fetch(`${API_URL}/api/rooms/${joinData.room}/participants`)
            .then((res) => res.json())
            .then((data) => {
                // snapshot from the server, then replay what happened while it was travelling
                let list = data.filter((p) => !leftDuringFetch.current.has(p.studentName));
                joinedDuringFetch.current.forEach((p, name) => {
                    if (!list.some((x) => x.studentName === name)) list.push(p);
                });
                setParticipants(list);
            })
            .catch((err) => {
                console.error("Failed to fetch participants:", err);
            });

        fetch(`${API_URL}/api/rooms/${joinData.room}/messages`)
            .then((res) => res.json())
            .then((data) => {
                setMessages(data.filter((m) => m.type === "CHAT" || m.type === "FILE" || m.type === "MENTOR_CHAT"));
            })
            .catch((err) => {
                console.error("Failed to fetch message history:", err);
            });

        loadAnswers(0);
    }

    useEffect(() => {
        if (!joined) return;

        const stompClient = new Client({
            webSocketFactory: () => new SockJS(`${API_URL}/ws`),
            reconnectDelay: 5000,
            onWebSocketClose: () => setConnected(false),
            onConnect: () => {
                setConnected(true);
                dmRef.current.reset();   // #3: new connection = new server session → old DMs are gone

                // #3: my private letterbox — only this connection receives what lands here
                stompClient.subscribe("/user/queue/dm", (message) => {
                    dmRef.current.handleIncoming(JSON.parse(message.body));
                });

                // MUST #4: mute / kick / join-denied now arrive ONLY here (private), no longer on the room topic
                stompClient.subscribe("/user/queue/notice", (message) => {
                    const notice = JSON.parse(message.body);
                    if (notice.type === "MUTE_NOTICE") {
                        alert(notice.content);
                    } else if (notice.type === "KICK") {
                        alert(notice.content || "You have been removed from this room by a mentor.");   // wording comes from the server
                        setMessages([]);
                        setParticipants([]);
                        setJoined(false);
                    } else if (notice.type === "NAME_ASSIGNED") {
                        // MUST #4: my name was taken by someone else → the server gave me "Name NN".
                        // From now on this is "me" everywhere (Welcome, my messages, DMs, reports, reconnects).
                        try {
                            sessionStorage.setItem(GIVEN_NAME_KEY, JSON.stringify({
                                room: joinData.room, asked: myNameRef.current, given: notice.studentName,
                            }));
                        } catch (e) {
                            // ignore
                        }
                        myNameRef.current = notice.studentName;
                        setJoinData((prev) => ({ ...prev, name: notice.studentName }));
                        if (notice.content) setNameNotice(notice.content);
                    } else if (notice.type === "JOIN_DENIED") {
                        setMessages([]);
                        setParticipants([]);
                        setJoinError(notice.content);
                        setJoined(false);
                    }
                });

                stompClient.subscribe(`/topic/room/${joinData.room}`, (message) => {
                    const received = JSON.parse(message.body);

                    if (received.type === "JOIN") {
                        joinedDuringFetch.current.set(received.studentName, received);
                        leftDuringFetch.current.delete(received.studentName);
                        setParticipants((prev) => {
                            const exists = prev.some(
                                (p) => p.studentName === received.studentName
                            );
                            if (exists) return prev;
                            return [...prev, received];
                        });
                    } else if (received.type === "LEAVE") {
                        leftDuringFetch.current.add(received.studentName);
                        joinedDuringFetch.current.delete(received.studentName);
                        setParticipants((prev) =>
                            prev.filter((p) => p.studentName !== received.studentName)
                        );
                    } else if (received.type === "MENTOR_ANSWER") {
                        loadAnswers(0);                       // refresh the Mentor tab list
                        setUnreadAnswers((n) => n + 1);       // red dot on the tab
                    } else if (received.type === "CHAT" || received.type === "FILE" || received.type === "MENTOR_CHAT") {
                        setMessages((prev) => [...prev, received]);
                    }
                });

                const joinMessage = {
                    type: "JOIN",
                    studentName: myNameRef.current || joinData.name,   // MUST #4: on reconnect keep "Rahul 27"
                    deviceCode: getDeviceCode(),                       // MUST #4: secret, never broadcast
                    roomId: joinData.room,
                    mood: joinData.mood,
                    exam: joinData.exam,
                    college: joinData.college,
                    city: joinData.city,
                    subject: joinData.subject,
                    bio: joinData.bio,
                    lookingFor: joinData.lookingFor,
                    stage: joinData.stage,   // #1 (gender is NOT sent — it stays private)
                };

                stompClient.publish({
                    destination: `/app/chat/${joinData.room}`,
                    body: JSON.stringify(joinMessage),
                });
                dmRef.current.sendSettings();   // #3: private DM settings (incl. gender) — never in the JOIN above
                loadRoomData();   // runs on first connect AND on every reconnect
            },
        });

        stompClient.activate();
        stompClientRef.current = stompClient;

        return () => {
            stompClient.deactivate();
        };
    }, [joined, joinData.room]);


    // E3 step 2: send a report for one message (only its server id, never the text)
    async function submitReport(messageId) {
        try {
            const res = await fetch(`${API_URL}/api/rooms/${joinData.room}/reports`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId, reporterName: joinData.name, reason: reportReason }),
            });
            alert(await res.text());   // backend sends a plain-text answer, e.g. "Reported. Mentors will review it."
        } catch (err) {
            alert("Could not send the report. Please try again.");
        }
        setReportFor(null);
        setReportReason("SPAM");
    }


    // E3 step 2: 🚩 button + small reason box next to someone else's message
    function reportControls(msg) {
        if (!msg.id || msg.studentName === joinData.name) return null;

        if (reportFor !== msg.id) {
            return (
                <button
                    type="button"
                    title="Report this message"
                    onClick={() => setReportFor(msg.id)}
                    style={{ marginLeft: 6, fontSize: 11, border: "none", background: "transparent", cursor: "pointer" }}
                >
                    🚩
                </button>
            );
        }

        return (
            <span style={{ marginLeft: 6, fontSize: 12 }}>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                    {REPORT_REASONS.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                </select>{" "}
                <button type="button" onClick={() => submitReport(msg.id)}>Send</button>{" "}
                <button type="button" onClick={() => setReportFor(null)}>Cancel</button>
            </span>
        );
    }

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
        // Before the FIRST upload on this device: the student confirms the sharing rules (remembered after that)
        let agreed = false;
        try { agreed = localStorage.getItem(UPLOAD_RULES_KEY) === "yes"; } catch (e) { /* storage blocked → ask each time */ }
        if (!agreed) {
            const ok = window.confirm(
                "Before you share a file, please confirm:\n\n" +
                "✅ This is my own material, or it's free to share (my notes, PYQs, NCERT, government material).\n" +
                "✅ It is NOT a paid book, coaching material, or anything that breaks someone's copyright.\n" +
                "✅ It follows the room rules.\n\n" +
                "I am responsible for what I upload, and PadhakuGang may remove it if it breaks these rules.\n\n" +
                "Press OK to agree and choose a file."
            );
            if (!ok) return;
            try { localStorage.setItem(UPLOAD_RULES_KEY, "yes"); } catch (e) { /* ignore */ }
        }
        fileInputRef.current.click();
    }

    async function handleFileChange(e) {
        let file = e.target.files[0];
        e.target.value = "";   // so choosing the same file again still triggers onChange
        if (!file) return;

        // Check here first, so the student gets a clear message instead of a failed request
        if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type)) {
            alert("Only images (PNG, JPG) and PDFs can be shared.");
            return;
        }

        setUploading(true);

        // Photos are shrunk in the browser first (a 4 MB phone photo becomes ~0.5 MB, still sharp)
        if (file.type !== "application/pdf") {
            file = await shrinkImage(file);
        }

        const isPdf = file.type === "application/pdf";
        const limitMb = isPdf ? 20 : 5;
        if (file.size > limitMb * 1024 * 1024) {
            const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
            alert(
                `This file is ${sizeMb} MB (limit ${limitMb} MB).\n\n` +
                (isPdf
                    ? "Tip: compress it free at ilovepdf.com (Compress PDF), or share a link instead."
                    : "Tip: try a smaller photo or a screenshot, or share a link instead.")
            );
            setUploading(false);
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(
                `${API_URL}/api/files/upload/${joinData.room}`,
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

    async function handleAskMentor() {
        if (!questionText.trim()) return;

        setAskingMentor(true);

        try {
            const res = await fetch(
                `${API_URL}/api/rooms/${joinData.room}/questions`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        studentName: joinData.name,
                        questionText: questionText,
                        privateQuestion: questionPrivate,
                    }),
                }
            );

            if (!res.ok) {
                const errorText = await res.text();   // backend sends plain text on errors
                alert(errorText || "Could not send your question.");
                setAskingMentor(false);
                return;
            }

            const data = await res.json();
            setMyQuestion(data);          // saved question, includes statusCode
            saveCode(data.statusCode, data.questionText);   // remember on this device right away
            downloadSlip(data);           // slip downloads automatically
            setQuestionText("");
            setQuestionPrivate(false);
        } catch (err) {
            console.error("Ask mentor error:", err);
            alert("Could not send your question. Please try again.");
        }

        setAskingMentor(false);
    }

    function downloadSlip(question) {
        const canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = 370;
        const ctx = canvas.getContext("2d");

        // white background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 600, 370);

        // navy top band with brand name
        ctx.fillStyle = "#0B1F3A";
        ctx.fillRect(0, 0, 600, 70);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px Arial";
        ctx.fillText("PadhakuGang", 24, 38);

        // tagline under the brand name
        ctx.font = "italic 13px Arial";
        ctx.fillText("Study. Connect. Grow.", 24, 58);

        ctx.font = "16px Arial";
        ctx.fillText("Ask a Mentor", 450, 45);

        // the code, big and blue
        ctx.fillStyle = "#555555";
        ctx.font = "16px Arial";
        ctx.fillText("Your code", 24, 110);
        ctx.fillStyle = "#1F7AE0";
        ctx.font = "bold 44px Arial";
        ctx.fillText(question.statusCode, 24, 160);

        // details
        const slipRoomLabel = roomLabel(question.roomId);   // #2: shared helper from rooms.js

        // question in one clean line
        const fullText = (question.questionText || "").replace(/\s+/g, " ").trim();

        // friendlier date -> "6 Oct 2026, 1:07 pm"
        const created = new Date(question.createdAt).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        ctx.fillStyle = "#333333";
        ctx.font = "16px Arial";
        ctx.fillText("Code for: Ask a Mentor question (" + slipRoomLabel + ")", 24, 200);
        // fit the question inside the slip width (600 - 24 - 24 = 552px)
        let questionLine = "Question: " + fullText;
        if (ctx.measureText(questionLine).width > 552) {
            while (ctx.measureText(questionLine + "...").width > 552) {
                questionLine = questionLine.slice(0, -1);   // cut one character from the end
            }
            questionLine = questionLine.trimEnd() + "...";
        }
        ctx.fillText(questionLine, 24, 228);
        ctx.fillText("Created on: " + created, 24, 256);
        ctx.fillText("Mentors usually reply within 24 hours.", 24, 284);
        // website in brand blue, so it stands out
        const checkStart = "Check your answer: ";
        ctx.fillText(checkStart, 24, 312);
        const checkStartWidth = ctx.measureText(checkStart).width;
        ctx.fillStyle = "#1F7AE0";
        ctx.font = "bold 16px Arial";
        ctx.fillText("www.padhakugang.com", 24 + checkStartWidth, 312);
        const siteWidth = ctx.measureText("www.padhakugang.com").width;
        ctx.fillStyle = "#333333";
        ctx.font = "16px Arial";
        ctx.fillText(" > Check your code", 24 + checkStartWidth + siteWidth, 312);
        ctx.fillStyle = "#888888";
        ctx.font = "13px Arial";
        ctx.fillText(
            question.privateQuestion
                ? "Private question: only this code shows the answer."
                : "Public question: the answer will also appear in the room.",
            24, 346
        );

        // turn the board into a PNG and download it
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "PadhakuGang-" + question.statusCode + ".png";
        link.click();
    }

    async function handleCopyCode() {
        try {
            await navigator.clipboard.writeText(myQuestion.statusCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            alert("Could not copy. Please note your code: " + myQuestion.statusCode);
        }
    }

    const currentMood = MOODS.find((m) => m.id === joinData.mood);
    // Group answer rows of the same question (original + copies) into one card
    const answerGroups = [];
    const groupIndex = {};
    mentorAnswers.forEach((a) => {
        if (groupIndex[a.groupId] === undefined) {
            groupIndex[a.groupId] = answerGroups.length;
            answerGroups.push({ key: a.groupId, studentName: a.studentName, question: a.question, answers: [] });
        }
        answerGroups[groupIndex[a.groupId]].answers.push(a);
    });
    // inside each card: oldest answer first
    answerGroups.forEach((g) =>
        g.answers.sort((x, y) => new Date(x.answeredAt) - new Date(y.answeredAt))
    );

    if (!joined) {
        const hasSavedProfile = readSavedProfile() !== null;   // #2b
        return (
            <div style={{ maxWidth: 420, margin: "0 auto" }}>
                <h2>Join a Study Room</h2>

                <input
                    type="text"
                    placeholder="Your name *"
                    maxLength={40}
                    value={joinData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                />

                {/* #2: exam room first, with who it is open to */}
                <div style={{ marginTop: 10 }}>
                    <label>Exam room: * </label>
                    <select
                        value={joinData.room}
                        onChange={(e) => updateField("room", e.target.value)}
                    >
                        <option value="">-- Select --</option>
                        {ROOMS.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                    {joinData.room && (
                        <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>
                            👥 Open to: {openToText(joinData.room)}
                        </p>
                    )}
                </div>

                {/* #1: class / stage (required) */}
                <div style={{ marginTop: 10 }}>
                    <label>You are: * </label>
                    <select
                        value={joinData.stage}
                        onChange={(e) => updateField("stage", e.target.value)}
                    >
                        <option value="">-- Select --</option>
                        {STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.label}
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

                {/* #1: gender — private, required only for "Need a study partner" */}
                <div style={{ marginTop: 10 }}>
                    <label>
                        Gender{joinData.lookingFor === "Need a study partner" ? " *" : " (optional)"}:{" "}
                    </label>
                    <select
                        value={joinData.gender}
                        onChange={(e) => updateField("gender", e.target.value)}
                    >
                        <option value="">-- Select --</option>
                        {GENDERS.map((g) => (
                            <option key={g} value={g}>
                                {g}
                            </option>
                        ))}
                    </select>
                    <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0" }}>
                        Not shown to others in the room.
                    </p>
                </div>

                {/* #1: required Terms and Conditions checkbox */}
                <div style={{ marginTop: 12, fontSize: 13 }}>
                    <label>
                        <input
                            type="checkbox"
                            checked={joinData.agreed}
                            onChange={(e) => updateField("agreed", e.target.checked)}
                        />{" "}
                        I agree to all{" "}
                        {React.createElement(
                            "a",
                            { href: "/terms", target: "_blank", rel: "noreferrer" },
                            "Terms and Conditions"
                        )}{" "}
                        of the room and I have read it
                    </label>
                </div>

                {/* #2b: remember on this device + clear option for shared computers */}
                <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
                    <label>
                        <input
                            type="checkbox"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                        />{" "}
                        Remember my details on this device
                    </label>
                    {hasSavedProfile && (
                        <div>
                            <button
                                type="button"
                                onClick={clearSavedProfile}
                                style={{ marginTop: 4, fontSize: 11, border: "none", background: "transparent", color: "#1F7AE0", cursor: "pointer", textDecoration: "underline" }}
                            >
                                Not you? Clear saved details
                            </button>
                        </div>
                    )}
                </div>

                {import.meta.env.DEV && (
                    <div style={{ marginTop: 16 }}>
                        <button
                            type="button"
                            onClick={() =>
                                setJoinData({
                                    name: "Tester" + Math.floor(Math.random() * 100),
                                    mood: "awesome",
                                    exam: "SSC CGL",
                                    college: "Test College",
                                    city: "Dhanbad, Jharkhand",
                                    subject: "Reasoning",
                                    bio: "Just testing PadhakuGang",
                                    lookingFor: "Just here to focus",
                                    room: "ssc",
                                    stage: "graduate",   // #1
                                    gender: "",          // #1
                                    agreed: true,        // #1
                                })
                            }
                        >
                            ⚡ Fill test data (dev only)
                        </button>
                    </div>
                )}

                <div style={{ marginTop: 16 }}>
                    <button onClick={handleJoin} disabled={!joinData.agreed}>Join</button>
                    {joinError && (
                        <p style={{ color: "#e74c3c", fontSize: 13, margin: "6px 0 0" }}>{joinError}</p>
                    )}
                </div>
            </div>
        );
    }


    return (
        <div style={{ display: "flex", maxWidth: 700, margin: "0 auto", gap: 20 }}>

            {/* LEFT: tabs */}
            <div style={{ flex: 2 }}>
                <h2>
                    Welcome, {titledName(joinData.room, joinData.name)}!
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
                {/* MUST #4: my name was taken → explain the number once */}
                {nameNotice && (
                    <div
                        style={{
                            background: "#fff8e1",
                            border: "1px solid #f0c36d",
                            borderRadius: 6,
                            padding: "8px 12px",
                            margin: "0 0 10px",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                        }}
                    >
                        <span>ℹ️ {nameNotice}</span>
                        <button onClick={() => setNameNotice("")} title="Close">✕</button>
                    </div>
                )}

                <p style={{ fontSize: 12, color: "#666" }}>
                    Room: {roomLabel(joinData.room)}
                    {" · "}
                    <span style={{ color: connected ? "#2ecc71" : "#e74c3c", fontWeight: "bold" }}>
                        {connected ? "● Connected" : "● Reconnecting..."}
                    </span>
                </p>


                {import.meta.env.DEV && (
                    <button
                        type="button"
                        onClick={() => stompClientRef.current.forceDisconnect()}
                        style={{ fontSize: 11, marginBottom: 8 }}
                    >
                        🔌 Drop my connection (dev only)
                    </button>
                )}


                {/* tab buttons */}
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {[
                        { id: "chat", label: "💬 Chat" },
                        { id: "mentor", label: "🎓 Mentor" },
                        { id: "files", label: "📁 Files" },
                        { id: "messages", label: "✉️ Messages" },   // #3
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => switchTab(tab.id)}
                            style={{
                                flex: 1,
                                padding: "8px 4px",
                                border: "none",
                                borderBottom:
                                    activeTab === tab.id ? "3px solid #1F7AE0" : "3px solid #ddd",
                                background: "transparent",
                                fontWeight: activeTab === tab.id ? "bold" : "normal",
                                cursor: "pointer",
                            }}
                        >
                            {tab.label}
                            {tab.id === "mentor" && unreadAnswers > 0 && activeTab !== "mentor" && (
                                <span
                                    style={{
                                        marginLeft: 6,
                                        background: "#e74c3c",
                                        color: "white",
                                        borderRadius: 10,
                                        padding: "1px 7px",
                                        fontSize: 11,
                                    }}
                                >
                                    {unreadAnswers}
                                </span>
                            )}
                            {tab.id === "messages" && dm.unreadCount > 0 && activeTab !== "messages" && (
                                <span
                                    style={{
                                        marginLeft: 6,
                                        background: "#e74c3c",
                                        color: "white",
                                        borderRadius: 10,
                                        padding: "1px 7px",
                                        fontSize: 11,
                                    }}
                                >
                                    {dm.unreadCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* TAB 1: chat */}
                {activeTab === "chat" && (
                    <div>
                        <div>
                            {messages.map((msg, index) => {
                                if (msg.type === "MENTOR_CHAT") {
                                    return (
                                        <div
                                            key={index}
                                            style={{
                                                margin: "6px 0",
                                                padding: "6px 10px",
                                                background: "#eef6ff",
                                                borderLeft: "4px solid #1F7AE0",
                                                borderRadius: 6,
                                                textAlign: "left",
                                            }}
                                        >
                                            <strong>🎓 {msg.studentName}</strong>{" "}
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    background: "#1F7AE0",
                                                    color: "#fff",
                                                    borderRadius: 8,
                                                    padding: "1px 6px",
                                                }}
                                            >
                                                Mentor
                                            </span>
                                            <div style={{ marginTop: 2 }}>{msg.content}</div>
                                        </div>
                                    );
                                }

                                if (msg.type === "FILE") {
                                    return (
                                        <p key={index}>
                                        <strong>{titledName(joinData.room, msg.studentName)}: </strong>
                                            shared a file —{" "}
                                            {React.createElement(
                                                "a",
                                                {
                                                    href: `${API_URL}${msg.fileUrl}`,
                                                    target: "_blank",
                                                    rel: "noreferrer",
                                                },
                                                msg.content
                                            )}
                                            {reportControls(msg)}
                                        </p>
                                    );
                                }
                                return (
                                    <p key={index}>
                                    <strong>{titledName(joinData.room, msg.studentName)}: </strong> {msg.content}
                                        {reportControls(msg)}
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
                )}

                {/* TAB 2: mentor */}
                {activeTab === "mentor" && (
                    <div>
                        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                            <h4 style={{ margin: "0 0 8px" }}>🎓 Ask a Mentor</h4>
                            <textarea
                                rows={3}
                                style={{ width: "100%" }}
                                placeholder="Type your question for this room's mentors..."
                                value={questionText}
                                maxLength={1000}
                                onChange={(e) => setQuestionText(e.target.value)}
                            />
                            <label style={{ fontSize: 12, display: "block", margin: "6px 0" }}>
                                <input
                                    type="checkbox"
                                    checked={questionPrivate}
                                    onChange={(e) => setQuestionPrivate(e.target.checked)}
                                />{" "}
                                Keep my question private (only I can see the answer, using my code)
                            </label>
                            <button onClick={handleAskMentor} disabled={askingMentor}>
                                {askingMentor ? "Sending..." : "Ask Mentor"}
                            </button>

                            {myQuestion && (
                                <div style={{ marginTop: 10, padding: 10, background: "#eef6ff", borderRadius: 6 }}>
                                    <p style={{ margin: 0 }}>✅ Question sent!</p>
                                    <p style={{ margin: "4px 0", fontSize: 18 }}>
                                        <strong>Your code: {myQuestion.statusCode}</strong>
                                    </p>
                                    <p style={{ margin: 0, fontSize: 12, color: "#555" }}>
                                        Save this code. Mentors usually reply within 24 hours
                                        {myQuestion.privateQuestion ? "." : ", and the answer will also appear in this tab."}
                                    </p>
                                    <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                        <button onClick={() => downloadSlip(myQuestion)}>⬇️ Download again</button>
                                        <button onClick={handleCopyCode}>{copied ? "✅ Copied!" : "📋 Copy code"}</button>
                                        {React.createElement(
                                            "a",
                                            { href: `/check?code=${myQuestion.statusCode}`, target: "_blank", rel: "noreferrer" },
                                            "🔑 Check your answer →"
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <h4 style={{ margin: "16px 0 8px" }}>Mentor answers</h4>
                        {mentorAnswers.length === 0 && (
                            <p style={{ fontSize: 13, color: "#888" }}>
                                No answers yet. Ask the first question!
                            </p>
                        )}


                        {answerGroups.map((g) => (
                            <div
                                key={g.key}
                                style={{
                                    margin: "10px 0",
                                    padding: 10,
                                    background: "#eef6ff",
                                    borderLeft: "4px solid #1F7AE0",
                                    borderRadius: 6,
                                    textAlign: "left",
                                }}
                            >
                                <p style={{ margin: 0 }}>
                                    <strong>Q ({g.studentName}):</strong> {g.question}
                                </p>
                                {g.answers.map((a, i) => (
                                    <div
                                        key={i}
                                        style={{ marginTop: 8, padding: 8, background: "#ffffff", borderRadius: 6 }}
                                    >
                                        <strong>🎓 Mentor · {a.answeredBy}</strong>
                                        <p style={{ margin: "4px 0 0", whiteSpace: "pre-line" }}>{a.answer}</p>
                                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#888" }}>
                                            {new Date(a.answeredAt).toLocaleString("en-IN", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                                hour: "numeric",
                                                minute: "2-digit",
                                                hour12: true,
                                            })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ))}


                        {hasOlderAnswers && (
                            <button onClick={() => loadAnswers(answersPage + 1)}>
                                Show older answers
                            </button>
                        )}
                    </div>
                )}

                {/* TAB 4: direct messages (#3) */}
                {activeTab === "messages" && (
                    <DmPanel dm={dm} room={joinData.room} myName={joinData.name} myGender={joinData.gender} />
                )}

                {/* TAB 3: files */}
                {activeTab === "files" && (
                    <p style={{ fontSize: 13, color: "#888" }}>
                        📁 Files shared in this room will be listed here. Coming soon.
                    </p>
                )}
            </div>

            {/* RIGHT: Who's in this room */}
            <div style={{ flex: 1, borderLeft: "1px solid #ddd", paddingLeft: 16 }}>
                <h4>Who's here ({participants.length})</h4>
                {participants.map((p, index) => {
                    const pMood = MOODS.find((m) => m.id === p.mood);
                    const pStage = STAGES.find((s) => s.id === p.stage);   // #1
                    return (
                        <div
                            key={index}
                            style={{
                                marginBottom: 12,
                                paddingBottom: 8,
                                borderBottom: "1px solid #eee",
                            }}
                        >
                        <strong>{titledName(joinData.room, p.studentName)}</strong>
                            {p.studentName !== joinData.name && (
                                <button
                                    type="button"
                                    title="Send a message request"
                                    onClick={() => {
                                        dm.requestDm(p.studentName);   // #3
                                        switchTab("messages");
                                    }}
                                    style={{ marginLeft: 6, fontSize: 11 }}
                                >
                                    ✉️ Message
                                </button>
                            )}
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
                            {pStage && (
                                <p style={{ fontSize: 12, margin: "2px 0" }}>🏫 {pStage.label}</p>
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