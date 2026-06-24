export type MatchState = {
  id: number;
  home_team: string;
  away_team: string;
  kickoff: string | null; // ISO timestamp; predictions lock at this time
  final_home: number | null;
  final_away: number | null;
  updated_at: string;
};

export type Prediction = {
  id: string;
  name: string;
  home_goals: number;
  away_goals: number;
  created_at: string;
};

export type ScoredPrediction = Prediction & {
  distance: number;
  exact: boolean;
  isWinner: boolean;
};
