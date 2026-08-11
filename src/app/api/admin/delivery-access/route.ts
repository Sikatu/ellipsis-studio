import type {
  NextRequest,
} from "next/server";

import {
  createDeliveryToken,
  hashDeliveryToken,
} from "@/lib/delivery-portal";

import {
  recordDeliveryEvent,
} from "@/lib/delivery-audit";

import {
  createClient,
} from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AdminContext = {
  supabase:
    Awaited<
      ReturnType<
        typeof createClient
      >
    >;

  user:
    | {
        id: string;
      }
    | null;
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

async function authenticatedAdmin():
  Promise<AdminContext> {
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
    AdminContext["supabase"],
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

async function issuedDeliverableCount(
  supabase:
    AdminContext["supabase"],
  projectId: string,
) {
  const {
    count,
    error,
  } =
    await supabase
      .from(
        "strategy_reports",
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
        "status",
        "issued",
      );

  if (
    error
  ) {
    throw new Error(
      error.message,
    );
  }

  return count ?? 0;
}

async function readAccess(
  supabase:
    AdminContext["supabase"],
  projectId: string,
) {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "client_delivery_access",
      )
      .select(
        "id,project_id,status,token_version,expires_at,last_accessed_at,last_downloaded_at,created_at,rotated_at,revoked_at,updated_at",
      )
      .eq(
        "project_id",
        projectId,
      )
      .maybeSingle();

  if (
    error
  ) {
    throw new Error(
      error.message,
    );
  }

  return data;
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
    const [
      access,
      deliverableCount,
    ] =
      await Promise.all([
        readAccess(
          supabase,
          projectId,
        ),

        issuedDeliverableCount(
          supabase,
          projectId,
        ),
      ]);

    return Response.json(
      {
        access,

        deliverableCount,
      },
    );
  }
  catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Could not load client delivery access.",
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

  const action =
    typeof payload.action ===
      "string"
      ? payload.action
      : "";

  const projectId =
    typeof payload.projectId ===
      "string"
      ? payload.projectId
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
    action !==
      "activate" &&
    action !==
      "rotate" &&
    action !==
      "revoke"
  ) {
    return jsonError(
      "Unsupported delivery access action.",
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

  let existing;

  try {
    existing =
      await readAccess(
        supabase,
        projectId,
      );
  }
  catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Could not load delivery access.",
      500,
    );
  }

  if (
    action ===
    "revoke"
  ) {
    if (
      !existing ||
      existing.status !==
        "active"
    ) {
      return jsonError(
        "Client delivery access is not active.",
        409,
      );
    }

    const {
      data: access,
      error,
    } =
      await supabase
        .from(
          "client_delivery_access",
        )
        .update({
          status:
            "revoked",

          revoked_by:
            user.id,

          revoked_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          existing.id,
        )
        .eq(
          "status",
          "active",
        )
        .select(
          "id,project_id,status,token_version,expires_at,last_accessed_at,last_downloaded_at,created_at,rotated_at,revoked_at,updated_at",
        )
        .single();

    if (
      error ||
      !access
    ) {
      return jsonError(
        error?.message ||
          "Could not revoke client delivery access.",
        409,
      );
    }

    await recordDeliveryEvent({
      projectId,

      accessId:
        access.id,

      eventType:
        "access_revoked",

      actorType:
        "admin",

      actorAdminId:
        user.id,

      tokenVersion:
        access.token_version,
    });

    return Response.json(
      {
        access,
      },
    );
  }

  let deliverableCount:
    number;

  try {
    deliverableCount =
      await issuedDeliverableCount(
        supabase,
        projectId,
      );
  }
  catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Could not verify issued deliverables.",
      500,
    );
  }

  if (
    deliverableCount <
    1
  ) {
    return jsonError(
      "Issue at least one sealed deliverable before activating client delivery.",
      409,
    );
  }

  if (
    action ===
      "activate" &&
    existing?.status ===
      "active"
  ) {
    return jsonError(
      "Client delivery is already active. Rotate the link to replace it.",
      409,
    );
  }

  if (
    action ===
      "rotate" &&
    !existing
  ) {
    return jsonError(
      "Activate client delivery before rotating its link.",
      409,
    );
  }

  const token =
    createDeliveryToken();

  const tokenHash =
    hashDeliveryToken(
      token,
    );

  if (!existing) {
    const {
      data: access,
      error,
    } =
      await supabase
        .from(
          "client_delivery_access",
        )
        .insert({
          project_id:
            projectId,

          token_hash:
            tokenHash,

          status:
            "active",

          created_by:
            user.id,

          rotated_by:
            user.id,
        })
        .select(
          "id,project_id,status,token_version,expires_at,last_accessed_at,last_downloaded_at,created_at,rotated_at,revoked_at,updated_at",
        )
        .single();

    if (
      error ||
      !access
    ) {
      return jsonError(
        error?.message ||
          "Could not activate client delivery.",
        500,
      );
    }

    await recordDeliveryEvent({
      projectId,

      accessId:
        access.id,

      eventType:
        "access_activated",

      actorType:
        "admin",

      actorAdminId:
        user.id,

      tokenVersion:
        access.token_version,

      metadata: {
        deliverableCount,
      },
    });

    return Response.json(
      {
        access,

        token,

        deliverableCount,
      },
      {
        status:
          201,
      },
    );
  }

  const {
    data: access,
    error,
  } =
    await supabase
      .from(
        "client_delivery_access",
      )
      .update({
        token_hash:
          tokenHash,

        status:
          "active",

        rotated_by:
          user.id,

        revoked_by:
          null,

        revoked_at:
          null,
      })
      .eq(
        "id",
        existing.id,
      )
      .select(
        "id,project_id,status,token_version,expires_at,last_accessed_at,last_downloaded_at,created_at,rotated_at,revoked_at,updated_at",
      )
      .single();

  if (
    error ||
    !access
  ) {
    return jsonError(
      error?.message ||
        "Could not rotate client delivery access.",
      409,
    );
  }

  await recordDeliveryEvent({
    projectId,

    accessId:
      access.id,

    eventType:
      "link_rotated",

    actorType:
      "admin",

    actorAdminId:
      user.id,

    tokenVersion:
      access.token_version,

    metadata: {
      deliverableCount,
    },
  });

  return Response.json(
    {
      access,

      token,

      deliverableCount,
    },
  );
}