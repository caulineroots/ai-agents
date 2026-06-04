const stats = [
  { label: "Active Agents", value: "12", delta: "+3 this week", positive: true },
  { label: "Tasks Completed", value: "1,284", delta: "+128 today", positive: true },
  { label: "Avg. Response Time", value: "340ms", delta: "-12ms", positive: true },
  { label: "Errors", value: "7", delta: "+2 today", positive: false },
];

export default function StatsBar() {
  return (
    <section aria-label="Overview stats">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-1"
          >
            <p className="text-xs text-white/50 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p
              className={`text-xs font-medium ${
                stat.positive ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {stat.delta}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
