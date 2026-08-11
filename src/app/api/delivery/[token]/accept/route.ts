import type {
  NextRequest,
} from "next/server";

import {
  loadDeliveryPortal,
} from "@/lib/delivery-portal";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const maxAcknowledgmentLength = 1000;

function jsonError(
  message: string,
  status: number,
) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

async function loadReceiptState(
  token: string,
  fileId: string,
) {
  const portal =
    await loadDeliveryPortal(
      token,
    );

  if (!portal) {
    return null;
  }

  const deliverable =
    portal.deliverables.find(
      (item) =>
        item.fileId ===
        fileId,
    );

  if (!deliverable) {
    return null;
  }

  const admin =
    createAdminClient();

  const [
    receiptResult,
    downloadResult,
  ] =
    await Promise.all([
      admin
        .from(
          "client_delivery_receipts",
        )
        .select(
          "id,project_id,access_id,report_id,file_id,report_number,filename,file_sha256,token_version,acknowledgment,accepted_at,created_at",
        )
        .eq(
          "file_id",
          fileId,
        )
        .maybeSingle(),

      admin
        .from(
          "client_delivery_events",
        )
        .select(
          "occurred_at",
        )
        .eq(
          "project_id",
          portal.projectId,
        )
        .eq(
          "access_id",
          portal.accessId,
        )
        .eq(
          "file_id",
          deliverable.fileId,
        )
        .eq(
          "report_id",
          deliverable.reportId,
        )
        .eq(
          "event_type",
          "file_downloaded",
        )
        .order(
          "occurred_at",
          { ascending: false },
        )
        .limit(1),
    ]);

  if (receiptResult.error) {
    throw new Error(
      receiptResult.error.message,
    );
  }

  if (downloadResult.error) {
    throw new Error(
      downloadResult.error.message,
    );
  }

  return {
    portal,
    deliverable,
    receipt:
      receiptResult.data ??
      null,
    downloadedAt:
      downloadResult.data?.[0]
        ?.occurred_at ??
      null,
  };
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params:
      Promise<{
        token: string;
      }>;
  },
) {
  const { token } =
    await params;

  const fileId =
    request.nextUrl
      .searchParams
      .get("fileId") ??
    "";

  if (
    !uuidPattern.test(
      fileId,
    )
  ) {
    return jsonError(
      "Deliverable not found.",
      404,
    );
  }

  try {
    const state =
      await loadReceiptState(
        token,
        fileId,
      );

    if (!state) {
      return jsonError(
        "Deliverable not found.",
        404,
      );
    }

    return Response.json(
      {
        downloadedAt:
          state.downloadedAt,
        receipt:
          state.receipt,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }
  catch {
    return jsonError(
      "Could not load delivery receipt.",
      500,
    );
  }
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params:
      Promise<{
        token: string;
      }>;
  },
) {
  const { token } =
    await params;

  let body:
    unknown;

  try {
    body =
      await request.json();
  }
  catch {
    return jsonError(
      "Invalid request body.",
      400,
    );
  }

  if (
    !body ||
    typeof body !==
      "object"
  ) {
    return jsonError(
      "Invalid request body.",
      400,
    );
  }

  const payload =
    body as Record<
      string,
      unknown
    >;

  const fileId =
    typeof payload.fileId ===
      "string"
      ? payload.fileId
      : "";

  const acknowledgment =
    typeof payload.acknowledgment ===
      "string"
      ? payload.acknowledgment.trim()
      : "";

  if (
    !uuidPattern.test(
      fileId,
    )
  ) {
    return jsonError(
      "Deliverable not found.",
      404,
    );
  }

  if (
    acknowledgment.length >
    maxAcknowledgmentLength
  ) {
    return jsonError(
      "Acknowledgment must be 1000 characters or less.",
      400,
    );
  }

  let state;

  try {
    state =
      await loadReceiptState(
        token,
        fileId,
      );
  }
  catch {
    return jsonError(
      "Could not verify delivery receipt.",
      500,
    );
  }

  if (!state) {
    return jsonError(
      "Deliverable not found.",
      404,
    );
  }

  if (state.receipt) {
    return Response.json({
      receipt:
        state.receipt,
      downloadedAt:
        state.downloadedAt,
    });
  }

  if (!state.downloadedAt) {
    return jsonError(
      "Download this issued PDF before acknowledging receipt.",
      409,
    );
  }

  const admin =
    createAdminClient();

  const {
    data: created,
    error,
  } =
    await admin
      .from(
        "client_delivery_receipts",
      )
      .insert({
        project_id:
          state.portal.projectId,
        access_id:
          state.portal.accessId,
        report_id:
          state.deliverable.reportId,
        file_id:
          state.deliverable.fileId,
        report_number:
          state.deliverable.reportNumber,
        filename:
          state.deliverable.filename,
        file_sha256:
          state.deliverable.sha256,
        token_version:
          state.portal.tokenVersion,
        acknowledgment,
      })
      .select(
        "id,project_id,access_id,report_id,file_id,report_number,filename,file_sha256,token_version,acknowledgment,accepted_at,created_at",
      )
      .single();

  if (
    error ||
    !created
  ) {
    if (
      error?.code ===
      "23505"
    ) {
      const {
        data: existing,
      } =
        await admin
          .from(
            "client_delivery_receipts",
          )
          .select(
            "id,project_id,access_id,report_id,file_id,report_number,filename,file_sha256,token_version,acknowledgment,accepted_at,created_at",
          )
          .eq(
            "file_id",
            fileId,
          )
          .maybeSingle();

      if (existing) {
        return Response.json({
          receipt:
            existing,
          downloadedAt:
            state.downloadedAt,
        });
      }
    }

    return jsonError(
      error?.message ||
        "Could not create delivery receipt.",
      409,
    );
  }

  return Response.json(
    {
      receipt: created,
      downloadedAt:
        state.downloadedAt,
    },
    { status: 201 },
  );
}