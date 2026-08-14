"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type CurrencySummary = {
  currency: string;
  paidCents: number;
  paidCount: number;
  outstandingCents: number;
  issuedCount: number;
  overdueCents: number;
  overdueCount: number;
  draftCents: number;
  draftCount: number;
  voidCount: number;
  averageInvoiceCents: number;
  averageDaysToPayment:
    number | null;
  paymentCompletionRate:
    number | null;
};

type StatusCounts = {
  total: number;
  draft: number;
  issued: number;
  overdue: number;
  paid: number;
  void: number;
};

type MonthlyRevenue = {
  month: string;
  currency: string;
  totalCents: number;
  count: number;
};

type TopClient = {
  clientId: string;
  clientName: string;
  currency: string;
  paidCents: number;
  paidCount: number;
};

type AttentionInvoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  currency: string;
  totalCents: number;
  dueDate: string;
  nextFollowUpAt:
    string | null;
  lastAccessedAt:
    string | null;
  lastDownloadedAt:
    string | null;
};

type AnalyticsPayload = {
  generatedAt?: string;
  today?: string;
  timezoneOffsetMinutes?: number;
  currencies?: CurrencySummary[];
  statusCounts?: StatusCounts;
  monthlyRevenue?: MonthlyRevenue[];
  topClients?: TopClient[];
  attention?: {
    overdue:
      AttentionInvoice[];
    followUpsDue:
      AttentionInvoice[];
    issuedNeverViewed:
      AttentionInvoice[];
    viewedUnpaid:
      AttentionInvoice[];
  };
  definitions?: {
    paymentCompletionRate:
      string;
    averageInvoiceValue:
      string;
    averageDaysToPayment:
      string;
    overdue:
      string;
    currencyPolicy:
      string;
  };
  error?: string;
};

function localDateString() {
  const now =
    new Date();

  const offset =
    now.getTimezoneOffset();

  return new Date(
    now.getTime() -
      offset *
        60_000,
  )
    .toISOString()
    .slice(
      0,
      10,
    );
}

function money(
  cents: number,
  currency: string,
) {
  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style:
          "currency",
        currency,
      },
    ).format(
      cents / 100,
    );
  } catch {
    return `${currency} ${(
      cents / 100
    ).toFixed(2)}`;
  }
}

function monthLabel(
  value: string,
) {
  const parsed =
    new Date(
      `${value}-01T00:00:00`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return parsed.toLocaleDateString(
    undefined,
    {
      year:
        "numeric",
      month:
        "short",
    },
  );
}

function dateLabel(
  value:
    string | null,
) {
  if (!value) {
    return "Not recorded";
  }

  const parsed =
    value.length ===
      10
      ? new Date(
          `${value}T00:00:00`,
        )
      : new Date(
          value,
        );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return parsed.toLocaleString(
    undefined,
    value.length ===
      10
      ? {
          year:
            "numeric",
          month:
            "short",
          day:
            "numeric",
        }
      : {
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

function percentLabel(
  value:
    number | null,
) {
  return value ===
    null
    ? "Not enough data"
    : `${value.toFixed(1)}%`;
}

function MetricCard({
  label,
  value,
  note,
  accent =
    false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-[22px] border p-5",
        accent
          ? "border-[#c8ad84]/15 bg-[#c8ad84]/[0.035]"
          : "border-white/[0.07] bg-white/[0.02]",
      ].join(
        " ",
      )}
    >
      <p
        className={[
          "text-[8px] font-semibold uppercase tracking-[0.14em]",
          accent
            ? "text-[#d8bf99]/48"
            : "text-white/28",
        ].join(
          " ",
        )}
      >
        {label}
      </p>

      <p className="mt-3 text-xl font-medium tracking-[-0.035em] text-[#f4f0e8]">
        {value}
      </p>

      <p className="mt-2 text-[10px] leading-5 text-white/28">
        {note}
      </p>
    </div>
  );
}

function StatusCard({
  label,
  count,
  note,
}: {
  label: string;
  count: number;
  note: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-black/10 p-4">
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/26">
        {label}
      </p>

      <p className="mt-2 text-2xl font-medium tracking-[-0.04em] text-white/65">
        {count}
      </p>

      <p className="mt-1 text-[9px] leading-4 text-white/24">
        {note}
      </p>
    </div>
  );
}

function AttentionList({
  title,
  description,
  items,
  empty,
}: {
  title: string;
  description: string;
  items: AttentionInvoice[];
  empty: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#d8bf99]/45">
            {title}
          </p>

          <p className="mt-2 text-xs leading-5 text-white/28">
            {description}
          </p>
        </div>

        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[8px] font-semibold text-white/34">
          {items.length}
        </span>
      </div>

      {items.length ===
        0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-white/26">
          {empty}
        </p>
      ) : (
        <div className="mt-5 divide-y divide-white/[0.06]">
          {items
            .slice(
              0,
              6,
            )
            .map(
              (
                invoice,
              ) => (
                <Link
                  key={
                    invoice.id
                  }
                  href={`/admin/invoices/${invoice.id}`}
                  className="group flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white/55 transition group-hover:text-[#ead6b5]">
                      {
                        invoice.invoiceNumber
                      }
                    </p>

                    <p className="mt-1 truncate text-[9px] text-white/28">
                      {
                        invoice.clientName
                      }{" "}
                      / Due{" "}
                      {
                        dateLabel(
                          invoice.dueDate,
                        )
                      }
                    </p>
                  </div>

                  <p className="shrink-0 text-xs text-white/42">
                    {
                      money(
                        invoice.totalCents,
                        invoice.currency,
                      )
                    }
                  </p>
                </Link>
              ),
            )}

          {items.length >
            6 && (
            <p className="pt-3 text-[9px] text-white/25">
              +{
                items.length -
                6
              } more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function InvoiceAnalyticsDashboard() {
  const [
    data,
    setData,
  ] =
    useState<
      AnalyticsPayload | null
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
        setLoading(
          true,
        );

        try {
          const params =
            new URLSearchParams({
              today:
                localDateString(),
              timezoneOffset:
                String(
                  new Date()
                    .getTimezoneOffset(),
                ),
            });

          const response =
            await fetch(
              `/api/admin/invoices/analytics?${params.toString()}`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            await response
              .json() as
              AnalyticsPayload;

          if (
            !response.ok
          ) {
            throw new Error(
              payload.error ||
                "Could not load invoice analytics.",
            );
          }

          setData(
            payload,
          );
          setError(
            null,
          );
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Could not load invoice analytics.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
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
    ],
  );

  const monthlyByCurrency =
    useMemo(
      () => {
        const grouped =
          new Map<
            string,
            MonthlyRevenue[]
          >();

        for (
          const row of
            data
              ?.monthlyRevenue ??
            []
        ) {
          const current =
            grouped.get(
              row.currency,
            ) ??
            [];

          current.push(
            row,
          );

          grouped.set(
            row.currency,
            current,
          );
        }

        return Array.from(
          grouped.entries(),
        );
      },
      [
        data,
      ],
    );

  const topClients =
    useMemo(
      () =>
        (
          data
            ?.topClients ??
          []
        ).slice(
          0,
          12,
        ),
      [
        data,
      ],
    );

  const statusCounts =
    data
      ?.statusCounts ?? {
        total:
          0,
        draft:
          0,
        issued:
          0,
        overdue:
          0,
        paid:
          0,
        void:
          0,
      };

  const attention =
    data
      ?.attention ?? {
        overdue:
          [],
        followUpsDue:
          [],
        issuedNeverViewed:
          [],
        viewedUnpaid:
          [],
      };

  if (
    loading &&
    !data
  ) {
    return (
      <section className="mt-10 rounded-[28px] border border-white/[0.07] bg-[#161612] p-8 text-sm text-white/35">
        Building finance overview...
      </section>
    );
  }

  if (
    error &&
    !data
  ) {
    return (
      <section className="mt-10 rounded-[28px] border border-rose-200/15 bg-rose-200/[0.035] p-8">
        <p className="text-sm leading-7 text-rose-100/55">
          {error}
        </p>

        <button
          type="button"
          onClick={() =>
            void load()
          }
          className="mt-4 rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/45"
        >
          Try Again
        </button>
      </section>
    );
  }

  return (
    <section className="mt-10 space-y-7">
      <div className="flex flex-col gap-4 rounded-[24px] border border-[#c8ad84]/15 bg-[#c8ad84]/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#d8bf99]/50">
            Currency-safe analytics
          </p>

          <p className="mt-2 max-w-2xl text-xs leading-6 text-white/34">
            Revenue is kept in each invoice&apos;s original currency. ELLIPSIS does not perform hidden exchange-rate conversion or combine unlike currencies into one total.
          </p>
        </div>

        <button
          type="button"
          disabled={
            loading
          }
          onClick={() =>
            void load()
          }
          className="w-fit rounded-xl border border-[#c8ad84]/20 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#d8bf99]/60 transition hover:border-[#c8ad84]/35 hover:text-[#ead6b5] disabled:opacity-35"
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      <div className="space-y-5">
        {(data
          ?.currencies ??
          []
        ).length ===
          0 ? (
          <div className="rounded-[28px] border border-dashed border-white/10 p-8 text-center">
            <p className="text-sm text-white/35">
              No invoice analytics yet.
            </p>

            <Link
              href="/admin/invoices/new"
              className="mt-4 inline-flex rounded-xl border border-[#c8ad84]/20 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#d8bf99]/60"
            >
              Create Invoice
            </Link>
          </div>
        ) : (
          data
            ?.currencies ??
          []
        ).map(
          (
            summary,
          ) => (
            <article
              key={
                summary.currency
              }
              className="rounded-[28px] border border-white/[0.07] bg-[#161612] p-5 sm:p-7"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/50">
                    {
                      summary.currency
                    } ledger
                  </p>

                  <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">
                    Revenue and invoice performance
                  </h2>
                </div>

                <p className="text-[10px] text-white/28">
                  {
                    summary.paidCount
                  } paid /{" "}
                  {
                    summary.issuedCount +
                    summary.overdueCount
                  } open /{" "}
                  {
                    summary.draftCount
                  } draft
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Paid revenue"
                  value={
                    money(
                      summary.paidCents,
                      summary.currency,
                    )
                  }
                  note={`${summary.paidCount} paid invoice${summary.paidCount === 1 ? "" : "s"}.`}
                  accent
                />

                <MetricCard
                  label="Outstanding"
                  value={
                    money(
                      summary.outstandingCents,
                      summary.currency,
                    )
                  }
                  note={`${summary.issuedCount + summary.overdueCount} currently issued.`}
                />

                <MetricCard
                  label="Overdue"
                  value={
                    money(
                      summary.overdueCents,
                      summary.currency,
                    )
                  }
                  note={`${summary.overdueCount} past due right now.`}
                />

                <MetricCard
                  label="Draft pipeline"
                  value={
                    money(
                      summary.draftCents,
                      summary.currency,
                    )
                  }
                  note={`${summary.draftCount} draft invoice${summary.draftCount === 1 ? "" : "s"}.`}
                />

                <MetricCard
                  label="Average invoice"
                  value={
                    money(
                      summary.averageInvoiceCents,
                      summary.currency,
                    )
                  }
                  note="Average non-void invoice value."
                />

                <MetricCard
                  label="Average payment time"
                  value={
                    summary.averageDaysToPayment ===
                      null
                      ? "Not enough data"
                      : `${summary.averageDaysToPayment.toFixed(1)} days`
                  }
                  note="Measured from issue to payment."
                />

                <MetricCard
                  label="Payment completion"
                  value={
                    percentLabel(
                      summary.paymentCompletionRate,
                    )
                  }
                  note="Paid divided by paid plus currently issued."
                />

                <MetricCard
                  label="Voided"
                  value={
                    String(
                      summary.voidCount,
                    )
                  }
                  note="Excluded from revenue and completion rate."
                />
              </div>
            </article>
          ),
        )}
      </div>

      <article className="rounded-[28px] border border-white/[0.07] bg-[#161612] p-5 sm:p-7">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/45">
            Invoice health
          </p>

          <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">
            What is moving through the system
          </h2>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatusCard
            label="Draft"
            count={
              statusCounts.draft
            }
            note="Still editable"
          />

          <StatusCard
            label="Issued"
            count={
              statusCounts.issued
            }
            note="Open, not overdue"
          />

          <StatusCard
            label="Overdue"
            count={
              statusCounts.overdue
            }
            note="Derived from due date"
          />

          <StatusCard
            label="Paid"
            count={
              statusCounts.paid
            }
            note="Revenue received"
          />

          <StatusCard
            label="Void"
            count={
              statusCounts.void
            }
            note="Closed without revenue"
          />
        </div>

        <p className="mt-4 text-[10px] text-white/24">
          {statusCounts.total} invoice{statusCounts.total === 1 ? "" : "s"} in total.
        </p>
      </article>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[28px] border border-white/[0.07] bg-[#161612] p-5 sm:p-7">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/45">
            Monthly revenue
          </p>

          <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">
            Paid revenue over the last 12 months
          </h2>

          {monthlyByCurrency.length ===
            0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/28">
              No paid revenue in the current 12-month window.
            </p>
          ) : (
            <div className="mt-6 space-y-7">
              {monthlyByCurrency.map(
                ([
                  currency,
                  rows,
                ]) => {
                  const maximum =
                    Math.max(
                      ...rows.map(
                        (
                          row,
                        ) =>
                          row.totalCents,
                      ),
                      1,
                    );

                  return (
                    <div
                      key={
                        currency
                      }
                    >
                      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/32">
                        {currency}
                      </p>

                      <div className="mt-3 space-y-3">
                        {rows.map(
                          (
                            row,
                          ) => (
                            <div
                              key={`${row.month}:${row.currency}`}
                              className="grid grid-cols-[74px_1fr_auto] items-center gap-3"
                            >
                              <p className="text-[10px] text-white/34">
                                {monthLabel(
                                  row.month,
                                )}
                              </p>

                              <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                                <div
                                  className="h-full rounded-full bg-[#c8ad84]/45"
                                  style={{
                                    width:
                                      `${Math.max(4, row.totalCents / maximum * 100)}%`,
                                  }}
                                />
                              </div>

                              <div className="text-right">
                                <p className="text-xs font-medium text-white/52">
                                  {money(
                                    row.totalCents,
                                    row.currency,
                                  )}
                                </p>

                                <p className="mt-0.5 text-[8px] text-white/22">
                                  {row.count} paid
                                </p>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </article>

        <article className="rounded-[28px] border border-white/[0.07] bg-[#161612] p-5 sm:p-7">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/45">
            Top clients
          </p>

          <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">
            Paid revenue by client
          </h2>

          {topClients.length ===
            0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/28">
              Paid client history will appear here.
            </p>
          ) : (
            <div className="mt-6 divide-y divide-white/[0.06]">
              {topClients.map(
                (
                  client,
                  index,
                ) => (
                  <div
                    key={`${client.clientId}:${client.currency}`}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white/55">
                        {index + 1}.{" "}
                        {
                          client.clientName
                        }
                      </p>

                      <p className="mt-1 text-[9px] text-white/27">
                        {
                          client.paidCount
                        } paid invoice{
                          client.paidCount ===
                          1
                            ? ""
                            : "s"
                        } /{" "}
                        {
                          client.currency
                        }
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-medium text-[#ead6b5]/60">
                      {money(
                        client.paidCents,
                        client.currency,
                      )}
                    </p>
                  </div>
                ),
              )}
            </div>
          )}
        </article>
      </div>

      <article>
        <div className="mb-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/45">
            Needs attention
          </p>

          <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">
            Operational signals worth acting on
          </h2>

          <p className="mt-2 max-w-2xl text-xs leading-6 text-white/30">
            These queues are derived from invoice status, due dates, S9 follow-up plans, and S8 secure delivery activity.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AttentionList
            title="Overdue invoices"
            description="Issued invoices whose due date is before today."
            items={
              attention.overdue
            }
            empty="Nothing overdue."
          />

          <AttentionList
            title="Follow-ups due"
            description="Issued invoices with a scheduled payment follow-up that is due now."
            items={
              attention.followUpsDue
            }
            empty="No payment follow-ups are due."
          />

          <AttentionList
            title="Issued, never viewed"
            description="Open invoices with no recorded client portal view."
            items={
              attention.issuedNeverViewed
            }
            empty="No unseen issued invoices."
          />

          <AttentionList
            title="Viewed, still unpaid"
            description="Open invoices the client has viewed but that have not been marked paid."
            items={
              attention.viewedUnpaid
            }
            empty="No viewed invoices are waiting for payment."
          />
        </div>
      </article>

      {data
        ?.definitions && (
        <article className="rounded-[24px] border border-white/[0.06] bg-white/[0.015] p-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/26">
            Metric definitions
          </p>

          <div className="mt-4 grid gap-3 text-[10px] leading-5 text-white/27 md:grid-cols-2">
            <p>
              <span className="text-white/42">
                Payment completion:
              </span>{" "}
              {
                data.definitions
                  .paymentCompletionRate
              }
            </p>

            <p>
              <span className="text-white/42">
                Average invoice:
              </span>{" "}
              {
                data.definitions
                  .averageInvoiceValue
              }
            </p>

            <p>
              <span className="text-white/42">
                Average payment time:
              </span>{" "}
              {
                data.definitions
                  .averageDaysToPayment
              }
            </p>

            <p>
              <span className="text-white/42">
                Overdue:
              </span>{" "}
              {
                data.definitions
                  .overdue
              }
            </p>
          </div>
        </article>
      )}
    </section>
  );
}
