"use client";
import { Suspense } from "react";
import MemoryDetailScreen from "@/components/screens/MemoryDetailScreen";

export default function MemoryDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-[#0D0D0D]" />}>
      <MemoryDetailScreen />
    </Suspense>
  );
}
