"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function AdminSetupPage() {
  const router = useRouter();

  const [checking, setChecking] =
    useState(true);

  const [available, setAvailable] =
    useState(false);

  const [displayName, setDisplayName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function checkSetup() {
      try {
        const response = await fetch(
          "/api/admin/setup",
          {
            cache: "no-store",
          },
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Unable to verify owner setup.",
          );
        }

        setAvailable(
          data.available === true,
        );
      }
      catch {
        setError(
          "Unable to verify owner setup.",
        );
      }
      finally {
        setChecking(false);
      }
    }

    void checkSetup();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      password !== confirmPassword
    ) {
      setError(
        "The passwords do not match.",
      );

      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/setup",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            displayName,
            email,
            password,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ??
            "Unable to create owner account.",
        );

        setLoading(false);
        return;
      }

      const supabase =
        createClient();

      const {
        error: loginError,
      } =
        await supabase.auth
          .signInWithPassword({
            email,
            password,
          });

      if (loginError) {
        router.replace(
          "/admin/login",
        );

        return;
      }

      router.replace("/admin");
      router.refresh();
    }
    catch {
      setError(
        "Unable to complete owner setup.",
      );

      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#11110f] text-[#f5f0e6]">
        <p className="text-xs tracking-[0.2em] text-white/40 uppercase">
          Checking system setup
        </p>
      </main>
    );
  }

  if (!available) {
    return (
      <main className="min-h-screen bg-[#11110f] px-5 py-6 text-[#f5f0e6] sm:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col">
          <header className="border-b border-white/10 pb-6">
            <Link
              href="/"
              className="text-xs font-semibold tracking-[0.25em] uppercase"
            >
              Ellipsis
            </Link>
          </header>

          <div className="my-auto max-w-2xl py-20">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#c6a777] uppercase">
              Setup complete
            </p>

            <h1 className="mt-5 text-5xl font-medium tracking-[-0.05em]">
              The owner account has already been created.
            </h1>

            <Link
              href="/admin/login"
              className="mt-8 inline-flex rounded-full bg-[#f5f0e6] px-6 py-3 text-sm font-medium text-[#151512]"
            >
              Admin sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#11110f] px-5 py-6 text-[#f5f0e6] sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1300px] flex-col">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link
            href="/"
            className="text-xs font-semibold tracking-[0.25em] uppercase"
          >
            Ellipsis
          </Link>

          <span className="text-xs tracking-[0.16em] text-white/35 uppercase">
            Initial Owner Setup
          </span>
        </header>

        <section className="my-auto grid gap-14 py-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-[#c6a777] uppercase">
              Phase 03
            </p>

            <h1 className="mt-5 max-w-3xl text-5xl leading-[0.96] font-medium tracking-[-0.055em] sm:text-7xl">
              Establish the studio owner.
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-white/45">
              This screen works only once.
              After the first ELLIPSIS owner
              is created, server-side setup
              locks automatically.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8"
          >
            <div>
              <label className="text-xs text-white/45">
                Display name
              </label>

              <input
                required
                value={displayName}
                onChange={(event) =>
                  setDisplayName(
                    event.target.value,
                  )
                }
                className="mt-2 w-full border-0 border-b border-white/15 bg-transparent py-4 text-lg outline-none focus:border-white/60"
                placeholder="Sikatu"
              />
            </div>

            <div className="mt-6">
              <label className="text-xs text-white/45">
                Owner email
              </label>

              <input
                required
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                className="mt-2 w-full border-0 border-b border-white/15 bg-transparent py-4 text-lg outline-none focus:border-white/60"
                placeholder="you@example.com"
              />
            </div>

            <div className="mt-6">
              <label className="text-xs text-white/45">
                Password
              </label>

              <input
                required
                minLength={12}
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                className="mt-2 w-full border-0 border-b border-white/15 bg-transparent py-4 text-lg outline-none focus:border-white/60"
                placeholder="At least 12 characters"
              />
            </div>

            <div className="mt-6">
              <label className="text-xs text-white/45">
                Confirm password
              </label>

              <input
                required
                minLength={12}
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
                className="mt-2 w-full border-0 border-b border-white/15 bg-transparent py-4 text-lg outline-none focus:border-white/60"
                placeholder="Repeat password"
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
              className="mt-8 w-full rounded-full bg-[#f5f0e6] px-6 py-3.5 text-sm font-medium text-[#151512] disabled:opacity-50"
            >
              {loading
                ? "Creating owner..."
                : "Create owner account"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}