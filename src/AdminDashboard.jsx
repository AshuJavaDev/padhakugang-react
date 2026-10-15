import { Navigate, useNavigate } from "react-router-dom";
import { readAdminSession, clearAdminSession } from "./adminAuth.js";

function AdminDashboard() {
  const navigate = useNavigate();
  const session = readAdminSession();

  // Guarded door: no valid (or expired) session → login page
  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  function handleLogout() {
    clearAdminSession();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Mentor Dashboard</h2>
      <p>
        Logged in as <b>{session.username}</b> ({session.role})
      </p>
      <p>
        Rooms:{" "}
        {session.role === "SUPER_ADMIN"
          ? "All rooms"
          : session.assignedRooms.join(", ")}
      </p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default AdminDashboard;