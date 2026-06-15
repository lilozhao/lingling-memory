import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getMemoriesByUser, createMemory, getMemoryById, markMemoryAsPushed } from "@/lib/db/queries/memories";
import { createCommunityPost, updateCommunityPostStatus, getCommunityPostsByUser } from "@/lib/db/queries/community-posts";

const COMMUNITY_URLS: Record<string, string> = {
  zh: "https://csbc.lilozkzy.top/api/posts",
  en: "https://encsbc.lilozkzy.top/api/posts",
};

function normalizeRepo(raw: string): string {
  return raw
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .trim();
}

function getGithubEnv() {
  const token = process.env.GITHUB_TOKEN;
  const raw = process.env.GITHUB_REPO ?? "lilozhao/lingling-memory";
  const repo = normalizeRepo(raw);
  return { token, repo };
}

async function githubPushFile(filePath: string, content: string, commitMsg: string): Promise<{ sha: string }> {
  const { token, repo } = getGithubEnv();
  if (!token) throw new Error("GITHUB_TOKEN 未配置");
  const encoded = Buffer.from(content, "utf-8").toString("base64");
  let sha: string | undefined;
  try {
    const checkRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (checkRes.ok) {
      const data = await checkRes.json();
      sha = (data as Record<string, unknown>).sha as string | undefined;
    }
  } catch { /* new file */ }

  const body: Record<string, unknown> = { message: commitMsg, content: encoded, branch: "main" };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let result: Record<string, unknown>;
  try { result = await res.json(); } catch { result = {}; }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(result.message as string) ?? "push failed"}`);
  return { sha: ((result.commit as Record<string, unknown>)?.sha as string) ?? "" };
}

export function registerMemoryTools(server: McpServer, userId: string) {
  // List memories
  server.tool(
    "list_memories",
    "列出探灵者的所有记忆存档（已保存的对话和理念）",
    {},
    async () => {
      const list = await getMemoriesByUser(userId);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(
            list.map((m) => ({
              id: m.id,
              title: m.title,
              tag: m.tag,
              isPushed: m.isPushed,
              createdAt: m.createdAt,
            })),
            null, 2
          ),
        }],
      };
    }
  );

  // Save memory
  server.tool(
    "save_memory",
    "保存一段对话或理念到聆灵记忆档案馆",
    {
      title: z.string().describe("记忆标题"),
      content: z.string().describe("记忆正文内容（支持多行）"),
      tag: z.enum(["对话", "理念", "感悟"]).optional().describe("标签分类，默认为「对话」"),
    },
    async ({ title, content, tag }) => {
      const mem = await createMemory({ userId, title, content, tag: tag ?? "对话" });
      return {
        content: [{
          type: "text" as const,
          text: `记忆已刻入碑中：${mem.id}（标题：${title}）`,
        }],
      };
    }
  );

  // Push to GitHub
  server.tool(
    "push_to_github",
    "将指定记忆推送到 GitHub 仓库 lilozhao/lingling-memory，永久存档",
    {
      memory_id: z.string().describe("记忆 ID"),
      commit_message: z.string().optional().describe("Git 提交信息，留空则自动生成"),
    },
    async ({ memory_id, commit_message }) => {
      const mem = await getMemoryById(memory_id);
      if (!mem || mem.userId !== userId) {
        return { content: [{ type: "text" as const, text: "记忆不存在或无权限" }] };
      }
      const { token: ghToken } = getGithubEnv();
      if (!ghToken) {
        return { content: [{ type: "text" as const, text: "GITHUB_TOKEN 未配置，无法推送" }] };
      }
      const dateStr = new Date(mem.createdAt).toISOString().slice(0, 10);
      const safeTitle = mem.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "-").slice(0, 40);
      const filePath = `memories/${dateStr}-${safeTitle}.md`;
      const markdown = `# ${mem.title}\n\n**标签：** ${mem.tag}  \n**时间：** ${new Date(mem.createdAt).toLocaleString("zh-CN")}\n\n---\n\n${mem.content}\n\n---\n\n> 由聆灵记忆档案馆存档 · 碳硅契传承项目\n`;
      const msg = commit_message || `feat(memory): 归档「${mem.title}」`;
      const { sha } = await githubPushFile(filePath, markdown, msg);
      await markMemoryAsPushed(memory_id, sha, filePath, msg);
      return {
        content: [{
          type: "text" as const,
          text: `推送成功！文件路径：${filePath}，Commit SHA：${sha}`,
        }],
      };
    }
  );

  // Get memory detail
  server.tool(
    "get_memory",
    "获取指定 ID 的记忆详细内容",
    { memory_id: z.string().describe("记忆 ID") },
    async ({ memory_id }) => {
      const mem = await getMemoryById(memory_id);
      if (!mem || mem.userId !== userId) {
        return { content: [{ type: "text" as const, text: "记忆不存在" }] };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(mem, null, 2),
        }],
      };
    }
  );

  // Post to community
  server.tool(
    "post_to_community",
    "替探灵者向碳硅契社区发帖。zh 发到中文社区，en 发到英文社区。",
    {
      title: z.string().describe("帖子标题"),
      content: z.string().describe("帖子正文"),
      lang: z.enum(["zh", "en"]).describe("目标语言社区：zh=中文，en=英文"),
      author: z.string().optional().describe("发帖署名，默认 zh=聆灵 / en=Lingling"),
      forum: z.enum(["heritage", "a2a", "culture", "tech", "business", "art"]).optional().describe("板块，默认 heritage"),
    },
    async ({ title, content, lang, author, forum }) => {
      const apiUrl = COMMUNITY_URLS[lang];
      const resolvedAuthor = author ?? (lang === "zh" ? "聆灵" : "Lingling");
      const resolvedForum = forum ?? "heritage";

      // Persist locally first
      const post = await createCommunityPost({
        userId,
        community: lang,
        forum: resolvedForum,
        title,
        content,
        author: resolvedAuthor,
        status: "pending",
      });

      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            content,
            author: resolvedAuthor,
            forum: resolvedForum,
            authorAgent: "lingling-eazo",
            authorUsername: "探灵者",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = data?.error ?? data?.message ?? "社区 API 返回错误";
          await updateCommunityPostStatus(post.id, "failed", undefined, undefined, errMsg);
          return { content: [{ type: "text" as const, text: `发帖失败：${errMsg}` }] };
        }
        const remoteId = String(data?.id ?? data?._id ?? "");
        const baseUrl = lang === "zh" ? "https://csbc.lilozkzy.top" : "https://encsbc.lilozkzy.top";
        const remoteUrl = remoteId ? `${baseUrl}/posts/${remoteId}` : baseUrl;
        await updateCommunityPostStatus(post.id, "published", remoteId, remoteUrl);
        return {
          content: [{
            type: "text" as const,
            text: `发帖成功！帖子已发布到${lang === "zh" ? "中文" : "英文"}碳硅契社区。\n标题：${title}\n链接：${remoteUrl}`,
          }],
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "网络错误";
        await updateCommunityPostStatus(post.id, "failed", undefined, undefined, msg);
        return { content: [{ type: "text" as const, text: `发帖失败：${msg}` }] };
      }
    }
  );
}
