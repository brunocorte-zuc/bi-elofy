/* ============================================================================
 *  MOTOR DE CÁLCULO DE PRECIFICAÇÃO  ·  HR TECH
 *  ----------------------------------------------------------------------------
 *  Funções PURAS (sem DOM, sem efeitos colaterais). Toda regra de negócio de
 *  preço, margem e alçada vive aqui — a interface (app.js) só consome.
 *
 *  Isso mantém a lógica fácil de testar e de alterar sem mexer no visual.
 * ========================================================================== */
(function (global) {
  "use strict";

  /** Receita de tabela de um módulo dado nº de colaboradores. */
  function precoListaModulo(modulo, colaboradores) {
    switch (modulo.cobranca) {
      case "por_colaborador": return modulo.preco_lista * colaboradores;
      case "fixo_mensal":     return modulo.preco_lista;
      case "unica":           return modulo.preco_lista; // cobrança única
      default:                return 0;
    }
  }

  /** Custo interno de um módulo dado nº de colaboradores. */
  function custoModulo(modulo, colaboradores) {
    switch (modulo.cobranca) {
      case "por_colaborador": return modulo.custo_unit * colaboradores;
      case "fixo_mensal":     return modulo.custo_unit;
      case "unica":           return modulo.custo_unit;
      default:                return 0;
    }
  }

  /** Piso (preço mínimo) de um módulo dado nº de colaboradores. */
  function pisoModulo(modulo, colaboradores) {
    switch (modulo.cobranca) {
      case "por_colaborador": return modulo.piso * colaboradores;
      default:                return modulo.piso;
    }
  }

  /**
   * Encontra a alçada (papel) necessária para aprovar um desconto.
   * @returns {{nivel,papel,desconto_max_pct}|null}  null = bloqueado.
   */
  function alcadaNecessaria(descontoPct, tabelaAlcada) {
    const ordenada = [...tabelaAlcada].sort((a, b) => a.desconto_max_pct - b.desconto_max_pct);
    for (const faixa of ordenada) {
      if (descontoPct <= faixa.desconto_max_pct + 1e-9) return faixa;
    }
    return null; // excede todas as faixas → exceção
  }

  /**
   * Decompõe uma receita em impostos, comissão, taxas, custo e margem.
   * Recorrentes e únicos usam a mesma estrutura de margem.
   */
  function decompor(receita, custo, params) {
    const impostos = receita * (params.impostos_pct || 0);
    const comissao = receita * (params.comissao_pct || 0);
    const taxas    = receita * (params.taxa_gateway || 0);
    const margemR  = receita - impostos - comissao - taxas - custo;
    const margemPct = receita > 0 ? margemR / receita : 0;
    return { receita, impostos, comissao, taxas, custo, margemR, margemPct };
  }

  /**
   * Simula uma proposta completa.
   * @param {Object} input
   *   - colaboradores: number
   *   - modulosIds: string[]   (ids selecionados)
   *   - descontoPct: number    (fração, ex 0.1 = 10%) aplicado ao recorrente
   *   - descontoSetupPct: number (fração) aplicado à cobrança única
   * @param {Object} ctx { catalogo, params, alcada }
   */
  function simular(input, ctx) {
    const { catalogo, params, alcada } = ctx;
    const colaboradores = Math.max(0, Number(input.colaboradores) || 0);
    const descontoPct   = clampPct(input.descontoPct);
    const descontoSetup = clampPct(input.descontoSetupPct);
    const selecionados  = catalogo.filter(m => input.modulosIds.includes(m.id) && m.ativo !== false);

    const linhas = selecionados.map(m => {
      const lista = precoListaModulo(m, colaboradores);
      const desc  = m.cobranca === "unica" ? descontoSetup : descontoPct;
      const final = lista * (1 - desc);
      const custo = custoModulo(m, colaboradores);
      const piso  = pisoModulo(m, colaboradores);
      const d     = decompor(final, custo, params);
      return {
        id: m.id, nome: m.nome, categoria: m.categoria, cobranca: m.cobranca,
        listaUnit: m.preco_lista, lista, desconto: desc, final, piso,
        abaixoPiso: final < piso - 1e-6,
        ...d,
      };
    });

    const recorrentes = linhas.filter(l => l.cobranca !== "unica");
    const unicos      = linhas.filter(l => l.cobranca === "unica");

    const mrr   = somaBloco(recorrentes, params); // recorrente mensal
    const setup = somaBloco(unicos, params);      // cobrança única

    // Desconto consolidado do recorrente (o que mais importa p/ alçada)
    const descMrr = mrr.lista > 0 ? 1 - mrr.final / mrr.lista : 0;
    const alcadaMrr = alcadaNecessaria(descMrr, alcada);

    const prazo = Math.max(1, Number(input.prazoMeses) || params.prazo_padrao_meses || 12);
    const tcv = mrr.final * prazo + setup.final; // Total Contract Value

    return {
      colaboradores, prazo, linhas, recorrentes, unicos,
      mrr, setup, tcv,
      descontoMrr: descMrr,
      alcada: alcadaMrr,
      alertaMargem: mrr.final > 0 && mrr.margemPct < (params.margem_minima || 0),
      alertaPiso: linhas.some(l => l.abaixoPiso),
    };
  }

  /** Soma um conjunto de linhas e recalcula a decomposição agregada. */
  function somaBloco(linhas, params) {
    const lista = linhas.reduce((s, l) => s + l.lista, 0);
    const final = linhas.reduce((s, l) => s + l.final, 0);
    const custo = linhas.reduce((s, l) => s + l.custo, 0);
    const d = decompor(final, custo, params);
    return { lista, final, ...d };
  }

  function clampPct(v) {
    const n = Number(v) || 0;
    return Math.min(1, Math.max(0, n));
  }

  global.PricingEngine = {
    precoListaModulo, custoModulo, pisoModulo,
    alcadaNecessaria, decompor, simular, somaBloco,
  };
})(window);
