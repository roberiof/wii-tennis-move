// Tipos mínimos da API AirConsole 1.11.0, só do que o POC usa.
// Fonte: https://www.airconsole.com/api/airconsole-1.11.0.js

interface AirConsoleOptions {
  orientation?: string;
  synchronize_time?: boolean;
  setup_document?: boolean;
  /** Intervalo em ms do onDeviceMotion. Só controles. */
  device_motion?: number;
  silence_inactive_players?: boolean;
}

/** A doc diz só "x, y, z for accelerometer; alpha, beta, gamma for gyroscope". Unidade não documentada. */
interface AirConsoleMotion {
  x: number;
  y: number;
  z: number;
  alpha: number;
  beta: number;
  gamma: number;
}

declare class AirConsole {
  static SCREEN: number;
  constructor(opts?: AirConsoleOptions);
  onReady: (code: string) => void;
  onConnect: (device_id: number) => void;
  onDisconnect: (device_id: number) => void;
  onMessage: (device_id: number, data: unknown) => void;
  onDeviceMotion: (data: AirConsoleMotion) => void;
  message(device_id: number, data: unknown): void;
  getServerTime(): number;
  getDeviceId(): number;
  getControllerDeviceIds(): number[];
}
