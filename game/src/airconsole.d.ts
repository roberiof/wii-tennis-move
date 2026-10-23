declare class AirConsole {
  static SCREEN: number;
  constructor(opts?: { device_motion?: number; synchronize_time?: boolean });
  onReady: (code: string) => void;
  onMessage: (from: number, data: unknown) => void;
  onDeviceMotion: (data: { x: number; y: number; z: number; alpha: number; beta: number; gamma: number }) => void;
  message(to: number, data: unknown): void;
  broadcast(data: unknown): void;
  getDeviceId(): number;
  getServerTime(): number;
  vibrate(ms: number): void;
}
