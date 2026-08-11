"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function randomToken() {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) =>
      byte.toString(16).padStart(2, "0"),
    )
    .join("");
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded,
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) =>
      byte.toString(16).padStart(2, "0"),
    )
    .join("");
}

export default function CreateDiscovery({
  userId,
}: {
  userId: string;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [brandName, setBrandName] =
    useState("");

  const [contactName, setContactName] =
    useState("");

  const [email, setEmail] = useState("");

  const [website, setWebsite] =
    useState("");

  const [creating, setCreating] =
    useState(false);

  const [error, setError] = useState("");

  const [inviteUrl, setInviteUrl] =
    useState("");

  async function createDiscovery(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setCreating(true);
    setError("");
    setInviteUrl("");

    const supabase = createClient();

    const { data: client, error: clientError } =
      await supabase
        .from("clients")
        .insert({
          created_by: userId,
          brand_name: brandName.trim(),
          contact_name:
            contactName.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
        })
        .select("id")
        .single();

    if (clientError || !client) {
      setError(
        clientError?.message ??
          "Could not create client.",
      );

      setCreating(false);
      return;
    }

    const token = randomToken();
    const tokenHash = await sha256(token);

    const {
      error: projectError,
    } = await supabase
      .from("discovery_projects")
      .insert({
        client_id: client.id,
        created_by: userId,
        title: "Brand Discovery",
        token_hash: tokenHash,
        status: "sent",
      });

    if (projectError) {
      await supabase
        .from("clients")
        .delete()
        .eq("id", client.id);

      setError(projectError.message);
      setCreating(false);
      return;
    }

    const link =
      `${window.location.origin}/discovery/${token}`;

    setInviteUrl(link);

    setBrandName("");
    setContactName("");
    setEmail("");
    setWebsite("");

    setCreating(false);

    router.refresh();
  }

  async function copyLink() {
    if (!inviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(
      inviteUrl,
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-[#f5f0e6] px-5 py-3 text-sm font-medium text-[#151512] transition hover:bg-white"
      >
        + New discovery
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#181815] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#c7a675] uppercase">
              New Discovery
            </p>

            <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em]">
              Create a client.
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setInviteUrl("");
              setError("");
            }}
            className="text-sm text-white/40 transition hover:text-white"
          >
            Close
          </button>
        </div>

        {inviteUrl ? (
          <div className="mt-9">
            <div className="rounded-2xl border border-[#c5a473]/20 bg-[#c5a473]/[0.06] p-5">
              <p className="text-xs font-semibold tracking-[0.15em] text-[#c9a777] uppercase">
                Private Invitation Created
              </p>

              <p className="mt-4 text-sm leading-7 text-white/55">
                Copy this link now. For security,
                only its cryptographic hash is stored
                in the database.
              </p>

              <div className="mt-5 break-all rounded-xl bg-black/25 p-4 text-sm text-white/75">
                {inviteUrl}
              </div>

              <button
                type="button"
                onClick={copyLink}
                className="mt-5 rounded-full bg-[#f5f0e6] px-5 py-3 text-sm font-medium text-[#151512]"
              >
                Copy invitation link
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={createDiscovery}
            className="mt-9"
          >
            <div>
              <label className="text-xs text-white/40">
                Brand / Business Name *
              </label>

              <input
                required
                value={brandName}
                onChange={(event) =>
                  setBrandName(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 outline-none transition focus:border-white/30"
                placeholder="LMNTL Studio"
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-xs text-white/40">
                  Contact Name
                </label>

                <input
                  value={contactName}
                  onChange={(event) =>
                    setContactName(
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 outline-none transition focus:border-white/30"
                  placeholder="Client name"
                />
              </div>

              <div>
                <label className="text-xs text-white/40">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 outline-none transition focus:border-white/30"
                  placeholder="client@example.com"
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="text-xs text-white/40">
                Website
              </label>

              <input
                value={website}
                onChange={(event) =>
                  setWebsite(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3.5 outline-none transition focus:border-white/30"
                placeholder="https://example.com"
              />
            </div>

            {error && (
              <p className="mt-5 text-sm text-[#e79d8e]">
                {error}
              </p>
            )}

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="rounded-full bg-[#f5f0e6] px-6 py-3 text-sm font-medium text-[#151512] disabled:opacity-50"
              >
                {creating
                  ? "Creating..."
                  : "Create discovery"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}