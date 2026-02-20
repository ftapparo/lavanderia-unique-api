# Guia LLM de API (Template)

## 1. Objetivo
Esta API e um template reutilizavel e neutro para novos projetos.

Regra obrigatoria:
- Nao reintroduzir logica de dominio especifica antiga.
- Manter arquitetura simples, padronizada e orientada a reuso.

## 2. Stack e limites
Stack oficial:
- Node.js
- TypeScript
- Express
- swagger-ui-express

Limites obrigatorios:
- Nao introduzir framework HTTP alternativo sem solicitacao explicita.
- Nao adicionar dependencia nova se o comportamento puder ser resolvido com stack atual.

## 3. Contrato publico atual
Prefixo de versao obrigatorio:
- `/v1`

Endpoints base do template:
- `GET /v1/api/health`
- `GET /v1/api/healthcheck`
- `GET /v1/swagger`
- `GET /v1/openapi.json`

Regra obrigatoria:
- Toda nova rota deve respeitar o prefixo de versao e convencoes de resposta.

## 4. Swagger/OpenAPI (fonte oficial)
Fonte de verdade da especificacao:
- `src/swagger.json`

Regras obrigatorias:
- Sempre manter swagger sincronizado com rotas reais.
- Nao documentar endpoint inexistente.
- Usar titulo/descricao neutros de template (sem branding antigo/especifico).

## 5. Padrao de resposta e contexto
Componentes obrigatorios de padrao:
- `src/middleware/response-handler.ts`
- `src/middleware/request-context.ts`
- `src/types/express/index.d.ts`

Regras obrigatorias:
- Preferir `res.ok(...)` e `res.fail(...)` para respostas JSON.
- Preservar `x-request-id` e `x-actor` quando middleware estiver aplicado.
- Nao criar formatos de resposta paralelos em cada controller.

## 6. Estrutura e composicao
Ordem obrigatoria para evolucao:
1. Reusar middlewares/utilitarios existentes
2. Reusar padrao de rotas/controllers existente
3. So entao criar novo modulo reutilizavel

Regras obrigatorias:
- Evitar duplicacao de logica entre controllers.
- Manter nomes neutros e sem termos de cliente/projeto anterior.

## 7. Implementacao
Padroes obrigatorios:
- Tipagem explicita em handlers/middlewares.
- Erros tratados de forma padronizada.
- Sem hardcode de ambiente/credenciais.
- Sem quebra de compatibilidade das rotas base sem pedido explicito.

## 8. Checklist de PR para LLM
Antes de concluir alteracoes:
- Mantive prefixo `/v1` nas rotas?
- Atualizei `src/swagger.json` se houve mudanca de endpoint?
- Mantive resposta padrao com `res.ok`/`res.fail` ou estrutura equivalente?
- Evitei nova dependencia sem necessidade real?
- Mantive naming neutro de template?

## 9. Exemplos praticos (curtos)

### Exemplo 1: novo endpoint
Certo:
- Criar rota em `/v1/api/...`
- Atualizar swagger no mesmo PR
- Reusar middlewares e resposta padrao

Errado:
- Criar rota fora do versionamento
- Esquecer swagger
- Retornar payload com formato diferente do restante

### Exemplo 2: tratamento de erro
Certo:
- Centralizar resposta de erro com estrutura consistente

Errado:
- Cada controller montar erro de um jeito diferente

### Exemplo 3: naming
Certo:
- nomes genericos: `template-api`, `health`, `settings`

Errado:
- nomes ligados a cliente/projeto antigo
