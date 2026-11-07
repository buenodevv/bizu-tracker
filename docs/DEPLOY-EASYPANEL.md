# Deploy na VPS com Easypanel

Guia para publicar o Bizu Tracker na sua VPS usando o [Easypanel](https://easypanel.io).

> Para deploy na Vercel, veja [README.md](../README.md). A VPS tem vantagem para
> este projeto: a extração de PDF usa módulos nativos (`pdfjs-dist`/`@napi-rs`),
> que funcionam melhor em Node puro do que em serverless.

---

## 1. Pré-requisitos

- VPS com Easypanel instalado
- Repositório no GitHub: `https://github.com/buenodevv/bizu-tracker`
- Projeto no Supabase (URL + chaves)
- Chave do Google Gemini (opcional, para a extração por IA)

---

## 2. Antes de subir: aplicar as migrations

No **SQL Editor** do Supabase, execute os arquivos **em ordem**:

| # | Arquivo | Conteúdo |
|---|---|---|
| 1 | `0001_init.sql` | Tabelas, enums, RLS |
| 2 | `0002_analytics.sql` | Funções de métricas |
| 3 | `0003_extraction_cache.sql` | Cache de extração |
| 4 | `0004_session_topic.sql` | Tópico na sessão |
| 5 | `0005_topic_progress.sql` | Progresso automático |
| 6 | `0006_topic_analytics.sql` | Analytics e colunas de tópico |
| 7 | `0007_avatar.sql` | Avatar + bucket `avatars` |

---

## 3. Criar o app no Easypanel

1. No painel, crie um projeto (ex.: `bizu`)
2. **+ Create Service → App**
3. Configure a fonte:
   - **Source**: `GitHub`
   - **Repository**: `buenodevv/bizu-tracker`
   - **Branch**: `main`

### Build

O Easypanel detecta o `Dockerfile` automaticamente. Configure:

| Campo | Valor |
|---|---|
| **Build method** | Dockerfile |
| **Dockerfile path** | `Dockerfile` |
| **Build context** | `.` |

### Porta

| Campo | Valor |
|---|---|
| **Port** | `3000` |
| **Protocol** | HTTP |

---

## 4. Variáveis de ambiente

⚠️ **Atenção**: variáveis `NEXT_PUBLIC_*` são **embutidas no bundle durante o build**.
No Easypanel, marque essas três como **build-time** (ou preencha antes de construir).
As demais são lidas em runtime.

### Variáveis de build (obrigatório antes do build)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública do Supabase |
| `NEXT_PUBLIC_SITE_URL` | `https://seudominio.com` |

### Variáveis de runtime

| Variável | Descrição |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta (nunca exposta ao browser) |
| `GEMINI_API_KEY` | chave do AI Studio (opcional) |
| `LLM_MODEL` | `gemini-flash-lite-latest` |
| `NODE_ENV` | `production` |

> No Easypanel, adicione todas em **Environment** e marque as `NEXT_PUBLIC_*`
> como **Build Time** (ícone de engrenagem/lock ao lado da variável).

---

## 5. Domínio e HTTPS

1. Em **Domains**, adicione seu domínio (ex.: `bizu.seudominio.com`)
2. Aponte o DNS (`A` ou `CNAME`) para o IP da VPS
3. O Easypanel emite o certificado Let's Encrypt automaticamente

---

## 6. Configurar o Supabase para o domínio novo

Em **Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| **Site URL** | `https://bizu.seudominio.com` |
| **Redirect URLs** | `https://bizu.seudominio.com/auth/callback` |

> Sem isso, o login redireciona para `localhost` e quebra em produção.

---

## 7. Verificação pós-deploy

Acesse `https://seudominio.com/login`.

- [ ] A tela de login carrega com as cores índigo
- [ ] Cadastro e login funcionam
- [ ] O dashboard abre após autenticar
- [ ] Upload de foto de perfil (menú → Configurações)
- [ ] Enumeração de edital: criar área → criar edital → adicionar disciplina
- [ ] Upload de PDF: extração preenche disciplinas e tópicos
- [ ] Cronômetro salva sessão com matéria + tópico
- [ ] Link público de ciclo abre em aba anônima

---

## 8. Comandos úteis

```bash
# Reconstruir após novo push (o Easypanel tem "Deploy" na interface)
git push origin main

# Ver logs
# → no painel do serviço, aba "Logs"

# Reiniciar
# → botão "Restart" no serviço
```

---

## Problemas comuns

### "Service is not reachable" mesmo com o container rodando

Aparece quando o healthcheck falha. Causas já corrigidas neste projeto:

1. **`/api/health` redirecionava para `/login`** — o proxy exige sessão em todas
   as rotas. A rota agora é liberada em `src/proxy.ts`.
2. **Porta divergente** — a plataforma injeta `PORT` (era 80) e o healthcheck
   consultava 3000. O `docker-entrypoint.js` força `PORT=3000` antes de carregar
   o servidor, então a porta interna é sempre previsível.

Se o serviço subir na porta errada, confira no log:

```
- Local: http://localhost:3000    ← esperado
```

### "Your project's URL and Key are required to create a Supabase client"

As variáveis `NEXT_PUBLIC_*` não chegaram **no build**. Elas são embutidas no
bundle e não servem apenas em runtime.

No Easypanel, em **Environment**, marque as três como **Build Time**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Alterar depois exige reconstruir a imagem. O `Dockerfile` agora falha o build
com mensagem explícita se esses valores faltarem.

### A extração de PDF falha com "Setting up fake worker failed"

O modo `standalone` do Next não copia os workers do `pdfjs-dist`. O `Dockerfile`
deste projeto já resolve isso copiando os pacotes completos:

```dockerfile
COPY --from=builder /app/node_modules/pdf-parse ./node_modules/pdf-parse
COPY --from=builder /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist
COPY --from=builder /app/node_modules/@napi-rs ./node_modules/@napi-rs
```

O `pdfjs-dist` completo importa `@napi-rs/canvas`; sem ele o carregamento falha
em `DOMMatrix`. Se o erro voltar, verifique se os três `COPY` existem.

### Login redireciona para localhost

`NEXT_PUBLIC_SITE_URL` foi embutida errada no build, ou as *Redirect URLs* do
Supabase não incluem seu domínio. Corrija a variável (build-time) e reconstrua.

### "new row violates row-level security policy"

A `SUPABASE_SERVICE_ROLE_KEY` está com a chave **anon** colada por engano.
A chave correta tem `"role": "service_role"` no payload do JWT.

### Erro 500 ao abrir o dashboard

Uma migration está pendente. Rode as 7 migrations na ordem indicada.

---

## Ajustes de memória (opcional)

Se a VPS for pequena, limite o heap do Node no serviço:

```
NODE_OPTIONS=--max-old-space-size=512
```
