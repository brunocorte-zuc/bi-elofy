/* ============================================================================
 *  PARÂMETROS GERAIS DE PRECIFICAÇÃO  ·  HR TECH
 *  ----------------------------------------------------------------------------
 *  Base de cálculo usada em TODAS as simulações.
 *  ⚠️  DADOS DE EXEMPLO — substitua pelos valores reais da Controladoria.
 *
 *  Para alterar: edite apenas os números abaixo. Não mexa nas chaves (nomes).
 * ========================================================================== */
window.PRECIFICACAO_PARAMS = {
  moeda: "BRL",

  // Percentuais aplicados sobre a RECEITA (use fração: 0.10 = 10%)
  impostos_pct:  0.1453,   // carga tributária média sobre faturamento
  comissao_pct:  0.05,     // comissão comercial sobre o contrato
  taxa_gateway:  0.015,    // taxa de meio de pagamento / boleto

  // Metas de rentabilidade (fração)
  margem_alvo:   0.60,     // margem de contribuição desejada
  margem_minima: 0.40,     // abaixo disto a simulação dispara ALERTA

  // Contrato
  prazo_padrao_meses: 12,
  reajuste_anual_pct: 0.045, // IPCA estimado (informativo)
};
