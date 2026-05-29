/* ============================================================================
 *  PARÂMETROS GERAIS DE PRECIFICAÇÃO  ·  ELOFY
 *  ----------------------------------------------------------------------------
 *  Fonte: Política Comercial Elofy 2025 v5.
 *  Edite apenas os valores. Percentuais em fração (0.0565 = 5,65%).
 * ========================================================================== */
window.ELOFY_PARAMS = {
  moeda: "BRL",

  // Imposto fiscal aplicado sobre o valor sem imposto: preço_com / 0.9435
  impostos_pct: 0.0565,

  // --- Regras de módulos adicionais (sobre o preço-base dos módulos) ---
  rv_sobre_metas_pct:      0.15, // RV: +15% sobre o módulo de Metas
  rv_sobre_completos_pct:  0.15, // RV: +15% sobre módulos Completos
  ia_sobre_desempenho_pct: 0.05, // IA: +5% sobre Desempenho
  ia_sobre_completos_pct:  0.05, // IA: +5% sobre Completos

  // --- IA: estimativa de tokens (aba "Packs de AI") ---
  tokens_por_avd: 15000,  // tokens por AVD/ano
  tokens_por_pdi: 8500,   // tokens por PDI/ano

  // --- Serviços (NR) ---
  valor_hora_padrao: 220, // R$/hora dos serviços de implantação/consultoria
};

/* ----------------------------------------------------------------------------
 *  AUTONOMIA DE DESCONTO (sobre o valor dos módulos, sem imposto)
 *  Fonte: aba "Calculadora" — Closer 10%, Gestor 20%, Diretor 30%.
 * -------------------------------------------------------------------------- */
window.ELOFY_AUTONOMIA = [
  { papel: "Closer",  desconto_max_pct: 0.10 },
  { papel: "Gestor",  desconto_max_pct: 0.20 },
  { papel: "Diretor", desconto_max_pct: 0.30 },
];

/* ----------------------------------------------------------------------------
 *  PRODUTOS DISPONÍVEIS
 *  Elofy está ativo. In Recruiting e Eggup entram quando os dados chegarem.
 * -------------------------------------------------------------------------- */
window.ELOFY_PRODUTOS = [
  { id: "elofy",        nome: "Elofy",         ativo: true  },
  { id: "in_recruiting",nome: "In Recruiting", ativo: false }, // dados pendentes
  { id: "eggup",        nome: "Eggup",         ativo: false }, // dados pendentes
];
