/* ============================================================================
 *  CONFIGURAÇÃO SUPABASE  ·  Formação de Preço
 *  ----------------------------------------------------------------------------
 *  A chave "publishable" é pública por design — é seguro deixá-la no código.
 *  A segurança NÃO depende dela: o schema `pricing` não é exposto à API e o
 *  acesso é controlado por autenticação (magic link) + allowlist + RLS no banco.
 *
 *  Para autorizar um novo usuário: adicione o e-mail em
 *  pricing.usuarios_permitidos (papel: closer|gestor|diretor|admin).
 * ========================================================================== */
window.SUPABASE_CONFIG = {
  url: "https://ctdqizsaajdovclltxgr.supabase.co",
  publishableKey: "sb_publishable_jjyCs0e7tdlwcp9cyOw9nA_AmYH3AcI",
};
