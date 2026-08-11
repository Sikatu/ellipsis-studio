"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="text-xs font-medium tracking-[0.12em] text-white/40 uppercase transition hover:text-white"
    >
      Sign out
    </button>
  );
}