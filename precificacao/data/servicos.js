/* ============================================================================
 *  SERVIÇOS NÃO RECORRENTES (NR)  ·  ELOFY
 *  ----------------------------------------------------------------------------
 *  Fonte: Política Comercial Elofy 2025 v5 — aba "Calculadora" (H13:L29).
 *
 *  IMPLANTAÇÃO: horas dependem do escopo (Completo/Desempenho/Engajamento/Metas)
 *  e do porte por nº de usuários. valor = horas × R$/hora, + impostos.
 *  As horas abaixo são as do nº de horas "padrão" da planilha (coluna J).
 *
 *  portes de implantação:
 *    smart      → até 100 usuários
 *    standard   → 101 a 500
 *    premium    → 501 a 1000
 *    enterprise → acima de 1000
 * ========================================================================== */
window.ELOFY_SERVICOS = {
  valor_hora: 220,

  // horas de implantação por escopo × porte
  implantacao_horas: {
    completos:   { smart: 25, standard: 30, premium: 43, enterprise: 88 },
    desempenho:  { smart: 0,  standard: 10, premium: 0,  enterprise: 0  },
    engajamento: { smart: 0,  standard: 10, premium: 0,  enterprise: 48 },
    metas:       { smart: 0,  standard: 0,  premium: 0,  enterprise: 38 },
  },

  // limites de porte (para escolher a coluna de horas)
  portes: [
    { porte: "smart",      ate: 100   },
    { porte: "standard",   ate: 500   },
    { porte: "premium",    ate: 1000  },
    { porte: "enterprise", ate: Infinity },
  ],

  // outros serviços NR avulsos (horas informadas manualmente na tela)
  // valor = horas × valor_hora, + impostos
  avulsos: [
    { id: "consultoria",     nome: "Consultoria" },
    { id: "endomarketing",   nome: "Endomarketing" },
    { id: "desenvolvimento", nome: "Desenvolvimento" },
  ],
};
