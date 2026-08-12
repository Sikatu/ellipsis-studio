import "server-only";

import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const INVOICE_DELIVERY_TOKEN_BYTES =
  32;

export const INVOICE_DELIVERY_TOKEN_PATTERN =
  /^[0-9a-f]{64}$/;

export type InvoiceDeliveryEventType =
  | "access_activated"
  | "link_rotated"
  | "access_revoked"
  | "portal_viewed"
  | "pdf_downloaded";

export type InvoiceDeliveryActorType =
  | "admin"
  | "client"
  | "system";

export type InvoiceDeliveryInvoice = {
  id: string;
  created_by: string;
  client_id: string;
  invoice_number: string;
  status:
    | "issued"
    | "paid";
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
  final_pdf_bucket: string;
  final_pdf_path: string;
  final_pdf_sha256: string;
  final_pdf_bytes: number;
  final_pdf_created_at: string;
};

export type InvoiceDeliveryItem = {
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

export type InvoiceDeliveryPortal = {
  accessId: string;
  tokenVersion: number;
  invoice: InvoiceDeliveryInvoice;
  items: InvoiceDeliveryItem[];
};

export function createInvoiceDeliveryToken() {
  return randomBytes(
    INVOICE_DELIVERY_TOKEN_BYTES,
  ).toString(
    "hex",
  );
}

export function hashInvoiceDeliveryToken(
  token: string,
) {
  return createHash(
    "sha256",
  )
    .update(
      token,
      "utf8",
    )
    .digest(
      "hex",
    );
}

export function isInvoiceDeliveryToken(
  token: string,
) {
  return INVOICE_DELIVERY_TOKEN_PATTERN.test(
    token,
  );
}

export async function recordInvoiceDeliveryEvent({
  invoiceId,
  accessId,
  eventType,
  actorType,
  actorAdminId = null,
  tokenVersion = null,
  metadata = {},
  dedupeWindowMs = 0,
}: {
  invoiceId: string;
  accessId: string;
  eventType:
    InvoiceDeliveryEventType;
  actorType:
    InvoiceDeliveryActorType;
  actorAdminId?:
    string | null;
  tokenVersion?:
    number | null;
  metadata?:
    Record<
      string,
      string | number | boolean | null
    >;
  dedupeWindowMs?:
    number;
}) {
  const admin =
    createAdminClient();

  if (
    dedupeWindowMs >
      0
  ) {
    const cutoff =
      new Date(
        Date.now() -
          dedupeWindowMs,
      ).toISOString();

    const {
      data: recent,
      error:
        recentError,
    } =
      await admin
        .from(
          "invoice_delivery_events",
        )
        .select(
          "id",
        )
        .eq(
          "access_id",
          accessId,
        )
        .eq(
          "event_type",
          eventType,
        )
        .gte(
          "occurred_at",
          cutoff,
        )
        .limit(
          1,
        );

    if (recentError) {
      console.error(
        "Invoice delivery event dedupe failed:",
        recentError,
      );
    } else if (
      recent &&
      recent.length >
        0
    ) {
      return {
        recorded:
          false,
        deduped:
          true,
      };
    }
  }

  const {
    error,
  } =
    await admin
      .from(
        "invoice_delivery_events",
      )
      .insert({
        invoice_id:
          invoiceId,
        access_id:
          accessId,
        event_type:
          eventType,
        actor_type:
          actorType,
        actor_admin_id:
          actorType ===
            "admin"
            ? actorAdminId
            : null,
        token_version:
          tokenVersion,
        metadata,
      });

  if (error) {
    console.error(
      "Invoice delivery audit event write failed:",
      error,
    );

    return {
      recorded:
        false,
      deduped:
        false,
    };
  }

  return {
    recorded:
      true,
    deduped:
      false,
  };
}

export async function loadInvoiceDeliveryPortal(
  token: string,
  {
    touchAccess =
      true,
  }: {
    touchAccess?:
      boolean;
  } = {},
): Promise<
  InvoiceDeliveryPortal |
  null
> {
  if (
    !isInvoiceDeliveryToken(
      token,
    )
  ) {
    return null;
  }

  const admin =
    createAdminClient();

  const tokenHash =
    hashInvoiceDeliveryToken(
      token,
    );

  const {
    data: access,
    error:
      accessError,
  } =
    await admin
      .from(
        "invoice_delivery_access",
      )
      .select(
        "id,invoice_id,created_by,status,token_version,expires_at,last_accessed_at,last_downloaded_at",
      )
      .eq(
        "token_hash",
        tokenHash,
      )
      .eq(
        "status",
        "active",
      )
      .maybeSingle();

  if (
    accessError ||
    !access
  ) {
    return null;
  }

  if (
    access.expires_at &&
    new Date(
      access.expires_at,
    ).getTime() <=
      Date.now()
  ) {
    return null;
  }

  const {
    data: invoice,
    error:
      invoiceError,
  } =
    await admin
      .from(
        "invoices",
      )
      .select(
        "id,created_by,client_id,invoice_number,status,invoice_date,due_date,currency,sender_snapshot,client_snapshot,payment_instructions_snapshot,notes,subtotal_cents,discount_cents,tax_cents,adjustment_cents,total_cents,issued_at,paid_at,final_pdf_bucket,final_pdf_path,final_pdf_sha256,final_pdf_bytes,final_pdf_created_at",
      )
      .eq(
        "id",
        access.invoice_id,
      )
      .eq(
        "created_by",
        access.created_by,
      )
      .in(
        "status",
        [
          "issued",
          "paid",
        ],
      )
      .maybeSingle();

  if (
    invoiceError ||
    !invoice ||
    invoice.final_pdf_bucket !==
      "studio-invoices" ||
    !invoice.final_pdf_path ||
    !invoice.final_pdf_sha256 ||
    !invoice.final_pdf_bytes ||
    !invoice.final_pdf_created_at
  ) {
    return null;
  }

  const {
    data: items,
    error:
      itemError,
  } =
    await admin
      .from(
        "invoice_items",
      )
      .select(
        "id,sort_order,description,quantity,unit_label,unit_rate_cents,amount_cents,notes",
      )
      .eq(
        "invoice_id",
        invoice.id,
      )
      .eq(
        "created_by",
        access.created_by,
      )
      .order(
        "sort_order",
        {
          ascending:
            true,
        },
      );

  if (
    itemError ||
    !items
  ) {
    return null;
  }

  if (touchAccess) {
    const accessedAt =
      new Date()
        .toISOString();

    const {
      error:
        touchError,
    } =
      await admin
        .from(
          "invoice_delivery_access",
        )
        .update({
          last_accessed_at:
            accessedAt,
        })
        .eq(
          "id",
          access.id,
        )
        .eq(
          "status",
          "active",
        );

    if (touchError) {
      console.error(
        "Invoice delivery access touch failed:",
        touchError,
      );
    }

    await recordInvoiceDeliveryEvent({
      invoiceId:
        invoice.id,
      accessId:
        access.id,
      eventType:
        "portal_viewed",
      actorType:
        "client",
      tokenVersion:
        access.token_version,
      metadata: {
        invoiceNumber:
          invoice.invoice_number,
      },
      dedupeWindowMs:
        5 * 60 * 1000,
    });
  }

  return {
    accessId:
      access.id,
    tokenVersion:
      access.token_version,
    invoice:
      invoice as
        InvoiceDeliveryInvoice,
    items:
      items as
        InvoiceDeliveryItem[],
  };
}
