# Instruções para Agentes

Este projeto usa instruções obrigatórias em `docs/llm-style-guide.md`.

## Ordem de precedência
1. Instruções do usuário
2. `docs/llm-style-guide.md`
3. Padrões locais do código

## Regras obrigatórias
- Manter prefixo de versão `/v1` nas rotas.
- Manter swagger (`src/swagger.json`) sincronizado com rotas reais.
- Reutilizar middlewares e padrão de resposta existentes; evitar formatos paralelos.
- Não introduzir nova biblioteca/framework de API sem solicitação explícita.
- Preservar nomes neutros de modelo (sem branding antigo).
- Evitar duplicação de lógica entre controllers/rotas.