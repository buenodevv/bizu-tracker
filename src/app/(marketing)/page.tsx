import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";

import {
  Check,
  ListChecks,
  Plus,
  Repeat,
  Timer,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const TITLE = "Bizu Tracker — do edital ao plano de estudos";
const DESCRIPTION =
  "Organize disciplinas e tópicos do edital, gere ciclos de estudo e acompanhe seu tempo, questões e rendimento. Grátis para começar.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "Bizu Tracker",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Bizu Tracker — do edital ao plano de estudos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

const SECONDARY_FEATURES = [
  {
    icon: Timer,
    title: "Cronômetro com pomodoro",
    text: "Registre sessões de foco com pausas — ou use o tempo livre e pare quando quiser.",
  },
  {
    icon: ListChecks,
    title: "Questões e acurácia",
    text: "Lance questões em lote e veja o desempenho por matéria, banca e nível.",
  },
  {
    icon: TrendingUp,
    title: "Rendimento que orienta",
    text: "Horas por matéria, evolução diária e cobertura do edital no mesmo painel.",
  },
  {
    icon: Repeat,
    title: "Ciclos compartilháveis",
    text: "Compartilhe um ciclo por link público e deixe outra pessoa copiar para a conta.",
  },
];

const STEPS = [
  {
    title: "Crie a área e envie o edital",
    text: "Escolha concurso ou vestibular. A IA extrai disciplinas e tópicos do PDF — ou você monta tudo à mão.",
  },
  {
    title: "Revise e gere o ciclo",
    text: "Ajuste importância e peso, defina a meta semanal e distribua os blocos da semana.",
  },
  {
    title: "Estude e acompanhe",
    text: "Use o cronômetro, registre questões e descubra onde investir a próxima revisão.",
  },
];

const FAQ = [
  {
    q: "Preciso enviar o PDF do edital?",
    a: "Não. O envio do PDF acelera a criação da árvore de disciplinas, mas você pode criar e editar tudo manualmente.",
  },
  {
    q: "Funciona para qualquer banca ou vestibular?",
    a: "Sim. O conteúdo é definido pelo edital que você cadastra. A extração por IA funciona melhor com PDFs que têm texto selecionável.",
  },
  {
    q: "A IA pode errar a extração?",
    a: "Pode. A extração é um ponto de partida: revise disciplinas e tópicos antes de ativar o edital. Tudo pode ser editado depois.",
  },
  {
    q: "Meus dados ficam privados?",
    a: "Sim. Cada conta acessa apenas os próprios dados. Um ciclo só fica visível publicamente se você ativar o compartilhamento.",
  },
  {
    q: "Quanto custa?",
    a: "O Bizu Tracker está em desenvolvimento e pode ser usado gratuitamente para começar.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. A interface é responsiva: cronômetro, questões, ciclos e edital funcionam no navegador do celular.",
  },
];

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-3 text-sm sm:text-base">
        {description}
      </p>
    </div>
  );
}

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Bizu Tracker",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description: DESCRIPTION,
    url: SITE_URL,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "BRL",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---------------------------------- HERO --------------------------------- */}
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:gap-14">
        <div className="flex flex-col gap-6">
          <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Do PDF do edital ao plano de estudos do dia.
          </h1>
          <p className="text-muted-foreground max-w-xl text-base sm:text-lg">
            O Bizu Tracker organiza disciplinas e tópicos, monta ciclos de
            estudo e acompanha seu tempo, questões e rendimento. Sem planilhas.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              render={<Link href="/register" />}
              nativeButton={false}
            >
              Criar minha conta
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<a href="#como-funciona" />}
              nativeButton={false}
            >
              Ver como funciona
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Grátis para começar. Funciona para concursos e vestibulares.
          </p>
        </div>

        <div className="bg-card overflow-hidden rounded-2xl ring-1 ring-foreground/10">
          <Image
            src="/shots/dashboard.png"
            alt="Dashboard do Bizu Tracker com meta semanal, questões, sequência de estudo e atalhos"
            width={1440}
            height={820}
            priority
            sizes="(max-width: 1024px) 100vw, 560px"
            className="h-auto w-full"
          />
        </div>
      </section>

      {/* -------------------------------- PROBLEMA ------------------------------- */}
      <section className="bg-card/60 border-y">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <p className="font-display text-2xl leading-snug font-medium text-balance sm:text-3xl">
            O edital está no PDF. O ciclo, na planilha. O tempo, na cabeça.
          </p>
          <p className="text-muted-foreground text-sm sm:text-base">
            O Bizu Tracker junta as três coisas em um fluxo só: você organiza o
            conteúdo, gera o ciclo a partir da sua meta e registra o que
            estudou. Com dados suficientes para decidir a próxima revisão.
          </p>
        </div>
      </section>

      {/* -------------------------------- RECURSOS ------------------------------- */}
      <section id="recursos" className="scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            title="Tudo o que o edital pede, organizado."
            description="Do conteúdo programático ao bloco do dia: cada parte do estudo tem um lugar, e tudo conversa entre si."
          />

          <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div className="flex flex-col gap-4">
              <h3 className="font-display text-2xl font-semibold tracking-tight">
                Envie o PDF. A estrutura vem pronta.
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                A IA lê o conteúdo programático e organiza disciplinas, tópicos
                e subtópicos. Você revisa o que quiser — e pode editar tudo à
                mão.
              </p>
              <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
                {[
                  "Disciplinas e tópicos em árvore",
                  "Importância e peso por disciplina",
                  "Edição, progresso e cobertura por tópico",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="text-primary mt-0.5 size-4 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Image
              src="/shots/edital.png"
              alt="Edital verticalizado com disciplinas, tópicos e importância"
              width={1440}
              height={900}
              sizes="(max-width: 1024px) 100vw, 560px"
              className="bg-card h-auto w-full rounded-xl ring-1 ring-foreground/10"
            />
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14">
            <Image
              src="/shots/cycles.png"
              alt="Ciclos de estudo com blocos distribuídos pelos dias da semana"
              width={1440}
              height={900}
              sizes="(max-width: 1024px) 100vw, 560px"
              className="bg-card h-auto w-full rounded-xl ring-1 ring-foreground/10 lg:order-1"
            />
            <div className="flex flex-col gap-4 lg:order-2">
              <h3 className="font-display text-2xl font-semibold tracking-tight">
                Um ciclo que cabe na sua semana.
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Defina a meta semanal e os dias do ciclo. O Bizu Tracker
                distribui as matérias em blocos de teoria, questões, revisão e
                simulado.
              </p>
              <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
                {[
                  "Geração automática a partir do edital",
                  "Ajuste manual de cada bloco",
                  "Compartilhe ou copie ciclos prontos",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="text-primary mt-0.5 size-4 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-16 grid gap-x-10 gap-y-8 border-t pt-10 sm:grid-cols-2">
            {SECONDARY_FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <Icon className="text-primary mt-0.5 size-5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ COMO FUNCIONA ---------------------------- */}
      <section id="como-funciona" className="bg-card/60 scroll-mt-20 border-y">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            title="Do primeiro envio à primeira sessão."
            description="Três passos para transformar o edital em uma rotina que você consegue seguir."
          />
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-3">
                <span className="font-display text-primary text-4xl font-semibold">
                  {index + 1}
                </span>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------- FAQ --------------------------------- */}
      <section id="duvidas" className="scroll-mt-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            title="Dúvidas comuns"
            description="Se a sua não estiver aqui, escreva para o e-mail no rodapé."
          />
          <div className="divide-y border-y">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <Plus className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-45" />
                </summary>
                <p className="text-muted-foreground mt-2 pr-8 text-sm">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- CTA FINAL ------------------------------ */}
      <section className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 py-20 sm:px-6">
          <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Comece pelo seu edital.
          </h2>
          <p className="text-muted-foreground max-w-xl text-sm sm:text-base">
            Crie sua conta, envie o PDF ou monte a estrutura à mão e veja sua
            semana tomar forma.
          </p>
          <Button
            size="lg"
            render={<Link href="/register" />}
            nativeButton={false}
          >
            Criar minha conta
          </Button>
        </div>
      </section>
    </>
  );
}
