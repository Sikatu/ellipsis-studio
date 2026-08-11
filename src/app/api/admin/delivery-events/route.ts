import type {
  NextRequest,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function GET(
  request: NextRequest,
) {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
    );
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

  if (!profile) {
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

  const {
    data: project,
    error:
      projectError,
  } =
    await supabase
      .from(
        "discovery_projects",
      )
      .select(
        "id",
      )
      .eq(
        "id",
        projectId,
      )
      .maybeSingle();

  if (
    projectError ||
    !project
  ) {
    return jsonError(
      "Project not found.",
      404,
    );
  }

  const [
    eventsResult,
    portalViewsResult,
    downloadsResult,
    linkChangesResult,
    totalEventsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "client_delivery_events",
        )
        .select(
          "id,project_id,access_id,event_type,actor_type,actor_admin_id,file_id,report_id,token_version,metadata,occurred_at,created_at",
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
          100,
        ),

      supabase
        .from(
          "client_delivery_events",
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "project_id",
          projectId,
        )
        .eq(
          "event_type",
          "portal_viewed",
        ),

      supabase
        .from(
          "client_delivery_events",
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "project_id",
          projectId,
        )
        .eq(
          "event_type",
          "file_downloaded",
        ),

      supabase
        .from(
          "client_delivery_events",
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "project_id",
          projectId,
        )
        .in(
          "event_type",
          [
            "access_activated",
            "link_rotated",
            "access_revoked",
          ],
        ),

      supabase
        .from(
          "client_delivery_events",
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          },
        )
        .eq(
          "project_id",
          projectId,
        ),
    ]);

  const firstError =
    eventsResult.error ||
    portalViewsResult.error ||
    downloadsResult.error ||
    linkChangesResult.error ||
    totalEventsResult.error;

  if (
    firstError
  ) {
    return jsonError(
      firstError.message,
      500,
    );
  }

  const rows =
    eventsResult.data ??
    [];

  return Response.json(
    {
      events:
        rows,

      stats: {
        portalViews:
          portalViewsResult.count ??
          0,

        downloads:
          downloadsResult.count ??
          0,

        linkChanges:
          linkChangesResult.count ??
          0,

        totalEvents:
          totalEventsResult.count ??
          0,

        lastActivityAt:
          rows[0]
            ?.occurred_at ??
          null,
      },
    },
  );
}