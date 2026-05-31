/* ============================================================================
 *  MOTOR DE CÁLCULO DE PRECIFICAÇÃO  ·  ELOFY
 *  ----------------------------------------------------------------------------
 *  Replica a lógica da "Política Comercial Elofy 2025 v5" (aba Calculadora).
 *  Funções PURAS, sem DOM. Toda regra de preço vive aqui.
 *
 *  Convenção de imposto da planilha: valor_com_imposto = valor_sem / 0.9435
 *  (equivale a somar 5,65% sobre o valor sem imposto).
 * ========================================================================== */
(function (global) {
  "use strict";

  const DIV_IMPOSTO = 0.9435; // 1 - 5,65%

  /** Acha a faixa de preço pelo nº de usuários. */
  function faixaPorUsuarios(usuarios, tabela) {
    return tabela.find(f => usuarios >= f.de && usuarios <= f.ate)
        || (usuarios > tabela[tabela.length - 1].ate ? tabela[tabela.length - 1] : null);
  }

  /** Acha o pack de IA pelo volume de tokens. */
  function packPorTokens(tokens, packs) {
    return packs.find(p => tokens >= p.de_tokens && tokens <= p.ate_tokens)
        || (tokens > packs[packs.length - 1].ate_tokens ? packs[packs.length - 1] : null);
  }

  /** Acha o porte de implantação pelo nº de usuários. */
  function portePorUsuarios(usuarios, portes) {
    return (portes.find(p => usuarios <= p.ate) || portes[portes.length - 1]).porte;
  }

  /**
   * Calcula o preço-base UNITÁRIO (R$/usuário/mês, sem imposto) dos módulos.
   * Regras (aba Calculadora, col C):
   *   - "Completos" (Metas+Engajamento+Desempenho) usa a coluna `completos`.
   *   - Módulos avulsos usam suas colunas próprias.
   *   - RV: +15% sobre Metas (se avulso) e/ou sobre Completos.
   *   - IA: +5% sobre Desempenho (se avulso) e/ou sobre Completos.
   *   - People Analytics e tokens de IA são rateados (valor_anual/12/usuários).
   *
   * @param {Object} sel { completos, desempenho, engajamento, metas, rv, ia, peopleAnalytics }
   *   booleans, exceto peopleAnalytics que é "" | "Smart" | "Standard" | "Premium"
   */
  function precoModulosUnit(usuarios, sel, ctx) {
    const { tabela, params, peopleAnalytics, aiPacks } = ctx;
    const fx = faixaPorUsuarios(usuarios, tabela);
    if (!fx || usuarios <= 0) {
      return { unit: 0, faixa: fx, detalhe: {}, tokens: 0, pack: null };
    }

    const det = {};
    // Base dos módulos
    det.completos   = sel.completos   ? fx.completos   : 0;
    det.desempenho  = sel.desempenho  ? fx.desempenho  : 0;
    det.engajamento = sel.engajamento ? fx.engajamento : 0;
    det.metas       = sel.metas       ? fx.metas       : 0;

    // RV: +15% sobre Metas e/ou sobre Completos
    det.rv = 0;
    if (sel.rv) {
      if (sel.metas)     det.rv += det.metas     * (params.rv_sobre_metas_pct || 0);
      if (sel.completos) det.rv += det.completos * (params.rv_sobre_completos_pct || 0);
    }

    // IA: +5% sobre Desempenho e/ou sobre Completos
    det.ia = 0;
    if (sel.ia) {
      if (sel.desempenho) det.ia += det.desempenho * (params.ia_sobre_desempenho_pct || 0);
      if (sel.completos)  det.ia += det.completos  * (params.ia_sobre_completos_pct || 0);
    }

    // People Analytics: rateio mensal por usuário
    det.peopleAnalytics = 0;
    if (sel.peopleAnalytics) {
      const pa = peopleAnalytics.find(p => p.pacote === sel.peopleAnalytics);
      if (pa) det.peopleAnalytics = pa.valor_anual / 12 / usuarios;
    }

    // IA — pack de tokens: rateio mensal por usuário
    let tokens = 0, pack = null;
    det.iaTokens = 0;
    if (sel.ia) {
      tokens = (sel.avds || 0) * (params.tokens_por_avd || 0)
             + (sel.pdis || 0) * (params.tokens_por_pdi || 0);
      pack = packPorTokens(tokens, aiPacks);
      if (pack) {
        const valorAnual = (sel.tokenMode === "ideal") ? pack.valor_ideal : pack.valor_piso;
        det.iaTokens = valorAnual / 12 / usuarios;
      }
    }

    const unit = det.completos + det.desempenho + det.engajamento + det.metas
               + det.rv + det.ia + det.peopleAnalytics + det.iaTokens;

    return { unit, faixa: fx, detalhe: det, tokens, pack };
  }

  /** Aplica autonomia de desconto e devolve o papel mínimo necessário. */
  function aplicaDesconto(valorSemImposto, descontoPct, autonomia) {
    const d = Math.min(1, Math.max(0, descontoPct || 0));
    const final = valorSemImposto * (1 - d);
    const ordenada = [...autonomia].sort((a, b) => a.desconto_max_pct - b.desconto_max_pct);
    const papel = ordenada.find(p => d <= p.desconto_max_pct + 1e-9) || null;
    return { final, descontoPct: d, papel, excedeAutonomia: !papel && d > 0 };
  }

  /** Custo de implantação (serviço NR) conforme escopo × porte. */
  function calcImplantacao(usuarios, sel, servicos, params) {
    const porte = portePorUsuarios(usuarios, servicos.portes);
    let horas = 0;
    const mapa = servicos.implantacao_horas;
    if (sel.completos)   horas += (mapa.completos[porte]   || 0);
    if (sel.desempenho)  horas += (mapa.desempenho[porte]  || 0);
    if (sel.engajamento) horas += (mapa.engajamento[porte] || 0);
    if (sel.metas)       horas += (mapa.metas[porte]       || 0);
    const semImposto = horas * servicos.valor_hora;
    return { porte, horas, semImposto, comImposto: comImposto(semImposto) };
  }

  function comImposto(semImposto) { return semImposto / DIV_IMPOSTO; }

  /**
   * Simulação completa de uma proposta Elofy.
   * @param {Object} input
   *   usuarios, descontoPct,
   *   sel:{completos,desempenho,engajamento,metas,rv,ia,peopleAnalytics,avds,pdis,tokenMode},
   *   servicosAvulsosHoras:{consultoria,endomarketing,desenvolvimento}
   * @param {Object} ctx { tabela, params, autonomia, peopleAnalytics, aiPacks, servicos }
   */
  function simular(input, ctx) {
    const { params, autonomia, servicos } = ctx;
    const usuarios = Math.max(0, Math.floor(Number(input.usuarios) || 0));
    const sel = input.sel || {};

    // 1) Preço-base unitário dos módulos (sem imposto)
    const base = precoModulosUnit(usuarios, sel, ctx);

    // 2) Desconto/autonomia sobre o UNITÁRIO sem imposto
    const desc = aplicaDesconto(base.unit, input.descontoPct, autonomia);

    // 3) Mensalidade
    const mensalSemImpUnit = desc.final;                 // por usuário
    const mensalSemImp = mensalSemImpUnit * usuarios;    // total
    const mensalComImp = comImposto(mensalSemImp);

    // 4) Serviços NR — implantação (por escopo×porte)
    const impl = calcImplantacao(usuarios, sel, servicos, params);

    // 4b) Serviços não recorrentes itemizados (linhas: tipo + descrição + horas)
    //     Valor de cada linha = horas × valor_hora. Mantém compatibilidade com
    //     o formato antigo (servicosAvulsosHoras = mapa {id: horas}).
    let servItens = Array.isArray(input.servicos) ? input.servicos : null;
    if (!servItens) {
      const mapa = input.servicosAvulsosHoras || {};
      servItens = (servicos.avulsos || []).map(a => ({
        tipo: a.nome, descricao: "", horas: Number(mapa[a.id]) || 0,
      }));
    }
    const avulsos = servItens
      .map(s => {
        const horas = Number(s.horas) || 0;
        const semImp = horas * servicos.valor_hora;
        return {
          tipo: s.tipo || "Serviço", descricao: s.descricao || "", horas,
          semImposto: semImp, comImposto: comImposto(semImp),
        };
      })
      .filter(s => s.horas > 0);

    // 4c) Customizações (Jira) — soma do grupo selecionado.
    // Podem entrar no MRR (recorrente) ou como NR (único), conforme negociação.
    const customsSel = Array.isArray(input.customs) ? input.customs : [];
    const customSemImp = customsSel.reduce((s, c) => s + (Number(c.valor_sem_imposto) || 0), 0);
    const customNoMrr = !!input.customNoMrr;

    // Mensalidade final (soma custom se for "dentro do MRR")
    const mrrSemImpFinal = mensalSemImp + (customNoMrr ? customSemImp : 0);
    const mrrComImpFinal = comImposto(mrrSemImpFinal);

    // NR = implantação + avulsos + (custom se for "fora do MRR")
    const nrSemImp = impl.semImposto + avulsos.reduce((s, a) => s + a.semImposto, 0)
                   + (customNoMrr ? 0 : customSemImp);
    const nrComImp = comImposto(nrSemImp);

    const customComImp = comImposto(customSemImp);

    // 5) Valor global
    const tcvSemImp = mrrSemImpFinal + nrSemImp; // mensal + setup (referência)
    const globalComImp = mrrComImpFinal + nrComImp;

    return {
      usuarios,
      faixa: base.faixa,
      detalheUnit: base.detalhe,
      tokens: base.tokens,
      pack: base.pack,
      unitSemImp: base.unit,
      unitComDesconto: desc.final,
      desconto: desc,
      mrr: { semImposto: mrrSemImpFinal, comImposto: mrrComImpFinal, unit: mensalSemImpUnit,
             semImpostoModulos: mensalSemImp, comImpostoModulos: mensalComImp },
      implantacao: impl,
      avulsos,
      customs: { itens: customsSel, semImposto: customSemImp, comImposto: customComImp, noMrr: customNoMrr },
      nr: { semImposto: nrSemImp, comImposto: nrComImp },
      global: { semImposto: tcvSemImp, comImposto: globalComImp },
    };
  }

  global.PricingEngine = {
    faixaPorUsuarios, packPorTokens, portePorUsuarios,
    precoModulosUnit, aplicaDesconto, calcImplantacao, comImposto, simular,
  };
})(window);
