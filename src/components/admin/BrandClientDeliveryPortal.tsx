"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type AccessRecord = {
  id: string;

  project_id: string;

  status:
    | "active"
    | "revoked";

  token_version:
    number;

  expires_at:
    | string
    | null;

  last_accessed_at:
    | string
    | null;

  last_downloaded_at:
    | string
    | null;

  created_at:
    string;

  rotated_at:
    string;

  revoked_at:
    | string
    | null;

  updated_at:
    string;
};

type StatusPayload = {
  access:
    | AccessRecord
    | null;

  deliverableCount:
    number;

  token?:
    string;

  error?:
    string;
};

function formatDate(
  value:
    | string
    | null,
) {
  if (!value) {
    return "Never";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl
    .DateTimeFormat(
      "en",
      {
        month:
          "short",

        day:
          "numeric",

        year:
          "numeric",

        hour:
          "numeric",

        minute:
          "2-digit",
      },
    )
    .format(
      date,
    );
}

export default function BrandClientDeliveryPortal({
  projectId,
}: {
  projectId: string;
}) {
  const [
    access,
    setAccess,
  ] =
    useState<
      AccessRecord | null
    >(
      null,
    );

  const [
    deliverableCount,
    setDeliverableCount,
  ] =
    useState(
      0,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    busy,
    setBusy,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    privateUrl,
    setPrivateUrl,
  ] =
    useState(
      "",
    );

  const [
    copied,
    setCopied,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const loadStatus =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/admin/delivery-access?projectId=${encodeURIComponent(
                projectId,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            await response.json() as
              StatusPayload;

          if (
            !response.ok
          ) {
            throw new Error(
              payload.error ||
                "Could not load client delivery.",
            );
          }

          setAccess(
            payload.access ??
              null,
          );

          setDeliverableCount(
            payload.deliverableCount ??
              0,
          );
        }
        catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load client delivery.",
          );
        }
        finally {
          setLoading(
            false,
          );
        }
      },
      [
        projectId,
      ],
    );

  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            void loadStatus();
          },
          0,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    },
    [
      loadStatus,
    ],
  );

  async function mutate(
    action:
      | "activate"
      | "rotate"
      | "revoke",
  ) {
    if (
      action ===
        "rotate" &&
      !window.confirm(
        "Rotate the client delivery link? The previous private link will stop working immediately.",
      )
    ) {
      return;
    }

    if (
      action ===
        "revoke" &&
      !window.confirm(
        "Revoke client delivery access? Issued files remain preserved in the studio vault.",
      )
    ) {
      return;
    }

    setBusy(
      action,
    );

    setError(
      null,
    );

    setCopied(
      false,
    );

    try {
      const response =
        await fetch(
          "/api/admin/delivery-access",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,

                projectId,
              }),
          },
        );

      const payload =
        await response.json() as
          StatusPayload;

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Client delivery action failed.",
        );
      }

      setAccess(
        payload.access ??
          null,
      );

      if (
        typeof payload.deliverableCount ===
          "number"
      ) {
        setDeliverableCount(
          payload.deliverableCount,
        );
      }

      if (
        payload.token
      ) {
        setPrivateUrl(
          `${window.location.origin}/delivery/${payload.token}`,
        );
      }
      else if (
        action ===
        "revoke"
      ) {
        setPrivateUrl(
          "",
        );
      }
    }
    catch (
      actionError
    ) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Client delivery action failed.",
      );
    }
    finally {
      setBusy(
        null,
      );
    }
  }

  async function copyLink() {
    if (
      !privateUrl
    ) {
      return;
    }

    await navigator
      .clipboard
      .writeText(
        privateUrl,
      );

    setCopied(
      true,
    );

    window.setTimeout(
      () => {
        setCopied(
          false,
        );
      },
      1800,
    );
  }

  const isActive =
    access?.status ===
    "active";

  const canActivate =
    deliverableCount >
    0;

  return (
    <div className="mt-12 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6 sm:p-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#c5a577] uppercase">
            Client Delivery
          </p>

          <h3 className="mt-2 text-2xl font-medium">
            Private client portal.
          </h3>

          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/35">
            Give the client a private, rotatable link to issued deliverables only. Drafts, reviews, AI work, and studio notes never enter this surface.
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-4 py-2 text-[10px] ${
            isActive
              ? "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-200/70"
              : "border-white/10 text-white/35"
          }`}
        >
          {
            loading
              ? "Checking..."
              : isActive
                ? "Active"
                : access
                  ? "Revoked"
                  : "Not activated"
          }
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-white/20 uppercase">
            Issued files
          </p>

          <p className="mt-2 text-xl text-white/75">
            {
              deliverableCount
            }
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-white/20 uppercase">
            Last client view
          </p>

          <p className="mt-2 text-xs leading-5 text-white/55">
            {
              formatDate(
                access
                  ?.last_accessed_at ??
                  null,
              )
            }
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-white/20 uppercase">
            Last download
          </p>

          <p className="mt-2 text-xs leading-5 text-white/55">
            {
              formatDate(
                access
                  ?.last_downloaded_at ??
                  null,
              )
            }
          </p>
        </div>
      </div>

      {!loading &&
        !canActivate && (
        <div className="mt-6 rounded-xl border border-white/[0.07] px-4 py-4 text-xs leading-6 text-white/25">
          Client delivery is locked until at least one sealed report has been issued.
        </div>
      )}

      {!loading &&
        canActivate &&
        !isActive && (
        <div className="mt-6 rounded-xl border border-[#c5a577]/15 bg-[#c5a577]/[0.035] p-5">
          <p className="text-xs font-medium text-white/65">
            Issued material is ready for private delivery.
          </p>

          <p className="mt-2 max-w-xl text-xs leading-6 text-white/30">
            Activation generates a new 256-bit access token. Only its SHA-256 hash is retained by ELLIPSIS.
          </p>

          <button
            type="button"
            disabled={
              busy !==
              null
            }
            onClick={() =>
              void mutate(
                access
                  ? "rotate"
                  : "activate",
              )
            }
            className="mt-4 rounded-xl bg-[#f4f0e8] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {
              busy
                ? "Generating..."
                : access
                  ? "Generate replacement link"
                  : "Activate client portal"
            }
          </button>
        </div>
      )}

      {isActive && (
        <div className="mt-6 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.025] p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-medium text-white/65">
                Client delivery is active.
              </p>

              <p className="mt-2 text-xs leading-6 text-white/30">
                Token version {
                  access
                    ?.token_version
                }. Rotate the link if access needs to be replaced, or revoke it without affecting issued files.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  busy !==
                  null
                }
                onClick={() =>
                  void mutate(
                    "rotate",
                  )
                }
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white/80 disabled:opacity-50"
              >
                {
                  busy ===
                    "rotate"
                    ? "Rotating..."
                    : "Rotate link"
                }
              </button>

              <button
                type="button"
                disabled={
                  busy !==
                  null
                }
                onClick={() =>
                  void mutate(
                    "revoke",
                  )
                }
                className="rounded-xl border border-red-300/10 px-4 py-2.5 text-xs text-red-100/55 transition hover:border-red-300/20 hover:text-red-100/80 disabled:opacity-50"
              >
                {
                  busy ===
                    "revoke"
                    ? "Revoking..."
                    : "Revoke access"
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {privateUrl && (
        <div className="mt-6 rounded-xl border border-[#c5a577]/20 bg-[#c5a577]/[0.04] p-5">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#d9bd94] uppercase">
            New private link
          </p>

          <p className="mt-2 text-xs leading-6 text-white/35">
            Copy this link now. The raw token is not stored and cannot be recovered after this page reloads.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-[10px] leading-5 break-all text-white/45">
              {
                privateUrl
              }
            </div>

            <button
              type="button"
              onClick={() =>
                void copyLink()
              }
              className="shrink-0 rounded-xl bg-[#f4f0e8] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white"
            >
              {
                copied
                  ? "Copied"
                  : "Copy link"
              }
            </button>
          </div>
        </div>
      )}

      {isActive &&
        !privateUrl && (
        <p className="mt-5 text-[10px] leading-5 text-white/20">
          The current raw access token is intentionally unrecoverable. Use Rotate link whenever you need a fresh shareable URL.
        </p>
      )}

      {access && (
        <div className="mt-6 border-t border-white/[0.07] pt-5 text-[10px] leading-5 text-white/20">
          Activated {
            formatDate(
              access.created_at,
            )
          }
          {" | "}
          Link version updated {
            formatDate(
              access.rotated_at,
            )
          }
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl border border-red-300/15 bg-red-300/[0.04] px-4 py-3 text-xs leading-6 text-red-100/70">
          {
            error
          }
        </div>
      )}
    </div>
  );
}