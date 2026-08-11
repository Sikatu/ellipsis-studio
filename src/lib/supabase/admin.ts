import "server-only";

import {
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";

export function createAdminClient() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const secret =
    process.env
      .SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured.",
    );
  }

  if (!secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not configured.",
    );
  }

  return createSupabaseClient(
    url,
    secret,
    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,

        detectSessionInUrl:
          false,
      },
    },
  );
}