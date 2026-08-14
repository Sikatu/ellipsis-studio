"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  INVOICE_CURRENCIES,
  type InvoiceCurrency,
} from "@/lib/invoice";

type StudioProfile = {
  display_name: string;
  business_name: string;
  default_currency: InvoiceCurrency;
  default_payment_terms_days: number;
  payment_instructions: string;
  default_notes: string;
};

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

type ClientRecord = {
  id: string;
  brand_name: string;
  contact_name: string | null;
  email: string | null;
  status: string;
  billingProfile:
    BillingProfile |
    null;
};

type WorkspaceResponse = {
  studioProfile:
    StudioProfile |
    null;
  clients:
    ClientRecord[];
};

type EditableInvoice = {
  id: string;
  client_id: string;
  invoice_number: string;
  status:
    | "draft"
    | "issued"
    | "paid"
    | "void";
  invoice_date: string;
  due_date: string;
  currency: InvoiceCurrency;
  client_snapshot: unknown;
  payment_instructions_snapshot: string;
  notes: string;
  total_cents: number;
};

type SavedItem = {
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

type DetailResponse = {
  invoice?: EditableInvoice;
  items?: SavedItem[];
  error?: string;
};

type ClientBillingDraft = {
  billingName: string;
  companyName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  notes: string;
};

type WorkItem = {
  id: string;
  description: string;
  mode:
    | "hourly"
    | "fixed";
  quantity: string;
  rate: string;
  notes: string;
};

function emptyBilling():
  ClientBillingDraft {
  return {
    billingName:
      "",
    companyName:
      "",
    email:
      "",
    phone:
      "",
    addressLine1:
      "",
    addressLine2:
      "",
    city:
      "",
    region:
      "",
    postalCode:
      "",
    country:
      "",
    notes:
      "",
  };
}

function emptyWorkItem():
  WorkItem {
  return {
    id:
      crypto.randomUUID(),
    description:
      "",
    mode:
      "hourly",
    quantity:
      "1",
    rate:
      "",
    notes:
      "",
  };
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
    ? value
    : "";
}

function addDays(
  date: string,
  days: number,
) {
  const parsed =
    new Date(
      `${date}T00:00:00`,
    );

  parsed.setDate(
    parsed.getDate() +
      days,
  );

  const offset =
    parsed.getTimezoneOffset();

  return new Date(
    parsed.getTime() -
      offset *
        60_000,
  )
    .toISOString()
    .slice(
      0,
      10,
    );
}

function daysBetween(
  start: string,
  end: string,
) {
  const startDate =
    new Date(
      `${start}T00:00:00Z`,
    );

  const endDate =
    new Date(
      `${end}T00:00:00Z`,
    );

  const value =
    Math.round(
      (
        endDate.getTime() -
        startDate.getTime()
      ) /
        86_400_000,
    );

  return Number.isFinite(
    value,
  )
    ? Math.min(
        365,
        Math.max(
          0,
          value,
        ),
      )
    : 0;
}

function centsFromInput(
  value: string,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed < 0
  ) {
    return 0;
  }

  return Math.round(
    parsed * 100,
  );
}

function rateInput(
  cents: number,
) {
  return (
    cents /
    100
  )
    .toFixed(
      2,
    )
    .replace(
      /\.00$/,
      "",
    )
    .replace(
      /(\.\d)0$/,
      "$1",
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

export default function InvoiceDraftEditor({
  invoiceId,
}: {
  invoiceId: string;
}) {
  const [
    workspace,
    setWorkspace,
  ] =
    useState<
      WorkspaceResponse |
      null
    >(
      null,
    );

  const [
    invoice,
    setInvoice,
  ] =
    useState<
      EditableInvoice |
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
    saving,
    setSaving,
  ] =
    useState(
      false,
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
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    selectedClientId,
    setSelectedClientId,
  ] =
    useState(
      "",
    );

  const [
    clientBilling,
    setClientBilling,
  ] =
    useState<
      ClientBillingDraft
    >(
      emptyBilling(),
    );

  const [
    currency,
    setCurrency,
  ] =
    useState<
      InvoiceCurrency
    >(
      "USD",
    );

  const [
    paymentTermsDays,
    setPaymentTermsDays,
  ] =
    useState(
      14,
    );

  const [
    invoiceDate,
    setInvoiceDate,
  ] =
    useState(
      "",
    );

  const [
    dueDate,
    setDueDate,
  ] =
    useState(
      "",
    );

  const [
    paymentInstructions,
    setPaymentInstructions,
  ] =
    useState(
      "",
    );

  const [
    notes,
    setNotes,
  ] =
    useState(
      "",
    );

  const [
    items,
    setItems,
  ] =
    useState<
      WorkItem[]
    >([
      emptyWorkItem(),
    ]);

  useEffect(
    () => {
      const controller =
        new AbortController();

      const timer =
        window.setTimeout(
          () => {
            void (
              async () => {
                try {
                  const [
                    workspaceResponse,
                    detailResponse,
                  ] =
                    await Promise.all([
                      fetch(
                        "/api/admin/invoices",
                        {
                          cache:
                            "no-store",
                          signal:
                            controller.signal,
                        },
                      ),
                      fetch(
                        `/api/admin/invoices/${invoiceId}`,
                        {
                          cache:
                            "no-store",
                          signal:
                            controller.signal,
                        },
                      ),
                    ]);

                  const workspacePayload =
                    await workspaceResponse
                      .json() as
                      WorkspaceResponse & {
                        error?: string;
                      };

                  const detailPayload =
                    await detailResponse
                      .json() as
                      DetailResponse;

                  if (
                    !workspaceResponse.ok
                  ) {
                    throw new Error(
                      workspacePayload.error ||
                        "Could not load invoice workspace.",
                    );
                  }

                  if (
                    !detailResponse.ok ||
                    !detailPayload.invoice
                  ) {
                    throw new Error(
                      detailPayload.error ||
                        "Could not load invoice draft.",
                    );
                  }

                  const nextInvoice =
                    detailPayload.invoice;

                  setWorkspace({
                    studioProfile:
                      workspacePayload.studioProfile ??
                      null,
                    clients:
                      workspacePayload.clients ??
                      [],
                  });

                  setInvoice(
                    nextInvoice,
                  );

                  setSelectedClientId(
                    nextInvoice.client_id,
                  );

                  const currentClient =
                    (
                      workspacePayload.clients ??
                      []
                    ).find(
                      (
                        client,
                      ) =>
                        client.id ===
                        nextInvoice.client_id,
                    );

                  setClientBilling({
                    billingName:
                      snapshotValue(
                        nextInvoice.client_snapshot,
                        "billingName",
                      ),
                    companyName:
                      snapshotValue(
                        nextInvoice.client_snapshot,
                        "companyName",
                      ),
                    email:
                      snapshotValue(
                        nextInvoice.client_snapshot,
                        "email",
                      ),
                    phone:
                      snapshotValue(
                        nextInvoice.client_snapshot,
                        "phone",
                      ),
                    addressLine1:
                      snapshotValue(
                        nextInvoice.client_snapshot,
                        "addressLine1",
                      ),
                    addressLine2:
                      snapshotValue(
                        nextInvoice.client_snapshot,
                        "addressLine2",
                      ),
                    city:
                      snapshotValue(
                        nextInvoice.client_snapshot,
                        "city",
                      ),
                    region:
                      snapshotValue(
                        nextInvoice.client_snapshot,
                        "region",
                      ),
                    postalCode:
                      snapshotValue(
                        nextInvoice.client_snapshot,
                        "postalCode",
                      ),
                    country:
                      snapshotValue(
                        nextInvoice.client_snapshot,
                        "country",
                      ),
                    notes:
                      currentClient
                        ?.billingProfile
                        ?.notes ??
                      "",
                  });

                  setCurrency(
                    nextInvoice.currency,
                  );

                  setInvoiceDate(
                    nextInvoice.invoice_date,
                  );

                  setDueDate(
                    nextInvoice.due_date,
                  );

                  setPaymentTermsDays(
                    daysBetween(
                      nextInvoice.invoice_date,
                      nextInvoice.due_date,
                    ),
                  );

                  setPaymentInstructions(
                    nextInvoice.payment_instructions_snapshot,
                  );

                  setNotes(
                    nextInvoice.notes,
                  );

                  const nextItems =
                    (
                      detailPayload.items ??
                      []
                    ).map(
                      (
                        item,
                      ) => ({
                        id:
                          crypto.randomUUID(),
                        description:
                          item.description,
                        mode:
                          item.unit_label ===
                          "hour"
                            ? "hourly" as const
                            : "fixed" as const,
                        quantity:
                          item.unit_label ===
                          "hour"
                            ? String(
                                item.quantity,
                              )
                            : "1",
                        rate:
                          rateInput(
                            item.unit_rate_cents,
                          ),
                        notes:
                          item.notes,
                      }),
                    );

                  setItems(
                    nextItems.length >
                      0
                      ? nextItems
                      : [
                          emptyWorkItem(),
                        ],
                  );

                  setError(
                    null,
                  );
                } catch (
                  loadError
                ) {
                  if (
                    loadError instanceof
                      DOMException &&
                    loadError.name ===
                      "AbortError"
                  ) {
                    return;
                  }

                  setError(
                    loadError instanceof
                      Error
                      ? loadError.message
                      : "Could not load invoice draft.",
                  );
                } finally {
                  setLoading(
                    false,
                  );
                }
              }
            )();
          },
          0,
        );

      return () => {
        window.clearTimeout(
          timer,
        );

        controller.abort();
      };
    },
    [
      invoiceId,
    ],
  );

  const selectedClient =
    useMemo(
      () =>
        workspace
          ?.clients
          .find(
            (
              client,
            ) =>
              client.id ===
              selectedClientId,
          ) ??
        null,
      [
        workspace,
        selectedClientId,
      ],
    );

  const subtotalCents =
    useMemo(
      () =>
        items.reduce(
          (
            total,
            item,
          ) => {
            const rate =
              centsFromInput(
                item.rate,
              );

            const quantity =
              item.mode ===
                "fixed"
                ? 1
                : Number(
                    item.quantity,
                  );

            if (
              !Number.isFinite(
                quantity,
              ) ||
              quantity <=
                0
            ) {
              return total;
            }

            return (
              total +
              Math.round(
                quantity *
                  rate,
              )
            );
          },
          0,
        ),
      [
        items,
      ],
    );

  function chooseClient(
    client: ClientRecord,
  ) {
    setSelectedClientId(
      client.id,
    );

    const profile =
      client.billingProfile;

    if (profile) {
      setClientBilling({
        billingName:
          profile.billing_name,
        companyName:
          profile.company_name,
        email:
          profile.email,
        phone:
          profile.phone,
        addressLine1:
          profile.address_line_1,
        addressLine2:
          profile.address_line_2,
        city:
          profile.city,
        region:
          profile.region,
        postalCode:
          profile.postal_code,
        country:
          profile.country,
        notes:
          profile.notes,
      });

      setCurrency(
        profile.currency,
      );

      setPaymentTermsDays(
        profile.payment_terms_days,
      );

      if (
        invoiceDate
      ) {
        setDueDate(
          addDays(
            invoiceDate,
            profile.payment_terms_days,
          ),
        );
      }
    } else {
      setClientBilling({
        ...emptyBilling(),
        billingName:
          client.contact_name ??
          client.brand_name,
        companyName:
          client.brand_name,
        email:
          client.email ??
          "",
      });
    }

    setMessage(
      null,
    );
  }

  function updateBilling(
    field:
      keyof ClientBillingDraft,
    value: string,
  ) {
    setClientBilling(
      (
        current,
      ) => ({
        ...current,
        [field]:
          value,
      }),
    );
  }

  function updateItem(
    id: string,
    patch:
      Partial<
        WorkItem
      >,
  ) {
    setItems(
      (
        current,
      ) =>
        current.map(
          (
            item,
          ) =>
            item.id ===
              id
              ? {
                  ...item,
                  ...patch,
                }
              : item,
        ),
    );
  }

  function removeItem(
    id: string,
  ) {
    setItems(
      (
        current,
      ) =>
        current.length ===
          1
          ? current
          : current.filter(
              (
                item,
              ) =>
                item.id !==
                id,
            ),
    );
  }

  function changeInvoiceDate(
    value: string,
  ) {
    setInvoiceDate(
      value,
    );

    if (value) {
      setDueDate(
        addDays(
          value,
          paymentTermsDays,
        ),
      );
    }
  }

  function changeTerms(
    value: string,
  ) {
    const parsed =
      Number(value);

    if (
      !Number.isInteger(
        parsed,
      ) ||
      parsed < 0 ||
      parsed > 365
    ) {
      return;
    }

    setPaymentTermsDays(
      parsed,
    );

    if (
      invoiceDate
    ) {
      setDueDate(
        addDays(
          invoiceDate,
          parsed,
        ),
      );
    }
  }

  async function saveChanges() {
    if (
      !invoice ||
      invoice.status !==
        "draft"
    ) {
      setMessage(
        "Only draft invoices can be edited.",
      );
      return;
    }

    if (!selectedClient) {
      setMessage(
        "Choose a client first.",
      );
      return;
    }

    const preparedItems =
      items.map(
        (
          item,
        ) => ({
          description:
            item.description,
          quantity:
            item.mode ===
              "fixed"
              ? 1
              : Number(
                  item.quantity,
                ),
          unitLabel:
            item.mode ===
              "fixed"
              ? "service"
              : "hour",
          unitRateCents:
            centsFromInput(
              item.rate,
            ),
          notes:
            item.notes,
        }),
      );

    if (
      preparedItems.some(
        (
          item,
        ) =>
          !item.description
            .trim(),
      )
    ) {
      setMessage(
        "Give each work item a short description.",
      );
      return;
    }

    if (
      preparedItems.some(
        (
          item,
        ) =>
          !Number.isFinite(
            item.quantity,
          ) ||
          item.quantity <=
            0,
      )
    ) {
      setMessage(
        "Check the quantity or hours for each work item.",
      );
      return;
    }

    setSaving(
      true,
    );
    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/admin/invoices/${invoice.id}`,
          {
            method:
              "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                clientId:
                  selectedClient.id,
                clientBilling,
                currency,
                paymentTermsDays,
                invoiceDate,
                dueDate,
                paymentInstructions,
                notes,
                lineItems:
                  preparedItems,
              }),
          },
        );

      const payload =
        await response
          .json() as
          DetailResponse & {
            billingWarning?: string;
          };

      if (
        !response.ok ||
        !payload.invoice
      ) {
        throw new Error(
          payload.error ||
            "Could not update invoice draft.",
        );
      }

      setInvoice(
        payload.invoice,
      );

      setMessage(
        payload.billingWarning
          ? `${payload.invoice.invoice_number} updated. ${payload.billingWarning}`
          : `${payload.invoice.invoice_number} updated safely.`,
      );
    } catch (
      saveError
    ) {
      setMessage(
        saveError instanceof
          Error
          ? saveError.message
          : "Could not update invoice draft.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  if (
    loading
  ) {
    return (
      <section className="mt-8 rounded-[28px] border border-white/[0.08] bg-[#161612] p-8 text-sm text-white/35">
        Opening invoice draft...
      </section>
    );
  }

  if (
    error ||
    !workspace ||
    !invoice
  ) {
    return (
      <section className="mt-8 max-w-2xl rounded-[28px] border border-rose-200/15 bg-rose-200/[0.035] p-8">
        <p className="text-sm leading-7 text-rose-100/60">
          {
            error ||
            "Invoice draft could not be loaded."
          }
        </p>

        <Link
          href="/admin/invoices"
          className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/45"
        >
          Back to invoices
        </Link>
      </section>
    );
  }

  if (
    invoice.status !==
      "draft"
  ) {
    return (
      <section className="mt-8 rounded-[28px] border border-[#c8ad84]/15 bg-[#161612] p-8">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#c8ad84]/55">
          Invoice locked
        </p>

        <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
          {
            invoice.invoice_number
          } can no longer be edited.
        </h2>

        <p className="mt-3 max-w-xl text-sm leading-7 text-white/38">
          Only draft invoices are editable. Issued, paid, and void invoices keep their accounting record locked.
        </p>

        <Link
          href={`/admin/invoices/${invoice.id}`}
          className="mt-6 inline-flex rounded-xl border border-[#c8ad84]/20 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#d8bf99]/65"
        >
          View invoice
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="rounded-[28px] border border-white/[0.08] bg-[#161612] p-6 sm:p-8">
        <div className="flex flex-col gap-5 border-b border-white/[0.07] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8ad84]/55">
              Edit Draft
            </p>

            <h2 className="mt-3 text-3xl font-medium tracking-[-0.045em]">
              {
                invoice.invoice_number
              }
            </h2>

            <p className="mt-3 max-w-2xl text-xs leading-6 text-white/38">
              Draft changes remain editable until you issue the invoice. Saving replaces the draft work items atomically and keeps the invoice number unchanged.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/invoices/${invoice.id}`}
              className="rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/42 transition hover:text-white/65"
            >
              Back to invoice
            </Link>

            <button
              type="button"
              disabled={
                saving
              }
              onClick={() =>
                void saveChanges()
              }
              className="rounded-xl bg-[#f4f0e8] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white disabled:opacity-40"
            >
              {
                saving
                  ? "Saving..."
                  : "Save Changes"
              }
            </button>
          </div>
        </div>

        <div className="mt-8">
          <SectionTitle
            number="01"
            title="Client"
            copy="Keep the current client or move this draft to another active client."
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspace.clients.map(
              (
                client,
              ) => {
                const selected =
                  client.id ===
                  selectedClientId;

                return (
                  <button
                    key={
                      client.id
                    }
                    type="button"
                    onClick={() =>
                      chooseClient(
                        client,
                      )
                    }
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-[#c8ad84]/30 bg-[#c8ad84]/[0.06]"
                        : "border-white/[0.08] bg-black/10 hover:border-white/15",
                    ].join(
                      " ",
                    )}
                  >
                    <p className="text-sm font-medium text-white/65">
                      {
                        client.brand_name
                      }
                    </p>

                    <p className="mt-2 text-xs text-white/30">
                      {
                        client.contact_name ||
                        client.email ||
                        "Client"
                      }
                    </p>

                    <p className="mt-4 text-[9px] uppercase tracking-[0.1em] text-[#c8ad84]/50">
                      {
                        selected
                          ? "Selected"
                          : "Choose"
                      }
                    </p>
                  </button>
                );
              },
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/10 p-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
              Billing details
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input label="Person / billing name" value={clientBilling.billingName} onChange={(value) => updateBilling("billingName", value)} />
              <Input label="Company" value={clientBilling.companyName} onChange={(value) => updateBilling("companyName", value)} />
              <Input label="Email" value={clientBilling.email} type="email" onChange={(value) => updateBilling("email", value)} />
              <Input label="Phone" value={clientBilling.phone} onChange={(value) => updateBilling("phone", value)} />
              <Input label="Address" value={clientBilling.addressLine1} onChange={(value) => updateBilling("addressLine1", value)} />
              <Input label="Address line 2" value={clientBilling.addressLine2} onChange={(value) => updateBilling("addressLine2", value)} />
              <Input label="City" value={clientBilling.city} onChange={(value) => updateBilling("city", value)} />
              <Input label="Province / State" value={clientBilling.region} onChange={(value) => updateBilling("region", value)} />
              <Input label="Postal code" value={clientBilling.postalCode} onChange={(value) => updateBilling("postalCode", value)} />
              <Input label="Country" value={clientBilling.country} onChange={(value) => updateBilling("country", value)} />
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/[0.07] pt-8">
          <SectionTitle number="02" title="Work" copy="Edit hours, fixed services, rates, descriptions, and optional line notes." />

          <div className="mt-4 grid gap-4">
            {items.map((item, index) => (
              <div key={item.id} className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
                    Work item {index + 1}
                  </p>
                  <button type="button" disabled={items.length === 1} onClick={() => removeItem(item.id)} className="text-[9px] uppercase tracking-[0.08em] text-white/28 transition hover:text-red-100/60 disabled:opacity-20">
                    Remove
                  </button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_150px_130px_150px]">
                  <Input label="What did you do?" value={item.description} onChange={(value) => updateItem(item.id, { description: value })} />

                  <label>
                    <span className="text-[10px] text-white/36">Type</span>
                    <select
                      value={item.mode}
                      onChange={(event) =>
                        updateItem(item.id, {
                          mode: event.target.value as "hourly" | "fixed",
                          quantity: event.target.value === "fixed" ? "1" : item.quantity,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none focus:border-[#c8ad84]/30"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </label>

                  <Input
                    label={item.mode === "fixed" ? "Quantity" : "Hours"}
                    value={item.mode === "fixed" ? "1" : item.quantity}
                    type="number"
                    disabled={item.mode === "fixed"}
                    onChange={(value) => updateItem(item.id, { quantity: value })}
                  />

                  <Input
                    label={item.mode === "fixed" ? "Price" : "Rate / hour"}
                    value={item.rate}
                    type="number"
                    onChange={(value) => updateItem(item.id, { rate: value })}
                  />
                </div>

                <div className="mt-4">
                  <TextArea label="Line note (optional)" value={item.notes} rows={2} onChange={(value) => updateItem(item.id, { notes: value })} />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setItems((current) => [...current, emptyWorkItem()])}
            className="mt-4 rounded-xl border border-white/10 px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/38 transition hover:border-[#c8ad84]/20 hover:text-[#d8bf99]/65"
          >
            + Add another service
          </button>
        </div>

        <div className="mt-8 border-t border-white/[0.07] pt-8">
          <SectionTitle number="03" title="Dates, Currency & Payment" copy="The invoice number stays fixed while the draft details remain editable." />

          <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Invoice date" value={invoiceDate} type="date" onChange={changeInvoiceDate} />
                <Input label="Due date" value={dueDate} type="date" onChange={setDueDate} />

                <label>
                  <span className="text-[10px] text-white/36">Currency</span>
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value as InvoiceCurrency)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none focus:border-[#c8ad84]/30"
                  >
                    {INVOICE_CURRENCIES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <Input label="Payment terms (days)" value={String(paymentTermsDays)} type="number" onChange={changeTerms} />
              </div>

              <div className="mt-4 grid gap-4">
                <TextArea label="Payment instructions" value={paymentInstructions} onChange={setPaymentInstructions} />
                <TextArea label="Invoice note" value={notes} onChange={setNotes} />
              </div>
            </div>

            <div className="rounded-2xl border border-[#c8ad84]/15 bg-[#f4f0e8] p-6 text-[#11110f]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8b6f49]">Draft Preview</p>

              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-medium tracking-[-0.03em]">{invoice.invoice_number}</p>
                  <p className="mt-1 text-xs text-black/45">{selectedClient?.brand_name || "Client"}</p>
                </div>
                <span className="rounded-full border border-black/10 px-3 py-1 text-[8px] uppercase tracking-[0.1em] text-black/40">Draft</span>
              </div>

              <div className="mt-6 space-y-3 border-t border-black/[0.08] pt-5">
                {items.map((item) => {
                  const quantity = item.mode === "fixed" ? 1 : Number(item.quantity);
                  const amount =
                    Number.isFinite(quantity) && quantity > 0
                      ? Math.round(quantity * centsFromInput(item.rate))
                      : 0;

                  return (
                    <div key={item.id} className="flex items-start justify-between gap-4 border-b border-black/[0.06] pb-3">
                      <div>
                        <p className="text-xs font-medium">{item.description || "Work item"}</p>
                        <p className="mt-1 text-[10px] text-black/40">
                          {item.mode === "fixed" ? "Fixed service" : `${item.quantity || "0"} hours`}
                        </p>
                      </div>
                      <p className="text-xs font-medium">{money(amount, currency)}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-black/[0.1] pt-4">
                <span className="text-xs text-black/45">Total</span>
                <span className="text-xl font-medium tracking-[-0.03em]">{money(subtotalCents, currency)}</span>
              </div>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.03] px-4 py-3 text-xs leading-6 text-[#d8bf99]/70">
              {message}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving || !selectedClient}
              onClick={() => void saveChanges()}
              className="rounded-xl bg-[#f4f0e8] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white disabled:opacity-35"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <Link
              href={`/admin/invoices/${invoice.id}`}
              className="rounded-xl border border-white/10 px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/42 transition hover:text-white/65"
            >
              Review Invoice
            </Link>

            <span className="text-xs text-white/28">Save before issuing.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({
  number,
  title,
  copy,
}: {
  number: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 text-[9px] font-semibold tracking-[0.12em] text-[#c8ad84]/50">{number}</span>
      <div>
        <h3 className="text-base font-medium text-white/68">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-white/32">{copy}</p>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      <span className="text-[10px] text-white/36">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        min={type === "number" ? "0" : undefined}
        max={label === "Payment terms (days)" ? "365" : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/65 outline-none focus:border-[#c8ad84]/30 disabled:opacity-35"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label>
      <span className="text-[10px] text-white/36">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm leading-6 text-white/65 outline-none focus:border-[#c8ad84]/30"
      />
    </label>
  );
}
