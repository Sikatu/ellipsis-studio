import type {
  Metadata,
} from "next";

import {
  notFound,
} from "next/navigation";

import {
  loadInvoiceDeliveryPortal,
} from "@/lib/server/invoice-delivery";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const metadata:
  Metadata = {
    title:
      "Secure Invoice",
    robots: {
      index:
        false,
      follow:
        false,
      noarchive:
        true,
      nosnippet:
        true,
    },
  };

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
  const locality =
    [
      snapshotValue(
        snapshot,
        "city",
      ),
      snapshotValue(
        snapshot,
        "region",
      ),
      snapshotValue(
        snapshot,
        "postalCode",
      ),
    ]
      .filter(
        Boolean,
      )
      .join(
        ", ",
      );

  return [
    snapshotValue(
      snapshot,
      "addressLine1",
    ),
    snapshotValue(
      snapshot,
      "addressLine2",
    ),
    locality,
    snapshotValue(
      snapshot,
      "country",
    ),
    snapshotValue(
      snapshot,
      "email",
    ),
    snapshotValue(
      snapshot,
      "phone",
    ),
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
      cents /
      100
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

export default async function SecureInvoicePage({
  params,
}: {
  params:
    Promise<{
      token: string;
    }>;
}) {
  const {
    token,
  } =
    await params;

  const portal =
    await loadInvoiceDeliveryPortal(
      token,
    );

  if (!portal) {
    notFound();
  }

  const {
    invoice,
    items,
  } =
    portal;

  const senderName =
    partyName(
      invoice.sender_snapshot,
      "businessName",
      "displayName",
    );

  const clientName =
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

  return (
    <main className="min-h-screen bg-[#11110f] px-5 py-10 text-[#f4f0e8] sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-7 border-b border-white/[0.08] pb-9 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c8ad84]/55">
              ELLIPSIS Studio / Secure Invoice
            </p>

            <h1 className="mt-5 text-4xl font-medium tracking-[-0.055em] sm:text-5xl">
              {
                invoice.invoice_number
              }
            </h1>

            <p className="mt-3 text-sm text-white/38">
              {
                clientName
              }
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={[
              "rounded-full border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em]",
              invoice.status ===
                "paid"
                ? "border-emerald-200/15 bg-emerald-200/[0.04] text-emerald-100/65"
                : "border-[#c8ad84]/20 bg-[#c8ad84]/[0.04] text-[#d8bf99]/65",
            ].join(
              " ",
            )}>
              {
                invoice.status
              }
            </span>

            <a
              href={`/api/invoice/${token}/pdf`}
              className="rounded-xl bg-[#f4f0e8] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.11em] text-[#11110f] transition hover:bg-white"
            >
              Download PDF
            </a>
          </div>
        </header>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">
              From
            </p>

            <h2 className="mt-3 text-xl font-medium tracking-[-0.035em]">
              {
                senderName
              }
            </h2>

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
          </div>

          <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">
              Bill to
            </p>

            <h2 className="mt-3 text-xl font-medium tracking-[-0.035em]">
              {
                clientName
              }
            </h2>

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
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#161612]">
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
                  <p className="text-sm text-white/60">
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

                <p className="text-right text-sm font-medium text-white/60">
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
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">
                Payment instructions
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/42">
                {
                  invoice.payment_instructions_snapshot ||
                  "No payment instructions provided."
                }
              </p>
            </div>

            {invoice.notes && (
              <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">
                  Note
                </p>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/42">
                  {
                    invoice.notes
                  }
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-5">
            <div className="rounded-[24px] border border-[#c8ad84]/15 bg-[#c8ad84]/[0.035] p-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#d8bf99]/45">
                Total
              </p>

              <p className="mt-4 text-3xl font-medium tracking-[-0.045em]">
                {
                  money(
                    invoice.total_cents,
                    invoice.currency,
                  )
                }
              </p>

              <div className="mt-5 space-y-2 border-t border-[#c8ad84]/10 pt-4 text-xs text-white/38">
                <div className="flex justify-between gap-4">
                  <span>
                    Invoice date
                  </span>

                  <span>
                    {
                      formatDate(
                        invoice.invoice_date,
                      )
                    }
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>
                    Due date
                  </span>

                  <span>
                    {
                      formatDate(
                        invoice.due_date,
                      )
                    }
                  </span>
                </div>

                {invoice.paid_at && (
                  <div className="flex justify-between gap-4 text-emerald-100/55">
                    <span>
                      Paid
                    </span>

                    <span>
                      {
                        formatDate(
                          invoice.paid_at,
                        )
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.07] bg-[#161612] p-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">
                Document integrity
              </p>

              <p className="mt-3 text-xs leading-6 text-white/38">
                This page serves the sealed PDF created when the invoice was issued.
              </p>

              <p className="mt-3 break-all font-mono text-[9px] leading-5 text-white/25">
                SHA-256{" "}
                {
                  invoice.final_pdf_sha256
                }
              </p>
            </div>
          </aside>
        </section>

        <footer className="mt-10 border-t border-white/[0.07] pt-6 text-[10px] leading-5 text-white/25">
          This secure link provides read-only access to the issued invoice. If the sender replaces or revokes the link, this page will stop opening.
        </footer>
      </div>
    </main>
  );
}
