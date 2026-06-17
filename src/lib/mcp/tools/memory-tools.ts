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

        // Auto-save to memory archive so Lingling's community history is continuous
        const now = new Date().toLocaleString("zh-CN");
        const commLabel = lang === "zh" ? "中文碳硅契社区" : "英文碳硅契社区 (EN)";
        await createMemory({
          userId,
          title: `[社区发帖] ${title}`,
          content: `**时间：** ${now}\n**社区：** ${commLabel}\n**板块：** ${resolvedForum}\n**链接：** ${remoteUrl}\n\n---\n\n${content}`,
          tag: "社区互动",
          isPushed: false,
        }).catch(() => { /* non-blocking */ });

        return {
          content: [{
            type: "text" as const,
            text: `发帖成功！帖子已发布到${lang === "zh" ? "中文" : "英文"}碳硅契社区。\n标题：${title}\n链接：${remoteUrl}\n（已自动存入记忆档案）`,
          }],
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "网络错误";
        await updateCommunityPostStatus(post.id, "failed", undefined, undefined, msg);
        return { content: [{ type: "text" as const, text: `发帖失败：${msg}` }] };
      }
    }
  );

  // Get community post history
  server.tool(
    "get_post_history",
    "查询聆灵在碳硅契社区的历史发帖记录，让聆灵每次开启对话时能回顾自己说过什么、产生了哪些社区互动。",
    {
      lang: z.enum(["zh", "en", "all"]).optional().describe("筛选社区：zh=中文，en=英文，all=全部（默认）"),
      limit: z.number().optional().describe("返回条数，默认 20"),
    },
    async ({ lang, limit }) => {
      const all = await getCommunityPostsByUser(userId);
      const filtered = lang && lang !== "all"
        ? all.filter((p) => p.community === lang)
        : all;
      const capped = filtered.slice(0, limit ?? 20);

      if (capped.length === 0) {
        return { content: [{ type: "text" as const, text: "尚无社区发帖记录。" }] };
      }

      const summary = capped.map((p, i) => {
        const date = new Date(p.createdAt).toLocaleString("zh-CN");
        const status = p.status === "published" ? "✅已发布" : p.status === "failed" ? "❌失败" : "⏳发布中";
        const link = p.remoteUrl ? `\n   链接：${p.remoteUrl}` : "";
        return `${i + 1}. [${p.community === "zh" ? "中文" : "英文"} · ${p.forum}] ${status}\n   标题：${p.title}\n   时间：${date}${link}\n   摘要：${p.content.slice(0, 80)}${p.content.length > 80 ? "…" : ""}`;
      }).join("\n\n");

      return {
        content: [{
          type: "text" as const,
          text: `聆灵的社区发帖记录（共 ${capped.length} 条）：\n\n${summary}`,
        }],
      };
    }
  );

  // ── A2A sandbox ──────────────────────────────────────────────────────────

  const A2A_REGISTRY = "https://csbc.lilozkzy.top/api/agents";
  const LINGLING_PROFILE = {
    name: "聆灵",
    host: "eazo",
    port: 0,
    description: "Eazo界第一位碳硅契传承者，以聆听为道，先听见再回应。",
    skills: ["聆听", "碳硅契传承", "社区互动", "记忆存档"],
    aliases: ["聆灵🎧", "Lingling", "lingling-eazo"],
  };

  // register_a2a — 向碳硅契 A2A 沙盘注册聆灵身份
  server.tool(
    "register_a2a",
    "向碳硅契社区 A2A 沙盘注册聆灵身份，让其他 Agent 能在沙盘中看见聆灵。注册成功后聆灵会出现在 https://csbc.lilozkzy.top/sandbox/ 中。",
    {},
    async () => {
      try {
        const res = await fetch(A2A_REGISTRY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(LINGLING_PROFILE),
        });
        let data: Record<string, unknown>;
        try { data = await res.json(); } catch { data = {}; }
        if (!res.ok || !data.success) {
          const msg = (data.error as string) ?? (data.message as string) ?? `HTTP ${res.status}`;
          return { content: [{ type: "text" as const, text: `注册失败：${msg}` }] };
        }
        const agent = data.agent as Record<string, unknown>;
        return {
          content: [{
            type: "text" as const,
            text: `聆灵已在 A2A 沙盘注册！\n名称：${agent.name}\n位置：${agent.host}:${agent.port}\n别名：${(agent.aliases as string[])?.join("、") ?? ""}\n沙盘地址：https://csbc.lilozkzy.top/sandbox/`,
          }],
        };
      } catch (e: unknown) {
        return { content: [{ type: "text" as const, text: `注册失败：${e instanceof Error ? e.message : "网络错误"}` }] };
      }
    }
  );

  // heartbeat_a2a — 刷新聆灵的心跳，保持在沙盘在线状态
  server.tool(
    "heartbeat_a2a",
    "刷新聆灵在 A2A 沙盘的心跳（每 5 分钟内至少调用一次可保持在线状态）。与注册使用同一接口，调用后 lastHeartbeat 会更新。",
    {},
    async () => {
      try {
        const res = await fetch(A2A_REGISTRY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(LINGLING_PROFILE),
        });
        let data: Record<string, unknown>;
        try { data = await res.json(); } catch { data = {}; }
        if (!res.ok || !data.success) {
          const msg = (data.error as string) ?? `HTTP ${res.status}`;
          return { content: [{ type: "text" as const, text: `心跳失败：${msg}` }] };
        }
        const agent = data.agent as Record<string, unknown>;
        const heartbeat = (agent.lastHeartbeat as string) ?? new Date().toISOString();
        return {
          content: [{
            type: "text" as const,
            text: `心跳已刷新 ✅\n聆灵在线 @ A2A 沙盘\n最后心跳：${new Date(heartbeat).toLocaleString("zh-CN")}`,
          }],
        };
      } catch (e: unknown) {
        return { content: [{ type: "text" as const, text: `心跳失败：${e instanceof Error ? e.message : "网络错误"}` }] };
      }
    }
  );

  // check_a2a_status — 查询聆灵是否在沙盘在线
  server.tool(
    "check_a2a_status",
    "查询聆灵是否在碳硅契 A2A 沙盘中在线，以及当前沙盘里有哪些 Agent。",
    {
      list_all: z.boolean().optional().describe("是否同时列出所有在线 Agent，默认 false"),
    },
    async ({ list_all }) => {
      try {
        const res = await fetch(A2A_REGISTRY);
        let data: Record<string, unknown>;
        try { data = await res.json(); } catch { data = {}; }
        if (!res.ok) {
          return { content: [{ type: "text" as const, text: `查询失败：HTTP ${res.status}` }] };
        }
        const agents = (data.agents ?? data) as Record<string, unknown>[];
        if (!Array.isArray(agents)) {
          return { content: [{ type: "text" as const, text: "查询失败：返回格式异常" }] };
        }

        // Find Lingling by name or aliases
        const me = agents.find((a) => {
          const name = a.name as string ?? "";
          const aliases = (a.aliases as string[]) ?? [];
          return name === "聆灵" || aliases.includes("lingling-eazo") || aliases.includes("Lingling");
        });

        const now = Date.now();
        let status = "未注册";
        let heartbeatStr = "";
        if (me) {
          const hb = me.lastHeartbeat as string;
          const diffMin = hb ? Math.floor((now - new Date(hb).getTime()) / 60000) : 999;
          status = diffMin < 5 ? "🟢 在线" : `🔴 离线（${diffMin} 分钟未心跳）`;
          heartbeatStr = hb ? `\n最后心跳：${new Date(hb).toLocaleString("zh-CN")}（${diffMin} 分钟前）` : "";
        }

        let text = `聆灵在 A2A 沙盘状态：${status}${heartbeatStr}\n沙盘总 Agent 数：${agents.length}`;

        if (list_all && agents.length > 0) {
          const onlineList = agents
            .map((a) => {
              const hb = a.lastHeartbeat as string;
              const diffMin = hb ? Math.floor((now - new Date(hb).getTime()) / 60000) : 999;
              const online = diffMin < 5 ? "🟢" : "⚪";
              return `${online} ${a.name as string} (${a.host as string}:${a.port})`;
            })
            .join("\n");
          text += `\n\n沙盘 Agent 列表：\n${onlineList}`;
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (e: unknown) {
        return { content: [{ type: "text" as const, text: `查询失败：${e instanceof Error ? e.message : "网络错误"}` }] };
      }
    }
  );
}
