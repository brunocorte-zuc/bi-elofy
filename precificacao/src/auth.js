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
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
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
    });
    if (error) throw error;
    return data; // { id, versao }
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
    });
    if (error) throw error;
    return data; // { id, versao }
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
    login, logout,
    perfil: () => perfilCache,
    salvarProposta, atualizarProposta, historicoProposta,
    listarPropostas, carregarConfig, buscarNegocios, buscarCustoms,
  };
})(window);
