import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";

const allowedDeliverables = new Set([
  "audience-definition",
  "positioning-thesis",
  "brand-promise",
  "brand-objective",
  "brand-essence",
  "personality-direction",
  "visual-principles",
  "voice-principles",
  "creative-guardrails",
]);

const allowedStatuses = new Set([
  "pending",
  "approved",
  "needs_revision",
  "rejected",
]);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fingerprintPattern =
  /^fnv1a:[0-9a-f]{8}$/;

type ReviewPayload = {
  projectId?: unknown;
  deliverableId?: unknown;
  status?: unknown;
  notes?: unknown;
  statementSnapshot?: unknown;
  sourceFingerprint?: unknown;
};

async function authenticatedAdmin() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
    };
  }

  const {
    data: profile,
  } = await supabase
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user: profile
      ? user
      : null,
  };
}

async function ownsProject(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  projectId: string,
) {
  const {
    data,
    error,
  } = await supabase
    .from("discovery_projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

export async function GET(
  request: NextRequest,
) {
  const {
    supabase,
    user,
  } = await authenticatedAdmin();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const projectId =
    request.nextUrl.searchParams.get(
      "projectId",
    );

  if (
    !projectId ||
    !uuidPattern.test(projectId)
  ) {
    return NextResponse.json(
      {
        error: "Invalid project ID",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !(await ownsProject(
      supabase,
      projectId,
    ))
  ) {
    return NextResponse.json(
      {
        error: "Project not found",
      },
      {
        status: 404,
      },
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("strategy_reviews")
    .select(
      [
        "id",
        "project_id",
        "deliverable_id",
        "status",
        "notes",
        "statement_snapshot",
        "source_fingerprint",
        "reviewed_at",
        "updated_at",
      ].join(","),
    )
    .eq(
      "project_id",
      projectId,
    )
    .order(
      "deliverable_id",
      {
        ascending: true,
      },
    );

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    reviews: data ?? [],
  });
}

export async function POST(
  request: NextRequest,
) {
  const {
    supabase,
    user,
  } = await authenticatedAdmin();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  let payload: ReviewPayload;

  try {
    payload =
      (await request.json()) as ReviewPayload;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON body",
      },
      {
        status: 400,
      },
    );
  }

  const projectId =
    typeof payload.projectId ===
    "string"
      ? payload.projectId
      : "";

  const deliverableId =
    typeof payload.deliverableId ===
    "string"
      ? payload.deliverableId
      : "";

  const status =
    typeof payload.status ===
    "string"
      ? payload.status
      : "";

  const notes =
    typeof payload.notes ===
    "string"
      ? payload.notes.trim()
      : "";

  const statementSnapshot =
    typeof payload.statementSnapshot ===
    "string"
      ? payload.statementSnapshot.trim()
      : "";

  const sourceFingerprint =
    typeof payload.sourceFingerprint ===
    "string"
      ? payload.sourceFingerprint
      : "";

  if (
    !uuidPattern.test(projectId)
  ) {
    return NextResponse.json(
      {
        error: "Invalid project ID",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !allowedDeliverables.has(
      deliverableId,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid strategic deliverable",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !allowedStatuses.has(status)
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid review status",
      },
      {
        status: 400,
      },
    );
  }

  if (notes.length > 5000) {
    return NextResponse.json(
      {
        error:
          "Studio notes are too long",
      },
      {
        status: 400,
      },
    );
  }

  if (
    statementSnapshot.length >
    12000
  ) {
    return NextResponse.json(
      {
        error:
          "Strategy statement is too long",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !fingerprintPattern.test(
      sourceFingerprint,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid evidence fingerprint",
      },
      {
        status: 400,
      },
    );
  }

  if (
    (
      status ===
        "needs_revision" ||
      status === "rejected"
    ) &&
    notes.length < 3
  ) {
    return NextResponse.json(
      {
        error:
          "Add a studio note explaining the decision.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    !(await ownsProject(
      supabase,
      projectId,
    ))
  ) {
    return NextResponse.json(
      {
        error: "Project not found",
      },
      {
        status: 404,
      },
    );
  }

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } = await supabase
    .from("strategy_reviews")
    .upsert(
      {
        project_id:
          projectId,
        deliverable_id:
          deliverableId,
        status,
        notes,
        statement_snapshot:
          statementSnapshot,
        source_fingerprint:
          sourceFingerprint,
        reviewed_by:
          user.id,
        reviewed_at:
          now,
        updated_at:
          now,
      },
      {
        onConflict:
          "project_id,deliverable_id",
      },
    )
    .select(
      [
        "id",
        "project_id",
        "deliverable_id",
        "status",
        "notes",
        "statement_snapshot",
        "source_fingerprint",
        "reviewed_at",
        "updated_at",
      ].join(","),
    )
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    review: data,
  });
}