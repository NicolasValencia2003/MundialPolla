import type { Prediction, ScoredPrediction } from "./types";

// Total goal distance: |predicted home - actual home| + |predicted away - actual away|.
// Lowest distance wins. Distance 0 means an exact-score hit.
export function goalDistance(
  p: Pick<Prediction, "home_goals" | "away_goals">,
  finalHome: number,
  finalAway: number
): number {
  return Math.abs(p.home_goals - finalHome) + Math.abs(p.away_goals - finalAway);
}

// Returns every prediction annotated with its distance and whether it won.
// Ties (same lowest distance) are all marked as winners — co-winners.
export function scorePredictions(
  predictions: Prediction[],
  finalHome: number,
  finalAway: number
): { scored: ScoredPrediction[]; winners: ScoredPrediction[] } {
  if (predictions.length === 0) return { scored: [], winners: [] };

  const withDistance = predictions.map((p) => ({
    ...p,
    distance: goalDistance(p, finalHome, finalAway),
    exact: p.home_goals === finalHome && p.away_goals === finalAway,
    isWinner: false,
  }));

  // Sort by closeness, then by who submitted first (purely for stable display order).
  withDistance.sort(
    (a, b) => a.distance - b.distance || a.created_at.localeCompare(b.created_at)
  );

  const best = withDistance[0].distance;
  for (const p of withDistance) {
    p.isWinner = p.distance === best;
  }

  return {
    scored: withDistance,
    winners: withDistance.filter((p) => p.isWinner),
  };
}
