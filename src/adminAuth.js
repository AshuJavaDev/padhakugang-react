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
    }
}
