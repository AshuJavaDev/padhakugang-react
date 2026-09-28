import React, { useEffect, useState } from "react";

const API_BASE = "http://localhost:8080/api/tribute";

function TributeSection() {
  const [messages, setMessages] = useState([]);
  const [authorName, setAuthorName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [rememberedCount, setRememberedCount] = useState(0);
  const [companions, setCompanions] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchMessages();
    fetchCount();
  }, []);

  useEffect(() => {
    fetchCompanions(page);
  }, [page]);

  const fetchMessages = () => {
    fetch(`${API_BASE}/messages`)
      .then((res) => res.json())
      .then(setMessages)
      .catch((err) => console.error("Failed to load tribute messages:", err));
  };

  const fetchCount = () => {
    fetch(`${API_BASE}/remember/count`)
      .then((res) => res.json())
      .then((data) => setRememberedCount(data.count))
      .catch((err) => console.error("Failed to load remember count:", err));
  };

  const fetchCompanions = (pageNum) => {
    fetch(`${API_BASE}/companions?page=${pageNum}`)
      .then((res) => res.json())
      .then((data) => {
        setCompanions(data.content);
        setTotalPages(data.totalPages || 1);
      })
      .catch((err) => console.error("Failed to load companions:", err));
  };

  const handlePostMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName, message: messageText }),
    })
      .then((res) => res.json())
      .then((saved) => {
        setMessages((prev) => [saved, ...prev]);
        setMessageText("");
        setAuthorName("");
      })
      .catch((err) => console.error("Failed to post tribute message:", err));
  };

  const handleRemember = () => {
    fetch(`${API_BASE}/remember`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => setRememberedCount(data.count))
      .catch((err) => console.error("Failed to update remember count:", err));
  };

  const handleNext = () => {
    if (page + 1 < totalPages) setPage(page + 1);
  };

  const handlePrevious = () => {
    if (page > 0) setPage(page - 1);
  };

  return (
    <div className="tribute-section">
      <h2>We will not forget our companions</h2>

      <div className="companion-gallery">
        {companions.length === 0 ? (
          <p className="no-companions">No companions added yet.</p>
        ) : (
          <div className="companion-grid">
            {companions.map((c) => (
              <div key={c.id} className="companion-card">
                <img src={c.photoUrl} alt={c.name} />
                <p className="companion-name">{c.name}</p>
                <p className="companion-note">{c.note}</p>
              </div>
            ))}
          </div>
        )}
        <div className="companion-pagination">
          <button onClick={handlePrevious} disabled={page === 0}>Previous</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button onClick={handleNext} disabled={page + 1 >= totalPages}>Next</button>
        </div>
      </div>

      <div className="remember-button-area">
        <p className="remember-hint">Tap the button below every time you think of them</p>
        <button onClick={handleRemember}>Miss you</button>
        <p>{rememberedCount} people miss you</p>
      </div>

      <form onSubmit={handlePostMessage} className="tribute-form">
        <input
          type="text"
          placeholder="Your name (optional)"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
        />
        <textarea
          placeholder="Leave a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          maxLength={300}
        />
        <button type="submit">Post message</button>
      </form>

      <div className="tribute-messages">
        {messages.map((msg) => (
          <div key={msg.id} className="tribute-message">
            <strong>{msg.authorName}</strong>
            <p>{msg.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TributeSection;