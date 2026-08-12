"use client";

import Link from "next/link";
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

type InvoiceRecord = {
  id: string;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  invoice_date: string;
  due_date: string;
  currency: string;
  sender_snapshot: unknown;
  client_snapshot: unknown;
  payment_instructions_snapshot: string;
  notes: string;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  adjustment_cents: number;
  total_cents: number;
  issued_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  final_pdf_sha256: string | null;
  final_pdf_bytes: number | null;
  final_pdf_created_at: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceItem = {
  id: string;
  sort_order: number;
  description: string;
  quantity:
    | number
    | string;
  unit_label: string;
  unit_rate_cents: number;
  amount_cents: number;
  notes: string;
};

type Payload = {
  invoice?: InvoiceRecord;
  items?: InvoiceItem[];
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
  invoice: InvoiceRecord,
) {
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

function partyName(
  snapshot: unknown,
  companyKey: string,
  nameKey: string,
) {
  return (
    snapshotValue(
      snapshot,
      companyKey,
    ) ||
    snapshotValue(
      snapshot,
      nameKey,
    ) ||
    "Not provided"
  );
}

function partyLines(
  snapshot: unknown,
) {
  const addressOne =
    snapshotValue(
      snapshot,
      "addressLine1",
    );

  const addressTwo =
    snapshotValue(
      snapshot,
      "addressLine2",
    );

  const city =
    snapshotValue(
      snapshot,
      "city",
    );

  const region =
    snapshotValue(
      snapshot,
      "region",
    );

  const postal =
    snapshotValue(
      snapshot,
      "postalCode",
    );

  const country =
    snapshotValue(
      snapshot,
      "country",
    );

  const email =
    snapshotValue(
      snapshot,
      "email",
    );

  const phone =
    snapshotValue(
      snapshot,
      "phone",
    );

  const locality =
    [
      city,
      region,
      postal,
    ]
      .filter(
        Boolean,
      )
      .join(
        ", ",
      );

  return [
    addressOne,
    addressTwo,
    locality,
    country,
    email,
    phone,
  ].filter(
    Boolean,
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

  return date.toLocaleString(
    undefined,
    value.length === 10
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

function TimelineValue({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="border-t border-white/[0.055] py-3 first:border-t-0">
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28">
        {label}
      </p>

      <p className="mt-1 text-xs text-white/42">
        {
          formatDate(
            value,
          )
        }
      </p>
    </div>
  );
}

export default function InvoiceDetailView({
  invoiceId,
}: {
  invoiceId: string;
}) {
  const [
    invoice,
    setInvoice,
  ] =
    useState<
      InvoiceRecord | null
    >(
      null,
    );

  const [
    items,
    setItems,
  ] =
    useState<
      InvoiceItem[]
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
    busy,
    setBusy,
  ] =
    useState<
      "issue" |
      "paid" |
      "void" |
      null
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
              `/api/admin/invoices/${invoiceId}`,
              {
                cache:
                  "no-store",
              },
            );

          const payload =
            (await response.json()) as
              Payload;

          if (
            !response.ok ||
            !payload.invoice
          ) {
            throw new Error(
              payload.error ||
                "Could not load invoice.",
            );
          }

          setInvoice(
            payload.invoice,
          );

          setItems(
            payload.items ??
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
              : "Could not load invoice.",
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
    ],
  );

  async function issue() {
    if (
      !invoice ||
      invoice.status !==
        "draft"
    ) {
      return;
    }

    if (
      !window.confirm(
        `Issue ${invoice.invoice_number}? This locks its billing details, work items, totals, and final PDF.`,
      )
    ) {
      return;
    }

    setBusy(
      "issue",
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
        "Invoice issued. Its final PDF and content are now locked.",
      );

      await load();
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
      setBusy(
        null,
      );
    }
  }

  async function markPaid() {
    if (
      !invoice ||
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

    setBusy(
      "paid",
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
        "Invoice marked paid. The issued PDF remains unchanged.",
      );

      await load();
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
      setBusy(
        null,
      );
    }
  }

  async function voidInvoice() {
    if (
      !invoice ||
      (
        invoice.status !==
          "draft" &&
        invoice.status !==
          "issued"
      )
    ) {
      return;
    }

    const issuedCopy =
      invoice.status ===
        "issued";

    const warning =
      issuedCopy
        ? `Void ${invoice.invoice_number}? The issued PDF will remain preserved as the immutable record, but the invoice will be marked void.`
        : `Void ${invoice.invoice_number}? This draft will be closed and cannot be edited or issued afterward.`;

    if (
      !window.confirm(
        warning,
      )
    ) {
      return;
    }

    setBusy(
      "void",
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
          ? "Invoice voided. The original issued PDF remains preserved and unchanged."
          : "Invoice voided.",
      );

      await load();
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
      setBusy(
        null,
      );
    }
  }

  if (
    loading
  ) {
    return (
      <div className="rounded-[28px] border border-white/[0.07] bg-[#161612] p-8 text-sm text-white/35">
        Loading invoice...
      </div>
    );
  }

  if (
    error ||
    !invoice
  ) {
    return (
      <section className="max-w-2xl rounded-[28px] border border-rose-200/15 bg-rose-200/[0.035] p-8">
        <p className="text-sm leading-7 text-rose-100/55">
          {
            error ||
            "Invoice not found."
          }
        </p>

        <Link
          href="/admin/invoices"
          className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40"
        >
          Back to invoices
        </Link>
      </section>
    );
  }

  const status =
    displayStatus(
      invoice,
    );

  const senderName =
    partyName(
      invoice.sender_snapshot,
      "businessName",
      "displayName",
    );

  const client =
    partyName(
      invoice.client_snapshot,
      "companyName",
      "billingName",
    );

  const senderLines =
    partyLines(
      invoice.sender_snapshot,
    );

  const clientLines =
    partyLines(
      invoice.client_snapshot,
    );

  const canDownload =
    invoice.status ===
      "draft" ||
    Boolean(
      invoice.final_pdf_sha256,
    );

  const pdfLabel =
    invoice.status ===
      "draft"
      ? "Draft PDF"
      : "Download PDF";

  return (
    <section>
      <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8ad84]/55">
              Invoice Detail
            </p>

            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/35">
              {status}
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] text-[#f4f0e8] sm:text-5xl">
            {
              invoice.invoice_number
            }
          </h1>

          <p className="mt-4 text-sm text-white/38">
            {client}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/invoices"
            className="rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/38 transition hover:text-white/60"
          >
            All Invoices
          </Link>

          <Link
            href="/admin/invoices/new"
            className="rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/38 transition hover:text-white/60"
          >
            New Invoice
          </Link>

          {invoice.status ===
            "draft" && (
            <Link
              href={`/admin/invoices/${invoice.id}/edit`}
              className="rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/45 transition hover:border-[#c8ad84]/25 hover:text-[#ead6b5]"
            >
              Edit Draft
            </Link>
          )}

          {canDownload && (
            <a
              href={`/api/admin/invoices/${invoice.id}/pdf`}
              className="rounded-xl border border-[#c8ad84]/20 bg-[#c8ad84]/[0.04] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#d8bf99]/60 transition hover:border-[#c8ad84]/35 hover:text-[#ead6b5]"
            >
              {pdfLabel}
            </a>
          )}

          {invoice.status ===
            "draft" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void issue()}
              className="rounded-xl bg-[#f4f0e8] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white disabled:opacity-40"
            >
              {busy === "issue" ? "Issuing..." : "Issue Invoice"}
            </button>
          )}

          {invoice.status ===
            "issued" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void markPaid()}
              className="rounded-xl border border-emerald-200/15 bg-emerald-200/[0.04] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-100/55 transition hover:border-emerald-200/25 hover:text-emerald-100/75 disabled:opacity-40"
            >
              {busy === "paid" ? "Saving..." : "Mark Paid"}
            </button>
          )}

          {(invoice.status === "draft" || invoice.status === "issued") && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void voidInvoice()}
              className="rounded-xl border border-rose-200/15 bg-rose-200/[0.025] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-rose-100/45 transition hover:border-rose-200/25 hover:text-rose-100/65 disabled:opacity-40"
            >
              {busy === "void" ? "Voiding..." : "Void"}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="mt-6 rounded-2xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.04] px-4 py-3 text-xs leading-6 text-[#ead6b5]/65">
          {message}
        </div>
      )}

      <div className="mt-10 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">
                From
              </p>

              <h2 className="mt-3 text-xl font-medium tracking-[-0.035em]">
                {senderName}
              </h2>

              {senderLines.length >
                0 && (
                <div className="mt-3 space-y-1 text-xs leading-5 text-white/38">
                  {senderLines.map(
                    (
                      line,
                    ) => (
                      <p
                        key={
                          line
                        }
                      >
                        {line}
                      </p>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">
                Bill to
              </p>

              <h2 className="mt-3 text-xl font-medium tracking-[-0.035em]">
                {client}
              </h2>

              {clientLines.length >
                0 && (
                <div className="mt-3 space-y-1 text-xs leading-5 text-white/38">
                  {clientLines.map(
                    (
                      line,
                    ) => (
                      <p
                        key={
                          line
                        }
                      >
                        {line}
                      </p>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#161612]">
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-white/[0.06] px-6 py-4 sm:grid-cols-[1fr_100px_120px_120px]">
              <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28">
                Work
              </p>

              <p className="hidden text-right text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28 sm:block">
                Qty
              </p>

              <p className="hidden text-right text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28 sm:block">
                Rate
              </p>

              <p className="text-right text-[8px] font-semibold uppercase tracking-[0.12em] text-white/28">
                Amount
              </p>
            </div>

            {items.map(
              (
                item,
              ) => (
                <div
                  key={
                    item.id
                  }
                  className="grid grid-cols-[1fr_auto] gap-4 border-b border-white/[0.05] px-6 py-5 last:border-b-0 sm:grid-cols-[1fr_100px_120px_120px]"
                >
                  <div>
                    <p className="text-sm text-white/55">
                      {
                        item.description
                      }
                    </p>

                    {item.notes && (
                      <p className="mt-2 text-xs leading-5 text-white/32">
                        {
                          item.notes
                        }
                      </p>
                    )}
                  </div>

                  <p className="hidden text-right text-xs text-white/35 sm:block">
                    {
                      String(
                        item.quantity,
                      )
                    }{" "}
                    {
                      item.unit_label
                    }
                  </p>

                  <p className="hidden text-right text-xs text-white/35 sm:block">
                    {
                      money(
                        item.unit_rate_cents,
                        invoice.currency,
                      )
                    }
                  </p>

                  <p className="text-right text-sm font-medium text-white/55">
                    {
                      money(
                        item.amount_cents,
                        invoice.currency,
                      )
                    }
                  </p>
                </div>
              ),
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">
                Payment instructions
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/38">
                {
                  invoice.payment_instructions_snapshot ||
                  "No payment instructions saved."
                }
              </p>
            </div>

            <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">
                Note
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/38">
                {
                  invoice.notes ||
                  "No invoice note."
                }
              </p>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[24px] border border-[#c8ad84]/15 bg-[#c8ad84]/[0.03] p-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#d8bf99]/45">
              Invoice total
            </p>

            <p className="mt-4 text-3xl font-medium tracking-[-0.045em]">
              {
                money(
                  invoice.total_cents,
                  invoice.currency,
                )
              }
            </p>

            <div className="mt-6 space-y-3 border-t border-[#c8ad84]/10 pt-5 text-xs">
              <div className="flex justify-between gap-4 text-white/38">
                <span>
                  Subtotal
                </span>
                <span>
                  {
                    money(
                      invoice.subtotal_cents,
                      invoice.currency,
                    )
                  }
                </span>
              </div>

              {invoice.discount_cents >
                0 && (
                <div className="flex justify-between gap-4 text-white/38">
                  <span>
                    Discount
                  </span>
                  <span>
                    -
                    {
                      money(
                        invoice.discount_cents,
                        invoice.currency,
                      )
                    }
                  </span>
                </div>
              )}

              {invoice.tax_cents >
                0 && (
                <div className="flex justify-between gap-4 text-white/38">
                  <span>
                    Tax
                  </span>
                  <span>
                    {
                      money(
                        invoice.tax_cents,
                        invoice.currency,
                      )
                    }
                  </span>
                </div>
              )}

              {invoice.adjustment_cents !==
                0 && (
                <div className="flex justify-between gap-4 text-white/38">
                  <span>
                    Adjustment
                  </span>
                  <span>
                    {
                      money(
                        invoice.adjustment_cents,
                        invoice.currency,
                      )
                    }
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">
              Dates
            </p>

            <div className="mt-3">
              <TimelineValue
                label="Invoice date"
                value={
                  invoice.invoice_date
                }
              />

              <TimelineValue
                label="Due date"
                value={
                  invoice.due_date
                }
              />

              <TimelineValue
                label="Issued"
                value={
                  invoice.issued_at
                }
              />

              <TimelineValue
                label="Paid"
                value={
                  invoice.paid_at
                }
              />

              <TimelineValue
                label="Voided"
                value={
                  invoice.voided_at
                }
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">
              Document integrity
            </p>

            {invoice.final_pdf_sha256 ? (
              <>
                <p className="mt-3 text-xs leading-6 text-white/42">
                  Final issued PDF preserved.
                </p>

                <p className="mt-4 break-all font-mono text-[10px] leading-5 text-white/30">
                  SHA-256{" "}
                  {
                    invoice.final_pdf_sha256
                  }
                </p>

                <p className="mt-2 text-[10px] text-white/28">
                  {
                    invoice.final_pdf_bytes
                      ? `${invoice.final_pdf_bytes.toLocaleString()} bytes`
                      : "Size recorded"
                  }{" "}
                  /{" "}
                  {
                    formatDate(
                      invoice.final_pdf_created_at,
                    )
                  }
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs leading-6 text-white/38">
                A final PDF will be sealed when this draft is issued.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
