/**
 * Relógio da aplicação. Centralizar "agora" permite testes determinísticos
 * (APP_FIXED_NOW) e garante que dashboard e Iris usem a mesma referência.
 */
export function getNow(): Date {
  const fixed = process.env.APP_FIXED_NOW;
  if (fixed) {
    const date = new Date(fixed);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}
