
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              username: username.trim(),
              display_name: username.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setMessage(
            "Account created! Check your email to confirm your account."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDiscordLogin() {
    setDiscordLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Discord login could not be started."
      );
      setDiscordLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08080d] text-white flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="text-3xl font-black tracking-[0.25em] text-purple-400"
        >
          NELVA
        </a>

        <div className="mt-10 rounded-2xl border border-white/10 bg-[#11111a] p-7 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-400">
            Welcome to NELVA
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            {mode === "signup"
              ? "Join the gaming community."
              : "Sign in to continue to NELVA."}
          </p>

          {/* DISCORD LOGIN */}
          <button
            type="button"
            onClick={handleDiscordLogin}
            disabled={discordLoading || loading}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg border border-white/15 bg-[#5865F2] py-3 font-bold text-white transition hover:bg-[#4752c4] disabled:cursor-wait disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-current"
              aria-hidden="true"
            >
              <path d="M19.73 5.36A18.3 18.3 0 0 0 15.2 4a12.6 12.6 0 0 0-.58 1.2 17 17 0 0 0-5.23 0A12.6 12.6 0 0 0 8.8 4a18.3 18.3 0 0 0-4.53 1.36C1.4 9.6.62 13.73 1.01 17.8a18.5 18.5 0 0 0 5.56 2.8c.45-.62.85-1.28 1.2-1.98-.66-.25-1.29-.57-1.88-.95.16-.12.32-.25.47-.38a13.1 13.1 0 0 0 11.28 0c.15.13.31.26.47.38-.59.38-1.22.7-1.88.95.35.7.75 1.36 1.2 1.98a18.5 18.5 0 0 0 5.56-2.8c.46-4.72-.78-8.81-3.26-12.44ZM8.4 14.9c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2.02.99 2 2.2c0 1.21-.88 2.2-2 2.2Zm7.2 0c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2.02.99 2 2.2c0 1.21-.88 2.2-2 2.2Z" />
            </svg>
            {discordLoading ? "Connecting..." : "Continue with Discord"}
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-medium text-gray-500">
              OR CONTINUE WITH EMAIL
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* EMAIL AUTHENTICATION */}
          <form onSubmit={handleAuth} className="space-y-5">
            {mode === "signup" && (
              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Username
                </label>
                <input
                  required
                  minLength={3}
                  maxLength={24}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-purple-500"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Email address
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-purple-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Password
              </label>
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 outline-none transition focus:border-purple-500"
              />
            </div>

            {message && (
              <p className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3 text-sm text-purple-200">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || discordLoading}
              className="w-full rounded-lg bg-purple-600 py-3 font-bold transition hover:bg-purple-500 disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <div className="mt-7 text-center text-sm text-gray-400">
            {mode === "signup"
              ? "Already have an account?"
              : "New to NELVA?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setMessage("");
              }}
              className="font-semibold text-purple-400 hover:text-purple-300"
            >
              {mode === "signup" ? "Sign in" : "Create account"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          By continuing, you agree to use NELVA responsibly.
        </p>
      </div>
    </main>
  );
}
