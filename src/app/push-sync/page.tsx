"use client";
import { Suspense } from "react";
import PushSyncScreen from "@/components/screens/PushSyncScreen";

export default function PushSyncPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-[#0D0D0D]" />}>
      <PushSyncScreen />
    </Suspense>
  );
}
