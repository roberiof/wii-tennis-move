// Valores iniciais do golpe (plano da S3). Nenhum foi medido: ajustar no playtest.
// Coordenadas: jogador em z ≈ +9,3 olhando para −z; rede em z = 0; x > 0 é a direita do jogador.

export const TUNING = {
  /** Linha de contato: o instante em que a bola a cruza é o t_contato (golpe "perfeito"). */
  contactZ: 9.3,

  /** Janela de acerto em relação ao t_contato (ms). */
  windowEarlyMs: 350,
  windowLateMs: 250,
  /** Faixas: offset < −earlyMs = adiantado; > lateMs = atrasado; no meio = no tempo. */
  earlyMs: 120,
  lateMs: 80,

  /** Lateral do alvo para cruzada/paralela (m). */
  crossX: 3.5,
  /** Contato com abs(x) abaixo disto é "no centro": cruzada/paralela usam o lado do golpe. */
  centerContactX: 1,

  /** Profundidade do alvo: z = −(depthBase + depthPerPower × power). */
  depthBase: 4,
  depthPerPower: 6.5,
  /** Velocidade horizontal (m/s) = speedBase + speedPerPower × power. */
  speedBase: 12,
  speedPerPower: 9,
  /** Folga mínima (m) da bola sobre a rede. */
  netClearance: 0.3,

  /** Lado errado (modo híbrido): força × wrongSidePower, tempo de voo × wrongSideFlight. */
  wrongSidePower: 0.5,
  wrongSideFlight: 1.4,
  /**
   * Benefício da dúvida: com abs(margem do lado) abaixo disto (escala −2 a 2), o celular não tem certeza
   * do golpe e a tela não pune "lado errado". Valor inicial, não medido.
   */
  sideDoubtMargin: 0.3,

  /** Movimento automático: bola além disto (m) para o lado do backhand → posiciona de backhand. */
  backhandX: 1.0,
  /** Distância lateral (m) entre o corpo e o ponto de contato (a raquete fica a 0,7 m do corpo). */
  reach: 0.7,

  /** Parede (modo Parede): face em z = wallZ, 0,6 m atrás da linha de fundo; largura 2 × wallHalfWidth, altura (m). */
  wallZ: -12.5,
  wallHalfWidth: 5.5,
  wallHeight: 4,
  /**
   * Volta da parede: vz = abs(vz) × wallRestitution, limitado a [wallMinSpeed, wallMaxSpeed] m/s; vx × wallSideDamp.
   * O plano previa 9–14; com a parede a 21,8 m do jogador, 9 m/s vira um balão de ~9 m de altura (2,4 s no ar,
   * simulado). 12–16 dá arcos de 3 a 6 m e 1,4 a 1,8 s até o jogador. Valor inicial, não medido em jogo.
   */
  wallRestitution: 0.75,
  wallMinSpeed: 12,
  wallMaxSpeed: 16,
  wallSideDamp: 0.6,
  /** A volta quica do lado do jogador entre estas profundidades (m), com abs(x) até wallReturnMaxX. */
  wallBounceMinZ: 3,
  wallBounceMaxZ: 8.5,
  wallReturnMaxX: 3.5,
  /** Altura (m) com que a volta deve chegar à linha de contato: onde fica a raquete. */
  wallContactY: 1.0,

  /** Treino com alvos: máquina de bolas no fundo do lado de lá, lançando a machineSpeed m/s (em z). */
  machineZ: -11,
  machineSpeed: 13,
  /** Nas lições de cruzada e paralela, a máquina manda a bola a esta distância (m) do centro, do lado do forehand. */
  machineSideX: 2,
  /** Raio do alvo circular (m), usado na lição 3 (bola funda). */
  targetRadius: 1.2,
  /**
   * Lição 1 (no tempo): faixa central, qualquer força. Lição 2 (bola curta): área central entre a rede e a
   * linha de saque (z = −6,4), aceitando força até ~0,37. Meia largura = metade do caminho até a cruzada (±3,5).
   */
  centerHalfWidth: 1.75,
  shortNearZ: -0.2,
  shortFarZ: -6.4,
  /**
   * Cruzada e paralela: o alvo é uma faixa ao longo da lateral (vale qualquer força; só a direção conta).
   * Meia largura (m) em torno de x = ±crossX e limites em z (do lado da rede ao fundo).
   */
  laneHalfWidth: 1.2,
  laneNearZ: -3.5,
  laneFarZ: -11.5,
  /** Acertos para passar de lição. */
  hitsToAdvance: 3,
};
