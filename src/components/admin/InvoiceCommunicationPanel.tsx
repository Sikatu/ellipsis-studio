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

type EmailPurpose =
  | "invoice"
  | "payment_reminder";

type EmailDelivery = {
  id: string;
  purpose:
    EmailPurpose;
  trigger_type:
    | "manual"
    | "scheduled";
  recipient_email: string;
  subject: string;
  body_template: string;
  provider: string;
  provider_message_id:
    string | null;
  status:
    | "attempting"
    | "sent"
    | "failed";
  token_version: number;
  attempted_at: string;
  sent_at:
    string | null;
  error_code:
    string | null;
  error_message:
    string | null;
};

type EmailAutomation = {
  invoice_id: string;
  enabled: boolean;
  send_at:
    string | null;
  subject_template: string;
  body_template: string;
  created_at: string;
  updated_at: string;
};

type EmailWorkspace = {
  invoice?: {
    id: string;
    invoiceNumber: string;
    status:
      InvoiceStatus;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    totalCents: number;
    clientName: string;
    recipientEmail: string;
    studioName: string;
    finalPdfReady: boolean;
  };
  provider?: {
    mode:
      | "disabled"
      | "sandbox"
      | "live";
    provider: string;
    configured: boolean;
    sendingEnabled:
      boolean;
    missingConfiguration:
      string[];
    publicAppUrlConfigured:
      boolean;
    automationEnabled:
      boolean;
    automationRunnerReady:
      boolean;
  };
  templates?: {
    invoice: {
      subject: string;
      body: string;
    };
    paymentReminder: {
      subject: string;
      body: string;
    };
  };
  deliveries?:
    EmailDelivery[];
  automation?:
    EmailAutomation |
    null;
  sendResult?: {
    deliveryId: string;
    status: string;
    deduped: boolean;
  };
  error?: string;
  code?: string;
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

function localInputValue(
  value: string | null,
) {
  if (!value) {
    return "";
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
    return "";
  }

  const local =
    new Date(
      date.getTime() -
        date.getTimezoneOffset() *
          60_000,
    );

  return local
    .toISOString()
    .slice(
      0,
      16,
    );
}

function statusLabel(
  status:
    EmailDelivery["status"],
) {
  switch (
    status
  ) {
    case "sent":
      return "Sent";

    case "failed":
      return "Failed";

    default:
      return "Sending";
  }
}

function purposeLabel(
  purpose:
    EmailPurpose,
) {
  return purpose ===
    "payment_reminder"
    ? "Payment reminder"
    : "Invoice email";
}

function triggerLabel(
  trigger:
    EmailDelivery["trigger_type"],
) {
  return trigger ===
    "scheduled"
    ? "Automatic"
    : "Manual";
}

function requestId() {
  if (
    typeof crypto !==
      "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto
      .randomUUID();
  }

  return [
    Date.now()
      .toString(
        16,
      ),
    Math.random()
      .toString(
        16,
      )
      .slice(
        2,
      ),
  ].join(
    "-",
  );
}

export default function InvoiceCommunicationPanel({
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
      EmailWorkspace |
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
      "send" |
      "automation" |
      null
    >(
      null,
    );

  const [
    purpose,
    setPurpose,
  ] =
    useState<
      EmailPurpose
    >(
      "invoice",
    );

  const [
    subject,
    setSubject,
  ] =
    useState(
      "",
    );

  const [
    body,
    setBody,
  ] =
    useState(
      "",
    );

  const [
    sendAt,
    setSendAt,
  ] =
    useState(
      "",
    );

  const [
    automationSubject,
    setAutomationSubject,
  ] =
    useState(
      "",
    );

  const [
    automationBody,
    setAutomationBody,
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

  const applyState =
    useCallback(
      (
        payload:
          EmailWorkspace,
        {
          preserveComposer =
            false,
        }: {
          preserveComposer?:
            boolean;
        } = {},
      ) => {
        setState(
          payload,
        );

        const templates =
          payload.templates;

        if (
          templates &&
          !preserveComposer
        ) {
          setSubject(
            templates.invoice.subject,
          );

          setBody(
            templates.invoice.body,
          );
        }

        const automation =
          payload.automation;

        setSendAt(
          localInputValue(
            automation
              ?.send_at ??
            null,
          ),
        );

        setAutomationSubject(
          automation
            ?.subject_template ??
          templates
            ?.paymentReminder
            .subject ??
          "",
        );

        setAutomationBody(
          automation
            ?.body_template ??
          templates
            ?.paymentReminder
            .body ??
          "",
        );
      },
      [],
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
              `/api/admin/invoices/${invoiceId}/email`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            await response
              .json() as
              EmailWorkspace;

          if (
            !response.ok
          ) {
            throw new Error(
              payload.error ||
                "Could not load invoice communication.",
            );
          }

          applyState(
            payload,
          );

          setMessage(
            null,
          );
        } catch (
          loadError
        ) {
          setMessage(
            loadError instanceof
              Error
              ? loadError.message
              : "Could not load invoice communication.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        applyState,
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

  const provider =
    state?.provider;

  const effectiveStatus =
    state?.invoice
      ?.status ??
    invoiceStatus;

  const canSend =
    effectiveStatus ===
      "issued" &&
    Boolean(
      state?.invoice
        ?.finalPdfReady,
    ) &&
    Boolean(
      state?.invoice
        ?.recipientEmail,
    ) &&
    Boolean(
      provider
        ?.sendingEnabled,
    );

  const deliveries =
    state?.deliveries ??
    [];

  const automation =
    state?.automation ??
    null;

  const priorInvoiceSend =
    deliveries.some(
      (
        delivery,
      ) =>
        delivery.purpose ===
          "invoice" &&
        delivery.status ===
          "sent",
    );

  function choosePurpose(
    nextPurpose:
      EmailPurpose,
  ) {
    setPurpose(
      nextPurpose,
    );

    const templates =
      state?.templates;

    if (!templates) {
      return;
    }

    const selected =
      nextPurpose ===
        "payment_reminder"
        ? templates
            .paymentReminder
        : templates
            .invoice;

    setSubject(
      selected.subject,
    );

    setBody(
      selected.body,
    );
  }

  async function sendEmail() {
    if (!canSend) {
      return;
    }

    const label =
      purpose ===
        "payment_reminder"
        ? "payment reminder"
        : priorInvoiceSend
          ? "replacement invoice email"
          : "invoice email";

    const warning =
      priorInvoiceSend &&
      purpose ===
        "invoice"
        ? `Send a ${label} for ${invoiceNumber}? A fresh secure link will replace the previous invoice link.`
        : `Send this ${label} for ${invoiceNumber}?`;

    if (
      !window.confirm(
        warning,
      )
    ) {
      return;
    }

    setBusy(
      "send",
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/invoices/${invoiceId}/email`,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                purpose,
                requestId:
                  requestId(),
                subjectTemplate:
                  subject,
                bodyTemplate:
                  body,
              }),
          },
        );

      const payload =
        await response
          .json() as
          EmailWorkspace;

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Could not send invoice email.",
        );
      }

      applyState(
        payload,
        {
          preserveComposer:
            true,
        },
      );

      setMessage(
        payload.sendResult
          ?.deduped
          ? "This send request was already processed; no duplicate email was created."
          : purpose ===
              "payment_reminder"
            ? "Payment reminder sent and recorded in the invoice communication history."
            : "Invoice email sent with a fresh secure client link.",
      );

      window.dispatchEvent(
        new CustomEvent(
          "ellipsis:invoice-delivery-changed",
          {
            detail: {
              invoiceId,
            },
          },
        ),
      );

      window.dispatchEvent(
        new CustomEvent(
          "ellipsis:invoice-follow-up-changed",
          {
            detail: {
              invoiceId,
            },
          },
        ),
      );
    } catch (
      sendError
    ) {
      setMessage(
        sendError instanceof
          Error
          ? sendError.message
          : "Could not send invoice email.",
      );

      await load();
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function saveAutomation(
    enabled: boolean,
  ) {
    if (
      enabled &&
      !provider
        ?.automationRunnerReady
    ) {
      return;
    }

    if (
      enabled &&
      !window.confirm(
        `Enable an automatic payment reminder for ${invoiceNumber}? It will send without another approval at the scheduled time, but only while the invoice is still issued and unpaid.`,
      )
    ) {
      return;
    }

    if (
      !enabled &&
      automation?.enabled &&
      !window.confirm(
        `Disable the automatic reminder for ${invoiceNumber}?`,
      )
    ) {
      return;
    }

    setBusy(
      "automation",
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/invoices/${invoiceId}/email`,
          {
            method:
              "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                enabled,
                sendAt:
                  sendAt
                    ? new Date(
                        sendAt,
                      ).toISOString()
                    : null,
                subjectTemplate:
                  automationSubject,
                bodyTemplate:
                  automationBody,
              }),
          },
        );

      const payload =
        await response
          .json() as
          EmailWorkspace;

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Could not save automatic reminder.",
        );
      }

      applyState(
        payload,
        {
          preserveComposer:
            true,
        },
      );

      setMessage(
        enabled
          ? `Automatic payment reminder enabled for ${formatDate(payload.automation?.send_at ?? null)}.`
          : "Automatic payment reminder disabled.",
      );
    } catch (
      automationError
    ) {
      setMessage(
        automationError instanceof
          Error
          ? automationError.message
          : "Could not save automatic reminder.",
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
          Loading invoice communication...
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-[28px] border border-[#c8ad84]/15 bg-[#161612] p-6 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#d8bf99]/50">
              Invoice Communication
            </p>

            <span
              className={[
                "rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em]",
                provider?.sendingEnabled
                  ? "border-emerald-200/15 bg-emerald-200/[0.04] text-emerald-100/55"
                  : "border-amber-200/15 bg-amber-200/[0.04] text-amber-100/55",
              ].join(
                " ",
              )}
            >
              {provider?.sendingEnabled
                ? `${provider.mode} ready`
                : "Provider setup needed"}
            </span>
          </div>

          <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
            Send the invoice and payment reminders from the same record.
          </h2>

          <p className="mt-3 text-xs leading-6 text-white/38">
            Every successful send creates a fresh secure invoice link in memory, stores only its hash through S8, and records the provider result without saving the bearer token.
          </p>
        </div>

        <div className="min-w-[240px] space-y-2 text-xs text-white/36">
          <div className="flex justify-between gap-5 border-b border-white/[0.06] pb-2">
            <span>
              Recipient
            </span>

            <span className="max-w-[180px] truncate text-right text-white/52">
              {state?.invoice
                ?.recipientEmail ||
                "Missing"}
            </span>
          </div>

          <div className="flex justify-between gap-5 border-b border-white/[0.06] pb-2">
            <span>
              Provider
            </span>

            <span className="capitalize text-white/52">
              {provider
                ?.provider ||
                "Not ready"}
            </span>
          </div>

          <div className="flex justify-between gap-5">
            <span>
              Auto runner
            </span>

            <span className="text-right text-white/52">
              {provider
                ?.automationRunnerReady
                ? "Ready"
                : "Not configured"}
            </span>
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-5 rounded-2xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.035] px-4 py-3 text-xs leading-6 text-[#ead6b5]/65">
          {message}
        </div>
      )}

      {!provider?.sendingEnabled && (
        <div className="mt-6 rounded-2xl border border-amber-200/12 bg-amber-200/[0.025] p-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-100/50">
            Email sending locked
          </p>

          <p className="mt-2 text-xs leading-6 text-amber-50/42">
            Add the server-only email configuration before sending. Required right now:{" "}
            {(provider
              ?.missingConfiguration ??
              []).join(
                ", ",
              ) ||
              "provider credentials"}
            .
          </p>
        </div>
      )}

      {effectiveStatus !==
        "issued" && (
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-4 text-xs leading-6 text-white/34">
          {effectiveStatus ===
            "draft"
            ? "Issue this invoice before sending it by email."
            : `This invoice is ${effectiveStatus}. Invoice emails and payment reminders are blocked after payment or voiding.`}
        </div>
      )}

      <div className="mt-7 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[22px] border border-white/[0.07] bg-black/10 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Manual send
              </p>

              <p className="mt-2 text-xs leading-5 text-white/30">
                Review the message before every manual send.
              </p>
            </div>

            <div className="flex rounded-xl border border-white/[0.08] bg-[#11110f] p-1">
              <button
                type="button"
                onClick={() =>
                  choosePurpose(
                    "invoice",
                  )
                }
                className={[
                  "rounded-lg px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.08em] transition",
                  purpose ===
                    "invoice"
                    ? "bg-[#f4f0e8] text-[#11110f]"
                    : "text-white/34 hover:text-white/55",
                ].join(
                  " ",
                )}
              >
                Invoice
              </button>

              <button
                type="button"
                onClick={() =>
                  choosePurpose(
                    "payment_reminder",
                  )
                }
                className={[
                  "rounded-lg px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.08em] transition",
                  purpose ===
                    "payment_reminder"
                    ? "bg-[#f4f0e8] text-[#11110f]"
                    : "text-white/34 hover:text-white/55",
                ].join(
                  " ",
                )}
              >
                Reminder
              </button>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-[10px] text-white/36">
              Subject
            </span>

            <input
              value={
                subject
              }
              onChange={(
                event,
              ) =>
                setSubject(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none focus:border-[#c8ad84]/30"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-[10px] text-white/36">
              Message
            </span>

            <textarea
              rows={11}
              value={
                body
              }
              onChange={(
                event,
              ) =>
                setBody(
                  event.target.value,
                )
              }
              className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 font-mono text-xs leading-6 text-white/60 outline-none focus:border-[#c8ad84]/30"
            />
          </label>

          <p className="mt-3 text-[10px] leading-5 text-white/25">
            Supported: {"{{invoice_number}}"}, {"{{client_name}}"}, {"{{studio_name}}"}, {"{{amount}}"}, {"{{invoice_date}}"}, {"{{due_date}}"}, and {"{{secure_link}}"}. The secure link must stay in the message, never the subject.
          </p>

          <button
            type="button"
            disabled={
              busy !==
                null ||
              !canSend ||
              !subject.trim() ||
              !body.trim()
            }
            onClick={() =>
              void sendEmail()
            }
            className="mt-5 rounded-xl bg-[#f4f0e8] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy ===
              "send"
              ? "Sending..."
              : purpose ===
                  "payment_reminder"
                ? "Send Payment Reminder"
                : priorInvoiceSend
                  ? "Resend Invoice"
                  : "Send Invoice"}
          </button>

          {priorInvoiceSend &&
            purpose ===
              "invoice" && (
            <p className="mt-3 text-[10px] leading-5 text-white/28">
              Resending rotates the S8 secure link. The previous emailed invoice URL stops working immediately.
            </p>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-[22px] border border-white/[0.07] bg-black/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Automatic payment reminder
                </p>

                <p className="mt-2 text-xs leading-5 text-white/30">
                  Explicit opt-in only. The runner checks the invoice again before sending and the database disables automation when it becomes paid or void.
                </p>
              </div>

              <span
                className={[
                  "rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.09em]",
                  automation?.enabled
                    ? "border-emerald-200/15 bg-emerald-200/[0.04] text-emerald-100/55"
                    : "border-white/10 bg-white/[0.02] text-white/30",
                ].join(
                  " ",
                )}
              >
                {automation?.enabled
                  ? "Enabled"
                  : "Off"}
              </span>
            </div>

            <label className="mt-4 block">
              <span className="text-[10px] text-white/36">
                Send reminder at
              </span>

              <input
                type="datetime-local"
                value={
                  sendAt
                }
                onChange={(
                  event,
                ) =>
                  setSendAt(
                    event.target.value,
                  )
                }
                disabled={
                  effectiveStatus !==
                    "issued"
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none focus:border-[#c8ad84]/30 disabled:opacity-40"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-[10px] text-white/36">
                Reminder subject
              </span>

              <input
                value={
                  automationSubject
                }
                onChange={(
                  event,
                ) =>
                  setAutomationSubject(
                    event.target.value,
                  )
                }
                disabled={
                  effectiveStatus !==
                    "issued"
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none focus:border-[#c8ad84]/30 disabled:opacity-40"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-[10px] text-white/36">
                Reminder message
              </span>

              <textarea
                rows={7}
                value={
                  automationBody
                }
                onChange={(
                  event,
                ) =>
                  setAutomationBody(
                    event.target.value,
                  )
                }
                disabled={
                  effectiveStatus !==
                    "issued"
                }
                className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 font-mono text-xs leading-6 text-white/60 outline-none focus:border-[#c8ad84]/30 disabled:opacity-40"
              />
            </label>

            {!provider
              ?.automationRunnerReady && (
              <p className="mt-3 text-[10px] leading-5 text-amber-100/42">
                Automatic sending stays locked until the server has the provider, public app URL, automation enable flag, automation secret, and an external scheduler calling the protected runner.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {!automation
                ?.enabled ? (
                <button
                  type="button"
                  disabled={
                    busy !==
                      null ||
                    effectiveStatus !==
                      "issued" ||
                    !provider
                      ?.automationRunnerReady ||
                    !sendAt ||
                    !automationSubject.trim() ||
                    !automationBody.trim()
                  }
                  onClick={() =>
                    void saveAutomation(
                      true,
                    )
                  }
                  className="rounded-xl border border-emerald-200/15 bg-emerald-200/[0.03] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-100/55 transition hover:border-emerald-200/25 hover:text-emerald-100/75 disabled:opacity-35"
                >
                  {busy ===
                    "automation"
                    ? "Saving..."
                    : "Enable Automatic Reminder"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    busy !==
                      null
                  }
                  onClick={() =>
                    void saveAutomation(
                      false,
                    )
                  }
                  className="rounded-xl border border-rose-200/15 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-rose-100/45 transition hover:border-rose-200/25 hover:text-rose-100/65 disabled:opacity-35"
                >
                  {busy ===
                    "automation"
                    ? "Saving..."
                    : "Disable Automatic Reminder"}
                </button>
              )}
            </div>

            {automation && (
              <div className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-white/25">
                    Scheduled
                  </p>

                  <p className="mt-1 text-xs text-white/48">
                    {formatDate(
                      automation.send_at,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-white/25">
                    Last updated
                  </p>

                  <p className="mt-1 text-xs text-white/48">
                    {formatDate(
                      automation.updated_at,
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-7 rounded-[22px] border border-white/[0.07] bg-black/10 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
              Email Delivery History
            </p>

            <p className="mt-2 text-xs text-white/30">
              Provider attempts and outcomes. Secure bearer tokens are never stored here.
            </p>
          </div>

          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[8px] uppercase tracking-[0.1em] text-white/30">
            {deliveries.length}
          </span>
        </div>

        {deliveries.length ===
          0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/28">
            No invoice email has been attempted yet.
          </div>
        ) : (
          <div className="mt-5 divide-y divide-white/[0.06]">
            {deliveries.map(
              (
                delivery,
              ) => (
                <div
                  key={
                    delivery.id
                  }
                  className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-white/55">
                        {purposeLabel(
                          delivery.purpose,
                        )}
                      </p>

                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] uppercase tracking-[0.08em] text-white/30">
                        {triggerLabel(
                          delivery.trigger_type,
                        )}
                      </span>

                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-[0.08em]",
                          delivery.status ===
                            "sent"
                            ? "border-emerald-200/15 text-emerald-100/50"
                            : delivery.status ===
                                "failed"
                              ? "border-rose-200/15 text-rose-100/50"
                              : "border-white/10 text-white/30",
                        ].join(
                          " ",
                        )}
                      >
                        {statusLabel(
                          delivery.status,
                        )}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-white/42">
                      {delivery.subject}
                    </p>

                    <p className="mt-1 text-[10px] text-white/26">
                      To {delivery.recipient_email} / {delivery.provider} / secure link v{delivery.token_version}
                    </p>

                    {delivery.error_message && (
                      <p className="mt-2 text-[10px] leading-5 text-rose-100/48">
                        {delivery.error_code
                          ? `${delivery.error_code}: `
                          : ""}
                        {delivery.error_message}
                      </p>
                    )}
                  </div>

                  <p className="text-[10px] text-white/28 lg:text-right">
                    {formatDate(
                      delivery.sent_at ||
                      delivery.attempted_at,
                    )}
                  </p>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}
