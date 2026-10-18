
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { readSavedCodes, saveCode } from "./savedCodes";

const PENDING_MSG =
    "⏳ Your question has reached our mentors. They usually reply within 24 hours, so please check back a little later. Your question is safe with us!";
const NOT_FOUND_MSG =
    "🤔 We couldn't find this code. Please check it once more. Codes look like Q-XXXXXX or SP-XXXXXX.";

function formatDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}



function CheckCode() {
    const [searchParams] = useSearchParams();
    const [code, setCode] = useState(searchParams.get("code") || "");
    const [result, setResult] = useState(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [savedCodes, setSavedCodes] = useState(readSavedCodes);

      function rememberCode(c, questionText) {
        setSavedCodes(saveCode(c, questionText));
    }

    async function checkCode(input) {
        const clean = (input || "").trim().toUpperCase();
        if (!clean) return;

        setCode(clean);
        setLoading(true);
        setResult(null);
        setMessage("");

        try {
            const res = await fetch(`http://localhost:8080/api/codes/${encodeURIComponent(clean)}`);

            if (res.status === 404 || res.status === 400) {
                setMessage(NOT_FOUND_MSG);
            } else if (!res.ok) {
                setMessage("Something went wrong. Please try again in a moment.");
            } else {
                const data = await res.json();
                setResult(data);
                rememberCode(data.code, data.question);
            }
        } catch (err) {
            console.error("Code lookup failed:", err);
            setMessage("Could not reach PadhakuGang. Please check your internet and try again.");
        }

        setLoading(false);
    }

    // came from the slip link (?code=...) -> check it straight away
    useEffect(() => {
        const fromLink = searchParams.get("code");
        if (fromLink) checkCode(fromLink);
    }, []);

    function handleSubmit(e) {
        e.preventDefault();          // stop the form from reloading the page
        checkCode(code);
    }

    return (
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px" }}>
            <h2>🔑 Check your code</h2>
            <p style={{ fontSize: 13, color: "#666" }}>
                Enter the code from your slip to see your mentor's answer.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <input
                    type="text"
                    placeholder="Q-XXXXXX"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{ flex: 1, maxWidth: 240 }}
                />
                <button type="submit" disabled={loading}>
                    {loading ? "Checking..." : "Check"}
                </button>
            </form>

            {savedCodes.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 12 }}>
                    <span style={{ color: "#888" }}>Your codes on this device: </span>
                    {savedCodes.map((c) => (
                        <button
                            key={c.code}
                            type="button"
                            onClick={() => checkCode(c.code)}
                            style={{ margin: "4px", fontSize: 12 }}
                        >
                            {c.code}
                            {c.preview && ` · ${c.preview}`}
                        </button>
                    ))}
                </div>
            )}

            {message && (
                <p style={{ marginTop: 20, padding: 12, background: "#f5f5f5", borderRadius: 8 }}>
                    {message}
                </p>
            )}

            {result && (
                <div
                    style={{
                        marginTop: 20,
                        padding: 14,
                        background: "#eef6ff",
                        borderLeft: "4px solid #1F7AE0",
                        borderRadius: 8,
                        textAlign: "left",
                    }}
                >
                    <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                        {result.code} · Asked on {formatDate(result.askedAt)}
                    </p>
                    <p style={{ margin: "8px 0 0" }}>
                        <strong>Your question:</strong> {result.question}
                    </p>

                    {result.status === "ANSWERED" ? (
                                             <>
                            <p style={{ margin: "12px 0 0" }}>
                                <strong>
                                    🎓 {(result.answers?.length || 1) > 1
                                        ? `${result.answers.length} mentor answers`
                                        : "Mentor's answer"}
                                </strong>
                            </p>
                            {(result.answers?.length
                                ? result.answers
                                : [{ answer: result.answer, answeredBy: result.answeredBy, answeredAt: result.answeredAt }]
                            ).map((a, i) => (
                                <div
                                    key={i}
                                    style={{ marginTop: 8, padding: 10, background: "#ffffff", borderRadius: 6 }}
                                >
                                    <p style={{ margin: 0, whiteSpace: "pre-line" }}>{a.answer}</p>
                                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>
                                        Answered by {a.answeredBy} · {formatDate(a.answeredAt)}
                                    </p>
                                </div>
                            ))}
                        </>
                    ) : (
                        <p style={{ margin: "12px 0 0" }}>{PENDING_MSG}</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default CheckCode;