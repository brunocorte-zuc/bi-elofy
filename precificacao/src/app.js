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
      servicosAvulsosHoras: {
        consultoria:     $("#s_consultoria").value,
        endomarketing:   $("#s_endomarketing").value,
        desenvolvimento: $("#s_desenvolvimento").value,
      },
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
    const linhaCustomMrr = (cst.noMrr && cst.semImposto)
      ? `<tr class="sub-row"><td>Customizações (${cst.itens.length})</td><td></td><td class="mono">${brl(cst.semImposto)}</td></tr>`
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
    const customNR = (!cst.noMrr && cst.semImposto)
      ? `<tr class="sub-row"><td>Customizações (${cst.itens.length})</td><td class="mono">—</td><td class="mono">${brl(cst.comImposto)}</td></tr>`
      : "";
    const nr = `
      <tr><th>Não recorrente (único)</th><th>Horas</th><th>Total c/ imp.</th></tr>
      ${linhaNR(`Implantação (${r.implantacao.porte})`, r.implantacao.horas, r.implantacao.comImposto)}
      ${r.avulsos.map(a => linhaNR(a.nome, a.horas, a.comImposto)).join("")}
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
    } catch (e) {
      box.innerHTML = `<p class="pill bad">Erro ao carregar histórico: ${escapeHtml(e.message || String(e))}</p>`;
    }
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
    const sa = e.servicosAvulsosHoras || {};
    $("#s_consultoria").value = sa.consultoria || 0;
    $("#s_endomarketing").value = sa.endomarketing || 0;
    $("#s_desenvolvimento").value = sa.desenvolvimento || 0;
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
    } catch (e) {
      $("#tabela").innerHTML =
        `<p class="pill bad">Erro ao carregar tabela de preços: ${escapeHtml(e.message || String(e))}</p>`;
    }
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
          const meta = [escapeHtml(n.fase || "—"), lic, n.valor_rec ? brl(n.valor_rec) + "/mês" : null]
            .filter(Boolean).join(" · ");
          return `<div class="bitrix-item" data-i="${i}">
            <div class="b-nome">${escapeHtml(n.nome || n.empresa_nome || "Negócio " + n.bitrix_id)}</div>
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
        setMsg(msg, "Enviando…", "");
        await store.login(email);
        setMsg(msg, "✓ Link enviado! Verifique seu e-mail e clique para entrar.", "ok");
      } catch (e) { setMsg(msg, "Erro: " + (e.message || e), "bad"); }
    });
    $("#loginEmail").addEventListener("keydown", e => { if (e.key === "Enter") $("#btnLogin").click(); });
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
    atualizarBotoesVersao();
    $("#customNoMrr").addEventListener("change", recalc);
    [
      "#usuarios","#desconto","#avds","#pdis","#tokenMode","#peopleAnalytics",
      "#s_consultoria","#s_endomarketing","#s_desenvolvimento",
      "#m_completos","#m_desempenho","#m_engajamento","#m_metas","#m_rv","#m_ia",
    ].forEach(s => { const el = $(s); if (el) el.addEventListener("input", recalc); });
    $("#btnCopiar").addEventListener("click", copiarResumo);
    $("#btnLimpar").addEventListener("click", () => {
      document.querySelectorAll('#painelElofy input[type=checkbox]').forEach(c => c.checked = false);
      ["#desconto","#avds","#pdis","#s_consultoria","#s_endomarketing","#s_desenvolvimento"].forEach(s => $(s).value = 0);
      $("#peopleAnalytics").value = ""; $("#cliente").value = "";
      bitrixVinculado = null; renderVinculo();
      customsDisponiveis = []; customsSelecionadas.clear();
      $("#customNoMrr").checked = false; $("#customsLista").innerHTML = "";
      propostaAtualId = null; propostaAtualVersao = null;
      atualizarBotoesVersao(); carregarHistorico();
      recalc();
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
