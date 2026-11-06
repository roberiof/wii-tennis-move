// Relógio do jogo na tela. Com o AirConsole pronto, é o relógio do servidor (getServerTime), o mesmo
// em que o celular carimba o `t` do swing; sem ele (teclado, fora do simulador), performance.now().

export interface Clock {
  now(): number;
  /** true quando `now()` já é o relógio do servidor. */
  readonly synced: boolean;
  setReady(): void;
}

export function createClock(ac: AirConsole | null): Clock {
  let ready = false;
  return {
    now: () => (ready && ac ? ac.getServerTime() : performance.now()),
    get synced() {
      return ready && ac !== null;
    },
    setReady: () => {
      ready = true;
    },
  };
}
