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

  // Foto da pessoa (ou as iniciais, quando não tem foto cadastrada).
  function fotoOuIniciais(u) {
    const base = u.nome || u.email;
    const iniciais = base.split(/[\s@.]+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase();
    return u.foto_url
      ? `<img class="adm-foto" src="${esc(u.foto_url)}" alt="">`
      : `<div class="adm-foto adm-iniciais">${esc(iniciais)}</div>`;
  }

  // Formulário de perfil: o que o CLIENTE vê na página de acompanhamento
  // (foto, nome, cargo e botões de contato — WhatsApp / e-mail).
  function perfilForm(u, i) {
    return `<div class="adm-perfil hide" id="admPerfil${i}">
      <p style="font-size:11px;color:var(--txt-3);margin-bottom:10px">
        👁 Esses dados aparecem para o <b>cliente</b> na página de acompanhamento quando esta pessoa
        é atribuída a uma implantação (foto, nome, cargo e botões de WhatsApp/e-mail).</p>
      <div class="adm-perfil-grid">
        <label class="ho-f">Nome completo
          <input type="text" id="admNome${i}" class="ops-sel" value="${esc(u.nome || "")}" placeholder="ex.: Laura Martins"></label>
        <label class="ho-f">Cargo
          <input type="text" id="admCargo${i}" class="ops-sel" value="${esc(u.cargo || "")}" placeholder="ex.: Customer Success"></label>
        <label class="ho-f">Telefone (WhatsApp, com DDI)
          <input type="text" id="admTel${i}" class="ops-sel" value="${esc(u.telefone || "")}" placeholder="ex.: 5511999998888"></label>
        <label class="ho-f">Foto (jpg/png) — você poderá enquadrar e dar zoom
          <input type="file" id="admFoto${i}" class="ops-sel" accept="image/*"></label>
      </div>
      <div class="adm-foto-preview hide" id="admFotoPreview${i}">
        <img alt="prévia"><span>✓ Foto enquadrada — será enviada ao salvar o perfil</span>
      </div>
      <button class="btn ghost" data-salvarperfil="${i}" type="button" style="padding:7px 14px;margin-top:10px">Salvar perfil</button>
    </div>`;
  }

  /* ---------- Enquadramento da foto (arrastar para posicionar + zoom) ---------- */
  // Fotos enquadradas e prontas para upload, por índice do usuário.
  const fotosCortadas = {};
  const CROP_VIEW = 320;   // tamanho do canvas de edição na tela
  const CROP_OUT = 400;    // resolução final da foto enviada

  function abrirCropper(file, indice) {
    // monta o modal do cropper uma única vez
    let ov = $("#cropOverlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "cropOverlay";
      ov.className = "ho-overlay crop-overlay";
      ov.innerHTML = `
        <div class="ho-modal crop-modal">
          <div class="ho-head"><h2>🖼 Enquadrar foto</h2></div>
          <p style="font-size:12px;color:var(--txt-3);margin-bottom:10px">
            Arraste a imagem para posicionar e use o controle para dar mais ou menos zoom.
            O círculo é como a foto vai aparecer para o cliente.</p>
          <div class="crop-area"><canvas id="cropCanvas" width="${CROP_VIEW}" height="${CROP_VIEW}"></canvas></div>
          <label class="crop-zoom">🔍− <input type="range" id="cropZoom" min="100" max="300" value="100"> 🔍+</label>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
            <button class="btn ghost" id="cropCancelar" type="button">Cancelar</button>
            <button class="btn" id="cropAplicar" type="button">✓ Usar este enquadramento</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
    }
    ov.classList.remove("hide");

    const canvas = $("#cropCanvas");
    const ctx = canvas.getContext("2d");
    const zoomCtl = $("#cropZoom");
    zoomCtl.value = "100";
    const img = new Image();
    // estado do enquadramento: deslocamento (pan) e zoom
    const st = { x: 0, y: 0, zoom: 1, base: 1, arrastando: false, px: 0, py: 0 };

    function desenhar() {
      ctx.clearRect(0, 0, CROP_VIEW, CROP_VIEW);
      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, CROP_VIEW, CROP_VIEW);
      const escala = st.base * st.zoom;
      const w = img.width * escala, h = img.height * escala;
      ctx.drawImage(img, CROP_VIEW / 2 - w / 2 + st.x, CROP_VIEW / 2 - h / 2 + st.y, w, h);
      // máscara: escurece o que fica fora do círculo
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.beginPath();
      ctx.rect(0, 0, CROP_VIEW, CROP_VIEW);
      ctx.arc(CROP_VIEW / 2, CROP_VIEW / 2, CROP_VIEW / 2 - 6, 0, Math.PI * 2, true);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "#FFF98B";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(CROP_VIEW / 2, CROP_VIEW / 2, CROP_VIEW / 2 - 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    img.onload = () => {
      // zoom base: a imagem cobre todo o círculo
      st.base = Math.max(CROP_VIEW / img.width, CROP_VIEW / img.height);
      st.x = 0; st.y = 0; st.zoom = 1;
      desenhar();
    };
    img.src = URL.createObjectURL(file);

    // pan: mouse e toque
    const inicio = (cx, cy) => { st.arrastando = true; st.px = cx; st.py = cy; };
    const move = (cx, cy) => {
      if (!st.arrastando) return;
      st.x += cx - st.px; st.y += cy - st.py;
      st.px = cx; st.py = cy;
      desenhar();
    };
    canvas.onmousedown = e => inicio(e.clientX, e.clientY);
    canvas.onmousemove = e => move(e.clientX, e.clientY);
    canvas.onmouseup = canvas.onmouseleave = () => { st.arrastando = false; };
    canvas.ontouchstart = e => { e.preventDefault(); inicio(e.touches[0].clientX, e.touches[0].clientY); };
    canvas.ontouchmove = e => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); };
    canvas.ontouchend = () => { st.arrastando = false; };
    zoomCtl.oninput = () => { st.zoom = Number(zoomCtl.value) / 100; desenhar(); };

    $("#cropCancelar").onclick = () => { ov.classList.add("hide"); };
    $("#cropAplicar").onclick = () => {
      // renderiza a área do círculo em alta resolução e guarda o blob para o upload
      const out = document.createElement("canvas");
      out.width = CROP_OUT; out.height = CROP_OUT;
      const octx = out.getContext("2d");
      const fator = CROP_OUT / CROP_VIEW;
      const escala = st.base * st.zoom * fator;
      const w = img.width * escala, h = img.height * escala;
      octx.fillStyle = "#fff";
      octx.fillRect(0, 0, CROP_OUT, CROP_OUT);
      octx.drawImage(img, CROP_OUT / 2 - w / 2 + st.x * fator, CROP_OUT / 2 - h / 2 + st.y * fator, w, h);
      out.toBlob(blob => {
        fotosCortadas[indice] = new File([blob], "foto.jpg", { type: "image/jpeg" });
        // mostra a prévia redonda no formulário
        const prev = $("#admFotoPreview" + indice);
        if (prev) {
          prev.querySelector("img").src = URL.createObjectURL(blob);
          prev.classList.remove("hide");
        }
        ov.classList.add("hide");
      }, "image/jpeg", 0.92);
    };
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
          ${fotoOuIniciais(u)}
          <div class="adm-info">
            <div class="adm-email">${esc(u.nome || u.email)}
              ${u.nome ? `<span class="adm-tag">${esc(u.email)}</span>` : ""}
              ${u.tem_conta ? `<span class="adm-tag ok">conta ativa</span>` : `<span class="adm-tag">nunca entrou</span>`}
              ${u.tem_senha ? `<span class="adm-tag info">tem senha</span>` : ""}
            </div>
            <div class="adm-sub">${esc(u.cargo || (PAPEIS.find(p => p.id === u.papel) || {}).desc || "")}
              ${u.ultimo_login ? ` · último acesso ${new Date(u.ultimo_login).toLocaleDateString("pt-BR")}` : ""}</div>
          </div>
          <div class="adm-acoes">
            ${selectPapel(u.papel, `data-papel="${i}"`)}
            <button class="tl-link" data-perfil="${i}" type="button">👤 Perfil</button>
            <button class="tl-link" data-senha="${i}" type="button">🔑 Senha</button>
            <button class="tl-link adm-x" data-remover="${i}" type="button">✕ Remover</button>
          </div>
          ${perfilForm(u, i)}
        </div>`).join("")}
      </div>

      <div class="ho-sec" style="margin-top:18px">
        <h3>+ Adicionar usuário</h3>
        <div class="adm-novo">
          <input type="email" id="admNovoEmail" placeholder="email@elofy.com.br" class="ops-sel" style="flex:2">
          <input type="text" id="admNovoNome" placeholder="Nome completo" class="ops-sel" style="flex:2">
          ${selectPapel("closer", 'id="admNovoPapel" style="flex:1"')}
          <input type="text" id="admNovaSenha" placeholder="Senha temporária (opcional, mín. 8)" class="ops-sel" style="flex:2">
          <button class="btn" id="admCriar" type="button">Criar</button>
        </div>
        <p style="font-size:11px;color:var(--txt-3);margin-top:8px">
          Com senha definida, a pessoa entra na hora por "Entrar com senha". Sem senha, ela
          precisará usar o código por e-mail (requer SMTP configurado). Depois de criar,
          use 👤 Perfil para cadastrar cargo, telefone e foto — o cliente vê esses dados.</p>
      </div>
      <p id="admMsg" class="ho-msg"></p>`;

    // troca de papel (salva direto)
    body.querySelectorAll("[data-papel]").forEach(sel =>
      sel.addEventListener("change", async () => {
        const u = usuarios[Number(sel.dataset.papel)];
        await acao(() => store().adminSalvarUsuario(u.email, sel.value),
          `Papel de ${u.email} atualizado.`);
      }));
    // mostrar/esconder o formulário de perfil
    body.querySelectorAll("[data-perfil]").forEach(btn =>
      btn.addEventListener("click", () =>
        $("#admPerfil" + btn.dataset.perfil).classList.toggle("hide")));
    // foto escolhida → abre o enquadramento (arrastar + zoom)
    usuarios.forEach((u, i) => {
      const input = $("#admFoto" + i);
      if (input) input.addEventListener("change", () => {
        if (input.files && input.files[0]) abrirCropper(input.files[0], i);
      });
    });
    // salvar perfil (nome, cargo, telefone e foto — visíveis para o cliente)
    body.querySelectorAll("[data-salvarperfil]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const i = Number(btn.dataset.salvarperfil);
        const u = usuarios[i];
        // prioridade: foto enquadrada no cropper; senão, o arquivo cru do input
        const arquivo = fotosCortadas[i] || $("#admFoto" + i).files[0];
        await acao(async () => {
          let fotoUrl = null; // null = mantém a foto atual (o banco preserva com coalesce)
          if (arquivo) fotoUrl = await store().uploadFoto(u.email, arquivo);
          await store().adminSalvarUsuario(u.email, u.papel, {
            nome: $("#admNome" + i).value.trim() || null,
            cargo: $("#admCargo" + i).value.trim() || null,
            telefone: $("#admTel" + i).value.trim() || null,
            foto_url: fotoUrl,
          });
          delete fotosCortadas[i];
        }, `Perfil de ${u.nome || u.email} atualizado.`);
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
      const nome = $("#admNovoNome").value.trim();
      const papel = $("#admNovoPapel").value;
      const senha = $("#admNovaSenha").value;
      if (!email) { msg("Informe o e-mail.", "bad"); return; }
      await acao(async () => {
        await store().adminSalvarUsuario(email, papel, nome ? { nome } : null);
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
