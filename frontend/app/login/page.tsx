"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, resolveLogoUrl } from "@/lib/api";
import { useWorkspaceBranding } from "@/components/branding-runtime";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const branding = useWorkspaceBranding();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login gagal.");
      }

      router.replace("/");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Tidak dapat terhubung ke backend.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] p-6 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#131316] p-8 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveLogoUrl(branding.logo_url)}
            alt={`Logo ${branding.office_name}`}
            className="h-10 w-10 rounded-lg object-cover"
          />
          <p className="text-xs font-semibold tracking-[0.2em] text-indigo-300">
            {branding.office_name} · {branding.office_badge}
          </p>
        </div>
        <h1 className="mt-3 text-2xl font-bold">Login Founder</h1>
        <p className="mt-2 text-sm text-slate-400">
          Masuk untuk mengelola project, AI agents, dan task.
        </p>

        <label className="mt-7 block text-sm text-slate-300" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-2 w-full rounded-lg border border-white/10 bg-[#09090b] p-3 text-sm outline-none focus:border-indigo-400"
        />

        <label className="mt-5 block text-sm text-slate-300" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-white/10 bg-[#09090b] p-3 text-sm outline-none focus:border-indigo-400"
        />

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-indigo-600 p-3 text-sm font-semibold hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Memverifikasi..." : "Masuk"}
        </button>
      </form>
    </main>
  );
}
