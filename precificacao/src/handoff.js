/* ============================================================================
 *  GANHO & HANDOFF  ·  ELOFY
 *  ----------------------------------------------------------------------------
 *  Fecha o ciclo: o closer dá GANHO numa versão da proposta e preenche o
 *  handoff (confirmação do vendido, contrato, contatos, faturamento, critérios)
 *  para o time de Onboarding. Regra: só permite seguir se o negócio JÁ estiver
 *  como GANHO no Bitrix (o sistema não move nada lá).
 *
 *  Expõe window.PricingHandoff: { abrir(row), abrirPainel() }.
 *  Depende de window.PricingStore (auth.js).
 * ========================================================================== */
(function (global) {
  "use strict";

  const $ = s => document.querySelector(s);
  const brl = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = () => global.PricingStore;
  let onConcluir = null; // callback após handoff (recarregar histórico)

  function setOnConcluir(fn) { onConcluir = fn; }

  /* ---------- Modal de GANHO & HANDOFF ---------- */
  async function abrir(row) {
    const ov = $("#handoffOverlay");
    ov.classList.remove("hide");
    $("#hoBody").innerHTML = `<div class="ho-head"><h2>Verificando no Bitrix…</h2></div>
      <p style="color:var(--txt-3)">Confirmando se o negócio está como ganho.</p>`;
    let gate;
    try { gate = await store().podeDarGanho(row.id); }
    catch (e) { $("#hoBody").innerHTML = erroBox(e.message || e); return; }

    if (!gate.ok) {
      $("#hoBody").innerHTML = `
        <div class="ho-head"><h2>⛔ Ainda não dá pra dar ganho</h2></div>
        <div class="ho-gate">
          <p>${esc(gate.mensagem || "O negócio precisa estar como GANHO no Bitrix.")}</p>
          <p class="ho-gate-sub">Mova o negócio para <b>Ganho</b> no Bitrix e tente novamente.
          A sincronização pode levar alguns minutos.</p>
        </div>
        <div class="ho-actions">
          <button class="btn ghost" id="hoCancelar" type="button">Fechar</button>
          <button class="btn" id="hoRecheck" type="button">Verificar de novo</button>
        </div>`;
      $("#hoCancelar").addEventListener("click", fechar);
      $("#hoRecheck").addEventListener("click", () => abrir(row));
      return;
    }
    renderForm(row, gate);
  }

  function renderForm(row, gate) {
    // O cliente já aprovou pela página da proposta? Se não, o fechamento é
    // "forçado" e exige ciência explícita do closer (mas é permitido — o ok
    // pode ter vindo por e-mail/telefone, ou nem ter vindo ainda).
    const clienteAprovou = row.fb_sentimento === "aprovado";
    const avisoSemOk = clienteAprovou ? "" : `
      <div class="ho-gate" style="margin-bottom:14px">
        <p><b>⚠️ O cliente ainda não deu o OK final por aqui.</b></p>
        <p class="ho-gate-sub">Você pode fechar mesmo assim (ex.: o aceite veio por e-mail ou telefone).
        A página da proposta continua aberta e o cliente ainda poderá responder depois.</p>
        <label class="ho-chk" style="margin-top:10px"><input type="checkbox" id="hoCiente">
          <span><b>Estou ciente</b> de que estou marcando como ganho sem o OK formal do cliente nesta plataforma.</span></label>
      </div>`;

    $("#hoBody").innerHTML = `
      <div class="ho-head"><h2>🏆 Dar ganho & Handoff</h2>
        <span class="ho-fase">Bitrix: ${esc(gate.fase || "Ganho")}</span></div>
      ${avisoSemOk}
      <div class="ho-sec">
        <h3>1. Confirmação do que foi vendido</h3>
        <div class="ho-vendido">
          <div><span class="k">Cliente</span><span class="v">${esc(row.cliente || "—")}</span></div>
          <div><span class="k">Versão</span><span class="v">v${esc(row.versao)}</span></div>
          <div><span class="k">Colaboradores</span><span class="v">${esc(row.usuarios || 0)}</span></div>
          <div><span class="k">Mensalidade</span><span class="v">${brl(row.mrr_com_imposto)}</span></div>
          <div><span class="k">Implantação/único</span><span class="v">${brl(row.nr_com_imposto)}</span></div>
          <div><span class="k">Global</span><span class="v">${brl(row.global_com_imposto)}</span></div>
        </div>
        ${prefillResumo(row)}
        <label class="ho-chk"><input type="checkbox" id="hoConfirmo">
          <span>Confirmo que estes são os itens e valores efetivamente vendidos.</span></label>
      </div>

      <div class="ho-sec">
        <h3>2. Contrato</h3>
        <label class="ho-f">Arquivo do contrato (PDF)
          <input type="file" id="hoArquivo" accept=".pdf,.doc,.docx,image/*"></label>
        <label class="ho-f">…ou link do contrato (Drive, DocuSign, Clicksign)
          <input type="url" id="hoContratoUrl" placeholder="https://…"></label>
      </div>

      <div class="ho-sec">
        <h3>3. Contatos do cliente</h3>
        <div id="hoContatos"></div>
        <button class="btn ghost" id="hoAddContato" type="button" style="padding:6px 12px">+ Adicionar contato</button>
      </div>

      <div class="ho-sec">
        <h3>4. Faturamento & datas</h3>
        <div class="ho-grid">
          <label class="ho-f">CNPJ<input type="text" id="hoCnpj" placeholder="00.000.000/0000-00"></label>
          <label class="ho-f">Condição de pagamento<input type="text" id="hoCond" placeholder="ex.: 30 dias, anual…"></label>
          <label class="ho-f">Forma de pagamento<input type="text" id="hoForma" placeholder="boleto, cartão, pix…"></label>
          <label class="ho-f">Kickoff previsto<input type="date" id="hoKickoff"></label>
          <label class="ho-f">Urgência
            <select id="hoUrgencia"><option value="normal">Normal</option>
              <option value="alta">Alta</option><option value="baixa">Baixa</option></select></label>
        </div>
        <label class="ho-chk" style="margin-top:8px"><input type="checkbox" id="hoComunicado">
          <span>O cliente <b>já foi comunicado</b> de que passará a falar com o time de implantação (Customer OPS).</span></label>
      </div>

      <div class="ho-sec">
        <h3>5. Playbook de Handoff <span class="ho-tag-novo">por Laura · Arquitetura</span></h3>
        <p style="font-size:12px;color:var(--txt-3);margin-bottom:12px">Quanto mais contexto humano você passar,
        melhor o Customer OPS atende este cliente. Abra as seções e preencha o que souber.</p>

        <details class="pb-sec">
          <summary>📊 Contexto da empresa</summary>
          <div class="pb-body">
            <div class="ho-grid">
              <label class="ho-f">Setor / segmento<input type="text" id="pbSetor" placeholder="ex.: Advocacia, Indústria, Tech…"></label>
              <label class="ho-f">Maturidade em gestão de pessoas
                <select id="pbMaturidade"><option value="">—</option>
                  <option value="inexistente">Inexistente (nada estruturado)</option>
                  <option value="inicial">Inicial (planilhas, processos soltos)</option>
                  <option value="estruturada">Estruturada (processos definidos)</option>
                  <option value="avancada">Avançada (já usou ferramentas, cultura forte)</option></select></label>
            </div>
            <label class="ho-f">Histórico com ferramentas de RH
              <textarea id="pbHistoricoRh" placeholder="já usaram algo? por que trocaram/abandonaram?"></textarea></label>
            <label class="ho-f">Cultura da empresa (como decidem, hierarquia, ritmo)
              <textarea id="pbCultura" placeholder="ex.: decisões centralizadas no sócio, ritmo lento, RH com pouca autonomia…"></textarea></label>
          </div>
        </details>

        <details class="pb-sec">
          <summary>🎭 Estado emocional do cliente</summary>
          <div class="pb-body">
            <label class="ho-f">Como o cliente chegou na venda?
              <textarea id="pbComoChegou" placeholder="indicação? sofrendo com algo? trocando de concorrente? pressão da diretoria?"></textarea></label>
            <div class="ho-grid">
              <label class="ho-f">Resistência interna à adoção
                <select id="pbResistencia"><option value="">—</option>
                  <option value="nenhuma">Nenhuma percebida</option>
                  <option value="baixa">Baixa</option><option value="media">Média</option>
                  <option value="alta">Alta (tem gente contra)</option></select></label>
              <label class="ho-f">Urgência percebida pelo cliente
                <select id="pbUrgenciaCliente"><option value="">—</option>
                  <option value="baixa">Baixa (sem pressa)</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta (precisa rodar logo)</option></select></label>
            </div>
          </div>
        </details>

        <details class="pb-sec">
          <summary>🤝 O que foi prometido na venda</summary>
          <div class="pb-body">
            <label class="ho-f">Promessas feitas pelo comercial
              <textarea id="pbPromessas" placeholder="prazos, integrações, funcionalidades, condições…"></textarea></label>
            <label class="ho-f">Funcionalidades destacadas na demo
              <textarea id="pbDemo" placeholder="o que mais brilhou os olhos do cliente?"></textarea></label>
            <label class="ho-f" style="background:var(--gold-bg);border-radius:9px;padding:10px">⚠️ Expectativas que podem NÃO ser cumpridas
              <textarea id="pbEmRisco" placeholder="seja honesto — é melhor o OPS saber agora do que o cliente descobrir depois"></textarea></label>
            <label class="ho-f">Pendências ainda não resolvidas
              <textarea id="pbPendencias" placeholder="ex.: definição de SSO, lista de usuários, aprovação de orçamento extra…"></textarea></label>
          </div>
        </details>

        <details class="pb-sec">
          <summary>💎 Momento de valor (o que faz o cliente dizer "valeu a pena")</summary>
          <div class="pb-body">
            <label class="ho-f">Qual é o primeiro resultado que o cliente espera ver?
              <textarea id="pbPrimeiroResultado" placeholder="ex.: primeira avaliação rodando, primeiro relatório na mão da diretoria…"></textarea></label>
            <div class="ho-grid">
              <label class="ho-f">Em quanto tempo ele espera ver valor?
                <input type="text" id="pbTempoValor" placeholder="ex.: 30 dias, 60 dias, este semestre"></label>
            </div>
            <label class="ho-f">O que vai fazer o cliente dizer "valeu a pena"?
              <textarea id="pbValeuAPena" placeholder="na visão DELE, não na nossa"></textarea></label>
          </div>
        </details>

        <details class="pb-sec">
          <summary>⚠️ Riscos mapeados na venda</summary>
          <div class="pb-body" id="pbRiscos">
            ${RISCOS_COMUNS.map((r, i) => `
              <div class="pb-risco">
                <label class="ho-chk"><input type="checkbox" data-risco="${i}"><span>${r}</span></label>
                <select class="ops-sel pb-risco-nivel hide" data-nivel="${i}">
                  <option value="medio">Médio</option><option value="alto">Alto</option><option value="baixo">Baixo</option>
                </select>
              </div>`).join("")}
            <label class="ho-f" style="margin-top:8px">Outros riscos / detalhes
              <textarea id="pbRiscosObs" placeholder="contexto dos riscos marcados ou outros não listados"></textarea></label>
          </div>
        </details>
      </div>

      <div class="ho-sec">
        <h3>6. Critérios de ganho & sucesso</h3>
        <label class="ho-f">Por que ganhamos? (o que pesou na decisão)
          <textarea id="hoGanho" placeholder="ex.: melhor custo-benefício, suporte, módulo X…"></textarea></label>
        <label class="ho-f">O que é sucesso para o cliente? (como ele vai medir)
          <textarea id="hoSucesso" placeholder="ex.: reduzir turnover, implantar avaliação em 90 dias…"></textarea></label>
      </div>

      <div class="ho-sec">
        <h3>7. História & observações para o Onboarding</h3>
        <label class="ho-f"><textarea id="hoHistoria" placeholder="Contexto, expectativas, sensibilidades, prazos críticos, quem decide…"></textarea></label>
      </div>

      <div class="ho-actions">
        <button class="btn ghost" id="hoCancelar" type="button">Cancelar</button>
        <button class="btn" id="hoEnviar" type="button">🏆 Confirmar ganho e enviar handoff</button>
      </div>
      <p id="hoMsg" class="ho-msg"></p>`;

    addContato();
    $("#hoAddContato").addEventListener("click", addContato);
    $("#hoCancelar").addEventListener("click", fechar);
    $("#hoEnviar").addEventListener("click", () => enviar(row));
    // riscos: ao marcar um risco, mostra o seletor de nível (alto/médio/baixo)
    document.querySelectorAll("#pbRiscos [data-risco]").forEach(cb =>
      cb.addEventListener("change", () => {
        const nivel = document.querySelector(`#pbRiscos [data-nivel="${cb.dataset.risco}"]`);
        if (nivel) nivel.classList.toggle("hide", !cb.checked);
      }));
  }

  // Riscos comuns mapeados pelo playbook (Laura/Arquitetura)
  const RISCOS_COMUNS = [
    "Resistência interna à adoção",
    "Falta de patrocínio da liderança",
    "Expectativa desalinhada com o produto",
    "Histórico negativo com ferramentas anteriores",
    "Prazo comprimido / go-live acelerado",
    "Detrator com poder de decisão",
  ];

  // PRÉ-PREENCHIMENTO AUTOMÁTICO: o que o sistema já sabe da proposta
  // (módulos, desconto, customs e o feedback real do cliente) entra sozinho
  // no playbook — o closer só preenche o que é humano.
  function prefillResumo(row) {
    const e = row.entrada || {};
    const sel = e.sel || {};
    const modulos = [];
    if (sel.completos) modulos.push("Pacote Completo (inclui RV + IA)");
    else {
      if (sel.desempenho) modulos.push("Desempenho");
      if (sel.engajamento) modulos.push("Engajamento");
      if (sel.metas) modulos.push("Metas");
      if (sel.rv) modulos.push("RV");
      if (sel.ia) modulos.push("IA");
    }
    if (sel.peopleAnalytics) modulos.push("People Analytics " + sel.peopleAnalytics);
    const customs = (row.customs || []).map(c => c.summary || c.jira_key);
    const desconto = Number(row.desconto_pct) || 0;
    const fb = row.fb_sentimento
      ? { aprovado: "✅ aprovou a proposta", ajustes: "✏️ pediu ajustes", recusado: "❌ disse que não atende" }[row.fb_sentimento]
      : null;
    return `<div class="ho-prefill">
      <div class="ho-prefill-titulo">⚡ Preenchido automaticamente pelo sistema</div>
      <div><b>Módulos vendidos:</b> ${esc(modulos.join(", ") || "—")}</div>
      ${desconto > 0 ? `<div><b>Desconto concedido:</b> ${(desconto * 100).toFixed(1).replace(".", ",")}%</div>` : ""}
      ${customs.length ? `<div><b>Customizações prometidas:</b> ${esc(customs.join("; "))}</div>` : ""}
      ${fb ? `<div><b>Feedback do cliente na proposta:</b> ${fb}${row.fb_comentario ? ` — “${esc(row.fb_comentario)}”` : ""}</div>` : "<div><b>Feedback do cliente na proposta:</b> não respondeu pela plataforma</div>"}
    </div>`;
  }

  // Monta o objeto prefill que vai gravado dentro do playbook.
  function montarPrefill(row) {
    const e = row.entrada || {};
    return {
      modulos: e.sel || {},
      desconto_pct: Number(row.desconto_pct) || 0,
      customs: (row.customs || []).map(c => c.summary || c.jira_key),
      feedback_cliente: row.fb_sentimento
        ? { sentimento: row.fb_sentimento, comentario: row.fb_comentario || null, em: row.fb_em || null }
        : null,
      valores: { mrr: row.mrr_com_imposto, nr: row.nr_com_imposto, global: row.global_com_imposto },
    };
  }

  // Contatos agora têm PAPEL (stakeholder mapping do playbook)
  const PAPEIS_CONTATO = [
    ["operacional", "Contato operacional"], ["decisor", "Decisor / Patrocinador"],
    ["champion", "Defensor interno (champion)"], ["detrator", "Detrator / Resistência"],
    ["outro", "Outro"],
  ];

  function addContato() {
    const box = $("#hoContatos");
    const div = document.createElement("div");
    div.className = "ho-contato";
    div.innerHTML = `
      <select class="c-papel">${PAPEIS_CONTATO.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</select>
      <input type="text" class="c-nome" placeholder="Nome">
      <input type="text" class="c-cargo" placeholder="Cargo">
      <input type="email" class="c-email" placeholder="E-mail">
      <input type="text" class="c-tel" placeholder="Telefone">
      <button class="c-x" type="button" title="Remover">✕</button>`;
    div.querySelector(".c-x").addEventListener("click", () => div.remove());
    box.appendChild(div);
  }

  function lerContatos() {
    return Array.from(document.querySelectorAll("#hoContatos .ho-contato")).map(d => ({
      papel: d.querySelector(".c-papel").value,
      nome: d.querySelector(".c-nome").value.trim(),
      cargo: d.querySelector(".c-cargo").value.trim(),
      email: d.querySelector(".c-email").value.trim(),
      telefone: d.querySelector(".c-tel").value.trim(),
    })).filter(c => c.nome || c.email || c.telefone);
  }

  // Coleta todas as respostas do playbook do formulário.
  function lerPlaybook(row) {
    const v = id => { const el = $("#" + id); return el ? el.value.trim() : ""; };
    const riscos = [];
    document.querySelectorAll("#pbRiscos [data-risco]").forEach(cb => {
      if (cb.checked) {
        const i = cb.dataset.risco;
        const nivelSel = document.querySelector(`#pbRiscos [data-nivel="${i}"]`);
        riscos.push({ risco: RISCOS_COMUNS[Number(i)], nivel: nivelSel ? nivelSel.value : "medio" });
      }
    });
    return {
      contexto: { setor: v("pbSetor"), maturidade: v("pbMaturidade"),
        historico_rh: v("pbHistoricoRh"), cultura: v("pbCultura") },
      emocional: { como_chegou: v("pbComoChegou"), resistencia: v("pbResistencia"),
        urgencia: v("pbUrgenciaCliente") },
      promessas: { feitas: v("pbPromessas"), demo: v("pbDemo"),
        em_risco: v("pbEmRisco"), pendencias: v("pbPendencias") },
      momento_valor: { primeiro_resultado: v("pbPrimeiroResultado"),
        tempo_esperado: v("pbTempoValor"), valeu_a_pena: v("pbValeuAPena") },
      riscos, riscos_obs: v("pbRiscosObs"),
      cliente_comunicado: !!($("#hoComunicado") && $("#hoComunicado").checked),
      prefill: montarPrefill(row),
    };
  }

  async function enviar(row) {
    const msg = $("#hoMsg");
    if (!$("#hoConfirmo").checked) { setMsg(msg, "Confirme os itens vendidos para continuar.", "bad"); return; }
    // Fechamento sem o OK formal do cliente exige ciência explícita.
    const ciente = $("#hoCiente");
    if (ciente && !ciente.checked) {
      setMsg(msg, "Marque a caixa de ciência: o cliente ainda não deu o OK formal por aqui.", "bad");
      return;
    }
    const btn = $("#hoEnviar"); btn.disabled = true;
    try {
      setMsg(msg, "Enviando handoff…", "");
      // 1) upload do contrato (se houver arquivo)
      let contratoArquivo = null;
      const file = $("#hoArquivo").files[0];
      if (file) {
        setMsg(msg, "Enviando contrato…", "");
        contratoArquivo = await store().uploadContrato(row.bitrix_id || row.bitrixId, file);
      }
      const payload = {
        contrato_url: $("#hoContratoUrl").value.trim() || null,
        contrato_arquivo: contratoArquivo,
        contatos: lerContatos(),
        faturamento: {
          cnpj: $("#hoCnpj").value.trim(),
          condicao: $("#hoCond").value.trim(),
          forma: $("#hoForma").value.trim(),
        },
        kickoff_previsto: $("#hoKickoff").value || null,
        urgencia: $("#hoUrgencia").value,
        criterios_ganho: $("#hoGanho").value.trim(),
        criterios_sucesso: $("#hoSucesso").value.trim(),
        historia: $("#hoHistoria").value.trim(),
        vendido_confirmado: {
          cliente: row.cliente, versao: row.versao, usuarios: row.usuarios,
          mrr: row.mrr_com_imposto, nr: row.nr_com_imposto, global: row.global_com_imposto,
          // registro de como foi o aceite: pelo sistema ou fechamento direto pelo closer
          ok_cliente_na_plataforma: row.fb_sentimento === "aprovado",
        },
        // Playbook de Handoff (Laura/Arquitetura): contexto humano + prefill do sistema
        playbook: lerPlaybook(row),
      };
      setMsg(msg, "Registrando ganho…", "");
      await store().registrarHandoff(row.id, payload);
      await notificar(row, payload);
      sucesso(row);
    } catch (e) {
      btn.disabled = false;
      setMsg(msg, "Erro: " + (e.message || e), "bad");
    }
  }

  // Notificação para o Onboarding (via webhook do n8n, se configurado).
  async function notificar(row, payload) {
    const url = global.HANDOFF_WEBHOOK_URL;
    if (!url) return; // sem webhook configurado → só o painel
    try {
      await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "handoff", cliente: row.cliente, bitrix_id: row.bitrix_id || row.bitrixId,
          versao: row.versao, valores: payload.vendido_confirmado,
          contatos: payload.contatos, kickoff: payload.kickoff_previsto,
          urgencia: payload.urgencia, por: (store().perfil && store().perfil() || {}).email,
        }),
      });
    } catch (_) { /* notificação é best-effort; o painel é a fonte da verdade */ }
  }

  function sucesso(row) {
    $("#hoBody").innerHTML = `
      <div class="ho-ok">
        <div class="big">🏆</div>
        <h2>Ganho confirmado!</h2>
        <p>O handoff de <b>${esc(row.cliente || "")}</b> (v${esc(row.versao)}) foi registrado e está
        disponível para o time de Onboarding.</p>
        <button class="btn" id="hoOkClose" type="button">Concluir</button>
      </div>`;
    $("#hoOkClose").addEventListener("click", () => { fechar(); if (onConcluir) onConcluir(); });
  }

  function fechar() { $("#handoffOverlay").classList.add("hide"); }
  function erroBox(m) { return `<div class="ho-head"><h2>Erro</h2></div><p class="ho-msg bad">${esc(m)}</p>
    <div class="ho-actions"><button class="btn ghost" onclick="document.getElementById('handoffOverlay').classList.add('hide')">Fechar</button></div>`; }
  function setMsg(el, t, kind) { el.textContent = t; el.className = "ho-msg" + (kind === "bad" ? " bad" : kind === "ok" ? " ok" : ""); }

  /* ---------- Painel de Handoffs (Onboarding) ---------- */
  async function abrirPainel() {
    const ov = $("#painelOverlay");
    ov.classList.remove("hide");
    const body = $("#painelBody");
    body.innerHTML = `<p style="color:var(--txt-3)">Carregando…</p>`;
    try {
      const rows = await store().listarHandoffs(200);
      if (!rows.length) { body.innerHTML = `<p style="color:var(--txt-3)">Nenhum handoff registrado ainda.</p>`; return; }
      body.innerHTML = rows.map(cardHandoff).join("");
      body.querySelectorAll("[data-contrato]").forEach(el =>
        el.addEventListener("click", async () => {
          try { const u = await store().urlContrato(el.dataset.contrato, 3600); if (u) global.open(u, "_blank"); }
          catch (e) { alert("Não foi possível abrir o contrato: " + (e.message || e)); }
        }));
    } catch (e) {
      body.innerHTML = `<p class="ho-msg bad">Erro ao carregar: ${esc(e.message || e)}</p>`;
    }
  }

  function cardHandoff(h) {
    const fat = h.faturamento || {};
    const contatos = (h.contatos || []).map(c =>
      `<div class="hc-contato">${esc(c.nome || "—")}${c.cargo ? " · " + esc(c.cargo) : ""}
        ${c.email ? `<span>${esc(c.email)}</span>` : ""}${c.telefone ? `<span>${esc(c.telefone)}</span>` : ""}</div>`).join("");
    const contrato = h.contrato_arquivo
      ? `<button class="hc-link" data-contrato="${esc(h.contrato_arquivo)}" type="button">📎 Baixar contrato</button>`
      : (h.contrato_url ? `<a class="hc-link" href="${esc(h.contrato_url)}" target="_blank" rel="noopener">🔗 Contrato</a>` : `<span class="hc-na">sem contrato</span>`);
    const verProposta = h.public_token
      ? `<a class="hc-link" href="proposta.html?t=${esc(h.public_token)}" target="_blank" rel="noopener">📄 Ver proposta</a>` : "";
    const urg = h.urgencia && h.urgencia !== "normal" ? `<span class="hc-urg ${esc(h.urgencia)}">${esc(h.urgencia)}</span>` : "";
    const kick = h.kickoff_previsto ? `Kickoff ${new Date(h.kickoff_previsto + "T00:00:00").toLocaleDateString("pt-BR")}` : "";
    return `<div class="hc">
      <div class="hc-top">
        <div><b>${esc(h.cliente || "—")}</b> <span class="hc-v">v${esc(h.versao)}</span> ${urg}</div>
        <div class="hc-val">${brl(h.global_com_imposto)} <span>global</span></div>
      </div>
      <div class="hc-meta">
        <span>${brl(h.mrr_com_imposto)}/mês</span><span>${brl(h.nr_com_imposto)} único</span>
        ${kick ? `<span>${esc(kick)}</span>` : ""}
        <span>por ${esc(h.criado_por_email || "—")}</span>
        <span>${new Date(h.criado_em).toLocaleDateString("pt-BR")}</span>
      </div>
      ${contatos ? `<div class="hc-bloco"><div class="hc-h">Contatos</div>${contatos}</div>` : ""}
      ${(fat.cnpj || fat.condicao || fat.forma) ? `<div class="hc-bloco"><div class="hc-h">Faturamento</div>
        <div class="hc-txt">${[fat.cnpj, fat.condicao, fat.forma].filter(Boolean).map(esc).join(" · ")}</div></div>` : ""}
      ${h.criterios_ganho ? `<div class="hc-bloco"><div class="hc-h">Por que ganhamos</div><div class="hc-txt">${esc(h.criterios_ganho)}</div></div>` : ""}
      ${h.criterios_sucesso ? `<div class="hc-bloco"><div class="hc-h">Critério de sucesso</div><div class="hc-txt">${esc(h.criterios_sucesso)}</div></div>` : ""}
      ${h.historia ? `<div class="hc-bloco"><div class="hc-h">História / observações</div><div class="hc-txt">${esc(h.historia)}</div></div>` : ""}
      <div class="hc-acoes">${contrato}${verProposta}</div>
    </div>`;
  }

  function fecharPainel() { $("#painelOverlay").classList.add("hide"); }

  // Liga os botões de fechar dos overlays.
  document.addEventListener("DOMContentLoaded", () => {
    const x = $("#hoFechar"); if (x) x.addEventListener("click", fechar);
    const px = $("#painelFechar"); if (px) px.addEventListener("click", fecharPainel);
    [$("#handoffOverlay"), $("#painelOverlay")].forEach(ov => {
      if (ov) ov.addEventListener("click", e => { if (e.target === ov) ov.classList.add("hide"); });
    });
  });

  global.PricingHandoff = { abrir, abrirPainel, setOnConcluir };
})(window);
