declare class AirConsole {
  static SCREEN: number;
  constructor(opts?: { device_motion?: number; synchronize_time?: boolean });
  onReady: (code: string) => void;
  onMessage: (from: number, data: unknown) => void;
  /** Controle entrou (ou recarregou). Fonte: airconsole-1.11.0.js, já usado no POC 01. */
  onConnect: (device_id: number) => void;
  onDisconnect: (device_id: number) => void;
  onDeviceMotion: (data: { x: number; y: number; z: number; alpha: number; beta: number; gamma: number }) => void;
  message(to: number, data: unknown): void;
  broadcast(data: unknown): void;
  getDeviceId(): number;
  getServerTime(): number;
  vibrate(ms: number): void;
}
