# POCs

Um **POC** (prova de conceito) aqui é um experimento pequeno e descartável que responde **uma pergunta técnica** antes de o jogo depender dela. Código de POC não vai para `game/` sem ser reescrito.

## Convenção

- Uma pasta por POC: `poc-NN-assunto` (ex.: `poc-01-sensores`, `poc-02-...`).
- Cada POC tem um `README.md` com:
  1. **Pergunta** que o POC responde.
  2. **Premissas** que ele testa (P1–P14 de [`docs/04-premissas.md`](../docs/04-premissas.md)).
  3. **Escopo** (o que entra e o que fica de fora) e **etapas**.
  4. **Critérios de sucesso** com metas numéricas sempre que possível.
  5. **Como rodar.**
  6. **Resultados.**
- Cada POC é autocontido: seu próprio `package.json`, sem depender de outro POC.

## Como registrar resultados

Na seção "Resultados" do README do POC:

- **Aparelhos**: modelo, sistema, navegador/app (ex.: "iPhone 13, iOS 18, Safari").
- **Rede**: Wi-Fi da universidade, casa, túnel usado.
- **Medido**: números, com unidade e quantidade de amostras (ex.: "intervalo médio 16,7 ms, máx 48 ms, n = 1200").
- **Inferência**: o que o time conclui a partir das medições, separado do que foi medido.
- **Evidências**: capturas de tela ou CSV em `resultados/` dentro do POC.

Depois:

1. Atualizar o **Status** das premissas afetadas em `docs/04-premissas.md`, citando o POC.
2. Se o resultado decide algo, abrir ou atualizar um ADR em `docs/decisoes/`.

## POCs

| POC | Pergunta | Estado |
|---|---|---|
| [poc-01-sensores](poc-01-sensores/) | Os sensores do celular, via AirConsole ou alternativa própria, são bons o bastante para detectar um swing de tênis? | Não iniciado |
