import AgentGrid from "@/components/AgentGrid";
import Header from "@/components/Header";
import StatsBar from "@/components/StatsBar";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <StatsBar />
        <AgentGrid />
      </main>
    </div>
  );
}
