"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { request } from "@/lib/api/request";
import { toast } from "sonner";
import type { Memory } from "@/lib/db/schema/memories";

const TAG_LABELS: Record<string, string> = {
  对话: "碳硅契约",
  理念: "魂契共鸣",
  感悟: "聆听之悟",
};

export default function HistoryListScreen() {
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await request("/api/memories");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setMemories(data.memories ?? []);
      } catch {
        toast.error("加载记忆失败");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="flex flex-col min-h-svh bg-[#0D0D0D]">
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(229,234,227,0.5) 39px, rgba(229,234,227,0.5) 40px)`,
        }}
      />

      {/* Navigation Header */}
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 z-10 border-b border-[color:var(--app-border)] bg-black/20 shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 border border-[color:var(--app-border)] text-[var(--app-text-secondary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </motion.button>
        <div className="flex flex-col">
          <h1
            className="text-sm tracking-widest text-[var(--app-text)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            碑上已存印记
          </h1>
          <span
            className="text-[9px] text-[var(--app-text-muted)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            lilozhao/lingling-memory
          </span>
        </div>
      </div>

      {/* List Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 flex flex-col gap-3 z-10">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded flex flex-col gap-2">
                <div className="skeleton h-3 w-3/4 mb-1" />
                <div className="skeleton h-2 w-full" />
                <div className="skeleton h-2 w-2/3" />
                <div className="skeleton h-2 w-1/3 mt-2" />
              </div>
            ))}
          </>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 pt-20 gap-4">
            <div className="text-5xl opacity-20" style={{ fontFamily: "var(--font-heading)" }}>虚</div>
            <p className="text-[11px] text-[var(--app-text-muted)] tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
              碑上尚无印记，先刻一篇吧
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {memories.map((mem, idx) => (
              <motion.div
                key={mem.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded cursor-pointer flex flex-col gap-2"
                style={{ position: "relative" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/memory-detail?id=${mem.id}`)}
              >
                <div className="flex justify-between items-start">
                  <h4
                    className="text-xs font-semibold text-[var(--app-text)] flex-1 pr-2"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {mem.title}
                  </h4>
                  <span
                    className="text-[8px] px-1.5 py-0.5 bg-black/60 text-[var(--app-text-secondary)] border border-[color:var(--app-border)] shrink-0"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {TAG_LABELS[mem.tag] ?? mem.tag}
                  </span>
                </div>
                <p
                  className="text-[10px] text-[var(--app-text-secondary)] leading-relaxed opacity-80 line-clamp-2"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {mem.content}
                </p>
                <div
                  className="flex justify-between items-center mt-2 pt-2 border-t border-[color:var(--app-border)] text-[8px] text-[var(--app-text-muted)]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  <span>{mem.isPushed ? "GITHUB COMMITTED" : "PENDING PUSH"}</span>
                  <span>{new Date(mem.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, ".")}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div className="h-8" />
      </div>
    </div>
  );
}
