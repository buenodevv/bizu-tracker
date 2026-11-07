# Bizu Tracker — Arquitetura Técnica

> Stack: **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui**, backend e dados
> em **Supabase** (Postgres + Auth + Storage + RLS). Complementa o [PLANO.md](./PLANO.md).

---

## 1. Stack

| Camada | Tecnologia | Nota |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** + TypeScript | Server Components + Route Handlers |
| UI | **Tailwind CSS** + **shadcn/ui** | tema via CSS variables, dark mode pronto |
| Estado/HTTP | TanStack Query + Zustand | Zustand apenas para o estado transiente do timer |
| Gráficos | Recharts | barras, linhas, donut, heatmap custom |
| Backend/rotas | Next.js Route Handlers + Server Actions | serverless-friendly |
| Banco | **Supabase (PostgreSQL 15/16)** | `supabase-js` no client, `@supabase/ssr` p/ cookies |
| Auth | **Supabase Auth** (e-mail/senha + OAuth Google) | JWT no cookie, refresh automático |
| RLS | **Row Level Security** | a base da autorização (ver seção 7) |
| Migrations | SQL migrations no banco Supabase (CLI) | `supabase db push` / migrations versionadas |
| IA | OpenAI-compatible API (provider pluggável) | extração do edital |
| Storage | **Supabase Storage** (bucket privado `editals`) | PDFs de edital |
| Jobs/filas | Route Handler + **Supabase via pg_net / vendas externas** | ver seção 5 (assíncrono) |
| Deploy | **Vercel** (Next.js) + projeto Supabase | CI GitHub Actions |
| Testes | Vitest (unit) + Playwright (E2E) | |

---

## 2. Decisões que o Supabase já resolve (sugestões adotadas)

1. **Auth completa**: não precisa implementar senha/JWT/OAuth na mão — o Supabase Auth
   entrega cadastro, login, confirmação de e-mail, reset de senha, Google OAuth e sessão
   via cookies (`@supabase/ssr`). Recomendo **e-mail/senha + Google OAuth** desde o MVP.
2. **Postgres hospedado** com migrações em SQL (não usar Prisma) — o ecossistema Supabase
   (RLS, tipos gerados, Realtime) funciona melhor com SQL nativo/`supabase-js`.
3. **RLS como autorização**: em vez de checar `userId` em cada endpoint, o banco garante
   isolamento por usuário. Camada de app faz validação de negócio (zod) por cima.
4. **Storage para PDFs**: bucket privado com URLs assinadas — sem S3/MinIO próprio.
5. **Realtime (opcional, fase 2)**: assinar mudanças para atualizar dashboard sem refresh.

**Sugestão de modelo de dado**: como `auth.users` já existe, criamos uma tabela
`public.profiles` (`id` = `auth.users.id`, FK) para meta semanal, nome e timezone. As
demais tabelas referenciam `profiles.id` (e não `auth.users`) via RLS usando
`auth.uid() = user_id`.

---

## 3. O que ainda precisa de uma decisão/camada extra (sugestões)

1. **Job de extração do edital (IA)**: o processo pode levar >10–30s. Opções:
   - **Recomendado p/ MVP:** Route Handler + fila leve com **Inngest** ou **Trigger.dev**
     (both serverless-first, free tier generoso, integram bem com Next/Vercel).
   - Simples: execução síncrona com streaming/timeouts no Vercel (limitado a ~60s) — ok
     para editais curtos; ou **Edge Function do Supabase** (Deno) chamando a IA.
   - Full self-managed: **BullMQ + Redis** só se for escalar muito (custo extra).
2. **Faturamento/plano (fase 2)**: Stripe + webhooks; níveis Free/Pro limitando nº de
   áreas/editais ativos.
3. **Analytics agregados**: começar com queries SQL agrupadas (views) + `@supabase/ssr`.
   Se escalar, espelhar em **Postgres materialized views** ou um microserviço de métricas.

---

## 4. Estrutura do repositório

```
bizu-tracker/
├── src/
│   ├── app/                      # App Router
│   │   ├── (auth)/login, /register/...
│   │   ├── (app)/dashboard, /timer, /questions, /cycles, /edital
│   │   └── api/                  # Route Handlers (analytics, extract, share...)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui (generated)
│   │   └── features/             # timer, charts, editor...
│   ├── features/                 # hooks (useQuery/useMutation), lógica por domínio
│   ├── lib/
│   │   ├── supabase/             # client browser, server, admin
│   │   └── ai/                   # extractEdital provider
│   ├── server/                   # Server Actions, services
│   ├── types/                    # Database types (supabase gen types)
│   └── store/                    # zustand (timer)
├── supabase/
│   ├── migrations/               # SQL versionado (tables, RLS, functions, views)
│   └── config.toml
├── components.json               # shadcn/ui config
├── .env.local                    # NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE...
```

Nomeclatura de variáveis (`lib/` em vez de `utils/`) segue a convenção shadcn/Next.

---

## 5. Modelo de dados (SQL / Supabase)

`auth.users` é gerenciado pelo Supabase. Criamos o restante:

```sql
-- profile do usuário (1:1 com auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  weekly_goal_min int not null default 1200,   -- minutos/semana
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.area_type as enum ('CONCURSO', 'VESTIBULAR');
create type public.edital_status as enum ('DRAFT', 'ACTIVE');
create type public.importance as enum ('CAI_POUCO', 'CAI_MEDIO', 'CAI_MUITO');
create type public.progress_status as enum ('NOT_STARTED', 'IN_PROGRESS', 'REVISED', 'DONE');
create type public.activity_type as enum ('THEORY', 'QUESTIONS', 'REVIEW', 'SIMULATED');
create type public.level as enum ('EASY', 'MEDIUM', 'HARD');
create type public.result as enum ('CORRECT', 'WRONG', 'SKIPPED');
create type public.entity_type as enum ('CYCLE', 'EDITAL');

-- área de estudo (concurso/vestibular alvo)
create table public.study_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_type public.area_type not null default 'CONCURSO',
  exam_board text,
  exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- edital verticalizado (cabeçalho)
create table public.editals (
  id uuid primary key default gen_random_uuid(),
  study_area_id uuid not null references public.study_areas(id) on delete cascade,
  title text not null,
  source_pdf_path text,                -- path no Storage
  raw_text text,                       -- texto extraído (reprocessar)
  status public.edital_status not null default 'DRAFT',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- árvore disciplinas→tópicos→subtópicos (simples: pai/filho recursivo)
create table public.edital_subjects (
  id uuid primary key default gen_random_uuid(),
  edital_id uuid not null references public.editals(id) on delete cascade,
  parent_id uuid references public.edital_subjects(id) on delete cascade,
  name text not null,
  weight numeric,                       -- 0–1, priorização
  importance public.importance not null default 'CAI_MEDIO',
  sort_order int not null default 0,
  progress_studied numeric not null default 0,   -- 0–100
  status public.progress_status not null default 'NOT_STARTED'
);

-- ciclos de estudo
create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  study_area_id uuid not null references public.study_areas(id) on delete cascade,
  name text not null,
  description text,
  period_days int not null default 7,
  is_public boolean not null default false,
  source_cycle_id uuid references public.cycles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cycle_blocks (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  subject_id uuid references public.edital_subjects(id) on delete set null,
  subject_name text not null,
  activity public.activity_type not null default 'THEORY',
  minutes int not null default 0,
  day_of_cycle int not null default 0,  -- 0..period_days-1
  sort_order int not null default 0
);

-- sessões de estudo (timer)
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  study_area_id uuid references public.study_areas(id) on delete set null,
  subject_id uuid references public.edital_subjects(id) on delete set null,
  subject_name text not null,
  activity public.activity_type not null default 'THEORY',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec int not null default 0 -- segundos efetivos (exclui pausas)
);

-- questões resolvidas
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  study_area_id uuid references public.study_areas(id) on delete set null,
  subject_id uuid references public.edital_subjects(id) on delete set null,
  subject_name text not null,
  exam_board text,
  level public.level not null default 'MEDIUM',
  result public.result not null default 'CORRECT',
  took_sec int,
  answered_at timestamptz not null default now(),
  notes text
);

-- links de compartilhamento (leitura pública)
create table public.shared_links (
  id uuid primary key default gen_random_uuid(),
  entity_type public.entity_type not null,
  entity_id uuid not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (entity_type, entity_id)
);
```

### Índices recomendados

```sql
create index on public.study_areas (user_id);
create index on public.editals (study_area_id);
create index on public.edital_subjects (edital_id);
create index on public.cycles (study_area_id);
create index on public.cycle_blocks (cycle_id);
create index on public.study_sessions (user_id, started_at desc);
create index on public.study_sessions (study_area_id, started_at desc);
create index on public.questions (user_id, answered_at desc);
create index on public.questions (subject_id, answered_at desc);
```

---

## 6. Segurança — RLS (base da autorização)

Regra geral: toda tabela privada fica bloqueada por padrão e é liberada com políticas
usando `auth.uid()`. Exemplo:

```sql
alter table public.profiles enable row level security;
alter table public.study_areas enable row level security;
-- (habilitar RLS em TODAS as tabelas privadas)

create policy "own profile" on public.profiles
  for all using (auth.uid() = id);

create policy "own areas" on public.study_areas
  for all using (auth.uid() = user_id);
```

Para **entidades encadeadas** (ex.: questões que pertencem a uma área do usuário), usar
políticas que resolvem o dono via subquery:

```sql
create policy "own area questions" on public.questions
  for all using (
    auth.uid() = user_id                      -- dono direto
  );
-- quando authorization for via área, checar exists (select 1 from study_areas ...)
```

**Leitura pública (compartilhamento)**: apenas `shared_links` e os recursos marcados
`is_public = true` têm policy `for select using (true)` (ou via `slug`). Nada de expor
dados privados.

**Duas chaves de cliente**:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → usada no browser; respeita RLS.
- `SUPABASE_SERVICE_ROLE_KEY` → **somente server-side** (Server Actions/Route Handlers),
  contorna RLS; usar com cuidado (jobs, extração IA) e nunca expor ao client.

---

## 7. API e acesso a dados (paradigma Next + Supabase)

- **Leitura**: `supabase-js` direto no client (em Server Components e/ou hooks com
  TanStack Query). O RLS garante a segurança; sem camada HTTP intermediária.
- **Escrita**: Server Actions ou Route Handlers validando com **zod** antes do insert.
- **Route Handlers** (sob `app/api/`) apenas onde precisar: endpoints públicos
  (`/api/share/:slug`), callbacks de IA/Stripe, e operações com service role.

### Mapas de responsabilidade (roteamento)

| Domínio | Abordagem |
|---|---|
| Auth | Supabase Auth (cookies via `@supabase/ssr`) — login/register/logout |
| Areas/Edital/Ciclos/Sessões/Questões | Server Actions + `supabase-js` (RLS) |
| Analytics | RPC (funções/views SQL) chamadas via Server Components |
| Extração IA (`/api/edital/extract`) | Route Handler + Inngest/Trigger.dev (job) |
| Share público (`/api/share/:slug`) | Route Handler (leitura pública) |
| Realtime (fase 2) | Supabase Realtime channels |

### Funções SQL (RPC) para analytics

Em vez de computar no app, agregar no banco (mais rápido, menos dados transferidos):

```sql
create function public.analytics_hours_by_subject(
  _user_id uuid, _from date, _to date
) returns table (subject_name text, total_min numeric) language sql stable as $$
  select subject_name, sum(duration_sec)::numeric/60
  from public.study_sessions
  where user_id = _user_id
    and started_at >= _from::timestamptz
    and started_at <  (_to::timestamptz + interval '1 day')
  group by subject_name;
$$;
```

Callable via `supabase.rpc('analytics_hours_by_subject', {...})`.

---

## 8. Pipeline de extração do edital (IA)

Fluxo assíncrono usando **Inngest** (ou Trigger.dev) — serverless-first:

```
1. Server Action "upload edital"
   → faz upload do PDF no Supabase Storage (bucket 'editals', privado)
   → insere Edital(status=DRAFT) e guarda source_pdf_path
2. Dispara evento Inngest "edital/extract" (payload: editalId)
3. Função Inngest (roda a cada enqueue):
   a. baixa o PDF do Storage (service role)
   b. extrai texto (pdf-parse no Node / unstructured)
   c. monta prompt estruturado
   d. chama LLM pedindo JSON em schema (zod)
   e. valida/normaliza árvore disciplinas→tópicos→subtópicos
   f. grava edital_subjects com weight/importance, status do Edital = DRAFT
4. Frontend faz polling do status (coluna em editals ou tabela de jobs)
5. Usuário revisa no editor e aprova (DRAFT → ACTIVE)
```

**Contrato JSON de saída da IA** (validação com zod):

```ts
type ExtractedEdital = {
  title: string;
  examBoard?: string;
  subjects: Array<{
    name: string;
    importance: "CAI_POUCO" | "CAI_MEDIO" | "CAI_MUITO";
    weight: number;                 // 0–1
    topics: Array<{
      name: string;
      subtopics: string[];
    }>;
  }>;
};
```

**Padrão de prompt:** extrair somente disciplinas/tópicos do edital, ignorar texto
administrativo (inscrição, cronograma), inferir importância a partir de pesos/incidência.
Temperature baixa (0–0.2), saída JSON via function-calling ou `response_format: json_object`.

**Provider pluggável:** `extractEdital(text): Promise<ExtractedEdital>` com implementação
OpenAI-compatível; fallback manual (usuário monta à mão) se IA indisponível.

> **Alternativa sem fila externa**: Supabase **Edge Function** (Deno) chamando a IA, com o
> cliente fazendo polling. Mais simples, porém menos controle de retry/observabilidade.

---

## 9. Geração de ciclos a partir do edital (algoritmo)

Entrada: `studyAreaId`, `weeklyGoalMin`, `daysPerWeek`, `cyclePeriodDays`.

```
1. Lê edital_subjects ativos (weight, importance).
2. Normaliza peso: effectiveWeight = weight (ou média de importance).
3. Minutos por matéria ∝ peso:
   blockMinutes = round(weeklyGoalMin * effectiveWeight / Σweights)
4. Distribui blocos nos dias respeitando daysPerWeek.
5. Progresso baixo + importance ALTA → prioriza ordem.
6. Monta Cycle + CycleBlock[]; retorna para o usuário editar antes de salvar.
```

Revisão espaçada (fase 2): inserir blocos `REVIEW` automáticos para tópicos estudados há X dias.

---

## 10. Frontend — estrutura de features

```
features/
├── auth/         # supabase-ssr: signIn/signUp/signOut, callbacks
├── dashboard/    # summary + gráficos + heatmap
├── timer/        # cronômetro (zustand), modo foco, pomodoro
├── sessions/     # listagem/histórico
├── questions/    # registro (form + bulk) e lista
├── analytics/    # horas por matéria, acurácia, pontos fracos
├── cycles/       # editor de ciclo + geração + compartilhar/copiar
└── edital/       # upload, revisão (árvore editável), progresso
```

- Server Components para leitura pesada (dashboard/analytics); Client Components para
  interatividade (timer, editor, formulários).
- Estado global mínimo: só o timer em **Zustand**; o resto via **TanStack Query**
  (caches as chamadas `supabase-js`).
- shadcn/ui para todos os primitivos (Dialog, Tabs, Slider, etc.).

Chaves de gráficos (Recharts):
- Horas por matéria: `BarChart` stacked ou `PieChart`.
- Acurácia no tempo: `LineChart`.
- Consistência: heatmap custom (grid de células).
- Resumo: cards + `RadialBarChart` para meta vs realizado.

---

## 11. Observabilidade e operação

- Logs estruturados (pino) nos Route Handlers/Server Actions.
- Errors: **Sentry** (Vercel integration) — fase 2.
- Observabilidade do job IA via painel do Inngest/Trigger.dev (retries, falhas).
- Healthcheck: `/api/health` (checa conexão Supabase).
- Migrations versionadas em `supabase/migrations`; `supabase db push` no deploy.
- Branching environments do Supabase para preview (Vercel preview + Supabase branch).

---

## 12. Configuração de ambiente (`.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # cliente (RLS)
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # server-side apenas

# IA
OPENAI_API_KEY=sk-...                          # ou outro provider
LLM_MODEL=gpt-4o-mini

# Job queue (escolha uma)
INNGEST_EVENT_KEY=...                          # ou TRIGGER_SECRET_KEY=...

# Futuro
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=...
```

---

## 13. Como iniciar o projeto (próximos passos de código)

- [x] `create-next-app` (App Router + TS + Tailwind) + `shadcn init`
- [x] Projeto Supabase clients: `@supabase/supabase-js` e `@supabase/ssr`
- [x] `src/types/database.ts` provisório (regerar com `supabase gen types`)
- [x] `supabase/migrations/0001_init.sql` (tabelas + enums + RLS + índices)
- [x] Auth completo (login/register/logout/callback) + proxy de sessão
- [x] Layout base (sidebar, header, dashboard com dados reais)
- [ ] Implementar na ordem do roadmap: timer/sessões → analytics → questões
  → ciclos → edital/IA.
- [ ] Configurar job queue (Inngest/Trigger.dev) ao chegar na fase do edital.
- [ ] CI: lint + typecheck + test + build em cada PR (GitHub Actions).

---

## 14. Resumo das sugestões (decisões recomendadas)

| Tema | Sugestão |
|---|---|
| Auth | Supabase Auth (e-mail+senha + Google OAuth) — não implementar na mão |
| Camada de dados | `supabase-js` + Server Actions; **não usar Prisma/API própria** |
| Autorização | **RLS** com `auth.uid()`, service role só no servidor |
| Verificação de schema | zod nos Server Actions; tipos gerados do banco (`gen types`) |
| Jobs de IA | **Inngest** ou **Trigger.dev** (serverless-first) para extrair edital |
| Storage de PDF | Supabase Storage (bucket privado, URL assinada) |
| Analytics | Funções/views SQL (RPC), evitando agregar no client |
| Deploy | Vercel (Next.js) + Supabase, com preview branches |
| Pagamento (fase 2) | Stripe + webhooks, níveis do plano |

---

## 15. Notas da implementação (o que o scaffold real exigiu)

Descoberto ao implementar a fundação com **Next.js 16.4.5** + **shadcn "base-nova"**:

1. **`middleware.ts` → `proxy.ts`** (Next 16). A renovação de sessão do Supabase fica
   em `src/proxy.ts`, exportando `export function proxy(...)`.
2. **`params` / `searchParams` são Promises** — sempre `await`. Páginas que os leem
   precisam de `<Suspense>` porque são runtime APIs.
3. **Cache Components + Partial Prefetching vêm ativos** no scaffold. Toda leitura de
   `cookies()`/sessão deve estar dentro de `<Suspense>` — inclusive o header e o
   dashboard. Rotas aparecem como `◐ (Partial Prerender)` no build.
4. **shadcn/ui usa `@base-ui/react`**, não Radix:
   - composição por `render={<Componente />}` (com children), **não** `asChild`;
   - itens de menu usam `onClick` (não `onSelect`).
5. **Tailwind v4** com plugin `@tailwindcss/turbopack` e `@import "tailwindcss"` (sem
   `tailwind.config.js`); tokens de tema em `globals.css` via `@theme inline`.
6. `turbopack.root` no `next.config.ts` evita o warning de lockfiles do diretório pai.
7. **Não** é possível ter um componente que só chama `redirect()` e retorna `void` como
   JSX — declarar o tipo de retorno explicitamente (ex.: `Promise<null>`).
