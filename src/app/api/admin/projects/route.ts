import {
  createAdminClient,
} from "@/lib/supabase/admin";
import {
  appendProjectActivityBestEffort,
} from "@/lib/server/project-activity";
import {
  createClient,
} from "@/lib/supabase/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const statuses =
  new Set([
    "planned",
    "active",
    "on_hold",
    "completed",
    "cancelled",
  ]);

const priorities =
  new Set([
    "low",
    "normal",
    "high",
    "urgent",
  ]);

const currencies =
  new Set([
    "USD",
    "PHP",
    "AUD",
    "CAD",
    "GBP",
    "EUR",
  ]);

type JsonObject =
  Record<
    string,
    unknown
  >;

async function authenticatedAdmin() {
  const supabase =
    await createClient();

  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser();

  if (!user) {
    return null;
  }

  const {
    data:
      profile,
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

function trustedRequestOrigin(
  request: Request,
) {
  const configured =
    (
      process.env
        .ELLIPSIS_PUBLIC_APP_URL ??
      ""
    ).trim();

  const supplied =
    request.headers
      .get(
        "origin",
      )
      ?.trim() ??
    "";

  if (!supplied) {
    return false;
  }

  try {
    const suppliedOrigin =
      new URL(
        supplied,
      ).origin;

    const requestOrigin =
      new URL(
        request.url,
      ).origin;

    const configuredOrigin =
      configured
        ? new URL(
            configured,
          ).origin
        : "";

    return (
      suppliedOrigin ===
        requestOrigin ||
      (
        Boolean(
          configuredOrigin,
        ) &&
        suppliedOrigin ===
          configuredOrigin
      )
    );
  }
  catch {
    return false;
  }
}

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
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "Referrer-Policy":
          "no-referrer",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function text(
  value: unknown,
  maxLength: number,
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .slice(
      0,
      maxLength,
    );
}

function integer(
  value: unknown,
) {
  const parsed =
    Number(
      value,
    );

  return Number.isSafeInteger(
    parsed,
  )
    ? parsed
    : null;
}

function dateValue(
  value: unknown,
) {
  const result =
    text(
      value,
      10,
    );

  if (!result) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      result,
    )
  ) {
    return undefined;
  }

  const [
    year,
    month,
    day,
  ] =
    result
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  if (
    Number.isNaN(
      date.getTime(),
    ) ||
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return undefined;
  }

  return result;
}

export async function POST(
  request: Request,
) {
  const user =
    await authenticatedAdmin();

  if (!user) {
    return jsonError(
      "Unauthorized",
      401,
    );
  }

  if (
    !trustedRequestOrigin(
      request,
    )
  ) {
    return jsonError(
      "Project creation request origin was rejected.",
      403,
    );
  }

  let body:
    JsonObject;

  try {
    const parsed =
      await request.json();

    if (
      !parsed ||
      typeof parsed !==
        "object" ||
      Array.isArray(
        parsed,
      )
    ) {
      throw new Error(
        "Invalid body.",
      );
    }

    body =
      parsed as
        JsonObject;
  }
  catch {
    return jsonError(
      "Invalid project request.",
      400,
    );
  }

  const clientId =
    text(
      body.clientId,
      36,
    );

  const title =
    text(
      body.title,
      240,
    );

  const projectType =
    text(
      body.projectType,
      80,
    ) ||
    "general";

  const description =
    text(
      body.description,
      20000,
    );

  const status =
    text(
      body.status,
      20,
    ) ||
    "planned";

  const priority =
    text(
      body.priority,
      20,
    ) ||
    "normal";

  const startDate =
    dateValue(
      body.startDate,
    );

  const targetDate =
    dateValue(
      body.targetDate,
    );

  const progress =
    integer(
      body.progress ??
        0,
    );

  const currency =
    text(
      body.currency,
      3,
    )
      .toUpperCase() ||
    "USD";

  const internalNotes =
    text(
      body.internalNotes,
      20000,
    );

  const rawBudget =
    body.budgetCents;

  const budgetCents =
    rawBudget ===
      null ||
    rawBudget ===
      undefined ||
    rawBudget ===
      ""
      ? null
      : integer(
          rawBudget,
        );

  if (
    !uuidPattern.test(
      clientId,
    )
  ) {
    return jsonError(
      "Choose a valid client.",
      400,
    );
  }

  if (!title) {
    return jsonError(
      "Project title is required.",
      400,
    );
  }

  if (
    !statuses.has(
      status,
    )
  ) {
    return jsonError(
      "Choose a valid project status.",
      400,
    );
  }

  if (
    !priorities.has(
      priority,
    )
  ) {
    return jsonError(
      "Choose a valid project priority.",
      400,
    );
  }

  if (
    startDate ===
      undefined ||
    targetDate ===
      undefined
  ) {
    return jsonError(
      "Enter valid project dates.",
      400,
    );
  }

  if (
    startDate &&
    targetDate &&
    targetDate <
      startDate
  ) {
    return jsonError(
      "Target date cannot be before the start date.",
      400,
    );
  }

  if (
    progress ===
      null ||
    progress <
      0 ||
    progress >
      100
  ) {
    return jsonError(
      "Project progress must be between 0 and 100.",
      400,
    );
  }

  if (
    !currencies.has(
      currency,
    )
  ) {
    return jsonError(
      "Choose a supported project currency.",
      400,
    );
  }

  if (
    budgetCents !==
      null &&
    (
      budgetCents <
        0 ||
      !Number.isSafeInteger(
        budgetCents,
      )
    )
  ) {
    return jsonError(
      "Enter a valid project budget.",
      400,
    );
  }

  const admin =
    createAdminClient();

  const {
    data:
      client,
    error:
      clientError,
  } =
    await admin
      .from(
        "clients",
      )
      .select(
        "id,brand_name,status",
      )
      .eq(
        "id",
        clientId,
      )
      .eq(
        "created_by",
        user.id,
      )
      .maybeSingle();

  if (
    clientError ||
    !client
  ) {
    return jsonError(
      "Client not found.",
      404,
    );
  }

  if (
    client.status !==
      "active"
  ) {
    return jsonError(
      "Archived clients cannot receive new projects.",
      409,
    );
  }

  const completedAt =
    status ===
      "completed"
      ? new Date()
          .toISOString()
      : null;

  const {
    data:
      project,
    error:
      projectError,
  } =
    await admin
      .from(
        "studio_projects",
      )
      .insert({
        client_id:
          clientId,
        created_by:
          user.id,
        title,
        project_type:
          projectType,
        description,
        status,
        priority,
        start_date:
          startDate,
        target_date:
          targetDate,
        completed_at:
          completedAt,
        progress,
      })
      .select(
        "id,client_id,title,project_type,description,status,priority,start_date,target_date,completed_at,progress,archived_at,created_at,updated_at",
      )
      .single();

  if (
    projectError ||
    !project
  ) {
    return jsonError(
      projectError
        ?.message ??
        "Could not create project.",
      409,
    );
  }

  const {
    error:
      ownerDetailsError,
  } =
    await admin
      .from(
        "studio_project_owner_details",
      )
      .insert({
        project_id:
          project.id,
        created_by:
          user.id,
        budget_cents:
          budgetCents,
        currency,
        internal_notes:
          internalNotes,
      });

  if (
    ownerDetailsError
  ) {
    await admin
      .from(
        "studio_projects",
      )
      .delete()
      .eq(
        "id",
        project.id,
      )
      .eq(
        "created_by",
        user.id,
      );

    return jsonError(
      ownerDetailsError
        .message ||
        "Project financial details could not be created.",
      409,
    );
  }

  await appendProjectActivityBestEffort(
    admin,
    {
      projectId:
        project.id,
      actorUserId:
        user.id,
      actorRole:
        "owner",
      eventType:
        "project_created",
      entityType:
        "project",
      entityId:
        project.id,
      summary:
        `Project created: ${project.title}`,
      metadata: {
        clientId:
          project.client_id,
        status:
          project.status,
        priority:
          project.priority,
      },
    },
  );
  return Response.json(
    {
      project,
      client: {
        id:
          client.id,
        brandName:
          client.brand_name,
      },
    },
    {
      status:
        201,
      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}