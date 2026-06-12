import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMemoryById, markMemoryAsPushed } from "@/lib/db/queries/memories";

function normalizeRepo(raw: string): string {
  // Strip https://github.com/ prefix and .git suffix, keep owner/repo
  return raw
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .trim();
}

function getGithubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const raw = process.env.GITHUB_REPO ?? "lilozhao/lingling-memory";
  const repo = normalizeRepo(raw);
  return { token, repo };
}

async function githubRequest(path: string, method: string, body?: object) {
  const { token, repo } = getGithubConfig();
  if (!token) throw new Error("GITHUB_TOKEN 未配置，无法访问 GitHub API");
  const url = `https://api.github.com/repos/${repo}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const msg = (data as Record<string,unknown>)?.message ?? `GitHub API ${res.status}`;
    throw new Error(`GitHub ${res.status}: ${msg} (url: ${url})`);
  }
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

  const { token } = getGithubConfig();
  if (!token) {
    return NextResponse.json({ error: "GITHUB_TOKEN 未配置，请在环境变量中设置" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const commitMsg = (body as Record<string,string>).commitMessage || `记忆存档：${memory.title}`;

  // Build markdown content
  const date = new Date(memory.createdAt).toLocaleString("zh-CN");
  const markdown = `# ${memory.title}\n\n**标签：** ${memory.tag}  \n**时间：** ${date}\n\n---\n\n${memory.content}\n\n---\n\n> 由聆灵记忆档案馆存档 · 碳硅契传承项目\n`;
  const encoded = Buffer.from(markdown, "utf-8").toString("base64");

  // Safe filename: timestamp + slug
  const timestamp = new Date(memory.createdAt).toISOString().slice(0, 10);
  const safeTitle = memory.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "-").slice(0, 40);
  const filePath = `memories/${timestamp}-${safeTitle}.md`;

  // Check if file already exists (to get current sha for update)
  let sha: string | undefined;
  try {
    const existing = await githubRequest(`/contents/${filePath}`, "GET") as Record<string, unknown>;
    sha = existing.sha as string | undefined;
  } catch {
    // file doesn't exist yet — first write, no sha needed
  }

  const pushBody: Record<string, unknown> = {
    message: commitMsg,
    content: encoded,
    branch: "main",
  };
  if (sha) pushBody.sha = sha;

  try {
    const pushResult = await githubRequest(`/contents/${filePath}`, "PUT", pushBody) as Record<string, unknown>;
    const commitData = pushResult.commit as Record<string, unknown> | undefined;
    const commitSha: string = (commitData?.sha as string) ?? "";
    const updated = await markMemoryAsPushed(id, commitSha, filePath, commitMsg);
    return NextResponse.json({ ok: true, memory: updated, filePath, commitSha });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "GitHub push 失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
