"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type DeliveryEvent = {
  id: string;

  event_type:
    | "access_activated"
    | "link_rotated"
    | "access_revoked"
    | "portal_viewed"
    | "file_downloaded";

  actor_type:
    | "admin"
    | "client"
    | "system";

  token_version:
    | number
    | null;

  file_id:
    | string
    | null;

  report_id:
    | string
    | null;

  metadata:
    Record<
      string,
      unknown
    > | null;

  occurred_at:
    string;
};

type AuditPayload = {
  events:
    DeliveryEvent[];

  stats: {
    portalViews:
      number;

    downloads:
      number;

    linkChanges:
      number;

    totalEvents:
      number;

    lastActivityAt:
      string | null;
  };

  error?:
    string;
};

function formatDate(
  value:
    | string
    | null,
) {
  if (!value) {
    return "No activity yet";
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

function eventTitle(
  event:
    DeliveryEvent,
) {
  if (
    event.event_type ===
    "access_activated"
  ) {
    return "Client portal activated";
  }

  if (
    event.event_type ===
    "link_rotated"
  ) {
    return "Private link rotated";
  }

  if (
    event.event_type ===
    "access_revoked"
  ) {
    return "Client access revoked";
  }

  if (
    event.event_type ===
    "portal_viewed"
  ) {
    return "Client viewed portal";
  }

  const reportNumber =
    typeof event.metadata
      ?.reportNumber ===
      "number"
      ? event.metadata
          .reportNumber
      : null;

  return reportNumber
    ? `Client downloaded Report ${reportNumber}`
    : "Client downloaded PDF";
}

function eventDetail(
  event:
    DeliveryEvent,
) {
  if (
    event.event_type ===
      "portal_viewed"
  ) {
    return "Private delivery page opened.";
  }

  if (
    event.event_type ===
      "file_downloaded"
  ) {
    const filename =
      typeof event.metadata
        ?.filename ===
        "string"
        ? event.metadata
            .filename
        : null;

    return filename ??
      "Verified sealed PDF downloaded.";
  }

  if (
    event.event_type ===
      "access_activated"
  ) {
    return "A private delivery link was created for issued client material.";
  }

  if (
    event.event_type ===
      "link_rotated"
  ) {
    return "The previous private link stopped working and a replacement was generated.";
  }

  return "Client delivery access was disabled without altering issued files.";
}

function actorLabel(
  event:
    DeliveryEvent,
) {
  if (
    event.actor_type ===
    "client"
  ) {
    return "Client";
  }

  if (
    event.actor_type ===
    "admin"
  ) {
    return "ELLIPSIS";
  }

  return "System";
}

export default function BrandDeliveryAuditTrail({
  projectId,
}: {
  projectId: string;
}) {
  const [
    payload,
    setPayload,
  ] =
    useState<
      AuditPayload | null
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
    refreshing,
    setRefreshing,
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

  const load =
    useCallback(
      async (
        manual =
          false,
      ) => {
        if (
          manual
        ) {
          setRefreshing(
            true,
          );
        }

        setError(
          null,
        );

        try {
          const response =
            await fetch(
              `/api/admin/delivery-events?projectId=${encodeURIComponent(
                projectId,
              )}`,
              {
                cache:
                  "no-store",
              },
            );

          const nextPayload =
            await response.json() as
              AuditPayload;

          if (
            !response.ok
          ) {
            throw new Error(
              nextPayload.error ||
                "Could not load delivery activity.",
            );
          }

          setPayload(
            nextPayload,
          );
        }
        catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load delivery activity.",
          );
        }
        finally {
          setLoading(
            false,
          );

          setRefreshing(
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

  const stats =
    payload?.stats ?? {
      portalViews:
        0,

      downloads:
        0,

      linkChanges:
        0,

      totalEvents:
        0,

      lastActivityAt:
        null,
    };

  const events =
    payload?.events ?? [];

  return (
    <div className="mt-12 rounded-2xl border border-white/[0.08] bg-white/[0.015] p-6 sm:p-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#c5a577] uppercase">
            Delivery Audit
          </p>

          <h3 className="mt-2 text-2xl font-medium">
            Delivery activity.
          </h3>

          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/35">
            Permanent studio history for client handoff, access changes, portal views, and verified PDF downloads. Audit events are immutable once recorded.
          </p>
        </div>

        <button
          type="button"
          disabled={
            loading ||
            refreshing
          }
          onClick={() =>
            void load(
              true,
            )
          }
          className="shrink-0 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-medium text-white/45 transition hover:border-white/20 hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {
            refreshing
              ? "Refreshing..."
              : "Refresh activity"
          }
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-white/20 uppercase">
            Portal views
          </p>

          <p className="mt-2 text-xl text-white/75">
            {
              stats.portalViews
            }
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-white/20 uppercase">
            PDF downloads
          </p>

          <p className="mt-2 text-xl text-white/75">
            {
              stats.downloads
            }
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-white/20 uppercase">
            Access changes
          </p>

          <p className="mt-2 text-xl text-white/75">
            {
              stats.linkChanges
            }
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] p-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-white/20 uppercase">
            Last activity
          </p>

          <p className="mt-2 text-xs leading-5 text-white/55">
            {
              formatDate(
                stats
                  .lastActivityAt,
              )
            }
          </p>
        </div>
      </div>

      <div className="mt-7 border-t border-white/[0.07] pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.15em] text-white/20 uppercase">
              Handoff timeline
            </p>

            <p className="mt-2 text-sm text-white/55">
              Studio and client delivery events in reverse chronological order.
            </p>
          </div>

          <span className="text-[10px] text-white/25">
            {
              stats.totalEvents
            } {
              stats.totalEvents ===
                1
                ? "event"
                : "events"
            }
          </span>
        </div>

        {loading && (
          <div className="mt-5 rounded-xl border border-white/[0.07] px-4 py-5 text-xs text-white/25">
            Loading delivery activity...
          </div>
        )}

        {!loading &&
          events.length ===
            0 && (
            <div className="mt-5 rounded-xl border border-white/[0.07] px-4 py-5 text-xs leading-6 text-white/25">
              No delivery activity has been recorded yet.
            </div>
          )}

        {events.length >
          0 && (
          <div className="mt-5 space-y-3">
            {events.map(
              (
                event,
              ) => (
                <article
                  key={
                    event.id
                  }
                  className="rounded-xl border border-white/[0.07] bg-black/10 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[9px] font-semibold tracking-[0.11em] uppercase ${
                            event.actor_type ===
                              "client"
                              ? "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-200/65"
                              : "border-[#c5a577]/20 bg-[#c5a577]/[0.05] text-[#d9bd94]"
                          }`}
                        >
                          {
                            actorLabel(
                              event,
                            )
                          }
                        </span>

                        {event.token_version && (
                          <span className="text-[9px] text-white/20">
                            Link v{
                              event
                                .token_version
                            }
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-sm font-medium text-white/70">
                        {
                          eventTitle(
                            event,
                          )
                        }
                      </p>

                      <p className="mt-2 max-w-2xl text-xs leading-6 text-white/30">
                        {
                          eventDetail(
                            event,
                          )
                        }
                      </p>
                    </div>

                    <time
                      dateTime={
                        event
                          .occurred_at
                      }
                      className="shrink-0 text-[10px] leading-5 text-white/25"
                    >
                      {
                        formatDate(
                          event
                            .occurred_at,
                        )
                      }
                    </time>
                  </div>
                </article>
              ),
            )}
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
    </div>
  );
}