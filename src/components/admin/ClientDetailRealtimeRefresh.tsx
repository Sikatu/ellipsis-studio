"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function ClientDetailRealtimeRefresh({
  projectId,
}: {
  projectId: string | null;
}) {
  const router = useRouter();

  const refreshTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId) {
      return;
    }

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
      .channel(`admin-client-project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "discovery_projects",
          filter: `id=eq.${projectId}`,
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
  }, [projectId, router]);

  return null;
}