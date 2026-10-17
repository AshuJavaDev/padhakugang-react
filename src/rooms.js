// Admin-defined rooms (hardcoded for now — later from backend/admin panel)
// Shared by StudyRoom.jsx and AdminDashboard.jsx so both always show the same rooms
export const ROOMS = [
    { id: "bpsc-teacher", label: "BPSC Teacher Prep" },
    { id: "bihar-police", label: "Bihar Police / Daroga" },
    { id: "railway-rrb", label: "Railway RRB" },
];

// room id → readable name (falls back to the id if unknown)
export function roomLabel(id) {
    return ROOMS.find((r) => r.id === id)?.label || id;
}