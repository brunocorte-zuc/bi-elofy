/* ============================================================================
 *  INTERFACE DA CALCULADORA DE PREÇO  ·  ELOFY
 *  ----------------------------------------------------------------------------
 *  Liga os dados (data/*.js) + o motor (engine.js) à tela.
 *  Não contém regra de preço — apenas leitura de inputs e renderização.
 * ========================================================================== */
(function () {
  "use strict";

  // A configuração de preço NÃO vem mais de arquivos estáticos (evita expor
  // custos/margens num site público). É carregada do Supabase após o login,
  // somente para usuários autorizados (RPC pricing_config + RLS).
  const ctx = {
    tabela: [], params: { moeda: "BRL" }, autonomia: [],
    peopleAnalytics: [], aiPacks: [], servicos: {},
  };
  let configCarregada = false;
  const PRODUTOS = [{ id: "elofy", nome: "Elofy", ativo: true }];

  // Transforma o JSON plano da RPC nas estruturas que o motor espera.
  function aplicarConfig(cfg) {
    if (!cfg) return;
    ctx.tabela = cfg.tabela || [];
    ctx.aiPacks = cfg.aiPacks || [];
    ctx.peopleAnalytics = cfg.peopleAnalytics || [];
    ctx.autonomia = cfg.autonomia || [];
    ctx.params = Object.assign({ moeda: "BRL" }, cfg.parametros || {});

    // servicoHoras (lista escopo×porte) → estrutura implantacao_horas + portes
    const horas = { completos: {}, desempenho: {}, engajamento: {}, metas: {} };
    (cfg.servicoHoras || []).forEach(s => {
      (horas[s.escopo] = horas[s.escopo] || {})[s.porte] = s.horas;
    });
    ctx.servicos = {
      valor_hora: ctx.params.valor_hora_padrao || 220,
      implantacao_horas: horas,
      portes: [
        { porte: "smart", ate: 100 }, { porte: "standard", ate: 500 },
        { porte: "premium", ate: 1000 }, { porte: "enterprise", ate: Infinity },
      ],
      avulsos: [
        { id: "consultoria", nome: "Consultoria" },
        { id: "endomarketing", nome: "Endomarketing" },
        { id: "desenvolvimento", nome: "Desenvolvimento" },
      ],
    };
    configCarregada = true;
  }

  const $  = s => document.querySelector(s);
  const brl = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: ctx.params.moeda || "BRL" }).format(v || 0);
  const pct = v => (v * 100).toFixed(1).replace(".", ",") + "%";
  const num = v => new Intl.NumberFormat("pt-BR").format(v || 0);
  const escapeHtml = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Negócio do Bitrix vinculado à proposta atual (null = nenhum)
  let bitrixVinculado = null;
  // Customs (Jira) carregadas e selecionadas
  let customsDisponiveis = [];          // resultado da busca
  const customsSelecionadas = new Set(); // jira_key marcados
  // Serviços NR itemizados: [{ tipo, descricao, horas }]
  let servicosItens = [];
  const TIPOS_SERVICO = ["Consultoria", "Endomarketing", "Desenvolvimento", "Treinamento", "Outro"];

  /* ---- Abas de produto ---- */
  function renderTabs() {
    // Mostra apenas produtos ativos. Com um único ativo, oculta a barra de abas.
    const ativos = PRODUTOS.filter(p => p.ativo);
    if (ativos.length <= 1) { $("#tabs").classList.add("hide"); return; }
    $("#tabs").classList.remove("hide");
    $("#tabs").innerHTML = ativos.map((p, i) =>
      `<button class="tab ${i === 0 ? "on" : ""}" data-prod="${p.id}">${p.nome}</button>`).join("");
    $("#tabs").querySelectorAll(".tab").forEach(t =>
      t.addEventListener("click", () => selecionarProduto(t.dataset.prod)));
  }

  function selecionarProduto(id) {
    const prod = PRODUTOS.find(p => p.id === id);
    $("#tabs").querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.prod === id));
    $("#produtoBadge").textContent = prod ? prod.nome : id;
    const elofy = id === "elofy";
    $("#painelElofy").classList.toggle("hide", !elofy);
    $("#painelSoon").classList.toggle("hide", elofy);
    if (!elofy) $("#soonNome").textContent = prod ? prod.nome : id;
  }

  /* ---- Leitura dos inputs ---- */
  function lerInput() {
    return {
      usuarios: $("#usuarios").value,
      descontoPct: (Number($("#desconto").value) || 0) / 100,
      sel: {
        completos:   $("#m_completos").checked,
        desempenho:  $("#m_desempenho").checked,
        engajamento: $("#m_engajamento").checked,
        metas:       $("#m_metas").checked,
        rv:          $("#m_rv").checked,
        ia:          $("#m_ia").checked,
        peopleAnalytics: $("#peopleAnalytics").value,
        avds: Number($("#avds").value) || 0,
        pdis: Number($("#pdis").value) || 0,
        tokenMode: $("#tokenMode").value,
      },
      servicos: servicosItens.map(s => ({
        tipo: s.tipo, descricao: s.descricao, horas: Number(s.horas) || 0,
      })),
      customs: customsDisponiveis.filter(c => customsSelecionadas.has(c.jira_key)),
      customNoMrr: $("#customNoMrr").checked,
    };
  }

  /* ---- Cálculo + render ---- */
  function recalc() {
    if (!configCarregada) return; // tabela de preços ainda não chegou do banco
    sincronizaUI();
    const r = window.PricingEngine.simular(lerInput(), ctx);
    renderKpis(r);
    renderAlertas(r);
    renderTabela(r);
    renderTokenSignal(r);
  }

  // Sinaliza, de forma explícita, quantos tokens de IA estão sendo vendidos e
  // qual o valor desse pack — que fica DILUÍDO na mensalidade por usuário.
  function renderTokenSignal(r) {
    const box = $("#tokenSignal");
    if (!box) return;
    if (!r.pack || !r.tokens) { box.classList.add("hide"); box.innerHTML = ""; return; }
    const modo = $("#tokenMode").value === "ideal" ? "ideal" : "piso";
    const valorAnual = modo === "ideal" ? r.pack.valor_ideal : r.pack.valor_piso;
    const u = r.usuarios || 1;
    const mensalUnit = valorAnual / 12 / u; // o que entra por usuário/mês
    box.classList.remove("hide");
    box.innerHTML =
      `Vendendo <b>${num(r.tokens)} tokens/ano</b> (pack ${r.pack.pack}, preço ${modo}: ` +
      `<b>${brl(valorAnual)}/ano</b>). Esse valor está <b>diluído na mensalidade</b>: ` +
      `${brl(mensalUnit)}/usuário/mês · ${brl(valorAnual / 12)}/mês no total.`;
  }

  function sincronizaUI() {
    $("#iaBox").classList.toggle("hide", !$("#m_ia").checked);
    document.querySelectorAll("[data-mod]").forEach(l =>
      l.classList.toggle("on", l.querySelector("input").checked));
  }

  // Regra do pacote "Completos":
  //   - É COMPLETO: módulos avulsos (Desempenho/Engajamento/Metas) ficam
  //     travados OFF — ou é venda completa, ou modular.
  //   - RV e IA FAZEM PARTE do completo: entram marcados e travados ON
  //     (aplicam +15% e +5%). A exceção são os TOKENS de IA, que continuam
  //     opcionais (entram só se o vendedor informar AVDs/PDIs).
  const MOD_BASE = ["#m_desempenho", "#m_engajamento", "#m_metas"]; // travam OFF
  const MOD_INCLUSO = ["#m_rv", "#m_ia"];                            // travam ON
  function aplicarExclusividadeModulos(origem) {
    const completos = $("#m_completos");
    const base = MOD_BASE.map($);
    const inclusos = MOD_INCLUSO.map($);
    if (origem === "completos") {
      if (completos.checked) {
        base.forEach(c => { c.checked = false; });
        inclusos.forEach(c => { c.checked = true; }); // RV e IA fazem parte
      } else {
        inclusos.forEach(c => { c.checked = false; }); // saiu do completo → limpa
      }
    } else if (origem === "base" && base.some(c => c.checked)) {
      completos.checked = false;
      inclusos.forEach(c => { c.checked = false; });
    }
    const compOn = completos.checked;
    base.forEach(c => travarChk(c, compOn));     // base: travados OFF no completo
    inclusos.forEach(c => travarChk(c, compOn)); // RV/IA: travados ON no completo
    travarChk(completos, base.some(c => c.checked));
  }
  function travarChk(input, travar) {
    input.disabled = travar;
    const label = input.closest(".chk");
    if (!label) return;
    label.classList.toggle("locked", travar && !input.checked);    // travado e vazio → esmaecido
    label.classList.toggle("locked-on", travar && input.checked);  // travado e incluso → destacado
  }

  function renderKpis(r) {
    const fxTxt = r.faixa ? `${r.faixa.porte} · ${num(r.faixa.de)}–${r.faixa.ate === Infinity ? "∞" : num(r.faixa.ate)}` : "—";
    $("#kpis").innerHTML = `
      <div class="kpi"><div class="lbl">Mensalidade (c/ imposto)</div>
        <div class="val mono">${brl(r.mrr.comImposto)}</div>
        <div class="sub">${brl(r.mrr.semImposto)} s/ imposto</div></div>
      <div class="kpi"><div class="lbl">Implantação + NR</div>
        <div class="val mono">${brl(r.nr.comImposto)}</div>
        <div class="sub">único · ${r.implantacao.horas}h implantação</div></div>
      <div class="kpi"><div class="lbl">Valor global</div>
        <div class="val mono">${brl(r.global.comImposto)}</div>
        <div class="sub">1ª mensalidade + NR</div></div>
      <div class="kpi"><div class="lbl">Preço / usuário</div>
        <div class="val mono">${brl(r.mrr.unit)}</div>
        <div class="sub">c/ desconto · s/ imposto</div></div>
      <div class="kpi"><div class="lbl">Faixa de preço</div>
        <div class="val mono" style="font-size:16px">${fxTxt}</div>
        <div class="sub">${r.usuarios} usuários</div></div>
      <div class="kpi"><div class="lbl">Desconto</div>
        <div class="val mono">${pct(r.desconto.descontoPct)}</div>
        <div class="sub">${r.desconto.papel ? r.desconto.papel.papel : (r.desconto.descontoPct ? "acima da autonomia" : "sem desconto")}</div></div>`;
  }

  function renderAlertas(r) {
    const out = [];
    if (r.desconto.excedeAutonomia)
      out.push(`<span class="pill bad">✕ Desconto ${pct(r.desconto.descontoPct)} excede a autonomia máxima — requer exceção</span>`);
    else if (r.desconto.papel)
      out.push(`<span class="pill warn">Aprovação: ${r.desconto.papel.papel} (até ${pct(r.desconto.papel.desconto_max_pct)})</span>`);
    if (r.pack)
      out.push(`<span class="pill ok">IA: pack ${r.pack.pack} · ${num(r.tokens)} tokens</span>`);
    if (!anyModuloSelecionado(r))
      out.push(`<span class="pill warn">Selecione ao menos um módulo</span>`);
    $("#alertas").innerHTML = out.join("");
  }

  function anyModuloSelecionado(r) {
    const d = r.detalheUnit || {};
    return (d.completos || d.desempenho || d.engajamento || d.metas) > 0;
  }

  function renderTabela(r) {
    const d = r.detalheUnit || {};
    const u = r.usuarios || 0;
    const linhaUnit = (nome, unit) => unit ? `<tr class="sub-row">
      <td>${nome}</td><td class="mono">${brl(unit)}</td><td class="mono">${brl(unit * u)}</td></tr>` : "";

    const cst = r.customs || { itens: [], semImposto: 0, noMrr: false };
    // Cada custom é uma LINHA da proposta (o cliente vê tudo que entrou no projeto).
    const linhaCustomMrr = (cst.noMrr)
      ? cst.itens.map(c => `<tr class="sub-row"><td>Custom · ${escapeHtml(c.summary || c.jira_key)}</td>
          <td></td><td class="mono">${brl(c.valor_sem_imposto)}</td></tr>`).join("")
      : "";

    const recorrente = `
      <tr><th>Recorrente (mensal)</th><th>Unit. (usuário)</th><th>Total (×${u})</th></tr>
      ${linhaUnit("Completos", d.completos)}
      ${linhaUnit("Desempenho", d.desempenho)}
      ${linhaUnit("Engajamento", d.engajamento)}
      ${linhaUnit("Metas", d.metas)}
      ${linhaUnit("RV (+15%)", d.rv)}
      ${linhaUnit("IA (+5%)", d.ia)}
      ${linhaUnit("IA — tokens", d.iaTokens)}
      ${linhaUnit("People Analytics", d.peopleAnalytics)}
      <tr class="sub-row"><td>Desconto aplicado</td><td class="mono">${pct(r.desconto.descontoPct)}</td>
        <td class="mono">−${brl((r.unitSemImp - r.unitComDesconto) * u)}</td></tr>
      ${linhaCustomMrr}
      <tr class="tot-row"><td>Subtotal s/ imposto</td><td></td><td class="mono">${brl(r.mrr.semImposto)}</td></tr>
      <tr class="tot-row"><td>Mensalidade c/ imposto (5,65%)</td><td></td><td class="mono">${brl(r.mrr.comImposto)}</td></tr>`;

    const linhaNR = (nome, horas, val) => val ? `<tr class="sub-row">
      <td>${nome}</td><td class="mono">${horas}h</td><td class="mono">${brl(val)}</td></tr>` : "";
    // Serviços itemizados: "Tipo — descrição"
    const servNR = r.avulsos.map(a =>
      linhaNR(a.descricao ? `${escapeHtml(a.tipo)} — ${escapeHtml(a.descricao)}` : escapeHtml(a.tipo),
              a.horas, a.comImposto)).join("");
    // Cada custom como linha de NR (com imposto), quando for cobrança única.
    const customNR = (!cst.noMrr)
      ? cst.itens.map(c => `<tr class="sub-row"><td>Custom · ${escapeHtml(c.summary || c.jira_key)}</td>
          <td class="mono">—</td><td class="mono">${brl(window.PricingEngine.comImposto(c.valor_sem_imposto))}</td></tr>`).join("")
      : "";
    const nr = `
      <tr><th>Não recorrente (único)</th><th>Horas</th><th>Total c/ imp.</th></tr>
      ${linhaNR(`Implantação (${r.implantacao.porte})`, r.implantacao.horas, r.implantacao.comImposto)}
      ${servNR}
      ${customNR}
      <tr class="tot-row"><td>Total NR c/ imposto</td><td></td><td class="mono">${brl(r.nr.comImposto)}</td></tr>`;

    $("#tabela").innerHTML = `<table><tbody>${recorrente}
      <tr><td colspan="3" style="height:10px"></td></tr>${nr}</tbody></table>`;
  }

  /* ---- Resumo copiável ---- */
  function copiarResumo() {
    const r = window.PricingEngine.simular(lerInput(), ctx);
    const cliente = $("#cliente").value || "(cliente)";
    const mods = [];
    const d = r.detalheUnit;
    if (d.completos) mods.push("Completos");
    if (d.desempenho) mods.push("Desempenho");
    if (d.engajamento) mods.push("Engajamento");
    if (d.metas) mods.push("Metas");
    if (d.rv) mods.push("RV");
    if (d.ia) mods.push("IA");
    if (d.peopleAnalytics) mods.push("People Analytics");
    const txt =
`PROPOSTA ELOFY — ${cliente}
Usuários: ${r.usuarios} (faixa ${r.faixa ? r.faixa.porte : "-"})
Módulos: ${mods.join(", ") || "—"}
Desconto: ${pct(r.desconto.descontoPct)} — ${r.desconto.papel ? r.desconto.papel.papel : "EXCEÇÃO (acima da autonomia)"}
-----------------------------
Mensalidade: ${brl(r.mrr.comImposto)}/mês (c/ imposto)
Implantação + NR: ${brl(r.nr.comImposto)} (único)
Valor global: ${brl(r.global.comImposto)}`;
    navigator.clipboard.writeText(txt).then(() => flash("Copiado!"), () => window.prompt("Copie:", txt));
  }
  function flash(msg) { const b = $("#btnCopiar"), o = b.textContent; b.textContent = msg; setTimeout(() => (b.textContent = o), 1500); }

  // Copia texto e dá feedback no próprio botão.
  function copiarTexto(txt, btn, original) {
    const ok = () => { btn.textContent = "✓ Copiado!"; setTimeout(() => (btn.textContent = original), 1500); };
    navigator.clipboard.writeText(txt).then(ok, () => window.prompt("Copie:", txt));
  }

  function perfilEmail() {
    return (window.PricingStore && window.PricingStore.perfil && window.PricingStore.perfil())
      ? window.PricingStore.perfil().email : null;
  }

  // Monta a visão CLIENT-SAFE da proposta (só valores de venda, com imposto e
  // já com o desconto aplicado). Usada pelo PDF e pelo snapshot da página pública.
  // As linhas somam exatamente os totais (mensalidade, NR, global).
  function montarDadosProposta(r) {
    const d = r.detalheUnit || {};
    const u = r.usuarios || 0;
    // fator: sem imposto → com imposto, já com desconto (igual ao motor).
    const f = (1 - (r.desconto.descontoPct || 0)) / 0.9435;
    const line = (nome, det) => ({ nome, valor: (det || 0) * f * u });
    const recorrente = [
      line("Plataforma — Pacote Completo", d.completos),
      line("Módulo Desempenho", d.desempenho),
      line("Módulo Engajamento", d.engajamento),
      line("Módulo Metas", d.metas),
      line("Remuneração Variável (RV)", d.rv),
      line("Inteligência Artificial (IA)", d.ia),
      line("IA — pacote de tokens", d.iaTokens),
      line("People Analytics", d.peopleAnalytics),
    ].filter(x => x.valor > 0.005);
    const naoRecorrente = [
      { nome: "Implantação & configuração", valor: r.implantacao.comImposto },
      ...r.avulsos.map(a => ({ nome: a.descricao ? `${a.tipo} — ${a.descricao}` : a.tipo, valor: a.comImposto })),
    ].filter(x => x.valor > 0.005);
    // customizações: cada uma vira um item, no recorrente ou no NR conforme cobrança.
    const customLines = (r.customs.itens || []).map(c => ({
      nome: "Customização · " + (c.summary || c.jira_key),
      valor: window.PricingEngine.comImposto(c.valor_sem_imposto),
    }));
    if (r.customs.noMrr) recorrente.push(...customLines); else naoRecorrente.push(...customLines);
    return {
      cliente: $("#cliente").value || "",
      usuarios: u,
      versao: propostaAtualVersao || null,
      vendedor: perfilEmail(),
      validadeDias: 15,
      recorrente, naoRecorrente,
      mrr: r.mrr.comImposto, nr: r.nr.comImposto, global: r.global.comImposto,
    };
  }

  /* ---- Gerar PDF da proposta (somente valores de venda) ---- */
  function gerarPdf() {
    const r = window.PricingEngine.simular(lerInput(), ctx);
    window.PricingPDF.gerar(montarDadosProposta(r));
  }

  /* ---- Persistência (Supabase) ---- */
  let ultimoResultado = null;

  function montarPayload() {
    const input = lerInput();
    const r = window.PricingEngine.simular(input, ctx);
    return {
      cliente: $("#cliente").value || null,
      produto: "elofy",
      bitrixId: bitrixVinculado ? bitrixVinculado.bitrix_id : null,
      bitrixNome: bitrixVinculado ? (bitrixVinculado.nome || bitrixVinculado.empresa_nome) : null,
      usuarios: r.usuarios,
      descontoPct: r.desconto.descontoPct,
      mrr: round2(r.mrr.comImposto),
      nr: round2(r.nr.comImposto),
      global: round2(r.global.comImposto),
      aprovacaoPapel: r.desconto.papel ? r.desconto.papel.papel : null,
      excedeAutonomia: !!r.desconto.excedeAutonomia,
      customNoMrr: !!r.customs.noMrr,
      customTotal: round2(r.customs.comImposto),
      customs: r.customs.itens.map(c => ({
        jira_key: c.jira_key, summary: c.summary,
        horas_dev: c.horas_dev, horas_qa: c.horas_qa,
        valor_sem_imposto: c.valor_sem_imposto,
      })),
      entrada: input,
      resultado: {
        faixa: r.faixa ? r.faixa.porte : null,
        unitSemImp: round2(r.unitSemImp),
        unitComDesconto: round2(r.unitComDesconto),
        mrr: { semImposto: round2(r.mrr.semImposto), comImposto: round2(r.mrr.comImposto) },
        nr: { semImposto: round2(r.nr.semImposto), comImposto: round2(r.nr.comImposto) },
        implantacao: { porte: r.implantacao.porte, horas: r.implantacao.horas },
        tokens: r.tokens, pack: r.pack ? r.pack.pack : null,
        customs: { total: round2(r.customs.comImposto), noMrr: !!r.customs.noMrr, qtd: r.customs.itens.length },
      },
      // visão client-safe congelada (o que a página pública e o PDF mostram)
      snapshot: montarDadosProposta(r),
    };
  }
  function round2(v) { return Math.round((v || 0) * 100) / 100; }

  // Proposta atualmente "aberta" na tela (para "Atualizar atual"). null = nenhuma.
  let propostaAtualId = null;
  let propostaAtualVersao = null;

  // Salvar como NOVA versão. Versiona pela oportunidade do Bitrix.
  async function salvarNovaVersao() {
    const store = window.PricingStore;
    const msg = $("#salvarMsg");
    if (!store || !store.estado().autorizado) { setMsg(msg, "Faça login para salvar.", "warn"); return; }
    if (!bitrixVinculado) {
      setMsg(msg, "Vincule uma oportunidade do Bitrix para versionar (sem vínculo, a proposta fica avulsa).", "warn");
    }
    try {
      setMsg(msg, "Salvando…", "");
      const r = await store.salvarProposta(montarPayload());
      propostaAtualId = r && r.id ? r.id : null;
      propostaAtualVersao = r && r.versao ? r.versao : null;
      setMsg(msg, `✓ Salva como versão ${propostaAtualVersao || "?"}.`, "ok");
      atualizarBotoesVersao();
      carregarHistorico();
    } catch (e) {
      console.error("[salvarNovaVersao]", e);
      setMsg(msg, "Erro ao salvar: " + (e.message || e), "bad");
    }
  }

  // Atualizar a versão atualmente aberta (sem criar nova).
  async function atualizarAtual() {
    const store = window.PricingStore;
    const msg = $("#salvarMsg");
    if (!store || !store.estado().autorizado) { setMsg(msg, "Faça login para salvar.", "warn"); return; }
    if (!propostaAtualId) { setMsg(msg, "Nenhuma versão aberta. Use 'Salvar como nova versão'.", "warn"); return; }
    try {
      setMsg(msg, "Atualizando…", "");
      const r = await store.atualizarProposta(propostaAtualId, montarPayload());
      setMsg(msg, `✓ Versão ${r && r.versao ? r.versao : ""} atualizada.`, "ok");
      carregarHistorico();
    } catch (e) {
      console.error("[atualizarAtual]", e);
      setMsg(msg, "Erro ao atualizar: " + (e.message || e), "bad");
    }
  }

  function atualizarBotoesVersao() {
    const btn = $("#btnAtualizar");
    if (btn) btn.disabled = !propostaAtualId;
  }

  // Carrega o histórico/timeline da oportunidade vinculada (com deltas).
  async function carregarHistorico() {
    const store = window.PricingStore;
    const box = $("#historico");
    if (!store || !store.estado().autorizado) { box.innerHTML = ""; return; }
    if (!bitrixVinculado) {
      box.innerHTML = '<p style="color:var(--txt-3);font-size:13px">Vincule uma oportunidade do Bitrix para ver o histórico de versões e a evolução de valor.</p>';
      return;
    }
    try {
      const rows = await store.historicoProposta(bitrixVinculado.bitrix_id);
      if (!rows.length) { box.innerHTML = '<p style="color:var(--txt-3);font-size:13px">Nenhuma versão salva para esta oportunidade ainda.</p>'; return; }
      box.innerHTML = renderTimeline(rows);
      box.querySelectorAll("[data-abrir]").forEach(el =>
        el.addEventListener("click", () => abrirVersao(rows.find(r => r.id === el.dataset.abrir))));
      box.querySelectorAll("[data-copylink]").forEach(el =>
        el.addEventListener("click", () => {
          const r = rows.find(x => x.id === el.dataset.copylink);
          copiarTexto(linkCliente(r.public_token), el, "🔗 Copiar link");
        }));
      box.querySelectorAll("[data-copymail]").forEach(el =>
        el.addEventListener("click", () => {
          const r = rows.find(x => x.id === el.dataset.copymail);
          copiarTexto(emailCliente(r, linkCliente(r.public_token)), el, "✉ Copiar e-mail");
        }));
      box.querySelectorAll("[data-ganho]").forEach(el =>
        el.addEventListener("click", () => {
          const r = rows.find(x => x.id === el.dataset.ganho);
          if (window.PricingHandoff) window.PricingHandoff.abrir(
            Object.assign({}, r, { bitrix_id: bitrixVinculado ? bitrixVinculado.bitrix_id : null }));
        }));
    } catch (e) {
      box.innerHTML = `<p class="pill bad">Erro ao carregar histórico: ${escapeHtml(e.message || String(e))}</p>`;
    }
  }

  // Link público da proposta (página do cliente, mesma pasta do app).
  function linkCliente(token) {
    const base = location.href.replace(/[^/]*(\?.*)?(#.*)?$/, "");
    return base + "proposta.html?t=" + token;
  }
  function emailCliente(r, link) {
    const cli = r.cliente || "cliente";
    return `Assunto: Sua proposta Elofy — ${cli}\n\n` +
      `Olá!\n\nPreparei a proposta da Elofy para a ${cli}. ` +
      `Você pode visualizá-la e nos dar um retorno (se atendeu, ou o que ajustar) ` +
      `diretamente nesta página:\n\n${link}\n\n` +
      `Fico à disposição para qualquer dúvida.\nAbraço!`;
  }

  // Zona do cliente no histórico: status de acesso + botões de link/e-mail.
  function zonaCliente(r) {
    if (!r.public_token) return "";
    const status = r.visualizada_em
      ? `<span class="cli-pill vista">👁 Visualizada ${r.visualizacoes || 1}× · ${new Date(r.visualizada_em).toLocaleDateString("pt-BR")}</span>`
      : `<span class="cli-pill aguard">Aguardando acesso do cliente</span>`;
    return `<div class="tl-cliente">${status}
      <button class="tl-link" data-copylink="${r.id}" type="button">🔗 Copiar link</button>
      <button class="tl-link" data-copymail="${r.id}" type="button">✉ Copiar e-mail</button>
    </div>`;
  }

  // Zona de ganho/handoff: badge se já ganho, ou botão para iniciar o handoff.
  function ganhoZona(r) {
    if (r.ganho_em) {
      return `<div class="tl-ganho">🏆 Ganho · handoff registrado em ${new Date(r.ganho_em).toLocaleDateString("pt-BR")}</div>`;
    }
    return `<button class="tl-win" data-ganho="${r.id}" type="button">🏆 Dar ganho &amp; handoff</button>`;
  }

  const MOTIVO_LABEL = { custo: "custo acima do esperado", prazo: "prazo não atende", escopo: "diferente do que pedi" };
  function feedbackBlock(r) {
    if (!r.fb_sentimento) return "";
    const map = {
      aprovado: { cls: "ok", txt: "✓ Cliente aprovou a proposta" },
      ajustes: { cls: "warn", txt: "Cliente pediu ajustes" },
      recusado: { cls: "bad", txt: "Cliente recusou" },
    };
    const s = map[r.fb_sentimento] || { cls: "warn", txt: r.fb_sentimento };
    const motivos = Array.isArray(r.fb_motivos) ? r.fb_motivos : [];
    const motTxt = motivos.length
      ? `<div class="fb-mot">${motivos.map(m => `<span>${escapeHtml(MOTIVO_LABEL[m] || m)}</span>`).join("")}</div>` : "";
    const com = r.fb_comentario ? `<div class="fb-com">“${escapeHtml(r.fb_comentario)}”</div>` : "";
    const quando = r.fb_em ? ` · ${new Date(r.fb_em).toLocaleDateString("pt-BR")}` : "";
    return `<div class="tl-fb ${s.cls}"><b>${s.txt}</b>${quando}${motTxt}${com}</div>`;
  }

  function deltaBadge(row) {
    if (row.delta_global == null) return '<span class="delta zero">v1 · base</span>';
    const up = row.delta_global > 0, zero = Math.abs(row.delta_global) < 0.005;
    const cls = zero ? "zero" : (up ? "up" : "down");
    const sinal = up ? "+" : (zero ? "" : "−");
    const pctTxt = row.delta_global_pct == null ? "" : ` (${sinal}${Math.abs(row.delta_global_pct)}%)`;
    return `<span class="delta ${cls}">${sinal}${brl(Math.abs(row.delta_global))}${pctTxt}</span>`;
  }

  // Diferenças relevantes entre uma versão e a anterior (usuarios, desconto, customs).
  function diffVersao(row, anterior) {
    if (!anterior) return "";
    const parts = [];
    if (Number(row.usuarios) !== Number(anterior.usuarios))
      parts.push(`usuários ${num(anterior.usuarios)}→${num(row.usuarios)}`);
    if (Number(row.desconto_pct) !== Number(anterior.desconto_pct))
      parts.push(`desconto ${pct(Number(anterior.desconto_pct))}→${pct(Number(row.desconto_pct))}`);
    const cQtd = (row.customs || []).length, cQtdAnt = (anterior.customs || []).length;
    if (cQtd !== cQtdAnt) parts.push(`customs ${cQtdAnt}→${cQtd}`);
    if (Number(row.custom_total) !== Number(anterior.custom_total))
      parts.push(`valor custom ${brl(anterior.custom_total)}→${brl(row.custom_total)}`);
    return parts.length ? `<div class="tl-diff">${parts.join(" · ")}</div>` : "";
  }

  function renderTimeline(rows) {
    // rows vêm da mais recente para a mais antiga
    const linhas = rows.map((r, i) => {
      const anterior = rows[i + 1]; // a próxima na lista é a versão anterior
      return `<div class="tl-item">
        <div class="tl-head">
          <span class="tl-v">v${r.versao}</span>
          <span class="tl-data">${new Date(r.criado_em).toLocaleDateString("pt-BR")}</span>
          ${deltaBadge(r)}
        </div>
        <div class="tl-vals">
          <span>Global <b>${brl(r.global_com_imposto)}</b></span>
          <span>Mensal ${brl(r.mrr_com_imposto)}</span>
          <span>NR ${brl(r.nr_com_imposto)}</span>
          <span>${num(r.usuarios)} usuários · ${pct(Number(r.desconto_pct))}</span>
        </div>
        ${diffVersao(r, anterior)}
        ${zonaCliente(r)}
        ${feedbackBlock(r)}
        ${ganhoZona(r)}
        <button class="tl-abrir" data-abrir="${r.id}" type="button">Abrir na calculadora</button>
      </div>`;
    }).join("");
    const atual = rows[0], primeira = rows[rows.length - 1];
    const evol = (atual && primeira && atual.versao !== primeira.versao)
      ? `<div class="tl-resumo">Evolução v1→v${atual.versao}: ${brl(primeira.global_com_imposto)} → <b>${brl(atual.global_com_imposto)}</b> (${atual.global_com_imposto >= primeira.global_com_imposto ? "+" : "−"}${brl(Math.abs(atual.global_com_imposto - primeira.global_com_imposto))})</div>`
      : "";
    return evol + `<div class="timeline">${linhas}</div>`;
  }

  // Recarrega os inputs da tela a partir de uma versão salva (entrada jsonb).
  function abrirVersao(row) {
    if (!row || !row.entrada) return;
    const e = row.entrada;
    propostaAtualId = row.id; propostaAtualVersao = row.versao;
    if (e.usuarios != null) $("#usuarios").value = e.usuarios;
    if (e.descontoPct != null) $("#desconto").value = Math.round(e.descontoPct * 1000) / 10;
    const sel = e.sel || {};
    $("#m_completos").checked = !!sel.completos;
    $("#m_desempenho").checked = !!sel.desempenho;
    $("#m_engajamento").checked = !!sel.engajamento;
    $("#m_metas").checked = !!sel.metas;
    $("#m_rv").checked = !!sel.rv;
    $("#m_ia").checked = !!sel.ia;
    if (sel.peopleAnalytics != null) $("#peopleAnalytics").value = sel.peopleAnalytics;
    if (sel.avds != null) $("#avds").value = sel.avds;
    if (sel.pdis != null) $("#pdis").value = sel.pdis;
    if (sel.tokenMode) $("#tokenMode").value = sel.tokenMode;
    // reaplica a regra do pacote: se completo, força RV/IA inclusos; senão, só travas
    aplicarExclusividadeModulos($("#m_completos").checked ? "completos" : null);
    // serviços NR: formato novo (lista) ou antigo (mapa de horas)
    if (Array.isArray(e.servicos)) {
      servicosItens = e.servicos.map(s => ({ tipo: s.tipo || "Consultoria", descricao: s.descricao || "", horas: Number(s.horas) || 0 }));
    } else {
      const sa = e.servicosAvulsosHoras || {};
      servicosItens = [
        { tipo: "Consultoria", descricao: "", horas: Number(sa.consultoria) || 0 },
        { tipo: "Endomarketing", descricao: "", horas: Number(sa.endomarketing) || 0 },
        { tipo: "Desenvolvimento", descricao: "", horas: Number(sa.desenvolvimento) || 0 },
      ].filter(s => s.horas > 0);
    }
    renderServicos();
    $("#customNoMrr").checked = !!e.customNoMrr;
    // customs salvas → repõe disponíveis/selecionadas
    customsDisponiveis = (row.customs || []).map(c => ({
      jira_key: c.jira_key, summary: c.summary, status: "Elaborar Proposta",
      horas_dev: c.horas_dev, horas_qa: c.horas_qa,
      horas_total: (Number(c.horas_dev) || 0) + (Number(c.horas_qa) || 0),
      valor_sem_imposto: c.valor_sem_imposto, url: "#",
    }));
    customsSelecionadas.clear();
    customsDisponiveis.forEach(c => customsSelecionadas.add(c.jira_key));
    renderCustoms();
    atualizarBotoesVersao();
    recalc();
    setMsg($("#salvarMsg"), `Versão ${row.versao} aberta. "Atualizar atual" sobrescreve esta versão.`, "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setMsg(el, txt, kind) {
    el.textContent = txt;
    el.style.color = kind === "ok" ? "var(--green)" : kind === "bad" ? "var(--red)" : kind === "warn" ? "var(--gold)" : "var(--txt-3)";
  }

  /* ---- Login gate ---- */
  function aplicarEstadoAuth(st) {
    // Os dados de preço vivem no Supabase. Sem login autorizado não há config,
    // então o app só abre após autenticação + allowlist.
    const liberado = !!st.autorizado;
    $("#appRoot").classList.toggle("hide", !liberado);
    $("#loginGate").classList.toggle("hide", liberado);
    $("#userBox").classList.toggle("hide", !st.logado);
    if (st.logado && st.perfil) $("#userEmail").textContent = st.perfil.email || "";

    if (!st.disponivel) {
      setMsg($("#loginMsg"),
        "Serviço indisponível: não foi possível conectar ao Supabase.", "bad");
    } else if (st.logado && !st.autorizado) {
      setMsg($("#loginMsg"),
        "Seu e-mail não está autorizado. Solicite acesso ao administrador.", "bad");
    }

    if (liberado) iniciarSessaoAutorizada();
  }

  // Carrega a config do banco (uma vez) e habilita a calculadora + histórico.
  async function iniciarSessaoAutorizada() {
    if (configCarregada) { recalc(); carregarHistorico(); return; }
    const store = window.PricingStore;
    try {
      const cfg = await store.carregarConfig();
      aplicarConfig(cfg);
      renderTabs();
      recalc();
      carregarHistorico();
      ajustarPorPapel();
    } catch (e) {
      $("#tabela").innerHTML =
        `<p class="pill bad">Erro ao carregar tabela de preços: ${escapeHtml(e.message || String(e))}</p>`;
    }
  }

  /* ---- Painel de Propostas (acompanhamento da demanda) ---- */
  // Status do cliente para cada oportunidade, em ordem de prioridade.
  function statusProposta(p) {
    if (p.ganho_em) return { cls: "ok", txt: "🏆 Ganho" };
    if (p.fb_sentimento === "aprovado") return { cls: "ok", txt: "✓ Cliente aprovou" };
    if (p.fb_sentimento === "ajustes") return { cls: "warn", txt: "✏️ Pediu ajustes" };
    if (p.fb_sentimento === "recusado") return { cls: "bad", txt: "✕ Não atende" };
    if (p.visualizada_em) return { cls: "info", txt: `👁 Visualizada ${p.visualizacoes || 1}×` };
    return { cls: "wait", txt: "⏳ Aguardando cliente" };
  }

  async function abrirPainelPropostas() {
    const ov = $("#propostasOverlay");
    ov.classList.remove("hide");
    const body = $("#propostasBody");
    body.innerHTML = `<p style="color:var(--txt-3)">Carregando…</p>`;
    try {
      const rows = await window.PricingStore.painelPropostas();
      if (!rows.length) { body.innerHTML = `<p style="color:var(--txt-3)">Nenhuma proposta salva ainda.</p>`; return; }
      const veTudo = !!(meuPerfil && meuPerfil.ve_tudo);
      body.innerHTML = `
        <p style="font-size:12px;color:var(--txt-3);margin-bottom:12px">
          ${veTudo ? "Você enxerga as propostas de <b>todo o time</b>." : "Estas são as <b>suas</b> propostas."}</p>
        ${rows.map((p, i) => {
          const st = statusProposta(p);
          const closer = veTudo ? `<span class="pp-closer">${escapeHtml((p.criado_por_email || "—").split("@")[0])}</span>` : "";
          const fb_quando = p.fb_em ? ` · ${new Date(p.fb_em).toLocaleDateString("pt-BR")}` : "";
          return `<div class="pp-row">
            <div class="pp-main">
              <div class="pp-nome">${escapeHtml(p.cliente || "—")}
                <span class="pp-v">v${p.versao}${p.versoes > 1 ? ` · ${p.versoes} versões` : ""}</span>
                ${p.fase_bitrix ? faseBadge(p.fase_bitrix, null) : ""}</div>
              <div class="pp-meta">
                <span class="pp-status ${st.cls}">${st.txt}${fb_quando}</span>
                ${closer}
                <span>${new Date(p.criado_em).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
            <div class="pp-right">
              <div class="pp-val mono">${brl(p.global_com_imposto)}</div>
              ${p.bitrix_id ? `<button class="pp-abrir" data-pp="${i}" type="button">Abrir</button>` : ""}
            </div>
          </div>`;
        }).join("")}`;
      // "Abrir": vincula a oportunidade na calculadora e carrega o histórico
      body.querySelectorAll("[data-pp]").forEach(el =>
        el.addEventListener("click", async () => {
          const p = rows[Number(el.dataset.pp)];
          ov.classList.add("hide");
          const negs = await window.PricingStore.buscarNegocios(p.bitrix_id, 5).catch(() => []);
          const neg = negs.find(n => n.bitrix_id === p.bitrix_id)
            || { bitrix_id: p.bitrix_id, nome: p.cliente, empresa_nome: p.cliente, fase: p.fase_bitrix };
          selecionarNegocio(neg);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }));
    } catch (e) {
      body.innerHTML = `<p class="pill bad">Erro ao carregar: ${escapeHtml(e.message || String(e))}</p>`;
    }
  }

  // Mostra o botão de Handoffs para quem enxerga handoffs (onboarding/supervisor/admin).
  let meuPerfil = null;
  async function ajustarPorPapel() {
    try {
      meuPerfil = await window.PricingStore.meuPerfil();
      const btn = $("#btnHandoffs");
      if (btn) btn.classList.toggle("hide", !(meuPerfil && meuPerfil.ve_handoffs));
    } catch (_) { /* silencioso: o painel é extra */ }
  }

  /* ---- Integração Bitrix (buscar e pré-preencher) ---- */
  let buscaTimer = null;

  function ligarBitrix() {
    const inp = $("#bitrixBusca");
    if (!inp) return;
    inp.addEventListener("input", () => {
      clearTimeout(buscaTimer);
      const termo = inp.value.trim();
      if (termo.length < 2) { fecharResultados(); return; }
      buscaTimer = setTimeout(() => buscarNegocios(termo), 300); // debounce
    });
    // fecha o dropdown ao clicar fora
    document.addEventListener("click", e => {
      if (!e.target.closest(".bitrix-search")) fecharResultados();
    });
  }

  function fecharResultados() {
    const box = $("#bitrixResultados");
    box.classList.add("hide"); box.innerHTML = "";
  }

  // Selo da fase do funil, com cor por tipo de fase (ganho/perdido/proposta/andamento).
  function faseBadge(fase, pipeline) {
    if (!fase) return "";
    const f = fase.toLowerCase();
    let cls = "andamento";
    if (/ganho|realizada/.test(f)) cls = "ganho";
    else if (/perdid/.test(f)) cls = "perdido";
    else if (/proposta|negocia|apresenta/.test(f)) cls = "proposta";
    const funil = pipeline ? ` <span class="fase-funil">${escapeHtml(pipeline)}</span>` : "";
    return `<span class="fase-badge ${cls}">${escapeHtml(fase)}</span>${funil}`;
  }

  async function buscarNegocios(termo) {
    const store = window.PricingStore;
    const box = $("#bitrixResultados");
    if (!store || !store.estado().autorizado) return;
    try {
      const rows = await store.buscarNegocios(termo, 20);
      if (!rows.length) {
        box.innerHTML = `<div class="bitrix-empty">Nenhum negócio encontrado para "${escapeHtml(termo)}".</div>`;
      } else {
        box.innerHTML = rows.map((n, i) => {
          const lic = n.qtd_licencas ? `${num(n.qtd_licencas)} licenças` : "sem licenças";
          const meta = [lic, n.valor_rec ? brl(n.valor_rec) + "/mês" : null].filter(Boolean).join(" · ");
          return `<div class="bitrix-item" data-i="${i}">
            <div class="b-nome">${escapeHtml(n.nome || n.empresa_nome || "Negócio " + n.bitrix_id)}</div>
            <div class="b-fase">${faseBadge(n.fase, n.pipeline)}</div>
            <div class="b-meta"><span>#${escapeHtml(n.bitrix_id)}</span><span>${meta}</span></div>
          </div>`;
        }).join("");
        box.querySelectorAll(".bitrix-item").forEach(el =>
          el.addEventListener("click", () => selecionarNegocio(rows[Number(el.dataset.i)])));
      }
      box.classList.remove("hide");
    } catch (e) {
      box.innerHTML = `<div class="bitrix-empty">Erro na busca: ${escapeHtml(e.message || String(e))}</div>`;
      box.classList.remove("hide");
    }
  }

  function selecionarNegocio(n) {
    bitrixVinculado = n;
    // novo vínculo → contexto de versão zera; histórico passa a ser desta oportunidade
    propostaAtualId = null; propostaAtualVersao = null; atualizarBotoesVersao();
    fecharResultados();
    $("#bitrixBusca").value = "";
    // pré-preenche cliente e nº de usuários (licenças têm prioridade)
    if (!$("#cliente").value) $("#cliente").value = n.nome || n.empresa_nome || "";
    const lic = Number(n.qtd_licencas) || Number(n.total_colaboradores) || 0;
    if (lic > 0) $("#usuarios").value = lic;
    renderVinculo();
    carregarHistorico();
    recalc();
  }

  function renderVinculo() {
    const box = $("#bitrixVinculo");
    if (!bitrixVinculado) { box.classList.add("hide"); box.innerHTML = ""; return; }
    const n = bitrixVinculado;
    const atual = n.valor_rec ? ` · atual no Bitrix: <b>${brl(n.valor_rec)}/mês</b>` : "";
    box.classList.remove("hide");
    box.innerHTML =
      `🔗 Vinculado: <b>${escapeHtml(n.nome || n.empresa_nome)}</b> (#${escapeHtml(n.bitrix_id)})${atual}` +
      (n.fase ? ` ${faseBadge(n.fase, n.pipeline)}` : "") +
      `<button class="b-x" id="bitrixDesvincular" title="Desvincular">✕</button>`;
    $("#bitrixDesvincular").addEventListener("click", () => {
      bitrixVinculado = null; propostaAtualId = null; propostaAtualVersao = null;
      atualizarBotoesVersao(); renderVinculo(); carregarHistorico();
    });
  }

  /* ---- Customizações (Jira) ---- */
  async function buscarCustoms() {
    const store = window.PricingStore;
    const box = $("#customsLista");
    if (!store || !store.estado().autorizado) return;
    const bitrixId = bitrixVinculado ? bitrixVinculado.bitrix_id : null;
    const cliente = $("#cliente").value.trim() || (bitrixVinculado ? (bitrixVinculado.empresa_nome || bitrixVinculado.nome) : null);
    if (!bitrixId && !cliente) {
      box.innerHTML = '<p class="customs-empty">Vincule um negócio do Bitrix ou informe o cliente para buscar customs.</p>';
      return;
    }
    box.innerHTML = '<p class="customs-empty">Buscando…</p>';
    try {
      customsDisponiveis = await store.buscarCustoms(bitrixId, cliente);
      // mantém seleção anterior apenas para itens ainda presentes
      [...customsSelecionadas].forEach(k => {
        if (!customsDisponiveis.some(c => c.jira_key === k)) customsSelecionadas.delete(k);
      });
      renderCustoms();
      recalc();
    } catch (e) {
      box.innerHTML = `<p class="pill bad">Erro ao buscar customs: ${escapeHtml(e.message || String(e))}</p>`;
    }
  }

  function renderCustoms() {
    const box = $("#customsLista");
    if (!customsDisponiveis.length) {
      box.innerHTML = '<p class="customs-empty">Nenhuma custom liberada (status "Elaborar Proposta") para este cliente.</p>';
      return;
    }
    const itens = customsDisponiveis.map(c => {
      const on = customsSelecionadas.has(c.jira_key);
      return `<label class="custom-item ${on ? "on" : ""}" data-key="${escapeHtml(c.jira_key)}">
        <input type="checkbox" ${on ? "checked" : ""}>
        <span class="ci-main">
          <span class="ci-nome">${escapeHtml(c.summary || c.jira_key)}</span>
          <span class="ci-meta">
            <a class="ci-key" href="${escapeHtml(c.url || "#")}" target="_blank" rel="noopener">${escapeHtml(c.jira_key)}</a>
            <span>${num(c.horas_dev)}h dev + ${num(c.horas_qa)}h QA = ${num(c.horas_total)}h</span>
          </span>
        </span>
        <span class="ci-val">${brl(c.valor_sem_imposto)}</span>
      </label>`;
    }).join("");
    const sel = customsDisponiveis.filter(c => customsSelecionadas.has(c.jira_key));
    const totSemImp = sel.reduce((s, c) => s + (Number(c.valor_sem_imposto) || 0), 0);
    const tot = sel.length
      ? `<div class="customs-tot"><span>${sel.length} custom(s) · grupo</span><span>${brl(totSemImp)} + imp.</span></div>`
      : "";
    box.innerHTML = itens + tot;
    box.querySelectorAll(".custom-item input").forEach(cb => {
      cb.addEventListener("change", () => {
        const key = cb.closest(".custom-item").dataset.key;
        if (cb.checked) customsSelecionadas.add(key); else customsSelecionadas.delete(key);
        renderCustoms();
        recalc();
      });
    });
  }

  /* ---- Serviços NR itemizados ---- */
  function addServico() { servicosItens.push({ tipo: "Consultoria", descricao: "", horas: 0 }); renderServicos(); }

  function renderServicos() {
    const box = $("#servicosLista");
    if (!box) return;
    const valorHora = (ctx.servicos && ctx.servicos.valor_hora) || 220;
    box.innerHTML = servicosItens.map((s, i) => {
      const opts = TIPOS_SERVICO.map(t =>
        `<option value="${t}" ${t === s.tipo ? "selected" : ""}>${t}</option>`).join("");
      const valor = (Number(s.horas) || 0) * valorHora;
      return `<div class="serv-item" data-i="${i}">
        <select class="serv-tipo">${opts}</select>
        <input class="serv-desc" type="text" placeholder="Descrição (ex.: Clima organizacional)" value="${escapeHtml(s.descricao || "")}">
        <input class="serv-horas" type="number" min="0" step="1" placeholder="h" value="${s.horas || 0}">
        <span class="serv-val mono">${brl(valor)}</span>
        <button class="serv-x" type="button" title="Remover">✕</button>
      </div>`;
    }).join("");
    box.querySelectorAll(".serv-item").forEach(el => {
      const i = Number(el.dataset.i);
      el.querySelector(".serv-tipo").addEventListener("change", e => { servicosItens[i].tipo = e.target.value; recalc(); });
      el.querySelector(".serv-desc").addEventListener("input", e => { servicosItens[i].descricao = e.target.value; });
      el.querySelector(".serv-horas").addEventListener("input", e => {
        servicosItens[i].horas = Number(e.target.value) || 0;
        el.querySelector(".serv-val").textContent = brl(servicosItens[i].horas * valorHora);
        recalc();
      });
      el.querySelector(".serv-x").addEventListener("click", () => { servicosItens.splice(i, 1); renderServicos(); recalc(); });
    });
  }

  function ligarLogin() {
    const store = window.PricingStore;
    if (!store) {
      // auth.js não carregou → sem dados de preço, app não pode operar.
      $("#appRoot").classList.add("hide");
      $("#loginGate").classList.remove("hide");
      setMsg($("#loginMsg"), "Serviço indisponível (falha ao carregar o módulo de acesso).", "bad");
      return;
    }
    store.onChange(aplicarEstadoAuth);
    $("#btnLogin").addEventListener("click", async () => {
      const email = $("#loginEmail").value.trim();
      const msg = $("#loginMsg");
      if (!email) { setMsg(msg, "Informe seu e-mail.", "warn"); return; }
      try {
        setMsg(msg, "Enviando código…", "");
        await store.login(email);
        $("#codigoBox").classList.remove("hide");
        $("#loginCodigo").focus();
        setMsg(msg, "✓ Enviamos um código (e um link) para " + email + ". Digite o código abaixo.", "ok");
      } catch (e) { setMsg(msg, "Erro: " + (e.message || e), "bad"); }
    });
    // Entrar com o código de 6 dígitos (imune ao SafeLinks do Outlook).
    $("#btnCodigo").addEventListener("click", async () => {
      const email = $("#loginEmail").value.trim();
      const codigo = $("#loginCodigo").value.replace(/\D/g, "");
      const msg = $("#loginMsg");
      if (codigo.length < 6) { setMsg(msg, "Digite os 6 dígitos do código.", "warn"); return; }
      try {
        setMsg(msg, "Entrando…", "");
        await store.verificarCodigo(email, codigo);
        // onAuthStateChange cuida de carregar o perfil e abrir o app.
      } catch (e) { setMsg(msg, "Código inválido ou expirado. " + (e.message || ""), "bad"); }
    });
    // Login por senha (temporário, enquanto o SMTP não está configurado).
    $("#btnSenha").addEventListener("click", async () => {
      const email = $("#loginEmail").value.trim();
      const senha = $("#loginSenha").value;
      const msg = $("#loginMsg");
      if (!email || !senha) { setMsg(msg, "Informe e-mail e senha.", "warn"); return; }
      try {
        setMsg(msg, "Entrando…", "");
        await store.loginSenha(email, senha);
      } catch (e) { setMsg(msg, "E-mail ou senha inválidos. " + (e.message || ""), "bad"); }
    });
    $("#loginEmail").addEventListener("keydown", e => { if (e.key === "Enter") $("#btnLogin").click(); });
    $("#loginCodigo").addEventListener("keydown", e => { if (e.key === "Enter") $("#btnCodigo").click(); });
    $("#loginSenha").addEventListener("keydown", e => { if (e.key === "Enter") $("#btnSenha").click(); });
    $("#btnLogout").addEventListener("click", () => store.logout());
    store.init();
  }

  /* ---- Init ---- */
  function init() {
    ligarLogin();
    ligarBitrix();
    $("#btnNovaVersao").addEventListener("click", salvarNovaVersao);
    $("#btnAtualizar").addEventListener("click", atualizarAtual);
    $("#btnHistorico").addEventListener("click", carregarHistorico);
    $("#btnBuscarCustoms").addEventListener("click", buscarCustoms);
    $("#btnHandoffs").addEventListener("click", () => window.PricingHandoff && window.PricingHandoff.abrirPainel());
    if (window.PricingHandoff) window.PricingHandoff.setOnConcluir(carregarHistorico);
    // painel de acompanhamento de propostas
    $("#btnPropostas").addEventListener("click", abrirPainelPropostas);
    $("#propostasFechar").addEventListener("click", () => $("#propostasOverlay").classList.add("hide"));
    $("#propostasOverlay").addEventListener("click", e => {
      if (e.target === $("#propostasOverlay")) $("#propostasOverlay").classList.add("hide");
    });
    atualizarBotoesVersao();
    $("#customNoMrr").addEventListener("change", recalc);
    $("#btnAddServico").addEventListener("click", addServico);
    renderServicos();
    // campos genéricos → recalc
    ["#usuarios","#desconto","#avds","#pdis","#tokenMode","#peopleAnalytics"]
      .forEach(s => { const el = $(s); if (el) el.addEventListener("input", recalc); });
    // módulos: "Completos" trava avulsos e inclui RV/IA; avulsos travam Completos
    [["#m_completos","completos"],["#m_desempenho","base"],["#m_engajamento","base"],
     ["#m_metas","base"],["#m_rv","incluso"],["#m_ia","incluso"]].forEach(([s, origem]) => {
      const el = $(s);
      if (el) el.addEventListener("change", () => { aplicarExclusividadeModulos(origem); recalc(); });
    });
    $("#btnCopiar").addEventListener("click", copiarResumo);
    $("#btnPdf").addEventListener("click", gerarPdf);
    $("#btnLimpar").addEventListener("click", () => {
      document.querySelectorAll('#painelElofy input[type=checkbox]').forEach(c => c.checked = false);
      ["#desconto","#avds","#pdis"].forEach(s => $(s).value = 0);
      $("#peopleAnalytics").value = ""; $("#cliente").value = "";
      bitrixVinculado = null; renderVinculo();
      customsDisponiveis = []; customsSelecionadas.clear();
      $("#customNoMrr").checked = false; $("#customsLista").innerHTML = "";
      servicosItens = []; renderServicos();
      aplicarExclusividadeModulos(null);
      propostaAtualId = null; propostaAtualVersao = null;
      atualizarBotoesVersao(); carregarHistorico();
      recalc();
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
