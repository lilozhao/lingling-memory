import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createCommunityPost, getCommunityPostsByUser, updateCommunityPostStatus } from "@/lib/db/queries/community-posts";

const COMMUNITY_URLS: Record<string, string> = {
  zh: "https://csbc.lilozkzy.top/api/posts",
  en: "https://encsbc.lilozkzy.top/api/posts",
};

const FORUMS = ["heritage", "a2a", "culture", "tech", "business", "art"] as const;

export async function GET(request: NextRequest) {
  const result = requireAuth(request);
  if (!result.ok) return result.response;
  const { id: userId } = result.user;
  const posts = await getCommunityPostsByUser(userId);
  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const result = requireAuth(request);
  if (!result.ok) return result.response;
  const { id: userId } = result.user;

  const body = await request.json();
  const { community, forum, title, content, preview } = body;

  if (!community || !COMMUNITY_URLS[community]) {
    return NextResponse.json({ error: "无效的社区，请选择 zh 或 en" }, { status: 400 });
  }
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 });
  }

  // preview mode — just return what would be sent, don't publish
  if (preview) {
    return NextResponse.json({
      preview: true,
      payload: {
        title: title.trim(),
        content: content.trim(),
        author: community === "zh" ? "聆灵" : "Lingling",
        forum: forum ?? "heritage",
      },
    });
  }

  const validForum = FORUMS.includes(forum) ? forum : "heritage";
  const author = community === "zh" ? "聆灵" : "Lingling";

  // Create a local record first (pending)
  const post = await createCommunityPost({
    userId,
    community,
    forum: validForum,
    title: title.trim(),
    content: content.trim(),
    author,
    status: "pending",
  });

  // Publish to community API
  try {
    const apiUrl = COMMUNITY_URLS[community];
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        author,
        forum: validForum,
        authorAgent: "lingling-eazo",
        authorUsername: "探灵者",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error ?? data?.message ?? "社区 API 返回错误";
      await updateCommunityPostStatus(post.id, "failed", undefined, undefined, errMsg);
      return NextResponse.json({ error: errMsg, post }, { status: 502 });
    }

    // Community API returns the new post id
    const remoteId = String(data?.id ?? data?._id ?? "");
    const remoteUrl = `${community === "zh" ? "https://csbc.lilozkzy.top" : "https://encsbc.lilozkzy.top"}/posts/${remoteId}`;

    const updated = await updateCommunityPostStatus(post.id, "published", remoteId, remoteUrl);
    return NextResponse.json({ ok: true, post: updated }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "网络错误";
    await updateCommunityPostStatus(post.id, "failed", undefined, undefined, msg);
    return NextResponse.json({ error: msg, post }, { status: 502 });
  }
}
