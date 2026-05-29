/* ============================================================================
 *  TABELA DE PREÇOS POR FAIXA DE USUÁRIOS  ·  ELOFY
 *  ----------------------------------------------------------------------------
 *  Fonte: Política Comercial Elofy 2025 v5 — aba "Tabela de Preços".
 *  Preço UNITÁRIO por usuário/mês (sem impostos), regressivo por faixa.
 *
 *  Colunas por composição de módulos:
 *    completos   = Metas + Engajamento + Desempenho (a partir de 2/3 módulos)
 *    desempenho  = só Desempenho
 *    engajamento = só Engajamento
 *    metas       = só Metas
 *
 *  Para alterar preços: edite os números. A faixa é escolhida pelo nº de
 *  usuários (de ≤ usuários ≤ ate).
 * ========================================================================== */
window.ELOFY_TABELA_PRECOS = [
  { porte:"PP", de:1, ate:50, completos:39.63, desempenho:19.81, engajamento:16.42, metas:16.42 },
  { porte:"P", de:51, ate:100, completos:29.72, desempenho:14.86, engajamento:13.68, metas:13.68 },
  { porte:"M", de:101, ate:150, completos:14.86, desempenho:11.145, engajamento:10.26, metas:10.26 },
  { porte:"M", de:151, ate:200, completos:12.631, desempenho:10.81065, engajamento:9.9522, metas:9.9522 },
  { porte:"M", de:201, ate:250, completos:12.25207, desempenho:10.48633, engajamento:9.653634, metas:9.653634 },
  { porte:"M", de:251, ate:300, completos:11.884508, desempenho:10.171741, engajamento:9.364025, metas:9.364025 },
  { porte:"M", de:301, ate:350, completos:11.765663, desempenho:10.070023, engajamento:9.270385, metas:9.270385 },
  { porte:"M", de:351, ate:400, completos:11.412693, desempenho:9.767922, engajamento:8.992273, metas:8.992273 },
  { porte:"M", de:401, ate:450, completos:11.070312, desempenho:9.474885, engajamento:8.722505, metas:8.722505 },
  { porte:"M", de:451, ate:500, completos:10.959609, desempenho:9.380136, engajamento:8.63528, metas:8.63528 },
  { porte:"G", de:501, ate:550, completos:10.630821, desempenho:9.098732, engajamento:8.376222, metas:8.376222 },
  { porte:"G", de:551, ate:600, completos:10.524513, desempenho:9.007745, engajamento:8.292459, metas:8.292459 },
  { porte:"G", de:601, ate:650, completos:10.208777, desempenho:8.737512, engajamento:8.043686, metas:8.043686 },
  { porte:"G", de:651, ate:700, completos:10.106689, desempenho:8.650137, engajamento:7.963249, metas:7.963249 },
  { porte:"G", de:701, ate:750, completos:9.803489, desempenho:8.390633, engajamento:7.724351, metas:7.724351 },
  { porte:"G", de:751, ate:800, completos:9.705454, desempenho:8.306727, engajamento:7.647108, metas:7.647108 },
  { porte:"G", de:801, ate:850, completos:9.41429, desempenho:8.057525, engajamento:7.417694, metas:7.417694 },
  { porte:"G", de:851, ate:900, completos:9.320147, desempenho:7.97695, engajamento:7.343518, metas:7.343518 },
  { porte:"G", de:901, ate:950, completos:9.040543, desempenho:7.737641, engajamento:7.123212, metas:7.123212 },
  { porte:"G", de:951, ate:1000, completos:8.950137, desempenho:7.660265, engajamento:7.05198, metas:7.05198 },
  { porte:"G", de:1001, ate:1500, completos:8.502631, desempenho:7.277251, engajamento:6.699381, metas:6.699381 },
  { porte:"G", de:1501, ate:2000, completos:8.417604, desempenho:7.204479, engajamento:6.632387, metas:6.632387 },
  { porte:"G", de:2001, ate:2500, completos:7.996724, desempenho:6.844255, engajamento:6.300768, metas:6.300768 },
  { porte:"G", de:2501, ate:3000, completos:7.916757, desempenho:6.775812, engajamento:6.23776, metas:6.23776 },
  { porte:"G", de:3001, ate:3500, completos:7.520919, desempenho:6.437022, engajamento:5.925872, metas:5.925872 },
  { porte:"G", de:3501, ate:4000, completos:7.44571, desempenho:6.372652, engajamento:5.866613, metas:5.866613 },
  { porte:"G", de:4001, ate:4500, completos:7.073424, desempenho:6.054019, engajamento:5.573283, metas:5.573283 },
  { porte:"G", de:4501, ate:5000, completos:7.00269, desempenho:5.993479, engajamento:5.51755, metas:5.51755 },
  { porte:"E", de:5001, ate:6000, completos:6.582529, desempenho:5.63387, engajamento:5.186497, metas:5.186497 },
  { porte:"E", de:6001, ate:7000, completos:6.187577, desempenho:5.295838, engajamento:4.875307, metas:4.875307 },
  { porte:"E", de:7001, ate:8000, completos:5.816322, desempenho:4.978088, engajamento:4.582789, metas:4.582789 },
  { porte:"E", de:8001, ate:9000, completos:5.467343, desempenho:4.679402, engajamento:4.307821, metas:4.307821 },
  { porte:"E", de:9001, ate:10000, completos:5.139302, desempenho:4.398638, engajamento:4.049352, metas:4.049352 },
  { porte:"E", de:10001, ate:12000, completos:4.728158, desempenho:4.046747, engajamento:3.725404, metas:3.725404 },
  { porte:"E", de:12001, ate:14000, completos:4.349906, desempenho:3.723007, engajamento:3.427372, metas:3.427372 },
  { porte:"E", de:14001, ate:16000, completos:4.001913, desempenho:3.425167, engajamento:3.153182, metas:3.153182 },
  { porte:"E", de:16001, ate:18000, completos:3.68176, desempenho:3.151153, engajamento:2.900927, metas:2.900927 },
  { porte:"E", de:18001, ate:20000, completos:3.387219, desempenho:2.899061, engajamento:2.668853, metas:2.668853 },
];
