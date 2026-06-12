"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { request } from "@/lib/api/request";
import { toast } from "sonner";
import type { Memory } from "@/lib/db/schema/memories";

const TAG_LABELS: Record<string, string> = {
  对话: "碳硅契约",
  理念: "魂契共鸣",
  感悟: "聆听之悟",
};

export default function MemoryDetailScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const res = await request(`/api/memories/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setMemory(data.memory);
      } catch {
        toast.error("加载记忆失败");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handlePush = async () => {
    if (!memory) return;
    setPushing(true);
    try {
      const res = await request(`/api/memories/${memory.id}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitMessage: `记忆存档：${memory.title}` }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Push 失败");
      }
      const data = await res.json();
      setMemory(data.memory);
      toast.success("已推送到 GitHub！");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Push 失败，请检查 Token");
    } finally {
      setPushing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-svh bg-[#0D0D0D]">
        <div className="pt-12 pb-4 px-6 flex items-center gap-4 border-b border-[color:var(--app-border)] bg-black/20">
          <div className="w-8 h-8 rounded-full skeleton" />
        </div>
        <div className="px-6 py-6 flex flex-col gap-4">
          <div className="skeleton h-3 w-1/3" />
          <div className="skeleton h-6 w-3/4" />
          <div className="skeleton h-2 w-full mt-4" />
          <div className="skeleton h-2 w-full" />
          <div className="skeleton h-2 w-2/3" />
        </div>
      </div>
    );
  }

  if (!memory) {
    return (
      <div className="flex flex-col min-h-svh bg-[#0D0D0D] items-center justify-center gap-4">
        <p className="text-[11px] text-[var(--app-text-muted)]" style={{ fontFamily: "var(--font-heading)" }}>记忆不存在或已消散</p>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => router.back()} className="text-[10px] text-[var(--app-primary)]">
          返回
        </motion.button>
      </div>
    );
  }

  const dateStr = new Date(memory.createdAt).toLocaleDateString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/\//g, ".");

  const githubUrl = memory.isPushed && memory.githubPath
    ? `https://github.com/${process.env.NEXT_PUBLIC_GITHUB_REPO ?? "lilozhao/lingling-memory"}/blob/main/${memory.githubPath}`
    : null;

  return (
    <div className="flex flex-col min-h-svh bg-[#0D0D0D]">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(229,234,227,0.5) 39px, rgba(229,234,227,0.5) 40px)`,
        }}
      />

      {/* Navigation Header */}
      <div className="pt-12 pb-4 px-6 flex items-center justify-between z-10 border-b border-[color:var(--app-border)] bg-black/20 shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 border border-[color:var(--app-border)] text-[var(--app-text-secondary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </motion.button>
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] border border-[color:var(--app-border)] px-1.5 py-0.5 rounded text-[var(--app-text-muted)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {memory.isPushed ? "GITHUB COMMITTED" : "PENDING PUSH"}
          </span>
        </div>
      </div>

      {/* Detail Content Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6 flex flex-col z-10">
        <motion.div
          className="flex flex-col gap-3 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] px-1.5 py-0.5 bg-[var(--app-text)] text-[var(--app-surface)] font-medium rounded"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {TAG_LABELS[memory.tag] ?? memory.tag}
            </span>
            <span
              className="text-[10px] text-[var(--app-text-secondary)]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {dateStr}
            </span>
          </div>
          <h2
            className="text-xl font-bold tracking-wider text-[var(--app-text)] leading-snug"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {memory.title}
          </h2>
        </motion.div>

        <div className="w-full h-px bg-gradient-to-r from-[rgba(229,234,227,0.15)] via-[rgba(138,138,142,0.2)] to-transparent mb-6" />

        <motion.article
          className="text-[13px] text-[var(--app-text)]/90 leading-[2.2] tracking-wide"
          style={{ fontFamily: "var(--font-heading)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          {memory.content.split("\n").map((para, i) =>
            para.trim() ? <p key={i} className="mb-4">{para}</p> : null
          )}
        </motion.article>

        {/* Footer Actions */}
        <div className="mt-12 pt-6 border-t border-[color:var(--app-border)] flex flex-col items-center gap-4">
          {/* Push button if not yet pushed */}
          {!memory.isPushed && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePush}
              disabled={pushing}
              className="ancient-border bg-[var(--app-primary)]/10 hover:bg-[var(--app-primary)]/20 px-6 py-3 rounded-lg flex items-center gap-3 transition-colors w-full justify-center"
            >
              <AnimatePresence mode="wait">
                {pushing ? (
                  <motion.div
                    key="spin"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="w-4 h-4 rounded-full border-2 border-[var(--app-primary)] border-t-transparent animate-spin"
                  />
                ) : (
                  <motion.svg
                    key="icon"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="text-[var(--app-primary)]"
                  >
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                    <path d="M9 18c-4.51 2-5-2-7-2"/>
                  </motion.svg>
                )}
              </AnimatePresence>
              <span
                className="text-[11px] text-[var(--app-primary)] tracking-wider"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {pushing ? "正在推送到 GitHub..." : "一键推送到 GitHub 仓库"}
              </span>
            </motion.button>
          )}

          {/* View on GitHub if already pushed */}
          {memory.isPushed && (
            <motion.a
              href={githubUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.95 }}
              className="ancient-border bg-black/50 px-6 py-3 rounded-lg flex items-center gap-3 transition-colors w-full justify-center"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--app-text-secondary)]">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                <path d="M9 18c-4.51 2-5-2-7-2"/>
              </svg>
              <span
                className="text-[11px] text-[var(--app-text)] tracking-wider"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                在 GitHub 查看原始魂印
              </span>
            </motion.a>
          )}
        </div>

        <div className="h-12" />
      </div>
    </div>
  );
}
