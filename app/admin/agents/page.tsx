"use client";

import { useEffect, useState } from "react";

type AgentApplication = {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  phone?: string;
  status?: string;
};

export default function Page() {
  const [data, setData] = useState<AgentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/agent-applications", {
      cache: "no-store",
      credentials: "include",
    });
    const d = await res.json();
    setData(d.data || []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const act = async (agentId: string, action: "approve" | "reject") => {
    try {
      setBusyId(agentId);

      const res = await fetch("/api/admin/agent-applications", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId,
          action,
        }),
      });

      const d = await res.json();

      if (!res.ok) {
        alert(d.message || "Action failed");
        return;
      }

      alert(d.message || `Application ${action}d successfully`);
      await load();
    } catch (error) {
      console.error(error);
      alert("Network error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Agent Applications</h1>

      {!data.length ? <p>No applications found.</p> : null}

      {data.map((a) => (
        <div
          key={a.id}
          style={{
            border: "1px solid #ccc",
            padding: 12,
            marginBottom: 12,
            borderRadius: 8,
          }}
        >
          <p><strong>Username:</strong> {a.username}</p>
          <p><strong>Email:</strong> {a.email}</p>
          <p><strong>Name:</strong> {a.fullName || "—"}</p>
          <p><strong>Phone:</strong> {a.phone || "—"}</p>
          <p><strong>Status:</strong> {a.status || "pending"}</p>

          {(a.status || "pending") === "pending" ? (
            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <button
                onClick={() => act(a.id, "approve")}
                disabled={busyId === a.id}
              >
                {busyId === a.id ? "Processing..." : "Approve"}
              </button>

              <button
                onClick={() => act(a.id, "reject")}
                disabled={busyId === a.id}
              >
                {busyId === a.id ? "Processing..." : "Reject"}
              </button>
            </div>
          ) : (
            <p style={{ marginTop: 10 }}>No action available</p>
          )}
        </div>
      ))}
    </div>
  );
}