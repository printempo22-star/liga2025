export enum UserRole {
  ADMIN = 'ADMIN',
  GUEST = 'GUEST',
  NONE = 'NONE'
}

export interface PlayerScore {
  id: string;
  name: string;
  isFemale: boolean;
  g1: number;
  g2: number;
  g3: number;
  finalGame: number | null; // Null if not in finals or not played yet
  
  // Computed values for caching/performance
  eliminationTotal: number;
  eliminationAvg: number;
  finalTotal: number | null; // (ElimAvg + FinalGame + HDCP)
  rank: number | null;
  rankingPoints: number; // 24, 23, etc.
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  players: PlayerScore[];
  isFinished: boolean;
}

export interface GlobalPlayerStats {
  name: string;
  totalPoints: number;
  tournamentsPlayed: number;
  globalAverage: number; // For tie-breaking
  history: { tournamentName: string; points: number }[];
}