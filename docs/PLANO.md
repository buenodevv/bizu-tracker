# Bizu Tracker — Plano do Gerenciador de Estudos

> Gerenciador de estudos para concurseiros e vestibulandos: cronômetro integrado,
> gráficos de rendimento por matéria, estatísticas de questões, ciclos de estudo
> compartilháveis, geração de planos em ciclos e edital verticalizado a partir do edital.

Versão alvo: **MVP SaaS** (Next.js + Tailwind + shadcn/ui + Supabase), com stack definida na
[ARQUITETURA.md](./ARQUITETURA.md).

---

## 1. Visão e problema

Concurseiros e vestibulandos estudam sozinhos e perdem tempo com:
- Controle manual de horas/cronômetro em apps desconexos (Timer, planilha, caderno).
- Falta de visão objetiva de quais matérias rendem mais/menos.
- Zero noção de progresso real em questões por matéria/banca.
- Ciclos de estudo criados do zero, sem poder reaproveitar ou compartilhar.
- Editais extensos (PDF) difíceis de transformar em plano de ação (edital verticalizado).

**Proposta de valor:** um único lugar onde a pessoa **cronometra, registra questões,
enxerga rendimento e gera o plano de estudos** — incluindo edital verticalizado a partir
do PDF do edital.

---

## 2. Personas e jornadas

### 2.1 Personas
- **Concurseiro(a):** foco em editais específicos (banca, cargo), ciclos com revisão espaçada.
- **Vestibulando(a):** foco em matérias do ENEM/vestibulares, questões de provas anteriores.
- **Comunidade/moderador:** cria e compartilha ciclos de estudo e editais verticalizados públicos.

### 2.2 Jornada principal (happy path)
1. Cadastro/login → cria **área de estudo** (concurso/vestibular alvo).
2. Faz **upload do PDF do edital** → IA extrai e gera **edital verticalizado** (rascunho) → revisa/ajusta.
3. Gera **plano de estudo em ciclos** (distribuição de horas por matéria com base no edital/meta).
4. Estuda com o **cronômetro por sessão** (matéria + atividade: teoria/questões/revisão).
5. Registra **questões resolvidas** (matéria, banca, nível, acertos/erros).
6. Acompanha **gráficos de rendimento** e **estatísticas de questões**.
7. **Compartilha** o ciclo/edital com amigos ou comunidade.

---

## 3. Funcionalidades (escopo)

### 3.1 Conta e Perfil
- Cadastro/login (e-mail/senha + OAuth Google), recuperação de senha.
- Perfil, meta semanal de horas, preferências (fuso, formato de hora, atalhos de timer).

### 3.2 Área de estudo (Study Area)
- Concurso/vestibular alvo (nome, banca, data da prova, estado).
- Uma área contém: edital verticalizado, ciclos, sessões, questões, métricas.

### 3.3 Cronômetro integrado (Timer)
- Sessão de estudo com: matéria, atividade (teoria / questões / revisão / simulados).
- Cronômetro com pausa/retomada, tela cheia, sons/notificação de fim de sessão.
- Pomodoro opcional (foco/pausa longa/curta) configurável.
- Histórico de sessões → alimenta gráficos e meta semanal.
- Tela de "modo foco" (bloqueio visual, mostrando matéria e tempo).

### 3.4 Gráficos de rendimento por matéria
- Horas estudadas por matéria (dia/semana/mês, stacked bar ou donut).
- Rendimento: acurácia em questões por matéria (linha no tempo).
- Comparativo meta vs. realizado (horas).
- Heatmap de consistência (estilo GitHub) de dias estudados.

### 3.5 Estatísticas de questões
- Banco de questões resolvidas: matéria, banca, nível, resultado (acerto/erro/pulou), tempo.
- Métricas: total, acurácia (%), questões/dia, distribuição por banca e nível.
- Identificação de "pontos fracos" (assuntos com menor acurácia e mais erros).
- Filtros por período e por matéria.

### 3.6 Ciclos de estudo (geração e compartilhamento)
- **Ciclo:** lista de blocos (matéria → minutos/horas) que se repetem em um período.
- Geração de ciclo a partir de: edital verticalizado (pesos) + meta semanal + prioridades.
- Edição manual (arrastar, adicionar/remover blocos, distribuição %).
- Compartilhamento: link público ou template público na comunidade (copiar para minha conta).

### 3.7 Edital verticalizado (a partir do edital)
- Upload de PDF → extração de texto.
- **IA sugere** estrutura (matérias/disciplinas → tópicos → subtópicos) + pesos/banca quando informados.
- **Usuário revisa/edita** em editor estruturado antes de salvar (híbrido).
- Tabela de progresso: tópico → % estudado / nº questões feitas / status (não iniciado, em andamento, revisado).
- Marcação de tópicos como "cai muito/cai pouco" para priorização no ciclo.

---

## 4. Fora de escopo do MVP
- App mobile nativo (fase 2: PWA ou React Native).
- Marketplace/monetização, ranking público, gamificação completa.
- Sincronização offline completa (fase 2).
- Compartilhamento multi-editoral em tempo real (fase 2 — usar snapshot/versões).

---

## 5. Modelo de dados (resumo — detalhes em ARQUITETURA.md)

Entidades centrais:

| Entidade | Descrição |
|---|---|
| `users` | Conta + perfil + meta |
| `study_areas` | Concurso/vestibular alvo |
| `editals` | Edital verticalizado (árvore disciplinas→tópicos→subtópicos) |
| `cycles` | Ciclo de estudo (blocos) + flags de compartilhamento |
| `study_sessions` | Sessão cronometrada (matéria, atividade, duração) |
| `questions` | Questão resolvida (matéria, banca, nível, resultado) |
| `shared_links` | Compartilhamento público de ciclo/edital |

Relacionamentos: `users 1—n study_areas 1—n {editals, cycles, sessions, questions}`.
Ciclos e editais têm vínculo `n—m` (um ciclo pode usar várias disciplinas do edital).

---

## 6. Arquitetura (resumo — detalhes em ARQUITETURA.md)

- **Frontend/Full-stack:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui.
- **Backend de dados:** Supabase — Postgres, Auth (login/OAuth), Storage (PDFs) e RLS.
- **Estado/HTTP:** TanStack Query + Zustand (timer); gráficos com Recharts.
- **IA:** pipeline de extração de edital (PDF → LLM → JSON) com job assíncrono
  (Inngest/Trigger.dev) e editor híbrido para revisão.
- **Deploy:** Vercel (Next.js) + projeto Supabase.

Diagrama de contexto em `docs/ARQUITETURA.md`.

---

## 7. Roadmap

### Fase 0 — Fundação (Sprint 1–2) ✅
- Next.js (App Router) + Tailwind + shadcn/ui, projeto Supabase, auth (e-mail/senha + Google).
- Migrations SQL (tabelas + RLS), CRUD de `study_areas` e `profiles`.

### Fase 1 — Núcleo de estudo (Sprint 3–5)
- Cronômetro + sessões + histórico.
- Metas semanais + heatmap de consistência.
- Gráficos de horas por matéria.

### Fase 2 — Questões e rendimento (Sprint 6–7)
- Registro de questões + métricas + gráficos de acurácia e pontos fracos.

### Fase 3 — Ciclos (Sprint 8–9)
- Criação/edição de ciclos, geração a partir do edital, compartilhamento.

### Fase 4 — Edital verticalizado + IA (Sprint 10–11)
- Upload PDF, extração com IA, editor híbrido, tabela de progresso.

### Fase 5 — Polimento e lançamento (Sprint 12)
- Onboarding, e-mails transacionais, observabilidade, testes E2E, deploy.

---

## 8. Métricas de sucesso (produto)
- % de usuários que completam 1 sessão cronometrada no 1º dia (ativação).
- Sessões/usuário/semana (retenção de engajamento).
- % que geram edital verticalizado a partir de PDF.
- Nº de ciclos compartilhados vs. copiados (virialidade).
