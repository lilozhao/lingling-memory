import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMemoryById, deleteMemory } from "@/lib/db/queries/memories";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireAuth(request);
  if (!result.ok) return result.response;
  const { id: userId } = result.user;
  const { id } = await params;
  const memory = await getMemoryById(id);
  if (!memory || memory.userId !== userId) {
    return NextResponse.json({ error: "记忆不存在" }, { status: 404 });
  }
  return NextResponse.json({ memory });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireAuth(request);
  if (!result.ok) return result.response;
  const { id: userId } = result.user;
  const { id } = await params;
  const memory = await getMemoryById(id);
  if (!memory || memory.userId !== userId) {
    return NextResponse.json({ error: "记忆不存在" }, { status: 404 });
  }
  await deleteMemory(id);
  return NextResponse.json({ ok: true });
}
