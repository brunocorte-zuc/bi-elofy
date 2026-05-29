# Formação de Preço · HR Tech

Aplicativo interno para **formação de preço** da HR Tech: base de precificação,
catálogo de módulos/produtos, alçada de descontos e **simulador de proposta**.

> Projeto independente do BI Executivo. Vive na pasta `precificacao/` apenas
> por restrição de permissões; pode ser movido para um repositório próprio.

---

## Por que esta arquitetura

Critérios do projeto: **durar, ser seguro e fácil de alterar sem gastar tokens.**

- **Sem build, sem framework, sem dependências de pacote** — HTML/CSS/JS puro.
  Não "apodrece" com o tempo e roda direto no navegador ou no GitHub Pages.
- **Dados separados do código** (`data/`) — mudar preço, produto ou alçada é
  editar um arquivo pequeno, sem tocar na lógica.
- **Motor de cálculo isolado** (`src/engine.js`, funções puras) — as regras de
  preço/margem/alçada ficam num só lugar, fáceis de revisar e testar.

```
precificacao/
├── index.html          # tela do simulador
├── app.css             # tema (escuro, padrão Elofy)
├── data/               # ← VOCÊ EDITA AQUI (dados de negócio)
│   ├── parametros.js   # impostos, comissão, margens, prazo
│   ├── catalogo.js     # módulos/produtos: preço, custo, piso
│   └── alcada.js       # níveis de aprovação de desconto
└── src/
    ├── engine.js       # motor de cálculo (regras de negócio)
    └── app.js          # interface (não contém regra de preço)
```

---

## Como editar os dados

Abra o arquivo em `data/` e altere **apenas os valores**. Percentuais usam
fração: `0.10` = 10%.

### `data/catalogo.js` — módulos/produtos
Cada item:

| Campo | Significado |
|---|---|
| `id` | identificador único, sem espaços |
| `nome` | rótulo exibido |
| `categoria` | agrupador livre (`Core`, `Add-on`, `Serviço`…) |
| `cobranca` | `por_colaborador` · `fixo_mensal` · `unica` |
| `preco_lista` | preço de tabela (R$) |
| `custo_unit` | custo interno (R$) — base da margem |
| `piso` | menor preço aceitável (R$) — abaixo dispara alerta |
| `ativo` | `false` esconde do simulador sem apagar o cadastro |

### `data/parametros.js` — base de cálculo
Impostos, comissão, taxa de gateway, margem alvo/mínima, prazo padrão.

### `data/alcada.js` — alçada de descontos
Lista de níveis (papel + desconto máximo). A simulação busca o menor nível que
cobre o desconto aplicado; se nenhum cobrir, marca **exceção**.

---

## Como o cálculo funciona

Para cada item: `final = lista × (1 − desconto)`.
Margem de contribuição:

```
margem = receita − impostos − comissão − taxas − custo
margem% = margem / receita
```

Saídas do simulador:
- **MRR** (recorrente mensal) e **Setup** (cobrança única) separados
- **TCV** = MRR × prazo + Setup
- **Margem** por item e consolidada
- **Alçada** necessária para o desconto do recorrente
- **Alertas** de margem abaixo do mínimo e de preço abaixo do piso

---

## Rodar

Abra `index.html` no navegador (ou publique a pasta no GitHub Pages).
Não há instalação nem build.

> **Segurança:** este app expõe custos e margens no código-fonte da página.
> **Não publique em site público.** Use repositório/Pages privado, rede interna,
> ou um gate de acesso antes de publicar. (Ver decisão de deploy em aberto.)
