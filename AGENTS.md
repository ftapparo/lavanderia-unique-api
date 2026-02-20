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
## Windows UTF-8 (obrigatorio)

Para evitar mojibake ao editar/gerar arquivos via shell no Windows:

```powershell
chcp 65001
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
```

Regras:
- Preferir PowerShell 7 (`pwsh`).
- Sempre gravar arquivos em UTF-8.
- Em caso de texto corrompido (`Ã`, `?`, `�`), interromper e corrigir encoding antes de continuar.
