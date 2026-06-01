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
  let equipe = [];         // pessoas cadastradas (para os selects do time)

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
      // equipe cadastrada → selects do time (carrega junto, em paralelo)
      const [implantacoes, pessoas] = await Promise.all([
        store().opsListar(),
        store().equipe().catch(() => []),
      ]);
      cache = implantacoes;
      equipe = pessoas;
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
            ${i.handoff_status === "pendente" ? `<span class="pp-status warn">🤝 Aguardando aceite</span>` : ""}
            ${(i.red_flags || []).length >= 2 ? `<span class="pp-status bad">🚩 RED ACCOUNT</span>`
              : (i.red_flags || []).length === 1 ? `<span class="pp-status warn">🚩 1 sinal</span>` : ""}
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

  // Select de pessoa cadastrada (CS / Projeto / Arquitetura).
  function selectPessoa(id, atual) {
    const opcoes = equipe.map(p =>
      `<option value="${esc(p.email)}" ${p.email === atual ? "selected" : ""}>${esc(p.email.split("@")[0])} (${esc(p.papel)})</option>`).join("");
    // valor atual fora da lista (legado em texto livre) → mantém como opção
    const legado = atual && !equipe.some(p => p.email === atual)
      ? `<option value="${esc(atual)}" selected>${esc(atual)}</option>` : "";
    return `<select id="${id}" class="ops-sel" style="width:100%">
      <option value="">— sem atribuição —</option>${legado}${opcoes}</select>`;
  }

  // Checkboxes do Time de IS (vários selecionáveis), a partir das pessoas cadastradas.
  function checkboxesIS(atual) {
    const marcados = new Set(String(atual || "").split(",").map(s => s.trim()).filter(Boolean));
    return equipe.map(p => `
      <label class="ops-is-item ${marcados.has(p.email) ? "on" : ""}">
        <input type="checkbox" value="${esc(p.email)}" ${marcados.has(p.email) ? "checked" : ""}>
        <span>${esc(p.email.split("@")[0])}</span>
      </label>`).join("") || `<p style="font-size:12px;color:var(--txt-3)">Nenhuma pessoa cadastrada ainda.</p>`;
  }

  /* ---------- Playbook de Handoff (Laura/Arquitetura) ---------- */
  const SINAIS_RED = [
    "Baixo engajamento com o CS", "Reclamações recorrentes de suporte",
    "Não comparecimento a reuniões", "Questionamento do valor no contrato",
    "Mudança de decisor / patrocinador", "Queda de uso da plataforma",
  ];
  const ROTULO = {
    maturidade: { inexistente: "Inexistente", inicial: "Inicial (planilhas)", estruturada: "Estruturada", avancada: "Avançada" },
    nivel: { baixa: "Baixa", media: "Média", alta: "Alta", nenhuma: "Nenhuma", baixo: "Baixo", medio: "Médio", alto: "Alto" },
    papel: { decisor: "Decisor", champion: "Champion", detrator: "⚠️ Detrator", operacional: "Operacional", outro: "Outro" },
  };

  // Banner de aceite: o handoff só está completo quando o OPS confirma a passagem.
  function bannerAceite(impl) {
    if (!impl.handoff_id || impl.handoff_status !== "pendente") return "";
    if (!podeEditar) return `<div class="ho-gate" style="margin-bottom:14px">
      🤝 <b>Handoff aguardando aceite do Customer OPS.</b> O time precisa ler o playbook e confirmar a passagem.</div>`;
    return `<div class="ops-aceite" id="opsAceiteBox">
      <div><b>🤝 Este handoff aguarda o seu aceite.</b><br>
      <span>Leia o playbook abaixo, confirme os itens e assuma o projeto — o closer será avisado.</span></div>
      <div class="ops-aceite-check">
        <label class="ho-chk"><input type="checkbox" id="okPlaybook"><span>Li o playbook completo</span></label>
        <label class="ho-chk"><input type="checkbox" id="okReuniao"><span>Tive (ou agendei) a reunião de passagem com o comercial</span></label>
        <label class="ho-chk"><input type="checkbox" id="okRiscos"><span>Estou ciente dos riscos mapeados</span></label>
        <label class="ho-chk"><input type="checkbox" id="okContato"><span>Primeiro contato com o cliente está agendado</span></label>
      </div>
      <button class="btn" id="btnAceitar" type="button">🤝 Aceitar handoff e assumir o projeto</button>
      <p id="aceiteMsg" class="ho-msg"></p>
    </div>`;
  }

  // Visualizador do playbook (o que o comercial passou).
  function playbookViewer(impl) {
    const pb = impl.handoff_playbook || {};
    const tem = o => o && Object.values(o).some(v => v && String(v).trim());
    if (!impl.handoff_id) return "";
    const pf = pb.prefill || {};
    const fb = pf.feedback_cliente;
    const linha = (k, v) => v && String(v).trim() ? `<div class="pb-linha"><b>${k}:</b> ${esc(v)}</div>` : "";
    const aceiteInfo = impl.handoff_status === "aceito"
      ? `<span class="pp-status ok">🤝 Aceito por ${esc((impl.handoff_aceito_por || "").split("@")[0])}</span>`
      : `<span class="pp-status warn">⏳ Aguardando aceite</span>`;

    const stakeholders = (impl.handoff_contatos || []).map(c =>
      `<div class="pb-linha">${ROTULO.papel[c.papel] || "Contato"}: <b>${esc(c.nome || "—")}</b>${c.cargo ? " · " + esc(c.cargo) : ""}${c.email ? " · " + esc(c.email) : ""}${c.telefone ? " · " + esc(c.telefone) : ""}</div>`).join("");

    const riscos = (pb.riscos || []).map(r =>
      `<div class="pb-linha pb-risco-${esc(r.nivel)}">⚠️ <b>${esc(r.risco)}</b> — nível ${ROTULO.nivel[r.nivel] || r.nivel}</div>`).join("");

    return `
      <details class="pb-sec" ${impl.handoff_status === "pendente" ? "open" : ""}>
        <summary>📘 Playbook do Handoff (passado pelo Comercial) ${aceiteInfo}</summary>
        <div class="pb-body">
          <div class="pb-grupo"><div class="pb-grupo-titulo">⚡ Dados da venda (automático)</div>
            ${linha("Módulos", pf.modulos ? Object.keys(pf.modulos).filter(k => pf.modulos[k] === true).join(", ") : "")}
            ${pf.desconto_pct ? `<div class="pb-linha"><b>Desconto:</b> ${(pf.desconto_pct * 100).toFixed(1)}%</div>` : ""}
            ${(pf.customs || []).length ? `<div class="pb-linha"><b>Customs prometidas:</b> ${esc(pf.customs.join("; "))}</div>` : ""}
            ${fb ? `<div class="pb-linha"><b>Feedback do cliente:</b> ${esc(fb.sentimento)}${fb.comentario ? ` — “${esc(fb.comentario)}”` : ""}</div>` : ""}
          </div>
          ${tem(pb.contexto) ? `<div class="pb-grupo"><div class="pb-grupo-titulo">📊 Contexto da empresa</div>
            ${linha("Setor", pb.contexto.setor)}
            ${linha("Maturidade em gestão de pessoas", ROTULO.maturidade[pb.contexto.maturidade] || pb.contexto.maturidade)}
            ${linha("Histórico com ferramentas", pb.contexto.historico_rh)}
            ${linha("Cultura", pb.contexto.cultura)}</div>` : ""}
          ${tem(pb.emocional) ? `<div class="pb-grupo"><div class="pb-grupo-titulo">🎭 Estado emocional</div>
            ${linha("Como chegou na venda", pb.emocional.como_chegou)}
            ${linha("Resistência interna", ROTULO.nivel[pb.emocional.resistencia] || pb.emocional.resistencia)}
            ${linha("Urgência do cliente", ROTULO.nivel[pb.emocional.urgencia] || pb.emocional.urgencia)}</div>` : ""}
          ${stakeholders ? `<div class="pb-grupo"><div class="pb-grupo-titulo">👥 Stakeholders</div>${stakeholders}</div>` : ""}
          ${tem(pb.promessas) ? `<div class="pb-grupo"><div class="pb-grupo-titulo">🤝 O que foi prometido</div>
            ${linha("Promessas", pb.promessas.feitas)}
            ${linha("Destaques da demo", pb.promessas.demo)}
            ${pb.promessas.em_risco ? `<div class="pb-linha pb-alerta">⚠️ <b>Expectativas em risco:</b> ${esc(pb.promessas.em_risco)}</div>` : ""}
            ${linha("Pendências", pb.promessas.pendencias)}</div>` : ""}
          ${tem(pb.momento_valor) ? `<div class="pb-grupo"><div class="pb-grupo-titulo">💎 Momento de valor</div>
            ${linha("Primeiro resultado esperado", pb.momento_valor.primeiro_resultado)}
            ${linha("Tempo esperado para ver valor", pb.momento_valor.tempo_esperado)}
            ${linha("O que faz dizer 'valeu a pena'", pb.momento_valor.valeu_a_pena)}</div>` : ""}
          ${riscos ? `<div class="pb-grupo"><div class="pb-grupo-titulo">⚠️ Riscos mapeados</div>${riscos}
            ${linha("Detalhes", pb.riscos_obs)}</div>` : ""}
          ${impl.handoff_criterios_sucesso ? `<div class="pb-grupo"><div class="pb-grupo-titulo">🎯 Critério de sucesso</div>
            <div class="pb-linha">${esc(impl.handoff_criterios_sucesso)}</div></div>` : ""}
          ${impl.handoff_historia ? `<div class="pb-grupo"><div class="pb-grupo-titulo">📖 História</div>
            <div class="pb-linha">${esc(impl.handoff_historia)}</div></div>` : ""}
        </div>
      </details>`;
  }

  // Discovery técnico (configurações dos módulos, preenchido pelo OPS no kickoff).
  function discoverySection(impl) {
    const d = impl.discovery || {};
    const ad = d.ad || {}, pq = d.pesquisas || {}, mt = d.metas || {};
    const status = impl.discovery_em
      ? `<span class="pp-status ok">✓ Preenchido em ${dataBR(impl.discovery_em)}</span>`
      : `<span class="pp-status wait">Pendente</span>`;
    if (!podeEditar) {
      return impl.discovery_em ? `<details class="pb-sec"><summary>🔧 Discovery técnico ${status}</summary>
        <div class="pb-body"><pre class="pb-pre">${esc(JSON.stringify(d, null, 2))}</pre></div></details>` : "";
    }
    const f = (id, rotulo, valor, ph) => `<label class="ho-f">${rotulo}
      <input type="text" id="${id}" value="${esc(valor || "")}" placeholder="${ph || ""}"></label>`;
    return `
      <details class="pb-sec"><summary>🔧 Discovery técnico (preencher no kickoff) ${status}</summary>
        <div class="pb-body">
          <div class="pb-grupo-titulo">Avaliação de Desempenho (AD)</div>
          <div class="ho-grid">
            ${f("dcAdFreq", "Frequência da avaliação", ad.frequencia, "ex.: semestral")}
            ${f("dcAdEtapas", "Etapas do processo", ad.etapas, "ex.: auto + gestor + calibração")}
            ${f("dcAdRegua", "Régua de pontuação", ad.regua, "ex.: 1 a 5")}
            ${f("dcAdAvaliadores", "Tipos de avaliadores", ad.avaliadores, "ex.: gestor, pares, subordinados")}
          </div>
          <div class="pb-grupo-titulo" style="margin-top:12px">Pesquisas</div>
          <div class="ho-grid">
            ${f("dcPqTipo", "Tipo de pesquisa", pq.tipo, "ex.: clima, pulso, eNPS")}
            ${f("dcPqFreq", "Frequência de envio", pq.frequencia, "ex.: trimestral")}
            ${f("dcPqEscala", "Escala utilizada", pq.escala, "ex.: 1 a 10")}
          </div>
          <div class="pb-grupo-titulo" style="margin-top:12px">Metas (OKR / Individuais)</div>
          <div class="ho-grid">
            ${f("dcMtCiclos", "Ciclos por ano", mt.ciclos_ano, "ex.: 4 (trimestral)")}
            ${f("dcMtParticipantes", "Participantes do ciclo", mt.participantes, "ex.: liderança, todos")}
            ${f("dcMtCascata", "Alinhamento entre metas (cascata)?", mt.cascata, "sim / não / parcial")}
            ${f("dcMtUso", "Uso do resultado das metas", mt.uso_resultado, "ex.: bônus, PDI, RV")}
          </div>
          <button class="btn ghost" id="btnSalvarDiscovery" type="button" style="margin-top:12px;padding:7px 14px">Salvar discovery</button>
        </div>
      </details>`;
  }

  // Sinais de Red Account (semente do módulo de CS).
  function redFlagsSection(impl) {
    const flags = impl.red_flags || [];
    const ativos = new Set(flags.map(f => f.sinal));
    const badge = ativos.size >= 2
      ? `<span class="pp-status bad">🚩 RED ACCOUNT · ${ativos.size} sinais</span>`
      : ativos.size === 1 ? `<span class="pp-status warn">🚩 1 sinal de alerta</span>` : "";
    return `
      <details class="pb-sec" ${ativos.size ? "open" : ""}><summary>🚩 Sinais de alerta (Red Account) ${badge}</summary>
        <div class="pb-body">
          <p style="font-size:12px;color:var(--txt-3);margin-bottom:10px">
            Marque os sinais observados. Com 2 ou mais, a conta vira <b>Red Account</b> e o time todo é alertado.</p>
          <div class="ops-is-lista">
            ${SINAIS_RED.map(s => `
              <label class="ops-is-item ${ativos.has(s) ? "on" : ""} ${podeEditar ? "" : "ro"}">
                <input type="checkbox" data-flag="${esc(s)}" ${ativos.has(s) ? "checked" : ""} ${podeEditar ? "" : "disabled"}>
                <span>${s}</span>
              </label>`).join("")}
          </div>
        </div>
      </details>`;
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
      ${bannerAceite(impl)}
      ${stepper(impl.etapa, impl.tempos_etapas)}
      <div class="ops-meta" style="margin:10px 0 16px">
        <span>📅 início ${dataBR(impl.inicio)} · ${impl.dias_corridos}d corridos</span>
        <span>🎯 go-live previsto ${dataBR(impl.previsao_golive)}</span>
        ${impl.golive_em ? `<span>🚀 go-live em ${dataBR(impl.golive_em)}</span>` : ""}
      </div>

      ${playbookViewer(impl)}
      ${discoverySection(impl)}
      ${redFlagsSection(impl)}

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
        <p style="font-size:11px;color:var(--txt-3);margin-bottom:10px">Somente pessoas cadastradas no sistema
        (⚙️ Admin → adicionar usuário) podem ser atribuídas.</p>
        <div class="ops-time-grid">
          <label class="ho-f">CS responsável pela conta${selectPessoa("opsCs", impl.cs_email)}</label>
          <label class="ho-f">Responsável pelo projeto${selectPessoa("opsProjeto", impl.responsavel_email)}</label>
          <label class="ho-f">Responsável pela arquitetura${selectPessoa("opsArq", impl.arquitetura_email)}</label>
        </div>
        <label class="ho-f" style="margin-top:4px">Time de IS (implantação) — marque um ou mais</label>
        <div class="ops-is-lista">${checkboxesIS(impl.time_is)}</div>
        <button class="btn ghost" id="opsSalvarTime" type="button" style="padding:7px 14px;margin-top:10px">Salvar time</button>
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
      // salvar o time da implantação (pessoas cadastradas)
      $("#opsSalvarTime").addEventListener("click", async () => {
        const msg = $("#opsMsg");
        const isMarcados = Array.from(document.querySelectorAll(".ops-is-lista input:checked"))
          .map(c => c.value).join(", ");
        try {
          if (msg) { msg.textContent = "Salvando time…"; msg.className = "ho-msg"; }
          await store().opsEditar(id, {
            cs_email: $("#opsCs").value || null,
            responsavel_email: $("#opsProjeto").value || null,
            arquitetura_email: $("#opsArq").value || null,
            time_is: isMarcados || null,
          });
          cache = await store().opsListar();
          renderKpis(); renderLista();
          abrirDetalhe(id);
        } catch (e2) {
          if (msg) { msg.textContent = "Erro: " + (e2.message || e2); msg.className = "ho-msg bad"; }
        }
      });
      // marca visual dos checkboxes do time de IS
      document.querySelectorAll(".ops-is-lista input").forEach(cb =>
        cb.addEventListener("change", () => cb.closest(".ops-is-item").classList.toggle("on", cb.checked)));
      $("#opsBtnUpdate").addEventListener("click", () => registrarDoForm(id, "atualizacao"));
      $("#opsBtnProblema").addEventListener("click", () => registrarDoForm(id, "problema"));
    }
    // botões de "dar baixa" nos problemas em aberto da timeline
    ligarDarBaixa(id);

    // ----- Playbook: aceite bilateral -----
    const btnAceitar = $("#btnAceitar");
    if (btnAceitar) {
      btnAceitar.addEventListener("click", async () => {
        const msg = $("#aceiteMsg");
        const oks = ["okPlaybook", "okReuniao", "okRiscos", "okContato"];
        const faltam = oks.filter(k => !$("#" + k).checked);
        if (faltam.length) {
          msg.textContent = "Confirme todos os itens do checklist antes de aceitar.";
          msg.className = "ho-msg bad"; return;
        }
        try {
          msg.textContent = "Aceitando…"; msg.className = "ho-msg";
          await store().opsAceitarHandoff(impl.handoff_id, {
            li_playbook: true, reuniao_passagem: true, riscos_cientes: true, primeiro_contato_agendado: true,
          });
          cache = await store().opsListar();
          renderKpis(); renderLista();
          abrirDetalhe(id);
        } catch (e) { msg.textContent = "Erro: " + (e.message || e); msg.className = "ho-msg bad"; }
      });
    }

    // ----- Discovery técnico -----
    const btnDisc = $("#btnSalvarDiscovery");
    if (btnDisc) {
      btnDisc.addEventListener("click", async () => {
        const v = idd => { const el = $("#" + idd); return el ? el.value.trim() : ""; };
        const msg = $("#opsMsg");
        try {
          if (msg) { msg.textContent = "Salvando discovery…"; msg.className = "ho-msg"; }
          await store().opsSalvarDiscovery(id, {
            ad: { frequencia: v("dcAdFreq"), etapas: v("dcAdEtapas"), regua: v("dcAdRegua"), avaliadores: v("dcAdAvaliadores") },
            pesquisas: { tipo: v("dcPqTipo"), frequencia: v("dcPqFreq"), escala: v("dcPqEscala") },
            metas: { ciclos_ano: v("dcMtCiclos"), participantes: v("dcMtParticipantes"), cascata: v("dcMtCascata"), uso_resultado: v("dcMtUso") },
          });
          cache = await store().opsListar();
          renderKpis(); renderLista();
          abrirDetalhe(id);
        } catch (e) { if (msg) { msg.textContent = "Erro: " + (e.message || e); msg.className = "ho-msg bad"; } }
      });
    }

    // ----- Red flags (sinais de alerta) -----
    document.querySelectorAll("[data-flag]").forEach(cb => {
      if (cb.disabled) return;
      cb.addEventListener("change", async () => {
        const sinal = cb.dataset.flag;
        let obs = null;
        if (cb.checked) obs = window.prompt(`Observação sobre "${sinal}" (opcional):`) || null;
        try {
          await store().opsRedFlag(id, sinal, cb.checked, obs);
          cache = await store().opsListar();
          renderKpis(); renderLista();
          abrirDetalhe(id);
        } catch (e) {
          cb.checked = !cb.checked; // desfaz visualmente
          alert("Erro: " + (e.message || e));
        }
      });
    });
  }

  function renderTimeline(updates) {
    if (!updates.length) return `<p style="color:var(--txt-3);font-size:13px">Sem atualizações ainda.</p>`;
    const ICONE = { atualizacao: "💬", problema: "⚠️", resolucao: "✅", etapa: "➡️" };
    return updates.map(u => {
      // problema: mostra status de resolução ou o botão de dar baixa
      let blocoProblema = "";
      if (u.tipo === "problema") {
        if (u.resolvido_em) {
          blocoProblema = `<div class="ops-resolvido">✅ <b>Resolvido</b> por ${esc((u.resolvido_por || "—").split("@")[0])}
            em ${new Date(u.resolvido_em).toLocaleDateString("pt-BR")}
            ${u.resolucao_texto ? `<div class="ops-resolvido-txt">“${esc(u.resolucao_texto)}”</div>` : ""}</div>`;
        } else if (podeEditar) {
          blocoProblema = `<div class="ops-baixa" data-prob="${u.id}">
            <input type="text" class="ops-baixa-txt" placeholder="Como foi resolvido? (breve descrição)">
            <button class="ops-baixa-btn" type="button">✓ Dar baixa</button>
          </div>`;
        } else {
          blocoProblema = `<div class="ops-resolvido pendente">⏳ Problema em aberto</div>`;
        }
      }
      return `
      <div class="ops-up ${u.tipo} ${u.tipo === "problema" && u.resolvido_em ? "resolvido" : ""}">
        <div class="ops-up-head">
          <span>${ICONE[u.tipo] || "💬"} <b>${esc((u.autor_email || "sistema").split("@")[0])}</b></span>
          <span>${u.visivel_cliente ? "" : "🔒 interno"} · ${new Date(u.criado_em).toLocaleString("pt-BR")}</span>
        </div>
        ${u.texto ? `<div class="ops-up-txt">${esc(u.texto)}</div>` : ""}
        ${blocoProblema}
      </div>`;
    }).join("");
  }

  // Liga os botões de "dar baixa" da timeline (chamado após renderizar o detalhe).
  function ligarDarBaixa(implantacaoId) {
    document.querySelectorAll(".ops-baixa").forEach(box => {
      box.querySelector(".ops-baixa-btn").addEventListener("click", async () => {
        const texto = box.querySelector(".ops-baixa-txt").value.trim();
        const msg = $("#opsMsg");
        if (!texto) {
          box.querySelector(".ops-baixa-txt").focus();
          if (msg) { msg.textContent = "Descreva brevemente como o problema foi resolvido."; msg.className = "ho-msg bad"; }
          return;
        }
        try {
          if (msg) { msg.textContent = "Dando baixa…"; msg.className = "ho-msg"; }
          await store().opsResolverProblema(box.dataset.prob, texto);
          cache = await store().opsListar();
          renderKpis(); renderLista();
          abrirDetalhe(implantacaoId);
        } catch (e) {
          if (msg) { msg.textContent = "Erro: " + (e.message || e); msg.className = "ho-msg bad"; }
        }
      });
    });
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
