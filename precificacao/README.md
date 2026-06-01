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
- **Dados de preço no Supabase, não no código** — como o repositório/site é
  **público**, custos, margens e tabela de preços **não podem** ficar em arquivos
  estáticos (seriam baixáveis por qualquer um, mesmo com login no front). Eles
  vivem no schema `pricing` e são carregados via RPC **só após login autorizado**.
- **Motor isolado** (`src/engine.js`, funções puras) — replica fielmente as
  fórmulas da planilha e é validado contra ela.

```
precificacao/
├── index.html        # tela (abas de produto)
├── app.css           # tema claro
├── data/
│   └── supabase.js   # URL + chave PÚBLICA do Supabase (seguro versionar)
└── src/
    ├── engine.js     # motor de cálculo (regras de preço)
    ├── auth.js       # login (magic link) + config + salvar/listar propostas
    └── app.js        # interface
```

> A tabela de preços, packs de IA, People Analytics, horas de serviço,
> autonomia e parâmetros ficam nas tabelas do schema `pricing` (ver abaixo) —
> **não há mais arquivos de dados sensíveis no repositório.**

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

Os dados de preço ficam em **tabelas do schema `pricing`** no Supabase. Edite no
**SQL editor** do painel (ou numa migração). Percentuais em fração
(`0.0565` = 5,65%).

| Tabela | O que muda |
|---|---|
| `pricing.tabela_precos` | preço por usuário em cada faixa de quantidade |
| `pricing.ai_packs` | faixas de tokens e preços piso/ideal dos packs |
| `pricing.people_analytics` | valor anual dos pacotes QuickSight |
| `pricing.servico_horas` | horas de implantação por escopo e porte |
| `pricing.autonomia` | autonomia de desconto (Closer/Gestor/Diretor) |
| `pricing.parametros` | impostos, % de RV/IA, tokens por AVD/PDI, R$/hora (inclui `valor_hora_custom`) |
| `pricing.customs_status_elegivel` | status do Jira que liberam a custom (hoje: Elaborar Proposta) |

### Módulos: venda completa OU modular

"Completos" e os módulos avulsos (Desempenho, Engajamento, Metas) são
**mutuamente exclusivos**: ao marcar "Completos", os avulsos ficam travados, e
vice-versa. RV e IA são modificadores e seguem disponíveis nos dois casos.

### Itens da proposta (recorrente × não recorrente)

Tudo aparece **itemizado**, para o cliente ver o que compõe o projeto:

- **Recorrente (mensal):** cada módulo selecionado (ou "Completos"), RV, IA,
  tokens, People Analytics — e cada custom, quando cobrada dentro do MRR.
- **Não recorrente (único):** implantação (automática) + **serviços itemizados**
  e **cada customização como uma linha própria**.
- **Serviços NR** são linhas livres (botão *+ Adicionar serviço*): tipo
  (Consultoria/Endomarketing/Desenvolvimento/…), descrição e horas. Permite, p.ex.,
  duas consultorias distintas ("Clima organizacional", "Acompanhamento pós-projeto").
  Valor de cada linha = horas × valor/hora.

### Acesso por papel (closer / supervisor / admin)

Cada usuário em `pricing.usuarios_permitidos` tem um `papel`:

- **closer** → enxerga **apenas as próprias** propostas.
- **supervisor** e **admin** → enxergam as de **todos**.

Aplicado por RLS (`propostas_select`) e nas funções `pricing_listar_propostas` /
`pricing_historico_proposta` (que são SECURITY DEFINER e filtram por
`pricing.ve_tudo() or criado_por = auth.uid()`).

Para **gerenciar a equipe** (corrigir e-mail / trocar papel):

```sql
-- adicionar/corrigir
insert into pricing.usuarios_permitidos(email, papel) values ('ana.sobrenome@elofy.com.br','closer');
update pricing.usuarios_permitidos set email='novo@dominio' where email='antigo@dominio';
update pricing.usuarios_permitidos set papel='supervisor' where email='thiago@...';
-- papéis válidos: closer, gestor, diretor, supervisor, admin
```

### Página pública da proposta + feedback do cliente

O closer compartilha um **link** (`proposta.html?t=<token>`) por e-mail. O cliente
abre, vê a proposta itemizada (igual ao PDF, só valores de venda) e responde se
**atende / quer ajustes / não atende**, com motivos (custo, prazo, escopo) e
comentário. Tudo sem login.

- `propostas.public_token` (UUID) = link assinado; `snapshot_cliente` (jsonb) é a
  visão client-safe congelada no momento do salvamento.
- RPCs públicas (anon, SECURITY DEFINER, exigem o token): `proposta_publica(token)`
  (retorna o snapshot e registra a visualização) e
  `proposta_feedback(token, sentimento, motivos, comentario, nome)`.
- No histórico do closer aparece: **se o cliente abriu** (👁 visualizada Nx), os
  botões **Copiar link / Copiar e-mail**, e o **feedback** recebido.
- Nunca expõe custo, margem, piso ou autonomia — só o snapshot de venda.

### Painel de Propostas (acompanhamento)

Botão **📋 Propostas** no topo: lista a última versão de cada oportunidade com
o **status do cliente** (aguardando / visualizada / aprovou / pediu ajustes /
não atende / 🏆 ganho), a fase do Bitrix, o valor e quem é o closer. Closer vê
só as suas; supervisor/admin veem as de todos (`pricing_painel_propostas`).
"Abrir" carrega a oportunidade na calculadora.

### Ganho & Handoff para o Onboarding

Fecha o ciclo da venda. No histórico, cada versão tem **🏆 Dar ganho & handoff**:

- **Gate do Bitrix:** só permite seguir se o negócio já estiver em fase de
  **Ganho** no Bitrix (`pricing.bitrix_ganho` checa `public.negocios.fase` ~
  `ganho|realizada`). O sistema **não move nada no Bitrix** — o closer faz isso lá.
- **Formulário:** confirmação do que foi vendido, contrato (upload p/ bucket
  privado `contratos` **ou** link), contatos do cliente, faturamento (CNPJ,
  condição/forma), kickoff/urgência, critérios de ganho e sucesso, história.
- Marca `propostas.ganho_em` e grava em `pricing.handoffs` (1 por `bitrix_id`).
- **Fechamento sem o OK do cliente é permitido**, mas exige marcar a caixa de
  ciência ("estou ciente de que o cliente não deu o OK formal"). O registro
  guarda `ok_cliente_na_plataforma` e a página do cliente segue aceitando
  resposta tardia.
- **Painel 🏆 Handoffs** (botão no topo, visível a `onboarding`/`supervisor`/`admin`):
  lista os negócios ganhos com todos os dados + baixar contrato + ver proposta.
- **Notificação:** se `window.HANDOFF_WEBHOOK_URL` estiver definida (em
  `data/supabase.js`), o app faz POST do resumo do handoff para o n8n ao concluir.
  Sem isso, o painel é a fonte da verdade.

RPCs: `pricing_pode_dar_ganho`, `pricing_registrar_handoff`,
`pricing_listar_handoffs`, `pricing_meu_perfil`. Papel novo: **onboarding**.

### Proposta em PDF

Botão **Gerar PDF** abre uma proposta comercial caprichada (marca elofy +
"Butique de RH", dados do cliente, escopo, resumo de investimento, pitch e
condições) e usa a **impressão nativa** do navegador → *Salvar como PDF*.
Vetorial, sem bibliotecas, offline (`src/pdf.js`).

- Mostra **apenas valores de venda** (mensalidade, único, 1º pagamento,
  customs). Nunca expõe custo, margem, piso ou autonomia.
- Logo é **tipográfico provisório** (SVG em `PricingPDF.LOGO_SVG`); para usar o
  logo oficial da Elofy, basta trocar esse SVG.

### Histórico & versões de proposta

Cada cliente/oportunidade acumula um histórico de versões, agrupado pela
**oportunidade do Bitrix** (`bitrix_id`):

- **Salvar como nova versão** → cria v1, v2, v3… (numeração automática por
  oportunidade). Exige um negócio do Bitrix vinculado; sem vínculo a proposta
  fica avulsa (v1).
- **Atualizar atual** → sobrescreve a versão aberta, sem criar nova.
- **Histórico & evolução** → timeline das versões com **valor global, mensalidade,
  NR**, o **delta de valor** vs. a versão anterior (R$ e %) e um **diff** do que
  mudou (usuários, desconto, customs). "Abrir na calculadora" recarrega a versão.

RPCs: `pricing_salvar_proposta` (retorna `{id, versao}`),
`pricing_atualizar_proposta`, `pricing_historico_proposta(bitrix_id)`.

### Customizações (Jira / projeto PDMC)

Desenvolvimentos sob demanda vêm do Jira (projeto **PDMC**), sincronizados pelo
n8n para `pricing.customs`. Campos de horas: `customfield_10910` (DEV) e
`customfield_10911` (QA). Vínculo Bitrix: `customfield_10811`; cliente:
`customfield_10275`.

- **Elegibilidade:** só entram customs em status liberado
  (`pricing.customs_status_elegivel`). Para liberar outro status, insira a linha
  — sem mexer no código.
- **Preço:** `(horas_dev + horas_qa) × valor_hora_custom` (R$ 220), + imposto.
- **Posição:** o grupo de customs pode entrar **dentro do MRR** (recorrente) ou
  como **NR** (único), via toggle na tela. O total compõe o valor global.
- **Sync:** workflow n8n "Sync Customs Jira para Supabase" (a cada 2h). Requer a
  credencial **Jira Header Auth** (Header `Authorization: Basic <base64 email:token>`).

Exemplo — ajustar o imposto:
```sql
update pricing.parametros set valor = 0.06 where chave = 'impostos_pct';
```

A alteração reflete no app **no próximo login/refresh** (a config é lida a cada
sessão). Não precisa fazer deploy.

---

## Segurança

O repositório e o GitHub Pages são **públicos**. Por isso, **nada sensível mora
no código** — o gate de login no front não protege arquivos estáticos.

- **Dados de preço no banco**, schema `pricing`, **não exposto** à API pública
  (PostgREST). Não há como ler as tabelas com a chave pública.
- Acesso **só por funções RPC** (`pricing_config`, `pricing_salvar_proposta`,
  `pricing_listar_propostas`, `pricing_meu_perfil`), executáveis apenas pelo
  papel `authenticated`.
- Cada RPC valida a **allowlist** (`pricing.usuarios_permitidos`). E-mail fora da
  lista → acesso negado, mesmo logado e com chave válida.
- **RLS** ligado em todas as tabelas do schema.
- **Login por magic link** (Supabase Auth): nenhuma senha armazenada.
- A `publishableKey` em `data/supabase.js` é **pública por design** — a
  segurança não depende dela.
- **Sem login autorizado, o app não carrega nenhum dado de preço.**

### Configuração necessária no painel Supabase (uma vez)

1. **Auth → Providers → Email**: habilitar (magic link já vem ligado).
2. **Auth → URL Configuration → Redirect URLs**: adicionar a URL onde o app é
   hospedado (ex.: `https://SEU-USUARIO.github.io/bi-elofy/precificacao/` e,
   para testes locais, `http://localhost:*`).
3. **Autorizar usuários** (no SQL editor):
   ```sql
   insert into pricing.usuarios_permitidos (email, papel)
   values ('fulano@zucchetti.com', 'closer');  -- closer|gestor|diretor|admin
   ```

---

## Rodar

O app **depende do Supabase** (os preços vêm de lá após o login). Sirva a pasta
e acesse pelo navegador — sem instalação nem build. Como roda contra um banco
real, **publicar é seguro**: sem login autorizado não há dado de preço para vazar.

---

## Pendências

1. Dados de precificação do **In Recruiting** e do **Eggup**.
2. Configurar **Redirect URLs** no painel Supabase (ver seção de segurança) e
   autorizar os e-mails do time na allowlist.
3. Discrepância na planilha: a fórmula do Engajamento (C25) aponta para a coluna
   de Desempenho; o app usa a coluna correta de Engajamento. Confirmar com a
   Controladoria qual é a regra certa.
