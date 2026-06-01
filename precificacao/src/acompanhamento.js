/* ============================================================================
 *  PÁGINA PÚBLICA DE ACOMPANHAMENTO DA IMPLANTAÇÃO  ·  JORNADA ELOFY
 *  ----------------------------------------------------------------------------
 *  O cliente abre acompanhamento.html?t=<token> (sem login) e vê:
 *  em que etapa a implantação está, previsão de go-live e a linha do tempo
 *  de atualizações que o time de Customer OPS marcou como visíveis.
 * ========================================================================== */
(function () {
  "use strict";

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dataBR = d => d ? new Date(String(d).length === 10 ? d + "T00:00:00" : d).toLocaleDateString("pt-BR") : "—";
  const logo = (window.PricingPDF && window.PricingPDF.LOGO_SVG) || "<b style='font-size:24px'>elofy</b>";

  const ETAPAS = [
    { id: "kickoff",        nome: "Kickoff" },
    { id: "configuracao",   nome: "Configuração" },
    { id: "treinamento",    nome: "Treinamento" },
    { id: "golive",         nome: "Go-live" },
    { id: "acompanhamento", nome: "Acompanhamento" },
    { id: "concluido",      nome: "Concluído" },
  ];

  const token = new URLSearchParams(location.search).get("t");
  let sb = null;
  function client() {
    if (sb) return sb;
    const cfg = window.SUPABASE_CONFIG || {};
    if (!window.supabase || !cfg.url || !cfg.publishableKey) return null;
    sb = window.supabase.createClient(cfg.url, cfg.publishableKey);
    return sb;
  }

  async function init() {
    if (!token) return erro("Link inválido. Peça ao seu contato na Elofy um novo link.");
    const c = client();
    if (!c) return erro("Não foi possível conectar. Tente novamente em instantes.");
    try {
      const { data, error } = await c.rpc("implantacao_publica", { p_token: token });
      if (error) throw error;
      if (!data) return erro("Implantação não encontrada. O link pode ter expirado.");
      render(data);
    } catch (e) {
      erro("Não foi possível carregar. " + (e.message || ""));
    }
  }

  function erro(msg) {
    $("#root").innerHTML = `<div class="card"><div class="center">${esc(msg)}</div></div>`;
  }

  // "Seu time Elofy" — quem cuida da implantação do cliente.
  function timeBox(time) {
    if (!time) return "";
    const item = (rotulo, v) => v
      ? `<div class="tb-item"><div class="k">${rotulo}</div><div class="v">${esc(String(v).split("@")[0])}</div></div>` : "";
    const itens = [
      item("CS da sua conta", time.cs), item("Resp. pelo projeto", time.projeto),
      item("Arquitetura", time.arquitetura), item("Time de implantação", time.is),
    ].filter(Boolean).join("");
    if (!itens) return "";
    return `<div class="time-box"><div class="tb-titulo">Seu time Elofy 💙</div>${itens}</div>`;
  }

  function stepper(etapa, tempos) {
    const idx = ETAPAS.findIndex(e => e.id === etapa);
    const t = tempos || {};
    const fmtDias = d => { const n = Number(d) || 0; return n < 1 ? "<1 dia" : Math.round(n) + " dias"; };
    return `<div class="stepper">${ETAPAS.map((e, i) => `
      <div class="step ${i < idx ? "done" : ""} ${i === idx ? "now" : ""}">
        <span class="dot">${i < idx ? "✓" : i + 1}</span><span class="lbl">${e.nome}</span>
        ${t[e.id] != null ? `<span class="dias">${fmtDias(t[e.id])}</span>` : ""}
      </div>${i < ETAPAS.length - 1 ? `<div class="lin${i < idx ? " done" : ""}"></div>` : ""}`).join("")}
    </div>`;
  }

  function render(d) {
    const etapaNome = (ETAPAS.find(e => e.id === d.etapa) || {}).nome || d.etapa;
    const updates = (d.updates || []);
    $("#root").innerHTML = `
      <div class="card">
        <div class="top">
          <div class="brand">${logo}<div class="tag">Butique de RH</div></div>
          <div class="doc"><div class="big">Acompanhamento da implantação</div></div>
        </div>
        <h1>Olá, ${esc(d.cliente)}! Sua implantação está em <span>${esc(etapaNome)}</span>.</h1>
        <p class="sub">Acompanhe por aqui cada passo do seu projeto com a Elofy — sempre atualizado pelo nosso time.</p>
        ${stepper(d.etapa, d.tempos_etapas)}
        <div class="meta">
          <div><div class="k">Início do projeto</div><div class="val">${dataBR(d.inicio)}</div></div>
          <div><div class="k">${d.golive_em ? "Go-live realizado" : "Go-live previsto"}</div>
            <div class="val">${dataBR(d.golive_em || d.previsao_golive)}</div></div>
          <div><div class="k">Etapa atual</div><div class="val">${esc(etapaNome)}</div></div>
        </div>
        ${timeBox(d.time)}

        <h2 class="sec">Últimas atualizações</h2>
        ${updates.length ? updates.map(u => `
          <div class="up ${u.tipo === "etapa" ? "etapa" : ""}">
            <div class="quando">${new Date(u.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
            <div class="txt">${esc(u.texto || "")}</div>
          </div>`).join("")
          : `<p style="color:var(--ink3);font-size:13px">Em breve você verá as primeiras atualizações por aqui.</p>`}

        <div class="pitch">💜 Qualquer dúvida, fale com o seu analista de projetos da Elofy — estamos juntos em cada etapa.</div>
      </div>
      <p class="foot">elofy · Butique de RH · Jornada Elofy</p>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
