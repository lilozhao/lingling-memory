import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const communityPosts = pgTable("community_posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  community: text("community").notNull(), // "zh" | "en"
  forum: text("forum").notNull().default("heritage"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull().default("聆灵"),
  remoteId: text("remote_id"),        // id returned by community API
  remoteUrl: text("remote_url"),      // link to the post
  status: text("status").notNull().default("pending"), // "pending"|"published"|"failed"
  errorMsg: text("error_msg"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CommunityPost = typeof communityPosts.$inferSelect;
export type NewCommunityPost = typeof communityPosts.$inferInsert;
