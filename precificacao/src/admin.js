/* ============================================================================
 *  ADMINISTRAÇÃO DE USUÁRIOS  ·  JORNADA ELOFY
 *  ----------------------------------------------------------------------------
 *  Painel exclusivo do papel ADMIN: criar usuários, definir papéis (permissões),
 *  definir senha temporária (enquanto o SMTP não está configurado) e remover.
 *  Todas as operações são validadas no banco (RPCs admin_* exigem is_admin()).
 *
 *  Expõe window.JornadaAdmin: { abrir() }.
 * ========================================================================== */
(function (global) {
  "use strict";

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = () => global.PricingStore;

  // Papéis e o que cada um pode fazer (mostrado na tela para o admin decidir).
  const PAPEIS = [
    { id: "closer",     nome: "Closer",                desc: "Cria propostas e vê apenas as suas" },
    { id: "supervisor", nome: "Supervisor (liderança)", desc: "Vê propostas e handoffs de todo o time; edita o Customer OPS" },
    { id: "onboarding", nome: "Analista de Projetos",   desc: "Customer OPS: edita implantações e vê os handoffs" },
    { id: "admin",      nome: "Admin",                  desc: "Tudo + administração de usuários" },
    { id: "gestor",     nome: "Gestor",                 desc: "Como closer, com alçada de desconto maior (20%)" },
    { id: "diretor",    nome: "Diretor",                desc: "Como closer, com alçada de desconto máxima (30%)" },
  ];

  let usuarios = [];

  async function abrir() {
    const ov = $("#adminOverlay");
    ov.classList.remove("hide");
    await recarregar();
  }

  async function recarregar() {
    const body = $("#adminBody");
    body.innerHTML = `<p style="color:var(--txt-3)">Carregando…</p>`;
    try {
      usuarios = await store().adminListarUsuarios();
      render();
    } catch (e) {
      body.innerHTML = `<p class="ho-msg bad">Erro: ${esc(e.message || e)}</p>`;
    }
  }

  function selectPapel(atual, attrs) {
    return `<select class="ops-sel" ${attrs || ""}>
      ${PAPEIS.map(p => `<option value="${p.id}" ${p.id === atual ? "selected" : ""}>${p.nome}</option>`).join("")}
    </select>`;
  }

  function render() {
    const body = $("#adminBody");
    body.innerHTML = `
      <p style="font-size:12px;color:var(--txt-3);margin-bottom:14px">
        Os papéis controlam o que cada pessoa vê e pode fazer. A senha temporária serve
        enquanto o login por e-mail (SMTP) não está configurado.</p>

      <div class="adm-lista">
        ${usuarios.map((u, i) => `
        <div class="adm-row" data-i="${i}">
          <div class="adm-info">
            <div class="adm-email">${esc(u.email)}
              ${u.tem_conta ? `<span class="adm-tag ok">conta ativa</span>` : `<span class="adm-tag">nunca entrou</span>`}
              ${u.tem_senha ? `<span class="adm-tag info">tem senha</span>` : ""}
            </div>
            <div class="adm-sub">${esc((PAPEIS.find(p => p.id === u.papel) || {}).desc || "")}
              ${u.ultimo_login ? ` · último acesso ${new Date(u.ultimo_login).toLocaleDateString("pt-BR")}` : ""}</div>
          </div>
          <div class="adm-acoes">
            ${selectPapel(u.papel, `data-papel="${i}"`)}
            <button class="tl-link" data-senha="${i}" type="button">🔑 Senha</button>
            <button class="tl-link adm-x" data-remover="${i}" type="button">✕ Remover</button>
          </div>
        </div>`).join("")}
      </div>

      <div class="ho-sec" style="margin-top:18px">
        <h3>+ Adicionar usuário</h3>
        <div class="adm-novo">
          <input type="email" id="admNovoEmail" placeholder="email@elofy.com.br" class="ops-sel" style="flex:2">
          ${selectPapel("closer", 'id="admNovoPapel" style="flex:1"')}
          <input type="text" id="admNovaSenha" placeholder="Senha temporária (opcional, mín. 8)" class="ops-sel" style="flex:2">
          <button class="btn" id="admCriar" type="button">Criar</button>
        </div>
        <p style="font-size:11px;color:var(--txt-3);margin-top:8px">
          Com senha definida, a pessoa entra na hora por "Entrar com senha". Sem senha, ela
          precisará usar o código por e-mail (requer SMTP configurado).</p>
      </div>
      <p id="admMsg" class="ho-msg"></p>`;

    // troca de papel (salva direto)
    body.querySelectorAll("[data-papel]").forEach(sel =>
      sel.addEventListener("change", async () => {
        const u = usuarios[Number(sel.dataset.papel)];
        await acao(() => store().adminSalvarUsuario(u.email, sel.value),
          `Papel de ${u.email} atualizado.`);
      }));
    // senha temporária
    body.querySelectorAll("[data-senha]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const u = usuarios[Number(btn.dataset.senha)];
        const senha = window.prompt(`Senha temporária para ${u.email} (mínimo 8 caracteres):`);
        if (!senha) return;
        await acao(() => store().adminDefinirSenha(u.email, senha),
          `Senha definida para ${u.email}. Compartilhe por um canal seguro (não por e-mail).`);
      }));
    // remover
    body.querySelectorAll("[data-remover]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const u = usuarios[Number(btn.dataset.remover)];
        if (!window.confirm(`Remover o acesso de ${u.email}? A pessoa não conseguirá mais entrar.`)) return;
        await acao(() => store().adminRemoverUsuario(u.email), `${u.email} removido.`);
      }));
    // criar
    $("#admCriar").addEventListener("click", async () => {
      const email = $("#admNovoEmail").value.trim();
      const papel = $("#admNovoPapel").value;
      const senha = $("#admNovaSenha").value;
      if (!email) { msg("Informe o e-mail.", "bad"); return; }
      await acao(async () => {
        await store().adminSalvarUsuario(email, papel);
        if (senha) await store().adminDefinirSenha(email, senha);
      }, `${email} criado${senha ? " com senha temporária" : ""}.`);
    });
  }

  async function acao(fn, okMsg) {
    try {
      msg("Salvando…", "");
      await fn();
      msg("✓ " + okMsg, "ok");
      // recarrega a lista mantendo a mensagem
      usuarios = await store().adminListarUsuarios();
      const m = $("#admMsg") ? $("#admMsg").textContent : "";
      const cls = $("#admMsg") ? $("#admMsg").className : "";
      render();
      if ($("#admMsg")) { $("#admMsg").textContent = m; $("#admMsg").className = cls; }
    } catch (e) {
      msg("Erro: " + (e.message || e), "bad");
    }
  }

  function msg(t, kind) {
    const el = $("#admMsg");
    if (!el) return;
    el.textContent = t;
    el.className = "ho-msg" + (kind === "bad" ? " bad" : kind === "ok" ? " ok" : "");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const x = $("#adminFechar");
    if (x) x.addEventListener("click", () => $("#adminOverlay").classList.add("hide"));
    const ov = $("#adminOverlay");
    if (ov) ov.addEventListener("click", e => { if (e.target === ov) ov.classList.add("hide"); });
  });

  global.JornadaAdmin = { abrir };
})(window);
