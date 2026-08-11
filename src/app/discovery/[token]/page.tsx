"use client";

import { useParams } from "next/navigation";
import DiscoveryFlow from "@/components/discovery/DiscoveryFlow";

export default function DiscoveryPage() {
  const params = useParams<{ token: string }>();
  const rawToken = params?.token;

  const token = Array.isArray(rawToken)
    ? rawToken[0]
    : rawToken || "demo";

  return <DiscoveryFlow token={token} />;
}