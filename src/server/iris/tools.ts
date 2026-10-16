/**
 * Ferramentas da Iris. Cada uma é uma função de leitura que reaproveita os
 * mesmos services do dashboard — por isso os números coincidem. Não existe
 * ferramenta de escrita, e a conexão usada é a do role somente leitura.
 */
import { z } from "zod";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Db } from "../repositories/opportunity-repository";
import { getDashboardMetrics, getFunnel, getMonthlyWins } from "../services/dashboard-service";
import { listOpportunities, listSalesReps, listStaleOpportunities } from "../services/opportunity-service";
import { hybridLeadSearch, type EmbedFn } from "../services/search-service";
import { formatBRL, formatDate, formatPercent } from "../../shared/format";
import { isStale, riskLevel, STALE_AFTER_DAYS } from "../../shared/rules";
import { isOpenStage, STAGES, STAGE_LABELS, type Stage } from "../../shared/stages";
import { OPPORTUNITY_SORT_FIELDS, type FilterParams, type Opportunity } from "../../shared/types";

export interface IrisToolContext {
  db: Db;
  now: Date;
  embed?: EmbedFn;
}

interface IrisTool {
  name: string;
  /** Texto exibido ao usuário enquanto a ferramenta roda. */
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: unknown, ctx: IrisToolContext) => Promise<unknown>;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const filterArgs = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  stage: z.enum(STAGES).optional(),
  salesRepName: z.string().min(2).optional(),
});

/** Todos os filtros são opcionais: o modelo deve omitir o que o usuário não pediu. */
const filterJsonSchema = {
  startDate: {
    type: "string",
    description: "Opcional. Data inicial (AAAA-MM-DD), inclusiva, sobre a data de criação. Omita se não houver período.",
  },
  endDate: { type: "string", description: "Opcional. Data final (AAAA-MM-DD), inclusiva. Omita se não houver período." },
  stage: {
    type: "string",
    enum: [...STAGES],
    description: "Opcional. Use SOMENTE se o usuário (ou o filtro do dashboard) pedir uma etapa específica. Omita para considerar todas.",
  },
  salesRepName: {
    type: "string",
    description: "Opcional. Nome do responsável comercial, apenas se o usuário pedir. Omita para todos.",
  },
};

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

class ToolInputError extends Error {}

async function toFilters(args: z.infer<typeof filterArgs>, ctx: IrisToolContext): Promise<{ filters: FilterParams; salesRep?: string }> {
  const filters: FilterParams = { startDate: args.startDate, endDate: args.endDate, stage: args.stage };
  if (!args.salesRepName) return { filters };
  const reps = await listSalesReps(ctx.db);
  const match = reps.find((rep) => normalize(rep.name).includes(normalize(args.salesRepName!)));
  if (!match) {
    throw new ToolInputError(`Responsável "${args.salesRepName}" não encontrado. Disponíveis: ${reps.map((r) => r.name).join(", ")}.`);
  }
  return { filters: { ...filters, salesRepId: match.id }, salesRep: match.name };
}

function describeFilters(filters: FilterParams, salesRep?: string) {
  return {
    periodo:
      filters.startDate || filters.endDate
        ? `${filters.startDate ? formatDate(`${filters.startDate}T12:00:00`) : "início da base"} a ${filters.endDate ? formatDate(`${filters.endDate}T12:00:00`) : "hoje"}`
        : "toda a base (sem filtro de período)",
    etapa: filters.stage ? STAGE_LABELS[filters.stage] : "todas",
    responsavel: salesRep ?? "todos",
  };
}

function summarizeOpportunity(o: Opportunity) {
  return {
    id: o.id,
    oportunidade: o.name,
    empresa: o.lead.companyName,
    contato: o.lead.contactName,
    etapa: STAGE_LABELS[o.stage],
    valor: formatBRL(o.valueCents),
    responsavel: o.salesRep.name,
    ultimaAtualizacao: formatDate(o.updatedAt),
    diasSemAtualizacao: o.daysSinceUpdate,
    parada: o.isStale,
  };
}

function summarizeLeadOpportunities(
  items: { stage: Stage; valueCents: number; updatedAt: Date }[],
  now: Date,
) {
  const sum = (list: typeof items) => formatBRL(list.reduce((acc, o) => acc + o.valueCents, 0));
  const open = items.filter((o) => isOpenStage(o.stage));
  const won = items.filter((o) => o.stage === "ganho");
  const lost = items.filter((o) => o.stage === "perdido");
  return {
    abertas: open.length,
    valorEmNegociacao: sum(open),
    paradas: open.filter((o) => isStale(o.stage, o.updatedAt, now)).length,
    ganhas: won.length,
    valorGanho: sum(won),
    perdidas: lost.length,
    valorPerdido: sum(lost),
  };
}

const tools: IrisTool[] = [
  {
    name: "get_metrics",
    label: "Calculando indicadores",
    description:
      "Indicadores oficiais do dashboard: total de leads, oportunidades abertas, valor em negociação, vendas concluídas, taxa de conversão, oportunidades paradas e índice de risco. Use para qualquer pergunta de contagem ou soma. O resultado JÁ separa abertas (4 etapas), ganhas e perdidas: para perguntas sobre 'abertas', 'em andamento' ou 'valor em negociação' NÃO envie stage.",
    parameters: { type: "object", properties: filterJsonSchema, additionalProperties: false },
    async execute(raw, ctx) {
      const { filters, salesRep } = await toFilters(filterArgs.parse(raw), ctx);
      const m = await getDashboardMetrics(ctx.db, filters, ctx.now);
      return {
        filtros: describeFilters(filters, salesRep),
        totalOportunidadesNoRecorte: m.totalOpportunities,
        totalLeadsComOportunidades: m.totalLeads,
        totalLeadsCadastradosNaBase: m.totalLeadsInBase,
        oportunidadesAbertas: m.openOpportunities,
        valorEmNegociacao: formatBRL(m.openValueCents),
        vendasConcluidas: m.wonCount,
        valorVendido: formatBRL(m.wonValueCents),
        oportunidadesPerdidas: m.lostCount,
        taxaDeConversao: m.conversionRate === null ? "sem negociações encerradas no recorte" : formatPercent(m.conversionRate),
        oportunidadesParadas: m.staleCount,
        valorParado: formatBRL(m.staleValueCents),
        indiceDeRisco:
          m.riskIndex === null
            ? "sem valor em negociação"
            : `${formatPercent(m.riskIndex)} (${{ healthy: "saudável", attention: "atenção", critical: "crítico" }[riskLevel(m.riskIndex)]})`,
      };
    },
  },
  {
    name: "get_funnel",
    label: "Analisando o funil",
    description: "Quantidade e valor de oportunidades em cada uma das 6 etapas do funil. Use para perguntas sobre distribuição por etapa ou onde se perde mais.",
    parameters: { type: "object", properties: filterJsonSchema, additionalProperties: false },
    async execute(raw, ctx) {
      const { filters, salesRep } = await toFilters(filterArgs.parse(raw), ctx);
      const funnel = await getFunnel(ctx.db, filters);
      return {
        filtros: describeFilters(filters, salesRep),
        etapas: funnel.map((s) => ({ etapa: s.label, quantidade: s.count, valor: formatBRL(s.valueCents) })),
      };
    },
  },
  {
    name: "list_opportunities",
    label: "Consultando oportunidades",
    description:
      "Lista oportunidades com filtros e ordenação. Ex.: as 3 maiores abertas → status=open, sort=valueCents, direction=desc, limit=3. Retorna também o total encontrado.",
    parameters: {
      type: "object",
      properties: {
        ...filterJsonSchema,
        status: { type: "string", enum: ["open", "closed"], description: "open = 4 etapas abertas; closed = Ganho ou Perdido." },
        search: { type: "string", description: "Texto no nome da empresa, contato ou oportunidade." },
        sort: { type: "string", enum: [...OPPORTUNITY_SORT_FIELDS], description: "Campo de ordenação (padrão: updatedAt)." },
        direction: { type: "string", enum: ["asc", "desc"] },
        limit: { type: "integer", minimum: 1, maximum: 25, description: "Máximo de itens (padrão 10)." },
      },
      additionalProperties: false,
    },
    async execute(raw, ctx) {
      const args = filterArgs
        .extend({
          status: z.enum(["open", "closed"]).optional(),
          search: z.string().max(100).optional(),
          sort: z.enum(OPPORTUNITY_SORT_FIELDS).optional(),
          direction: z.enum(["asc", "desc"]).optional(),
          limit: z.number().int().min(1).max(25).optional(),
        })
        .parse(raw);
      const { filters, salesRep } = await toFilters(args, ctx);
      const result = await listOpportunities(
        ctx.db,
        { ...filters, status: args.status, search: args.search, sort: args.sort, direction: args.direction, pageSize: args.limit ?? 10 },
        ctx.now,
      );
      return {
        filtros: { ...describeFilters(filters, salesRep), status: args.status ?? "todas", busca: args.search ?? null },
        totalEncontrado: result.total,
        exibindo: result.items.length,
        oportunidades: result.items.map(summarizeOpportunity),
      };
    },
  },
  {
    name: "get_opportunity",
    label: "Consultando a oportunidade",
    description:
      "Detalhes de UMA oportunidade pelo id (ex.: '#63'): etapa, valor, responsável, contato, segmento, datas, dias sem atualização e notas. Use sempre que o usuário citar uma oportunidade por #id.",
    parameters: {
      type: "object",
      properties: { id: { type: "integer", description: "Id numérico da oportunidade (sem o #)." } },
      required: ["id"],
      additionalProperties: false,
    },
    async execute(raw, ctx) {
      const { id } = z.object({ id: z.number().int().positive() }).parse(raw);
      const result = await listOpportunities(ctx.db, { opportunityId: id, pageSize: 1 }, ctx.now);
      const o = result.items[0];
      if (!o) return { encontrada: false, mensagem: `Não existe oportunidade com id ${id} na base.` };
      return {
        encontrada: true,
        ...summarizeOpportunity(o),
        segmento: o.lead.segment,
        criadaEm: formatDate(o.createdAt),
        encerradaEm: o.closedAt ? formatDate(o.closedAt) : null,
        notas: o.notes,
        regraParada: `Parada = aberta e sem atualização há mais de ${STALE_AFTER_DAYS} dias`,
      };
    },
  },
  {
    name: "get_stale_opportunities",
    label: "Procurando oportunidades paradas",
    description: `Todas as oportunidades abertas sem atualização há mais de ${STALE_AFTER_DAYS} dias (precisam de atenção), da mais valiosa para a menos valiosa, com responsável e dias parados.`,
    parameters: { type: "object", properties: filterJsonSchema, additionalProperties: false },
    async execute(raw, ctx) {
      const { filters, salesRep } = await toFilters(filterArgs.parse(raw), ctx);
      const result = await listStaleOpportunities(ctx.db, filters, ctx.now);
      const totalCents = result.items.reduce((acc, o) => acc + o.valueCents, 0);
      return {
        regra: `Abertas e sem atualização há mais de ${STALE_AFTER_DAYS} dias`,
        filtros: describeFilters(filters, salesRep),
        quantidade: result.total,
        valorTotalParado: formatBRL(totalCents),
        oportunidades: result.items.map(summarizeOpportunity),
      };
    },
  },
  {
    name: "get_monthly_wins",
    label: "Levantando vendas por mês",
    description: "Evolução mensal das oportunidades ganhas (mês de fechamento), com quantidade e valor.",
    parameters: { type: "object", properties: filterJsonSchema, additionalProperties: false },
    async execute(raw, ctx) {
      const { filters, salesRep } = await toFilters(filterArgs.parse(raw), ctx);
      const months = await getMonthlyWins(ctx.db, filters, ctx.now);
      return {
        filtros: describeFilters(filters, salesRep),
        meses: months.map((m) => ({ mes: m.label, vendas: m.wonCount, valor: formatBRL(m.wonValueCents) })),
      };
    },
  },
  {
    name: "search_leads",
    label: "Buscando leads",
    description:
      "Busca híbrida de leads por nome (tolera erros de digitação) ou por descrição/segmento (ex.: 'empresas de logística'), com as oportunidades de cada lead.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Nome da empresa/contato ou descrição do perfil buscado." } },
      required: ["query"],
      additionalProperties: false,
    },
    async execute(raw, ctx) {
      const { query } = z.object({ query: z.string().min(2).max(200) }).parse(raw);
      const result = await hybridLeadSearch(ctx.db, query, ctx.embed);
      return {
        modo: result.mode === "hybrid" ? "híbrida (texto + semântica)" : "apenas texto",
        encontrados: result.leads.length,
        leads: result.leads.map((lead) => ({
          empresa: lead.companyName,
          contato: lead.contactName,
          segmento: lead.segment,
          descricao: lead.description,
          // Totais calculados aqui para a IA não precisar somar valores sozinha.
          resumo: summarizeLeadOpportunities(lead.opportunities, ctx.now),
          oportunidades: lead.opportunities.map((o) => ({
            oportunidade: o.name,
            etapa: STAGE_LABELS[o.stage],
            valor: formatBRL(o.valueCents),
            responsavel: o.salesRepName,
            ultimaAtualizacao: formatDate(o.updatedAt),
          })),
        })),
      };
    },
  },
  {
    name: "list_sales_reps",
    label: "Consultando responsáveis",
    description: "Lista os responsáveis comerciais cadastrados.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_raw, ctx) {
      const reps = await listSalesReps(ctx.db);
      return { responsaveis: reps.map((r) => r.name) };
    },
  },
];

const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

export const IRIS_TOOL_DEFINITIONS: ChatCompletionTool[] = tools.map((tool) => ({
  type: "function",
  function: { name: tool.name, description: tool.description, parameters: tool.parameters },
}));

export function toolLabel(name: string): string {
  return toolsByName.get(name)?.label ?? "Consultando dados";
}

/** Executa uma ferramenta pelo nome. Erros viram mensagens para o modelo, nunca exceções. */
export async function runTool(name: string, rawArguments: string, ctx: IrisToolContext): Promise<string> {
  const tool = toolsByName.get(name);
  if (!tool) return JSON.stringify({ erro: `Ferramenta desconhecida: ${name}` });
  try {
    const args: unknown = rawArguments.trim() ? JSON.parse(rawArguments) : {};
    const startedAt = Date.now();
    const result = JSON.stringify(await tool.execute(args, ctx));
    console.info(`[iris] tool=${name} args=${JSON.stringify(args)} ms=${Date.now() - startedAt}`);
    return result;
  } catch (error) {
    if (error instanceof ToolInputError) return JSON.stringify({ erro: error.message });
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return JSON.stringify({ erro: "Argumentos inválidos para a ferramenta.", detalhes: error.message });
    }
    console.error(`[iris] falha na ferramenta ${name}:`, error);
    return JSON.stringify({ erro: "Falha ao consultar os dados." });
  }
}
