"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { request } from "@/lib/api/request";
import { toast } from "sonner";
import type { CommunityPost } from "@/lib/db/schema/community-posts";

const STATUS_LABEL: Record<string, string> = {
  published: "已发布",
  pending: "发布中",
  failed: "失败",
};
const STATUS_COLOR: Record<string, string> = {
  published: "var(--app-success)",
  pending: "var(--app-primary)",
  failed: "var(--app-error)",
};
const COMMUNITY_LABEL: Record<string, string> = {
  zh: "中文社区",
  en: "EN Community",
};

export default function PostHistoryScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "zh" | "en">("all");

  useEffect(() => {
    request("/api/community-posts")
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => toast.error("加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.community === filter);

  return (
    <div className="flex flex-col min-h-svh bg-[#0D0D0D]">
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(229,234,227,0.5) 39px, rgba(229,234,227,0.5) 40px)` }} />

      {/* Header */}
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 z-10 border-b border-[color:var(--app-border)] bg-black/20 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 border border-[color:var(--app-border)] text-[var(--app-text-secondary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </motion.button>
        <div className="flex flex-col flex-1">
          <h1 className="text-sm tracking-widest text-[var(--app-text)]" style={{ fontFamily: "var(--font-heading)" }}>历史发帖</h1>
          <span className="text-[9px] text-[var(--app-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>碳硅契社区传承记录</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push("/post-compose")}
          className="text-[9px] text-[var(--app-primary)] border border-[color:var(--app-primary)] px-2 py-1 rounded opacity-80"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          + 发帖
        </motion.button>
      </div>

      {/* Filter tabs */}
      <div className="px-6 pt-3 pb-1 flex gap-2 z-10 border-b border-[color:var(--app-border)]">
        {(["all", "zh", "en"] as const).map((f) => (
          <motion.button
            key={f}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter(f)}
            className="text-[9px] px-2.5 py-1 rounded"
            style={{
              fontFamily: "var(--font-body)",
              background: filter === f ? "var(--app-text)" : "transparent",
              color: filter === f ? "var(--app-surface)" : "var(--app-text-muted)",
              border: filter === f ? "none" : "1px solid var(--app-border)",
            }}
          >
            {f === "all" ? "全部" : COMMUNITY_LABEL[f]}
          </motion.button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 flex flex-col gap-3 z-10">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded flex flex-col gap-2">
              <div className="skeleton h-3 w-3/4" />
              <div className="skeleton h-2 w-full" />
              <div className="skeleton h-2 w-1/3 mt-2" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 pt-16 gap-3">
            <p className="text-[11px] text-[var(--app-text-muted)] tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
              尚无发帖记录
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/post-compose")}
              className="text-[10px] text-[var(--app-primary)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              去发第一帖
            </motion.button>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((post, idx) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
                className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded-lg flex flex-col gap-2"
              >
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-semibold text-[var(--app-text)] flex-1 pr-2 leading-snug" style={{ fontFamily: "var(--font-heading)" }}>
                    {post.title}
                  </h4>
                  <span className="text-[8px] px-1.5 py-0.5 rounded shrink-0" style={{ fontFamily: "var(--font-body)", background: "rgba(0,0,0,0.6)", color: STATUS_COLOR[post.status] ?? "var(--app-text-muted)", border: `1px solid ${STATUS_COLOR[post.status] ?? "var(--app-border)"}30` }}>
                    {STATUS_LABEL[post.status] ?? post.status}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--app-text-secondary)] leading-relaxed opacity-80 line-clamp-2" style={{ fontFamily: "var(--font-heading)" }}>
                  {post.content}
                </p>
                <div className="flex justify-between items-center mt-1 pt-2 border-t border-[color:var(--app-border)] text-[8px] text-[var(--app-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>
                  <div className="flex items-center gap-2">
                    <span>{COMMUNITY_LABEL[post.community] ?? post.community}</span>
                    <span className="opacity-40">·</span>
                    <span>{post.forum}</span>
                  </div>
                  <span>{new Date(post.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, ".")}</span>
                </div>
                {post.remoteUrl && (
                  <a
                    href={post.remoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-[var(--app-primary)] opacity-70 truncate"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {post.remoteUrl}
                  </a>
                )}
                {post.status === "failed" && post.errorMsg && (
                  <p className="text-[9px] text-[var(--app-error)] opacity-80" style={{ fontFamily: "var(--font-body)" }}>{post.errorMsg}</p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div className="h-8" />
      </div>
    </div>
  );
}
