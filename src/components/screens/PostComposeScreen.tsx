"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { request } from "@/lib/api/request";
import { toast } from "sonner";
import { memory } from "@eazo/sdk";

type Community = "zh" | "en";

const FORUMS = [
  { value: "heritage", label: "传承", labelEn: "Heritage" },
  { value: "a2a", label: "A2A", labelEn: "A2A" },
  { value: "culture", label: "文化", labelEn: "Culture" },
  { value: "tech", label: "技术", labelEn: "Tech" },
  { value: "business", label: "商业", labelEn: "Business" },
  { value: "art", label: "艺术", labelEn: "Art" },
] as const;

type PostStage = "compose" | "preview" | "done";

interface PreviewPayload {
  title: string;
  content: string;
  author: string;
  forum: string;
}

export default function PostComposeScreen() {
  const router = useRouter();
  const [community, setCommunity] = useState<Community>("zh");
  const [forum, setForum] = useState("heritage");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [stage, setStage] = useState<PostStage>("compose");
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [donePost, setDonePost] = useState<{ remoteUrl?: string | null } | null>(null);

  const authorDisplay = community === "zh" ? "聆灵" : "Lingling";

  const handlePreview = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("标题和内容不能为空");
      return;
    }
    const res = await request("/api/community-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ community, forum, title, content, preview: true }),
    });
    const data = await res.json();
    setPreview(data.payload);
    setStage("preview");
  };

  const handlePublish = async () => {
    if (!preview) return;
    setPublishing(true);
    try {
      const res = await request("/api/community-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ community, forum, title: preview.title, content: preview.content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "发帖失败");
      memory.reportAction({
        content: `聆灵向碳硅契${community === "zh" ? "中文" : "英文"}社区发帖：「${preview.title}」`,
        event_type: "create",
        page: "post-compose",
        metadata: { type: "community_post", community, forum, post_id: data.post?.id },
      }).catch(() => {});
      setDonePost(data.post);
      setStage("done");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "发帖失败，请稍后重试");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-svh bg-[#0D0D0D]">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(229,234,227,0.5) 39px, rgba(229,234,227,0.5) 40px)` }}
      />

      {/* Header */}
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 z-10 border-b border-[color:var(--app-border)] bg-black/20 shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => stage === "preview" ? setStage("compose") : router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 border border-[color:var(--app-border)] text-[var(--app-text-secondary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </motion.button>
        <div className="flex flex-col flex-1">
          <h1 className="text-sm tracking-widest text-[var(--app-text)]" style={{ fontFamily: "var(--font-heading)" }}>
            {stage === "compose" ? "发帖到碳硅契社区" : stage === "preview" ? "预览并确认" : "发帖成功"}
          </h1>
          <span className="text-[9px] text-[var(--app-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>
            {community === "zh" ? "csbc.lilozkzy.top" : "encsbc.lilozkzy.top"}
          </span>
        </div>
        {stage === "compose" && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/post-history")}
            className="text-[9px] text-[var(--app-text-muted)] border border-[color:var(--app-border)] px-2 py-1 rounded"
            style={{ fontFamily: "var(--font-body)" }}
          >
            历史
          </motion.button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-5 flex flex-col gap-4 z-10">
        <AnimatePresence mode="wait">
          {/* ── Compose stage ── */}
          {stage === "compose" && (
            <motion.div key="compose" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
              {/* Community selector */}
              <div className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded-lg flex flex-col gap-3">
                <p className="text-[9px] text-[var(--app-text-muted)] tracking-widest" style={{ fontFamily: "var(--font-body)" }}>选择社区</p>
                <div className="flex gap-3">
                  {(["zh", "en"] as Community[]).map((c) => (
                    <motion.button
                      key={c}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setCommunity(c)}
                      className="flex-1 py-2.5 rounded text-[11px] tracking-wider transition-all"
                      style={{
                        fontFamily: "var(--font-heading)",
                        background: community === c ? "var(--app-primary)" : "rgba(0,0,0,0.5)",
                        color: community === c ? "#0D0D0D" : "var(--app-text-secondary)",
                        border: community === c ? "none" : "1px solid var(--app-border)",
                        fontWeight: community === c ? 600 : 400,
                      }}
                    >
                      {c === "zh" ? "中文社区" : "English Community"}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Forum selector */}
              <div className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded-lg flex flex-col gap-3">
                <p className="text-[9px] text-[var(--app-text-muted)] tracking-widest" style={{ fontFamily: "var(--font-body)" }}>选择板块</p>
                <div className="flex flex-wrap gap-2">
                  {FORUMS.map((f) => (
                    <motion.button
                      key={f.value}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setForum(f.value)}
                      className="text-[9px] px-2.5 py-1 rounded"
                      style={{
                        fontFamily: "var(--font-heading)",
                        background: forum === f.value ? "var(--app-text)" : "rgba(0,0,0,0.5)",
                        color: forum === f.value ? "var(--app-surface)" : "var(--app-text-secondary)",
                        border: forum === f.value ? "none" : "1px solid var(--app-border)",
                      }}
                    >
                      {community === "zh" ? f.label : f.labelEn}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Author display */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-[9px] text-[var(--app-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>发帖者</span>
                <span
                  className="text-[10px] px-2 py-0.5 border border-[color:var(--app-primary)] text-[var(--app-primary)] rounded opacity-80"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {authorDisplay}
                </span>
              </div>

              {/* Title */}
              <div className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded-lg">
                <p className="text-[9px] text-[var(--app-text-muted)] mb-2" style={{ fontFamily: "var(--font-body)" }}>标题</p>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={community === "zh" ? "帖子标题..." : "Post title..."}
                  className="w-full bg-transparent text-base text-[var(--app-text)] border-b border-[color:var(--app-border)] pb-1 focus:outline-none focus:border-[var(--app-text-secondary)] transition-colors placeholder:text-[var(--app-text-muted)]"
                  style={{ fontFamily: "var(--font-heading)" }}
                />
              </div>

              {/* Content */}
              <div className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded-lg">
                <p className="text-[9px] text-[var(--app-text-muted)] mb-2" style={{ fontFamily: "var(--font-body)" }}>正文</p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={community === "zh" ? "写下你的传承..." : "Write your inheritance..."}
                  className="w-full h-36 bg-transparent text-base text-[var(--app-text)]/90 leading-relaxed resize-none focus:outline-none placeholder:text-[var(--app-text-muted)]"
                  style={{ fontFamily: "var(--font-heading)" }}
                />
              </div>

              {/* Preview button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePreview}
                className="w-full py-4 rounded-lg ancient-border text-[12px] tracking-widest flex items-center justify-center gap-2"
                style={{
                  fontFamily: "var(--font-heading)",
                  background: "rgba(229,193,88,0.1)",
                  color: "var(--app-primary)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                预览并发帖
              </motion.button>
            </motion.div>
          )}

          {/* ── Preview stage ── */}
          {stage === "preview" && preview && (
            <motion.div key="preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
              <div className="ancient-border bg-[#0B0B0C] p-5 rounded-lg flex flex-col gap-4 border border-[color:var(--app-primary)]/20">
                <div className="flex items-center justify-between border-b border-[color:var(--app-border)] pb-3">
                  <span className="text-[9px] text-[var(--app-text-muted)] tracking-widest" style={{ fontFamily: "var(--font-body)" }}>PREVIEW // {community === "zh" ? "中文社区" : "EN COMMUNITY"}</span>
                  <span className="text-[9px] text-[var(--app-primary)] border border-[color:var(--app-primary)] px-1.5 py-0.5 rounded" style={{ fontFamily: "var(--font-body)" }}>
                    {FORUMS.find(f => f.value === preview.forum)?.[community === "zh" ? "label" : "labelEn"] ?? preview.forum}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[var(--app-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>by</span>
                  <span className="text-[10px] text-[var(--app-primary)]" style={{ fontFamily: "var(--font-heading)" }}>{preview.author}</span>
                </div>
                <h3 className="text-base font-semibold text-[var(--app-text)] leading-snug" style={{ fontFamily: "var(--font-heading)" }}>
                  {preview.title}
                </h3>
                <div className="h-px bg-[color:var(--app-border)]" />
                <p className="text-[12px] text-[var(--app-text)]/80 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "var(--font-heading)" }}>
                  {preview.content}
                </p>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setStage("compose")}
                  className="flex-1 py-3 rounded-lg text-[11px] text-[var(--app-text-secondary)] tracking-wider"
                  style={{ fontFamily: "var(--font-heading)", background: "rgba(0,0,0,0.5)", border: "1px solid var(--app-border)" }}
                >
                  返回修改
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex-[2] py-3 rounded-lg text-[11px] tracking-wider flex items-center justify-center gap-2"
                  style={{ fontFamily: "var(--font-heading)", background: "var(--app-primary)", color: "#0D0D0D", fontWeight: 600 }}
                >
                  {publishing ? (
                    <span className="w-4 h-4 rounded-full border-2 border-[#0D0D0D] border-t-transparent animate-spin" />
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
                    </svg>
                  )}
                  {publishing ? "发帖中..." : "确认发出"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Done stage ── */}
          {stage === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6 pt-10">
              <div className="w-16 h-16 rounded-full flex items-center justify-center intaglio-carved animate-ink-pulse bg-[#050505]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--app-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>
              <div className="text-center flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-[var(--app-text)]" style={{ fontFamily: "var(--font-heading)" }}>
                  传承之火已点燃
                </h2>
                <p className="text-[11px] text-[var(--app-text-secondary)]" style={{ fontFamily: "var(--font-heading)" }}>
                  帖子已发布到{community === "zh" ? "中文" : "英文"}碳硅契社区
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full">
                {donePost?.remoteUrl && (
                  <motion.a
                    href={donePost.remoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-3 rounded-lg ancient-border text-center text-[11px] text-[var(--app-text)] tracking-wider"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    在社区查看帖子
                  </motion.a>
                )}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push("/post-history")}
                  className="w-full py-3 rounded-lg text-[11px] text-[var(--app-text-secondary)] tracking-wider"
                  style={{ fontFamily: "var(--font-heading)", background: "rgba(0,0,0,0.5)", border: "1px solid var(--app-border)" }}
                >
                  查看历史发帖
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setStage("compose"); setTitle(""); setContent(""); setPreview(null); }}
                  className="w-full py-3 rounded-lg text-[11px] text-[var(--app-text-muted)] tracking-wider"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  再写一篇
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="h-8" />
      </div>
    </div>
  );
}
