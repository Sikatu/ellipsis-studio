"use client";

import {
  useCallback,
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

type InvoiceSummary = {
  id: string;
  client_id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string;
  currency: InvoiceCurrency;
  subtotal_cents: number;
  total_cents: number;
  issued_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  final_pdf_created_at: string | null;
  created_at: string;
};

type WorkspaceResponse = {
  studioProfile:
    StudioProfile |
    null;
  clients:
    ClientRecord[];
  invoices:
    InvoiceSummary[];
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

function localDateString() {
  const now =
    new Date();

  const offset =
    now.getTimezoneOffset();

  return new Date(
    now.getTime() -
      offset * 60000,
  )
    .toISOString()
    .slice(
      0,
      10,
    );
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
      offset * 60000,
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
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

function centsFromInput(
  value: string,
) {
  const parsed =
    Number(
      value,
    );

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

export default function InvoiceBuilder() {
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
    message,
    setMessage,
  ] =
    useState("");

  const [
    selectedClientId,
    setSelectedClientId,
  ] =
    useState("");

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
    useState(14);

  const [
    invoiceDate,
    setInvoiceDate,
  ] =
    useState(
      localDateString(),
    );

  const [
    dueDate,
    setDueDate,
  ] =
    useState(
      addDays(
        localDateString(),
        14,
      ),
    );

  const [
    paymentInstructions,
    setPaymentInstructions,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    items,
    setItems,
  ] =
    useState<
      WorkItem[]
    >([
      emptyWorkItem(),
    ]);

  const [
    createdInvoice,
    setCreatedInvoice,
  ] =
    useState<
      InvoiceSummary |
      null
    >(
      null,
    );

  const [
    busyInvoiceAction,
    setBusyInvoiceAction,
  ] =
    useState<string | null>(
      null,
    );

  const refresh =
    useCallback(
      async () => {
        const response =
          await fetch(
            "/api/admin/invoices",
            {
              cache:
                "no-store",
            },
          );

        const payload =
          await response
            .json();

        if (!response.ok) {
          throw new Error(
            payload.error ??
              "Could not load invoice workspace.",
          );
        }

        const next =
          payload as
            WorkspaceResponse;

        setWorkspace(
          next,
        );

        if (
          next.studioProfile
        ) {
          setCurrency(
            next
              .studioProfile
              .default_currency,
          );

          setPaymentTermsDays(
            next
              .studioProfile
              .default_payment_terms_days,
          );

          setDueDate(
            addDays(
              invoiceDate,
              next
                .studioProfile
                .default_payment_terms_days,
            ),
          );

          setPaymentInstructions(
            next
              .studioProfile
              .payment_instructions,
          );

          setNotes(
            next
              .studioProfile
              .default_notes,
          );
        }
      },
      [
        invoiceDate,
      ],
    );

  useEffect(() => {
    const controller =
      new AbortController();

    void fetch(
      "/api/admin/invoices",
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
                "Could not load invoice workspace.",
            );
          }

          const next =
            payload as
              WorkspaceResponse;

          setWorkspace(
            next,
          );

          if (
            next.studioProfile
          ) {
            setCurrency(
              next
                .studioProfile
                .default_currency,
            );

            setPaymentTermsDays(
              next
                .studioProfile
                .default_payment_terms_days,
            );

            setDueDate(
              addDays(
                invoiceDate,
                next
                  .studioProfile
                  .default_payment_terms_days,
              ),
            );

            setPaymentInstructions(
              next
                .studioProfile
                .payment_instructions,
            );

            setNotes(
              next
                .studioProfile
                .default_notes,
            );
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
              : "Could not load invoice workspace.",
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
  }, [invoiceDate]);

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
              quantity <= 0
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
    client:
      ClientRecord,
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

      setDueDate(
        addDays(
          invoiceDate,
          profile.payment_terms_days,
        ),
      );
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

      const defaults =
        workspace
          ?.studioProfile;

      if (defaults) {
        setCurrency(
          defaults.default_currency,
        );

        setPaymentTermsDays(
          defaults.default_payment_terms_days,
        );

        setDueDate(
          addDays(
            invoiceDate,
            defaults.default_payment_terms_days,
          ),
        );
      }
    }

    setCreatedInvoice(
      null,
    );
    setMessage("");
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
    days: number,
  ) {
    setPaymentTermsDays(
      days,
    );

    if (invoiceDate) {
      setDueDate(
        addDays(
          invoiceDate,
          days,
        ),
      );
    }
  }

  async function saveDraft() {
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
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/invoices",
          {
            method:
              "POST",
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
          .json();

      if (!response.ok) {
        throw new Error(
          payload.error ??
            "Could not save invoice draft.",
        );
      }

      setCreatedInvoice(
        payload.invoice as
          InvoiceSummary,
      );

      setMessage(
        `Draft ${payload.invoice.invoice_number} saved.`,
      );

      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save invoice draft.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  async function issueInvoice(
    invoice: InvoiceSummary,
  ) {
    if (
      invoice.status !==
        "draft"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Issue ${invoice.invoice_number}? Once issued, its billing details, work items, totals, and final PDF are locked.`,
      );

    if (!confirmed) {
      return;
    }

    const actionKey =
      `issue:${invoice.id}`;

    setBusyInvoiceAction(
      actionKey,
    );
    setMessage("");

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
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ??
            "Could not issue invoice.",
        );
      }

      const nextInvoice =
        payload.invoice as
          InvoiceSummary;

      if (
        createdInvoice?.id ===
        invoice.id
      ) {
        setCreatedInvoice(
          nextInvoice,
        );
      }

      setMessage(
        `${invoice.invoice_number} issued. The final PDF is now locked.`,
      );

      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not issue invoice.",
      );
    } finally {
      setBusyInvoiceAction(
        null,
      );
    }
  }

  async function markInvoicePaid(
    invoice: InvoiceSummary,
  ) {
    if (
      invoice.status !==
        "issued"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Mark ${invoice.invoice_number} as paid?`,
      );

    if (!confirmed) {
      return;
    }

    const actionKey =
      `paid:${invoice.id}`;

    setBusyInvoiceAction(
      actionKey,
    );
    setMessage("");

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
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ??
            "Could not mark invoice paid.",
        );
      }

      const nextInvoice =
        payload.invoice as
          InvoiceSummary;

      if (
        createdInvoice?.id ===
        invoice.id
      ) {
        setCreatedInvoice(
          nextInvoice,
        );
      }

      setMessage(
        `${invoice.invoice_number} marked as paid.`,
      );

      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not mark invoice paid.",
      );
    } finally {
      setBusyInvoiceAction(
        null,
      );
    }
  }

  function startAnother() {
    const defaults =
      workspace
        ?.studioProfile;

    const today =
      localDateString();

    setSelectedClientId(
      "",
    );

    setClientBilling(
      emptyBilling(),
    );

    setItems([
      emptyWorkItem(),
    ]);

    setInvoiceDate(
      today,
    );

    const terms =
      defaults
        ?.default_payment_terms_days ??
      14;

    setPaymentTermsDays(
      terms,
    );

    setDueDate(
      addDays(
        today,
        terms,
      ),
    );

    setCurrency(
      defaults
        ?.default_currency ??
      "USD",
    );

    setPaymentInstructions(
      defaults
        ?.payment_instructions ??
      "",
    );

    setNotes(
      defaults
        ?.default_notes ??
      "",
    );

    setCreatedInvoice(
      null,
    );

    setMessage("");
  }

  if (loading) {
    return (
      <section className="mt-8 rounded-[28px] border border-white/[0.08] bg-[#161612] p-8 text-sm text-white/30">
        Opening your invoice workspace...
      </section>
    );
  }

  if (
    !workspace
      ?.studioProfile
  ) {
    return (
      <section className="mt-8 rounded-[28px] border border-amber-300/15 bg-amber-300/[0.03] p-7">
        <p className="text-sm font-medium text-amber-100/60">
          Complete your invoice details first.
        </p>

        <p className="mt-2 text-xs leading-6 text-amber-100/30">
          Save the one-time setup above, then this invoice builder will be ready.
        </p>
      </section>
    );
  }

  return (
    <section
      id="invoice-builder"
      className="mt-8"
    >
      <div className="rounded-[28px] border border-white/[0.08] bg-[#161612] p-6 sm:p-8">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8ad84]/55">
              New Invoice
            </p>

            <h2 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-white/75">
              Three simple steps.
            </h2>

            <p className="mt-3 text-xs leading-6 text-white/30">
              Choose the client, add the work, then review and save the draft.
            </p>
          </div>

          <button
            type="button"
            onClick={
              startAnother
            }
            className="w-fit rounded-xl border border-white/10 px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/30 transition hover:text-white/50"
          >
            Start fresh
          </button>
        </div>

        <div className="mt-7">
          <StepTitle
            number="01"
            title="Choose Client"
            copy="Pick who this invoice is for."
          />

          {workspace.clients.length ===
            0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/25">
              No active clients yet. Brand Discovery clients will appear here automatically.
            </div>
          ) : (
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
                      ].join(" ")}
                    >
                      <p className="text-sm font-medium text-white/65">
                        {client.brand_name}
                      </p>

                      <p className="mt-2 text-xs text-white/25">
                        {client.contact_name ||
                          client.email ||
                          "Client"}
                      </p>

                      <p className="mt-4 text-[9px] uppercase tracking-[0.1em] text-[#c8ad84]/40">
                        {selected
                          ? "Selected"
                          : "Choose"}
                      </p>
                    </button>
                  );
                },
              )}
            </div>
          )}

          {selectedClient && (
            <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/10 p-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/20">
                Billing details
              </p>

              <p className="mt-2 text-xs leading-5 text-white/25">
                ELLIPSIS will remember these details for this client next time.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input
                  label="Person / billing name"
                  value={
                    clientBilling.billingName
                  }
                  onChange={(
                    value,
                  ) =>
                    updateBilling(
                      "billingName",
                      value,
                    )
                  }
                />

                <Input
                  label="Company"
                  value={
                    clientBilling.companyName
                  }
                  onChange={(
                    value,
                  ) =>
                    updateBilling(
                      "companyName",
                      value,
                    )
                  }
                />

                <Input
                  label="Email"
                  value={
                    clientBilling.email
                  }
                  type="email"
                  onChange={(
                    value,
                  ) =>
                    updateBilling(
                      "email",
                      value,
                    )
                  }
                />

                <Input
                  label="Phone"
                  value={
                    clientBilling.phone
                  }
                  onChange={(
                    value,
                  ) =>
                    updateBilling(
                      "phone",
                      value,
                    )
                  }
                />

                <Input
                  label="Address"
                  value={
                    clientBilling.addressLine1
                  }
                  onChange={(
                    value,
                  ) =>
                    updateBilling(
                      "addressLine1",
                      value,
                    )
                  }
                />

                <Input
                  label="Address line 2"
                  value={
                    clientBilling.addressLine2
                  }
                  onChange={(
                    value,
                  ) =>
                    updateBilling(
                      "addressLine2",
                      value,
                    )
                  }
                />

                <Input
                  label="City"
                  value={
                    clientBilling.city
                  }
                  onChange={(
                    value,
                  ) =>
                    updateBilling(
                      "city",
                      value,
                    )
                  }
                />

                <Input
                  label="Province / State"
                  value={
                    clientBilling.region
                  }
                  onChange={(
                    value,
                  ) =>
                    updateBilling(
                      "region",
                      value,
                    )
                  }
                />

                <Input
                  label="Postal code"
                  value={
                    clientBilling.postalCode
                  }
                  onChange={(
                    value,
                  ) =>
                    updateBilling(
                      "postalCode",
                      value,
                    )
                  }
                />

                <Input
                  label="Country"
                  value={
                    clientBilling.country
                  }
                  onChange={(
                    value,
                  ) =>
                    updateBilling(
                      "country",
                      value,
                    )
                  }
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-white/[0.07] pt-7">
          <StepTitle
            number="02"
            title="Add Work"
            copy="Use hours or a fixed service. Mix both if you need to."
          />

          <div className="mt-4 grid gap-4">
            {items.map(
              (
                item,
                index,
              ) => (
                <div
                  key={
                    item.id
                  }
                  className="rounded-2xl border border-white/[0.07] bg-black/10 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/20">
                      Work item {index + 1}
                    </p>

                    <button
                      type="button"
                      disabled={
                        items.length ===
                        1
                      }
                      onClick={() =>
                        removeItem(
                          item.id,
                        )
                      }
                      className="text-[9px] uppercase tracking-[0.08em] text-white/18 transition hover:text-red-100/45 disabled:opacity-20"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_150px_130px_150px]">
                    <Input
                      label="What did you do?"
                      value={
                        item.description
                      }
                      placeholder="Administrative support"
                      onChange={(
                        value,
                      ) =>
                        updateItem(
                          item.id,
                          {
                            description:
                              value,
                          },
                        )
                      }
                    />

                    <label>
                      <span className="text-[10px] text-white/30">
                        Type
                      </span>

                      <select
                        value={
                          item.mode
                        }
                        onChange={(
                          event,
                        ) =>
                          updateItem(
                            item.id,
                            {
                              mode:
                                event
                                  .target
                                  .value as
                                  | "hourly"
                                  | "fixed",
                              quantity:
                                event
                                  .target
                                  .value ===
                                "fixed"
                                  ? "1"
                                  : item.quantity,
                            },
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/60 outline-none"
                      >
                        <option value="hourly">
                          Hourly
                        </option>
                        <option value="fixed">
                          Fixed
                        </option>
                      </select>
                    </label>

                    <Input
                      label={
                        item.mode ===
                          "fixed"
                          ? "Quantity"
                          : "Hours"
                      }
                      value={
                        item.mode ===
                          "fixed"
                          ? "1"
                          : item.quantity
                      }
                      type="number"
                      disabled={
                        item.mode ===
                        "fixed"
                      }
                      onChange={(
                        value,
                      ) =>
                        updateItem(
                          item.id,
                          {
                            quantity:
                              value,
                          },
                        )
                      }
                    />

                    <Input
                      label={
                        item.mode ===
                          "fixed"
                          ? "Price"
                          : "Rate / hour"
                      }
                      value={
                        item.rate
                      }
                      type="number"
                      placeholder="0.00"
                      onChange={(
                        value,
                      ) =>
                        updateItem(
                          item.id,
                          {
                            rate:
                              value,
                          },
                        )
                      }
                    />
                  </div>
                </div>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setItems(
                (
                  current,
                ) => [
                  ...current,
                  emptyWorkItem(),
                ],
              )
            }
            className="mt-4 rounded-xl border border-white/10 px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/30 transition hover:border-[#c8ad84]/20 hover:text-[#d8bf99]/55"
          >
            + Add another service
          </button>
        </div>

        <div className="mt-8 border-t border-white/[0.07] pt-7">
          <StepTitle
            number="03"
            title="Review"
            copy="Check the dates and total before saving the draft."
          />

          <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Invoice date"
                  value={
                    invoiceDate
                  }
                  type="date"
                  onChange={
                    changeInvoiceDate
                  }
                />

                <Input
                  label="Due date"
                  value={
                    dueDate
                  }
                  type="date"
                  onChange={
                    setDueDate
                  }
                />

                <label>
                  <span className="text-[10px] text-white/30">
                    Currency
                  </span>

                  <select
                    value={
                      currency
                    }
                    onChange={(
                      event,
                    ) =>
                      setCurrency(
                        event
                          .target
                          .value as
                          InvoiceCurrency,
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/60 outline-none"
                  >
                    {INVOICE_CURRENCIES.map(
                      (
                        item,
                      ) => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
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
                      paymentTermsDays
                    }
                    onChange={(
                      event,
                    ) =>
                      changeTerms(
                        Number(
                          event
                            .target
                            .value,
                        ),
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/60 outline-none"
                  >
                    {[0, 7, 14, 30, 45, 60].map(
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
              </div>

              <div className="mt-4 grid gap-4">
                <TextArea
                  label="Payment instructions"
                  value={
                    paymentInstructions
                  }
                  onChange={
                    setPaymentInstructions
                  }
                />

                <TextArea
                  label="Note"
                  value={
                    notes
                  }
                  onChange={
                    setNotes
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#c8ad84]/15 bg-[#f4f0e8] p-6 text-[#11110f]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8b6f49]">
                    Invoice Preview
                  </p>

                  <p className="mt-3 text-xl font-medium tracking-[-0.03em]">
                    {createdInvoice
                      ?.invoice_number ??
                      "Number assigned when saved"}
                  </p>
                </div>

                <span className="rounded-full border border-black/10 px-3 py-1 text-[8px] uppercase tracking-[0.1em] text-black/35">
                  Draft
                </span>
              </div>

              <div className="mt-6 border-t border-black/[0.08] pt-5">
                <p className="text-[9px] uppercase tracking-[0.12em] text-black/30">
                  Bill to
                </p>

                <p className="mt-2 text-sm font-medium">
                  {clientBilling.billingName ||
                    selectedClient
                      ?.contact_name ||
                    "Choose a client"}
                </p>

                <p className="mt-1 text-xs text-black/40">
                  {clientBilling.companyName ||
                    selectedClient
                      ?.brand_name ||
                    ""}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {items.map(
                  (
                    item,
                  ) => {
                    const quantity =
                      item.mode ===
                        "fixed"
                        ? 1
                        : Number(
                            item.quantity,
                          );

                    const rate =
                      centsFromInput(
                        item.rate,
                      );

                    const amount =
                      Number.isFinite(
                        quantity,
                      ) &&
                      quantity > 0
                        ? Math.round(
                            quantity *
                              rate,
                          )
                        : 0;

                    return (
                      <div
                        key={
                          item.id
                        }
                        className="flex items-start justify-between gap-5 border-b border-black/[0.06] pb-3"
                      >
                        <div>
                          <p className="text-xs font-medium">
                            {item.description ||
                              "Work item"}
                          </p>

                          <p className="mt-1 text-[10px] text-black/35">
                            {item.mode ===
                              "fixed"
                              ? "Fixed service"
                              : `${item.quantity || "0"} hours × ${money(rate, currency)}`}
                          </p>
                        </div>

                        <p className="text-xs font-medium">
                          {money(
                            amount,
                            currency,
                          )}
                        </p>
                      </div>
                    );
                  },
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-black/[0.1] pt-4">
                <span className="text-xs text-black/45">
                  Total
                </span>

                <span className="text-xl font-medium tracking-[-0.03em]">
                  {money(
                    subtotalCents,
                    currency,
                  )}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-black/[0.08] pt-4 text-[10px] text-black/40">
                <div>
                  <p>Invoice date</p>
                  <p className="mt-1 font-medium text-black/65">
                    {invoiceDate}
                  </p>
                </div>

                <div>
                  <p>Due date</p>
                  <p className="mt-1 font-medium text-black/65">
                    {dueDate}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-xl border border-[#c8ad84]/15 bg-[#c8ad84]/[0.03] px-4 py-3 text-xs leading-6 text-[#d8bf99]/60">
              {message}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={
                saving ||
                !selectedClient
              }
              onClick={
                saveDraft
              }
              className="rounded-xl bg-[#f4f0e8] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#11110f] transition hover:bg-white disabled:opacity-35"
            >
              {saving
                ? "Saving..."
                : "Save draft invoice"}
            </button>

            {createdInvoice && (
              <>
                <span className="text-xs text-emerald-100/45">
                  {createdInvoice.invoice_number} is safely saved.
                </span>

                <InvoiceLifecycleActions
                  invoice={createdInvoice}
                  onIssue={issueInvoice}
                  onMarkPaid={markInvoicePaid}
                  busyInvoiceAction={busyInvoiceAction}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <InvoiceHistory
        invoices={
          workspace.invoices
        }
        clients={
          workspace.clients
        }
        onIssue={issueInvoice}
        onMarkPaid={markInvoicePaid}
        busyInvoiceAction={busyInvoiceAction}
      />
    </section>
  );
}

function InvoiceHistory({
  invoices,
  clients,
  onIssue,
  onMarkPaid,
  busyInvoiceAction,
}: {
  invoices:
    InvoiceSummary[];
  clients:
    ClientRecord[];
  onIssue: (
    invoice: InvoiceSummary,
  ) => Promise<void>;
  onMarkPaid: (
    invoice: InvoiceSummary,
  ) => Promise<void>;
  busyInvoiceAction:
    string | null;
}) {
  const clientMap =
    useMemo(
      () =>
        new Map(
          clients.map(
            (
              client,
            ) => [
              client.id,
              client.brand_name,
            ],
          ),
        ),
      [
        clients,
      ],
    );

  return (
    <section className="mt-8 rounded-[28px] border border-white/[0.08] bg-[#161612] p-6 sm:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8ad84]/55">
            Recent Invoices
          </p>

          <h2 className="mt-3 text-xl font-medium tracking-[-0.03em] text-white/65">
            Your saved drafts and invoices.
          </h2>
        </div>

        <span className="rounded-full border border-white/10 px-3 py-1 text-[9px] uppercase tracking-[0.1em] text-white/25">
          {invoices.length}
        </span>
      </div>

      {invoices.length ===
        0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-white/22">
          Your first saved invoice will appear here.
        </div>
      ) : (
        <div className="mt-5 divide-y divide-white/[0.06]">
          {invoices.map(
            (
              invoice,
            ) => (
              <div
                key={
                  invoice.id
                }
                className="grid gap-3 py-4 sm:grid-cols-[1.1fr_0.8fr_auto_auto_minmax(180px,auto)] sm:items-center"
              >
                <div>
                  <p className="text-xs font-medium text-white/60">
                    {invoice.invoice_number}
                  </p>

                  <p className="mt-1 text-[10px] text-white/22">
                    {clientMap.get(
                      invoice.client_id,
                    ) ??
                      "Client"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-white/22">
                    Due {invoice.due_date}
                  </p>
                </div>

                <span className="w-fit rounded-full border border-white/10 px-2.5 py-1 text-[8px] uppercase tracking-[0.1em] text-white/25">
                  {displayInvoiceStatus(
                    invoice,
                  )}
                </span>

                <p className="text-xs font-medium text-white/55">
                  {money(
                    invoice.total_cents,
                    invoice.currency,
                  )}
                </p>

                <InvoiceLifecycleActions
                  invoice={invoice}
                  onIssue={onIssue}
                  onMarkPaid={onMarkPaid}
                  busyInvoiceAction={busyInvoiceAction}
                  compact
                />
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function displayInvoiceStatus(
  invoice: InvoiceSummary,
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

function InvoiceLifecycleActions({
  invoice,
  onIssue,
  onMarkPaid,
  busyInvoiceAction,
  compact = false,
}: {
  invoice: InvoiceSummary;
  onIssue: (
    invoice: InvoiceSummary,
  ) => Promise<void>;
  onMarkPaid: (
    invoice: InvoiceSummary,
  ) => Promise<void>;
  busyInvoiceAction:
    string | null;
  compact?: boolean;
}) {
  const issueBusy =
    busyInvoiceAction ===
    `issue:${invoice.id}`;

  const paidBusy =
    busyInvoiceAction ===
    `paid:${invoice.id}`;

  const anyBusy =
    busyInvoiceAction !==
    null;

  const hasFinalPdf =
    Boolean(
      invoice.final_pdf_created_at,
    );

  const canDownload =
    invoice.status ===
      "draft" ||
    hasFinalPdf;

  const baseClass =
    compact
      ? "rounded-lg border px-3 py-2 text-[8px] font-semibold uppercase tracking-[0.09em] transition"
      : "rounded-xl border px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.1em] transition";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canDownload && (
        <a
          href={`/api/admin/invoices/${invoice.id}/pdf`}
          className={`${baseClass} border-white/10 text-white/30 hover:border-[#c8ad84]/25 hover:text-[#d8bf99]/55`}
        >
          {invoice.status ===
            "draft"
            ? "Draft PDF"
            : "Download PDF"}
        </a>
      )}

      {invoice.status ===
        "draft" && (
        <button
          type="button"
          disabled={anyBusy}
          onClick={() =>
            void onIssue(
              invoice,
            )
          }
          className={`${baseClass} border-[#c8ad84]/25 bg-[#c8ad84]/[0.05] text-[#dfc49b]/65 hover:border-[#c8ad84]/40 hover:text-[#f0d9b6] disabled:opacity-35`}
        >
          {issueBusy
            ? "Issuing..."
            : "Issue Invoice"}
        </button>
      )}

      {invoice.status ===
        "issued" && (
        <button
          type="button"
          disabled={anyBusy}
          onClick={() =>
            void onMarkPaid(
              invoice,
            )
          }
          className={`${baseClass} border-emerald-200/15 bg-emerald-200/[0.03] text-emerald-100/45 hover:border-emerald-200/25 hover:text-emerald-100/65 disabled:opacity-35`}
        >
          {paidBusy
            ? "Saving..."
            : "Mark Paid"}
        </button>
      )}

      {invoice.status ===
        "paid" && (
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-100/45">
          Paid
        </span>
      )}
    </div>
  );
}

function StepTitle({
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
      <span className="mt-0.5 text-[9px] font-semibold tracking-[0.12em] text-[#c8ad84]/45">
        {number}
      </span>

      <div>
        <h3 className="text-base font-medium text-white/65">
          {title}
        </h3>

        <p className="mt-1 text-xs leading-5 text-white/25">
          {copy}
        </p>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      <span className="text-[10px] text-white/30">
        {label}
      </span>

      <input
        type={type}
        value={value}
        disabled={
          disabled
        }
        placeholder={
          placeholder
        }
        min={
          type ===
            "number"
            ? "0"
            : undefined
        }
        step={
          type ===
            "number"
            ? "0.01"
            : undefined
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
        className="mt-2 w-full rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm text-white/60 outline-none placeholder:text-white/12 focus:border-[#c8ad84]/30 disabled:opacity-35"
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
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <label>
      <span className="text-[10px] text-white/30">
        {label}
      </span>

      <textarea
        rows={4}
        value={value}
        onChange={(
          event,
        ) =>
          onChange(
            event
              .target
              .value,
          )
        }
        className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#11110f] px-3 py-3 text-sm leading-6 text-white/60 outline-none focus:border-[#c8ad84]/30"
      />
    </label>
  );
}
