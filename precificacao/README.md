# Formação de Preço · HR Tech

Aplicativo interno de **formação de preço** da HR Tech. Replica a calculadora da
**Política Comercial Elofy 2025 v5** (módulos, IA, People Analytics, serviços e
autonomia de desconto) numa interface web, com suporte futuro a **In Recruiting**
e **Eggup**.

> Projeto independente do BI Executivo. Vive na pasta `precificacao/` apenas por
> restrição de permissões; pode ser movido para um repositório próprio.

---

## Arquitetura

Critérios: **durar, ser seguro e fácil de alterar sem gastar tokens.**

- **Sem build, sem framework, sem dependências** — HTML/CSS/JS puro. Roda no
  navegador ou no GitHub Pages.
- **Dados separados do código** (`data/`) — preços, packs e regras em arquivos
  pequenos; mudar um valor não toca na lógica.
- **Motor isolado** (`src/engine.js`, funções puras) — replica fielmente as
  fórmulas da planilha e é validado contra ela.

```
precificacao/
├── index.html              # tela (abas: Elofy, In Recruiting, Eggup)
├── app.css                 # tema escuro
├── data/                   # ← DADOS DE NEGÓCIO (editáveis)
│   ├── parametros.js       # impostos, % de RV/IA, autonomia, produtos
│   ├── tabela-precos.js    # preço/usuário por faixa (aba Tabela de Preços)
│   ├── ai-packs.js         # packs de tokens de IA (aba Pricing AI)
│   ├── ai-tokens.js        # tokens por AVD/PDI
│   ├── people-analytics.js # pacotes QuickSight
│   └── servicos.js         # horas de implantação por escopo × porte
└── src/
    ├── engine.js           # motor de cálculo
    └── app.js              # interface
```

---

## Lógica de preço (Elofy)

**Recorrente (mensal), por usuário — preço regressivo por faixa de usuários:**
- **Completos** (Metas+Engajamento+Desempenho) ou módulos avulsos (Desempenho,
  Engajamento, Metas) — cada um com sua coluna de preço.
- **RV**: +15% sobre Metas e/ou sobre Completos.
- **IA**: +5% sobre Desempenho e/ou Completos **+ pack de tokens**
  (volume = AVDs×15.000 + PDIs×8.500 → escolhe o pack → rateio mensal/usuário).
- **People Analytics** (QuickSight): valor anual ÷ 12 ÷ usuários.
- **Desconto/autonomia**: Closer 10% · Gestor 20% · Diretor 30% (sobre o valor
  sem imposto). Acima disso → exceção.
- **Imposto fiscal**: 5,65% (`valor_com = valor_sem / 0,9435`).

**Não recorrente (NR, único):**
- **Implantação**: horas por escopo × porte (Smart/Standard/Premium/Enterprise).
- **Consultoria / Endomarketing / Desenvolvimento**: horas × R$/hora.

**Valor global** = mensalidade (c/ imposto) + NR (c/ imposto).

> Validação: para 2.500 usuários só com IA, o motor reproduz a mensalidade da
> planilha (R$ 825,04) e a implantação (R$ 5.829,36) exatamente.

---

## Como editar os dados

Abra o arquivo em `data/` e altere **apenas os valores**. Percentuais em fração
(`0.0565` = 5,65%).

| Arquivo | O que muda |
|---|---|
| `tabela-precos.js` | preço por usuário em cada faixa de quantidade |
| `ai-packs.js` | faixas de tokens e preços piso/ideal dos packs |
| `people-analytics.js` | valor anual dos pacotes QuickSight |
| `servicos.js` | horas de implantação por escopo e porte |
| `parametros.js` | impostos, % de RV/IA, autonomia de desconto, produtos |

### Habilitar In Recruiting / Eggup
Em `parametros.js`, ponha `ativo: true` no produto e crie os arquivos de dados
com a regra de preço dele. (Aguardando os dados.)

---

## Onde os dados são salvos

- **Tabelas de preço / regras:** no próprio código (`data/`), como na planilha.
- **Propostas/simulações:** planejado para um schema dedicado `pricing` no
  Supabase (projeto compartilhado com o BI), com histórico de cliente, valores e
  aprovação. *(Integração ainda não implementada.)*

---

## Rodar

Abra `index.html` no navegador. Sem instalação nem build.

> **Segurança:** o app expõe custos/margens no código da página. Não publique em
> site público — use repositório/Pages privado, rede interna ou gate de acesso.

---

## Pendências

1. Dados de precificação do **In Recruiting** e do **Eggup**.
2. Integração **Supabase** (schema `pricing`) para salvar propostas.
3. Discrepância na planilha: a fórmula do Engajamento (C25) aponta para a coluna
   de Desempenho; o app usa a coluna correta de Engajamento. Confirmar com a
   Controladoria qual é a regra certa.
