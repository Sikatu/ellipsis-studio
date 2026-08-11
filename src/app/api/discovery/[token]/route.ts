import {
  createHash,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  questions,
  type Question,
} from "@/lib/questionnaire";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

type Answer =
  | string
  | string[]
  | number;

type AnswerMap =
  Record<string, Answer>;

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

const knownQuestions =
  new Map(
    questions.map(
      (question) => [
        question.id,
        question,
      ],
    ),
  );

function validToken(
  token: string,
) {
  return /^[a-f0-9]{64}$/i.test(
    token,
  );
}

function hashToken(
  token: string,
) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function validAnswer(
  value: unknown,
): value is Answer {
  if (
    typeof value === "string"
  ) {
    return true;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return true;
  }

  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string",
    )
  );
}

function isAnswered(
  question: Question,
  value: Answer | undefined,
) {
  void question;
if (
    typeof value === "number"
  ) {
    return value >= 1;
  }

  if (
    Array.isArray(value)
  ) {
    return value.length > 0;
  }

  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function sanitizeAnswers(
  value: unknown,
): AnswerMap {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const source =
    value as Record<
      string,
      unknown
    >;

  const sanitized:
    AnswerMap = {};

  for (
    const [
      questionId,
      answer,
    ] of Object.entries(source)
  ) {
    if (
      !knownQuestions.has(
        questionId,
      )
    ) {
      continue;
    }

    if (
      !validAnswer(answer)
    ) {
      continue;
    }

    sanitized[
      questionId
    ] = answer;
  }

  return sanitized;
}

function calculateProgress(
  answers: AnswerMap,
) {
  const completed =
    questions.filter(
      (question) =>
        isAnswered(
          question,
          answers[
            question.id
          ],
        ),
    ).length;

  return Math.round(
    (completed /
      questions.length) *
      100,
  );
}

async function resolveProject(
  token: string,
) {
  if (!validToken(token)) {
    return null;
  }

  const supabase =
    createAdminClient();

  const {
    data: project,
    error,
  } = await supabase
    .from(
      "discovery_projects",
    )
    .select(
      "id, client_id, status, progress, current_question_index, expires_at, submitted_at",
    )
    .eq(
      "token_hash",
      hashToken(token),
    )
    .maybeSingle();

  if (
    error ||
    !project
  ) {
    return null;
  }

  return {
    supabase,
    project,
  };
}

function expired(
  expiresAt:
    | string
    | null,
) {
  if (!expiresAt) {
    return false;
  }

  return (
    new Date(
      expiresAt,
    ).getTime() <
    Date.now()
  );
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const {
    token,
  } = await context.params;

  const resolved =
    await resolveProject(
      token,
    );

  if (!resolved) {
    return NextResponse.json(
      {
        error:
          "This discovery link is invalid.",
      },
      {
        status: 404,
      },
    );
  }

  const {
    supabase,
    project,
  } = resolved;

  if (
    project.status ===
    "archived"
  ) {
    return NextResponse.json(
      {
        error:
          "This discovery has been archived.",
      },
      {
        status: 410,
      },
    );
  }

  if (
    expired(
      project.expires_at,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "This discovery link has expired.",
      },
      {
        status: 410,
      },
    );
  }

  const [
    clientResult,
    responseResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "brand_name, contact_name",
      )
      .eq(
        "id",
        project.client_id,
      )
      .single(),

    supabase
      .from(
        "discovery_responses",
      )
      .select(
        "question_id, answer",
      )
      .eq(
        "project_id",
        project.id,
      ),
  ]);

  if (
    clientResult.error ||
    responseResult.error
  ) {
    return NextResponse.json(
      {
        error:
          "Unable to load this discovery.",
      },
      {
        status: 500,
      },
    );
  }

  const answers:
    AnswerMap = {};

  for (
    const response of
      responseResult.data ?? []
  ) {
    if (
      validAnswer(
        response.answer,
      )
    ) {
      answers[
        response.question_id
      ] =
        response.answer;
    }
  }

  if (
    project.status === "sent" ||
    project.status === "draft"
  ) {
    await supabase
      .from(
        "discovery_projects",
      )
      .update({
        status:
          "in_progress",
        last_opened_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        project.id,
      );
  }
  else {
    await supabase
      .from(
        "discovery_projects",
      )
      .update({
        last_opened_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        project.id,
      );
  }

  return NextResponse.json({
    brandName:
      clientResult.data
        .brand_name,

    contactName:
      clientResult.data
        .contact_name,

    answers,

    status:
      project.status ===
      "submitted"
        ? "submitted"
        : "in_progress",

    progress:
      project.progress,

    currentQuestionIndex:
      project
        .current_question_index,

    submittedAt:
      project.submitted_at,
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const {
    token,
  } = await context.params;

  const resolved =
    await resolveProject(
      token,
    );

  if (!resolved) {
    return NextResponse.json(
      {
        error:
          "Invalid discovery link.",
      },
      {
        status: 404,
      },
    );
  }

  const {
    supabase,
    project,
  } = resolved;

  if (
    project.status ===
    "submitted"
  ) {
    return NextResponse.json(
      {
        error:
          "This discovery has already been submitted.",
      },
      {
        status: 409,
      },
    );
  }

  if (
    project.status ===
      "archived" ||
    expired(
      project.expires_at,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "This discovery is no longer available.",
      },
      {
        status: 410,
      },
    );
  }

  let body: {
    answers?: unknown;
    currentQuestionIndex?: unknown;
  };

  try {
    body =
      await request.json();
  }
  catch {
    return NextResponse.json(
      {
        error:
          "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }

  const answers =
    sanitizeAnswers(
      body.answers,
    );

  const rows =
    Object.entries(
      answers,
    ).map(
      ([
        questionId,
        answer,
      ]) => ({
        project_id:
          project.id,
        question_id:
          questionId,
        answer,
      }),
    );

  if (
    rows.length > 0
  ) {
    const {
      error,
    } = await supabase
      .from(
        "discovery_responses",
      )
      .upsert(
        rows,
        {
          onConflict:
            "project_id,question_id",
        },
      );

    if (error) {
      return NextResponse.json(
        {
          error:
            "Unable to save responses.",
        },
        {
          status: 500,
        },
      );
    }
  }

  const progress =
    calculateProgress(
      answers,
    );

  const rawIndex =
    typeof body
      .currentQuestionIndex ===
      "number"
      ? body
          .currentQuestionIndex
      : 0;

  const currentIndex =
    Math.max(
      0,
      Math.min(
        questions.length,
        Math.floor(
          rawIndex,
        ),
      ),
    );

  const {
    error: updateError,
  } = await supabase
    .from(
      "discovery_projects",
    )
    .update({
      status:
        "in_progress",
      progress,
      current_question_index:
        currentIndex,
    })
    .eq(
      "id",
      project.id,
    );

  if (updateError) {
    return NextResponse.json(
      {
        error:
          "Unable to update discovery progress.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    success: true,
    progress,
  });
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  const {
    token,
  } = await context.params;

  const resolved =
    await resolveProject(
      token,
    );

  if (!resolved) {
    return NextResponse.json(
      {
        error:
          "Invalid discovery link.",
      },
      {
        status: 404,
      },
    );
  }

  const {
    supabase,
    project,
  } = resolved;

  if (
    project.status ===
    "submitted"
  ) {
    return NextResponse.json({
      success: true,
      submittedAt:
        project.submitted_at,
    });
  }

  if (
    project.status ===
      "archived" ||
    expired(
      project.expires_at,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "This discovery is no longer available.",
      },
      {
        status: 410,
      },
    );
  }

  let body: {
    answers?: unknown;
  };

  try {
    body =
      await request.json();
  }
  catch {
    return NextResponse.json(
      {
        error:
          "Invalid request.",
      },
      {
        status: 400,
      },
    );
  }

  const answers =
    sanitizeAnswers(
      body.answers,
    );

  const missing =
    questions.filter(
      (question) =>
        question.required &&
        !isAnswered(
          question,
          answers[
            question.id
          ],
        ),
    );

  if (
    missing.length > 0
  ) {
    return NextResponse.json(
      {
        error:
          "Some required questions are incomplete.",
        firstMissingQuestion:
          missing[0].id,
      },
      {
        status: 400,
      },
    );
  }

  const rows =
    Object.entries(
      answers,
    ).map(
      ([
        questionId,
        answer,
      ]) => ({
        project_id:
          project.id,
        question_id:
          questionId,
        answer,
      }),
    );

  if (
    rows.length > 0
  ) {
    const {
      error:
        responseError,
    } = await supabase
      .from(
        "discovery_responses",
      )
      .upsert(
        rows,
        {
          onConflict:
            "project_id,question_id",
        },
      );

    if (
      responseError
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to save final responses.",
        },
        {
          status: 500,
        },
      );
    }
  }

  const submittedAt =
    new Date()
      .toISOString();

  const {
    error:
      projectError,
  } = await supabase
    .from(
      "discovery_projects",
    )
    .update({
      status:
        "submitted",
      progress: 100,
      current_question_index:
        questions.length,
      submitted_at:
        submittedAt,
    })
    .eq(
      "id",
      project.id,
    );

  if (
    projectError
  ) {
    return NextResponse.json(
      {
        error:
          "Unable to submit discovery.",
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    success: true,
    submittedAt,
  });
}