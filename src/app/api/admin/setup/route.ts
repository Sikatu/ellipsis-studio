import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_SETUP_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

function isOwnerSetupAllowed(
  request: Request,
) {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return false;
  }

  try {
    const hostname =
      new URL(
        request.url,
      ).hostname;

    return LOCAL_SETUP_HOSTS.has(
      hostname,
    );
  }
  catch {
    return false;
  }
}

function setupUnavailable() {
  return NextResponse.json(
    {
      error:
        "Owner setup is unavailable in this environment.",
    },
    {
      status:
        404,
    },
  );
}

export async function GET(
  request: Request,
) {
  if (
    !isOwnerSetupAllowed(
      request,
    )
  ) {
    return NextResponse.json({
      available:
        false,
    });
  }

  const supabase =
    createAdminClient();

  const {
    count,
    error,
  } =
    await supabase
      .from(
        "admin_profiles",
      )
      .select(
        "user_id",
        {
          count:
            "exact",
          head:
            true,
        },
      );

  if (error) {
    return NextResponse.json(
      {
        error:
          "Unable to check administrator setup.",
      },
      {
        status:
          500,
      },
    );
  }

  return NextResponse.json({
    available:
      (count ?? 0) ===
      0,
  });
}

export async function POST(
  request: Request,
) {
  if (
    !isOwnerSetupAllowed(
      request,
    )
  ) {
    return setupUnavailable();
  }

  const supabase =
    createAdminClient();

  const {
    count,
    error:
      countError,
  } =
    await supabase
      .from(
        "admin_profiles",
      )
      .select(
        "user_id",
        {
          count:
            "exact",
          head:
            true,
        },
      );

  if (countError) {
    return NextResponse.json(
      {
        error:
          "Unable to verify setup status.",
      },
      {
        status:
          500,
      },
    );
  }

  if (
    (count ?? 0) >
    0
  ) {
    return NextResponse.json(
      {
        error:
          "Owner setup is already complete. This endpoint is locked.",
      },
      {
        status:
          409,
      },
    );
  }

  let body: {
    displayName?:
      string;
    email?:
      string;
    password?:
      string;
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
        status:
          400,
      },
    );
  }

  const displayName =
    body.displayName
      ?.trim() ||
    "ELLIPSIS Owner";

  const email =
    body.email
      ?.trim()
      .toLowerCase();

  const password =
    body.password ??
    "";

  if (!email) {
    return NextResponse.json(
      {
        error:
          "Email is required.",
      },
      {
        status:
          400,
      },
    );
  }

  if (
    password.length <
    12
  ) {
    return NextResponse.json(
      {
        error:
          "Use a password containing at least 12 characters.",
      },
      {
        status:
          400,
      },
    );
  }

  const {
    data,
    error:
      createError,
  } =
    await supabase.auth.admin
      .createUser({
        email,
        password,
        email_confirm:
          true,
        app_metadata: {
          role:
            "owner",
        },
      });

  if (
    createError ||
    !data.user
  ) {
    return NextResponse.json(
      {
        error:
          createError
            ?.message ??
          "Unable to create owner account.",
      },
      {
        status:
          400,
      },
    );
  }

  const {
    error:
      profileError,
  } =
    await supabase
      .from(
        "admin_profiles",
      )
      .insert({
        user_id:
          data.user.id,
        display_name:
          displayName,
        role:
          "owner",
      });

  if (
    profileError
  ) {
    await supabase.auth.admin
      .deleteUser(
        data.user.id,
      );

    return NextResponse.json(
      {
        error:
          "Owner profile creation failed. The Auth user was rolled back.",
      },
      {
        status:
          500,
      },
    );
  }

  return NextResponse.json({
    success:
      true,
  });
}