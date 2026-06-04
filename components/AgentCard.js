"use client";

const STATUS_STYLES = {
  running: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  idle: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  error: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  stopped: "bg-white/10 text-white/40 border-white/20",
};

const MODEL_COLORS = {
  "GPT-4o": "text-green-400",
  "Claude 3.5": "text-violet-400",
  "Gemini 1.5": "text-blue-400",
  "Llama 3": "text-orange-400",
};

export default function AgentCard({ agent }) {
  const { name, model, status, tasks, description, lastRun } = agent;

  return (
    <article className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-4 hover:border-white/20 hover:bg-white/[0.07] transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/30 to-indigo-600/30 border border-white/10 flex items-center justify-center text-base">
            {agent.emoji}
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-tight">{name}</h3>
            <p className={`text-xs font-medium ${MODEL_COLORS[model] ?? "text-white/50"}`}>
              {model}
            </p>
          </div>
        </div>

        <span
          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${STATUS_STYLES[status]}`}
        >
          {status}
        </span>
      </div>

      <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{description}</p>

      <div className="flex items-center justify-between text-xs text-white/40 mt-auto pt-2 border-t border-white/5">
        <span>{tasks} tasks</span>
        <span>{lastRun}</span>
      </div>
    </article>
  );
}
