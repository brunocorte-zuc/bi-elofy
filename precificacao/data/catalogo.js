/* ============================================================================
 *  CATÁLOGO DE MÓDULOS / PRODUTOS  ·  HR TECH
 *  ----------------------------------------------------------------------------
 *  ⚠️  DADOS DE EXEMPLO — substitua pelos módulos e valores reais.
 *
 *  Campos de cada item:
 *    id            (texto único, sem espaços)
 *    nome          (rótulo exibido)
 *    categoria     (agrupador livre: "Core", "Add-on", "Serviço"...)
 *    cobranca      "por_colaborador" | "fixo_mensal" | "unica"
 *                     - por_colaborador → preço × nº de colaboradores / mês
 *                     - fixo_mensal     → valor fixo recorrente / mês
 *                     - unica           → cobrança única (implantação/setup)
 *    preco_lista   preço de tabela (R$) na unidade da cobrança
 *    custo_unit    custo interno (R$) na mesma unidade — usado p/ margem
 *    piso          menor preço aceitável (R$) — abaixo dispara ALERTA
 *    ativo         true/false (false = some do simulador sem apagar o cadastro)
 * ========================================================================== */
window.PRECIFICACAO_CATALOGO = [
  // ---- Plataforma base (recorrente por colaborador) ----
  { id: "core_hr",      nome: "Core HR (Cadastro & Ponto)", categoria: "Core",
    cobranca: "por_colaborador", preco_lista: 18.00, custo_unit: 6.50, piso: 12.00, ativo: true },

  { id: "folha",        nome: "Folha de Pagamento",         categoria: "Core",
    cobranca: "por_colaborador", preco_lista: 14.00, custo_unit: 5.00, piso: 9.00,  ativo: true },

  // ---- Add-ons (recorrente por colaborador) ----
  { id: "recrutamento", nome: "Recrutamento & Seleção",     categoria: "Add-on",
    cobranca: "por_colaborador", preco_lista: 9.00,  custo_unit: 2.80, piso: 6.00,  ativo: true },

  { id: "desempenho",   nome: "Gestão de Desempenho",       categoria: "Add-on",
    cobranca: "por_colaborador", preco_lista: 8.00,  custo_unit: 2.40, piso: 5.00,  ativo: true },

  { id: "clima",        nome: "Pesquisa de Clima",          categoria: "Add-on",
    cobranca: "por_colaborador", preco_lista: 5.00,  custo_unit: 1.50, piso: 3.00,  ativo: true },

  // ---- Recorrente fixo (independe de nº de colaboradores) ----
  { id: "bi",           nome: "BI / People Analytics",      categoria: "Add-on",
    cobranca: "fixo_mensal", preco_lista: 1200.00, custo_unit: 350.00, piso: 800.00, ativo: true },

  // ---- Cobrança única (setup) ----
  { id: "implantacao",  nome: "Implantação & Migração",     categoria: "Serviço",
    cobranca: "unica", preco_lista: 6000.00, custo_unit: 2200.00, piso: 3500.00, ativo: true },

  { id: "treinamento",  nome: "Treinamento da Equipe",      categoria: "Serviço",
    cobranca: "unica", preco_lista: 2500.00, custo_unit: 900.00,  piso: 1500.00, ativo: true },
];
