"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type AuthState = "checking" | "authenticated" | "error";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoginPage) return;

    let active = true;

    fetch(`${API_URL}/auth/me`)
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            data?.detail || "Tidak dapat memverifikasi sesi Founder.",
          );
        }

        if (active) {
          setAuthState("authenticated");
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Tidak dapat memverifikasi sesi Founder.",
          );
          setAuthState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [isLoginPage, pathname, router]);

  async function logout() {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
    });

    if (!response.ok) {
      setError("Gagal mengakhiri sesi. Coba muat ulang halaman.");
      return;
    }

    router.replace("/login");
  }

  if (isLoginPage) return children;

  if (authState !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b1020] p-6 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-[#151d32] p-6 text-center">
          <p className="font-semibold">
            {authState === "checking" ? "Memeriksa sesi..." : "Sesi Founder"}
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {error}
            </p>
          )}
          {authState === "error" && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
            >
              Coba lagi
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-white/10 bg-[#10182a]/95 px-3 py-2 text-white shadow-lg backdrop-blur">
        <span className="text-xs text-slate-300">Founder</span>
        <button
          onClick={logout}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
        >
          Keluar
        </button>
      </div>
    </>
  );
}
