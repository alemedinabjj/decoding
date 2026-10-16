/**
 * Regras de negócio puras (sem I/O). Compartilhadas por services, UI e Iris.
 */

/** Oportunidade aberta sem atualização há mais de N dias é considerada "parada". */
export const STALE_AFTER_DAYS = 7;
