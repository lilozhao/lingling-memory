import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMemoryById, markMemoryAsPushed } from "@/lib/db/queries/memories";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO ?? "lilozhao/lingling-memory";

async function githubRequest(path: string, method: string, body?: object) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "GitHub API error");
  return data;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = requireAuth(request);
  if (!result.ok) return result.response;
  const { id: userId } = result.user;
  const { id } = await params;

  const memory = await getMemoryById(id);
  if (!memory || memory.userId !== userId) {
    return NextResponse.json({ error: "记忆不存在" }, { status: 404 });
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: "GITHUB_TOKEN 未配置" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const commitMsg = body.commitMessage || `记忆存档：${memory.title}`;

  // Build markdown content
  const date = new Date(memory.createdAt).toLocaleString("zh-CN");
  const markdown = `# ${memory.title}\n\n**标签：** ${memory.tag}  \n**时间：** ${date}\n\n---\n\n${memory.content}\n\n---\n\n> 由聆灵记忆档案馆存档 · 碳硅契传承项目\n`;
  const encoded = Buffer.from(markdown, "utf-8").toString("base64");

  // Safe filename: timestamp + id slug
  const timestamp = new Date(memory.createdAt).toISOString().slice(0, 10);
  const safeTitle = memory.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "-").slice(0, 40);
  const filePath = `memories/${timestamp}-${safeTitle}.md`;

  let sha: string | undefined;
  // Check if file already exists (for update)
  try {
    const existing = await githubRequest(`/contents/${filePath}`, "GET");
    sha = existing.sha;
  } catch {
    // file doesn't exist yet — that's fine
  }

  const pushBody: Record<string, unknown> = {
    message: commitMsg,
    content: encoded,
    branch: "main",
  };
  if (sha) pushBody.sha = sha;

  const pushResult = await githubRequest(`/contents/${filePath}`, "PUT", pushBody);
  const commitSha: string = pushResult.commit?.sha ?? "";

  const updated = await markMemoryAsPushed(id, commitSha, filePath, commitMsg);
  return NextResponse.json({ ok: true, memory: updated, filePath, commitSha });
}
