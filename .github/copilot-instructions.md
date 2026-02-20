# Instruções do Copilot (API)

Estas instruções são obrigatórias para sugestões de código neste repositório.

Fonte única de padrões:
- `docs/llm-style-guide.md`

## Regras de alta prioridade
- Respeitar prefixo de versão `/v1` em endpoints.
- Manter `src/swagger.json` alinhado a todas as rotas existentes.
- Reusar padrão de resposta e middlewares existentes antes de criar novo fluxo.
- Evitar introduzir dependências novas sem necessidade clara.
- Manter naming neutro de modelo (sem termos de projeto/cliente anterior).