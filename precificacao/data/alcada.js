/* ============================================================================
 *  ALÇADA DE DESCONTOS  ·  HR TECH
 *  ----------------------------------------------------------------------------
 *  Define quem pode aprovar cada faixa de desconto.
 *  ⚠️  DADOS DE EXEMPLO — substitua pelos papéis e limites reais.
 *
 *  Regra: a simulação procura o MENOR nível cujo desconto_max_pct cobre o
 *  desconto aplicado. Se nenhum cobrir, o desconto é BLOQUEADO (requer exceção).
 *
 *  Ordene do menor para o maior limite. Use fração (0.10 = 10%).
 * ========================================================================== */
window.PRECIFICACAO_ALCADA = [
  { nivel: 1, papel: "Vendedor / SDR",        desconto_max_pct: 0.05 },
  { nivel: 2, papel: "Coordenador Comercial", desconto_max_pct: 0.12 },
  { nivel: 3, papel: "Gerente Comercial",     desconto_max_pct: 0.20 },
  { nivel: 4, papel: "Diretor",               desconto_max_pct: 0.30 },
  { nivel: 5, papel: "CEO / Comitê",          desconto_max_pct: 0.45 },
];
