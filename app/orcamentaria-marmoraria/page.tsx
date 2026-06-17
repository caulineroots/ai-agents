"use client";

import { useEffect, useRef, useState } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const WHATSAPP_NUMBER = "5511914991065"; // DDI + DDD + número, sem espaços
const WHATSAPP_MESSAGE = "Olá Roberto, gostaria de saber mais da OrçamentarIA";
const WA_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

const PRODUCT_NAME = "OrçamentarIA";

// ─── BENEFÍCIOS ──────────────────────────────────────────────────────────────
const BENEFITS = [
  {
    title: "Orçamento em minutos",
    desc: "O que levava horas agora sai em menos de 10 minutos.",
  },
  {
    title: "Revisão item por item",
    desc: "Você confere cada peça antes de fechar. Controle total, com a velocidade da IA.",
  },
  {
    title: "Mais projetos, mais receita",
    desc: "Orça mais rápido, fecha mais contratos, sem precisar contratar mais gente.",
  },
];

// ─── HOOK: scroll-triggered reveal ───────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("lp-visible"); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── ANIMATED SECTION WRAPPER ────────────────────────────────────────────────
function Reveal({
  children,
  className = "",
  dir = "up",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  dir?: "up" | "left" | "right";
  delay?: number;
}) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`lp-reveal lp-reveal-${dir} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── COMPONENTES INTERNOS ─────────────────────────────────────────────────────

function CtaButton({ label = "Falar no WhatsApp agora →", large = false }: { label?: string; large?: boolean }) {
  return (
    <a
      href={WA_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-semibold rounded transition-all ${
        large ? "px-8 py-4 text-lg" : "px-6 py-3 text-base"
      }`}
    >
      {label}
    </a>
  );
}

function Divider() {
  return <div className="w-full h-px bg-zinc-800 my-0" />;
}

// ─── VIDEO DEMO ──────────────────────────────────────────────────────────────
const VIDEO_ID = "lih8UMRJiBo";

function VideoDemo() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="max-w-3xl mx-auto mb-10">
      <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-3">Demonstração</p>
      <div
        className="relative w-full rounded overflow-hidden border border-zinc-800 cursor-pointer group"
        style={{ paddingBottom: "56.25%" }}
        onClick={() => setPlaying(true)}
      >
        {playing ? (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
            title="OrçamentarIA: Demonstração"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            {/* Thumbnail */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lp-video-thumb.png"
              alt="Demonstração OrçamentarIA"
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center group-hover:bg-white/20 transition-all group-hover:scale-110">
                <div className="ml-1 w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function LpPage() {
  return (
    <>
      {/* LP-specific animation styles */}
      <style>{`
        /* word-by-word hero */
        @keyframes lp-word-in {
          from { opacity: 0; transform: translateY(18px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        .lp-word { display: inline-block; margin-right: 0.28em; opacity: 0; animation: lp-word-in 1s cubic-bezier(0.16,1,0.3,1) both; }
        .lp-w0 { animation-delay: 0s; }
        .lp-w1 { animation-delay: 0.28s; }
        .lp-w2 { animation-delay: 0.56s; }
        .lp-w3 { animation-delay: 0.84s; }
        .lp-w4 { animation-delay: 1.12s; }

        /* scroll reveal */
        @keyframes lp-fade-up   { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
        @keyframes lp-fade-left { from { opacity:0; transform:translateX(-32px); } to { opacity:1; transform:translateX(0); } }
        @keyframes lp-fade-right{ from { opacity:0; transform:translateX(32px); } to { opacity:1; transform:translateX(0); } }

        .lp-reveal { opacity: 0; }
        .lp-reveal.lp-visible { animation-fill-mode: both; animation-duration: 1.5s; animation-timing-function: cubic-bezier(0.16,1,0.3,1); }
        .lp-reveal-up.lp-visible    { animation-name: lp-fade-up; }
        .lp-reveal-left.lp-visible  { animation-name: lp-fade-left; }
        .lp-reveal-right.lp-visible { animation-name: lp-fade-right; }
      `}</style>

      <main className="bg-black text-zinc-100 font-sans antialiased">

        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-black/90 backdrop-blur border-b border-zinc-800/60">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <span className="text-lg font-bold tracking-tight text-white">{PRODUCT_NAME}</span>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 border border-violet-700 text-violet-300 rounded hover:bg-violet-900/30 transition-all"
            >
              Falar no WhatsApp
            </a>
          </div>
        </header>

        {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          {/* word-by-word headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight text-white mb-6">
            {["Orçamento", "de", "marmoraria"].map((w, i) => (
              <span key={i} className={`lp-word lp-w${i}`}>{w}</span>
            ))}
            <br />
            <span className="text-violet-400">
              {["em", "minutos."].map((w, i) => (
                <span key={i} className={`lp-word lp-w${i + 3}`}>{w}</span>
              ))}
            </span>
          </h1>

          <Reveal dir="up" delay={300}>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Se você demora mais de 30 minutos com qualquer orçamento, é pra você.
            </p>

            {/* Video demonstração */}
            <VideoDemo />

            <a
              href="/orcamentaria-marmoraria/demo"
              className="inline-block bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-semibold rounded transition-all px-8 py-4 text-lg"
            >
                Mexa na ferramenta agora com um projeto real →
            </a>
          </Reveal>
        </section>

        <Divider />

        {/* ── 2. PROBLEMA ─────────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-20 text-center">
          <Reveal dir="up" className="mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
              Você só demora pra fazer orçamentos porque precisa começar sempre do zero.
            </h2>
          </Reveal>

          <div className="flex flex-col gap-4 max-w-2xl mx-auto text-left">
            {[
              "Quem tem um pré-orçamento revisa muito mais rápido.",
              "Não perde horas analisando projeto e anotando em planilha ou papel.",
              "Envia orçamento mais rápido que o concorrente.",
            ].map((item, i) => (
              <Reveal key={i} dir="left" delay={i * 80}>
                <p className="text-zinc-300 text-lg leading-relaxed border-l-2 border-violet-800 pl-5">
                  {item}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── 3. COMO FUNCIONA ────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <Reveal dir="up" className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Simples como tirar uma foto
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Sobe a prancha", desc: "PDF do projeto, qualquer arquivo. Não importa o tamanho." },
              { step: "02", title: "IA analisa", desc: "Lê cada ambiente, cada peça, cada medida. Sem você tocar em nada." },
              { step: "03", title: "Pré-Orçamento", desc: "Revise item por item, ajuste o que quiser, e envie pro cliente." },
            ].map(({ step, title, desc }, i) => (
              <Reveal key={step} dir="up" delay={i * 100}>
                <div className="relative p-6 border border-zinc-800 rounded bg-zinc-900/30">
                  <div className="text-4xl font-black text-violet-400 mb-4">{step}</div>
                  <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── 3.5 POR DENTRO DA FERRAMENTA ────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <div className="flex flex-col gap-8">
            <Reveal dir="left">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="sm:w-1/3 flex-shrink-0 pt-2">
                  <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-2">Revisão item por item</p>
                  <p className="text-zinc-400 text-base leading-relaxed">A IA identifica cada peça do projeto: tampo, rodapé, material, medidas. Você vê tudo lado a lado com a prancha original e corrige o que precisar.</p>
                </div>
                <div className="flex-1 rounded overflow-hidden border border-zinc-800 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/screenshot-revisao.webp" alt="Tela de revisão do OrçamentarIA" className="w-full object-cover" />
                </div>
              </div>
            </Reveal>

            <Reveal dir="right">
              <div className="flex flex-col sm:flex-row-reverse items-start gap-6">
                <div className="sm:w-1/3 flex-shrink-0 pt-2">
                  <p className="text-sm font-semibold text-violet-400 uppercase tracking-widest mb-2">Orçamento gerado</p>
                  <p className="text-zinc-400 text-base leading-relaxed">Com tudo revisado, o sistema gera o orçamento completo: total por ambiente, por material, detalhado. Pronto pra enviar pro cliente.</p>
                </div>
                <div className="flex-1 rounded overflow-hidden border border-zinc-800 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/screenshot-orcamento.webp" alt="Tela de orçamento do OrçamentarIA" className="w-full object-cover" />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <Divider />

        {/* ── 4.5 PREÇO ───────────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-20 text-center">
          <Reveal dir="up" className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">Quanto custa?</h2>
            <p className="text-zinc-400 text-lg leading-relaxed mb-6">
              Depende do volume de projetos da sua marmoraria por semana. Quem orça 5 projetos tem uma necessidade diferente de quem orça 20.
            </p>
            <p className="text-zinc-300 text-lg leading-relaxed mb-8">
              Manda uma mensagem contando quantos projetos você faz por semana. A gente te passa o valor no mesmo dia.
            </p>
            <CtaButton label="Falar no WhatsApp sobre preço →" />
          </Reveal>
        </section>

        <Divider />

        {/* ── 5. PARA QUEM É ──────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-20 text-center">
          <Reveal dir="up">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-8 leading-tight">
              Feito pra quem vive de marmoraria
            </h2>
            <ul className="space-y-4 mb-10 inline-flex flex-col items-start text-left">
              {[
                "Donos de marmoraria que orçam 5 ou mais projetos por semana",
                "Equipes que perdem tempo copiando medidas à mão de prancha em prancha",
                "Quem quer crescer o faturamento sem precisar contratar mais gente pra orçar",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-violet-400 mt-1 flex-shrink-0">✓</span>
                  <span className="text-zinc-300 text-base leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal dir="up" delay={150}>
            <div className="border border-zinc-700 rounded p-6 bg-zinc-900/30 inline-block text-left max-w-xl w-full">
              <p className="text-zinc-400 text-sm font-semibold uppercase tracking-widest mb-4">Não é pra você se...</p>
              <ul className="space-y-3">
                {[
                  "Você orça 1 projeto por mês e tem tempo de sobra",
                  "Prefere continuar com planilha e não quer mudar nada",
                  "Não tem interesse em fechar mais contratos mais rápido",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-zinc-400 mt-1 flex-shrink-0 text-xs">✕</span>
                    <span className="text-zinc-300 text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        <Divider />

        {/* ── 6. QUEM SOMOS ───────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <Reveal dir="up" className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Tecnologia feita por quem<br />entende de marmoraria
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed mb-4">
              Não somos só uma empresa de software.
              Desenvolvemos essa solução em parceria direta com profissionais de marmoraria,
              entendendo cada serviço, cada material, cada detalhe de prancha técnica.
            </p>
            <p className="text-zinc-400 text-lg leading-relaxed">
              O resultado é uma IA que fala a linguagem do seu negócio:
              tampo, rodapé, soleira, vão, rebaixo.
              Nada de tecnologia genérica adaptada às pressas.
            </p>
          </Reveal>
        </section>

        <Divider />

        {/* ── 7. CTA FINAL ────────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-24 text-center">
          <Reveal dir="up">
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6 leading-tight">
              Seu próximo orçamento<br />
              <span className="text-violet-400">pode sair em 5 minutos.</span>
            </h2>
            <p className="text-zinc-500 text-base mb-10">
              Conseguimos integrar apenas <span className="text-zinc-300 font-semibold">1 nova marmoraria por semana.</span>
            </p>
            <CtaButton large label="Falar no WhatsApp agora →" />
          </Reveal>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-zinc-800 py-8">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-zinc-400 text-sm font-semibold">{PRODUCT_NAME}</span>
            <span className="text-zinc-500 text-xs">
              © {new Date().getFullYear()} · Todos os direitos reservados
            </span>
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 text-sm hover:text-zinc-200 transition-colors"
            >
              WhatsApp →
            </a>
          </div>
        </footer>

      </main>
    </>
  );
}
