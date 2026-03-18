"use client";

import { useRouter } from "next/navigation";

import type { IncidentStatus } from "@dw/contracts";

import { ResolveButton } from "./resolve-button";

export function ResolveButtonWithRefresh({
  incidentId,
  currentStatus,
}: {
  incidentId: string;
  currentStatus: IncidentStatus;
}) {
  const router = useRouter();
  return (
    <ResolveButton
      incidentId={incidentId}
      currentStatus={currentStatus}
      onResolved={() => router.refresh()}
    />
  );
}
