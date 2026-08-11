"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Stage =
  | "locked"
  | "prepared"
  | "shared"
  | "viewed"
  | "downloaded"
  | "accepted"
  | "completed";

type OperationEvent = {
  id: string;

  event_type:
    | "note_updated"
    | "follow_up_scheduled"
    | "follow_up_cleared"
    | "handoff_completed"
    | "handoff_reopened";

  metadata:
    Record<
      string,
      unknown
    >;

  occurred_at:
    string;
};

type OperationsPayload = {
  stage: Stage;

  healthCode:
    string;

  healthLabel:
    string;

  nextAction:
    string;

  issuedDeliverables:
    number;

  accessStatus:
    | "active"
    | "revoked"
    | null;

  lifecycle: {
    preparedAt:
      | string
      | null;

    sharedAt:
      | string
      | null;

    viewedAt:
      | string
      | null;

    downloadedAt:
      | string
      | null;

    acceptedAt:
      | string
      | null;

    completedAt:
      | string
      | null;
  };

  engagement: {
    portalViews:
      number;

    downloads:
      number;

    accessChanges:
      number;
  };

  acceptance:
    | {
        id: string;

        acceptedAt:
          string;

        reportNumber:
          number;

        filename:
          string;

        sha256:
          string;

        acknowledgment:
          string;
      }
    | null;

  handoff: {
    notes: string;

    followUpAt:
      | string
      | null;

    followUpDue:
      boolean;

    completedAt:
      | string
      | null;

    updatedAt:
      | string
      | null;
  };

  canComplete:
    boolean;

  canReopen:
    boolean;

  operations:
    OperationEvent[];

  error?:
    string;
};

const stages: Array<{
  id:
    Exclude<
      Stage,
      "locked"
    >;

  label:
    string;
}> = [
  {
    id:
      "prepared",

    label:
      "Prepared",
  },
  {
    id:
      "shared",

    label:
      "Shared",
  },
  {
    id:
      "viewed",

    label:
      "Viewed",
  },
  {
    id:
      "downloaded",

    label:
      "Downloaded",
  },
  {
    id:
      "accepted",

    label:
      "Accepted",
  },
  {
    id:
      "completed",

    label:
      "Completed",
  },
];

const stageOrder:
  Record<
    Stage,
    number
  > = {
  locked:
    -1,

  prepared:
    0,

  shared:
    1,

  viewed:
    2,

  downloaded:
    3,

  accepted:
    4,

  completed:
    5,
};

const eventLabels:
  Record<
    OperationEvent["event_type"],
    string
  > = {
  note_updated:
    "Studio note updated",

  follow_up_scheduled:
    "Follow-up scheduled",

  follow_up_cleared:
    "Follow-up cleared",

  handoff_completed:
    "Handoff completed",

  handoff_reopened:
    "Handoff reopened",
};

function formatDate(
  value:
    | string
    | null,
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

function toLocalInput(
  value:
    | string
    | null,
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

  const offset =
    date.getTimezoneOffset() *
    60000;

  return new Date(
    date.getTime() -
      offset,
  )
    .toISOString()
    .slice(
      0,
      16,
    );
}

function operationDetail(
  event:
    OperationEvent,
) {
  if (
    event.event_type ===
      "follow_up_scheduled" &&
    typeof event.metadata.followUpAt ===
      "string"
  ) {
    return formatDate(
      event.metadata.followUpAt,
    );
  }

  if (
    event.event_type ===
      "handoff_completed" &&
    typeof event.metadata.downloadCount ===
      "number"
  ) {
    return `${event.metadata.downloadCount} verified download${
      event.metadata.downloadCount ===
      1
        ? ""
        : "s"
    }`;
  }

  if (
    event.event_type ===
      "note_updated" &&
    typeof event.metadata.noteLength ===
      "number"
  ) {
    return `${event.metadata.noteLength} characters`;
  }

  return null;
}

export default function BrandDeliveryOperations({
  projectId,
}: {
  projectId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<
      OperationsPayload | null
    >(
      null,
    );

  const [
    notes,
    setNotes,
  ] =
    useState(
      "",
    );

  const [
    followUp,
    setFollowUp,
  ] =
    useState(
      "",
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
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const load =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/admin/delivery-operations?projectId=${encodeURIComponent(
                projectId,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            await response.json() as
              OperationsPayload;

          if (
            !response.ok
          ) {
            throw new Error(
              payload.error ||
                "Could not load delivery operations.",
            );
          }

          setData(
            payload,
          );

          setNotes(
            payload
              .handoff
              .notes,
          );

          setFollowUp(
            toLocalInput(
              payload
                .handoff
                .followUpAt,
            ),
          );

          setError(
            null,
          );
        }
        catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load delivery operations.",
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
            void load();
          },
          0,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    },
    [
      load,
    ],
  );

  async function mutate(
    action: string,
    extra:
      Record<
        string,
        unknown
      > = {},
  ) {
    setBusy(
      action,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          "/api/admin/delivery-operations",
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

                ...extra,
              }),
          },
        );

      const payload =
        await response.json() as
          OperationsPayload;

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Delivery operation failed.",
        );
      }

      setData(
        payload,
      );

      setNotes(
        payload
          .handoff
          .notes,
      );

      setFollowUp(
        toLocalInput(
          payload
            .handoff
            .followUpAt,
        ),
      );
    }
    catch (
      actionError
    ) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Delivery operation failed.",
      );
    }
    finally {
      setBusy(
        null,
      );
    }
  }

  const activeStage =
    stageOrder[
      data?.stage ??
        "locked"
    ];

  const notesDirty =
    useMemo(
      () =>
        data !==
          null &&
        notes.trim() !==
          data.handoff.notes,
      [
        data,
        notes,
      ],
    );

  const locked =
    !data ||
    data.stage ===
      "locked";

  return (
    <div className="mt-12 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6 sm:p-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#c5a577] uppercase">
            Delivery Operations
          </p>

          <h3 className="mt-2 text-2xl font-medium">
            Handoff status.
          </h3>

          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/35">
            Track the client handoff from sealed deliverable to completed delivery, with studio notes and follow-up control kept inside the admin workspace.
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-4 py-2 text-[10px] ${
            data?.healthCode ===
              "complete"
              ? "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-200/70"
              : data?.healthCode ===
                    "follow_up_due"
                ? "border-amber-300/20 bg-amber-300/[0.05] text-amber-100/75"
                : "border-white/10 text-white/40"
          }`}
        >
          {
            loading
              ? "Checking..."
              : data
                ? data.healthLabel
                : "Unavailable"
          }
        </span>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stages.map(
          (
            stage,
            index,
          ) => {
            const reached =
              activeStage >=
              index;

            const current =
              data?.stage ===
              stage.id;

            return (
              <div
                key={
                  stage.id
                }
                className={`rounded-xl border px-3 py-3 ${
                  current
                    ? "border-[#c5a577]/25 bg-[#c5a577]/[0.06]"
                    : reached
                      ? "border-white/10 bg-white/[0.025]"
                      : "border-white/[0.06]"
                }`}
              >
                <p className="text-[9px] font-semibold tracking-[0.12em] text-white/20 uppercase">
                  0{
                    index +
                    1
                  }
                </p>

                <p
                  className={`mt-2 text-xs ${
                    reached
                      ? "text-white/65"
                      : "text-white/20"
                  }`}
                >
                  {
                    stage.label
                  }
                </p>
              </div>
            );
          },
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-white/20 uppercase">
            Current stage
          </p>

          <p className="mt-2 text-sm text-white/65 capitalize">
            {
              data?.stage ??
              "Checking"
            }
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-white/20 uppercase">
            Issued files
          </p>

          <p className="mt-2 text-sm text-white/65">
            {
              data
                ?.issuedDeliverables ??
              0
            }
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-white/20 uppercase">
            Follow-up
          </p>

          <p className="mt-2 text-xs leading-5 text-white/55">
            {
              data
                ?.handoff
                .followUpAt
                ? formatDate(
                    data
                      .handoff
                      .followUpAt,
                  )
                : "Not scheduled"
            }
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[#c5a577]/15 bg-[#c5a577]/[0.035] p-5">
        <p className="text-[9px] font-semibold tracking-[0.14em] text-[#d9bd94] uppercase">
          Next action
        </p>

        <p className="mt-3 max-w-2xl text-xs leading-6 text-white/55">
          {
            data
              ?.nextAction ??
            "Loading handoff state..."
          }
        </p>
      </div>


      {!locked && (
        <section className="mt-6 rounded-xl border border-white/[0.07] p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-white/25 uppercase">
                Client acceptance receipt
              </p>

              <p className="mt-2 max-w-2xl text-xs leading-6 text-white/30">
                The current issued report must be downloaded and then explicitly acknowledged from the private client portal before studio completion.
              </p>
            </div>

            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-[9px] ${
              data?.acceptance
                ? "border-emerald-300/15 text-emerald-200/60"
                : "border-white/10 text-white/25"
            }`}>
              {
                data?.acceptance
                  ? "Acknowledged"
                  : "Pending"
              }
            </span>
          </div>

          {data?.acceptance ? (
            <div className="mt-5">
              <p className="text-sm text-white/65">
                Report {
                  String(
                    data.acceptance.reportNumber,
                  ).padStart(2, "0")
                } acknowledged
              </p>

              <p className="mt-2 text-[10px] leading-5 text-white/25">
                {
                  data.acceptance.filename
                }
                {" | "}
                {
                  formatDate(
                    data.acceptance.acceptedAt,
                  )
                }
              </p>

              {data.acceptance.acknowledgment && (
                <p className="mt-3 border-l border-white/10 pl-3 text-[10px] leading-5 text-white/30">
                  {
                    data.acceptance.acknowledgment
                  }
                </p>
              )}

              <p className="mt-3 font-mono text-[9px] text-white/18">
                {
                  data.acceptance.sha256.length <= 30
                    ? data.acceptance.sha256
                    : `${data.acceptance.sha256.slice(0, 16)}...${data.acceptance.sha256.slice(-12)}`
                }
              </p>
            </div>
          ) : (
            <p className="mt-4 text-[10px] leading-5 text-white/20">
              No receipt has been recorded for the current issued report.
            </p>
          )}

          <p className="mt-4 text-[9px] leading-4 text-white/15">
            Operational delivery acknowledgment only. This is not represented as an electronic signature or contractual acceptance.
          </p>
        </section>
      )}
      {!locked && (
        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-white/[0.07] p-5">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-white/25 uppercase">
              Follow-up reminder
            </p>

            <p className="mt-2 text-xs leading-6 text-white/30">
              Keep the next client touchpoint visible without changing the private delivery link.
            </p>

            <input
              type="datetime-local"
              value={
                followUp
              }
              onChange={(
                event,
              ) =>
                setFollowUp(
                  event
                    .target
                    .value,
                )
              }
              className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/65 outline-none transition focus:border-[#c5a577]/35"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  busy !==
                    null ||
                  !followUp
                }
                onClick={() =>
                  void mutate(
                    "schedule_follow_up",
                    {
                      followUpAt:
                        new Date(
                          followUp,
                        ).toISOString(),
                    },
                  )
                }
                className="rounded-xl bg-[#f4f0e8] px-4 py-2.5 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {
                  busy ===
                    "schedule_follow_up"
                    ? "Scheduling..."
                    : "Schedule"
                }
              </button>

              {data
                ?.handoff
                .followUpAt && (
                <button
                  type="button"
                  disabled={
                    busy !==
                    null
                  }
                  onClick={() =>
                    void mutate(
                      "clear_follow_up",
                    )
                  }
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/45 transition hover:border-white/20 hover:text-white/70 disabled:opacity-40"
                >
                  {
                    busy ===
                      "clear_follow_up"
                      ? "Clearing..."
                      : "Clear"
                  }
                </button>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.07] p-5">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-white/25 uppercase">
              Completion control
            </p>

            <p className="mt-2 text-xs leading-6 text-white/30">
              Completion is available only after the client explicitly acknowledges receipt of the current issued report. Reopening preserves the operational history.
            </p>

            <div className="mt-4">
              {data
                ?.canReopen ? (
                <button
                  type="button"
                  disabled={
                    busy !==
                    null
                  }
                  onClick={() => {
                    if (
                      window.confirm(
                        "Reopen this completed handoff?",
                      )
                    ) {
                      void mutate(
                        "reopen",
                      );
                    }
                  }}
                  className="rounded-xl border border-white/10 px-5 py-3 text-xs text-white/55 transition hover:border-white/20 hover:text-white/80 disabled:opacity-40"
                >
                  {
                    busy ===
                      "reopen"
                      ? "Reopening..."
                      : "Reopen handoff"
                  }
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    busy !==
                      null ||
                    !data
                      ?.canComplete
                  }
                  onClick={() => {
                    if (
                      window.confirm(
                        "Mark this client handoff complete?",
                      )
                    ) {
                      void mutate(
                        "complete",
                      );
                    }
                  }}
                  className="rounded-xl bg-[#f4f0e8] px-5 py-3 text-xs font-semibold text-[#11110f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {
                    busy ===
                      "complete"
                      ? "Completing..."
                      : data
                          ?.canComplete
                        ? "Complete handoff"
                        : "Complete after acceptance"
                  }
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {!locked && (
        <section className="mt-5 rounded-xl border border-white/[0.07] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-white/25 uppercase">
                Studio handoff notes
              </p>

              <p className="mt-2 text-xs leading-6 text-white/30">
                Internal only. Note contents are not copied into the immutable event log.
              </p>
            </div>

            <span className="text-[9px] text-white/20">
              {
                notes.length
              } / 5000
            </span>
          </div>

          <textarea
            value={
              notes
            }
            maxLength={
              5000
            }
            rows={
              5
            }
            onChange={(
              event,
            ) =>
              setNotes(
                event
                  .target
                  .value,
              )
            }
            className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-6 text-white/65 outline-none transition focus:border-[#c5a577]/35"
            placeholder="Internal handoff context, client expectations, next touchpoint, or delivery notes..."
          />

          <button
            type="button"
            disabled={
              busy !==
                null ||
              !notesDirty
            }
            onClick={() =>
              void mutate(
                "save_notes",
                {
                  notes,
                },
              )
            }
            className="mt-3 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/50 transition hover:border-white/20 hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {
              busy ===
                "save_notes"
                ? "Saving..."
                : "Save notes"
            }
          </button>
        </section>
      )}

      <section className="mt-7 border-t border-white/[0.07] pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.15em] text-white/20 uppercase">
              Operations history
            </p>

            <h4 className="mt-2 text-sm font-medium text-white/60">
              Studio handoff actions.
            </h4>
          </div>

          <button
            type="button"
            onClick={() =>
              void load()
            }
            className="text-[10px] text-white/25 transition hover:text-white/55"
          >
            Refresh
          </button>
        </div>

        {data
          ?.operations
          .length ? (
          <div className="mt-5 space-y-3">
            {data.operations.map(
              (
                event,
              ) => {
                const detail =
                  operationDetail(
                    event,
                  );

                return (
                  <div
                    key={
                      event.id
                    }
                    className="flex flex-col justify-between gap-2 rounded-xl border border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-xs text-white/55">
                        {
                          eventLabels[
                            event
                              .event_type
                          ]
                        }
                      </p>

                      {detail && (
                        <p className="mt-1 text-[10px] text-white/20">
                          {
                            detail
                          }
                        </p>
                      )}
                    </div>

                    <p className="shrink-0 text-[10px] text-white/20">
                      {
                        formatDate(
                          event
                            .occurred_at,
                        )
                      }
                    </p>
                  </div>
                );
              },
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-white/[0.06] px-4 py-5 text-xs leading-6 text-white/22">
            No studio handoff actions have been recorded yet.
          </div>
        )}
      </section>

      {locked && (
        <div className="mt-6 rounded-xl border border-white/[0.07] px-4 py-4 text-xs leading-6 text-white/25">
          Delivery Operations unlock after the first sealed report is issued.
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