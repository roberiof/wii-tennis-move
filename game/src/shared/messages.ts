export interface SwingMessage {
  type: "swing";
  power: number;
  side: 1 | -1; // 1 = forehand, -1 = backhand
  t: number;
}

export interface PlayerAssignMessage {
  type: "player";
  index: number;
  color: string;
}
