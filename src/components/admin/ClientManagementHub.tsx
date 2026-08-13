"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";

import {
  INVOICE_CURRENCIES,
  type InvoiceCurrency,
} from "@/lib/invoice";

type BillingProfile = {
  billing_name: string;
  company_name: string;
  email: string;
  phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  currency: InvoiceCurrency;
  payment_terms_days: number;
  notes: string;
};

type InvoiceSummary = {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  total_cents: number;
  created_at: string;
};

export type ClientManagementRecord = {
  id: string;
  brand_name: string;
  contact_name:
    string | null;
  email:
    string | null;
  website:
    string | null;
  notes:
    string | null;
  status:
    string;
  created_at:
    string;
  updated_at:
    string;
  billingProfile:
    BillingProfile |
    null;
  discoveryCount:
    number;
  latestDiscovery: {
    id: string;
    status: string;
    progress: number;
    updated_at: string;
  } | null;
  invoices:
    InvoiceSummary[];
};

type EditDraft = {
  brandName: string;
  contactName: string;
  email: string;
  website: string;
  notes: string;
  billingName: string;
  companyName: string;
  billingEmail: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  currency: InvoiceCurrency;
  paymentTermsDays: string;
  billingNotes: string;
};

function emptyBilling(
  record:
    ClientManagementRecord,
): EditDraft {
  const billing =
    record.billingProfile;

  return {
    brandName:
      record.brand_name,
    contactName:
      record.contact_name ??
      "",
    email:
      record.email ??
      "",
    website:
      record.website ??
      "",
    notes:
      record.notes ??
      "",
    billingName:
      billing
        ?.billing_name ??
      record.contact_name ??
      record.brand_name,
    companyName:
      billing
        ?.company_name ??
      record.brand_name,
    billingEmail:
      billing
        ?.email ??
      record.email ??
      "",
    phone:
      billing
        ?.phone ??
      "",
    addressLine1:
      billing
        ?.address_line_1 ??
      "",
    addressLine2:
      billing
        ?.address_line_2 ??
      "",
    city:
      billing
        ?.city ??
      "",
    region:
      billing
        ?.region ??
      "",
    postalCode:
      billing
        ?.postal_code ??
      "",
    country:
      billing
        ?.country ??
      "",
    currency:
      billing
        ?.currency ??
      "USD",
    paymentTermsDays:
      String(
        billing
          ?.payment_terms_days ??
        14,
      ),
    billingNotes:
      billing
        ?.notes ??
      "",
  };
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
      cents /
        100,
    );
  } catch {
    return `${currency} ${(
      cents /
      100
    ).toFixed(2)}`;
  }
}

function formatDate(
  value:
    string |
    null,
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

  return date
    .toLocaleDateString(
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

function statusLabel(
  value: string,
) {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character
          .toUpperCase(),
    );
}

function Input({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  onChange:
    (
      value: string,
    ) => void;
}) {
  return (
    <label>
      <span className="text-[10px] text-white/32">
        {label}
      </span>

      <input
        type={type}
        value={
          value
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
        className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none focus:border-[#c8ad84]/30"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange:
    (
      value: string,
    ) => void;
}) {
  return (
    <label>
      <span className="text-[10px] text-white/32">
        {label}
      </span>

      <textarea
        rows={4}
        value={
          value
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
        className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm leading-6 text-white/65 outline-none focus:border-[#c8ad84]/30"
      />
    </label>
  );
}

export default function ClientManagementHub({
  initialRecords,
}: {
  initialRecords:
    ClientManagementRecord[];
}) {
  const [
    records,
    setRecords,
  ] =
    useState(
      initialRecords,
    );

  const [
    query,
    setQuery,
  ] =
    useState(
      "",
    );

  const [
    source,
    setSource,
  ] =
    useState<
      "all" |
      "discovery" |
      "invoice"
    >(
      "all",
    );

  const [
    status,
    setStatus,
  ] =
    useState<
      "active" |
      "archived"
    >(
      "active",
    );

  const [
    openId,
    setOpenId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    draft,
    setDraft,
  ] =
    useState<
      EditDraft |
      null
    >(
      null,
    );

  const [
    busy,
    setBusy,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const activeCount =
    records.filter(
      (
        record,
      ) =>
        record.status ===
        "active",
    ).length;

  const discoveryCount =
    records.filter(
      (
        record,
      ) =>
        record.discoveryCount >
        0,
    ).length;

  const invoiceOnlyCount =
    records.filter(
      (
        record,
      ) =>
        record.discoveryCount ===
          0 &&
        record.invoices.length >
          0,
    ).length;

  const visible =
    useMemo(
      () => {
        const needle =
          query
            .trim()
            .toLowerCase();

        return records.filter(
          (
            record,
          ) => {
            if (
              record.status !==
              status
            ) {
              return false;
            }

            if (
              source ===
                "discovery" &&
              record.discoveryCount ===
                0
            ) {
              return false;
            }

            if (
              source ===
                "invoice" &&
              record.discoveryCount >
                0
            ) {
              return false;
            }

            if (!needle) {
              return true;
            }

            return [
              record.brand_name,
              record.contact_name ??
                "",
              record.email ??
                "",
              record.billingProfile
                ?.billing_name ??
                "",
              record.billingProfile
                ?.email ??
                "",
            ]
              .join(
                " ",
              )
              .toLowerCase()
              .includes(
                needle,
              );
          },
        );
      },
      [
        query,
        records,
        source,
        status,
      ],
    );

  function beginEdit(
    record:
      ClientManagementRecord,
  ) {
    if (
      openId ===
      record.id
    ) {
      setOpenId(
        null,
      );
      setDraft(
        null,
      );
      setMessage(
        null,
      );
      return;
    }

    setOpenId(
      record.id,
    );
    setDraft(
      emptyBilling(
        record,
      ),
    );
    setMessage(
      null,
    );
  }

  function updateDraft(
    field:
      keyof EditDraft,
    value: string,
  ) {
    setDraft(
      (
        current,
      ) =>
        current
          ? {
              ...current,
              [field]:
                value,
            }
          : current,
    );
  }

  async function saveClient(
    record:
      ClientManagementRecord,
  ) {
    if (!draft) {
      return;
    }

    setBusy(
      `save:${record.id}`,
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/clients/${record.id}`,
          {
            method:
              "PUT",
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
          .json() as {
            client?:
              Omit<
                ClientManagementRecord,
                "billingProfile" |
                "discoveryCount" |
                "latestDiscovery" |
                "invoices"
              >;
            billingProfile?:
              BillingProfile;
            error?:
              string;
          };

      if (
        !response.ok ||
        !payload.client
      ) {
        throw new Error(
          payload.error ||
            "Could not update client.",
        );
      }

      setRecords(
        (
          current,
        ) =>
          current.map(
            (
              item,
            ) =>
              item.id ===
                record.id
                ? {
                    ...item,
                    ...payload.client,
                    billingProfile:
                      payload.billingProfile ??
                      item.billingProfile,
                  }
                : item,
          ),
      );

      setMessage(
        "Client and reusable billing details updated. Existing issued invoices were not changed.",
      );
    } catch (
      saveError
    ) {
      setMessage(
        saveError instanceof
          Error
          ? saveError.message
          : "Could not update client.",
      );
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function changeStatus(
    record:
      ClientManagementRecord,
    nextStatus:
      "active" |
      "archived",
  ) {
    setBusy(
      `status:${record.id}`,
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/clients/${record.id}`,
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                status:
                  nextStatus,
              }),
          },
        );

      const payload =
        await response
          .json() as {
            status?: string;
            error?: string;
          };

      if (
        !response.ok ||
        !payload.status
      ) {
        throw new Error(
          payload.error ||
            "Could not change client status.",
        );
      }

      setRecords(
        (
          current,
        ) =>
          current.map(
            (
              item,
            ) =>
              item.id ===
                record.id
                ? {
                    ...item,
                    status:
                      payload.status ??
                      item.status,
                  }
                : item,
          ),
      );

      setOpenId(
        null,
      );
      setDraft(
        null,
      );

      setMessage(
        nextStatus ===
          "archived"
          ? "Client archived. Historical invoices and Brand Discovery data remain preserved."
          : "Client reactivated.",
      );
    } catch (
      statusError
    ) {
      setMessage(
        statusError instanceof
          Error
          ? statusError.message
          : "Could not change client status.",
      );
    } finally {
      setBusy(
        null,
      );
    }
  }

  return (
    <section className="mt-10">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="text-[9px] uppercase tracking-[0.14em] text-white/22">
            Active clients
          </p>

          <p className="mt-3 text-2xl font-medium tracking-[-0.03em] text-white/68">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="text-[9px] uppercase tracking-[0.14em] text-white/22">
            Brand Discovery
          </p>

          <p className="mt-3 text-2xl font-medium tracking-[-0.03em] text-white/68">
            {discoveryCount}
          </p>
        </div>

        <div className="rounded-2xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.035] p-5">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[#d8bf99]/45">
            Invoice only
          </p>

          <p className="mt-3 text-2xl font-medium tracking-[-0.03em] text-[#ead6b5]/70">
            {invoiceOnlyCount}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-white/[0.07] bg-black/10 p-4 lg:flex-row lg:items-center lg:justify-between">
        <input
          value={
            query
          }
          onChange={(
            event,
          ) =>
            setQuery(
              event
                .target
                .value,
            )
          }
          placeholder="Search client, contact, or email..."
          className="w-full rounded-xl border border-white/10 bg-[#11110f] px-4 py-3 text-sm text-white/65 outline-none placeholder:text-white/20 focus:border-[#c8ad84]/30 lg:max-w-md"
        />

        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-xl border border-white/[0.07] bg-[#11110f] p-1">
            {[
              ["all", "All"],
              ["discovery", "Discovery"],
              ["invoice", "Invoice only"],
            ].map(
              (
                [
                  value,
                  label,
                ],
              ) => (
                <button
                  key={
                    value
                  }
                  type="button"
                  onClick={() =>
                    setSource(
                      value as
                        | "all"
                        | "discovery"
                        | "invoice",
                    )
                  }
                  className={[
                    "rounded-lg px-3 py-2 text-[9px] font-medium transition",
                    source ===
                      value
                      ? "bg-[#f4f0e8] text-[#11110f]"
                      : "text-white/32 hover:text-white/55",
                  ].join(
                    " ",
                  )}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <div className="flex rounded-xl border border-white/[0.07] bg-[#11110f] p-1">
            {[
              [
                "active",
                "Active",
              ],
              [
                "archived",
                "Archived",
              ],
            ].map(
              (
                [
                  value,
                  label,
                ],
              ) => (
                <button
                  key={
                    value
                  }
                  type="button"
                  onClick={() =>
                    setStatus(
                      value as
                        | "active"
                        | "archived",
                    )
                  }
                  className={[
                    "rounded-lg px-3 py-2 text-[9px] font-medium transition",
                    status ===
                      value
                      ? "bg-[#c8ad84]/12 text-[#ead6b5]/70"
                      : "text-white/30 hover:text-white/50",
                  ].join(
                    " ",
                  )}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <Link
            href="/admin/invoices/new"
            className="rounded-xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.04] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#d8bf99]/60 transition hover:border-[#c8ad84]/30 hover:text-[#ead6b5]/80"
          >
            + Invoice Client
          </Link>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-[#c8ad84]/12 bg-[#c8ad84]/[0.025] px-4 py-3 text-xs leading-5 text-[#d8bf99]/60">
          {message}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {visible.length ===
          0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 px-6 py-16 text-center">
            <p className="text-sm text-white/38">
              No clients match these filters.
            </p>
          </div>
        ) : (
          visible.map(
            (
              record,
            ) => {
              const isDiscovery =
                record.discoveryCount >
                0;

              const latestInvoice =
                record.invoices[0];

              const opened =
                openId ===
                record.id;

              return (
                <article
                  key={
                    record.id
                  }
                  className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-black/10"
                >
                  <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_.65fr_.65fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-medium text-white/72">
                          {record.brand_name}
                        </h2>

                        <span
                          className={[
                            "rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.09em]",
                            isDiscovery
                              ? "border-[#c8ad84]/18 bg-[#c8ad84]/[0.04] text-[#d8bf99]/55"
                              : "border-sky-200/12 bg-sky-200/[0.025] text-sky-100/45",
                          ].join(
                            " ",
                          )}
                        >
                          {isDiscovery
                            ? "Brand Discovery"
                            : "Invoice only"}
                        </span>

                        {record.status ===
                          "archived" && (
                          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[8px] uppercase tracking-[0.09em] text-white/28">
                            Archived
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-white/32">
                        {record.contact_name ||
                          "No contact name"}
                        {record.email
                          ? ` Â· ${record.email}`
                          : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] uppercase tracking-[0.1em] text-white/22">
                        Activity
                      </p>

                      <p className="mt-2 text-xs text-white/48">
                        {record.discoveryCount} discovery Â· {record.invoices.length} invoices
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] uppercase tracking-[0.1em] text-white/22">
                        Latest invoice
                      </p>

                      <p className="mt-2 text-xs text-white/48">
                        {latestInvoice
                          ? `${latestInvoice.invoice_number} Â· ${money(latestInvoice.total_cents, latestInvoice.currency)}`
                          : "None yet"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {isDiscovery && (
                        <Link
                          href={`/admin/clients/${record.id}`}
                          className="rounded-xl border border-white/10 px-3 py-2.5 text-[9px] uppercase tracking-[0.08em] text-white/38 transition hover:text-white/60"
                        >
                          Intelligence
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          beginEdit(
                            record,
                          )
                        }
                        className="rounded-xl border border-[#c8ad84]/15 px-3 py-2.5 text-[9px] uppercase tracking-[0.08em] text-[#d8bf99]/55 transition hover:border-[#c8ad84]/30 hover:text-[#ead6b5]/75"
                      >
                        {opened
                          ? "Close"
                          : "Manage"}
                      </button>
                    </div>
                  </div>

                  {opened &&
                    draft && (
                    <div className="border-t border-white/[0.06] p-5">
                      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                        <div className="rounded-2xl border border-white/[0.07] bg-[#11110f]/45 p-5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/25">
                            Client record
                          </p>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Input
                              label="Company / brand"
                              value={
                                draft.brandName
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "brandName",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Contact name"
                              value={
                                draft.contactName
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "contactName",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Primary email"
                              value={
                                draft.email
                              }
                              type="email"
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "email",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Website"
                              value={
                                draft.website
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "website",
                                  value,
                                )
                              }
                            />
                          </div>

                          <div className="mt-4">
                            <TextArea
                              label="Internal notes"
                              value={
                                draft.notes
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "notes",
                                  value,
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/[0.07] bg-[#11110f]/45 p-5">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/25">
                            Reusable billing profile
                          </p>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Input
                              label="Billing name"
                              value={
                                draft.billingName
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "billingName",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Company"
                              value={
                                draft.companyName
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "companyName",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Billing email"
                              value={
                                draft.billingEmail
                              }
                              type="email"
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "billingEmail",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Phone"
                              value={
                                draft.phone
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "phone",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Address"
                              value={
                                draft.addressLine1
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "addressLine1",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Address line 2"
                              value={
                                draft.addressLine2
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "addressLine2",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="City"
                              value={
                                draft.city
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "city",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Province / State"
                              value={
                                draft.region
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "region",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Postal code"
                              value={
                                draft.postalCode
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "postalCode",
                                  value,
                                )
                              }
                            />

                            <Input
                              label="Country"
                              value={
                                draft.country
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "country",
                                  value,
                                )
                              }
                            />

                            <label>
                              <span className="text-[10px] text-white/32">
                                Currency
                              </span>

                              <select
                                value={
                                  draft.currency
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateDraft(
                                    "currency",
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none"
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

                            <Input
                              label="Payment terms (days)"
                              value={
                                draft.paymentTermsDays
                              }
                              type="number"
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "paymentTermsDays",
                                  value,
                                )
                              }
                            />
                          </div>

                          <div className="mt-4">
                            <TextArea
                              label="Billing notes"
                              value={
                                draft.billingNotes
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  "billingNotes",
                                  value,
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <p className="max-w-2xl text-[10px] leading-5 text-white/25">
                          These fields become defaults for future drafts. Existing issued invoice snapshots remain immutable.
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              busy !==
                              null
                            }
                            onClick={() =>
                              void changeStatus(
                                record,
                                record.status ===
                                  "active"
                                  ? "archived"
                                  : "active",
                              )
                            }
                            className="rounded-xl border border-rose-200/12 px-4 py-3 text-[9px] uppercase tracking-[0.09em] text-rose-100/42 transition hover:border-rose-200/25 hover:text-rose-100/65 disabled:opacity-35"
                          >
                            {record.status ===
                              "active"
                              ? "Archive Client"
                              : "Reactivate Client"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              busy !==
                                null ||
                              !draft.brandName.trim()
                            }
                            onClick={() =>
                              void saveClient(
                                record,
                              )
                            }
                            className="rounded-xl bg-[#f4f0e8] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white disabled:opacity-35"
                          >
                            {busy ===
                              `save:${record.id}`
                              ? "Saving..."
                              : "Save Client"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-white/[0.06] pt-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/25">
                              Invoice history
                            </p>

                            <p className="mt-1 text-xs text-white/28">
                              {record.invoices.length} invoices linked to this client.
                            </p>
                          </div>

                          <Link
                            href="/admin/invoices/new"
                            className="text-[9px] uppercase tracking-[0.08em] text-[#d8bf99]/50 hover:text-[#ead6b5]/70"
                          >
                            New invoice â†’
                          </Link>
                        </div>

                        {record.invoices.length ===
                          0 ? (
                          <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-7 text-center text-xs text-white/25">
                            No invoices yet.
                          </div>
                        ) : (
                          <div className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06]">
                            {record.invoices.map(
                              (
                                invoice,
                              ) => (
                                <Link
                                  key={
                                    invoice.id
                                  }
                                  href={`/admin/invoices/${invoice.id}`}
                                  className="grid gap-3 p-4 transition hover:bg-white/[0.025] sm:grid-cols-[1fr_.7fr_.7fr_auto] sm:items-center"
                                >
                                  <div>
                                    <p className="text-xs font-medium text-white/58">
                                      {invoice.invoice_number}
                                    </p>

                                    <p className="mt-1 text-[10px] text-white/24">
                                      {formatDate(
                                        invoice.invoice_date,
                                      )}
                                    </p>
                                  </div>

                                  <p className="text-xs text-white/40">
                                    {statusLabel(
                                      invoice.status,
                                    )}
                                  </p>

                                  <p className="text-xs text-white/48">
                                    {money(
                                      invoice.total_cents,
                                      invoice.currency,
                                    )}
                                  </p>

                                  <span className="text-[9px] text-[#d8bf99]/40">
                                    Open â†’
                                  </span>
                                </Link>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            },
          )
        )}
      </div>
    </section>
  );
}