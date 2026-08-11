"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#11110f] px-5 py-6 text-[#f5f0e6] sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1500px] flex-col">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link
            href="/"
            className="text-xs font-semibold tracking-[0.25em] uppercase"
          >
            Ellipsis
          </Link>

          <span className="text-xs tracking-[0.16em] text-white/35 uppercase">
            Studio Administration
          </span>
        </header>

        <section className="my-auto grid gap-14 py-16 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div>
            <p className="mb-5 text-xs font-semibold tracking-[0.23em] text-[#c6a777] uppercase">
              Brand Discovery
            </p>

            <h1 className="max-w-3xl text-5xl leading-[0.96] font-medium tracking-[-0.055em] sm:text-7xl">
              Your client intelligence, organized.
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-white/45">
              Sign in to manage clients, issue private discoveries,
              track completion, and review submitted brand strategy data.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8"
          >
            <p className="text-xs font-semibold tracking-[0.18em] text-white/35 uppercase">
              Administrator Access
            </p>

            <div className="mt-9">
              <label
                htmlFor="email"
                className="text-xs font-medium text-white/45"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                className="mt-2 w-full border-0 border-b border-white/15 bg-transparent py-4 text-lg text-white outline-none transition placeholder:text-white/20 focus:border-white/60"
                placeholder="you@example.com"
              />
            </div>

            <div className="mt-7">
              <label
                htmlFor="password"
                className="text-xs font-medium text-white/45"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="mt-2 w-full border-0 border-b border-white/15 bg-transparent py-4 text-lg text-white outline-none transition placeholder:text-white/20 focus:border-white/60"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="mt-5 text-sm text-[#e49b8c]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full rounded-full bg-[#f5f0e6] px-6 py-3.5 text-sm font-medium text-[#151512] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}