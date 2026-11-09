// PadhakuGang smoke test — pretends to be a few students talking to the real backend, and checks the results.
// Run from the padhakugang-react folder, with the backend running on :8080:
//     node smoke-test/smoke.mjs
// Admin checks (radar, mute, kick, clean-up) also run when a mentor login is given (PowerShell):
//     $env:SMOKE_ADMIN_USER="ashu_admin"; $env:SMOKE_ADMIN_PASS="..."; node smoke-test/smoke.mjs
// Add --email to use reason DANGER for the DM report, which sends a real urgent alert email.
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const API = process.env.SMOKE_API || "http://localhost:8080";
const ROOM = "ssc";
const RUN = Math.random().toString(36).slice(2, 6);          // unique names per run, e.g. SmokeA-k3f9
const ADMIN_USER = process.env.SMOKE_ADMIN_USER;
const ADMIN_PASS = process.env.SMOKE_ADMIN_PASS;
const WITH_EMAIL = process.argv.includes("--email");

let passed = 0;
const failures = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, ok, detail = "") {
    if (ok) { passed++; console.log("  ✅ " + name); }
    else { failures.push(name); console.log("  ❌ " + name + (detail ? "   → " + detail : "")); }
}
function section(title) { console.log("\n" + title); }

// wait until a message matching pred arrives (or time runs out → null)
function waitFor(list, pred, ms = 3000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const t = setInterval(() => {
            const hit = list.find(pred);
            if (hit || Date.now() - start > ms) { clearInterval(t); resolve(hit || null); }
        }, 50);
    });
}
// true if NO matching message arrives within ms
async function never(list, pred, ms = 1500) { await sleep(ms); return !list.some(pred); }

async function http(method, path, body, token) {
    const res = await fetch(API + path, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = text;
    try { data = JSON.parse(text); } catch { /* plain text */ }
    return { status: res.status, data };
}

const participants = async () => (await http("GET", `/api/rooms/${ROOM}/participants`)).data || [];

// one fake student: connects, listens to the room topic + private DM letterbox, joins the room
async function student(name, { stage = "graduate", privacy = false, gender = null, join = true } = {}) {
    const s = { name, topic: [], dm: [], raw: [] };
    s.client = new Client({
        webSocketFactory: () => new SockJS(`${API}/ws`),
        reconnectDelay: 0, heartbeatIncoming: 0, heartbeatOutgoing: 0, debug: () => {},
    });
    await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error("WebSocket connect timeout. Is the backend running on :8080?")), 6000);
        s.client.onConnect = () => { clearTimeout(to); resolve(); };
        s.client.onStompError = (f) => { clearTimeout(to); reject(new Error(f.headers.message)); };
        s.client.activate();
    });
    s.client.subscribe("/user/queue/dm", (m) => s.dm.push(JSON.parse(m.body)));
    s.client.subscribe(`/topic/room/${ROOM}`, (m) => s.topic.push(JSON.parse(m.body)));
    s.send = (body) => s.client.publish({ destination: `/app/chat/${ROOM}`, body: JSON.stringify(body) });
    s.dmSend = (body) => s.client.publish({ destination: "/app/dm", body: JSON.stringify(body) });
    s.joinRoom = (stg = stage) => s.send({
        type: "JOIN", studentName: name, roomId: ROOM, mood: "Ok ok", exam: "SSC CGL", college: "Smoke College",
        city: "Test City", subject: "Smoke testing", bio: "automated smoke test", lookingFor: "Just here to focus", stage: stg,
    });
    s.close = () => s.client.deactivate();
    if (join) {
        await sleep(150);
        s.joinRoom();
        await sleep(250);
        s.dmSend({ type: "SETTINGS", gender, privacy, sameGenderOnly: false, gate: [] });
        await sleep(200);
    }
    return s;
}

async function main() {
    console.log(`\nPadhakuGang smoke test · run ${RUN} · ${API} · room ${ROOM}`);
    const students = [];
    const mk = async (n, opts) => { const s = await student(n, opts); students.push(s); return s; };

    try {
        // ---------------------------------------------------------------
        section("1. Room basics");
        const A = await mk(`SmokeA-${RUN}`, { gender: "Male" });
        const B = await mk(`SmokeB-${RUN}`, { gender: "Female" });
        const list = await participants();
        check("A and B appear in Who's here", list.some((p) => p.studentName === A.name) && list.some((p) => p.studentName === B.name));
        check("A sees B's JOIN live", !!(await waitFor(A.topic, (m) => m.type === "JOIN" && m.studentName === B.name)));
        const pa = list.find((p) => p.studentName === A.name);
        check("Gender is never in Who's here", pa && (pa.gender === undefined || pa.gender === null));

        B.send({ type: "CHAT", studentName: B.name, roomId: ROOM, content: `hello-${RUN}` });
        const chat = await waitFor(A.topic, (m) => m.type === "CHAT" && m.content === `hello-${RUN}`);
        check("Room chat: A receives B's message (with a server id)", !!(chat && chat.id));

        // ---------------------------------------------------------------
        section("2. Age worlds");
        const S = await mk(`SmokeKid-${RUN}`, { join: false });
        S.joinRoom("class-9-10");
        check("Class 9–10 student gets JOIN_DENIED in an adult room",
            !!(await waitFor(S.topic, (m) => m.type === "JOIN_DENIED" && m.studentName === S.name)));
        check("…and is NOT in Who's here", !(await participants()).some((p) => p.studentName === S.name));
        const N = await mk(`SmokeNoStage-${RUN}`, { join: false });
        N.joinRoom(null);
        check("JOIN with no stage is refused (not a server crash)",
            !!(await waitFor(N.topic, (m) => m.type === "JOIN_DENIED" && m.studentName === N.name)));

        // ---------------------------------------------------------------
        section("3. Security guards");
        const M = await mk(`SmokeMallory-${RUN}`);
        M.client.subscribe("/queue/dm", (m) => M.raw.push(m.body));                      // try to read others' letterboxes
        B.send({ type: "KICK", studentName: A.name, roomId: ROOM });
        check("Fake KICK from a student is dropped", await never(A.topic, (m) => m.type === "KICK" && m.studentName === A.name));
        B.send({ type: "MENTOR_CHAT", studentName: B.name, roomId: ROOM, content: `fake-mentor-${RUN}` });
        check("Fake MENTOR_CHAT from a student is dropped", await never(A.topic, (m) => m.content === `fake-mentor-${RUN}`, 800));
        M.client.publish({ destination: `/topic/room/${ROOM}`,
            body: JSON.stringify({ type: "CHAT", studentName: "Fake", content: `bypass-${RUN}` }) });
        check("SEND straight to /topic (skipping the server) is dropped", await never(A.topic, (m) => m.content === `bypass-${RUN}`, 800));
        M.send({ type: "CHAT", studentName: A.name, roomId: ROOM, content: `impersonate-${RUN}` });
        check("A student can't post under someone else's name",
            await never(B.topic, (m) => m.content === `impersonate-${RUN}`, 800),
            "KNOWN HOLE: CHAT trusts the name in the message body → fix in the security step");

        // ---------------------------------------------------------------
        section("4. Direct messages");
        A.dmSend({ type: "REQUEST", to: B.name });
        const card = await waitFor(B.dm, (m) => m.type === "REQUEST_IN" && m.from === A.name);
        check("B receives A's message request", !!card);
        check("Request card shows the sender's gender", card && card.gender === "Male");
        B.dmSend({ type: "ACCEPT", to: A.name });
        check("Chat opens for both",
            !!(await waitFor(A.dm, (m) => m.type === "CHAT_OPEN" && m.with === B.name)) &&
            !!(await waitFor(B.dm, (m) => m.type === "CHAT_OPEN" && m.with === A.name)));
        A.dmSend({ type: "SEND", to: B.name, text: `dm-secret-${RUN}` });
        check("B receives A's private message", !!(await waitFor(B.dm, (m) => m.type === "DM" && m.text === `dm-secret-${RUN}`)));
        check("…and it never appears in the room", await never(B.topic, (m) => m.content === `dm-secret-${RUN}`, 600));
        check("…and the snooper's raw /queue subscription got nothing", M.raw.length === 0);

        const P = await mk(`SmokePriv-${RUN}`, { privacy: true });
        const pSaved = await waitFor(P.dm, (m) => m.type === "SETTINGS_SAVED");
        check("P's settings were saved with Privacy ON", !!(pSaved && pSaved.privacy === true),
            "P got: " + JSON.stringify(P.dm.slice(-3)));
        A.dmSend({ type: "REQUEST", to: P.name });
        const pr = await waitFor(A.dm, (m) => (m.to === P.name || m.with === P.name) && m.type !== "DM", 3000);
        check("Privacy Mode: request to P is 'not available'", !!(pr && pr.type === "NOT_AVAILABLE"),
            "A got: " + JSON.stringify(pr || A.dm.slice(-3)) + " | P got: " + JSON.stringify(P.dm.slice(-3)));

        // ---------------------------------------------------------------
        section("5. Reports");
        const r1 = await http("POST", `/api/rooms/${ROOM}/reports`, { messageId: chat?.id, reporterName: A.name, reason: "SPAM" });
        check("Room report: A reports B's message → 201", r1.status === 201, `got ${r1.status} ${JSON.stringify(r1.data)}`);
        const r2 = await http("POST", `/api/rooms/${ROOM}/reports`, { messageId: chat?.id, reporterName: A.name, reason: "SPAM" });
        check("Reporting the same message twice → 409", r2.status === 409, `got ${r2.status}`);
        const r3 = await http("POST", `/api/rooms/${ROOM}/reports`, { messageId: chat?.id, reporterName: B.name, reason: "SPAM" });
        check("Reporting your own message → 400", r3.status === 400, `got ${r3.status}`);

        A.dmSend({ type: "CLOSE", to: B.name });
        check("Close chat: B is told it was closed",
            !!(await waitFor(B.dm, (m) => m.type === "CHAT_CLOSED" && m.with === A.name && m.reason === "CLOSED")));
        const reason = WITH_EMAIL ? "DANGER" : "ABUSE";
        B.dmSend({ type: "REPORT", to: A.name, reason });
        check(`DM report AFTER the chat closed (${reason}) → DM_REPORTED`,
            !!(await waitFor(B.dm, (m) => m.type === "DM_REPORTED" && m.with === A.name)));
        B.dmSend({ type: "REPORT", to: A.name, reason });
        check("Reporting the same chat twice is refused", !!(await waitFor(B.dm, (m) => m.type === "DM_ERROR")));
        A.dmSend({ type: "REQUEST", to: B.name });
        check("Block: A can't request B again after the report",
            !!(await waitFor(A.dm, (m) => m.type === "NOT_AVAILABLE" && m.to === B.name)));
        check("The reported student is never told about the report", !A.dm.some((m) => m.type === "DM_REPORTED"));

        // ---------------------------------------------------------------
        section("6. Mentor tools" + (ADMIN_USER ? "" : " (skipped: set SMOKE_ADMIN_USER and SMOKE_ADMIN_PASS)"));
        if (ADMIN_USER && ADMIN_PASS) {
            const login = await http("POST", "/auth/login", { username: ADMIN_USER, password: ADMIN_PASS });
            const token = login.data?.token;
            check("Mentor login works", !!token, `got ${login.status}`);
            if (token) {
                const radar = (await http("GET", `/admin/rooms/${ROOM}/radar`, null, token)).data || [];
                const dmRep = radar.find((r) => r.kind === "DM" && r.reportedName === A.name);
                check("On radar: DM report for A with the chat transcript", !!(dmRep && (dmRep.transcript || "").includes(`dm-secret-${RUN}`)));
                check("On radar: room report for B", radar.some((r) => r.kind === "ROOM" && r.reportedName === B.name));

                const mu = await http("POST", `/admin/rooms/${ROOM}/mute/${encodeURIComponent(B.name)}`, null, token);
                check("Mute B → 200", mu.status === 200, `got ${mu.status}`);
                B.send({ type: "CHAT", studentName: B.name, roomId: ROOM, content: `while-muted-${RUN}` });
                check("Muted B's message is dropped", await never(A.topic, (m) => m.content === `while-muted-${RUN}`, 800));
                await http("POST", `/admin/rooms/${ROOM}/unmute/${encodeURIComponent(B.name)}`, null, token);
                B.send({ type: "CHAT", studentName: B.name, roomId: ROOM, content: `after-unmute-${RUN}` });
                check("After unmute B can chat again", !!(await waitFor(A.topic, (m) => m.content === `after-unmute-${RUN}`)));

                const k = await http("POST", `/admin/rooms/${ROOM}/kick/${encodeURIComponent(M.name)}`, null, token);
                check("Kick M → 200 and M is out of Who's here",
                    k.status === 200 && !(await participants()).some((p) => p.studentName === M.name));

                for (const n of [A.name, B.name]) {   // clean up this run's reports (rows are kept as DISMISSED)
                    await http("POST", `/admin/rooms/${ROOM}/radar/${encodeURIComponent(n)}/dismiss`, null, token);
                }
                const after = (await http("GET", `/admin/rooms/${ROOM}/radar`, null, token)).data || [];
                check("Clean-up: this run's reports dismissed", !after.some((r) => r.reportedName === A.name || r.reportedName === B.name));
            }
        }
    } catch (e) {
        failures.push("crashed: " + e.message);
        console.log("\n  💥 " + e.message);
    } finally {
        for (const s of students) s.close();
    }

    console.log(`\n${passed} passed, ${failures.length} failed`);
    if (failures.length) console.log("Failed:\n - " + failures.join("\n - "));
    await sleep(300);
    process.exit(failures.length ? 1 : 0);
}

main();
