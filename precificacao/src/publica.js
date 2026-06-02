/* ============================================================================
 *  PÁGINA PÚBLICA DA PROPOSTA  ·  ELOFY
 *  ----------------------------------------------------------------------------
 *  Aberta pelo cliente via link com token secreto (?t=UUID). Mostra a proposta
 *  itemizada (somente valores de venda, vindos do snapshot congelado no banco)
 *  e coleta o feedback do cliente. Não exige login.
 *
 *  Acesso aos dados é por RPC SECURITY DEFINER (proposta_publica / proposta_feedback)
 *  com a chave pública (anon) — o token UUID funciona como link assinado.
 * ========================================================================== */
(function () {
  "use strict";

  const $ = s => document.querySelector(s);
  const brl = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const logo = (window.PricingPDF && window.PricingPDF.LOGO_SVG) || "<b style='font-size:24px'>elofy</b>";

  const params = new URLSearchParams(location.search);
  const token = params.get("t");

  let sb = null;
  function client() {
    if (sb) return sb;
    const cfg = window.SUPABASE_CONFIG || {};
    if (!window.supabase || !cfg.url || !cfg.publishableKey) return null;
    sb = window.supabase.createClient(cfg.url, cfg.publishableKey);
    return sb;
  }

  const MOTIVOS = [
    { id: "custo", label: "Custo acima do esperado" },
    { id: "prazo", label: "Prazo não atende" },
    { id: "escopo", label: "Diferente do que pedi" },
  ];

  async function init() {
    if (!token) return erro("Link inválido. Peça ao seu contato um novo link da proposta.");
    const c = client();
    if (!c) return erro("Não foi possível conectar. Tente novamente em instantes.");
    try {
      const { data, error } = await c.rpc("proposta_publica", { p_token: token });
      if (error) throw error;
      if (!data) return erro("Proposta não encontrada. O link pode ter expirado.");
      if (!data.snapshot) return erro("Esta proposta ainda não está disponível para visualização. Avise seu contato.");
      render(data);
    } catch (e) {
      erro("Não foi possível carregar a proposta. " + (e.message || ""));
    }
  }

  function erro(msg) {
    $("#root").innerHTML = `<div class="card"><div class="center">${esc(msg)}</div></div>`;
  }

  function linhas(itens) {
    return (itens || []).filter(i => i.valor > 0.005)
      .map(i => `<tr><td>${esc(i.nome)}</td><td class="r mono">${brl(i.valor)}</td></tr>`).join("");
  }

  function render(d) {
    const s = d.snapshot;
    const dataFmt = d.criado_em ? new Date(d.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";
    const rec = linhas(s.recorrente), nr = linhas(s.naoRecorrente);

    const blocoRec = rec ? `<table class="items">
      <thead><tr><th>Solução recorrente</th><th class="r">Mensal</th></tr></thead>
      <tbody>${rec}<tr class="sub"><td>Mensalidade</td><td class="r mono">${brl(s.mrr)}</td></tr></tbody></table>` : "";
    const blocoNr = nr ? `<table class="items">
      <thead><tr><th>Implantação & serviços (único)</th><th class="r">Valor</th></tr></thead>
      <tbody>${nr}<tr class="sub"><td>Total não recorrente</td><td class="r mono">${brl(s.nr)}</td></tr></tbody></table>` : "";

    $("#root").innerHTML = `
      <div class="card">
        <div class="top">
          <div class="brand">${logo}<div class="tag">HR Tech</div></div>
          <div class="doc"><div class="big">Proposta Comercial</div><div>${esc(dataFmt)}</div>
            ${s.versao ? `<div class="v">Versão ${esc(s.versao)}</div>` : ""}</div>
        </div>
        <div class="hero">
          <h1>Uma solução de <span>gestão de pessoas</span> sob medida para a ${esc(s.cliente || "sua empresa")}.</h1>
          <p>Tecnologia de RH do grupo Zucchetti: cada módulo, cada hora de implantação e cada
          customização pensados para o seu contexto.</p>
        </div>
        <div class="meta">
          <div><div class="k">Empresa</div><div class="val">${esc(s.cliente || "—")}</div></div>
          <div><div class="k">Colaboradores</div><div class="val">${esc(s.usuarios || 0)}</div></div>
          ${s.vendedor ? `<div><div class="k">Seu consultor(a)</div><div class="val">${esc(s.vendedor)}</div></div>` : ""}
          <div><div class="k">Validade</div><div class="val">${esc(s.validadeDias || 15)} dias</div></div>
        </div>
        <h2 class="sec">Escopo da solução</h2>
        ${blocoRec}${blocoNr}
        <h2 class="sec">Resumo do investimento</h2>
        <div class="invest">
          <div class="c"><div class="k">Mensalidade</div><div class="v mono">${brl(s.mrr)}</div><div class="s">recorrente / mês</div></div>
          <div class="c"><div class="k">Implantação & único</div><div class="v mono">${brl(s.nr)}</div><div class="s">pagamento único</div></div>
          <div class="c dest"><div class="k">1º pagamento</div><div class="v mono">${brl((s.mrr || 0) + (s.nr || 0))}</div><div class="s">mensalidade + setup</div></div>
        </div>
        <div class="pitch">Na <b>Elofy</b>, acreditamos que cada empresa tem uma cultura única. Por isso entregamos
        uma plataforma completa de desempenho, engajamento e desenvolvimento — com implantação acompanhada
        de perto e a possibilidade de customizações sob demanda. Não vendemos um software de prateleira:
        construímos uma parceria.</div>
      </div>

      <div class="card fb" id="fbCard">
        <h2>O que você achou da proposta?</h2>
        <p class="sub">Seu retorno chega na hora ao nosso time e ajuda a chegarmos na melhor solução para você.</p>
        <div class="sent">
          <button data-sent="aprovado" class="ok"><span class="emo">👍</span>Atende! Quero seguir</button>
          <button data-sent="ajustes"><span class="emo">✏️</span>Quase lá, ajustar</button>
          <button data-sent="recusado" class="bad"><span class="emo">🤔</span>Não atende</button>
        </div>
        <div class="extra" id="extra">
          <label class="fld">O que podemos melhorar? (opcional)</label>
          <div class="chips" id="chips">
            ${MOTIVOS.map(m => `<button class="chip" data-mot="${m.id}" type="button">${m.label}</button>`).join("")}
          </div>
        </div>
        <label class="fld">Comentário (opcional)</label>
        <textarea id="coment" placeholder="Conte o que achou, dúvidas, o que esperava…"></textarea>
        <label class="fld">Seu nome (opcional)</label>
        <input class="txt" id="nome" type="text" placeholder="Como podemos te chamar?">
        <button class="send" id="enviar" disabled>Enviar meu retorno</button>
        <div class="msg" id="fbMsg"></div>
      </div>
      <p class="foot">elofy · Zucchetti · HR Tech · proposta gerada em ${esc(dataFmt)}</p>`;

    ligarFeedback(d.ja_respondeu);
  }

  function ligarFeedback(jaRespondeu) {
    let sentimento = null;
    const motivos = new Set();
    const btnEnviar = $("#enviar");

    $("#fbCard").querySelectorAll("[data-sent]").forEach(b => {
      b.addEventListener("click", () => {
        sentimento = b.dataset.sent;
        $("#fbCard").querySelectorAll("[data-sent]").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
        $("#extra").classList.toggle("show", sentimento !== "aprovado");
        btnEnviar.disabled = false;
      });
    });
    $("#chips").querySelectorAll("[data-mot]").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.mot;
        if (motivos.has(id)) { motivos.delete(id); b.classList.remove("on"); }
        else { motivos.add(id); b.classList.add("on"); }
      });
    });

    btnEnviar.addEventListener("click", async () => {
      if (!sentimento) return;
      btnEnviar.disabled = true;
      setMsg("Enviando…", "");
      try {
        const { error } = await client().rpc("proposta_feedback", {
          p_token: token, p_sentimento: sentimento,
          p_motivos: Array.from(motivos),
          p_comentario: $("#coment").value || null,
          p_nome: $("#nome").value || null,
        });
        if (error) throw error;
        agradecer(sentimento);
      } catch (e) {
        btnEnviar.disabled = false;
        setMsg("Não foi possível enviar. Tente novamente. " + (e.message || ""), "bad");
      }
    });

    if (jaRespondeu) setMsg("Já recebemos um retorno seu — pode enviar outro se quiser complementar.", "");
  }

  function agradecer(sentimento) {
    const txt = sentimento === "aprovado"
      ? "Que ótimo! Seu time de vendas já foi avisado e entrará em contato para os próximos passos."
      : "Obrigado pelo retorno! Vamos revisar e voltar com uma proposta ainda mais alinhada ao que você precisa.";
    $("#fbCard").innerHTML = `<div class="thanks"><div class="big">💜</div>
      <h2>Retorno enviado!</h2><p style="color:var(--ink2)">${esc(txt)}</p></div>`;
  }

  function setMsg(t, kind) {
    const el = $("#fbMsg"); if (!el) return;
    el.textContent = t;
    el.style.color = kind === "bad" ? "var(--red)" : "var(--ink3)";
  }

  document.addEventListener("DOMContentLoaded", init);
})();
