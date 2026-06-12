import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createMemory, getMemoriesByUser } from "@/lib/db/queries/memories";

export async function GET(request: NextRequest) {
  const result = requireAuth(request);
  if (!result.ok) return result.response;
  const { id: userId } = result.user;
  const list = await getMemoriesByUser(userId);
  return NextResponse.json({ memories: list });
}

export async function POST(request: NextRequest) {
  const result = requireAuth(request);
  if (!result.ok) return result.response;
  const { id: userId } = result.user;
  const body = await request.json();
  const { title, content, tag } = body;
  if (!title || !content) {
    return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 });
  }
  const memory = await createMemory({ userId, title, content, tag: tag ?? "对话" });
  return NextResponse.json({ memory }, { status: 201 });
}
