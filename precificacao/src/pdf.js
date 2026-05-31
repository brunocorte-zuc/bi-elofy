/* ============================================================================
 *  GERADOR DE PROPOSTA EM PDF  ·  ELOFY
 *  ----------------------------------------------------------------------------
 *  Monta uma proposta comercial caprichada e dispara a IMPRESSÃO NATIVA do
 *  navegador (Salvar como PDF). Sem bibliotecas, sem dependências — texto
 *  vetorial, nítido e offline.
 *
 *  Mostra ao cliente APENAS valores de venda (mensalidade, setup, customs,
 *  investimento total). Nunca expõe custos, margens, piso ou autonomia.
 *
 *  Logo: tipográfico provisório (marca "elofy" + tagline). Trocar por asset
 *  oficial depois é só editar window.PricingPDF.LOGO_SVG abaixo.
 * ========================================================================== */
(function (global) {
  "use strict";

  const brl = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hojeExtenso = () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  // Logo tipográfico provisório (SVG vetorial — escala sem perder qualidade).
  const LOGO_SVG = `
    <svg width="150" height="46" viewBox="0 0 150 46" xmlns="http://www.w3.org/2000/svg" aria-label="elofy">
      <text x="0" y="34" font-family="'Outfit',sans-serif" font-size="38" font-weight="700" letter-spacing="-1.5">
        <tspan fill="#1C2030">elof</tspan><tspan fill="#7C6FFF">y</tspan>
      </text>
      <circle cx="139" cy="12" r="5" fill="#7C6FFF"/>
    </svg>`;

  /* ---- HTML da proposta ---- */
  function montarHtml(d) {
    const itensRec = (d.recorrente || []).filter(i => i.valor > 0);
    const itensNr  = (d.naoRecorrente || []).filter(i => i.valor > 0);

    const linha = i => `<tr><td>${esc(i.nome)}</td><td class="r mono">${brl(i.valor)}</td></tr>`;

    const blocoRec = itensRec.length ? `
      <table class="items">
        <thead><tr><th>Solução recorrente</th><th class="r">Mensal</th></tr></thead>
        <tbody>${itensRec.map(linha).join("")}
          <tr class="sub"><td>Mensalidade</td><td class="r mono">${brl(d.mrr)}</td></tr>
        </tbody>
      </table>` : "";

    const blocoNr = itensNr.length ? `
      <table class="items">
        <thead><tr><th>Implantação & serviços (único)</th><th class="r">Valor</th></tr></thead>
        <tbody>${itensNr.map(linha).join("")}
          <tr class="sub"><td>Total não recorrente</td><td class="r mono">${brl(d.nr)}</td></tr>
        </tbody>
      </table>` : "";

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Proposta Elofy — ${esc(d.cliente)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  :root{--accent:#7C6FFF;--accent2:#6457E6;--ink:#1C2030;--ink2:#5A6178;--ink3:#9AA0B4;--line:#E6E8F0;--soft:#F0EEFF;--surf:#F8F9FC}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Outfit',system-ui,sans-serif;color:var(--ink);font-size:13px;line-height:1.55;background:#fff}
  .mono{font-family:'JetBrains Mono',monospace}
  .page{width:210mm;min-height:297mm;margin:0 auto;padding:18mm 16mm;position:relative}
  /* Cabeçalho */
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--accent);padding-bottom:16px}
  .brand .tag{font-size:11px;color:var(--ink3);letter-spacing:.18em;text-transform:uppercase;margin-top:4px}
  .doc{text-align:right;font-size:11px;color:var(--ink2)}
  .doc .big{font-size:15px;font-weight:600;color:var(--ink)}
  .doc .v{display:inline-block;margin-top:5px;background:var(--soft);color:var(--accent2);font-weight:600;
    padding:3px 10px;border-radius:99px;font-size:11px}
  /* Hero */
  .hero{margin:26px 0 8px}
  .hero h1{font-size:26px;font-weight:700;letter-spacing:-.5px}
  .hero h1 span{color:var(--accent)}
  .hero p{color:var(--ink2);max-width:140mm;margin-top:8px}
  /* Bloco cliente */
  .meta{display:flex;gap:30px;flex-wrap:wrap;background:var(--surf);border:1px solid var(--line);
    border-radius:12px;padding:16px 20px;margin:20px 0}
  .meta div .k{font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.07em}
  .meta div .val{font-weight:600;font-size:14px;margin-top:2px}
  h2.sec{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);
    margin:24px 0 10px;font-weight:700}
  /* Tabelas */
  table.items{width:100%;border-collapse:collapse;margin-bottom:6px}
  table.items th{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);
    text-align:left;padding:8px 10px;border-bottom:2px solid var(--line);font-weight:700}
  table.items th.r,table.items td.r{text-align:right}
  table.items td{padding:9px 10px;border-bottom:1px solid var(--line)}
  table.items tr.sub td{font-weight:700;color:var(--ink);border-top:1px solid var(--line);background:var(--surf)}
  /* Investimento */
  .invest{display:flex;gap:14px;margin:14px 0 4px}
  .invest .card{flex:1;border:1px solid var(--line);border-radius:12px;padding:16px}
  .invest .card .k{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3)}
  .invest .card .v{font-size:20px;font-weight:700;margin-top:6px}
  .invest .card.dest{background:linear-gradient(135deg,var(--accent),var(--accent2));border:none}
  .invest .card.dest .k{color:rgba(255,255,255,.85)}
  .invest .card.dest .v{color:#fff}
  .invest .card .s{font-size:10px;color:var(--ink3);margin-top:3px}
  /* Texto institucional */
  .pitch{background:var(--surf);border-left:3px solid var(--accent);border-radius:0 10px 10px 0;
    padding:14px 18px;margin:22px 0;color:var(--ink2);font-size:12.5px}
  .pitch b{color:var(--ink)}
  .cond{font-size:11.5px;color:var(--ink2)}
  .cond li{margin:4px 0 4px 16px}
  /* Rodapé */
  .foot{position:absolute;bottom:12mm;left:16mm;right:16mm;border-top:1px solid var(--line);
    padding-top:10px;display:flex;justify-content:space-between;font-size:10px;color:var(--ink3)}
  @page{size:A4;margin:0}
  @media print{.noprint{display:none!important}}
  .bar{position:fixed;top:0;left:0;right:0;background:var(--ink);color:#fff;padding:10px 16px;
    display:flex;justify-content:space-between;align-items:center;z-index:99}
  .bar button{font-family:inherit;font-size:13px;font-weight:600;border:none;border-radius:8px;
    padding:8px 16px;cursor:pointer;margin-left:8px}
  .bar .p{background:var(--accent);color:#fff}.bar .g{background:#333;color:#fff}
  @media print{.page{margin:0}}
</style></head>
<body>
  <div class="bar noprint">
    <span>Pré-visualização da proposta — use "Imprimir" e escolha <b>Salvar como PDF</b></span>
    <span><button class="g" onclick="window.close()">Fechar</button><button class="p" onclick="window.print()">Imprimir / PDF</button></span>
  </div>

  <div class="page">
    <div class="top">
      <div class="brand">${LOGO_SVG}<div class="tag">Butique de RH</div></div>
      <div class="doc">
        <div class="big">Proposta Comercial</div>
        <div>${esc(hojeExtenso())}</div>
        ${d.versao ? `<div class="v">Versão ${esc(d.versao)}</div>` : ""}
      </div>
    </div>

    <div class="hero">
      <h1>Uma solução de <span>gestão de pessoas</span><br>sob medida para a ${esc(d.cliente || "sua empresa")}.</h1>
      <p>Tecnologia de RH com o cuidado de uma butique: cada módulo, cada hora de
      implantação e cada customização pensados para o seu contexto.</p>
    </div>

    <div class="meta">
      <div><div class="k">Cliente</div><div class="val">${esc(d.cliente || "—")}</div></div>
      <div><div class="k">Colaboradores</div><div class="val">${d.usuarios || 0}</div></div>
      ${d.bitrix ? `<div><div class="k">Oportunidade</div><div class="val">#${esc(d.bitrix)}</div></div>` : ""}
      ${d.vendedor ? `<div><div class="k">Consultor(a)</div><div class="val">${esc(d.vendedor)}</div></div>` : ""}
      <div><div class="k">Validade</div><div class="val">${d.validadeDias || 15} dias</div></div>
    </div>

    <h2 class="sec">Escopo da solução</h2>
    ${blocoRec}${blocoNr}

    <h2 class="sec">Resumo do investimento</h2>
    <div class="invest">
      <div class="card"><div class="k">Mensalidade</div><div class="v mono">${brl(d.mrr)}</div><div class="s">recorrente / mês</div></div>
      <div class="card"><div class="k">Implantação & único</div><div class="v mono">${brl(d.nr)}</div><div class="s">pagamento único</div></div>
      <div class="card dest"><div class="k">1º pagamento</div><div class="v mono">${brl(d.mrr + d.nr)}</div><div class="s">mensalidade + setup</div></div>
    </div>

    <div class="pitch">
      Na <b>Elofy</b>, acreditamos que cada empresa tem uma cultura única. Por isso
      entregamos uma plataforma completa de desempenho, engajamento e desenvolvimento —
      com implantação acompanhada de perto e a possibilidade de <b>customizações</b>
      sob demanda. Não vendemos um software de prateleira: construímos uma parceria.
    </div>

    <h2 class="sec">Condições comerciais</h2>
    <ul class="cond">
      <li>Valores expressos em Reais (R$), já com impostos aplicáveis.</li>
      <li>Mensalidade recorrente cobrada por colaborador ativo, conforme escopo contratado.</li>
      <li>Implantação e customizações são de cobrança única (não recorrente).</li>
      <li>Proposta válida por ${d.validadeDias || 15} dias a partir da data de emissão.</li>
      <li>Reajuste anual conforme índice contratual.</li>
    </ul>

    <div class="foot">
      <span>elofy · Butique de RH · Zucchetti HR Tech</span>
      <span>Proposta para ${esc(d.cliente || "cliente")} · ${esc(hojeExtenso())}</span>
    </div>
  </div>
</body></html>`;
  }

  /* ---- API ---- */
  function gerar(dados) {
    const win = global.open("", "_blank");
    if (!win) { alert("Permita pop-ups para gerar o PDF da proposta."); return; }
    win.document.open();
    win.document.write(montarHtml(dados));
    win.document.close();
  }

  global.PricingPDF = { gerar, LOGO_SVG };
})(window);
