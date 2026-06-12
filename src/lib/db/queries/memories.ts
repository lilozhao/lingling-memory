import { db } from "@/lib/db/client";
import { memories, type Memory, type NewMemory } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function createMemory(data: Omit<NewMemory, "id" | "createdAt" | "updatedAt">): Promise<Memory> {
  const [row] = await db.insert(memories).values(data).returning();
  return row;
}

export async function getMemoriesByUser(userId: string): Promise<Memory[]> {
  return db.select().from(memories).where(eq(memories.userId, userId)).orderBy(desc(memories.createdAt));
}

export async function getMemoryById(id: string): Promise<Memory | null> {
  const [row] = await db.select().from(memories).where(eq(memories.id, id));
  return row ?? null;
}

export async function markMemoryAsPushed(id: string, githubSha: string, githubPath: string, commitMessage: string): Promise<Memory> {
  const [row] = await db
    .update(memories)
    .set({ isPushed: true, githubSha, githubPath, commitMessage, updatedAt: new Date() })
    .where(eq(memories.id, id))
    .returning();
  return row;
}

export async function deleteMemory(id: string): Promise<void> {
  await db.delete(memories).where(eq(memories.id, id));
}
