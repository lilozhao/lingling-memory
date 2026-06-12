import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getMemoriesByUser, createMemory, getMemoryById, markMemoryAsPushed } from "@/lib/db/queries/memories";
import { createCommunityPost, updateCommunityPostStatus } from "@/lib/db/queries/community-posts";

const COMMUNITY_URLS: Record<string, string> = {
  zh: "https://csbc.lilozkzy.top/api/posts",
  en: "https://encsbc.lilozkzy.top/api/posts",
};

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO ?? "lilozhao/lingling-memory";

async function githubPushFile(filePath: string, content: string, commitMsg: string): Promise<{ sha: string }> {
  const encoded = Buffer.from(content, "utf-8").toString("base64");
  let sha: string | undefined;
  try {
    const checkRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
    });
    if (checkRes.ok) {
      const data = await checkRes.json();
      sha = data.sha;
    }
  } catch { /* new file */ }

  const body: Record<string, unknown> = { message: commitMsg, content: encoded, branch: "main" };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message ?? "GitHub push failed");
  return { sha: result.commit?.sha ?? "" };
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
      if (!GITHUB_TOKEN) {
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
}
