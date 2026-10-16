# CRM Decoding + Iris

Case técnico para Desenvolvedor(a) Full Stack Pleno: um **dashboard comercial** e uma **assistente de IA (Iris)** que consomem exatamente a mesma fonte de dados — os números da Iris são, por construção, os números do dashboard.

**Demo:** _link na seção [Deploy](#deploy)_ · **Stack:** Next.js 16 · React 19 · TypeScript · Tailwind + shadcn/ui · PostgreSQL (Neon) + Drizzle · OpenAI

| Dashboard (claro) | Iris no painel lateral (escuro) |
|---|---|
| ![Dashboard](docs/screenshots/dashboard-light.png) | ![Iris](docs/screenshots/iris-dark.png) |

---

## Sumário

1. [Como executar](#como-executar)
2. [Arquitetura](#arquitetura)
3. [Decisões técnicas](#decisões-técnicas)
4. [Integração da IA com o banco](#integração-da-ia-com-o-banco)
5. [Regras de negócio e interpretações](#regras-de-negócio-e-interpretações)
6. [Interface e experiência](#interface-e-experiência)
7. [Testes e qualidade](#testes-e-qualidade)
8. [Escopo e trade-offs](#escopo-e-trade-offs)
9. [Decisão de produto: Índice de risco do pipeline](#decisão-de-produto-índice-de-risco-do-pipeline)
10. [Próximos passos](#próximos-passos)
11. [Uso de IA no desenvolvimento](#uso-de-ia-no-desenvolvimento)

---

## Como executar

### Pré-requisitos

- Node.js 20+ (desenvolvido com Node 24)
- PostgreSQL 15+ com as extensões `vector`, `pg_trgm` e `unaccent` — um projeto gratuito no [Neon](https://neon.tech) **ou** o `docker-compose.yml` incluído
- Chave da OpenAI (opcional para o dashboard; necessária para a Iris e para a busca semântica)

### Passo a passo

```bash
# 1. Dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env.local
# preencha DATABASE_URL, DATABASE_URL_READONLY e OPENAI_API_KEY

# 3. (Opcional) Banco local em vez do Neon
docker compose up -d
#   DATABASE_URL=postgresql://decoding_owner:decoding@localhost:5432/decoding
#   DATABASE_URL_READONLY=postgresql://iris_reader:iris_reader@localhost:5432/decoding

# 4. Migrations e dados fictícios
npm run db:migrate
npm run db:seed

# 5. Confirmar que a conexão da Iris é somente leitura
npm run db:check-readonly

# 6. Subir a aplicação
npm run dev        # http://localhost:3000
```

> **Neon:** a role somente leitura é criada via SQL (veja `docker/init.sql`). Roles criadas pela API/console do Neon entram no grupo `neon_superuser`, que tem permissão de escrita — por isso o projeto usa uma role criada com `CREATE ROLE ... NOINHERIT` e apenas `GRANT SELECT`. O script `db:check-readonly` prova isso tentando `UPDATE`, `DELETE` e `CREATE TABLE`.

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:generate` / `db:migrate` | Gera / aplica migrations (Drizzle) |
| `npm run db:seed` | Recria a base fictícia (determinística, relativa à data atual) |
| `npm run db:check-readonly` | Verifica que a role da Iris não consegue escrever |
| `npm test` | Testes unitários e de integração (Vitest) |
| `npm run test:e2e` | Testes E2E (Playwright; sobe o servidor se necessário) |
| `npm run eval:iris` | Avaliação da Iris com o LLM real: compara os números da resposta com o dashboard |
| `npm run typecheck` / `lint` | TypeScript estrito / ESLint |

### Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão principal (dashboard, migrations, seed, rate limit) |
| `DATABASE_URL_READONLY` | Conexão da Iris — role com apenas `SELECT` |
| `OPENAI_API_KEY` | Usada **somente no servidor** |
| `OPENAI_MODEL` | Padrão `gpt-4.1-mini` |
| `OPENAI_EMBEDDING_MODEL` | Padrão `text-embedding-3-small` |
| `IRIS_RATE_LIMIT_PER_MINUTE` | Perguntas por minuto por visitante (padrão 10) |

---

## Arquitetura

O princípio central: **dashboard e Iris chamam as mesmas funções de domínio**. A IA não escreve SQL — ela só pode invocar um catálogo fechado de ferramentas de leitura que encapsulam os services.

```
 Navegador                                    Servidor (Next.js route handlers)
┌──────────────────────────┐   HTTP    ┌───────────────────────────────────────────────┐
│ Dashboard (React)        │──────────▶│ /api/dashboard/*, /api/opportunities          │──┐
│ TanStack Query           │           └───────────────────────────────────────────────┘  │
│ filtros na URL           │                                                              ▼
├──────────────────────────┤   SSE     ┌──────────────────────┐   tools   ┌──────────────────────┐   ┌────────────────┐   ┌───────────┐
│ Iris (página + painel)   │◀─────────▶│ /api/chat            │──────────▶│ services (domínio)   │──▶│ repositories   │──▶│ Postgres  │
│                          │           │ agente + OpenAI      │           │ métricas, funil,     │   │ SQL (Drizzle)  │   │ (Neon)    │
└──────────────────────────┘           │ rate limit           │           │ busca híbrida        │   └────────────────┘   └───────────┘
                                       └──────────────────────┘           └──────────────────────┘
                                         conexão somente leitura ─────────────────────────────────────────────▲
```

### Camadas

```
src/
  app/                 UI (páginas) e route handlers finos: validam a entrada e delegam
  components/          React: layout, dashboard, iris, shared (estados), ui (shadcn)
  hooks/               filtros na URL, queries do TanStack Query, debounce
  lib/                 cliente HTTP e leitor de SSE (lado do navegador)
  server/
    db/                schema Drizzle, migrations, seed, conexões (owner e somente leitura)
    repositories/      apenas SQL — sem regra de exibição
    services/          regras de negócio: indicadores, funil, oportunidades, busca híbrida
    iris/              ferramentas, prompt, loop do agente, cliente OpenAI, rate limit
  shared/              tipos, etapas, regras puras, schemas Zod e formatação (usados por todos)
tests/  unit/  integration/  e2e/
```

Regras de dependência: componentes nunca importam repositories; services nunca importam React; `server/*` usa `import "server-only"` onde há segredos ou conexões. Repositories e services recebem a conexão por parâmetro — é assim que a Iris roda as **mesmas queries** com outra role.

---

## Decisões técnicas

| Tema | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js 16 (App Router)** em vez de Vite + API separada | O enunciado aceita Next.js; um projeto e um deploy na Vercel reduzem atrito. Mantive a separação de camadas explícita (`app/` só com UI e handlers finos) para não perder a clareza de uma API dedicada. |
| React | **19** (referência da Decoding: 18) | Versão exigida pelo Next 16. Nenhuma API exclusiva do 19 é essencial ao código; voltar ao 18 implicaria Next 14 e dependências defasadas. |
| Banco | **PostgreSQL no Neon** + `docker-compose` alternativo | Postgres é a stack da Decoding; Neon é o Postgres serverless integrado à Vercel e permite branches (`dev` / `main`). |
| ORM | **Drizzle** | Tipado de ponta a ponta, SQL legível nas migrations e controle fino para agregações (`count(*) filter (...)`). |
| Valores | **Centavos em `bigint`** | Evita erros de ponto flutuante em somas monetárias. |
| Dados no cliente | **TanStack Query** | Loading/erro/refetch por bloco, cache por combinação de filtros, `keepPreviousData` para não "piscar" ao filtrar. |
| Estado dos filtros | **URL (search params)** | Link compartilhável, sobrevive a refresh, "voltar" funciona. |
| UI | **Tailwind + shadcn/ui** (Base UI) | Stack de referência; componentes acessíveis e editáveis no próprio repositório. |
| Gráficos | **Recharts** + funil em HTML | Recharts para séries; o funil é HTML/CSS (barras com rótulos), mais legível e acessível que um gráfico de funil. |
| Validação | **Zod** (mensagens em pt-BR) | Mesmo schema valida query string, corpo do chat e argumentos das ferramentas da IA. |
| Fuso horário | **America/Sao_Paulo** centralizado | Filtros de data e agrupamento mensal no fuso do usuário — sem "vendas de outubro" caindo em setembro por causa do UTC. |
| Tempo real no dashboard | **Não usei SSE/WebSocket** | Nesta versão os dados só mudam pelo seed; um canal em tempo real não teria o que transmitir. O SSE foi usado onde agrega valor: no streaming da Iris. Ver [Próximos passos](#próximos-passos). |

---

## Integração da IA com o banco

### Por que tool calling (e não RAG ou text-to-SQL)

| Abordagem | Problema para este caso |
|---|---|
| RAG sobre registros | Somas e contagens exatas não saem de trechos recuperados — os números divergiriam do dashboard. |
| Text-to-SQL | O SQL gerado pode calcular "valor em negociação" de forma diferente da regra oficial, e amplia a superfície de risco. |
| **Tool calling sobre os services** ✅ | A IA escolhe *qual* consulta fazer; o cálculo é sempre o código oficial. Números idênticos por construção. |

### Ferramentas disponíveis (todas de leitura)

| Ferramenta | Reaproveita |
|---|---|
| `get_metrics` | `getDashboardMetrics` (mesmos cards do dashboard) |
| `get_funnel` | `getFunnel` |
| `list_opportunities` | `listOpportunities` (filtros, ordenação, limite) |
| `get_stale_opportunities` | `listStaleOpportunities` (abertas sem atualização há +7 dias) |
| `get_monthly_wins` | `getMonthlyWins` |
| `search_leads` | busca híbrida (abaixo) |
| `list_sales_reps` | `listSalesReps` |

Os resultados já vêm **formatados** (R$, %, dd/mm/aaaa) e com totais calculados, para o modelo não precisar somar nem arredondar.

### Somente leitura em duas camadas

1. **Aplicação:** não existe nenhuma ferramenta de escrita.
2. **Banco:** todas as consultas da Iris usam `DATABASE_URL_READONLY`, uma role com apenas `SELECT`. Mesmo um bug ou prompt injection não conseguiria alterar dados — o Postgres recusaria (`npm run db:check-readonly`).

### Fidelidade aos dados ("zero alucinação")

- **System prompt** (`src/server/iris/prompt.ts`) exige que todo número venha de uma ferramenta chamada na conversa, usa as mesmas constantes de regra do código (7 dias, faixas de risco) e informa ao modelo o **intervalo de datas coberto pela base** — por isso "qual foi a receita de 2018?" recebe "não há registros suficientes".
- **Fora de contexto:** recusa educada + exemplos do que ela responde. Pedidos de alteração ("exclua a oportunidade X") são explicados como impossíveis (somente leitura).
- **Contexto do dashboard:** quando aberta pelo painel lateral, a Iris recebe os filtros que o usuário está vendo; perguntas como "quantas oportunidades tem nesse filtro?" usam o mesmo recorte da tela.
- **Avaliação com o modelo real** (`npm run eval:iris`): faz as perguntas obrigatórias do case e compara os valores da resposta com os services. Resultado atual: **5/5**. Esse eval pegou um problema real durante o desenvolvimento — o modelo adicionava `stage: "novo_contato"` em perguntas sobre "abertas"; corrigi descrições das ferramentas e o prompt e o eval passou a garantir a regressão.

### Streaming e resiliência

- `/api/chat` responde em **Server-Sent Events**: eventos `status` ("Procurando oportunidades paradas"), `delta` (texto) e `done`/`error`. A UI mostra "Iris está analisando os dados..." com as consultas em andamento e, ao fim, as fontes consultadas.
- Loop do agente com limite de 6 etapas, ferramentas independentes em paralelo, `temperature: 0`, erros de ferramenta devolvidos ao modelo (nunca exceções para o usuário).
- **Rate limit** por visitante (hash do IP) em uma tabela do próprio Postgres — funciona em serverless sem Redis. Falha do limitador não derruba a Iris (fail-open, registrado em log).

### Busca híbrida de leads

`search_leads` combina **trigram** (`pg_trgm` + `unaccent`: tolera "translg" → TransLog Cargas) com **similaridade vetorial** (`pgvector`, embeddings de nome + segmento + descrição) e funde os rankings por **Reciprocal Rank Fusion**. Resultados vetoriais abaixo de 0,3 de similaridade são descartados (o vetor sempre devolve "os mais próximos", mesmo sem relação). Sem chave da OpenAI, degrada para trigram.

---

## Regras de negócio e interpretações

Todas as regras vivem em `src/shared/rules.ts` e `src/shared/stages.ts` — a mesma fonte para SQL, UI e prompt.

| Regra | Definição adotada |
|---|---|
| Etapas abertas / encerradas | Novo contato, Qualificação, Proposta enviada, Negociação / Ganho, Perdido |
| Valor em negociação | Soma de `value_cents` das abertas |
| Taxa de conversão | Ganhos ÷ (Ganhos + Perdidos) × 100. **Sem encerradas no recorte → "—"**, não 0% (0% sugeriria que tudo foi perdido) |
| Oportunidade parada | Aberta e `updated_at` anterior a agora − 7 dias |
| Filtro de período | Sobre `created_at` da oportunidade, dias inteiros no fuso de São Paulo (a data final é inclusiva) |
| Total de leads com filtros | **Leads distintos com oportunidades no recorte.** O card mostra também o total cadastrado na base. Interpretação escolhida porque o enunciado manda os filtros recalcularem todos os indicadores |
| Filtro de etapa | Indicadores que não fazem sentido (ex.: vendas concluídas com filtro "Negociação") aparecem como **"Não se aplica à etapa filtrada"** em vez de zero |
| Vendas por mês | Agrupadas pelo **mês de fechamento**, das oportunidades criadas no período; meses sem venda aparecem com zero |
| Busca textual | Exclusiva da tabela (lead, contato ou oportunidade, sem acento e sem diferenciar maiúsculas); não altera os cards |
| Período padrão | Últimos 12 meses |

---

## Interface e experiência

- **4 estados em todo bloco assíncrono:** skeleton no carregamento, erro com mensagem clara e "Tentar novamente", empty state explicativo (incluindo um estado global quando o recorte não tem dados, com "Limpar filtros") e sucesso. Cada card/gráfico carrega e falha de forma independente.
- **Filtros na URL**, botão "Limpar (n)" com contagem de filtros ativos, presets de período e datas personalizadas.
- **Tabela:** ordenação por coluna (`aria-sort`), paginação no servidor, badge de etapa com ícone + texto (nunca só cor), selo "Parada há X dias" e atalho **"Perguntar à Iris"** por oportunidade.
- **Gráficos:** título, eixos rotulados, tooltip com quantidade e valor, e uma tabela equivalente para leitores de tela.
- **Iris:** página dedicada e painel lateral que compartilham a mesma conversa; sugestões de perguntas, interromper resposta, nova conversa, markdown seguro (sem HTML bruto).
- **Identidade visual** inspirada na Decoding: azul-marinho `#0b1b56`, lima `#E4FD98` e azul-céu, fonte Inter; tema claro/escuro com toggle; sidebar recolhível; layout responsivo; respeita `prefers-reduced-motion`.

---

## Testes e qualidade

| Camada | Arquivo | O que garante |
|---|---|---|
| Unitários | `tests/unit/rules.test.ts`, `schemas-and-format.test.ts` | Conversão, regra de parada, índice de risco, aplicabilidade, validação e formatação |
| Unitários | `tests/unit/iris-agent.test.ts` | Loop do agente com OpenAI simulada: resposta direta, execução de ferramenta, limite de etapas |
| Unitários | `tests/unit/search-and-stream.test.ts` | RRF, parser de SSE com chunks fragmentados, validação do chat |
| Integração | `tests/integration/metrics-consistency.test.ts` | **SQL bate com uma implementação de referência em JS** sobre os dados reais em 6 cenários de filtro; a **conexão da Iris devolve exatamente os mesmos números**; funil, lista de paradas e vendas mensais conferem com os cards |
| Integração | `tests/integration/api-routes.test.ts` | Contrato HTTP, 400 com mensagem em português, paginação/ordenação no servidor |
| E2E | `tests/e2e/*.spec.ts` | Filtros recalculam a tela, empty state, busca sem acento, chat (LLM simulado), erro 429, painel lateral |
| Avaliação | `scripts/eval-iris.ts` | Perguntas obrigatórias com o LLM real, números conferidos contra o dashboard |

Resultado atual: **59 testes (Vitest) + 7 E2E (Playwright) passando**, TypeScript estrito sem `any`, ESLint limpo e build de produção ok.

---

## Escopo e trade-offs

| Ficou de fora | Por quê |
|---|---|
| CRUD de leads/oportunidades | Fora do escopo do case; o foco é leitura, consistência e decisão |
| Autenticação e multi-tenant | Demo pública; o rate limit protege o custo da IA. Em produção, a role somente leitura seria por tenant (RLS) |
| Persistência das conversas | Histórico fica no cliente e é enviado a cada pergunta (até 20 mensagens). Simples e sem dados pessoais armazenados |
| Tempo real (SSE/WebSocket) no dashboard | Os dados não mudam sem CRUD; atualização ao voltar para a aba + botão "Atualizar" |
| Agregações pré-calculadas | Com dezenas de registros, agregar em SQL a cada requisição é instantâneo. Em escala: índices compostos, materialized views ou tabelas de fatos por dia |
| Seed relativo à data atual | Garante que o demo nunca "envelhece", mas as contagens de "paradas" mudam com os dias; basta rodar `db:seed` de novo |
| React 18 | Next 16 exige React 19 (ver Decisões técnicas) |

---

## Decisão de produto: Índice de risco do pipeline

**Problema.** "Valor em negociação" mostra o tamanho do pipeline, mas não a sua saúde. R$ 1 milhão em aberto com 60% parado é pior que R$ 600 mil ativos — e o card atual trata os dois como "melhor".

**Indicador.** `Índice de risco = valor das oportunidades paradas (> 7 dias sem atualização) ÷ valor em negociação × 100`

| Faixa | Leitura |
|---|---|
| < 20% — Saudável | Pipeline sendo trabalhado |
| 20% a 40% — Atenção | Revisar follow-ups na reunião semanal |
| > 40% — Crítico | Risco real de perda; priorizar por valor |

**Onde aparece.** Card no dashboard (com faixa, ícone e valor parado) e na resposta da Iris (`get_metrics`), que usa o índice para priorizar recomendações. Respeita todos os filtros, inclusive por responsável — o gestor vê quem concentra valor parado.

**Por que este e não outro.**
- Transforma a regra de "oportunidade parada" — já exigida para a Iris — em métrica de gestão, sem criar conceitos novos para o time.
- Calculável com os dados existentes: nenhum campo novo, nenhuma integração.
- É **acionável**: diferente de uma taxa histórica, aponta o que fazer hoje (quais negociações retomar, em que ordem).
- Na base de demonstração, o índice está em ~41% (crítico): 12 negociações paradas somam R$ 328,4 mil de R$ 797,8 mil em aberto — exatamente o tipo de situação que o indicador existe para expor.

**Evolução natural.** Histórico semanal do índice (tendência), limiar configurável por etapa (uma proposta parada há 7 dias é diferente de um novo contato) e alerta proativo da Iris quando o índice cruzar uma faixa.

---

## Próximos passos

- **Observabilidade:** Sentry para erros de front e back (com contexto de filtros e da conversa da Iris, sem dados pessoais) e **OpenTelemetry** via `instrumentation.ts` — spans por requisição, por query SQL e por chamada à OpenAI, com latência, tokens e ferramentas usadas por pergunta. Isso permitiria acompanhar custo por conversa e taxa de respostas com erro de ferramenta.
- **Tempo real quando houver CRUD:** `LISTEN/NOTIFY` do Postgres alimentando um canal SSE que invalida apenas as queries afetadas no TanStack Query.
- **Eval contínuo da Iris no CI** com um conjunto maior de perguntas (incluindo adversariais e fora de contexto) e orçamento de custo.
- **Autenticação, multi-tenant e RLS** por organização; role somente leitura por tenant.
- **Persistência de conversas** com consentimento, para continuidade entre dispositivos.
- **Alertas proativos** (ex.: WhatsApp/e-mail semanal) com as negociações paradas de cada responsável.

---

## Deploy

- **Vercel** (região `gru1`, perto do banco) conectada a este repositório: cada push na `main` gera um deploy.
- **Neon** com dois branches: `dev` (desenvolvimento e testes) e `main` (produção).
- Variáveis de ambiente configuradas no painel da Vercel; a chave da OpenAI nunca chega ao navegador.

---

## Uso de IA no desenvolvimento

Usei o **Claude** (Anthropic) como par de programação durante todo o case, de forma transparente:

- **Planejamento:** discuti as decisões antes de codar (tool calling vs. RAG, Next vs. Vite, como garantir read-only, como interpretar ambiguidades do enunciado). As escolhas finais e o escopo foram meus; o plano está em `docs/PLAN.md`.
- **Implementação:** a IA gerou boa parte do código a partir das decisões e da arquitetura definidas, sempre em ciclos curtos com revisão, typecheck, lint e testes rodando a cada etapa.
- **Verificação:** pedi testes que provassem as propriedades importantes (SQL vs. referência em JS, Iris vs. dashboard) e um eval com o modelo real. Esses testes pegaram problemas reais durante o desenvolvimento:
  - um `GROUP BY` que falhava porque o fuso era passado como parâmetro em vez de literal;
  - a role somente leitura criada pela API do Neon que, na verdade, herdava permissão de escrita;
  - o modelo aplicando um filtro de etapa que ninguém pediu.
- **O que não deleguei:** decisões de produto (Índice de risco, interpretações das regras), validação visual da interface nos temas claro/escuro e no mobile, e a revisão final do código e deste README.
