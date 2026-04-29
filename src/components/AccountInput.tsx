"use client";

import { useState, type FormEvent } from "react";
import { Cloud, Loader2 } from "lucide-react";

interface AccountInputProps {
  onSubmit: (roleArn: string) => void;
  loading: boolean;
}

export default function AccountInput({ onSubmit, loading }: AccountInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed.startsWith("arn:aws:iam::")) {
      setError("Enter a valid Role ARN (arn:aws:iam::...)");
      return;
    }
    setError("");
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <Cloud size={20} className="text-indigo-400" />
        <label className="text-sm font-medium text-white/70">
          IAM Role ARN
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          placeholder="arn:aws:iam::123456789012:role/CelestaReadOnly"
          className="w-72 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white placeholder:text-white/20 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-premium rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            "Sync & Visualize"
          )}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
