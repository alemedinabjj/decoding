/**
 * Etapas do funil de vendas — fonte única usada pelo banco (enum),
 * pelas regras de negócio, pela UI e pela Iris.
 */
export const STAGES = [
  "novo_contato",
  "qualificacao",
  "proposta_enviada",
  "negociacao",
  "ganho",
  "perdido",
] as const;

export type Stage = (typeof STAGES)[number];

export const OPEN_STAGES = [
  "novo_contato",
  "qualificacao",
  "proposta_enviada",
  "negociacao",
] as const satisfies readonly Stage[];

export const CLOSED_STAGES = ["ganho", "perdido"] as const satisfies readonly Stage[];

export type OpenStage = (typeof OPEN_STAGES)[number];
export type ClosedStage = (typeof CLOSED_STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  novo_contato: "Novo contato",
  qualificacao: "Qualificação",
  proposta_enviada: "Proposta enviada",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

export function isOpenStage(stage: Stage): stage is OpenStage {
  return (OPEN_STAGES as readonly Stage[]).includes(stage);
}

export function isClosedStage(stage: Stage): stage is ClosedStage {
  return (CLOSED_STAGES as readonly Stage[]).includes(stage);
}
