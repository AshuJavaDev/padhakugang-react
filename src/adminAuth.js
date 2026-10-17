const KEY = "pg_admin";

export function saveAdminSession(data)  {
    try {
        localStorage.setItem(KEY, JSON.stringify(data));
    }   catch (e)  {
        // private window / storage blocked - login just won't be remembered
    }
}

export function clearAdminSession()  {
    try  {
        localStorage.removeItem(KEY);
    }   catch (e)  {}
}

function isExpired(token)  {
    try  {
       // JWT uses "base64url" (- and _) — convert to normal base64 for atob
       const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
       const payload = JSON.parse(atob(part));
       return payload.exp * 1000 < Date.now(); //exp is in seconds, Date.now() is in milliseconds
    }       catch (e)  {
        return true; // can't read it -> treat as expired
    }
}

export function readAdminSession()  {
    try {
        const raw = localStorage.getItem(KEY);
        if(!raw) return null;
        const session = JSON.parse(raw);
        if(!session.token || isExpired(session.token))  {
            clearAdminSession();
            return null;
        }
        return session;
    }   catch (e)  {
        return null;
    } }

    const API = "http://localhost:8080";

// fetch for admin pages: adds the token automatically.
// Returns { ok, status, data }, or { expired: true } when the session is no longer valid.
export async function adminFetch(path, options = {}) {
    const session = readAdminSession();
    if (!session) return { expired: true };   // missing or expired on this device

    let res;
    try {
        res = await fetch(API + path, {
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: "Bearer " + session.token,
            },
        });
    } catch (e) {
        // backend down / no internet -> fetch throws instead of returning a response
        return { ok: false, status: 0, data: "Cannot reach the server. Is the backend running?" };
    }

    const text = await res.text();

    // Spring Security's own rejections (bad/expired token, disabled account) come with an EMPTY body.
    // Our controllers' "not allowed" errors always carry a message, so they are NOT treated as expiry.
    if (res.status === 401 || (res.status === 403 && !text)) {
        clearAdminSession();
        return { expired: true };
    }

    let data = text;
    try {
        data = JSON.parse(text);    // JSON lists/objects
    } catch (e) {
        // plain-text message, e.g. "You have already answered this question."
    }
    return { ok: res.ok, status: res.status, data };
    }


