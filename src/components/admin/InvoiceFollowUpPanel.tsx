"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type InvoiceStatus =
  | "draft"
  | "issued"
  | "paid"
  | "void";

type ReminderState =
  | "none"
  | "scheduled"
  | "sent"
  | "resolved";

type CommunicationType =
  | "payment_reminder_sent"
  | "client_reply"
  | "payment_update"
  | "note";

type CommunicationChannel =
  | "email"
  | "message"
  | "call"
  | "other";

type FollowUpState = {
  invoice_id: string;
  reminder_state:
    ReminderState;
  next_follow_up_at:
    string | null;
  internal_note: string;
  last_reminder_sent_at:
    string | null;
  created_at: string;
  updated_at: string;
};

type CommunicationEvent = {
  id: string;
  event_type:
    CommunicationType;
  channel:
    CommunicationChannel;
  summary: string;
  occurred_at: string;
  created_at: string;
};

type DeliveryState = {
  status:
    | "active"
    | "revoked";
  token_version: number;
  last_accessed_at:
    string | null;
  last_downloaded_at:
    string | null;
  created_at: string;
  rotated_at: string;
  revoked_at: string | null;
};

type FollowUpPayload = {
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    dueDate: string;
    paidAt: string | null;
    voidedAt: string | null;
    recipientEmail: string;
  };
  followUp?:
    FollowUpState |
    null;
  followUpDue?: boolean;
  communications?:
    CommunicationEvent[];
  delivery?:
    DeliveryState |
    null;
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

function stateLabel(
  state:
    ReminderState,
) {
  switch (
    state
  ) {
    case "scheduled":
      return "Scheduled";

    case "sent":
      return "Reminder sent";

    case "resolved":
      return "Resolved";

    default:
      return "Not scheduled";
  }
}

function eventLabel(
  type:
    CommunicationType,
) {
  switch (
    type
  ) {
    case "payment_reminder_sent":
      return "Payment reminder sent";

    case "client_reply":
      return "Client reply";

    case "payment_update":
      return "Payment update";

    case "note":
      return "Internal note";
  }
}

function channelLabel(
  channel:
    CommunicationChannel,
) {
  switch (
    channel
  ) {
    case "email":
      return "Email";

    case "message":
      return "Message";

    case "call":
      return "Call";

    case "other":
      return "Other";
  }
}

export default function InvoiceFollowUpPanel({
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
      FollowUpPayload |
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
      "save" |
      "record" |
      null
    >(
      null,
    );

  const [
    nextFollowUpAt,
    setNextFollowUpAt,
  ] =
    useState(
      "",
    );

  const [
    internalNote,
    setInternalNote,
  ] =
    useState(
      "",
    );

  const [
    eventType,
    setEventType,
  ] =
    useState<
      CommunicationType
    >(
      "payment_reminder_sent",
    );

  const [
    channel,
    setChannel,
  ] =
    useState<
      CommunicationChannel
    >(
      "email",
    );

  const [
    summary,
    setSummary,
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
              `/api/admin/invoices/${invoiceId}/follow-up`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            await response
              .json() as
              FollowUpPayload;

          if (
            !response.ok
          ) {
            throw new Error(
              payload.error ||
                "Could not load payment follow-up.",
            );
          }

          setState(
            payload,
          );

          setNextFollowUpAt(
            localInputValue(
              payload.followUp
                ?.next_follow_up_at ??
              null,
            ),
          );

          setInternalNote(
            payload.followUp
              ?.internal_note ??
              "",
          );

          if (
            payload.invoice
              ?.status !==
              "issued"
          ) {
            setEventType(
              "note",
            );
          }
        } catch (
          loadError
        ) {
          setMessage(
            loadError instanceof
              Error
              ? loadError.message
              : "Could not load payment follow-up.",
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
      function refreshFollowUp(
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
        "ellipsis:invoice-follow-up-changed",
        refreshFollowUp,
      );

      return () => {
        window.removeEventListener(
          "ellipsis:invoice-follow-up-changed",
          refreshFollowUp,
        );
      };
    },
    [
      invoiceId,
      load,
    ],
  );

  const effectiveStatus =
    state?.invoice
      ?.status ??
    invoiceStatus;

  const canPlan =
    effectiveStatus ===
      "issued";

  const canLog =
    effectiveStatus !==
      "draft";

  const followUp =
    state?.followUp ??
    null;

  const communications =
    state?.communications ??
    [];

  const delivery =
    state?.delivery ??
    null;

  const reminderState:
    ReminderState =
    effectiveStatus ===
      "paid" ||
    effectiveStatus ===
      "void"
      ? "resolved"
      : followUp
          ?.reminder_state ??
        "none";

  const due =
    canPlan &&
    Boolean(
      state?.followUpDue,
    );

  const communicationOptions =
    useMemo(
      () => {
        const base:
          Array<{
            value:
              CommunicationType;
            label: string;
          }> = [
          {
            value:
              "client_reply",
            label:
              "Client reply",
          },
          {
            value:
              "payment_update",
            label:
              "Payment update",
          },
          {
            value:
              "note",
            label:
              "Internal note",
          },
        ];

        return canPlan
          ? [
              {
                value:
                  "payment_reminder_sent" as const,
                label:
                  "Payment reminder sent",
              },
              ...base,
            ]
          : base;
      },
      [
        canPlan,
      ],
    );

  async function saveFollowUp() {
    if (!canPlan) {
      return;
    }

    setBusy(
      "save",
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/invoices/${invoiceId}/follow-up`,
          {
            method:
              "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                nextFollowUpAt:
                  nextFollowUpAt
                    ? new Date(
                        nextFollowUpAt,
                      ).toISOString()
                    : null,
                internalNote,
              }),
          },
        );

      const payload =
        await response
          .json() as
          FollowUpPayload;

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Could not save payment follow-up.",
        );
      }

      setState(
        payload,
      );

      setNextFollowUpAt(
        localInputValue(
          payload.followUp
            ?.next_follow_up_at ??
          null,
        ),
      );

      setInternalNote(
        payload.followUp
          ?.internal_note ??
          "",
      );

      setMessage(
        payload.followUp
          ?.next_follow_up_at
          ? `Follow-up scheduled for ${formatDate(payload.followUp.next_follow_up_at)}.`
          : "Follow-up plan saved.",
      );
    } catch (
      saveError
    ) {
      setMessage(
        saveError instanceof
          Error
          ? saveError.message
          : "Could not save payment follow-up.",
      );
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function recordCommunication() {
    if (
      !canLog ||
      !summary.trim()
    ) {
      return;
    }

    setBusy(
      "record",
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/invoices/${invoiceId}/follow-up`,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                eventType,
                channel,
                summary,
              }),
          },
        );

      const payload =
        await response
          .json() as
          FollowUpPayload;

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Could not record communication.",
        );
      }

      setState(
        payload,
      );

      setSummary(
        "",
      );

      setNextFollowUpAt(
        localInputValue(
          payload.followUp
            ?.next_follow_up_at ??
          null,
        ),
      );

      setInternalNote(
        payload.followUp
          ?.internal_note ??
          "",
      );

      setMessage(
        eventType ===
          "payment_reminder_sent"
          ? "Payment reminder recorded. This log does not send an email or message automatically."
          : "Communication added to the invoice history.",
      );
    } catch (
      recordError
    ) {
      setMessage(
        recordError instanceof
          Error
          ? recordError.message
          : "Could not record communication.",
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
          Loading payment follow-up...
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-[28px] border border-white/[0.07] bg-[#161612] p-6 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#d8bf99]/50">
              Payment Follow-up
            </p>

            <span
              className={[
                "rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em]",
                due
                  ? "border-rose-200/20 bg-rose-200/[0.04] text-rose-100/65"
                  : reminderState === "resolved"
                    ? "border-emerald-200/15 bg-emerald-200/[0.04] text-emerald-100/55"
                    : reminderState === "scheduled"
                      ? "border-[#c8ad84]/20 bg-[#c8ad84]/[0.04] text-[#d8bf99]/65"
                      : "border-white/10 bg-white/[0.02] text-white/38",
              ].join(" ")}
            >
              {due
                ? "Follow-up due"
                : stateLabel(
                    reminderState,
                  )}
            </span>
          </div>

          <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
            Keep payment follow-up visible without turning ELLIPSIS into accounting software.
          </h2>

          <p className="mt-3 text-xs leading-6 text-white/38">
            Use Invoice Communication above to send invoice emails and payment reminders. This section keeps the internal follow-up plan and records manual client contact alongside automatic email history.
          </p>
        </div>

        <div className="grid min-w-[240px] gap-2 text-xs text-white/36">
          <div className="flex justify-between gap-5 border-b border-white/[0.06] pb-2">
            <span>
              Client viewed
            </span>
            <span className="text-right text-white/50">
              {formatDate(
                delivery
                  ?.last_accessed_at ??
                null,
              )}
            </span>
          </div>

          <div className="flex justify-between gap-5 border-b border-white/[0.06] pb-2">
            <span>
              PDF downloaded
            </span>
            <span className="text-right text-white/50">
              {formatDate(
                delivery
                  ?.last_downloaded_at ??
                null,
              )}
            </span>
          </div>

          <div className="flex justify-between gap-5">
            <span>
              Secure access
            </span>
            <span className="text-right capitalize text-white/50">
              {delivery
                ?.status ??
                "not created"}
            </span>
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-5 rounded-2xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.035] px-4 py-3 text-xs leading-6 text-[#ead6b5]/65">
          {message}
        </div>
      )}

      {effectiveStatus ===
        "draft" ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-sm leading-7 text-white/35">
          Issue {invoiceNumber} before scheduling payment follow-up or recording client communication.
        </div>
      ) : (
        <div className="mt-7 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <div className="rounded-[22px] border border-white/[0.07] bg-black/10 p-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Follow-up plan
              </p>

              {canPlan ? (
                <>
                  <label className="mt-4 block">
                    <span className="text-[10px] text-white/36">
                      Next follow-up
                    </span>

                    <input
                      type="datetime-local"
                      value={
                        nextFollowUpAt
                      }
                      onChange={(
                        event,
                      ) =>
                        setNextFollowUpAt(
                          event.target.value,
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none focus:border-[#c8ad84]/30"
                    />
                  </label>

                  <label className="mt-4 block">
                    <span className="text-[10px] text-white/36">
                      Internal follow-up note
                    </span>

                    <textarea
                      rows={4}
                      value={
                        internalNote
                      }
                      onChange={(
                        event,
                      ) =>
                        setInternalNote(
                          event.target.value,
                        )
                      }
                      placeholder="What should you remember before the next payment follow-up?"
                      className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm leading-6 text-white/65 outline-none placeholder:text-white/18 focus:border-[#c8ad84]/30"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        busy !== null
                      }
                      onClick={() =>
                        void saveFollowUp()
                      }
                      className="rounded-xl bg-[#f4f0e8] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white disabled:opacity-40"
                    >
                      {busy === "save"
                        ? "Saving..."
                        : "Save Follow-up"}
                    </button>

                    {nextFollowUpAt && (
                      <button
                        type="button"
                        disabled={
                          busy !== null
                        }
                        onClick={() =>
                          setNextFollowUpAt(
                            "",
                          )
                        }
                        className="rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/38 transition hover:text-white/60 disabled:opacity-40"
                      >
                        Clear Date
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-4">
                  <p className="text-sm leading-7 text-white/40">
                    This invoice is {effectiveStatus}. Payment follow-up is resolved and no new reminder date can be scheduled.
                  </p>

                  {followUp
                    ?.internal_note && (
                    <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="text-[9px] uppercase tracking-[0.1em] text-white/28">
                        Final internal note
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-white/45">
                        {
                          followUp.internal_note
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-white/25">
                    Next follow-up
                  </p>

                  <p className="mt-1 text-xs text-white/48">
                    {formatDate(
                      followUp
                        ?.next_follow_up_at ??
                      null,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-white/25">
                    Last reminder
                  </p>

                  <p className="mt-1 text-xs text-white/48">
                    {formatDate(
                      followUp
                        ?.last_reminder_sent_at ??
                      null,
                    )}
                  </p>
                </div>
              </div>
            </div>

            {canLog && (
              <div className="rounded-[22px] border border-white/[0.07] bg-black/10 p-5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Record communication
                </p>

                <p className="mt-2 text-xs leading-5 text-white/30">
                  Use this for manual contact such as calls, messages, replies, or internal notes. Payment reminders sent through Invoice Communication are recorded automatically.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-[10px] text-white/36">
                      Type
                    </span>

                    <select
                      value={
                        eventType
                      }
                      onChange={(
                        event,
                      ) =>
                        setEventType(
                          event.target.value as CommunicationType,
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none focus:border-[#c8ad84]/30"
                    >
                      {communicationOptions.map(
                        (
                          option,
                        ) => (
                          <option
                            key={
                              option.value
                            }
                            value={
                              option.value
                            }
                          >
                            {
                              option.label
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    <span className="text-[10px] text-white/36">
                      Channel
                    </span>

                    <select
                      value={
                        channel
                      }
                      onChange={(
                        event,
                      ) =>
                        setChannel(
                          event.target.value as CommunicationChannel,
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none focus:border-[#c8ad84]/30"
                    >
                      <option value="email">
                        Email
                      </option>
                      <option value="message">
                        Message
                      </option>
                      <option value="call">
                        Call
                      </option>
                      <option value="other">
                        Other
                      </option>
                    </select>
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="text-[10px] text-white/36">
                    Summary
                  </span>

                  <textarea
                    rows={4}
                    value={
                      summary
                    }
                    onChange={(
                      event,
                    ) =>
                      setSummary(
                        event.target.value,
                      )
                    }
                    placeholder="Sent payment reminder and asked for an updated payment date."
                    className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm leading-6 text-white/65 outline-none placeholder:text-white/18 focus:border-[#c8ad84]/30"
                  />
                </label>

                <button
                  type="button"
                  disabled={
                    busy !== null ||
                    !summary.trim()
                  }
                  onClick={() =>
                    void recordCommunication()
                  }
                  className="mt-4 rounded-xl border border-[#c8ad84]/20 bg-[#c8ad84]/[0.04] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#d8bf99]/65 transition hover:border-[#c8ad84]/35 hover:text-[#ead6b5] disabled:opacity-35"
                >
                  {busy === "record"
                    ? "Recording..."
                    : "Record Communication"}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[22px] border border-white/[0.07] bg-black/10 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  Communication History
                </p>

                <p className="mt-2 text-xs text-white/30">
                  Manual payment and client-contact record for this invoice.
                </p>
              </div>

              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[8px] uppercase tracking-[0.1em] text-white/30">
                {communications.length}
              </span>
            </div>

            {communications.length ===
              0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/28">
                No payment communication recorded yet.
              </div>
            ) : (
              <div className="mt-5 divide-y divide-white/[0.06]">
                {communications.map(
                  (
                    event,
                  ) => (
                    <div
                      key={
                        event.id
                      }
                      className="py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-white/55">
                          {eventLabel(
                            event.event_type,
                          )}
                        </p>

                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[8px] uppercase tracking-[0.08em] text-white/30">
                          {channelLabel(
                            event.channel,
                          )}
                        </span>
                      </div>

                      <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-white/38">
                        {
                          event.summary
                        }
                      </p>

                      <p className="mt-2 text-[9px] text-white/24">
                        {formatDate(
                          event.occurred_at,
                        )}
                      </p>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}