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

  // "Seu time Elofy" — cards com foto, contato e CTA de cada pessoa do time.
  function timeBox(time) {
    if (!time) return "";
    const cards = [];
    const card = (rotulo, p) => {
      if (!p || !p.nome) return "";
      const iniciais = p.nome.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
      const foto = p.foto
        ? `<img class="tm-foto" src="${esc(p.foto)}" alt="${esc(p.nome)}" onerror="this.outerHTML='<div class=\\'tm-foto tm-iniciais\\'>${esc(iniciais)}</div>'">`
        : `<div class="tm-foto tm-iniciais">${esc(iniciais)}</div>`;
      const tel = (p.telefone || "").replace(/\D/g, "");
      const ctas = [
        tel ? `<a class="tm-cta zap" href="https://wa.me/${esc(tel)}?text=${encodeURIComponent("Olá " + p.nome.split(" ")[0] + "! Sou da " + clienteNome + " e gostaria de falar sobre a nossa implantação Elofy.")}" target="_blank" rel="noopener">💬 WhatsApp</a>` : "",
        p.email ? `<a class="tm-cta" href="mailto:${esc(p.email)}?subject=${encodeURIComponent("Implantação Elofy — " + clienteNome)}">✉ E-mail</a>` : "",
      ].filter(Boolean).join("");
      return `<div class="tm-card">
        ${foto}
        <div class="tm-info">
          <div class="tm-rotulo">${rotulo}</div>
          <div class="tm-nome">${esc(p.nome)}</div>
          ${p.cargo ? `<div class="tm-cargo">${esc(p.cargo)}</div>` : ""}
          <div class="tm-ctas">${ctas}</div>
        </div>
      </div>`;
    };
    cards.push(card("CS da sua conta", time.cs));
    cards.push(card("Responsável pelo projeto", time.projeto));
    cards.push(card("Arquitetura", time.arquitetura));
    (time.is || []).forEach(p => cards.push(card("Time de implantação", p)));
    const html = cards.filter(Boolean).join("");
    if (!html) return "";
    return `<h2 class="sec">Seu time Elofy 💙</h2>
      <p class="sub" style="margin-top:-4px">Estas são as pessoas cuidando do seu projeto — fale com elas a qualquer momento.</p>
      <div class="tm-grid">${html}</div>`;
  }

  // Customizações contratadas: status e previsão de entrega.
  const STATUS_CUSTOM = {
    nao_iniciada:       { txt: "Não iniciada",       cls: "wait" },
    em_desenvolvimento: { txt: "Em desenvolvimento", cls: "info" },
    em_homologacao:     { txt: "Em homologação",     cls: "warn" },
    entregue:           { txt: "✓ Entregue",          cls: "ok" },
  };
  function customsBox(customs) {
    if (!customs || !customs.length) return "";
    return `<h2 class="sec">Suas customizações</h2>
      <p class="sub" style="margin-top:-4px">Desenvolvimentos exclusivos para a sua operação.</p>
      ${customs.map(c => {
        const st = STATUS_CUSTOM[c.status] || STATUS_CUSTOM.nao_iniciada;
        return `<div class="cu-item">
          <div class="cu-nome">${esc(c.nome || c.jira_key || "Customização")}</div>
          <div class="cu-meta">
            <span class="cu-status ${st.cls}">${st.txt}</span>
            ${c.previsao ? `<span class="cu-prev">📅 previsão: ${dataBR(c.previsao)}</span>` : `<span class="cu-prev sem">previsão a definir</span>`}
          </div>
          ${c.obs ? `<div class="cu-obs">${esc(c.obs)}</div>` : ""}
        </div>`;
      }).join("")}`;
  }

  // Escalonamento: o cliente pede ajuda quando algo não está sendo resolvido.
  function escalonamentoBox(jaEscalonado) {
    if (jaEscalonado) {
      return `<div class="esc-box escalado">
        <b>🆘 Escalonamento em andamento</b>
        <p>Recebemos o seu pedido e a liderança da Elofy já foi acionada. Você receberá um contato em breve.</p>
      </div>`;
    }
    return `<div class="esc-box">
      <b>Algo não está indo bem?</b>
      <p>Se você sente que algo não está sendo resolvido pelo time, acione a liderança da Elofy diretamente.</p>
      <button class="esc-btn" id="btnEscalar" type="button">🆘 Pedir escalonamento</button>
      <div class="esc-form hide" id="escForm">
        <textarea id="escMotivo" placeholder="Conte o que está acontecendo e há quanto tempo…"></textarea>
        <input type="text" id="escContato" placeholder="Seu nome e melhor contato (telefone/e-mail)">
        <button class="esc-btn enviar" id="btnEscalarEnviar" type="button">Enviar para a liderança Elofy</button>
        <p class="esc-msg" id="escMsg"></p>
      </div>
    </div>`;
  }

  let clienteNome = "";

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
    clienteNome = d.cliente || "";
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
        ${customsBox(d.customs)}

        <h2 class="sec">Últimas atualizações</h2>
        ${updates.length ? updates.map(u => `
          <div class="up ${u.tipo === "etapa" ? "etapa" : ""}">
            <div class="quando">${new Date(u.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
            <div class="txt">${esc(u.texto || "")}</div>
          </div>`).join("")
          : `<p style="color:var(--ink3);font-size:13px">Em breve você verá as primeiras atualizações por aqui.</p>`}

        ${escalonamentoBox(d.escalonado)}
        <div class="pitch">💜 Qualquer dúvida, fale com o seu analista de projetos da Elofy — estamos juntos em cada etapa.</div>
      </div>
      <p class="foot">elofy · Butique de RH · Jornada Elofy</p>`;

    ligarEscalonamento();
  }

  // Liga o fluxo de escalonamento (botão → formulário → envio).
  function ligarEscalonamento() {
    const btn = $("#btnEscalar");
    if (!btn) return;
    btn.addEventListener("click", () => {
      $("#escForm").classList.remove("hide");
      btn.classList.add("hide");
      $("#escMotivo").focus();
    });
    $("#btnEscalarEnviar").addEventListener("click", async () => {
      const motivo = $("#escMotivo").value.trim();
      const contato = $("#escContato").value.trim();
      const msg = $("#escMsg");
      if (!motivo) { msg.textContent = "Conte o que está acontecendo para podermos ajudar."; return; }
      try {
        msg.textContent = "Enviando…";
        const { error } = await client().rpc("implantacao_escalar", {
          p_token: token, p_motivo: motivo, p_contato: contato || null,
        });
        if (error) throw error;
        $("#escForm").innerHTML = `<div class="esc-ok">✓ <b>Recebido!</b> A liderança da Elofy foi acionada
          agora mesmo e vai entrar em contato com você. Obrigado por nos avisar.</div>`;
      } catch (e) {
        msg.textContent = "Não foi possível enviar. Tente novamente. " + (e.message || "");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
