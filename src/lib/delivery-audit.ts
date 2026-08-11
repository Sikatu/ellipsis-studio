import "server-only";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export type DeliveryAuditEventType =
  | "access_activated"
  | "link_rotated"
  | "access_revoked"
  | "portal_viewed"
  | "file_downloaded";

export type DeliveryAuditActorType =
  | "admin"
  | "client"
  | "system";

export async function recordDeliveryEvent({
  projectId,
  accessId,
  eventType,
  actorType,
  actorAdminId = null,
  fileId = null,
  reportId = null,
  tokenVersion = null,
  metadata = {},
  dedupeWindowMs = 0,
}: {
  projectId: string;

  accessId: string;

  eventType:
    DeliveryAuditEventType;

  actorType:
    DeliveryAuditActorType;

  actorAdminId?:
    string | null;

  fileId?:
    string | null;

  reportId?:
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
      data:
        recent,
      error:
        recentError,
    } =
      await admin
        .from(
          "client_delivery_events",
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

    if (
      recentError
    ) {
      console.error(
        "Delivery audit dedupe check failed:",
        recentError,
      );
    }
    else if (
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
        "client_delivery_events",
      )
      .insert({
        project_id:
          projectId,

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

        file_id:
          fileId,

        report_id:
          reportId,

        token_version:
          tokenVersion,

        metadata,
      });

  if (
    error
  ) {
    console.error(
      "Delivery audit event write failed:",
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