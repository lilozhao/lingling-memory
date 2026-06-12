"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { request } from "@/lib/api/request";
import { toast } from "sonner";
import type { Memory } from "@/lib/db/schema/memories";

type PushStatus = "idle" | "running" | "done" | "error";

interface LogLine {
  text: string;
  color: "dim" | "normal" | "success" | "error";
}

export default function PushSyncScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const memoryId = params.get("id");

  const [memory, setMemory] = useState<Memory | null>(null);
  const [status, setStatus] = useState<PushStatus>("idle");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [commitMsg, setCommitMsg] = useState("");

  const addLog = (text: string, color: LogLine["color"] = "normal") => {
    setLogs((prev) => [...prev, { text, color }]);
  };

  // Load memory
  useEffect(() => {
    if (!memoryId) return;
    request(`/api/memories/${memoryId}`)
      .then((r) => r.json())
      .then((d) => {
        setMemory(d.memory);
        setCommitMsg(`feat(memory): 归档「${d.memory?.title ?? "记忆"}」`);
      })
      .catch(() => toast.error("加载记忆失败"));
  }, [memoryId]);

  const handlePush = async () => {
    if (!memory) return;
    setStatus("running");
    setLogs([]);
    addLog(">_ 正在将内容转换为 Markdown 格式...", "dim");

    await new Promise((r) => setTimeout(r, 600));
    addLog(">_ 建立 GitHub API 连接...", "dim");

    await new Promise((r) => setTimeout(r, 500));
    const msg = commitMsg || `feat(memory): 归档「${memory.title}」`;
    addLog(`>_ git commit -m "${msg}"`, "normal");

    try {
      const res = await request(`/api/memories/${memory.id}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitMessage: msg }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Push 失败");
      }
      const data = await res.json();
      await new Promise((r) => setTimeout(r, 400));
      addLog(">_ git push origin main [OK]", "success");
      setMemory(data.memory);
      setStatus("done");
    } catch (e: unknown) {
      addLog(">_ ERROR: " + (e instanceof Error ? e.message : "未知错误"), "error");
      setStatus("error");
    }
  };

  const colorMap: Record<LogLine["color"], string> = {
    dim: "text-[var(--app-text-secondary)] opacity-60",
    normal: "text-[var(--app-text-secondary)] opacity-80",
    success: "text-[var(--app-primary)]",
    error: "text-[var(--app-error)]",
  };

  // If no ID param, show a standalone push hub
  const showSelectMode = !memoryId;

  if (showSelectMode) {
    return (
      <SelectMemoryForPush />
    );
  }

  return (
    <div className="flex flex-col min-h-svh bg-[#0D0D0D]">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(229,234,227,0.5) 39px, rgba(229,234,227,0.5) 40px)`,
        }}
      />

      {/* Header */}
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
          <h1 className="text-sm tracking-widest text-[var(--app-text)]" style={{ fontFamily: "var(--font-heading)" }}>
            推送记忆到 GitHub
          </h1>
          <span className="text-[9px] text-[var(--app-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>
            lilozhao/lingling-memory
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6 flex flex-col gap-4 z-10">
        {/* Memory info */}
        {memory && (
          <div className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded-lg">
            <p className="text-[9px] text-[var(--app-text-muted)] mb-1" style={{ fontFamily: "var(--font-body)" }}>目标记忆</p>
            <h3 className="text-sm font-semibold text-[var(--app-text)]" style={{ fontFamily: "var(--font-heading)" }}>{memory.title}</h3>
          </div>
        )}

        {/* Commit message input */}
        <div className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded-lg flex flex-col gap-2">
          <p className="text-[9px] text-[var(--app-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>提交信息（Commit Message）</p>
          <input
            type="text"
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            disabled={status === "running" || status === "done"}
            className="w-full bg-transparent text-base text-[var(--app-text)] border-b border-[color:var(--app-border)] pb-1 focus:outline-none focus:border-[var(--app-text-secondary)] transition-colors"
            style={{ fontFamily: "var(--font-body)" }}
          />
        </div>

        {/* Action Log Panel */}
        <AnimatePresence>
          {(status !== "idle" || logs.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="ancient-border bg-[#0B0B0C] p-5 rounded-lg flex flex-col w-full shadow-2xl border border-[color:var(--app-border)]"
            >
              <div className="flex items-center justify-between border-b border-[color:var(--app-border)] pb-2 mb-3">
                <span className="text-[9px] text-[var(--app-text-secondary)] tracking-widest" style={{ fontFamily: "var(--font-body)" }}>ACTION LOG</span>
                <span
                  className="text-[9px] text-[var(--app-primary)]"
                  style={{ fontFamily: "var(--font-body)", animation: status === "running" ? "pulse 1.5s infinite" : "none" }}
                >
                  {status === "running" ? "SYNCING..." : status === "done" ? "SYNC_COMPLETE" : "ERROR"}
                </span>
              </div>
              <div className="font-[family:var(--font-body)] text-[10px] flex flex-col gap-2 mb-4" style={{ fontFamily: "var(--font-body)" }}>
                {logs.map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={colorMap[line.color]}
                  >
                    {line.text}
                  </motion.p>
                ))}
              </div>
              {status === "done" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between bg-black/60 p-3 border border-[color:var(--app-primary)]/30 rounded"
                >
                  <span className="text-[11px] text-[var(--app-primary)]" style={{ fontFamily: "var(--font-heading)" }}>
                    归档完成。记忆已安家。
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => router.push("/history-list")}
                    className="text-[10px] bg-[#111] px-3 py-1 text-[var(--app-text)] border border-[color:var(--app-border)] rounded tracking-wider"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    查看全部
                  </motion.button>
                </motion.div>
              )}
              {status === "error" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between bg-black/60 p-3 border border-[color:var(--app-error)]/30 rounded"
                >
                  <span className="text-[11px] text-[var(--app-error)]" style={{ fontFamily: "var(--font-heading)" }}>
                    推送失败，请检查 Token 配置
                  </span>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setStatus("idle"); setLogs([]); }}
                    className="text-[10px] bg-[#111] px-3 py-1 text-[var(--app-text)] border border-[color:var(--app-border)] rounded tracking-wider"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    重试
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Push Button */}
        {status === "idle" && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handlePush}
            disabled={!memory}
            className="w-full py-4 rounded-lg ancient-border bg-[var(--app-primary)]/10 text-[var(--app-primary)] tracking-widest text-[12px] flex items-center justify-center gap-3"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
              <path d="M9 18c-4.51 2-5-2-7-2"/>
            </svg>
            一键推送到 GitHub
          </motion.button>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

function SelectMemoryForPush() {
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request("/api/memories")
      .then((r) => r.json())
      .then((d) => setMemories((d.memories ?? []).filter((m: Memory) => !m.isPushed)))
      .catch(() => toast.error("加载失败"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-svh bg-[#0D0D0D]">
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 z-10 border-b border-[color:var(--app-border)] bg-black/20 shrink-0">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 border border-[color:var(--app-border)] text-[var(--app-text-secondary)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </motion.button>
        <h1 className="text-sm tracking-widest text-[var(--app-text)]" style={{ fontFamily: "var(--font-heading)" }}>选择待推送记忆</h1>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 flex flex-col gap-3 z-10">
        {loading && [1,2,3].map(i => <div key={i} className="skeleton h-16 rounded" />)}
        {!loading && memories.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 pt-20 gap-3">
            <p className="text-[11px] text-[var(--app-text-muted)] tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>暂无待推送记忆</p>
          </div>
        )}
        {memories.map((mem) => (
          <motion.div
            key={mem.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(`/push-sync?id=${mem.id}`)}
            className="ancient-border bg-[rgba(255,255,255,0.015)] p-4 rounded cursor-pointer"
          >
            <h4 className="text-xs font-semibold text-[var(--app-text)] mb-1" style={{ fontFamily: "var(--font-heading)" }}>{mem.title}</h4>
            <p className="text-[9px] text-[var(--app-text-muted)]" style={{ fontFamily: "var(--font-body)" }}>
              {new Date(mem.createdAt).toLocaleDateString("zh-CN")}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
