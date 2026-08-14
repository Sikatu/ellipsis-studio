import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  createClient,
} from "@/lib/supabase/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const PAGE_SIZE =
  1000;

const MAX_ROWS =
  100000;

type InvoiceRow = {
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
  currency: string;
  client_snapshot: unknown;
  total_cents: number;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type FollowUpRow = {
  invoice_id: string;
  reminder_state: string;
  next_follow_up_at:
    string | null;
};

type DeliveryRow = {
  invoice_id: string;
  status:
    | "active"
    | "revoked";
  last_accessed_at:
    string | null;
  last_downloaded_at:
    string | null;
};

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
  activeInvoiceCount: number;
  activeInvoiceCents: number;
  paymentDaysTotal: number;
  paymentDaysCount: number;
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

async function authenticatedAdmin() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const {
    data: profile,
  } =
    await supabase
      .from(
        "admin_profiles",
      )
      .select(
        "user_id",
      )
      .eq(
        "user_id",
        user.id,
      )
      .maybeSingle();

  return profile
    ? user
    : null;
}

function jsonError(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
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
  invoice: InvoiceRow,
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

function validDateString(
  value: string | null,
) {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const parsed =
    new Date(
      `${value}T00:00:00Z`,
    );

  return (
    !Number.isNaN(
      parsed.getTime(),
    ) &&
    parsed
      .toISOString()
      .slice(
        0,
        10,
      ) ===
      value
  );
}

function parsedTimezoneOffset(
  value: string | null,
) {
  if (!value) {
    return 0;
  }

  const parsed =
    Number(value);

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed < -840 ||
    parsed > 840
  ) {
    return null;
  }

  return parsed;
}

function localMonthKey(
  value: string,
  timezoneOffsetMinutes: number,
) {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  const shifted =
    new Date(
      date.getTime() -
        timezoneOffsetMinutes *
          60_000,
    );

  return shifted
    .toISOString()
    .slice(
      0,
      7,
    );
}

function earliestMonthKey(
  timezoneOffsetMinutes: number,
) {
  const now =
    new Date();

  const shifted =
    new Date(
      now.getTime() -
        timezoneOffsetMinutes *
          60_000,
    );

  const start =
    new Date(
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth() -
          11,
        1,
      ),
    );

  return start
    .toISOString()
    .slice(
      0,
      7,
    );
}

function paymentDays(
  invoice: InvoiceRow,
) {
  if (
    !invoice.issued_at ||
    !invoice.paid_at
  ) {
    return null;
  }

  const issued =
    new Date(
      invoice.issued_at,
    );

  const paid =
    new Date(
      invoice.paid_at,
    );

  if (
    Number.isNaN(
      issued.getTime(),
    ) ||
    Number.isNaN(
      paid.getTime(),
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    (
      paid.getTime() -
      issued.getTime()
    ) /
      86_400_000,
  );
}

async function loadInvoices(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  userId: string,
) {
  const rows:
    InvoiceRow[] =
      [];

  for (
    let offset = 0;
    offset < MAX_ROWS;
    offset += PAGE_SIZE
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "invoices",
        )
        .select(
          "id,client_id,invoice_number,status,invoice_date,due_date,currency,client_snapshot,total_cents,issued_at,paid_at,created_at",
        )
        .eq(
          "created_by",
          userId,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        )
        .range(
          offset,
          offset +
            PAGE_SIZE -
            1,
        );

    if (error) {
      throw new Error(
        error.message,
      );
    }

    const page =
      (
        data ??
        []
      ) as unknown as
        InvoiceRow[];

    rows.push(
      ...page,
    );

    if (
      page.length <
      PAGE_SIZE
    ) {
      return rows;
    }
  }

  throw new Error(
    "Invoice analytics exceeded the supported row limit.",
  );
}

async function loadFollowUps(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  userId: string,
) {
  const rows:
    FollowUpRow[] =
      [];

  for (
    let offset = 0;
    offset < MAX_ROWS;
    offset += PAGE_SIZE
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "invoice_follow_up_states",
        )
        .select(
          "invoice_id,reminder_state,next_follow_up_at",
        )
        .eq(
          "created_by",
          userId,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        )
        .range(
          offset,
          offset +
            PAGE_SIZE -
            1,
        );

    if (error) {
      throw new Error(
        error.message,
      );
    }

    const page =
      (
        data ??
        []
      ) as unknown as
        FollowUpRow[];

    rows.push(
      ...page,
    );

    if (
      page.length <
      PAGE_SIZE
    ) {
      return rows;
    }
  }

  throw new Error(
    "Follow-up analytics exceeded the supported row limit.",
  );
}

async function loadDelivery(
  admin:
    ReturnType<
      typeof createAdminClient
    >,
  userId: string,
) {
  const rows:
    DeliveryRow[] =
      [];

  for (
    let offset = 0;
    offset < MAX_ROWS;
    offset += PAGE_SIZE
  ) {
    const {
      data,
      error,
    } =
      await admin
        .from(
          "invoice_delivery_access",
        )
        .select(
          "invoice_id,status,last_accessed_at,last_downloaded_at",
        )
        .eq(
          "created_by",
          userId,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        )
        .range(
          offset,
          offset +
            PAGE_SIZE -
            1,
        );

    if (error) {
      throw new Error(
        error.message,
      );
    }

    const page =
      (
        data ??
        []
      ) as unknown as
        DeliveryRow[];

    rows.push(
      ...page,
    );

    if (
      page.length <
      PAGE_SIZE
    ) {
      return rows;
    }
  }

  throw new Error(
    "Delivery analytics exceeded the supported row limit.",
  );
}

function attentionInvoice(
  invoice: InvoiceRow,
  followUp:
    FollowUpRow |
    null,
  delivery:
    DeliveryRow |
    null,
): AttentionInvoice {
  return {
    id:
      invoice.id,
    invoiceNumber:
      invoice.invoice_number,
    clientName:
      clientName(
        invoice,
      ),
    currency:
      invoice.currency,
    totalCents:
      invoice.total_cents,
    dueDate:
      invoice.due_date,
    nextFollowUpAt:
      followUp
        ?.next_follow_up_at ??
      null,
    lastAccessedAt:
      delivery
        ?.last_accessed_at ??
      null,
    lastDownloadedAt:
      delivery
        ?.last_downloaded_at ??
      null,
  };
}

export async function GET(
  request: NextRequest,
) {
  const user =
    await authenticatedAdmin();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
    );
  }

  const requestedToday =
    request.nextUrl
      .searchParams
      .get(
        "today",
      );

  const today =
    validDateString(
      requestedToday,
    )
      ? requestedToday as string
      : new Date()
          .toISOString()
          .slice(
            0,
            10,
          );

  const timezoneOffsetMinutes =
    parsedTimezoneOffset(
      request.nextUrl
        .searchParams
        .get(
          "timezoneOffset",
        ),
    );

  if (
    timezoneOffsetMinutes ===
      null
  ) {
    return jsonError(
      "Invalid timezone offset.",
      400,
    );
  }

  const admin =
    createAdminClient();

  let invoices:
    InvoiceRow[];
  let followUps:
    FollowUpRow[];
  let deliveryRows:
    DeliveryRow[];

  try {
    [
      invoices,
      followUps,
      deliveryRows,
    ] =
      await Promise.all([
        loadInvoices(
          admin,
          user.id,
        ),
        loadFollowUps(
          admin,
          user.id,
        ),
        loadDelivery(
          admin,
          user.id,
        ),
      ]);
  } catch (
    loadError
  ) {
    return jsonError(
      loadError instanceof
        Error
        ? loadError.message
        : "Could not load invoice analytics.",
      500,
    );
  }

  const followUpByInvoice =
    new Map(
      followUps.map(
        (row) => [
          row.invoice_id,
          row,
        ],
      ),
    );

  const deliveryByInvoice =
    new Map(
      deliveryRows.map(
        (row) => [
          row.invoice_id,
          row,
        ],
      ),
    );

  const currencyMap =
    new Map<
      string,
      CurrencySummary
    >();

  const statusCounts = {
    total:
      invoices.length,
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

  const monthlyMap =
    new Map<
      string,
      {
        month: string;
        currency: string;
        totalCents: number;
        count: number;
      }
    >();

  const clientMap =
    new Map<
      string,
      {
        clientId: string;
        clientName: string;
        currency: string;
        paidCents: number;
        paidCount: number;
      }
    >();

  const attention = {
    overdue:
      [] as
        AttentionInvoice[],
    followUpsDue:
      [] as
        AttentionInvoice[],
    issuedNeverViewed:
      [] as
        AttentionInvoice[],
    viewedUnpaid:
      [] as
        AttentionInvoice[],
  };

  const earliestMonth =
    earliestMonthKey(
      timezoneOffsetMinutes,
    );

  for (
    const invoice of invoices
  ) {
    const overdue =
      invoice.status ===
        "issued" &&
      invoice.due_date <
        today;

    if (
      invoice.status ===
        "draft"
    ) {
      statusCounts.draft +=
        1;
    } else if (
      invoice.status ===
        "paid"
    ) {
      statusCounts.paid +=
        1;
    } else if (
      invoice.status ===
        "void"
    ) {
      statusCounts.void +=
        1;
    } else if (
      overdue
    ) {
      statusCounts.overdue +=
        1;
    } else {
      statusCounts.issued +=
        1;
    }

    let summary =
      currencyMap.get(
        invoice.currency,
      );

    if (!summary) {
      summary = {
        currency:
          invoice.currency,
        paidCents:
          0,
        paidCount:
          0,
        outstandingCents:
          0,
        issuedCount:
          0,
        overdueCents:
          0,
        overdueCount:
          0,
        draftCents:
          0,
        draftCount:
          0,
        voidCount:
          0,
        activeInvoiceCount:
          0,
        activeInvoiceCents:
          0,
        paymentDaysTotal:
          0,
        paymentDaysCount:
          0,
      };

      currencyMap.set(
        invoice.currency,
        summary,
      );
    }

    if (
      invoice.status ===
        "paid"
    ) {
      summary.paidCents +=
        invoice.total_cents;
      summary.paidCount +=
        1;
      summary.activeInvoiceCount +=
        1;
      summary.activeInvoiceCents +=
        invoice.total_cents;

      const days =
        paymentDays(
          invoice,
        );

      if (
        days !==
          null
      ) {
        summary.paymentDaysTotal +=
          days;
        summary.paymentDaysCount +=
          1;
      }

      if (
        invoice.paid_at
      ) {
        const month =
          localMonthKey(
            invoice.paid_at,
            timezoneOffsetMinutes,
          );

        if (
          month &&
          month >=
            earliestMonth
        ) {
          const key =
            `${month}:${invoice.currency}`;

          const current =
            monthlyMap.get(
              key,
            ) ?? {
              month,
              currency:
                invoice.currency,
              totalCents:
                0,
              count:
                0,
            };

          current.totalCents +=
            invoice.total_cents;
          current.count +=
            1;

          monthlyMap.set(
            key,
            current,
          );
        }
      }

      const clientKey =
        `${invoice.client_id}:${invoice.currency}`;

      const client =
        clientMap.get(
          clientKey,
        ) ?? {
          clientId:
            invoice.client_id,
          clientName:
            clientName(
              invoice,
            ),
          currency:
            invoice.currency,
          paidCents:
            0,
          paidCount:
            0,
        };

      client.paidCents +=
        invoice.total_cents;
      client.paidCount +=
        1;

      clientMap.set(
        clientKey,
        client,
      );
    } else if (
      invoice.status ===
        "issued"
    ) {
      summary.outstandingCents +=
        invoice.total_cents;
      summary.activeInvoiceCount +=
        1;
      summary.activeInvoiceCents +=
        invoice.total_cents;

      if (overdue) {
        summary.overdueCents +=
          invoice.total_cents;
        summary.overdueCount +=
          1;
      } else {
        summary.issuedCount +=
          1;
      }
    } else if (
      invoice.status ===
        "draft"
    ) {
      summary.draftCents +=
        invoice.total_cents;
      summary.draftCount +=
        1;
      summary.activeInvoiceCount +=
        1;
      summary.activeInvoiceCents +=
        invoice.total_cents;
    } else {
      summary.voidCount +=
        1;
    }

    if (
      invoice.status !==
        "issued"
    ) {
      continue;
    }

    const followUp =
      followUpByInvoice.get(
        invoice.id,
      ) ??
      null;

    const delivery =
      deliveryByInvoice.get(
        invoice.id,
      ) ??
      null;

    const row =
      attentionInvoice(
        invoice,
        followUp,
        delivery,
      );

    if (overdue) {
      attention.overdue.push(
        row,
      );
    }

    if (
      followUp
        ?.next_follow_up_at &&
      new Date(
        followUp.next_follow_up_at,
      ).getTime() <=
        Date.now()
    ) {
      attention.followUpsDue.push(
        row,
      );
    }

    if (
      !delivery
        ?.last_accessed_at
    ) {
      attention.issuedNeverViewed.push(
        row,
      );
    } else {
      attention.viewedUnpaid.push(
        row,
      );
    }
  }

  const currencies =
    Array.from(
      currencyMap.values(),
    )
      .map(
        (
          summary,
        ) => {
          const paymentDenominator =
            summary.paidCount +
            summary.issuedCount +
            summary.overdueCount;

          return {
            currency:
              summary.currency,
            paidCents:
              summary.paidCents,
            paidCount:
              summary.paidCount,
            outstandingCents:
              summary.outstandingCents,
            issuedCount:
              summary.issuedCount,
            overdueCents:
              summary.overdueCents,
            overdueCount:
              summary.overdueCount,
            draftCents:
              summary.draftCents,
            draftCount:
              summary.draftCount,
            voidCount:
              summary.voidCount,
            averageInvoiceCents:
              summary.activeInvoiceCount >
                0
                ? Math.round(
                    summary.activeInvoiceCents /
                      summary.activeInvoiceCount,
                  )
                : 0,
            averageDaysToPayment:
              summary.paymentDaysCount >
                0
                ? Number(
                    (
                      summary.paymentDaysTotal /
                      summary.paymentDaysCount
                    ).toFixed(
                      1,
                    ),
                  )
                : null,
            paymentCompletionRate:
              paymentDenominator >
                0
                ? Number(
                    (
                      summary.paidCount /
                      paymentDenominator *
                      100
                    ).toFixed(
                      1,
                    ),
                  )
                : null,
          };
        },
      )
      .sort(
        (
          a,
          b,
        ) =>
          a.currency
            .localeCompare(
              b.currency,
            ),
      );

  const monthlyRevenue =
    Array.from(
      monthlyMap.values(),
    )
      .sort(
        (
          a,
          b,
        ) =>
          a.month ===
          b.month
            ? a.currency
                .localeCompare(
                  b.currency,
                )
            : a.month <
                b.month
              ? 1
              : -1,
      );

  const topClients =
    Array.from(
      clientMap.values(),
    )
      .sort(
        (
          a,
          b,
        ) =>
          a.currency ===
          b.currency
            ? b.paidCents -
              a.paidCents
            : a.currency
                .localeCompare(
                  b.currency,
                ),
      );

  for (
    const key of Object.keys(
      attention,
    ) as Array<
      keyof typeof attention
    >
  ) {
    attention[
      key
    ].sort(
      (
        a,
        b,
      ) =>
        a.dueDate
          .localeCompare(
            b.dueDate,
          ),
    );
  }

  return NextResponse.json(
    {
      generatedAt:
        new Date()
          .toISOString(),
      today,
      timezoneOffsetMinutes,
      currencies,
      statusCounts,
      monthlyRevenue,
      topClients,
      attention,
      definitions: {
        paymentCompletionRate:
          "Paid divided by paid plus currently issued invoices. Drafts and void invoices are excluded.",
        averageInvoiceValue:
          "Average value of non-void invoices in each original currency.",
        averageDaysToPayment:
          "Elapsed time from issue to payment for paid invoices.",
        overdue:
          "Issued invoice with a due date before the selected local date.",
        currencyPolicy:
          "Currencies are reported independently and are never converted or summed together.",
      },
    },
    {
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}
