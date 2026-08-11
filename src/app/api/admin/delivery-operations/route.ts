import type {
  NextRequest,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const maxNotesLength =
  5000;

type HandoffStage =
  | "locked"
  | "prepared"
  | "shared"
  | "viewed"
  | "downloaded"
  | "accepted"
  | "completed";

type HandoffRow = {
  project_id: string;

  studio_notes: string;

  follow_up_at:
    | string
    | null;

  completed_at:
    | string
    | null;

  completed_by:
    | string
    | null;

  created_by: string;

  updated_by: string;

  created_at: string;

  updated_at: string;
};

type HandoffEvent = {
  id: string;

  event_type:
    | "note_updated"
    | "follow_up_scheduled"
    | "follow_up_cleared"
    | "handoff_completed"
    | "handoff_reopened";

  metadata:
    Record<
      string,
      unknown
    >;

  occurred_at:
    string;
};

function jsonError(
  message: string,
  status: number,
) {
  return Response.json(
    {
      error:
        message,
    },
    {
      status,
    },
  );
}

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
    return {
      supabase,
      user: null,
    };
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

  return {
    supabase,

    user:
      profile
        ? {
            id:
              user.id,
          }
        : null,
  };
}

async function authorizeProject(
  supabase:
    Awaited<
      ReturnType<
        typeof createClient
      >
    >,
  projectId: string,
) {
  const {
    data: project,
    error,
  } =
    await supabase
      .from(
        "discovery_projects",
      )
      .select(
        "id,client_id,title",
      )
      .eq(
        "id",
        projectId,
      )
      .maybeSingle();

  if (
    error ||
    !project
  ) {
    return null;
  }

  return project;
}

function firstEventTime(
  events:
    Array<{
      event_type:
        string;

      occurred_at:
        string;

      report_id:
        | string
        | null;
    }>,
  type: string,
  reportId?:
    string,
) {
  return events.find(
    (event) =>
      event.event_type ===
        type &&
      (
        !reportId ||
        event.report_id ===
          reportId
      ),
  )?.occurred_at ??
    null;
}

function countEvents(
  events:
    Array<{
      event_type:
        string;
    }>,
  types:
    string[],
) {
  const allowed =
    new Set(
      types,
    );

  return events.filter(
    (event) =>
      allowed.has(
        event.event_type,
      ),
  ).length;
}

async function loadOperations(
  projectId: string,
) {
  const admin =
    createAdminClient();

  const [
    reportsResult,
    accessResult,
    deliveryEventsResult,
    handoffResult,
    handoffEventsResult,
  ] =
    await Promise.all([
      admin
        .from(
          "strategy_reports",
        )
        .select(
          "id,report_number,issued_at",
        )
        .eq(
          "project_id",
          projectId,
        )
        .eq(
          "status",
          "issued",
        )
        .order(
          "report_number",
          {
            ascending:
              false,
          },
        ),

      admin
        .from(
          "client_delivery_access",
        )
        .select(
          "id,status,created_at,token_version,last_accessed_at,last_downloaded_at",
        )
        .eq(
          "project_id",
          projectId,
        )
        .maybeSingle(),

      admin
        .from(
          "client_delivery_events",
        )
        .select(
          "event_type,occurred_at,report_id",
        )
        .eq(
          "project_id",
          projectId,
        )
        .order(
          "occurred_at",
          {
            ascending:
              true,
          },
        ),

      admin
        .from(
          "client_delivery_handoffs",
        )
        .select(
          "project_id,studio_notes,follow_up_at,completed_at,completed_by,created_by,updated_by,created_at,updated_at",
        )
        .eq(
          "project_id",
          projectId,
        )
        .maybeSingle(),

      admin
        .from(
          "client_delivery_handoff_events",
        )
        .select(
          "id,event_type,metadata,occurred_at",
        )
        .eq(
          "project_id",
          projectId,
        )
        .order(
          "occurred_at",
          {
            ascending:
              false,
          },
        )
        .limit(
          20,
        ),
    ]);

  for (
    const error of [
      reportsResult.error,
      accessResult.error,
      deliveryEventsResult.error,
      handoffResult.error,
      handoffEventsResult.error,
    ]
  ) {
    if (error) {
      throw new Error(
        error.message,
      );
    }
  }

  const reports =
    reportsResult.data ??
      [];

  const access =
    accessResult.data ??
      null;

  const deliveryEvents =
    deliveryEventsResult.data ??
      [];

  const handoff =
    handoffResult.data as
      HandoffRow | null;

  const operations =
    (
      handoffEventsResult.data ??
        []
    ) as HandoffEvent[];

  const latestReport =
    reports[0] ??
      null;

  const {
    data: receiptRows,
    error: receiptsError,
  } =
    await admin
      .from(
        "client_delivery_receipts",
      )
      .select(
        "id,report_id,report_number,filename,file_sha256,acknowledgment,accepted_at",
      )
      .eq(
        "project_id",
        projectId,
      )
      .order(
        "accepted_at",
        {
          ascending:
            false,
        },
      );

  if (receiptsError) {
    throw new Error(
      receiptsError.message,
    );
  }

  const latestReceipt =
    latestReport
      ? receiptRows?.find(
          (receipt) =>
            receipt.report_id ===
            latestReport.id,
        ) ??
        null
      : null;

  const preparedAt =
    latestReport?.issued_at ??
      null;

  const sharedAt =
    firstEventTime(
      deliveryEvents,
      "access_activated",
    ) ??
    access?.created_at ??
    null;

  const viewedAt =
    firstEventTime(
      deliveryEvents,
      "portal_viewed",
    );

  const downloadedAt =
    latestReport
      ? firstEventTime(
          deliveryEvents,
          "file_downloaded",
          latestReport.id,
        )
      : null;

  const acceptedAt =
    latestReceipt?.accepted_at ??
      null;

  const completedForCurrent =
    Boolean(
      latestReport &&
      latestReceipt &&
      handoff?.completed_at &&
      new Date(
        handoff.completed_at,
      ).getTime() >=
        new Date(
          latestReceipt.accepted_at,
        ).getTime() &&
      (
        !latestReport.issued_at ||
        new Date(
          handoff.completed_at,
        ).getTime() >=
          new Date(
            latestReport.issued_at,
          ).getTime()
      ),
    );

  let stage:
    HandoffStage =
      "locked";

  if (
    reports.length >
    0
  ) {
    stage =
      "prepared";
  }

  if (
    access
  ) {
    stage =
      "shared";
  }

  if (
    viewedAt
  ) {
    stage =
      "viewed";
  }

  if (
    downloadedAt
  ) {
    stage =
      "downloaded";
  }

  if (
    latestReceipt
  ) {
    stage =
      "accepted";
  }

  if (
    completedForCurrent
  ) {
    stage =
      "completed";
  }

  const followUpAt =
    handoff?.follow_up_at ??
      null;

  const followUpDue =
    Boolean(
      followUpAt &&
      !completedForCurrent &&
      new Date(
        followUpAt,
      ).getTime() <=
        Date.now(),
    );

  let healthCode =
    "locked";

  let healthLabel =
    "Locked";

  let nextAction =
    "Issue a sealed report before starting client handoff.";

  if (
    stage ===
    "prepared"
  ) {
    healthCode =
      "ready_to_share";

    healthLabel =
      "Ready to share";

    nextAction =
      "Activate Client Delivery and share the generated private link.";
  }

  if (
    stage ===
    "shared"
  ) {
    healthCode =
      "awaiting_view";

    healthLabel =
      "Awaiting client";

    nextAction =
      "Wait for the client to open the private delivery portal.";
  }

  if (
    stage ===
    "viewed"
  ) {
    healthCode =
      "awaiting_download";

    healthLabel =
      "Viewed";

    nextAction =
      "The client has viewed the portal. Wait for the official PDF download.";
  }

  if (
    stage ===
    "downloaded"
  ) {
    healthCode =
      "awaiting_acceptance";

    healthLabel =
      "Awaiting acceptance";

    nextAction =
      "The client downloaded the issued PDF. Wait for explicit delivery acknowledgment in the private portal.";
  }

  if (
    stage ===
    "accepted"
  ) {
    healthCode =
      "ready_to_complete";

    healthLabel =
      "Accepted";

    nextAction =
      "The client acknowledged receipt of the current issued report. Complete the handoff when studio wrap-up is finished.";
  }

  if (
    stage ===
    "completed"
  ) {
    healthCode =
      "complete";

    healthLabel =
      "Complete";

    nextAction =
      "No delivery action is currently required.";
  }

  if (
    access?.status ===
      "revoked" &&
    ![
      "accepted",
      "completed",
    ].includes(
      stage,
    )
  ) {
    healthCode =
      "access_revoked";

    healthLabel =
      "Access revoked";

    nextAction =
      "Generate a replacement delivery link if the client still needs access.";
  }

  if (
    followUpDue
  ) {
    healthCode =
      "follow_up_due";

    healthLabel =
      "Follow-up due";

    nextAction =
      "Follow up with the client, then reschedule or clear the reminder.";
  }
  else if (
    followUpAt &&
    stage !==
      "completed" &&
    healthCode !==
      "access_revoked"
  ) {
    healthCode =
      "follow_up_scheduled";

    healthLabel =
      "Follow-up scheduled";
  }

  return {
    stage,

    healthCode,

    healthLabel,

    nextAction,

    issuedDeliverables:
      reports.length,

    accessStatus:
      access?.status ??
      null,

    lifecycle: {
      preparedAt,

      sharedAt,

      viewedAt,

      downloadedAt,

      acceptedAt,

      completedAt:
        completedForCurrent
          ? handoff?.completed_at ??
            null
          : null,
    },

    engagement: {
      portalViews:
        countEvents(
          deliveryEvents,
          [
            "portal_viewed",
          ],
        ),

      downloads:
        countEvents(
          deliveryEvents,
          [
            "file_downloaded",
          ],
        ),

      accessChanges:
        countEvents(
          deliveryEvents,
          [
            "access_activated",
            "link_rotated",
            "access_revoked",
          ],
        ),
    },

    acceptance:
      latestReceipt
        ? {
            id:
              latestReceipt.id,

            acceptedAt:
              latestReceipt.accepted_at,

            reportNumber:
              latestReceipt.report_number,

            filename:
              latestReceipt.filename,

            sha256:
              latestReceipt.file_sha256,

            acknowledgment:
              latestReceipt.acknowledgment,
          }
        : null,

    handoff: {
      notes:
        handoff?.studio_notes ??
        "",

      followUpAt,

      followUpDue,

      completedAt:
        completedForCurrent
          ? handoff?.completed_at ??
            null
          : null,

      updatedAt:
        handoff?.updated_at ??
        null,
    },

    canComplete:
      stage ===
      "accepted",

    canReopen:
      stage ===
      "completed",

    operations,
  };
}

async function ensureHandoff(
  projectId: string,
  userId: string,
) {
  const admin =
    createAdminClient();

  const {
    data: existing,
    error:
      existingError,
  } =
    await admin
      .from(
        "client_delivery_handoffs",
      )
      .select(
        "project_id,studio_notes,follow_up_at,completed_at,completed_by,created_by,updated_by,created_at,updated_at",
      )
      .eq(
        "project_id",
        projectId,
      )
      .maybeSingle();

  if (existingError) {
    throw new Error(
      existingError.message,
    );
  }

  if (existing) {
    return existing as
      HandoffRow;
  }

  const {
    data: created,
    error:
      createError,
  } =
    await admin
      .from(
        "client_delivery_handoffs",
      )
      .insert({
        project_id:
          projectId,

        created_by:
          userId,

        updated_by:
          userId,
      })
      .select(
        "project_id,studio_notes,follow_up_at,completed_at,completed_by,created_by,updated_by,created_at,updated_at",
      )
      .single();

  if (
    createError ||
    !created
  ) {
    throw new Error(
      createError?.message ||
        "Could not initialize delivery handoff.",
    );
  }

  return created as
    HandoffRow;
}

async function recordOperation(
  projectId: string,
  userId: string,
  eventType:
    HandoffEvent["event_type"],
  metadata:
    Record<
      string,
      unknown
    > = {},
) {
  const admin =
    createAdminClient();

  const {
    error,
  } =
    await admin
      .from(
        "client_delivery_handoff_events",
      )
      .insert({
        project_id:
          projectId,

        event_type:
          eventType,

        actor_admin_id:
          userId,

        metadata,
      });

  if (error) {
    throw new Error(
      error.message,
    );
  }
}

export async function GET(
  request: NextRequest,
) {
  const {
    supabase,
    user,
  } =
    await authenticatedAdmin();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
    );
  }

  const projectId =
    request.nextUrl
      .searchParams
      .get(
        "projectId",
      ) ?? "";

  if (
    !uuidPattern.test(
      projectId,
    )
  ) {
    return jsonError(
      "Invalid project ID.",
      400,
    );
  }

  const project =
    await authorizeProject(
      supabase,
      projectId,
    );

  if (!project) {
    return jsonError(
      "Project not found.",
      404,
    );
  }

  try {
    return Response.json(
      await loadOperations(
        projectId,
      ),
    );
  }
  catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Could not load delivery operations.",
      500,
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  const {
    supabase,
    user,
  } =
    await authenticatedAdmin();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
    );
  }

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

  const projectId =
    typeof payload.projectId ===
      "string"
      ? payload.projectId
      : "";

  const action =
    typeof payload.action ===
      "string"
      ? payload.action
      : "";

  if (
    !uuidPattern.test(
      projectId,
    )
  ) {
    return jsonError(
      "Invalid project ID.",
      400,
    );
  }

  if (
    ![
      "save_notes",
      "schedule_follow_up",
      "clear_follow_up",
      "complete",
      "reopen",
    ].includes(
      action,
    )
  ) {
    return jsonError(
      "Unsupported delivery operation.",
      400,
    );
  }

  const project =
    await authorizeProject(
      supabase,
      projectId,
    );

  if (!project) {
    return jsonError(
      "Project not found.",
      404,
    );
  }

  let current;

  try {
    current =
      await loadOperations(
        projectId,
      );
  }
  catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Could not load delivery operations.",
      500,
    );
  }

  if (
    current.stage ===
    "locked"
  ) {
    return jsonError(
      "Issue a sealed deliverable before managing client handoff.",
      409,
    );
  }

  const admin =
    createAdminClient();

  try {
    const handoff =
      await ensureHandoff(
        projectId,
        user.id,
      );

    if (
      action ===
      "save_notes"
    ) {
      const notes =
        typeof payload.notes ===
          "string"
          ? payload.notes.trim()
          : "";

      if (
        notes.length >
        maxNotesLength
      ) {
        return jsonError(
          "Studio notes must be 5000 characters or less.",
          400,
        );
      }

      if (
        notes !==
        handoff.studio_notes
      ) {
        const {
          error,
        } =
          await admin
            .from(
              "client_delivery_handoffs",
            )
            .update({
              studio_notes:
                notes,

              updated_by:
                user.id,
            })
            .eq(
              "project_id",
              projectId,
            );

        if (error) {
          throw new Error(
            error.message,
          );
        }

        await recordOperation(
          projectId,
          user.id,
          "note_updated",
          {
            noteLength:
              notes.length,
          },
        );
      }
    }

    if (
      action ===
      "schedule_follow_up"
    ) {
      const followUpAt =
        typeof payload.followUpAt ===
          "string"
          ? payload.followUpAt
          : "";

      const parsed =
        new Date(
          followUpAt,
        );

      if (
        !followUpAt ||
        Number.isNaN(
          parsed.getTime(),
        )
      ) {
        return jsonError(
          "A valid follow-up date and time is required.",
          400,
        );
      }

      const normalized =
        parsed.toISOString();

      const {
        error,
      } =
        await admin
          .from(
            "client_delivery_handoffs",
          )
          .update({
            follow_up_at:
              normalized,

            updated_by:
              user.id,
          })
          .eq(
            "project_id",
            projectId,
          );

      if (error) {
        throw new Error(
          error.message,
        );
      }

      await recordOperation(
        projectId,
        user.id,
        "follow_up_scheduled",
        {
          followUpAt:
            normalized,
        },
      );
    }

    if (
      action ===
      "clear_follow_up"
    ) {
      if (
        handoff.follow_up_at
      ) {
        const previous =
          handoff.follow_up_at;

        const {
          error,
        } =
          await admin
            .from(
              "client_delivery_handoffs",
            )
            .update({
              follow_up_at:
                null,

              updated_by:
                user.id,
            })
            .eq(
              "project_id",
              projectId,
            );

        if (error) {
          throw new Error(
            error.message,
          );
        }

        await recordOperation(
          projectId,
          user.id,
          "follow_up_cleared",
          {
            previousFollowUpAt:
              previous,
          },
        );
      }
    }

    if (
      action ===
      "complete"
    ) {
      if (
        !current.canComplete
      ) {
        return jsonError(
          "The handoff can be completed only after the client explicitly acknowledges receipt of the current issued report.",
          409,
        );
      }

      const completedAt =
        new Date()
          .toISOString();

      const {
        error,
      } =
        await admin
          .from(
            "client_delivery_handoffs",
          )
          .update({
            completed_at:
              completedAt,

            completed_by:
              user.id,

            follow_up_at:
              null,

            updated_by:
              user.id,
          })
          .eq(
            "project_id",
            projectId,
          );

      if (error) {
        throw new Error(
          error.message,
        );
      }

      await recordOperation(
        projectId,
        user.id,
        "handoff_completed",
        {
          completedAt,

          acceptanceId:
            current
              .acceptance
              ?.id ??
            null,

          acceptedAt:
            current
              .acceptance
              ?.acceptedAt ??
            null,
        },
      );
    }

    if (
      action ===
      "reopen"
    ) {
      if (
        !current.canReopen
      ) {
        return jsonError(
          "This handoff is not completed.",
          409,
        );
      }

      const previousCompletedAt =
        current
          .handoff
          .completedAt;

      const {
        error,
      } =
        await admin
          .from(
            "client_delivery_handoffs",
          )
          .update({
            completed_at:
              null,

            completed_by:
              null,

            updated_by:
              user.id,
          })
          .eq(
            "project_id",
            projectId,
          );

      if (error) {
        throw new Error(
          error.message,
        );
      }

      await recordOperation(
        projectId,
        user.id,
        "handoff_reopened",
        {
          previousCompletedAt,
        },
      );
    }

    return Response.json(
      await loadOperations(
        projectId,
      ),
    );
  }
  catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Delivery operation failed.",
      500,
    );
  }
}