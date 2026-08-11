"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function AdminRealtimeRefresh() {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      refreshTimer.current = setTimeout(() => {
        router.refresh();
      }, 250);
    };

    const channel = supabase
      .channel("admin-discovery-project-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "discovery_projects",
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}