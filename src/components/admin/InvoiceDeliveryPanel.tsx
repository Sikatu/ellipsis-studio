"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type InvoiceStatus =
  | "draft"
  | "issued"
  | "paid"
  | "void";

type DeliveryAccess = {
  id: string;
  invoice_id: string;
  status:
    | "active"
    | "revoked";
  token_version: number;
  expires_at: string | null;
  last_accessed_at: string | null;
  last_downloaded_at: string | null;
  created_at: string;
  rotated_at: string;
  revoked_at: string | null;
  updated_at: string;
};

type DeliveryEvent = {
  id: string;
  event_type:
    | "access_activated"
    | "link_rotated"
    | "access_revoked"
    | "portal_viewed"
    | "pdf_downloaded";
  actor_type:
    | "admin"
    | "client"
    | "system";
  token_version: number | null;
  metadata: unknown;
  occurred_at: string;
  created_at: string;
};

type DeliveryPayload = {
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    shareable: boolean;
    recipientEmail: string;
  };
  access?:
    DeliveryAccess |
    null;
  events?:
    DeliveryEvent[];
  token?:
    string | null;
  relativeUrl?:
    string | null;
  error?: string;
};

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Not yet";
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

  return date.toLocaleString(
    undefined,
    {
      year:
        "numeric",
      month:
        "short",
      day:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
    },
  );
}

function eventLabel(
  event:
    DeliveryEvent["event_type"],
) {
  switch (
    event
  ) {
    case "access_activated":
      return "Secure link created";

    case "link_rotated":
      return "Link replaced";

    case "access_revoked":
      return "Access revoked";

    case "portal_viewed":
      return "Invoice viewed";

    case "pdf_downloaded":
      return "PDF downloaded";
  }
}

export default function InvoiceDeliveryPanel({
  invoiceId,
  invoiceNumber,
  invoiceStatus,
}: {
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus:
    InvoiceStatus;
}) {
  const [
    state,
    setState,
  ] =
    useState<
      DeliveryPayload |
      null
    >(
      null,
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
      "activate" |
      "rotate" |
      "revoke" |
      "copy" |
      null
    >(
      null,
    );

  const [
    shareUrl,
    setShareUrl,
  ] =
    useState(
      "",
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const response =
            await fetch(
              `/api/admin/invoices/${invoiceId}/delivery`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            await response
              .json() as
              DeliveryPayload;

          if (
            !response.ok
          ) {
            throw new Error(
              payload.error ||
                "Could not load secure delivery.",
            );
          }

          setState(
            payload,
          );
        } catch (
          loadError
        ) {
          setMessage(
            loadError instanceof
              Error
              ? loadError.message
              : "Could not load secure delivery.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        invoiceId,
      ],
    );

  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            void load();
          },
          0,
        );

      return () => {
        window.clearTimeout(
          timer,
        );
      };
    },
    [
      load,
      invoiceStatus,
    ],
  );

  useEffect(
    () => {
      function refreshDelivery(
        event: Event,
      ) {
        const detail =
          (
            event as
              CustomEvent<{
                invoiceId?:
                  string;
              }>
          ).detail;

        if (
          detail
            ?.invoiceId ===
          invoiceId
        ) {
          void load();
        }
      }

      window.addEventListener(
        "ellipsis:invoice-delivery-changed",
        refreshDelivery,
      );

      return () => {
        window.removeEventListener(
          "ellipsis:invoice-delivery-changed",
          refreshDelivery,
        );
      };
    },
    [
      invoiceId,
      load,
    ],
  );

  async function runAction(
    action:
      "activate" |
      "rotate" |
      "revoke",
  ) {
    if (
      action ===
        "rotate" &&
      !window.confirm(
        `Replace the secure link for ${invoiceNumber}? The previous link will stop working immediately.`,
      )
    ) {
      return;
    }

    if (
      action ===
        "revoke" &&
      !window.confirm(
        `Revoke secure access to ${invoiceNumber}? The current client link will stop working immediately.`,
      )
    ) {
      return;
    }

    setBusy(
      action,
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/invoices/${invoiceId}/delivery`,
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
              }),
          },
        );

      const payload =
        await response
          .json() as
          DeliveryPayload;

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Could not update secure delivery.",
        );
      }

      setState(
        payload,
      );

      if (
        payload.token &&
        payload.relativeUrl
      ) {
        const url =
          `${window.location.origin}${payload.relativeUrl}`;

        setShareUrl(
          url,
        );

        setMessage(
          action ===
            "activate"
            ? "Secure link created. Copy it now; the plaintext token is not stored."
            : "New secure link created. The previous link is now invalid.",
        );
      } else {
        setShareUrl(
          "",
        );

        setMessage(
          "Secure invoice access revoked.",
        );
      }
    } catch (
      actionError
    ) {
      setMessage(
        actionError instanceof
          Error
          ? actionError.message
          : "Could not update secure delivery.",
      );
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function copyLink() {
    if (!shareUrl) {
      return;
    }

    setBusy(
      "copy",
    );

    try {
      if (
        navigator.clipboard
          ?.writeText
      ) {
        await navigator
          .clipboard
          .writeText(
            shareUrl,
          );

        setMessage(
          "Secure invoice link copied.",
        );
      } else {
        window.prompt(
          "Copy secure invoice link:",
          shareUrl,
        );
      }
    } catch {
      window.prompt(
        "Copy secure invoice link:",
        shareUrl,
      );
    } finally {
      setBusy(
        null,
      );
    }
  }

  if (
    loading &&
    !state
  ) {
    return (
      <section className="mt-8 rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
        <p className="text-sm text-white/35">
          Loading secure client delivery...
        </p>
      </section>
    );
  }

  const access =
    state?.access ??
    null;

  const events =
    state?.events ??
    [];

  const shareable =
    state?.invoice
      ?.shareable ??
    (
      invoiceStatus ===
        "issued" ||
      invoiceStatus ===
        "paid"
    );

  return (
    <section className="mt-8 rounded-[28px] border border-[#c8ad84]/15 bg-[#c8ad84]/[0.025] p-6 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#d8bf99]/50">
            Client Access
          </p>

          <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
            Give the client private access to this invoice.
          </h2>

          <p className="mt-3 text-xs leading-6 text-white/38">
            The client link opens a read-only invoice view and sealed PDF. For security, ELLIPSIS stores only a hash of the token, so a link can be copied only when it is first created or replaced.
          </p>

          {state?.invoice
            ?.recipientEmail && (
            <p className="mt-3 text-[10px] text-white/28">
              Billing email on invoice:{" "}
              {
                state.invoice
                  .recipientEmail
              }
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!access &&
            shareable && (
            <button
              type="button"
              disabled={
                busy !==
                null
              }
              onClick={() =>
                void runAction(
                  "activate",
                )
              }
              className="rounded-xl bg-[#f4f0e8] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white disabled:opacity-40"
            >
              {
                busy ===
                  "activate"
                  ? "Creating..."
                  : "Create Client Link"
              }
            </button>
          )}

          {access?.status ===
            "active" && (
            <>
              <button
                type="button"
                disabled={
                  busy !==
                    null
                }
                onClick={() =>
                  void runAction(
                    "rotate",
                  )
                }
                className="rounded-xl border border-[#c8ad84]/20 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#d8bf99]/60 transition hover:border-[#c8ad84]/35 hover:text-[#ead6b5] disabled:opacity-40"
              >
                {
                  busy ===
                    "rotate"
                    ? "Replacing..."
                    : "Replace Client Link"
                }
              </button>

              <button
                type="button"
                disabled={
                  busy !==
                    null
                }
                onClick={() =>
                  void runAction(
                    "revoke",
                  )
                }
                className="rounded-xl border border-rose-200/15 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-rose-100/45 transition hover:border-rose-200/25 hover:text-rose-100/65 disabled:opacity-40"
              >
                {
                  busy ===
                    "revoke"
                    ? "Revoking..."
                    : "Revoke Access"
                }
              </button>
            </>
          )}

          {access?.status ===
            "revoked" &&
            shareable && (
            <button
              type="button"
              disabled={
                busy !==
                  null
              }
              onClick={() =>
                void runAction(
                  "rotate",
                )
              }
              className="rounded-xl bg-[#f4f0e8] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white disabled:opacity-40"
            >
              {
                busy ===
                  "rotate"
                  ? "Creating..."
                  : "Create New Client Link"
              }
            </button>
          )}
        </div>
      </div>

      {!shareable &&
        invoiceStatus ===
          "draft" && (
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-4 text-xs leading-6 text-white/34">
          Issue this invoice before creating a secure client link.
        </div>
      )}

      {!shareable &&
        invoiceStatus ===
          "void" && (
        <div className="mt-6 rounded-2xl border border-rose-200/10 bg-rose-200/[0.025] px-4 py-4 text-xs leading-6 text-rose-100/42">
          Client delivery is unavailable for a void invoice. Any active link is rejected, and S8 revokes it during the void workflow.
        </div>
      )}

      {shareUrl && (
        <div className="mt-6 rounded-2xl border border-emerald-200/12 bg-emerald-200/[0.025] p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-100/45">
            New client link - copy now
          </p>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              readOnly
              value={
                shareUrl
              }
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 font-mono text-[10px] text-white/48 outline-none"
            />

            <button
              type="button"
              disabled={
                busy !==
                  null
              }
              onClick={() =>
                void copyLink()
              }
              className="rounded-xl border border-emerald-200/15 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-100/55"
            >
              {
                busy ===
                  "copy"
                  ? "Copying..."
                  : "Copy Link"
              }
            </button>

            <a
              href={
                shareUrl
              }
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/10 px-4 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-white/45 transition hover:text-white/65"
            >
              Open Client View
            </a>
          </div>
        </div>
      )}

      {access?.status ===
        "active" &&
        !shareUrl && (
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-4 text-xs leading-6 text-white/34">
          Client access is active. The existing URL cannot be revealed again because ELLIPSIS does not store the plaintext token. Replace the client link only when you need a fresh copy or want to invalidate the previous URL.
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-2xl border border-[#c8ad84]/12 bg-black/10 px-4 py-3 text-xs leading-6 text-[#ead6b5]/62">
          {
            message
          }
        </div>
      )}

      {access && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Access"
            value={
              access.status
            }
          />

          <Metric
            label="Token version"
            value={
              `v${access.token_version}`
            }
          />

          <Metric
            label="Last viewed"
            value={
              formatDate(
                access.last_accessed_at,
              )
            }
          />

          <Metric
            label="Last PDF download"
            value={
              formatDate(
                access.last_downloaded_at,
              )
            }
          />
        </div>
      )}

      {events.length >
        0 && (
        <div className="mt-7 border-t border-white/[0.07] pt-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
              Delivery History
            </p>

            <span className="text-[9px] text-white/22">
              Latest{" "}
              {
                Math.min(
                  events.length,
                  8,
                )
              }
            </span>
          </div>

          <div className="mt-3 divide-y divide-white/[0.055]">
            {events
              .slice(
                0,
                8,
              )
              .map(
                (
                  event,
                ) => (
                  <div
                    key={
                      event.id
                    }
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-xs text-white/46">
                        {
                          eventLabel(
                            event.event_type,
                          )
                        }
                      </p>

                      <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-white/22">
                        {
                          event.actor_type
                        }{" "}
                        / v
                        {
                          event.token_version ??
                          "-"
                        }
                      </p>
                    </div>

                    <p className="text-[10px] text-white/28">
                      {
                        formatDate(
                          event.occurred_at,
                        )
                      }
                    </p>
                  </div>
                ),
              )}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-4">
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/24">
        {
          label
        }
      </p>

      <p className="mt-2 text-xs text-white/46">
        {
          value
        }
      </p>
    </div>
  );
}