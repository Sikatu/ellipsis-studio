"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  billingDraftFromRow,
  emptyStudioBillingProfile,
  INVOICE_CURRENCIES,
  normalizeInvoicePrefix,
  type StudioBillingProfile,
  type StudioBillingProfileDraft,
} from "@/lib/invoice";

const termsOptions =
  [
    0,
    7,
    14,
    30,
    45,
    60,
  ];

export default function InvoiceBillingSetup() {
  const [
    draft,
    setDraft,
  ] =
    useState<
      StudioBillingProfileDraft
    >(
      emptyStudioBillingProfile(),
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    saved,
    setSaved,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  useEffect(() => {
    const controller =
      new AbortController();

    void fetch(
      "/api/admin/invoice-settings",
      {
        cache:
          "no-store",
        signal:
          controller.signal,
      },
    )
      .then(
        async (
          response,
        ) => {
          const payload =
            await response
              .json();

          if (!response.ok) {
            throw new Error(
              payload.error ??
                "Could not load invoice setup.",
            );
          }

          if (
            payload.profile
          ) {
            setDraft(
              billingDraftFromRow(
                payload.profile as
                  StudioBillingProfile,
              ),
            );
            setSaved(true);
          }
        },
      )
      .catch(
        (error) => {
          if (
            error instanceof DOMException &&
            error.name ===
              "AbortError"
          ) {
            return;
          }

          setMessage(
            error instanceof Error
              ? error.message
              : "Could not load invoice setup.",
          );
        },
      )
      .finally(
        () => {
          setLoading(
            false,
          );
        },
      );

    return () => {
      controller.abort();
    };
  }, []);

  const exampleNumber =
    useMemo(
      () =>
        `${draft.invoicePrefix || "ELL"}-${new Date().getFullYear()}-0001`,
      [
        draft.invoicePrefix,
      ],
    );

  function update(
    field:
      keyof StudioBillingProfileDraft,
    value:
      string |
      number,
  ) {
    setDraft(
      (
        current,
      ) => ({
        ...current,
        [field]:
          value,
      }),
    );

    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/invoice-settings",
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                draft,
              ),
          },
        );

      const payload =
        await response
          .json();

      if (!response.ok) {
        throw new Error(
          payload.error ??
            "Could not save invoice setup.",
        );
      }

      setDraft(
        billingDraftFromRow(
          payload.profile as
            StudioBillingProfile,
        ),
      );

      setSaved(true);
      setMessage(
        "Invoice setup saved.",
      );
    } catch (error) {
      setSaved(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save invoice setup.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-8 rounded-[28px] border border-white/[0.08] bg-[#161612] p-7 text-sm text-white/30">
        Loading your invoice setup...
      </div>
    );
  }

  return (
    <section
      id="billing-setup"
      className="mt-8 rounded-[28px] border border-white/[0.08] bg-[#161612] p-6 sm:p-8"
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8ad84]/55">
            One-time setup
          </p>

          <h2 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-white/75">
            Your invoice details
          </h2>

          <p className="mt-3 max-w-2xl text-xs leading-6 text-white/30">
            Add these once. ELLIPSIS will reuse them whenever you create a new invoice.
          </p>
        </div>

        <span className={[
          "w-fit rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.1em]",
          saved
            ? "border-emerald-300/15 bg-emerald-300/[0.03] text-emerald-100/45"
            : "border-white/10 text-white/25",
        ].join(" ")}>
          {saved
            ? "Saved"
            : "Not saved"}
        </span>
      </div>

      <div className="mt-7 grid gap-6">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/22">
            1 · Who is sending the invoice?
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field
              label="Your name"
              value={
                draft.displayName
              }
              required
              placeholder="Jorge Cid Rodriguez"
              onChange={(
                value,
              ) =>
                update(
                  "displayName",
                  value,
                )
              }
            />

            <Field
              label="Business / studio name"
              value={
                draft.businessName
              }
              placeholder="ELLIPSIS"
              onChange={(
                value,
              ) =>
                update(
                  "businessName",
                  value,
                )
              }
            />

            <Field
              label="Email"
              value={
                draft.email
              }
              type="email"
              placeholder="you@example.com"
              onChange={(
                value,
              ) =>
                update(
                  "email",
                  value,
                )
              }
            />

            <Field
              label="Phone"
              value={
                draft.phone
              }
              placeholder="+63..."
              onChange={(
                value,
              ) =>
                update(
                  "phone",
                  value,
                )
              }
            />
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/22">
            2 · Address
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field
              label="Address line 1"
              value={
                draft.addressLine1
              }
              onChange={(
                value,
              ) =>
                update(
                  "addressLine1",
                  value,
                )
              }
            />

            <Field
              label="Address line 2"
              value={
                draft.addressLine2
              }
              onChange={(
                value,
              ) =>
                update(
                  "addressLine2",
                  value,
                )
              }
            />

            <Field
              label="City"
              value={
                draft.city
              }
              onChange={(
                value,
              ) =>
                update(
                  "city",
                  value,
                )
              }
            />

            <Field
              label="Province / State"
              value={
                draft.region
              }
              onChange={(
                value,
              ) =>
                update(
                  "region",
                  value,
                )
              }
            />

            <Field
              label="Postal code"
              value={
                draft.postalCode
              }
              onChange={(
                value,
              ) =>
                update(
                  "postalCode",
                  value,
                )
              }
            />

            <Field
              label="Country"
              value={
                draft.country
              }
              placeholder="Philippines"
              onChange={(
                value,
              ) =>
                update(
                  "country",
                  value,
                )
              }
            />
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/22">
            3 · Your defaults
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <label>
              <span className="text-[10px] text-white/30">
                Default currency
              </span>

              <select
                value={
                  draft.defaultCurrency
                }
                disabled={
                  saving
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "defaultCurrency",
                    event
                      .target
                      .value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/60 outline-none focus:border-[#c8ad84]/30"
              >
                {INVOICE_CURRENCIES.map(
                  (
                    currency,
                  ) => (
                    <option
                      key={
                        currency
                      }
                      value={
                        currency
                      }
                    >
                      {currency}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span className="text-[10px] text-white/30">
                Payment terms
              </span>

              <select
                value={
                  draft.defaultPaymentTermsDays
                }
                disabled={
                  saving
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "defaultPaymentTermsDays",
                    Number(
                      event
                        .target
                        .value,
                    ),
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/60 outline-none focus:border-[#c8ad84]/30"
              >
                {termsOptions.map(
                  (
                    days,
                  ) => (
                    <option
                      key={
                        days
                      }
                      value={
                        days
                      }
                    >
                      {
                        days ===
                          0
                          ? "Due on receipt"
                          : `${days} days`
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <Field
              label="Invoice prefix"
              value={
                draft.invoicePrefix
              }
              placeholder="ELL"
              onChange={(
                value,
              ) =>
                update(
                  "invoicePrefix",
                  normalizeInvoicePrefix(
                    value,
                  ),
                )
              }
            />
          </div>

          <div className="mt-4 rounded-xl border border-[#c8ad84]/10 bg-[#c8ad84]/[0.025] px-4 py-3">
            <p className="text-[9px] uppercase tracking-[0.12em] text-[#c8ad84]/40">
              Example invoice number
            </p>

            <p className="mt-2 font-mono text-xs text-[#e1cba8]/55">
              {exampleNumber}
            </p>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-6">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/22">
            4 · How should clients pay you?
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TextArea
              label="Payment instructions"
              value={
                draft.paymentInstructions
              }
              placeholder="Example: Pay via Wise to..."
              onChange={(
                value,
              ) =>
                update(
                  "paymentInstructions",
                  value,
                )
              }
            />

            <TextArea
              label="Default note"
              value={
                draft.defaultNotes
              }
              placeholder="Example: Thank you for working with me."
              onChange={(
                value,
              ) =>
                update(
                  "defaultNotes",
                  value,
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/[0.07] pt-6">
        <button
          type="button"
          disabled={
            saving
          }
          onClick={
            save
          }
          className="rounded-xl bg-[#f4f0e8] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white disabled:opacity-40"
        >
          {saving
            ? "Saving..."
            : "Save my invoice setup"}
        </button>

        {message && (
          <p className="text-xs text-white/35">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="text-[10px] text-white/30">
        {label}
        {required
          ? " *"
          : ""}
      </span>

      <input
        type={type}
        value={value}
        placeholder={
          placeholder
        }
        onChange={(
          event,
        ) =>
          onChange(
            event
              .target
              .value,
          )
        }
        className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/60 outline-none placeholder:text-white/12 focus:border-[#c8ad84]/30"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder: string;
}) {
  return (
    <label>
      <span className="text-[10px] text-white/30">
        {label}
      </span>

      <textarea
        rows={5}
        value={value}
        placeholder={
          placeholder
        }
        onChange={(
          event,
        ) =>
          onChange(
            event
              .target
              .value,
          )
        }
        className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm leading-6 text-white/60 outline-none placeholder:text-white/12 focus:border-[#c8ad84]/30"
      />
    </label>
  );
}
