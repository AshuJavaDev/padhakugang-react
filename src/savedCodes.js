// One place that manages the "codes on this device" list,
// used by both StudyRoom (when a question is asked) and CheckCode (when a code is checked).

const KEY = "pg_codes";
const MAX = 10;

function shortPreview(text) {
    const clean = (text || "").replace(/\s+/g, " ").trim();
    return clean.length > 30 ? clean.slice(0, 30) + "..." : clean;
}

export function readSavedCodes() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY)) || [];
        // older versions saved plain strings like "Q-728449"
        return raw.map((item) =>
            typeof item === "string" ? { code: item, preview: "" } : item
        );
    } catch {
        return [];
    }
}

export function saveCode(code, questionText) {
    const current = readSavedCodes();
    const old = current.find((x) => x.code === code);
    const entry = { code, preview: shortPreview(questionText) || old?.preview || "" };
    const updated = [entry, ...current.filter((x) => x.code !== code)].slice(0, MAX);   // newest first
    try {
        localStorage.setItem(KEY, JSON.stringify(updated));
    } catch {
        // storage blocked (private window etc.) - nothing to do
    }
    return updated;
}