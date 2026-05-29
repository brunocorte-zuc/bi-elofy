/* ============================================================================
 *  INTERFACE DO SIMULADOR DE PROPOSTA  ·  HR TECH
 *  ----------------------------------------------------------------------------
 *  Liga os dados (data/*.js) + o motor (engine.js) à tela.
 *  Não contém regra de preço — apenas leitura de inputs e renderização.
 * ========================================================================== */
(function () {
  "use strict";

  const CATALOGO = window.PRECIFICACAO_CATALOGO || [];
  const PARAMS   = window.PRECIFICACAO_PARAMS   || {};
  const ALCADA   = window.PRECIFICACAO_ALCADA   || [];
  const ctx = { catalogo: CATALOGO, params: PARAMS, alcada: ALCADA };

  const $  = s => document.querySelector(s);
  const brl = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: PARAMS.moeda || "BRL" }).format(v || 0);
  const pct = v => (v * 100).toFixed(1).replace(".", ",") + "%";

  /* ---- Render do catálogo (checkboxes agrupados por categoria) ---- */
  function renderCatalogo() {
    const box = $("#modulos");
    const cats = [...new Set(CATALOGO.filter(m => m.ativo !== false).map(m => m.categoria))];
    box.innerHTML = cats.map(cat => {
      const itens = CATALOGO.filter(m => m.categoria === cat && m.ativo !== false).map(m => {
        const u = m.cobranca === "por_colaborador" ? "/colab/mês"
                : m.cobranca === "fixo_mensal"     ? "/mês"
                : " único";
        return `<label class="mod" data-id="${m.id}">
          <input type="checkbox" value="${m.id}">
          <span class="nm">${m.nome}<small>${rotuloCobranca(m.cobranca)}</small></span>
          <span class="pr mono">${brl(m.preco_lista)}${u}</span>
        </label>`;
      }).join("");
      return `<div class="cat-h">${cat}</div>${itens}`;
    }).join("");

    box.querySelectorAll(".mod input").forEach(cb => {
      cb.addEventListener("change", () => {
        cb.closest(".mod").classList.toggle("on", cb.checked);
        recalc();
      });
    });
  }

  function rotuloCobranca(c) {
    return c === "por_colaborador" ? "Recorrente · por colaborador"
         : c === "fixo_mensal"     ? "Recorrente · fixo"
         : "Cobrança única (setup)";
  }

  function lerInput() {
    return {
      colaboradores: $("#colaboradores").value,
      prazoMeses:    $("#prazo").value,
      descontoPct:     (Number($("#desconto").value) || 0) / 100,
      descontoSetupPct:(Number($("#descontoSetup").value) || 0) / 100,
      modulosIds: [...document.querySelectorAll(".mod input:checked")].map(i => i.value),
    };
  }

  /* ---- Cálculo + render ---- */
  function recalc() {
    const r = window.PricingEngine.simular(lerInput(), ctx);
    renderKpis(r);
    renderAlertas(r);
    renderTabela(r);
  }

  function renderKpis(r) {
    $("#kpis").innerHTML = `
      <div class="kpi"><div class="lbl">MRR (mensal)</div>
        <div class="val mono">${brl(r.mrr.final)}</div>
        <div class="sub">lista ${brl(r.mrr.lista)} · desc. ${pct(r.descontoMrr)}</div></div>
      <div class="kpi"><div class="lbl">Setup (único)</div>
        <div class="val mono">${brl(r.setup.final)}</div>
        <div class="sub">implantação / serviços</div></div>
      <div class="kpi"><div class="lbl">TCV (${r.prazo}m)</div>
        <div class="val mono">${brl(r.tcv)}</div>
        <div class="sub">${r.prazo}× MRR + setup</div></div>
      <div class="kpi"><div class="lbl">Margem MRR</div>
        <div class="val mono ${r.mrr.margemPct < (PARAMS.margem_minima||0) ? "neg":"pos"}">${pct(r.mrr.margemPct)}</div>
        <div class="sub">alvo ${pct(PARAMS.margem_alvo||0)} · mín ${pct(PARAMS.margem_minima||0)}</div></div>
      <div class="kpi"><div class="lbl">Margem Setup</div>
        <div class="val mono">${r.setup.final ? pct(r.setup.margemPct) : "—"}</div>
        <div class="sub">contribuição</div></div>
      <div class="kpi"><div class="lbl">Colaboradores</div>
        <div class="val mono">${r.colaboradores}</div>
        <div class="sub">base da simulação</div></div>`;
  }

  function renderAlertas(r) {
    const out = [];
    if (r.alcada) {
      const top = r.descontoMrr <= (ALCADA[0]?.desconto_max_pct ?? 0);
      out.push(`<span class="pill ${top ? "ok" : "warn"}">
        ✓ Aprovação: ${r.alcada.papel} (até ${pct(r.alcada.desconto_max_pct)})</span>`);
    } else {
      out.push(`<span class="pill bad">✕ Desconto ${pct(r.descontoMrr)} excede toda a alçada — requer exceção</span>`);
    }
    if (r.alertaMargem) out.push(`<span class="pill bad">⚠ Margem MRR abaixo do mínimo (${pct(PARAMS.margem_minima||0)})</span>`);
    if (r.alertaPiso)   out.push(`<span class="pill warn">⚠ Há item abaixo do piso de preço</span>`);
    if (!r.alertaMargem && !r.alertaPiso && r.alcada && r.linhas.length)
      out.push(`<span class="pill ok">✓ Proposta dentro das políticas</span>`);
    $("#alertas").innerHTML = out.join("");
  }

  function renderTabela(r) {
    if (!r.linhas.length) {
      $("#tabela").innerHTML = `<p style="color:var(--txt-3);padding:8px 0">Selecione módulos para montar a proposta.</p>`;
      return;
    }
    const linha = l => `<tr>
      <td>${l.nome} <span class="tag">${l.cobranca === "unica" ? "único" : "rec."}</span>${l.abaixoPiso ? ' <span class="pill bad" style="padding:1px 7px">piso</span>' : ""}</td>
      <td class="mono">${brl(l.lista)}</td>
      <td class="mono">${l.desconto ? pct(l.desconto) : "—"}</td>
      <td class="mono">${brl(l.final)}</td>
      <td class="mono ${l.margemPct < (PARAMS.margem_minima||0) ? "neg":""}">${pct(l.margemPct)}</td></tr>`;

    const bloco = (titulo, linhas, tot) => linhas.length ? `
      <tr><td colspan="5" class="cat-h" style="padding-top:14px">${titulo}</td></tr>
      ${linhas.map(linha).join("")}
      <tr style="border-top:1px solid var(--border-md)">
        <td><b>Subtotal ${titulo}</b></td>
        <td class="mono">${brl(tot.lista)}</td>
        <td class="mono">${tot.lista ? pct(1 - tot.final/tot.lista) : "—"}</td>
        <td class="mono"><b>${brl(tot.final)}</b></td>
        <td class="mono">${pct(tot.margemPct)}</td></tr>` : "";

    $("#tabela").innerHTML = `<table>
      <thead><tr><th>Item</th><th>Lista</th><th>Desc.</th><th>Final</th><th>Margem</th></tr></thead>
      <tbody>
        ${bloco("Recorrente / mês", r.recorrentes, r.mrr)}
        ${bloco("Cobrança única", r.unicos, r.setup)}
      </tbody></table>`;
  }

  /* ---- Resumo copiável ---- */
  function copiarResumo() {
    const r = window.PricingEngine.simular(lerInput(), ctx);
    const cliente = $("#cliente").value || "(cliente)";
    const itens = r.linhas.map(l => `  • ${l.nome}: ${brl(l.final)}${l.cobranca==="unica"?" (único)":"/mês"}`).join("\n");
    const txt =
`PROPOSTA — ${cliente}
Colaboradores: ${r.colaboradores} · Prazo: ${r.prazo} meses
${itens}
-----------------------------
MRR: ${brl(r.mrr.final)}/mês  (desc. ${pct(r.descontoMrr)})
Setup: ${brl(r.setup.final)}
TCV (${r.prazo}m): ${brl(r.tcv)}
Margem MRR: ${pct(r.mrr.margemPct)}
Aprovação: ${r.alcada ? r.alcada.papel : "EXCEÇÃO (acima da alçada)"}`;
    navigator.clipboard.writeText(txt).then(
      () => flash("Resumo copiado!"),
      () => { window.prompt("Copie o resumo:", txt); }
    );
  }

  function flash(msg) {
    const b = $("#btnCopiar"); const o = b.textContent;
    b.textContent = msg; setTimeout(() => (b.textContent = o), 1600);
  }

  /* ---- Init ---- */
  function init() {
    if (!CATALOGO.length) {
      document.body.insertAdjacentHTML("afterbegin",
        '<p style="color:#F05252;padding:20px">Erro: catálogo não carregado. Verifique data/catalogo.js</p>');
      return;
    }
    $("#prazo").value = PARAMS.prazo_padrao_meses || 12;
    renderCatalogo();
    ["#colaboradores","#prazo","#desconto","#descontoSetup"].forEach(s =>
      $(s).addEventListener("input", recalc));
    $("#btnCopiar").addEventListener("click", copiarResumo);
    $("#btnLimpar").addEventListener("click", () => {
      document.querySelectorAll(".mod input:checked").forEach(i => { i.checked = false; i.closest(".mod").classList.remove("on"); });
      $("#desconto").value = 0; $("#descontoSetup").value = 0;
      recalc();
    });
    recalc();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
