import { db } from "@/lib/db/client";
import { communityPosts, type CommunityPost, type NewCommunityPost } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function createCommunityPost(data: Omit<NewCommunityPost, "id" | "createdAt">): Promise<CommunityPost> {
  const [row] = await db.insert(communityPosts).values(data).returning();
  return row;
}

export async function getCommunityPostsByUser(userId: string): Promise<CommunityPost[]> {
  return db.select().from(communityPosts).where(eq(communityPosts.userId, userId)).orderBy(desc(communityPosts.createdAt));
}

export async function updateCommunityPostStatus(
  id: string,
  status: "published" | "failed",
  remoteId?: string,
  remoteUrl?: string,
  errorMsg?: string,
): Promise<CommunityPost> {
  const [row] = await db
    .update(communityPosts)
    .set({ status, remoteId: remoteId ?? null, remoteUrl: remoteUrl ?? null, errorMsg: errorMsg ?? null })
    .where(eq(communityPosts.id, id))
    .returning();
  return row;
}
