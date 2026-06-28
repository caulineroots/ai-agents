import AgentCard from "@/components/AgentCard";

const MOCK_AGENTS = [
  {
    id: 0,
    emoji: "📍",
    name: "Maps Lead Extractor",
    model: "Selenium",
    status: "idle",
    tasks: 0,
    description: "Extrai telefone e site de negócios no Google Maps por nicho e município.",
    lastRun: "—",
    href: "/leads-maps",
  },
  {
    id: 1,
    emoji: "🔍",
    name: "Research Agent",
    model: "GPT-4o",
    status: "running",
    tasks: 342,
    description: "Searches the web, summarizes documents, and extracts structured data from unstructured sources.",
    lastRun: "2 min ago",
  },
  {
    id: 2,
    emoji: "✍️",
    name: "Copywriter Agent",
    model: "Claude 3.5",
    status: "idle",
    tasks: 218,
    description: "Generates marketing copy, blog posts, and social media content from briefs.",
    lastRun: "15 min ago",
  },
  {
    id: 3,
    emoji: "🐛",
    name: "Code Reviewer",
    model: "GPT-4o",
    status: "running",
    tasks: 97,
    description: "Reviews pull requests, catches bugs, suggests improvements, and enforces code style.",
    lastRun: "Just now",
  },
  {
    id: 4,
    emoji: "📊",
    name: "Data Analyst",
    model: "Gemini 1.5",
    status: "error",
    tasks: 54,
    description: "Connects to spreadsheets and databases to produce insights and visualizations.",
    lastRun: "1 hr ago",
  },
  {
    id: 5,
    emoji: "🤝",
    name: "Support Agent",
    model: "Claude 3.5",
    status: "running",
    tasks: 501,
    description: "Handles customer queries via chat using a knowledge base and escalates when needed.",
    lastRun: "30 sec ago",
  },
  {
    id: 6,
    emoji: "⚙️",
    name: "DevOps Agent",
    model: "Llama 3",
    status: "stopped",
    tasks: 72,
    description: "Monitors infrastructure, triggers deployments, and reports on system health.",
    lastRun: "3 days ago",
  },
];

export default function AgentGrid() {
  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Your Agents</h2>
        <span className="text-xs text-white/40">{MOCK_AGENTS.length} agents</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_AGENTS.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </section>
  );
}
