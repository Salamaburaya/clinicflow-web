"use client";

import { useState } from "react";

type ClinicFlowUnlockFormProps = {
  nextPath: string;
};

export function ClinicFlowUnlockForm({ nextPath }: ClinicFlowUnlockFormProps) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password.trim()) {
      setStatus("צריך להזין סיסמה");
      return;
    }

    setSubmitting(true);
    setStatus("");

    try {
      const response = await fetch("/api/clinicflow/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !result?.ok) {
        setStatus(result?.error ?? "לא ניתן לפתוח את המערכת כרגע");
        setSubmitting(false);
        return;
      }

      window.location.assign(nextPath || "/");
    } catch {
      setStatus("לא ניתן לפתוח את המערכת כרגע");
      setSubmitting(false);
    }
  }

  return (
    <form className="clinicflow-unlock-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>סיסמת מרפאה</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="הזן/י סיסמת גישה"
        />
      </label>
      <button className="primary-action" type="submit" disabled={submitting}>
        {submitting ? "פותח..." : "כניסה למערכת"}
      </button>
      <p className="item-meta">{status || "הגישה למערכת מוגנת בסיסמה אחת לכל צוות המרפאה."}</p>
    </form>
  );
}

