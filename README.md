# Laundry Control API

## Visão Geral

A API é o backend central do sistema de controle de lavanderia do condomínio.

Ela é responsável por:

- Autenticação e autorização de usuários
- Gestão de unidades (apartamentos)
- Gestão de vínculos entre usuários e unidades
- Agendamentos de uso das máquinas
- Check-in e controle de sessões de energia
- Registro de ocorrências
- Cálculo e geração de faturas mensais
- Comunicação com o serviço TUYA
- Execução de jobs automáticos (no-show, overtime, billing)

O FRONT não acessa o banco nem a TUYA diretamente.
Toda comunicação externa passa pela API.

---

## Arquitetura

FRONT → API → PostgreSQL  
         ↓  
    TUYA Service

A API é responsável por orquestrar todas as regras de negócio.

---

## Tecnologias

- Node.js
- TypeScript
- Express
- PostgreSQL
- node-postgres (pg) — SEM ORM
- JWT para autenticação
- node-cron para jobs
- Biblioteca de envio de e-mail (ex: nodemailer)
- Logger estruturado

---

## Estrutura do Projeto

src/
- controllers/
- services/
- db/
  - migrations/
  - queries/
  - repositories/
- middleware/
- jobs/
- config/

---

## Banco de Dados

Não usamos ORM.

Todas as queries são:
- Escritas manualmente
- Parametrizadas ($1, $2, ...)
- Organizadas por domínio

Transações devem ser explícitas:
BEGIN → COMMIT → ROLLBACK

---

## Autenticação

- JWT access token
- Middleware para proteção de rotas
- Roles:
  - USER
  - ADMIN (zelador/gerente)

Permissões por vínculo com unidade.

---

## Regras de Negócio Principais

1. Reserva sempre tem 2 horas.
2. Não pode haver conflito no mesmo par de máquinas.
3. Check-in só dentro da janela permitida.
4. Energia só é liberada após check-in.
5. Se ao final ainda houver consumo:
   - Permite finalizar ciclo
   - Registra ocorrência
   - Desliga quando consumo zerar
6. No último dia do mês:
   - Gera faturas
   - Gera planilha
   - Envia e-mail automático

---

## Configurações Importantes

Via .env:

- DATABASE_URL
- JWT_SECRET
- BILLING_MODE (PER_USE | PER_KWH)
- PRICE_PER_USE
- PRICE_PER_KWH
- CHECKIN_TOLERANCE_MINUTES
- OVERTIME_THRESHOLD_WATTS
- EMAIL_SMTP_CONFIG

---

## O que NÃO deve ser feito

- Não usar ORM
- Não acessar banco fora do repositório
- Não permitir acesso direto à TUYA pelo front
- Não misturar regra de negócio com controller

---

## Objetivo do Projeto

Ser o núcleo seguro e confiável do sistema,
controlando energia, reservas e cobrança com
previsibilidade e robustez.
---

## Windows (PowerShell) e UTF-8

Para evitar problemas de encoding (mojibake) ao rodar scripts/comandos no Windows, configure o terminal para UTF-8 antes de trabalhar:

```powershell
chcp 65001
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
```

Recomendado usar PowerShell 7 (`pwsh`) e manter os arquivos em UTF-8.
