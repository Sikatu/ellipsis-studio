"use client";

import Link from "next/link";
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

type DisplayStatus =
  | InvoiceStatus
  | "overdue";

type InvoiceSummary = {
  id: string;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  invoice_date: string;
  due_date: string;
  currency: string;
  client_snapshot: unknown;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  adjustment_cents: number;
  total_cents: number;
  issued_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  final_pdf_created_at: string | null;
  created_at: string;
  updated_at: string;
};

type Filter =
  | "all"
  | DisplayStatus;

type WorkspacePayload = {
  invoices?: InvoiceSummary[];
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

function displayStatus(
  invoice: InvoiceSummary,
): DisplayStatus {
  if (
    invoice.status ===
      "issued" &&
    invoice.due_date <
      localDateString()
  ) {
    return "overdue";
  }

  return invoice.status;
}

function snapshotValue(
  snapshot: unknown,
  key: string,
) {
  if (
    !snapshot ||
    typeof snapshot !==
      "object" ||
    Array.isArray(
      snapshot,
    )
  ) {
    return "";
  }

  const value =
    (
      snapshot as
        Record<
          string,
          unknown
        >
    )[key];

  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function clientName(
  invoice: InvoiceSummary,
) {
  return (
    snapshotValue(
      invoice.client_snapshot,
      "companyName",
    ) ||
    snapshotValue(
      invoice.client_snapshot,
      "billingName",
    ) ||
    "Client"
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

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "Not recorded";
  }

  const date =
    value.length === 10
      ? new Date(
          `${value}T00:00:00`,
        )
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    undefined,
    {
      year:
        "numeric",
      month:
        "short",
      day:
        "numeric",
    },
  );
}

function monthKey(
  value: Date,
) {
  return [
    value.getFullYear(),
    String(
      value.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    ),
  ].join(
    "-",
  );
}

function moneyByCurrency(
  invoices: InvoiceSummary[],
) {
  const totals =
    new Map<
      string,
      number
    >();

  for (
    const invoice of invoices
  ) {
    totals.set(
      invoice.currency,
      (
        totals.get(
          invoice.currency,
        ) ?? 0
      ) +
        invoice.total_cents,
    );
  }

  return Array.from(
    totals.entries(),
  ).sort(
    (
      [currencyA],
      [currencyB],
    ) =>
      currencyA.localeCompare(
        currencyB,
      ),
  );
}

function MoneyStack({
  entries,
}: {
  entries:
    [string, number][];
}) {
  if (
    entries.length === 0
  ) {
    return (
      <p className="mt-4 text-xl font-medium tracking-[-0.035em] text-white/36">
        None
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-1.5">
      {entries.map(
        ([
          currency,
          cents,
        ]) => (
          <p
            key={currency}
            className="text-xl font-medium tracking-[-0.035em] text-[#f4f0e8]"
          >
            {money(
              cents,
              currency,
            )}
          </p>
        ),
      )}
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: DisplayStatus;
}) {
  const className =
    status ===
      "paid"
      ? "border-emerald-200/15 bg-emerald-200/[0.04] text-emerald-100/70"
      : status ===
          "overdue"
        ? "border-rose-200/15 bg-rose-200/[0.04] text-rose-100/55"
        : status ===
            "issued"
          ? "border-[#c8ad84]/20 bg-[#c8ad84]/[0.04] text-[#d8bf99]/65"
          : status ===
              "void"
            ? "border-white/8 bg-white/[0.02] text-white/32"
            : "border-white/10 bg-white/[0.025] text-white/38";

  return (
    <span
      className={`w-fit rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {status}
    </span>
  );
}

export default function InvoiceManagementDashboard() {
  const [
    invoices,
    setInvoices,
  ] =
    useState<
      InvoiceSummary[]
    >(
      [],
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

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    search,
    setSearch,
  ] =
    useState(
      "",
    );

  const [
    filter,
    setFilter,
  ] =
    useState<Filter>(
      "all",
    );

  const [
    busyAction,
    setBusyAction,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const loadInvoices =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const response =
            await fetch(
              "/api/admin/invoices/manage",
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            (await response.json()) as
              WorkspacePayload;

          if (
            !response.ok
          ) {
            throw new Error(
              payload.error ||
                "Could not load invoices.",
            );
          }

          setInvoices(
            payload.invoices ??
              [],
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
              : "Could not load invoices.",
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
            void loadInvoices();
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
      loadInvoices,
    ],
  );

  const derived =
    useMemo(
      () =>
        invoices.map(
          (
            invoice,
          ) => ({
            invoice,
            displayStatus:
              displayStatus(
                invoice,
              ),
            client:
              clientName(
                invoice,
              ),
          }),
        ),
      [
        invoices,
      ],
    );

  const statusCounts =
    useMemo(
      () => {
        const counts:
          Record<
            DisplayStatus,
            number
          > = {
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

        for (
          const row of derived
        ) {
          counts[
            row.displayStatus
          ] += 1;
        }

        return counts;
      },
      [
        derived,
      ],
    );

  const visibleInvoices =
    useMemo(
      () => {
        const needle =
          search
            .trim()
            .toLowerCase();

        return derived.filter(
          (
            row,
          ) => {
            if (
              filter !==
                "all" &&
              row.displayStatus !==
                filter
            ) {
              return false;
            }

            if (
              !needle
            ) {
              return true;
            }

            return [
              row.invoice
                .invoice_number,
              row.client,
              row.invoice
                .currency,
              row.displayStatus,
            ].some(
              (
                value,
              ) =>
                value
                  .toLowerCase()
                  .includes(
                    needle,
                  ),
            );
          },
        );
      },
      [
        derived,
        filter,
        search,
      ],
    );

  const outstanding =
    useMemo(
      () =>
        moneyByCurrency(
          invoices.filter(
            (
              invoice,
            ) =>
              invoice.status ===
                "issued",
          ),
        ),
      [
        invoices,
      ],
    );

  const paidThisMonth =
    useMemo(
      () => {
        const currentMonth =
          monthKey(
            new Date(),
          );

        return moneyByCurrency(
          invoices.filter(
            (
              invoice,
            ) => {
              if (
                invoice.status !==
                  "paid" ||
                !invoice.paid_at
              ) {
                return false;
              }

              const paidDate =
                new Date(
                  invoice.paid_at,
                );

              return (
                !Number.isNaN(
                  paidDate.getTime(),
                ) &&
                monthKey(
                  paidDate,
                ) ===
                  currentMonth
              );
            },
          ),
        );
      },
      [
        invoices,
      ],
    );

  async function issueInvoice(
    invoice: InvoiceSummary,
  ) {
    if (
      invoice.status !==
        "draft"
    ) {
      return;
    }

    if (
      !window.confirm(
        `Issue ${invoice.invoice_number}? Billing details, line items, totals, and the final PDF will be locked.`,
      )
    ) {
      return;
    }

    const key =
      `issue:${invoice.id}`;

    setBusyAction(
      key,
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/invoices/${invoice.id}/issue`,
          {
            method:
              "POST",
          },
        );

      const payload =
        (await response.json()) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Could not issue invoice.",
        );
      }

      setMessage(
        `${invoice.invoice_number} issued and locked.`,
      );

      await loadInvoices();
    } catch (
      actionError
    ) {
      setMessage(
        actionError instanceof
          Error
          ? actionError.message
          : "Could not issue invoice.",
      );
    } finally {
      setBusyAction(
        null,
      );
    }
  }

  async function markPaid(
    invoice: InvoiceSummary,
  ) {
    if (
      invoice.status !==
        "issued"
    ) {
      return;
    }

    if (
      !window.confirm(
        `Mark ${invoice.invoice_number} as paid?`,
      )
    ) {
      return;
    }

    const key =
      `paid:${invoice.id}`;

    setBusyAction(
      key,
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/invoices/${invoice.id}/paid`,
          {
            method:
              "POST",
          },
        );

      const payload =
        (await response.json()) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Could not mark invoice paid.",
        );
      }

      setMessage(
        `${invoice.invoice_number} marked paid.`,
      );

      await loadInvoices();
    } catch (
      actionError
    ) {
      setMessage(
        actionError instanceof
          Error
          ? actionError.message
          : "Could not mark invoice paid.",
      );
    } finally {
      setBusyAction(
        null,
      );
    }
  }

  async function voidInvoice(
    invoice: InvoiceSummary,
  ) {
    if (
      invoice.status !==
        "draft" &&
      invoice.status !==
        "issued"
    ) {
      return;
    }

    const warning =
      invoice.status ===
        "issued"
        ? `Void ${invoice.invoice_number}? Its immutable issued PDF will remain preserved.`
        : `Void ${invoice.invoice_number}? This draft will be closed permanently.`;

    if (
      !window.confirm(
        warning,
      )
    ) {
      return;
    }

    const key =
      `void:${invoice.id}`;

    setBusyAction(
      key,
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/invoices/${invoice.id}/void`,
          {
            method:
              "POST",
          },
        );

      const payload =
        (await response.json()) as {
          error?: string;
          preservedFinalPdf?: boolean;
        };

      if (
        !response.ok
      ) {
        throw new Error(
          payload.error ||
            "Could not void invoice.",
        );
      }

      setMessage(
        payload.preservedFinalPdf
          ? `${invoice.invoice_number} voided. Its original issued PDF remains preserved.`
          : `${invoice.invoice_number} voided.`,
      );

      await loadInvoices();
    } catch (
      actionError
    ) {
      setMessage(
        actionError instanceof
          Error
          ? actionError.message
          : "Could not void invoice.",
      );
    } finally {
      setBusyAction(
        null,
      );
    }
  }

  const filters:
    {
      id: Filter;
      label: string;
      count: number;
    }[] = [
      {
        id:
          "all",
        label:
          "All",
        count:
          invoices.length,
      },
      {
        id:
          "draft",
        label:
          "Draft",
        count:
          statusCounts.draft,
      },
      {
        id:
          "issued",
        label:
          "Issued",
        count:
          statusCounts.issued,
      },
      {
        id:
          "overdue",
        label:
          "Overdue",
        count:
          statusCounts.overdue,
      },
      {
        id:
          "paid",
        label:
          "Paid",
        count:
          statusCounts.paid,
      },
      {
        id:
          "void",
        label:
          "Void",
        count:
          statusCounts.void,
      },
    ];

  return (
    <section className="mt-12">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/32">
            Outstanding
          </p>

          <MoneyStack
            entries={
              outstanding
            }
          />

          <p className="mt-3 text-xs leading-5 text-white/32">
            Issued and overdue balances. Currencies are never mixed.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/32">
            Paid this month
          </p>

          <MoneyStack
            entries={
              paidThisMonth
            }
          />

          <p className="mt-3 text-xs leading-5 text-white/32">
            Payment totals grouped by their original invoice currency.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/32">
            Drafts
          </p>

          <p className="mt-4 text-3xl font-medium tracking-[-0.045em] text-[#f4f0e8]">
            {
              statusCounts.draft
            }
          </p>

          <p className="mt-3 text-xs leading-5 text-white/32">
            Saved invoices that can still be prepared before issue.
          </p>
        </div>

        <div className="rounded-[24px] border border-[#c8ad84]/15 bg-[#c8ad84]/[0.035] p-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#d8bf99]/45">
            Total invoices
          </p>

          <p className="mt-4 text-3xl font-medium tracking-[-0.045em] text-[#f4f0e8]">
            {
              invoices.length
            }
          </p>

          <p className="mt-3 text-xs leading-5 text-white/36">
            {
              statusCounts.overdue
            } overdue right now.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-[28px] border border-white/[0.07] bg-[#161612] p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#c8ad84]/45">
              Invoice register
            </p>

            <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
              Every invoice in one place
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/invoices/analytics"
              className="w-fit rounded-xl border border-[#c8ad84]/20 bg-[#c8ad84]/[0.04] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d8bf99]/60 transition hover:border-[#c8ad84]/35 hover:text-[#ead6b5]"
            >
              Finance Overview
            </Link>

            <Link
              href="/admin/invoices/new"
              className="w-fit rounded-xl bg-[#f4f0e8] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#11110f] transition hover:bg-white"
            >
              New Invoice
            </Link>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {filters.map(
              (
                item,
              ) => (
                <button
                  key={
                    item.id
                  }
                  type="button"
                  onClick={() =>
                    setFilter(
                      item.id,
                    )
                  }
                  className={[
                    "rounded-full border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.09em] transition",
                    filter ===
                    item.id
                      ? "border-[#c8ad84]/35 bg-[#c8ad84]/10 text-[#ead6b5]"
                      : "border-white/8 bg-white/[0.02] text-white/36 hover:border-white/15 hover:text-white/50",
                  ].join(
                    " ",
                  )}
                >
                  {
                    item.label
                  }{" "}
                  {
                    item.count
                  }
                </button>
              ),
            )}
          </div>

          <label className="block">
            <span className="sr-only">
              Search invoices
            </span>

            <input
              value={
                search
              }
              onChange={(
                event,
              ) =>
                setSearch(
                  event
                    .target
                    .value,
                )
              }
              placeholder="Search invoice number, client, currency, or status..."
              className="w-full rounded-2xl border border-white/10 bg-[#11110f] px-4 py-3 text-sm text-[#f4f0e8] outline-none transition placeholder:text-white/28 focus:border-[#c8ad84]/30"
            />
          </label>
        </div>

        {message && (
          <div className="mt-5 rounded-2xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.04] px-4 py-3 text-xs leading-6 text-[#ead6b5]/65">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200/15 bg-rose-200/[0.04] px-4 py-3 text-xs leading-6 text-rose-100/55">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-7 rounded-2xl border border-white/[0.06] p-6 text-sm text-white/30">
            Loading invoices...
          </div>
        ) : visibleInvoices.length ===
          0 ? (
          <div className="mt-7 rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <p className="text-sm text-white/38">
              No invoices match this view.
            </p>

            <Link
              href="/admin/invoices/new"
              className="mt-4 inline-flex rounded-xl border border-[#c8ad84]/20 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#d8bf99]/55"
            >
              Create invoice
            </Link>
          </div>
        ) : (
          <div className="mt-7 overflow-hidden rounded-2xl border border-white/[0.06]">
            {visibleInvoices.map(
              (
                row,
                index,
              ) => {
                const {
                  invoice,
                } =
                  row;

                const issueBusy =
                  busyAction ===
                  `issue:${invoice.id}`;

                const paidBusy =
                  busyAction ===
                  `paid:${invoice.id}`;

                const voidBusy =
                  busyAction ===
                  `void:${invoice.id}`;

                const anyBusy =
                  Boolean(
                    busyAction,
                  );

                return (
                  <div
                    key={
                      invoice.id
                    }
                    className={[
                      "grid gap-4 px-5 py-5 transition hover:bg-white/[0.018] lg:grid-cols-[1.1fr_1fr_0.75fr_0.8fr_auto] lg:items-center",
                      index >
                      0
                        ? "border-t border-white/[0.055]"
                        : "",
                    ].join(
                      " ",
                    )}
                  >
                    <div>
                      <Link
                        href={`/admin/invoices/${invoice.id}`}
                        className="text-sm font-medium tracking-[-0.02em] text-[#f4f0e8] transition hover:text-[#ead6b5]"
                      >
                        {
                          invoice.invoice_number
                        }
                      </Link>

                      <p className="mt-1 text-[10px] text-white/32">
                        Invoice{" "}
                        {
                          formatDate(
                            invoice.invoice_date,
                          )
                        }
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-white/52">
                        {
                          row.client
                        }
                      </p>

                      <p className="mt-1 text-[10px] text-white/30">
                        Due{" "}
                        {
                          formatDate(
                            invoice.due_date,
                          )
                        }
                      </p>
                    </div>

                    <StatusPill
                      status={
                        row.displayStatus
                      }
                    />

                    <p className="text-sm font-medium text-white/55">
                      {
                        money(
                          invoice.total_cents,
                          invoice.currency,
                        )
                      }
                    </p>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Link
                        href={`/admin/invoices/${invoice.id}`}
                        className="rounded-lg border border-white/10 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.09em] text-white/46 transition hover:border-white/20 hover:text-white/70"
                      >
                        View
                      </Link>

                      {invoice.status === "draft" && (
                        <Link
                          href={`/admin/invoices/${invoice.id}/edit`}
                          className="rounded-lg border border-white/10 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.09em] text-white/46 transition hover:border-[#c8ad84]/25 hover:text-[#d8bf99]/75"
                        >
                          Edit
                        </Link>
                      )}

                      {(invoice.status === "draft" || Boolean(invoice.final_pdf_created_at)) && (
                        <a
                          href={`/api/admin/invoices/${invoice.id}/pdf`}
                          className="rounded-lg border border-white/10 px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.09em] text-white/46 transition hover:border-[#c8ad84]/25 hover:text-[#d8bf99]/75"
                        >
                          {invoice.status === "draft" ? "Draft PDF" : "PDF"}
                        </a>
                      )}

                      {invoice.status === "draft" && (
                        <button
                          type="button"
                          disabled={anyBusy}
                          onClick={() => void issueInvoice(invoice)}
                          className="rounded-lg border border-[#c8ad84]/20 bg-[#c8ad84]/[0.04] px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.09em] text-[#d8bf99]/55 transition hover:border-[#c8ad84]/35 hover:text-[#ead6b5] disabled:opacity-35"
                        >
                          {issueBusy ? "Issuing..." : "Issue"}
                        </button>
                      )}

                      {invoice.status === "issued" && (
                        <button
                          type="button"
                          disabled={anyBusy}
                          onClick={() => void markPaid(invoice)}
                          className="rounded-lg border border-emerald-200/15 bg-emerald-200/[0.03] px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.09em] text-emerald-100/45 transition hover:border-emerald-200/25 hover:text-emerald-100/65 disabled:opacity-35"
                        >
                          {paidBusy ? "Saving..." : "Mark Paid"}
                        </button>
                      )}

                      {(invoice.status === "draft" || invoice.status === "issued") && (
                        <button
                          type="button"
                          disabled={anyBusy}
                          onClick={() => void voidInvoice(invoice)}
                          className="rounded-lg border border-rose-200/15 bg-rose-200/[0.02] px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.09em] text-rose-100/40 transition hover:border-rose-200/25 hover:text-rose-100/60 disabled:opacity-35"
                        >
                          {voidBusy ? "Voiding..." : "Void"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </section>
  );
}
