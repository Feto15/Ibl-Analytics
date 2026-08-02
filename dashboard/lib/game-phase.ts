export type GamePhase = "regular" | "playoffs" | "all";

export const GAME_PHASE_LABELS: Record<GamePhase, string> = {
  regular: "Musim Reguler",
  playoffs: "Playoff",
  all: "Semua Fase",
};

export function gamePhaseLabel(phase: GamePhase): string {
  return GAME_PHASE_LABELS[phase];
}
