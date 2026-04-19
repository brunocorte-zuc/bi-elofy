# BI Executivo · Zucchetti HR Tech

> Dashboard executivo de gestão para acompanhamento de MRR, pipeline comercial, CX e disciplina de vendas — alimentado em tempo real via Bitrix24 + Intercom → Supabase.

---

## Stack

| Camada | Tecnologia |
|---|---|
| **Frontend** | HTML/CSS/JS single-file · Chart.js · Supabase JS |
| **Banco de dados** | Supabase (PostgreSQL) — região São Paulo |
| **Integração** | n8n Cloud · Bitrix24 API · Intercom API |
| **Hospedagem** | GitHub Pages |
| **Autenticação** | SHA-256 browser-side · sessionStorage |

---

## Abas do dashboard

| Aba | Fonte | Atualização |
|---|---|---|
| Visão Geral | Bitrix24 + DRE | Diária |
| Financeiro / NRR | DRE LeverPro + Bitrix24 | Mensal (até dia 15) |
| Comercial / Interações | Bitrix24 | A cada 25h |
| Closer / Disciplina | Bitrix24 | A cada 25h |
| CX / Suporte | Intercom | A cada 2h |
| Marketing | Manual | — |
| Tecnologia | Manual | — |

---

## Workflows n8n

Dois workflows precisam estar **ativos** para manter as bases atualizadas:

### 1. Sync Intercom Tickets
**ID:** `rclCSJvdXvJ2ExwJ` · [Abrir no n8n](https://elofy.app.n8n.cloud/workflow/rclCSJvdXvJ2ExwJ)

- Roda a cada **2 horas** (`0 */2 * * *`)
- Busca tickets atualizados nas últimas 3h (margem de segurança)
- Upsert na tabela `tickets` do Supabase
- Alimenta: abas CX, NRR (health_score)

### 2. Update Diario Negocios
**ID:** `jjru547KjXL2LUbA` · [Abrir no n8n](https://elofy.app.n8n.cloud/workflow/jjru547KjXL2LUbA)

- Roda **diariamente** às 6h
- Busca todos os negócios do Bitrix24, filtra modificados nas últimas 25h
- Upsert nas tabelas `negocios` e `atividades` do Supabase
- Alimenta: abas Comercial, Closer, Disciplina Comercial, NRR

---

## Supabase

- **Projeto:** `ctdqizsaajdovclltxgr.supabase.co`
- **Região:** São Paulo (`sa-east-1`)
- **Tabelas:** `negocios` · `atividades` · `tickets`

---

## Acesso

O dashboard usa autenticação própria com hash SHA-256. Senhas nunca ficam em texto plano — apenas os hashes são armazenados no código.

| Usuário | Role | Acesso |
|---|---|---|
| `bruno` | admin | Tudo |
| `ana` | closer | Visão Geral + Closer (AE) + Comercial |
| `larissa` | closer | Visão Geral + Closer (LV) + Comercial |
| `dayane` | closer | Visão Geral + Closer (DC) + Comercial |
| `hugo` | closer | Visão Geral + Closer (HC) + Comercial |
| `cx` | cx | Visão Geral + CX |
| `fin` | financeiro | Visão Geral + Financeiro |

> Sessão expira ao fechar o navegador (`sessionStorage`).

**Para alterar uma senha:** gere o SHA-256 da nova senha e substitua o hash correspondente no objeto `AUTH_USERS` no início do script.

```bash
# Gerar hash via terminal
echo -n "NovaSenha123" | sha256sum
```

---

## Backlog de melhorias

Priorizadas em 18/04/2026:

1. **NRR** — Net Revenue Retention *(em desenvolvimento)*
2. **Health Score portfólio** — campo `health_score` já existe em `tickets`
3. **Cohort churn** — requer histórico de contratos com data início
4. **CAC vs LTV** — requer DRE marketing + `negocios.valor_rec`
5. **Jira × Churn** — campo `jira_issue_key` já existe em `tickets`
6. **Tipo atividade × taxa fechamento** — `atividades.tipo` vs `negocios.fase`
7. **Forecast accuracy** — requer snapshot histórico do pipeline
8. **Time to go-live** — requer nova fonte (Jira projetos)

---

## Como atualizar o dashboard

```bash
# Clonar (primeira vez)
git clone https://github.com/SEU_USUARIO/bi-elofy.git
cd bi-elofy

# Atualizar o arquivo
cp /caminho/para/novo/bi_executivo.html index.html

# Publicar
git add index.html
git commit -m "feat: descrição da melhoria"
git push origin main
```

GitHub Pages publica automaticamente em ~1 minuto após o push.

---

*Zucchetti HR Tech · Dir. Bruno Cortez · Atualizado em Abr/2026*
