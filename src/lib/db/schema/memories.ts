import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const memories = pgTable("memories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tag: text("tag").notNull().default("对话"), // 对话 | 理念 | 感悟
  isPushed: boolean("is_pushed").notNull().default(false),
  githubSha: text("github_sha"),
  githubPath: text("github_path"),
  commitMessage: text("commit_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
