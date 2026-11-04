// Admin-defined rooms (hardcoded for now — later from backend/admin panel)
// Shared by StudyRoom.jsx and AdminDashboard.jsx so both always show the same rooms
// #2: each room belongs to one world and lists which stages may join.
// KEEP IN SYNC with backend RoomCatalog.java (same ids + same allowed stages).
// #2c: optional titlePrefix — shown before a student's name in that room ("Future Dr. Ashu"). Display only.

// class / stage options (ids are what the backend checks)
export const STAGES = [
    { id: "class-6-8", label: "Class 6–8" },
    { id: "class-9-10", label: "Class 9–10" },
    { id: "class-11", label: "Class 11" },
    { id: "class-12", label: "Class 12" },
    { id: "dropper", label: "Dropper / repeater (NEET / JEE)" },
    { id: "college", label: "College student" },
    { id: "graduate", label: "Graduate / Working / Other aspirant" },
];

const SCHOOL_STAGES = ["class-6-8", "class-9-10"];
const SENIOR_STAGES = ["class-11", "class-12", "dropper"];
const ADULT_STAGES = ["college", "graduate"];

export const ROOMS = [
    // World 1 · School
    { id: "school-study", label: "School Study Room · Chhote Toppers 📚", world: "SCHOOL", allowedStages: SCHOOL_STAGES },
    { id: "class-10-boards", label: "Class 10 Boards · Board Ke Baadshah 👑", world: "SCHOOL", allowedStages: ["class-9-10"] },

    // World 2 · Senior (Class 11–12 + droppers / repeaters)
    { id: "neet-ug", label: "NEET UG · Doctor Sahab 🩺", world: "SENIOR", allowedStages: SENIOR_STAGES, titlePrefix: "Future Dr." },
    { id: "iit-jee", label: "IIT-JEE · Next Rancho 🚀", world: "SENIOR", allowedStages: SENIOR_STAGES },
    { id: "class-12-boards", label: "Class 12 Boards · Final Boss 12th 🎯", world: "SENIOR", allowedStages: ["class-11", "class-12"] },
    { id: "ca-foundation", label: "CA Foundation · Hisaab Kitaab Gang 🧮", world: "SENIOR", allowedStages: ["class-11", "class-12", "college"], titlePrefix: "Future CA" },

    // World 3 · Competitive (adults only)
    { id: "neet-pg", label: "NEET PG · Bada Doctor Sahab 🩺👑", world: "COMPETITIVE", allowedStages: ADULT_STAGES, titlePrefix: "Dr." },
    { id: "upsc-pcs", label: "UPSC / State PCS · Future DM Sahab 🏛️", world: "COMPETITIVE", allowedStages: ADULT_STAGES },
    { id: "ssc", label: "SSC (CGL, CHSL, GD, MTS) · SSC Warriors ⚔️", world: "COMPETITIVE", allowedStages: ADULT_STAGES },
    { id: "banking", label: "Banking (IBPS, SBI, RBI) · Bank Wale Babu 🏦", world: "COMPETITIVE", allowedStages: ADULT_STAGES },
    { id: "railway-rrb", label: "Railway (NTPC, Group D, ALP) · Railway Express 🚆", world: "COMPETITIVE", allowedStages: ADULT_STAGES },
    { id: "state-govt", label: "All State Govt Exams · Sarkari Naukri Adda 🏢", world: "COMPETITIVE", allowedStages: ADULT_STAGES },
    { id: "ca-inter-final", label: "CA Inter & Final (+CS / CMA) · Debit Credit Dosti 📒", world: "COMPETITIVE", allowedStages: ADULT_STAGES, titlePrefix: "Future CA" },
];

// room id → readable name (falls back to the id if unknown)
export function roomLabel(id) {
    return ROOMS.find((r) => r.id === id)?.label || id;
}

// #2: may this stage join this room?
export function canJoin(roomId, stageId) {
    const room = ROOMS.find((r) => r.id === roomId);
    return !!room && room.allowedStages.includes(stageId);
}

// #2: all rooms a stage may join (for the friendly "you can join…" message)
export function roomsForStage(stageId) {
    return ROOMS.filter((r) => r.allowedStages.includes(stageId));
}

// #2: "Class 11, Class 12, Dropper / repeater (NEET / JEE)"
export function openToText(roomId) {
    const room = ROOMS.find((r) => r.id === roomId);
    if (!room) return "";
    return room.allowedStages
        .map((id) => STAGES.find((s) => s.id === id)?.label || id)
        .join(", ");
}

// #2c: "Future Dr. Ashu" in NEET UG, "Future CA Ashu" in CA rooms — display only, the real name never changes
export function titledName(roomId, name) {
    const prefix = ROOMS.find((r) => r.id === roomId)?.titlePrefix;
    if (!prefix || !name) return name;
    const lower = name.trim().toLowerCase();
    // don't double it if the student already typed "Dr Ashu" / "CA Ashu"
    if (lower.startsWith("dr") || lower.startsWith("ca ")) return name;
    return `${prefix} ${name}`;
}