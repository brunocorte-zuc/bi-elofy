/* ============================================================================
 *  CUSTOMER OPS  ·  JORNADA ELOFY
 *  ----------------------------------------------------------------------------
 *  Etapa pós-handoff da jornada: acompanhamento das implantações.
 *  - QUALQUER usuário autorizado VÊ tudo (a dor é visibilidade).
 *  - Editam: analista de projetos (papel onboarding), admin e supervisor.
 *  - Cada implantação tem link público para o CLIENTE acompanhar
 *    (acompanhamento.html?t=<token>).
 *
 *  Expõe window.JornadaOps: { montar(), abrirDetalhe(id) }.
 * ========================================================================== */
(function (global) {
  "use strict";

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dataBR = d => d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("pt-BR") : "—";
  const store = () => global.PricingStore;

  const ETAPAS = [
    { id: "kickoff",       nome: "Kickoff" },
    { id: "configuracao",  nome: "Configuração" },
    { id: "treinamento",   nome: "Treinamento" },
    { id: "golive",        nome: "Go-live" },
    { id: "acompanhamento",nome: "Acompanhamento" },
    { id: "concluido",     nome: "Concluído" },
  ];
  const SAUDE = {
    ok:       { cls: "ok",   txt: "🟢 No prazo" },
    atencao:  { cls: "warn", txt: "🟡 Atenção" },
    problema: { cls: "bad",  txt: "🔴 Problema" },
  };

  let cache = [];          // implantações carregadas
  let filtro = "ativas";   // ativas | problemas | concluidas | todas
  let podeEditar = false;

  /* ---------- Board ---------- */
  async function montar(perfil) {
    // Se o perfil ainda não chegou (corrida com o carregamento), busca aqui.
    if (!perfil) {
      try { perfil = await store().meuPerfil(); } catch (_) { perfil = null; }
    }
    podeEditar = !!(perfil && (perfil.ve_handoffs)); // onboarding/admin/supervisor
    const lista = $("#opsLista");
    lista.innerHTML = `<p style="color:var(--txt-3)">Carregando…</p>`;
    try {
      cache = await store().opsListar();
      renderKpis();
      renderFiltros();
      renderLista();
    } catch (e) {
      lista.innerHTML = `<p class="pill bad">Erro ao carregar: ${esc(e.message || e)}</p>`;
    }
  }

  function renderKpis() {
    const ativas = cache.filter(i => i.etapa !== "concluido");
    const problemas = cache.filter(i => i.saude === "problema");
    const golivesMes = cache.filter(i => i.golive_em &&
      new Date(i.golive_em).getMonth() === new Date().getMonth() &&
      new Date(i.golive_em).getFullYear() === new Date().getFullYear());
    $("#opsKpis").innerHTML = `
      <span class="ops-kpi">${ativas.length} <small>em andamento</small></span>
      <span class="ops-kpi ${problemas.length ? "bad" : ""}">${problemas.length} <small>com problema</small></span>
      <span class="ops-kpi">${golivesMes.length} <small>go-lives no mês</small></span>`;
  }

  function renderFiltros() {
    const f = [
      ["ativas", "Em andamento"], ["problemas", "Com problema"],
      ["concluidas", "Concluídas"], ["todas", "Todas"],
    ];
    $("#opsFiltros").innerHTML = f.map(([id, nome]) =>
      `<button class="ops-filtro ${filtro === id ? "on" : ""}" data-f="${id}" type="button">${nome}</button>`).join("");
    $("#opsFiltros").querySelectorAll("[data-f]").forEach(b =>
      b.addEventListener("click", () => { filtro = b.dataset.f; renderFiltros(); renderLista(); }));
  }

  function filtrar() {
    if (filtro === "problemas") return cache.filter(i => i.saude === "problema");
    if (filtro === "concluidas") return cache.filter(i => i.etapa === "concluido");
    if (filtro === "todas") return cache;
    return cache.filter(i => i.etapa !== "concluido");
  }

  // Stepper de etapas. `tempos` = {"kickoff": 5.0, ...} → mostra os dias gastos
  // em cada etapa já visitada (a atual conta até agora).
  function stepper(etapa, tempos) {
    const idx = ETAPAS.findIndex(e => e.id === etapa);
    const t = tempos || {};
    const dias = id => t[id] != null ? `<span class="dias">${fmtDias(t[id])}</span>` : "";
    return `<div class="stepper">${ETAPAS.map((e, i) => `
      <div class="step ${i < idx ? "done" : ""} ${i === idx ? "now" : ""}">
        <span class="dot">${i < idx ? "✓" : i + 1}</span>
        <span class="lbl">${e.nome}</span>
        ${dias(e.id)}
      </div>${i < ETAPAS.length - 1 ? '<div class="lin' + (i < idx ? " done" : "") + '"></div>' : ""}`).join("")}
    </div>`;
  }
  function fmtDias(d) {
    const n = Number(d) || 0;
    return n < 1 ? "<1d" : Math.round(n) + "d";
  }

  function renderLista() {
    const lista = $("#opsLista");
    const rows = filtrar();
    if (!rows.length) {
      lista.innerHTML = `<p style="color:var(--txt-3);font-size:13px">Nenhuma implantação ${filtro === "ativas" ? "em andamento" : "neste filtro"}.
        As implantações nascem automaticamente quando o Comercial conclui um handoff. 🏆</p>`;
      return;
    }
    lista.innerHTML = rows.map(i => {
      const s = SAUDE[i.saude] || SAUDE.ok;
      const etapaNome = (ETAPAS.find(e => e.id === i.etapa) || {}).nome || i.etapa;
      return `<div class="ops-card" data-ops="${i.id}">
        <div class="ops-top">
          <div class="ops-nome">${esc(i.cliente)}
            <span class="ops-etapa">${esc(etapaNome)}</span>
            <span class="pp-status ${s.cls}">${s.txt}</span>
            ${i.problemas_abertos > 0 ? `<span class="pp-status bad">⚠ ${i.problemas_abertos} problema(s) aberto(s)</span>` : ""}
          </div>
          <button class="pp-abrir" type="button">Abrir</button>
        </div>
        ${stepper(i.etapa, i.tempos_etapas)}
        ${timeLinha(i)}
        <div class="ops-meta">
          <span>📅 início ${dataBR(i.inicio)} · ${i.dias_corridos}d corridos</span>
          <span>🎯 go-live previsto ${dataBR(i.previsao_golive)}</span>
          ${i.golive_em ? `<span>🚀 go-live em ${dataBR(i.golive_em)}</span>` : ""}
        </div>
        ${i.ultimo_update ? `<div class="ops-ultimo">“${esc(i.ultimo_update)}” <small>· ${dataBR(i.ultimo_update_em)}</small></div>` : ""}
      </div>`;
    }).join("");
    lista.querySelectorAll(".ops-card").forEach(el =>
      el.querySelector(".pp-abrir").addEventListener("click", () => abrirDetalhe(el.dataset.ops)));
  }

  // Linha compacta do time da implantação (board e detalhe).
  function timeLinha(i) {
    const p = (rotulo, v) => v ? `<span><b>${rotulo}</b> ${esc(String(v).split("@")[0])}</span>` : "";
    const partes = [
      p("CS:", i.cs_email), p("Projeto:", i.responsavel_email),
      p("Arquitetura:", i.arquitetura_email), p("IS:", i.time_is),
    ].filter(Boolean);
    if (!partes.length) return `<div class="ops-time vazio">👥 Time ainda não atribuído</div>`;
    return `<div class="ops-time">👥 ${partes.join(" · ")}</div>`;
  }

  /* ---------- Detalhe ---------- */
  async function abrirDetalhe(id) {
    const impl = cache.find(i => i.id === id);
    if (!impl) return;
    const ov = $("#opsOverlay");
    ov.classList.remove("hide");
    const body = $("#opsBody");
    body.innerHTML = `<div class="ho-head"><h2>${esc(impl.cliente)}</h2></div><p style="color:var(--txt-3)">Carregando…</p>`;
    let updates = [];
    try { updates = await store().opsUpdates(id); } catch (e) { /* segue com timeline vazia */ }

    const s = SAUDE[impl.saude] || SAUDE.ok;
    const linkCliente = location.href.replace(/[^/]*(\?.*)?(#.*)?$/, "") + "acompanhamento.html?t=" + impl.public_token;

    body.innerHTML = `
      <div class="ho-head"><h2>🚀 ${esc(impl.cliente)}</h2>
        <span class="pp-status ${s.cls}">${s.txt}</span></div>
      ${stepper(impl.etapa, impl.tempos_etapas)}
      <div class="ops-meta" style="margin:10px 0 16px">
        <span>📅 início ${dataBR(impl.inicio)} · ${impl.dias_corridos}d corridos</span>
        <span>🎯 go-live previsto ${dataBR(impl.previsao_golive)}</span>
        ${impl.golive_em ? `<span>🚀 go-live em ${dataBR(impl.golive_em)}</span>` : ""}
      </div>

      <div class="ops-acoes">
        <button class="tl-link" id="opsCopiarLink" type="button">🔗 Copiar link do cliente</button>
        ${podeEditar ? `
          <select id="opsNovaEtapa" class="ops-sel">
            <option value="">Mudar etapa…</option>
            ${ETAPAS.map(e => `<option value="${e.id}" ${e.id === impl.etapa ? "disabled" : ""}>${e.nome}</option>`).join("")}
          </select>` : ""}
      </div>

      <div class="ho-sec">
        <h3>👥 Time da implantação</h3>
        ${podeEditar ? `
        <div class="ops-time-grid">
          <label class="ho-f">CS responsável pela conta
            <input type="text" id="opsCs" value="${esc(impl.cs_email || "")}" placeholder="email ou nome"></label>
          <label class="ho-f">Responsável pelo projeto
            <input type="text" id="opsProjeto" value="${esc(impl.responsavel_email || "")}" placeholder="email ou nome"></label>
          <label class="ho-f">Responsável pela arquitetura
            <input type="text" id="opsArq" value="${esc(impl.arquitetura_email || "")}" placeholder="email ou nome"></label>
          <label class="ho-f">Time de IS (implantação)
            <input type="text" id="opsIs" value="${esc(impl.time_is || "")}" placeholder="ex.: João, Maria, Pedro"></label>
        </div>
        <button class="btn ghost" id="opsSalvarTime" type="button" style="padding:7px 14px">Salvar time</button>
        ` : timeLinha(impl)}
      </div>

      ${podeEditar ? `
      <div class="ho-sec">
        <h3>Registrar atualização</h3>
        <textarea id="opsTexto" class="ops-textarea" placeholder="O que aconteceu? (avanço, problema, decisão, pendência…)"></textarea>
        <div class="ops-reg-opts">
          <label class="ho-chk"><input type="checkbox" id="opsVisCliente" checked>
            <span>Visível para o cliente na página de acompanhamento</span></label>
          <div class="ops-reg-btns">
            <button class="btn ghost" id="opsBtnProblema" type="button">⚠ Registrar problema</button>
            <button class="btn ghost" id="opsBtnResolucao" type="button">✓ Problema resolvido</button>
            <button class="btn" id="opsBtnUpdate" type="button">Registrar atualização</button>
          </div>
        </div>
        <p id="opsMsg" class="ho-msg"></p>
      </div>` : `
      <p style="font-size:12px;color:var(--txt-3);margin:12px 0">Você pode visualizar tudo, mas apenas o time de
      Customer OPS, admin e liderança registram atualizações.</p>`}

      <div class="ho-sec">
        <h3>Linha do tempo</h3>
        <div class="ops-timeline">${renderTimeline(updates)}</div>
      </div>`;

    // ações
    $("#opsCopiarLink").addEventListener("click", () => {
      navigator.clipboard.writeText(linkCliente).then(
        () => { $("#opsCopiarLink").textContent = "✓ Copiado!"; setTimeout(() => $("#opsCopiarLink").textContent = "🔗 Copiar link do cliente", 1500); },
        () => window.prompt("Copie:", linkCliente));
    });
    if (podeEditar) {
      $("#opsNovaEtapa").addEventListener("change", async e => {
        const nova = e.target.value;
        if (!nova) return;
        await registrar(id, "etapa", `Etapa alterada para ${(ETAPAS.find(x => x.id === nova) || {}).nome}.`, true, nova);
      });
      // salvar o time da implantação
      $("#opsSalvarTime").addEventListener("click", async () => {
        const msg = $("#opsMsg");
        try {
          if (msg) { msg.textContent = "Salvando time…"; msg.className = "ho-msg"; }
          await store().opsEditar(id, {
            cs_email: $("#opsCs").value.trim() || null,
            responsavel_email: $("#opsProjeto").value.trim() || null,
            arquitetura_email: $("#opsArq").value.trim() || null,
            time_is: $("#opsIs").value.trim() || null,
          });
          cache = await store().opsListar();
          renderKpis(); renderLista();
          abrirDetalhe(id);
        } catch (e2) {
          if (msg) { msg.textContent = "Erro: " + (e2.message || e2); msg.className = "ho-msg bad"; }
        }
      });
      $("#opsBtnUpdate").addEventListener("click", () => registrarDoForm(id, "atualizacao"));
      $("#opsBtnProblema").addEventListener("click", () => registrarDoForm(id, "problema"));
      $("#opsBtnResolucao").addEventListener("click", () => registrarDoForm(id, "resolucao"));
    }
  }

  function renderTimeline(updates) {
    if (!updates.length) return `<p style="color:var(--txt-3);font-size:13px">Sem atualizações ainda.</p>`;
    const ICONE = { atualizacao: "💬", problema: "⚠️", resolucao: "✅", etapa: "➡️" };
    return updates.map(u => `
      <div class="ops-up ${u.tipo}">
        <div class="ops-up-head">
          <span>${ICONE[u.tipo] || "💬"} <b>${esc((u.autor_email || "sistema").split("@")[0])}</b></span>
          <span>${u.visivel_cliente ? "" : "🔒 interno"} · ${new Date(u.criado_em).toLocaleString("pt-BR")}</span>
        </div>
        ${u.texto ? `<div class="ops-up-txt">${esc(u.texto)}</div>` : ""}
      </div>`).join("");
  }

  async function registrarDoForm(id, tipo) {
    const texto = $("#opsTexto").value.trim();
    const msg = $("#opsMsg");
    if (!texto) { msg.textContent = "Escreva o que aconteceu antes de registrar."; msg.className = "ho-msg bad"; return; }
    await registrar(id, tipo, texto, $("#opsVisCliente").checked, null);
  }

  async function registrar(id, tipo, texto, visivelCliente, etapaNova) {
    const msg = $("#opsMsg");
    try {
      if (msg) { msg.textContent = "Registrando…"; msg.className = "ho-msg"; }
      await store().opsRegistrarUpdate(id, tipo, texto, visivelCliente, etapaNova);
      // recarrega tudo e reabre o detalhe atualizado
      cache = await store().opsListar();
      renderKpis(); renderLista();
      abrirDetalhe(id);
    } catch (e) {
      if (msg) { msg.textContent = "Erro: " + (e.message || e); msg.className = "ho-msg bad"; }
    }
  }

  // fechar overlay
  document.addEventListener("DOMContentLoaded", () => {
    const x = $("#opsFechar"); if (x) x.addEventListener("click", () => $("#opsOverlay").classList.add("hide"));
    const ov = $("#opsOverlay");
    if (ov) ov.addEventListener("click", e => { if (e.target === ov) ov.classList.add("hide"); });
  });

  global.JornadaOps = { montar, abrirDetalhe };
})(window);
