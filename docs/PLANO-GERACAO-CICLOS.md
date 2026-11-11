# Bizu Tracker — Plano: ciclos com tópicos, IA e assinatura

> Melhoria da geração de ciclos de estudo: planejamento no nível do tópico,
> organização da matéria com subtópicos (manual e com IA) e preparação para
> restrição por assinatura.
>
> Status: **Fases 1 e 2 implementadas** (migrações `0011` e `0012` pendentes de aplicação) · Data: 2026-11-10 · Complementa [PLANO.md](./PLANO.md)

---

## 1. Diagnóstico (estado atual)

1. **O ciclo ignora os tópicos.** `src/lib/cycle-generator.ts` distribui minutos
   entre as matérias por peso, mas um bloco "Direito Constitucional 90min" não diz
   *o que* estudar. O progresso por tópico existe
   (`supabase/migrations/0005_topic_progress.sql`) mas não alimenta a geração.
2. **A geração atual não é IA.** É um algoritmo determinístico (round-robin por
   dia). IA só existe na extração do edital (`src/lib/ai/extract-edital.ts`,
   Gemini flash-lite ou OpenAI-compatible).
3. **A árvore é limitada para organizar manualmente.** `edital-tree.tsx` permite
   adicionar/renomear/excluir — sem reordenar, reparentar, mover entre
   disciplinas ou editar em lote.
4. **A cota é fixa e hardcoded.** `0010_extraction_quota.sql`: 20 extrações/dia
   dentro do RPC — sem preparo para planos de assinatura.

## 2. Ideia central

**Planejar no nível do tópico, com IA como camada opcional sobre um motor
determinístico forte — e costurar o "seam" de assinatura agora, sem construir o
cobrador ainda.**

Unidade de planejamento = **tópico (nível 2)** da árvore do edital. Subtópicos
(nível 3) funcionam como checklist interno do tópico. Planejar no nível 3
fragmentaria o ciclo em blocos irreais.

## 3. Blocos com tópico

- `cycle_blocks` ganha `topic_id` + `topic_name` (mesmo padrão das sessões na
  migração 0004). Migração 0011.
- O card do ciclo mostra "Direito Constitucional — Direitos e garantias
  fundamentais"; o timer já tem o dropdown de tópicos pronto para receber isso.
- Ciclos antigos e **cópias de ciclos públicos** ficam com `topic_id = null`
  (o vínculo pertence a outro edital — mesmo tratamento que `subject_id` tem
  hoje no `duplicateCycle`).

## 4. Gerador determinístico v2 (grátis)

O motor atual evolui para receber a árvore completa com `status` e
`progress_studied`:

- **Priorização:** `NOT_STARTED` > `IN_PROGRESS`; `DONE` sai da fila. Quando
  tudo estiver `DONE`, gera blocos de `REVIEW` (revisão espaçada lite, sem IA).
- **Regras novas:** não repetir o mesmo tópico no mesmo dia; intercalar
  matérias pesadas e leves por dia; respeitar `maxBlockMin` por tópico.
- **Entrada extra:** últimas sessões por tópico (última data estudada) —
  tópico estudado há mais de 14 dias ganha prioridade.

**Por que primeiro?** Custo zero, previsível, testável com unit tests (função
pura). O valor percebido é quase o mesmo da IA: "o ciclo sabe o que eu ainda
não estudei". E vira o fallback eterno da IA.

## 5. Geração com IA (premium)

Novo método no `LlmProvider`: `planCycle(...)` com schema JSON validado por
zod. Regras duras:

- **IA nunca grava.** A resposta passa por validação de constraints (soma de
  minutos ≈ meta, tópicos existem no edital do usuário, dias dentro do
  período). Falhou? Cai no gerador determinístico — o usuário só vê o aviso
  "geração automática".
- **Entrada:** árvore compacta (matéria → tópicos com status) + restrições
  (dias, meta, máximo por bloco) + últimas sessões.
- **Saída:** apenas os blocos com tópico — **sem justificativa em linguagem
  natural** (mais barato e menor chance de alucinação).
- **Cache por hash das entradas** (mesmo padrão do cache de extração) —
  repetir o mesmo pedido custa zero.
- Custo estimado: saída pequena (50–200 blocos); roda bem no gemini-flash-lite.

## 6. Organizar a matéria com subtópicos (manual + IA)

**Manual** (melhorias da árvore): arrastar para reordenar/reparentar, mover
tópico entre disciplinas, busca/filtro para editais grandes.

**Com IA, sempre com revisão — nunca auto-aplica:**

- **"Refinar com IA":** detecta tópicos duplicados, nomes inconsistentes ou
  granularidade errada e propõe mesclagens/renomeações. UI de diff: aplica
  sugestão por sugestão.
- **"Completar com IA":** sugere tópicos ausentes comparando com o programa
  típico da banca (mais arriscado — a sugestão deve citar "por que" para o
  usuário julgar).

Cuidado com mesclagem de tópicos: `study_sessions.topic_id` aponta para nós da
árvore — a mesclagem precisa re-apontar as sessões antes de excluir o nó (ou
soft-delete).

## 7. Costura da assinatura (seams agora, cobrador depois)

**Não construir cobrança ainda.** Construir o *entitlement* de um jeito que a
cobrança entre sem refatorar:

- Tabela `subscriptions` separada (`stripe_customer`, `plan`, `status`,
  `current_period_end`) — dados de pagamento não entram em `profiles`. Webhook
  do Stripe escreve nela.
- Refatorar a cota da migração 0010: vira `consume_ai_quota(kind)` genérica
  (`kind` = `extraction` | `refine` | `plan_cycle`) + tabela de limites **por
  plano** no banco.
- **Um ponto único de checagem no servidor** (`canUseAiFeature(user, kind)`) —
  o cliente nunca decide sozinho o que é permitido; o paywall é um componente
  reutilizável que aparece quando o servidor nega.
- **Nunca gate de dados:** edição manual, gerador determinístico, exportação e
  histórico ficam livres para sempre. Só IA (que tem custo real) é premium.
- **Auditoria de custo desde já:** logar o custo de IA por feature (qual
  feature, quantos tokens, quanto custou) para precificar bem depois.

## 8. Fases de implementação

| Fase | Escopo | Depende de |
|---|---|---|
| **1** ✅ | Migração `topic_id` + gerador v2 determinístico + tópico visível no card do ciclo/editor | — |
| **2** ✅ | Melhorias manuais da árvore + Refinar/Completar com IA (com diff) + cota genérica | 1 |
| **3** | `planCycle` com IA + UI "Gerar com IA" (já nasce atrás do entitlement) | 2 |
| **4** | Assinatura de verdade (Stripe + PIX, portal, webhook) — épico separado | 3 |

### Notas da Fase 2

- **Organização manual:** busca na árvore, reordenar (cima/baixo) e mover para outro pai do mesmo nível. O arrasto previsto inicialmente foi trocado por menu + diálogo de destino: funciona em touch, mantém o alvo explícito e não conflita com o clique para renomear. A validação de nível/ciclo fica no RPC `move_edital_subject`.
- **Refinar com IA:** propõe mesclagens (só entre irmãos), renomeações e movimentos. Toda resposta é validada contra a árvore atual antes de aparecer; a aplicação revalida no servidor. Mesclagens preservam sessões, questões e blocos de ciclo (RPC `merge_edital_subject`).
- **Completar com IA:** sugere tópicos ausentes por disciplina com base na banca; só adiciona após confirmação, sem duplicar nomes existentes.
- **Cota genérica:** `consume_ai_quota(kind)` com limites mensais em `ai_quota_limits` (FREE): extração 10, refinamento 5, complemento 5, geração de ciclo 3. A função antiga `consume_extraction_quota` continua como wrapper.
- **Limitações conhecidas:** sugestões de IA não são cacheadas (cada análise consome cota); `plan_cycle` já tem limite reservado, mas a feature só chega na Fase 3.

Cada fase fecha com valor entregue; nada fica esperando a fase 4.

## 9. Decisões confirmadas

1. **Unidade de planejamento = tópico (nível 2)**, com subtópicos como
   checklist. ✔ de acordo
2. **IA na geração: só os blocos**, sem justificativa em linguagem natural por
   dia. ✔ confirmado
3. **Free tier:** ~10 extrações/mês + 3 gerações de ciclo/mês; geração
   determinística ilimitada. ✔ confirmado (no momento)

## 10. Extensões futuras (habilitadas pelo schema novo)

- O gerador pode priorizar tópicos com taxa de erro alta nas questões
  (`questions`) — candidato a fase 5.
- Revisão espaçada com modelo real (dados de sessões por tópico acumulados
  desde a fase 1).
- Compartilhar "planos de ciclo com IA" entre usuários (cache por hash já
  previsto).

## 11. Fora de escopo

- Integração de pagamento (fase 4 — épico separado, após validação das fases 1–3).
- Justificativas em linguagem natural na geração (descartado pela decisão 2).
- Planejamento no nível 3 (subtópico) — descartado pela decisão 1.
