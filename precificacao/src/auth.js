/* ============================================================================
 *  AUTENTICAÇÃO + PERSISTÊNCIA  ·  Formação de Preço
 *  ----------------------------------------------------------------------------
 *  Login por magic link (Supabase Auth). Sem senha armazenada em lugar algum.
 *  Após login, o acesso ainda depende da allowlist no banco (RLS/RPC).
 *
 *  Expõe window.PricingStore com:
 *    init(), onChange(cb), login(email), logout(),
 *    perfil(), salvarProposta(payload), listarPropostas(limit)
 * ========================================================================== */
(function (global) {
  "use strict";

  const cfg = global.SUPABASE_CONFIG || {};
  let sb = null;          // cliente supabase
  let perfilCache = null; // { email, papel, autorizado }
  const listeners = [];

  function disponivel() {
    return !!(global.supabase && cfg.url && cfg.publishableKey);
  }

  function emit() { listeners.forEach(cb => { try { cb(estado()); } catch (e) {} }); }

  function estado() {
    return {
      disponivel: disponivel(),
      logado: !!(perfilCache && perfilCache.email),
      autorizado: !!(perfilCache && perfilCache.autorizado),
      perfil: perfilCache,
    };
  }

  async function init() {
    if (!disponivel()) { emit(); return; }
    sb = global.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: {
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
        // 'implicit': o token vem no #hash do link. Funciona quando o e-mail é
        // aberto em OUTRO navegador/webview (caso comum no celular). O 'pkce'
        // (padrão) exige o mesmo navegador que pediu o link e quebra no mobile.
        flowType: "implicit",
      },
    });
    const { data } = await sb.auth.getSession();
    if (data && data.session) await carregarPerfil();
    sb.auth.onAuthStateChange(async (_evt, session) => {
      if (session) await carregarPerfil(); else perfilCache = null;
      emit();
    });
    emit();
  }

  async function carregarPerfil() {
    try {
      const { data, error } = await sb.rpc("pricing_meu_perfil");
      if (error) throw error;
      perfilCache = Array.isArray(data) ? data[0] : data;
    } catch (e) {
      perfilCache = { email: null, papel: null, autorizado: false };
    }
  }

  async function login(email) {
    if (!disponivel()) throw new Error("Supabase não configurado.");
    const { error } = await sb.auth.signInWithOtp({
      email: (email || "").trim(),
      options: { emailRedirectTo: global.location.href.split("#")[0] },
    });
    if (error) throw error;
    return true;
  }

  // Login por SENHA (temporário, para testes enquanto o SMTP não está pronto).
  async function loginSenha(email, senha) {
    if (!disponivel()) throw new Error("Supabase não configurado.");
    const { error } = await sb.auth.signInWithPassword({
      email: (email || "").trim(), password: (senha || ""),
    });
    if (error) throw error;
    return true;
  }

  // Login pelo CÓDIGO de 6 dígitos enviado por e-mail. Não depende de clicar no
  // link (logo, imune ao SafeLinks do Outlook, que "consome" o link) e funciona
  // em qualquer navegador/celular.
  async function verificarCodigo(email, codigo) {
    if (!disponivel()) throw new Error("Supabase não configurado.");
    const { error } = await sb.auth.verifyOtp({
      email: (email || "").trim(),
      token: (codigo || "").trim(),
      type: "email",
    });
    if (error) throw error;
    return true;
  }

  async function logout() {
    if (sb) await sb.auth.signOut();
    perfilCache = null; emit();
  }

  async function salvarProposta(p) {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_salvar_proposta", {
      p_cliente: p.cliente, p_produto: p.produto, p_usuarios: p.usuarios,
      p_desconto_pct: p.descontoPct, p_mrr_com_imposto: p.mrr,
      p_nr_com_imposto: p.nr, p_global_com_imposto: p.global,
      p_aprovacao_papel: p.aprovacaoPapel, p_excede_autonomia: p.excedeAutonomia,
      p_entrada: p.entrada, p_resultado: p.resultado,
      p_bitrix_id: p.bitrixId, p_bitrix_nome: p.bitrixNome,
      p_customs: p.customs || [], p_custom_no_mrr: !!p.customNoMrr, p_custom_total: p.customTotal || 0,
      p_snapshot: p.snapshot || null,
    });
    if (error) throw error;
    return data; // { id, versao, public_token }
  }

  // Atualiza uma proposta existente (mesma versão), por id.
  async function atualizarProposta(id, p) {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_atualizar_proposta", {
      p_id: id, p_cliente: p.cliente, p_usuarios: p.usuarios,
      p_desconto_pct: p.descontoPct, p_mrr_com_imposto: p.mrr,
      p_nr_com_imposto: p.nr, p_global_com_imposto: p.global,
      p_aprovacao_papel: p.aprovacaoPapel, p_excede_autonomia: p.excedeAutonomia,
      p_entrada: p.entrada, p_resultado: p.resultado,
      p_customs: p.customs || [], p_custom_no_mrr: !!p.customNoMrr, p_custom_total: p.customTotal || 0,
      p_snapshot: p.snapshot || null,
    });
    if (error) throw error;
    return data; // { id, versao, public_token }
  }

  // Histórico de versões de uma oportunidade (bitrix_id), com delta de valor.
  async function historicoProposta(bitrixId) {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_historico_proposta", { p_bitrix_id: bitrixId });
    if (error) throw error;
    return data || [];
  }

  async function listarPropostas(limit) {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_listar_propostas", { p_limit: limit || 100 });
    if (error) throw error;
    return data || [];
  }

  // Perfil do usuário logado (e-mail + papel + flags de visibilidade).
  async function meuPerfil() {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_meu_perfil");
    if (error) throw error;
    return data || {};
  }

  // Pode dar ganho? (gate: negócio precisa estar GANHO no Bitrix)
  async function podeDarGanho(propostaId) {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_pode_dar_ganho", { p_proposta_id: propostaId });
    if (error) throw error;
    return data || {};
  }

  // Registra o handoff (dar ganho). payload = dados do formulário.
  async function registrarHandoff(propostaId, payload) {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_registrar_handoff", {
      p_proposta_id: propostaId, p_payload: payload,
    });
    if (error) throw error;
    return data || {};
  }

  async function listarHandoffs(limit) {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_listar_handoffs", { p_limit: limit || 100 });
    if (error) throw error;
    return data || [];
  }

  // Upload do contrato para o bucket privado. Devolve o caminho (path) salvo.
  async function uploadContrato(bitrixId, file) {
    if (!sb) throw new Error("Sessão não iniciada.");
    const safe = (file.name || "contrato").replace(/[^\w.\-]+/g, "_");
    const path = `${bitrixId || "sem-bitrix"}/${Date.now()}_${safe}`;
    const { error } = await sb.storage.from("contratos").upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  }

  // URL assinada temporária para baixar um contrato (bucket é privado).
  async function urlContrato(path, segundos) {
    if (!sb || !path) return null;
    const { data, error } = await sb.storage.from("contratos").createSignedUrl(path, segundos || 3600);
    if (error) throw error;
    return data ? data.signedUrl : null;
  }

  // Toda a configuração de preço (tabela, packs, PA, serviços, autonomia,
  // parâmetros) — só retorna para usuário autorizado. Vem do banco, nunca
  // do código estático, para não expor custos/margens em site público.
  async function carregarConfig() {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_config");
    if (error) throw error;
    return data;
  }

  // Busca negócios do Bitrix (via public.negocios, alimentada pelo n8n).
  async function buscarNegocios(busca, limit) {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_buscar_negocios", {
      p_busca: busca, p_limit: limit || 20,
    });
    if (error) throw error;
    return data || [];
  }

  // Customs (Jira/PDMC) ELEGÍVEIS para um negócio/cliente, já com valor.
  async function buscarCustoms(bitrixId, cliente) {
    if (!sb) throw new Error("Sessão não iniciada.");
    const { data, error } = await sb.rpc("pricing_customs_elegiveis", {
      p_bitrix_id: bitrixId || null, p_cliente: cliente || null,
    });
    if (error) throw error;
    return data || [];
  }

  global.PricingStore = {
    init, estado, disponivel,
    onChange: cb => { listeners.push(cb); },
    login, verificarCodigo, loginSenha, logout,
    perfil: () => perfilCache,
    salvarProposta, atualizarProposta, historicoProposta,
    listarPropostas, carregarConfig, buscarNegocios, buscarCustoms,
    meuPerfil, podeDarGanho, registrarHandoff, listarHandoffs, uploadContrato, urlContrato,
  };
})(window);
