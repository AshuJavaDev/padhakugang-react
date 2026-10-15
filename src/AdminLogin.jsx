import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { saveAdminSession, readAdminSession } from "./adminAuth.js";

const API = "http://localhost:8080";

function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already logged in? Skip the login page.
  if (readAdminSession()) {
    return <Navigate to="/admin" replace />;
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Please enter username and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        const msg = await res.text(); // our backend sends errors as plain text
        setError(msg || "Login failed. Please try again.");
        return;
      }
      const data = await res.json(); // success is JSON
      saveAdminSession(data);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError("Cannot reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "40px auto", padding: 20 }}>
      <h2>Mentor Login</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <label>Username</label>
          <br />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ width: "100%" }}
          />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

export default AdminLogin;