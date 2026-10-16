# Plano de Implementação — CRM Decoding + Iris

Documento vivo com as decisões técnicas e de produto do case. Serve de guia para a execução e de base para o README final.

## 1. Objetivo

Versão demonstrativa de duas áreas do CRM da Decoding, consumindo **a mesma fonte de dados**:

1. **Dashboard Comercial** — KPIs, desempenho mensal, funil e lista de oportunidades com filtros globais.
2. **Iris** — assistente de IA conversacional, somente leitura, que responde sobre a operação e recomenda ações.

Fora de escopo: telas de CRUD, autenticação de usuários, multi-tenant.

## 2. Princípio central: uma única fonte de verdade

Dashboard e Iris chamam **as mesmas funções de domínio**. A IA nunca gera SQL; ela só pode invocar um catálogo fechado de ferramentas de leitura que encapsulam os services.

```
UI (React) ──HTTP──► /api/dashboard/* ──┐
                                        ├──► services (domínio) ──► repositories ──► Postgres (Neon)
Iris (chat) ─HTTP──► /api/chat ─► LLM ──┘
                      (tools = mesmos services, conexão read-only)
```

Consequências:
- **Consistência garantida por construção**: os números da Iris são os do dashboard.
- **Read-only em duas camadas**: (1) catálogo de tools sem escrita; (2) a Iris usa `DATABASE_URL_READONLY`, um role Postgres com apenas `SELECT`.

## 3. Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | Next.js (estável atual, App Router) + TypeScript strict | Um projeto, um deploy na Vercel; citado como bem-vindo no enunciado |
| UI | Tailwind CSS + shadcn/ui | Stack de referência da Decoding |
| Dados no cliente | TanStack Query | Estados de loading/erro/vazio explícitos, cache por filtro |
| Gráficos | Recharts | Stack sugerida, acessível com tooltips/legendas |
| Banco | Neon Postgres (+ `docker-compose` alternativo) | Postgres serverless nativo da Vercel |
| ORM | Drizzle | Tipado, leve, migrations em SQL legível |
| Busca | `pg_trgm` + `unaccent` + `pgvector` | Busca híbrida (ver §6) |
| LLM | OpenAI (chat com tool calling + `text-embedding-3-small`) | Function calling maduro, custo baixo |
| Validação | Zod | Validação de query params, body e argumentos das tools |
| Testes | Vitest + Playwright | Domínio, consistência, integração e E2E |

> **React 19:** o Next atual usa React 19, enquanto a referência da Decoding é React 18. Optamos pela versão estável atual para evitar dependências defasadas; a mudança é transparente para o código do case.

## 4. Estrutura de pastas

```
src/
  app/                      # UI e route handlers (finos: validam e delegam)
    (dashboard)/page.tsx
    iris/page.tsx
    api/
      dashboard/metrics/route.ts
      dashboard/funnel/route.ts
      dashboard/monthly-wins/route.ts
      opportunities/route.ts
      sales-reps/route.ts
      chat/route.ts
  components/
    ui/                     # shadcn
    dashboard/              # cards, gráficos, funil, tabela, filtros
    iris/                   # chat, mensagens, painel lateral
    shared/                 # AsyncState, EmptyState, ErrorState
  hooks/                    # useFilters (URL), queries TanStack
  server/
    db/                     # cliente Drizzle, schema, migrations, seed
    repositories/           # queries SQL (sem regra de negócio)
    services/               # regras: metrics, funnel, opportunities, risk, search
    iris/                   # tools, system prompt, loop do agente, rate limit
  shared/
    types.ts                # Lead, Opportunity, SalesRep, DashboardMetrics, FilterParams
    stages.ts               # enum das etapas, isOpen, isClosed
    rules.ts                # isStale, conversionRate, riskIndex (funções puras)
    schemas.ts              # Zod
    format.ts               # BRL, %, datas pt-BR
tests/
  unit/  integration/  e2e/
```

Regra: `app/` e `components/` nunca importam `server/repositories` diretamente; `server/services` nunca importa React.

## 5. Modelo de dados

```
sales_reps     (id, name, email, avatar_color, created_at)
leads          (id, company_name, contact_name, email, segment, description,
                embedding vector(1536), created_at)
opportunities  (id, lead_id → leads, sales_rep_id → sales_reps, name,
                value_cents bigint, stage stage_enum, notes,
                created_at, updated_at, closed_at null)
rate_limits    (key, window_start, count)
```

- `stage_enum`: `novo_contato | qualificacao | proposta_enviada | negociacao | ganho | perdido`.
- Valores em **centavos (inteiro)** para evitar erro de ponto flutuante.
- Índices: `opportunities(created_at)`, `(stage)`, `(sales_rep_id)`, `(updated_at)`; GIN trigram em `leads.company_name`/`contact_name`; HNSW em `leads.embedding`.

### Seed

- Determinístico (seed fixa) e **relativo à data atual**: o demo nunca envelhece.
- ~5 responsáveis, ~30 leads (empresas brasileiras fictícias com segmento e descrição), ~80 oportunidades em 12 meses, cobrindo as 6 etapas.
- Garantido: parte das oportunidades abertas com `updated_at` entre 8 e 40 dias atrás.
- Embeddings gerados no seed (custo irrisório); se não houver `OPENAI_API_KEY`, o seed roda sem embeddings e a busca degrada para trigram.

## 6. Regras de negócio (fonte: `src/shared/rules.ts`)

| Regra | Definição |
|---|---|
| Aberta | etapa ∈ {Novo contato, Qualificação, Proposta enviada, Negociação} |
| Encerrada | etapa ∈ {Ganho, Perdido} |
| Total de leads | Leads distintos com oportunidades no recorte filtrado (sem filtro = total da base) |
| Oportunidades abertas | Contagem das abertas no recorte |
| Valor em negociação | Soma de `value_cents` das abertas |
| Vendas concluídas | Contagem de Ganho |
| Taxa de conversão | Ganhos / (Ganhos + Perdidos) × 100; **"—" quando não há encerradas** |
| Parada | Aberta e `updated_at` < hoje − 7 dias |
| Índice de risco (Parte 3) | Valor das paradas / valor em negociação × 100 |
| "Hoje" | `clock` injetável (testes determinísticos), também enviado à Iris |

Filtros: período (sobre `created_at`), etapa, responsável e busca. Com filtro de etapa encerrada/aberta, cards não aplicáveis exibem "não se aplica" em vez de zero.

## 7. Iris

- **Tools** (Zod nos argumentos):
  `get_metrics(filters)`, `get_funnel(filters)`, `list_opportunities(filters, sort, limit)`,
  `get_stale_opportunities(filters)`, `get_monthly_wins(range)`, `get_risk_index(filters)`,
  `search_leads(query)`, `list_sales_reps()`.
- **Loop**: modelo responde ou chama tools; máximo de iterações para evitar loops.
- **Streaming com status**: o cliente recebe eventos (`tool_start`, `tool_end`, `text_delta`, `error`) e mostra etapas como "Consultando oportunidades paradas…".
- **System prompt**: responder em pt-BR apenas com dados retornados pelas tools; valores em R$; quando não houver dados, dizer explicitamente; perguntas fora do contexto comercial recusadas com redirecionamento educado; recomendações acionáveis para deals parados (responsável, valor, dias sem atualização).
- **Histórico**: mantido no cliente e enviado a cada requisição (sem persistência).
- **Rate limit**: tabela `rate_limits` no Neon, por IP e janela; resposta 429 tratada na UI.
- **Segurança**: chave só no servidor (`OPENAI_API_KEY`); conexão read-only.

### Busca híbrida

`search_leads` e o campo de busca da tabela combinam:
1. Trigram (`similarity` com `unaccent`) — tolera erros de digitação em nomes.
2. Vetor (`embedding <=> query_embedding`) — entende intenção ("empresas de logística").
3. Fusão por **Reciprocal Rank Fusion** (k = 60).

## 8. Frontend

- Navegação: **sidebar recolhível** (Dashboard, Iris) → menu no mobile.
- **Tema claro/escuro** com toggle (segue o sistema por padrão).
- Identidade visual inspirada na Decoding (paleta/tipografia a definir).
- Filtros na **URL** (link compartilhável, sobrevive a refresh). Padrão: últimos 12 meses.
- Componente `<AsyncState>` padroniza loading (skeleton), erro (mensagem + tentar novamente), vazio (explicativo + limpar filtros) e sucesso.
- Tabela: ordenação por coluna, paginação server-side, badge de etapa, badge "parada", atalho "Perguntar à Iris" (abre o painel com pergunta sobre o deal).
- Iris: página `/iris` + painel lateral sobre o dashboard, compartilhando a conversa.

## 9. Testes

| Tipo | Cobertura |
|---|---|
| Unitários | `rules.ts`: conversão, abertas, paradas, risco, bordas (sem encerradas, sem dados) |
| Consistência | Tool `get_metrics` da Iris ≡ resposta de `/api/dashboard/metrics` para os mesmos filtros |
| Integração | Route handlers contra banco de teste (Postgres em Docker ou branch Neon) |
| E2E | 2 fluxos: aplicar filtros e ver o dashboard atualizar; enviar pergunta à Iris (LLM mockado) |

## 10. Deploy

- Vercel (projeto conectado ao GitHub), Neon com branches `dev` e `main`.
- Variáveis: `DATABASE_URL`, `DATABASE_URL_READONLY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `IRIS_RATE_LIMIT_PER_MINUTE`.
- Demo pública com rate limit na Iris.

## 11. Fases

| # | Fase | Estimativa |
|---|---|---|
| 1 | Setup Next, Drizzle, schema, migrations, seed | 1h30 |
| 2 | Regras, repositories, services, endpoints + testes unitários/consistência | 1h30 |
| 3 | UI do dashboard: layout, filtros, cards, gráficos, funil, tabela, estados | 2h30 |
| 4 | Iris: tools, loop, streaming, prompt, rate limit, UI (página + painel) | 2h |
| 5 | Busca híbrida (embeddings, RRF) e diferenciais | 1h |
| 6 | Integração + E2E | 1h |
| 7 | Deploy, README e revisão | 1h |

Total estimado: ~10h30. Se o tempo apertar, o E2E é o primeiro a ser reduzido (registrado nos trade-offs).

## 12. Decisão de produto (Parte 3): Índice de risco do pipeline

**Problema:** "valor em negociação" mostra o tamanho do pipeline, mas não sua saúde. Um pipeline de R$ 1 milhão com 60% parado é pior que um de R$ 600 mil ativo.

**Indicador:** `valor das oportunidades paradas (> 7 dias) / valor em negociação`, exibido como card com faixas (saudável < 20%, atenção 20–40%, crítico > 40%) e detalhamento por responsável.

**Por que:** transforma a regra de "oportunidade parada" (já exigida para a Iris) em métrica de gestão; é calculável com os dados existentes, sem novos campos; e dá à Iris um gancho natural para recomendações priorizadas por valor em risco.

## 13. Pendências

- [ ] Referência visual da Decoding (site/LinkedIn) para paleta e tipografia.
- [ ] `OPENAI_API_KEY` configurada em `.env.local` e na Vercel (nunca no repositório).
