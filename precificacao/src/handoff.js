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
      </div>

      <div class="ho-sec">
        <h3>5. Critérios de ganho & sucesso</h3>
        <label class="ho-f">Por que ganhamos? (o que pesou na decisão)
          <textarea id="hoGanho" placeholder="ex.: melhor custo-benefício, suporte, módulo X…"></textarea></label>
        <label class="ho-f">O que é sucesso para o cliente? (como ele vai medir)
          <textarea id="hoSucesso" placeholder="ex.: reduzir turnover, implantar avaliação em 90 dias…"></textarea></label>
      </div>

      <div class="ho-sec">
        <h3>6. História & observações para o Onboarding</h3>
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
  }

  function addContato() {
    const box = $("#hoContatos");
    const div = document.createElement("div");
    div.className = "ho-contato";
    div.innerHTML = `
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
      nome: d.querySelector(".c-nome").value.trim(),
      cargo: d.querySelector(".c-cargo").value.trim(),
      email: d.querySelector(".c-email").value.trim(),
      telefone: d.querySelector(".c-tel").value.trim(),
    })).filter(c => c.nome || c.email || c.telefone);
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
