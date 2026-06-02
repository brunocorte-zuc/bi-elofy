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
  // Status possíveis de uma custom (mesmos rótulos que o cliente vê na página pública).
  const STATUS_CUSTOM = [
    ["nao_iniciada",       "Não iniciada"],
    ["em_desenvolvimento", "Em desenvolvimento"],
    ["em_homologacao",     "Em homologação"],
    ["entregue",           "✓ Entregue"],
  ];

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
            ${escalonamentoAtivo(i) ? `<span class="pp-status bad">🆘 Escalonado pelo cliente</span>` : ""}
            ${escalonamentoResolvido(i) ? `<span class="pp-status warn" title="Este projeto já foi escalonado pelo cliente, mas foi resolvido">🏳️ Já escalonado · resolvido</span>` : ""}
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
          <span>⏱ <b>${fmtHoras(i.horas_realizadas)}</b> realizadas / ${fmtHoras(i.horas_previstas)} agendadas</span>
          ${i.csat_media != null ? `<span>${csatEmoji(i.csat_media)} CSAT ${Number(i.csat_media).toFixed(1)}</span>` : ""}
          ${i.nps_medio != null ? `<span>⭐ NPS ${Number(i.nps_medio).toFixed(1)}</span>` : ""}
        </div>
        ${i.ultimo_update ? `<div class="ops-ultimo">“${esc(i.ultimo_update)}” <small>· ${dataBR(i.ultimo_update_em)}</small></div>` : ""}
      </div>`;
    }).join("");
    lista.querySelectorAll(".ops-card").forEach(el =>
      el.querySelector(".pp-abrir").addEventListener("click", () => abrirDetalhe(el.dataset.ops)));
  }

  // Nome de exibição de uma pessoa cadastrada (perfil > prefixo do e-mail).
  const nomePessoa = p => p.nome || p.email.split("@")[0];

  // Select de pessoa cadastrada (CS / Projeto / Arquitetura).
  function selectPessoa(id, atual) {
    const opcoes = equipe.map(p =>
      `<option value="${esc(p.email)}" ${p.email === atual ? "selected" : ""}>${esc(nomePessoa(p))} (${esc(p.papel)})</option>`).join("");
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
        <span>${esc(nomePessoa(p))}</span>
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

  // Escalonamento ativo? (pedido pelo cliente e ainda não resolvido)
  const escalonamentoAtivo = impl => impl.escalonado_em && !impl.escalonado_resolvido_em;
  // Já foi escalonado em algum momento, mas foi resolvido (fica a marca no projeto).
  const escalonamentoResolvido = impl => impl.escalonado_em && impl.escalonado_resolvido_em;

  // Alerta de escalonamento: o cliente acionou a liderança pela página pública.
  function escalonamentoAlerta(impl) {
    if (escalonamentoResolvido(impl)) {
      return `<div class="ops-escalado-ok">
        🏳️ <b>Este projeto já foi escalonado pelo cliente</b> em ${new Date(impl.escalonado_em).toLocaleDateString("pt-BR")}
        — <b>resolvido</b> em ${new Date(impl.escalonado_resolvido_em).toLocaleDateString("pt-BR")}.
        Os detalhes estão na linha do tempo.
      </div>`;
    }
    if (!escalonamentoAtivo(impl)) return "";
    return `<div class="ops-escalado">
      <b>🆘 O CLIENTE PEDIU ESCALONAMENTO</b>
      <span class="ops-escalado-quando">em ${new Date(impl.escalonado_em).toLocaleString("pt-BR")}</span>
      ${impl.escalonado_motivo ? `<div class="ops-escalado-motivo">“${esc(impl.escalonado_motivo)}”</div>` : ""}
      <div class="ops-escalado-dica">Entre em contato com o cliente o quanto antes e registre a tratativa
      na linha do tempo. Quando o problema for resolvido, dê baixa nele para encerrar o escalonamento —
      a marca de que o projeto já foi escalonado fica registrada no histórico.</div>
    </div>`;
  }

  // Customizações vendidas: status e previsão de entrega.
  // O que for salvo aqui aparece para o CLIENTE na página pública de acompanhamento.
  function customsSection(impl) {
    const customs = impl.customs_status || [];
    if (!customs.length && !podeEditar) return "";
    const entregues = customs.filter(c => c.status === "entregue").length;
    const badge = customs.length
      ? `<span class="pp-status ${entregues === customs.length ? "ok" : "info"}">${entregues}/${customs.length} entregue(s)</span>` : "";
    const abrir = customs.some(c => c.status !== "entregue");
    return `
      <details class="pb-sec" ${abrir ? "open" : ""}>
        <summary>🧩 Customizações ${badge}</summary>
        <div class="pb-body">
          <p style="font-size:12px;color:var(--txt-3);margin-bottom:10px">
            O cliente vê o status e a previsão de entrega de cada custom na página de acompanhamento dele.
            Mantenha sempre atualizado.</p>
          <div id="opsCustomsLista">
            ${customs.map(c => customRow(c)).join("")}
            ${!customs.length ? `<p class="ops-cu-vazio" style="font-size:12px;color:var(--txt-3)">Nenhuma customização registrada.</p>` : ""}
          </div>
          ${podeEditar ? `
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px">
            <button class="tl-link" id="opsAddCustom" type="button">+ Adicionar custom</button>
            <button class="btn ghost" id="opsSalvarCustoms" type="button" style="padding:7px 14px">Salvar customs</button>
          </div>` : ""}
        </div>
      </details>`;
  }

  // Uma custom: leitura (todos) ou edição (Customer OPS / admin / liderança).
  function customRow(c) {
    c = c || {};
    if (!podeEditar) {
      const st = STATUS_CUSTOM.find(s => s[0] === c.status) || STATUS_CUSTOM[0];
      return `<div class="pb-linha">🧩 <b>${esc(c.nome || c.jira_key || "Customização")}</b> — ${st[1]}
        ${c.previsao ? ` · 📅 previsão ${dataBR(c.previsao)}` : " · previsão a definir"}
        ${c.obs ? `<br><i>${esc(c.obs)}</i>` : ""}</div>`;
    }
    const sel = STATUS_CUSTOM.map(([id, nome]) =>
      `<option value="${id}" ${c.status === id ? "selected" : ""}>${nome}</option>`).join("");
    return `<div class="ops-cu-row" data-jira="${esc(c.jira_key || "")}">
      <input type="text" class="ops-sel cu-nome" value="${esc(c.nome || "")}" placeholder="Nome da customização">
      <select class="ops-sel cu-status">${sel}</select>
      <input type="date" class="ops-sel cu-prev" value="${esc(c.previsao || "")}" title="Previsão de entrega">
      <input type="text" class="ops-sel cu-obs" value="${esc(c.obs || "")}" placeholder="Observação para o cliente (opcional)">
      <button class="tl-link adm-x cu-rm" type="button" title="Remover">✕</button>
    </div>`;
  }

  /* ---------- Agendas & Horas (apontamento dos implantadores) ---------- */
  const fmtHoras = h => { const n = Number(h) || 0; return n % 1 === 0 ? n + "h" : n.toFixed(1) + "h"; };
  const csatEmoji = m => m >= 4.5 ? "🤩" : m >= 3.5 ? "😊" : m >= 2.5 ? "😐" : "😟";
  const STATUS_AGENDA = {
    pendente:  { txt: "⏳ Aguardando aceite do IS", cls: "warn" },
    aceita:    { txt: "✅ Aceita pelo IS",          cls: "info" },
    recusada:  { txt: "⛔ Recusada",                cls: "bad" },
    realizada: { txt: "📋 Realizada · aguardando OK do cliente", cls: "warn" },
    avaliada:  { txt: "⭐ Avaliada pelo cliente",   cls: "ok" },
  };

  // Convite de calendário: link do Outlook (web) + arquivo .ics para anexar/enviar.
  function linksConvite(a, cliente) {
    const ini = new Date(`${a.data}T${a.hora_inicio || "09:00"}`);
    const fim = new Date(ini.getTime() + (Number(a.horas) || 1) * 3600000);
    const fmtICS = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const titulo = `Implantação Elofy — ${cliente}`;
    const corpo = `Escopo: ${a.escopo}\\nContato no cliente: ${a.contato_cliente || "—"}\\nFormato: ${a.formato}\\nAgenda criada pela Jornada Elofy.`;
    const local = a.formato === "presencial" ? "No cliente (presencial)" : "Remoto (Teams)";
    // Outlook web deep link (abre o compose de evento já preenchido)
    const outlook = "https://outlook.office.com/calendar/0/deeplink/compose?" + new URLSearchParams({
      subject: titulo, body: corpo.replace(/\\n/g, "\n"), location: local,
      startdt: ini.toISOString(), enddt: fim.toISOString(), path: "/calendar/action/compose",
    }).toString();
    // arquivo .ics (padrão iCalendar — funciona em Outlook, Teams e Google)
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Elofy//Jornada//PT-BR", "BEGIN:VEVENT",
      "UID:" + a.id + "@jornada.elofy", "DTSTAMP:" + fmtICS(new Date()),
      "DTSTART:" + fmtICS(ini), "DTEND:" + fmtICS(fim),
      "SUMMARY:" + titulo, "DESCRIPTION:" + corpo, "LOCATION:" + local,
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const icsUrl = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
    return { outlook, icsUrl };
  }

  // Card de uma agenda (no detalhe da implantação).
  function agendaCard(a, cliente) {
    const st = STATUS_AGENDA[a.status] || STATUS_AGENDA.pendente;
    const conv = linksConvite(a, cliente);
    return `<div class="ag-card ${a.status}">
      <div class="ag-head">
        <span class="ag-quando">📅 ${dataBR(a.data)}${a.hora_inicio ? " às " + String(a.hora_inicio).slice(0, 5) : ""}
          · <b>${fmtHoras(a.horas_realizadas != null ? a.horas_realizadas : a.horas)}</b>
          · ${a.formato === "presencial" ? "🏢 presencial" : "💻 remoto"}</span>
        <span class="pp-status ${st.cls}">${st.txt}</span>
      </div>
      <div class="ag-is">👤 IS: <b>${esc(a.is_nome || a.is_email.split("@")[0])}</b>
        ${a.contato_cliente ? ` · recebe: ${esc(a.contato_cliente)}` : ""}</div>
      <div class="ag-escopo">${esc(a.escopo)}</div>
      ${a.motivo_recusa ? `<div class="ag-recusa">⛔ Motivo da recusa: ${esc(a.motivo_recusa)}</div>` : ""}
      ${a.ficha && a.ficha.executado ? `<div class="ag-ficha">📋 <b>Executado:</b> ${esc(a.ficha.executado)}
        ${a.ficha.pendencias ? `<br>⏭ <b>Pendências:</b> ${esc(a.ficha.pendencias)}` : ""}</div>` : ""}
      ${a.nps != null ? `<div class="ag-nps ${a.nps >= 9 ? "otimo" : a.nps >= 7 ? "bom" : "ruim"}">
        ${a.cliente_ok === false ? "🚫 Escopo reprovado pelo cliente · " : "✓ Escopo aprovado · "}
        NPS <b>${a.nps}/10</b>${a.nps_comentario ? ` — “${esc(a.nps_comentario)}”` : ""}</div>` : ""}
      <div class="ag-acoes">
        ${["pendente", "aceita"].includes(a.status) ? `
          <a class="tl-link" href="${conv.outlook}" target="_blank" rel="noopener">📆 Outlook</a>
          <a class="tl-link" href="${conv.icsUrl}" download="agenda-elofy.ics">⬇ Convite .ics</a>` : ""}
        ${a.status === "realizada" ? `<button class="tl-link" data-copiar-aval="${a.public_token}" type="button">🔗 Link de avaliação do cliente</button>` : ""}
      </div>
    </div>`;
  }

  // Seção de agendas + consumo de horas no detalhe da implantação.
  function agendasSection(impl, agendas) {
    const realizadas = agendas.filter(a => ["realizada", "avaliada"].includes(a.status));
    const horasReal = realizadas.reduce((s, a) => s + Number(a.horas_realizadas != null ? a.horas_realizadas : a.horas), 0);
    const horasPrev = agendas.filter(a => ["aceita", "realizada", "avaliada"].includes(a.status))
      .reduce((s, a) => s + Number(a.horas), 0);
    const badge = agendas.length
      ? `<span class="pp-status info">⏱ ${fmtHoras(horasReal)} de ${fmtHoras(horasPrev)} realizadas</span>` : "";
    return `
      <details class="pb-sec" open>
        <summary>⏱ Agendas & horas dos implantadores ${badge}</summary>
        <div class="pb-body">
          ${agendas.length ? `
          <div class="ag-resumo">
            <span><b>${agendas.filter(a => a.status === "pendente").length}</b> aguardando aceite</span>
            <span><b>${agendas.filter(a => a.status === "aceita").length}</b> agendadas</span>
            <span><b>${fmtHoras(horasReal)}</b> realizadas</span>
            <span><b>${agendas.filter(a => a.status === "avaliada").length}</b> avaliadas pelo cliente</span>
          </div>` : `<p style="font-size:12px;color:var(--txt-3)">Nenhuma agenda criada ainda.
            É aqui que medimos o consumo de horas dos implantadores neste projeto.</p>`}
          <div id="agLista">${agendas.map(a => agendaCard(a, impl.cliente)).join("")}</div>
          ${podeEditar ? `
          <div class="ag-novo" id="agNovoForm">
            <div class="pb-grupo-titulo" style="margin-top:14px">+ Nova agenda para um IS</div>
            <div class="ho-grid">
              <label class="ho-f">Implantador (IS)${selectPessoa("agIs", null)}</label>
              <label class="ho-f">Dia<input type="date" id="agData"></label>
              <label class="ho-f">Hora de início<input type="time" id="agHora" value="09:00"></label>
              <label class="ho-f">Horas da agenda<input type="number" id="agHoras" min="0.5" max="24" step="0.5" value="4"></label>
              <label class="ho-f">Formato
                <select id="agFormato"><option value="remoto">💻 Remoto (Teams)</option>
                <option value="presencial">🏢 Presencial (no cliente)</option></select></label>
              <label class="ho-f">Quem recebe o IS no cliente<input type="text" id="agContato" placeholder="ex.: Maria (RH) — (11) 99999-0000"></label>
            </div>
            <label class="ho-f">Escopo macro da agenda
              <textarea id="agEscopo" placeholder="ex.: Configurar o ciclo de avaliação e treinar os admins do RH"></textarea></label>
            <button class="btn" id="agCriar" type="button" style="padding:8px 16px">📅 Criar agenda e gerar convite</button>
            <p style="font-size:11px;color:var(--txt-3);margin-top:8px">
              O IS recebe uma notificação no sistema e o botão de convite Outlook/.ics para colocar na agenda dele.
              Ele precisa <b>aceitar</b> a agenda pelo sistema (em "📅 Minhas agendas").</p>
          </div>` : ""}
        </div>
      </details>`;
  }

  // CSAT por fase: como o cliente está avaliando a jornada.
  function csatSection(impl) {
    const csat = impl.csat || {};
    const notas = Object.entries(csat);
    if (!notas.length) return `
      <details class="pb-sec"><summary>💜 CSAT do cliente por fase <span class="pp-status wait">sem respostas ainda</span></summary>
        <div class="pb-body"><p style="font-size:12px;color:var(--txt-3)">
          O cliente avalia cada fase concluída diretamente na página de acompanhamento dele.
          As respostas aparecem aqui — cliente no centro, sempre. 💜</p></div>
      </details>`;
    const media = notas.reduce((s, [, n]) => s + n, 0) / notas.length;
    return `
      <details class="pb-sec" open>
        <summary>💜 CSAT do cliente por fase
          <span class="pp-status ${media >= 4 ? "ok" : media >= 3 ? "warn" : "bad"}">${csatEmoji(media)} média ${media.toFixed(1)}/5</span></summary>
        <div class="pb-body">
          <div class="csat-grid">
            ${ETAPAS.map(e => {
              const nota = csat[e.id];
              if (nota == null) return `<div class="csat-item vazio"><span>${e.nome}</span><b>—</b></div>`;
              return `<div class="csat-item ${nota >= 4 ? "ok" : nota >= 3 ? "warn" : "bad"}">
                <span>${e.nome}</span><b>${csatEmoji(nota)} ${nota}/5</b></div>`;
            }).join("")}
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
    let updates = [], agendas = [];
    try { updates = await store().opsUpdates(id); } catch (e) { /* segue com timeline vazia */ }
    try { agendas = await store().agendaListar(id); } catch (e) { /* sem agendas não é erro fatal */ }

    const s = SAUDE[impl.saude] || SAUDE.ok;
    const linkCliente = location.href.replace(/[^/]*(\?.*)?(#.*)?$/, "") + "acompanhamento.html?t=" + impl.public_token;

    body.innerHTML = `
      <div class="ho-head"><h2>🚀 ${esc(impl.cliente)}</h2>
        <span class="pp-status ${s.cls}">${s.txt}</span></div>
      ${escalonamentoAlerta(impl)}
      ${bannerAceite(impl)}
      ${stepper(impl.etapa, impl.tempos_etapas)}
      <div class="ops-meta" style="margin:10px 0 16px">
        <span>📅 início ${dataBR(impl.inicio)} · ${impl.dias_corridos}d corridos</span>
        <span>🎯 go-live previsto ${dataBR(impl.previsao_golive)}</span>
        ${impl.golive_em ? `<span>🚀 go-live em ${dataBR(impl.golive_em)}</span>` : ""}
      </div>

      ${playbookViewer(impl)}
      ${discoverySection(impl)}
      ${agendasSection(impl, agendas)}
      ${csatSection(impl)}
      ${customsSection(impl)}
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

    // ----- Customs: status e previsão de entrega (visíveis para o cliente) -----
    const btnAddCustom = $("#opsAddCustom");
    if (btnAddCustom) {
      const ligarRemover = () => document.querySelectorAll(".cu-rm").forEach(b => {
        if (b.dataset.ligado) return;
        b.dataset.ligado = "1";
        b.addEventListener("click", () => b.closest(".ops-cu-row").remove());
      });
      ligarRemover();
      btnAddCustom.addEventListener("click", () => {
        const lista = $("#opsCustomsLista");
        const vazio = lista.querySelector(".ops-cu-vazio");
        if (vazio) vazio.remove();
        lista.insertAdjacentHTML("beforeend", customRow({ status: "nao_iniciada" }));
        ligarRemover();
      });
      $("#opsSalvarCustoms").addEventListener("click", async () => {
        const msg = $("#opsMsg");
        const customs = Array.from(document.querySelectorAll(".ops-cu-row")).map(r => ({
          nome: r.querySelector(".cu-nome").value.trim(),
          jira_key: r.dataset.jira || null,
          status: r.querySelector(".cu-status").value,
          previsao: r.querySelector(".cu-prev").value || null,
          obs: r.querySelector(".cu-obs").value.trim() || null,
        })).filter(c => c.nome || c.jira_key);
        try {
          if (msg) { msg.textContent = "Salvando customs…"; msg.className = "ho-msg"; }
          await store().opsAtualizarCustoms(id, customs);
          cache = await store().opsListar();
          renderKpis(); renderLista();
          abrirDetalhe(id);
        } catch (e) {
          if (msg) { msg.textContent = "Erro: " + (e.message || e); msg.className = "ho-msg bad"; }
        }
      });
    }

    // ----- Agendas: criar nova + copiar link de avaliação do cliente -----
    const btnAgCriar = $("#agCriar");
    if (btnAgCriar) {
      btnAgCriar.addEventListener("click", async () => {
        const msg = $("#opsMsg");
        const payload = {
          is_email: $("#agIs").value || null,
          data: $("#agData").value || null,
          hora_inicio: $("#agHora").value || null,
          horas: Number($("#agHoras").value) || 0,
          formato: $("#agFormato").value,
          contato_cliente: $("#agContato").value.trim() || null,
          escopo: $("#agEscopo").value.trim(),
        };
        if (!payload.is_email || !payload.data || !payload.horas || !payload.escopo) {
          if (msg) { msg.textContent = "Preencha IS, dia, horas e escopo da agenda."; msg.className = "ho-msg bad"; }
          return;
        }
        try {
          if (msg) { msg.textContent = "Criando agenda…"; msg.className = "ho-msg"; }
          await store().agendaCriar(id, payload);
          cache = await store().opsListar();
          renderKpis(); renderLista();
          abrirDetalhe(id);
        } catch (e) {
          if (msg) { msg.textContent = "Erro: " + (e.message || e); msg.className = "ho-msg bad"; }
        }
      });
    }
    document.querySelectorAll("[data-copiar-aval]").forEach(btn =>
      btn.addEventListener("click", () => {
        const url = location.href.replace(/[^/]*(\?.*)?(#.*)?$/, "") +
          "acompanhamento.html?t=" + impl.public_token + "#avaliar";
        navigator.clipboard.writeText(url).then(
          () => { btn.textContent = "✓ Copiado!"; setTimeout(() => btn.textContent = "🔗 Link de avaliação do cliente", 1500); },
          () => window.prompt("Copie:", url));
      }));
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

  /* ---------- Minhas agendas (visão do implantador / IS) ---------- */
  async function minhasAgendas() {
    const ov = $("#agendasOverlay");
    ov.classList.remove("hide");
    const body = $("#agendasBody");
    body.innerHTML = `<p style="color:var(--txt-3)">Carregando…</p>`;
    let agendas = [];
    try { agendas = await store().agendaMinhas(); }
    catch (e) { body.innerHTML = `<p class="ho-msg bad">Erro: ${esc(e.message || e)}</p>`; return; }

    if (!agendas.length) {
      body.innerHTML = `<p style="color:var(--txt-3);font-size:13px">Você não tem agendas no momento.
        Quando o responsável por um projeto criar uma agenda para você, ela aparece aqui
        para você <b>aceitar, ajustar ou recusar</b>.</p>`;
      return;
    }
    body.innerHTML = `
      <p style="font-size:12px;color:var(--txt-3);margin-bottom:14px">
        Aceite a agenda para confirmar o atendimento. Você pode <b>ajustar</b> (se o cliente pediu
        mudança direto pra você) ou <b>recusar</b>. Depois do atendimento, preencha a
        <b>ficha do trabalho executado</b> — o cliente dá o OK e avalia com NPS.</p>
      ${agendas.map(a => minhaAgendaCard(a)).join("")}`;
    ligarMinhasAgendas(agendas);
  }

  function minhaAgendaCard(a) {
    const st = STATUS_AGENDA[a.status] || STATUS_AGENDA.pendente;
    const conv = linksConvite(a, a.cliente);
    const podeAgir = ["pendente", "aceita"].includes(a.status);
    return `<div class="ag-card minha ${a.status}" data-ag="${a.id}">
      <div class="ag-head">
        <span class="ag-cliente">🚀 ${esc(a.cliente)}</span>
        <span class="pp-status ${st.cls}">${st.txt}</span>
      </div>
      <div class="ag-quando">📅 <b>${dataBR(a.data)}</b>${a.hora_inicio ? " às " + String(a.hora_inicio).slice(0, 5) : ""}
        · ${fmtHoras(a.horas)} · ${a.formato === "presencial" ? "🏢 presencial" : "💻 remoto"}
        ${a.contato_cliente ? ` · recebe: ${esc(a.contato_cliente)}` : ""}</div>
      <div class="ag-escopo">${esc(a.escopo)}</div>
      ${a.motivo_recusa ? `<div class="ag-recusa">⛔ Você recusou: ${esc(a.motivo_recusa)}</div>` : ""}
      ${a.ficha && a.ficha.executado ? `<div class="ag-ficha">📋 <b>Sua ficha:</b> ${esc(a.ficha.executado)}</div>` : ""}
      ${a.nps != null ? `<div class="ag-nps ${a.nps >= 9 ? "otimo" : a.nps >= 7 ? "bom" : "ruim"}">
        Cliente avaliou: <b>NPS ${a.nps}/10</b>${a.nps_comentario ? ` — “${esc(a.nps_comentario)}”` : ""}</div>` : ""}

      <div class="ag-acoes">
        ${a.status === "pendente" ? `
          <button class="btn ag-aceitar" type="button" style="padding:7px 14px">✅ Aceitar agenda</button>
          <button class="btn ghost ag-recusar" type="button" style="padding:7px 14px">⛔ Recusar</button>` : ""}
        ${a.status === "aceita" ? `
          <button class="btn ag-ficha-btn" type="button" style="padding:7px 14px">📋 Preencher ficha do atendimento</button>` : ""}
        ${podeAgir ? `
          <button class="tl-link ag-editar" type="button">✏️ Ajustar agenda</button>
          <a class="tl-link" href="${conv.outlook}" target="_blank" rel="noopener">📆 Outlook</a>
          <a class="tl-link" href="${conv.icsUrl}" download="agenda-elofy.ics">⬇ .ics</a>` : ""}
      </div>

      ${podeAgir ? `
      <div class="ag-form hide ag-form-editar">
        <div class="ho-grid">
          <label class="ho-f">Dia<input type="date" class="agE-data" value="${esc(a.data)}"></label>
          <label class="ho-f">Hora<input type="time" class="agE-hora" value="${esc(String(a.hora_inicio || "09:00").slice(0, 5))}"></label>
          <label class="ho-f">Horas<input type="number" class="agE-horas" min="0.5" max="24" step="0.5" value="${esc(a.horas)}"></label>
          <label class="ho-f">Formato<select class="agE-formato">
            <option value="remoto" ${a.formato !== "presencial" ? "selected" : ""}>💻 Remoto</option>
            <option value="presencial" ${a.formato === "presencial" ? "selected" : ""}>🏢 Presencial</option></select></label>
        </div>
        <label class="ho-f">Escopo<textarea class="agE-escopo">${esc(a.escopo)}</textarea></label>
        <button class="btn ghost ag-salvar-edicao" type="button" style="padding:7px 14px">Salvar ajustes</button>
      </div>
      <div class="ag-form hide ag-form-ficha">
        <label class="ho-f">O que foi executado no atendimento? *
          <textarea class="agF-executado" placeholder="Descreva o trabalho realizado, decisões tomadas, o que foi configurado/treinado…"></textarea></label>
        <label class="ho-f">Pendências / próximos passos
          <textarea class="agF-pendencias" placeholder="O que ficou pendente, com quem e para quando"></textarea></label>
        <label class="ho-f">Horas efetivamente trabalhadas
          <input type="number" class="agF-horas" min="0.5" max="24" step="0.5" value="${esc(a.horas)}"></label>
        <button class="btn ag-salvar-ficha" type="button" style="padding:8px 16px">📋 Registrar atendimento realizado</button>
        <p style="font-size:11px;color:var(--txt-3);margin-top:6px">Depois disso o cliente recebe o resumo para dar OK no escopo e avaliar com NPS.</p>
      </div>` : ""}
      <p class="ho-msg ag-msg"></p>
    </div>`;
  }

  function ligarMinhasAgendas(agendas) {
    document.querySelectorAll(".ag-card.minha").forEach(card => {
      const id = card.dataset.ag;
      const msg = card.querySelector(".ag-msg");
      const erro = e => { msg.textContent = "Erro: " + (e.message || e); msg.className = "ho-msg bad ag-msg"; };
      const recarrega = async () => { await atualizarBadgeAgendas(); minhasAgendas(); };

      const aceitar = card.querySelector(".ag-aceitar");
      if (aceitar) aceitar.addEventListener("click", async () => {
        try { msg.textContent = "Aceitando…"; await store().agendaAceitar(id); recarrega(); } catch (e) { erro(e); }
      });
      const recusar = card.querySelector(".ag-recusar");
      if (recusar) recusar.addEventListener("click", async () => {
        const motivo = window.prompt("Qual o motivo da recusa? (o responsável pelo projeto será avisado)");
        if (!motivo) return;
        try { msg.textContent = "Recusando…"; await store().agendaRecusar(id, motivo); recarrega(); } catch (e) { erro(e); }
      });
      const editar = card.querySelector(".ag-editar");
      if (editar) editar.addEventListener("click", () => {
        card.querySelector(".ag-form-editar").classList.toggle("hide");
        card.querySelector(".ag-form-ficha").classList.add("hide");
      });
      const fichaBtn = card.querySelector(".ag-ficha-btn");
      if (fichaBtn) fichaBtn.addEventListener("click", () => {
        card.querySelector(".ag-form-ficha").classList.toggle("hide");
        const fe = card.querySelector(".ag-form-editar"); if (fe) fe.classList.add("hide");
      });
      const salvarEd = card.querySelector(".ag-salvar-edicao");
      if (salvarEd) salvarEd.addEventListener("click", async () => {
        try {
          msg.textContent = "Salvando…";
          await store().agendaEditar(id, {
            data: card.querySelector(".agE-data").value || null,
            hora_inicio: card.querySelector(".agE-hora").value || null,
            horas: card.querySelector(".agE-horas").value || null,
            formato: card.querySelector(".agE-formato").value,
            escopo: card.querySelector(".agE-escopo").value.trim() || null,
          });
          recarrega();
        } catch (e) { erro(e); }
      });
      const salvarFicha = card.querySelector(".ag-salvar-ficha");
      if (salvarFicha) salvarFicha.addEventListener("click", async () => {
        const executado = card.querySelector(".agF-executado").value.trim();
        if (!executado) { erro(new Error("Descreva o que foi executado.")); return; }
        try {
          msg.textContent = "Registrando…";
          await store().agendaRegistrarExecucao(id, {
            executado, pendencias: card.querySelector(".agF-pendencias").value.trim() || null,
          }, Number(card.querySelector(".agF-horas").value) || null);
          recarrega();
        } catch (e) { erro(e); }
      });
    });
  }

  // Badge do botão "📅 Minhas agendas" no header (quantas aguardam aceite).
  async function atualizarBadgeAgendas() {
    try {
      const agendas = await store().agendaMinhas();
      const pendentes = agendas.filter(a => a.status === "pendente").length;
      const badge = $("#agendasBadge");
      if (badge) {
        badge.textContent = String(pendentes);
        badge.classList.toggle("hide", pendentes === 0);
      }
    } catch (_) { /* sem agendas não é erro */ }
  }

  // fechar overlay
  document.addEventListener("DOMContentLoaded", () => {
    const x = $("#opsFechar"); if (x) x.addEventListener("click", () => $("#opsOverlay").classList.add("hide"));
    const ov = $("#opsOverlay");
    if (ov) ov.addEventListener("click", e => { if (e.target === ov) ov.classList.add("hide"); });
    // minhas agendas (visão do IS)
    const ax = $("#agendasFechar"); if (ax) ax.addEventListener("click", () => $("#agendasOverlay").classList.add("hide"));
    const aov = $("#agendasOverlay");
    if (aov) aov.addEventListener("click", e => { if (e.target === aov) aov.classList.add("hide"); });
    const btnAg = $("#btnAgendas"); if (btnAg) btnAg.addEventListener("click", minhasAgendas);
  });

  global.JornadaOps = { montar, abrirDetalhe, minhasAgendas, atualizarBadgeAgendas };
})(window);
