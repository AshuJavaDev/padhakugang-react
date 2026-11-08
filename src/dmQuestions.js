// #3 DM: ready-made Approach Gate questions — English + Hinglish on one line,
// so students from every state can read them. Backend limits: question ≤ 200 chars, MCQ option ≤ 60 chars.

export const CUSTOM_ID = "custom";

export const GATE_QUESTIONS = [
    {
        id: "m-why",
        type: "MCQ",
        text: "What brings you here? 😄 · Kaise yaad kiya?",
        options: [
            "Same exam, let's study together",
            "Stuck on a doubt",
            "Saw we're from the same city",
            "Need some motivation",
            "Just wanted to say hi",
        ],
    },
    {
        id: "t-about",
        type: "TEXT",
        text: "Tell me about yourself: your strong subject, weak subject, and one interesting thing about you 😊 · Apne baare me batao: kaunsa subject strong, kaunsa weak, aur ek mazedaar baat",
    },
    {
        id: "m-vibe",
        type: "MCQ",
        text: "What's your study vibe? · Padhai ka style kya hai?",
        options: [
            "Silent grinder 🤫",
            "Discuss-everything type 🗣️",
            "Need someone to keep me on track ⏰",
            "Depends on the mood 😅",
        ],
    },
    {
        id: "m-serious",
        type: "MCQ",
        text: "How serious is your preparation? · Taiyaari kitni serious hai?",
        options: ["Just started", "Regular", "Full-time", "Dropper, full focus"],
    },
    { id: "t-stuck", type: "TEXT", text: "What's troubling you in studies right now? · Abhi padhai me kis cheez me atke ho?" },
    { id: "t-topic", type: "TEXT", text: "Which topic is giving you sleepless nights? 😅 · Aajkal kaunsa topic neend uda raha hai?" },
    { id: "t-dream", type: "TEXT", text: "What's your dream, and why? · Kya banna hai, aur kyun?" },
    { id: "t-bring", type: "TEXT", text: "If we study together, what will you bring? · Saath padhe to tum kya laoge?" },
    { id: "t-week", type: "TEXT", text: "Best thing you learned this week? · Is hafte sabse mast kya padha?" },
];

// what a student gets when they switch the Gate ON without choosing
export const DEFAULT_GATE = [{ id: "m-why" }, { id: "t-about" }];

// turn the saved choices ([{id} or {id:"custom", text}]) into what the backend expects
export function buildGate(selected) {
    const out = [];
    for (const s of selected || []) {
        if (s.id === CUSTOM_ID) {
            const text = (s.text || "").trim();
            if (text) out.push({ type: "TEXT", text, options: [] });
        } else {
            const q = GATE_QUESTIONS.find((g) => g.id === s.id);
            if (q) out.push({ type: q.type, text: q.text, options: q.options || [] });
        }
    }
    return out.slice(0, 3);
}
