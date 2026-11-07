# Bizu Tracker

Gerenciador de estudos para **concurseiros e vestibulandos**: cronômetro integrado,
gráficos de rendimento por matéria, estatísticas de questões resolvidas, ciclos de estudo
compartilháveis e **edital verticalizado gerado por IA a partir do PDF do edital**.

> Stack: **Next.js 16 (App Router)** + TypeScript + **Tailwind CSS v4** + **shadcn/ui**
> com **Supabase** (Postgres + Auth + RLS) e **Google Gemini** para extração do edital.

📚 Planejamento: [`docs/PLANO.md`](docs/PLANO.md) ·
Arquitetura técnica: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)

---

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Cronômetro** | Modo livre e pomodoro (foco / pausa curta / longa), pausar/retomar, encerrar e salvar. Registra matéria, **tópico** e atividade (teoria, questões, revisão, simulado). |
| **Rendimento** | Horas por matéria, evolução diária e acurácia em questões, com filtro de período (7/30/90 dias e 1 ano). |
| **Questões** | Registro individual ou em lote (ex.: 20 questões, 15 acertos), nível e banca. Identifica automaticamente seus **pontos fracos**. |
| **Ciclos** | Geração automática a partir do edital e da meta semanal, editor por dia, **compartilhamento por link público** e cópia para sua conta. |
| **Edital verticalizado** | Upload do PDF → IA extrai disciplinas, tópicos e subtópicos → você revisa e ajusta. Progresso por tópico com atualização automática ao estudar. |
| **Dashboard** | Meta semanal, questões dos últimos 7 dias, sequência de dias estudados (streak) e atalhos. |

## Requisitos

- Node.js **20.9+**
- Conta no [Supabase](https://supabase.com)
- Chave do [Google AI Studio](https://aistudio.google.com/apikey) — **opcional** (só para a extração por IA)

## Como rodar

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o projeto no Supabase

1. Crie um projeto em <https://supabase.com/dashboard>
2. **Project Settings → API**: copie `Project URL`, a chave pública e a `service_role`

### 3. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha o `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Opcional — sem isso, a extração por IA fica desativada
GEMINI_API_KEY=
LLM_MODEL=gemini-flash-lite-latest
```

### 4. Aplicar as migrations

No **SQL Editor** do Supabase, execute os arquivos **em ordem**:

1. `supabase/migrations/0001_init.sql` — tabelas, enums, RLS
2. `supabase/migrations/0002_analytics.sql` — funções de métricas
3. `supabase/migrations/0003_extraction_cache.sql` — cache de extração (economia de IA)
4. `supabase/migrations/0004_session_topic.sql` — tópico na sessão de estudo
5. `supabase/migrations/0005_topic_progress.sql` — progresso automático do tópico

Ou, com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <seu-ref>
supabase db push
```

### 5. Configurar URLs de autenticação

Em **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: `http://localhost:3000/auth/callback`

### 6. Rodar

```bash
npm run dev
```

Abra <http://localhost:3000>.

## Estrutura do projeto

```
src/
├── app/
│   ├── (auth)/                # login, cadastro e server actions de auth
│   ├── (app)/                 # área autenticada (layout com sidebar)
│   │   ├── dashboard/         # resumo, meta, streak
│   │   ├── timer/             # cronômetro + histórico de sessões
│   │   ├── questions/         # registro e estatísticas de questões
│   │   ├── analytics/         # gráficos de rendimento
│   │   ├── cycles/            # ciclos de estudo
│   │   └── edital/            # edital verticalizado (+ extração por IA)
│   ├── cycles/public/[id]/    # página pública de ciclo compartilhado
│   ├── auth/callback/         # troca de code por sessão
│   └── proxy.ts               # renovação de sessão e proteção de rotas
├── components/
│   ├── ui/                    # shadcn/ui (base-ui)
│   ├── providers/             # TanStack Query
│   └── features/              # componentes por domínio
├── lib/
│   ├── supabase/              # clients browser/server
│   ├── ai/                    # extração do edital (provider + cache)
│   ├── auth.ts                # requireUser / getUser
│   ├── cycle-generator.ts     # algoritmo de geração de ciclos
│   └── format.ts              # formatação e rótulos pt-BR
├── store/timer-store.ts       # estado do cronômetro (Zustand)
├── proxy.ts                   # proxy do Next 16 (ex-middleware)
└── types/database.ts          # tipos do banco
supabase/migrations/           # SQL versionado
```

## Decisões técnicas

- **Next.js 16**: `middleware` virou `proxy.ts`; `params`/`searchParams` são Promises;
  Cache Components está ativo — leituras de sessão exigem `<Suspense>` e `connection()`.
- **Supabase + RLS**: toda autorização acontece no banco via `auth.uid()`.
- **shadcn/ui com base-ui**: composição por `render={<Componente />}` (não `asChild`);
  `<Select.Value>` só mostra o rótulo se `Select.Root` receber a prop `items`.
- **Extração por IA**: `pdf-parse` como `serverExternalPackages` (o worker precisa ser
  resolvido do `node_modules`); Gemini via `apiVersion: "v1beta"`; cache por hash SHA-256
  do texto — o mesmo edital só consome tokens uma vez.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | desenvolvimento (Turbopack) |
| `npm run build` | build de produção |
| `npm run start` | servir o build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | checagem de tipos |

## Licença

[MIT](LICENSE)
