// Where the backend lives. ONE place for the whole frontend (deploy step).
// Laptop: nothing to set → http://localhost:8080
// Server build: set VITE_API_URL in .env.production (e.g. https://api.padhakugang.com) before `npm run build`.
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "");
