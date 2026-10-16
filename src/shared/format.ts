import { APP_TIMEZONE } from "./types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" });

export function formatBRL(cents: number): string {
  return currency.format(cents / 100);
}

export function formatBRLCompact(cents: number): string {
  return compactCurrency.format(cents / 100);
}

export function formatInteger(value: number): string {
  return integer.format(value);
}

/** Recebe o percentual já multiplicado por 100 (ex.: 57.1 → "57,1%"). */
export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${percent.format(value)}%`;
}

export function formatDate(iso: string | Date): string {
  return dateFormatter.format(typeof iso === "string" ? new Date(iso) : iso);
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10" → "out/26" */
export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${MONTHS_PT[Number(monthNumber) - 1]}/${year.slice(2)}`;
}

export function formatRelativeDays(days: number): string {
  if (days === 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}
