# CLAUDE.md

## O projeto

Wii Move: jogo de tênis no navegador do PC em que o celular de cada jogador é a raquete (os sensores viram o golpe).
Projeto da cadeira de Jogos Digitais (UFPE/CIn, 2026.2), equipe de 5, TypeScript.
Todo o contexto está em `docs/`. Fase atual: POC de sensores (`pocs/poc-01-sensores/`).

## Antes de trabalhar

Leia, nesta ordem:
1. `docs/00-contexto.md`
2. `docs/04-premissas.md`
3. `docs/decisoes/` (todos os ADRs)

Depois, o documento da área em que vai mexer (`01-game-design`, `02-plano-de-projeto`, `03-airconsole`) e o README da pasta.

## Ao concluir um POC

1. Registrar os resultados na seção "Resultados" do README do POC: o que foi medido, em quais aparelhos, com quais números.
2. Atualizar o status das premissas afetadas em `docs/04-premissas.md`, citando o POC como fonte.
3. Se o resultado muda ou confirma uma decisão, abrir um novo ADR em `docs/decisoes/` (ou atualizar o status do ADR condicionado).

## Regras de trabalho

- Não inventar nome de API, opção de config ou versão de biblioteca. Na dúvida, consultar a documentação oficial ou dizer que não sabe.
- Separar o que foi medido do que é inferência. Não promover inferência a fato nos docs.
- Antes de propor correção, considerar ao menos duas causas possíveis.
- Código curto e completo. Mudanças pontuais quando o pedido for pontual.
- Discordar com argumento; não validar uma abordagem só porque foi proposta.
- Documentação em português. Lacunas ficam marcadas como `[a definir]`.
