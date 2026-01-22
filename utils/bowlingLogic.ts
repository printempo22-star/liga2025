import { PlayerScore, Tournament } from '../types';
import { RULES } from '../constants';

export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const calculateEliminationStats = (player: PlayerScore): PlayerScore => {
  const hdcp = player.isFemale ? RULES.FEMALE_HDCP : 0;
  // Raw scores sum
  const scratchSum = player.g1 + player.g2 + player.g3;
  // HDCP is added to EACH game in elimination? 
  // Requirement: "hdcp + 8 puktów do kazdej gry jesli kobieta"
  const totalHdcp = hdcp * 3;
  
  const eliminationTotal = scratchSum + totalHdcp;
  const eliminationAvg = eliminationTotal / 3;

  return {
    ...player,
    eliminationTotal,
    eliminationAvg
  };
};

export const calculateFinalScore = (player: PlayerScore): PlayerScore => {
  if (player.finalGame === null) {
    return { ...player, finalTotal: null };
  }

  const hdcp = player.isFemale ? RULES.FEMALE_HDCP : 0;
  // Rule 4: "doliczają sie zwodnikowi punkty z gry finałowej + srednia z 3 gier eliminacyjnych"
  // Assuming HDCP also applies to the final game itself.
  const finalGameScore = player.finalGame + hdcp;
  
  // Final Total = Final Game (w/ HDCP) + Elimination Average (w/ HDCP)
  const finalTotal = finalGameScore + player.eliminationAvg;

  return {
    ...player,
    finalTotal
  };
};

export const sortPlayers = (players: PlayerScore[], phase: 'ELIMINATION' | 'FINAL'): PlayerScore[] => {
  return [...players].sort((a, b) => {
    if (phase === 'ELIMINATION') {
      // Sort by Elimination Total descending
      if (b.eliminationTotal !== a.eliminationTotal) {
        return b.eliminationTotal - a.eliminationTotal;
      }
      return a.name.localeCompare(b.name);
    } else {
      // FINAL SORTING
      const scoreA = a.finalTotal ?? -1;
      const scoreB = b.finalTotal ?? -1;

      // If both played finals
      if (scoreA !== -1 && scoreB !== -1) {
        if (Math.abs(scoreA - scoreB) > 0.01) { 
          return scoreB - scoreA;
        }
        // Rule 8: Ex aequo -> higher elimination average
        return b.eliminationAvg - a.eliminationAvg;
      }

      // If A played final, B didn't -> A is higher
      if (scoreA !== -1 && scoreB === -1) return -1;
      if (scoreA === -1 && scoreB !== -1) return 1;

      // Neither played final -> compare elimination totals
      if (b.eliminationTotal !== a.eliminationTotal) {
        return b.eliminationTotal - a.eliminationTotal;
      }
      return b.eliminationAvg - a.eliminationAvg;
    }
  });
};

export const assignRanksAndPoints = (players: PlayerScore[]): PlayerScore[] => {
  // 1. Calculate stats for everyone first (preserve order temporarily)
  const calculated = players.map(p => calculateFinalScore(calculateEliminationStats(p)));

  // 2. Identify Top 12 based on Elimination stats (Sorted Copy)
  const sortedByElim = [...calculated].sort((a, b) => {
     if (b.eliminationTotal !== a.eliminationTotal) return b.eliminationTotal - a.eliminationTotal;
     return a.name.localeCompare(b.name);
  });
  
  const finalistsIds = new Set(sortedByElim.slice(0, RULES.FINALISTS_COUNT).map(p => p.id));

  // 3. Create a sorted copy for Final Rankings (Tab 4 logic) to determine rank/points
  const sortedForRanking = [...calculated].sort((a, b) => {
    const aIsFinalist = finalistsIds.has(a.id);
    const bIsFinalist = finalistsIds.has(b.id);

    if (aIsFinalist && !bIsFinalist) return -1;
    if (!aIsFinalist && bIsFinalist) return 1;

    if (aIsFinalist && bIsFinalist) {
        // Both finalists: compare Final Total
        const scoreA = a.finalTotal || 0;
        const scoreB = b.finalTotal || 0;
        
        if (Math.abs(scoreA - scoreB) > 0.01) return scoreB - scoreA;
        return b.eliminationAvg - a.eliminationAvg;
    }

    // Neither finalist: compare Elim Total
    if (b.eliminationTotal !== a.eliminationTotal) return b.eliminationTotal - a.eliminationTotal;
    return 0;
  });

  // 4. Map ranks to IDs
  const rankMap = new Map<string, { rank: number, points: number }>();
  sortedForRanking.forEach((p, index) => {
      rankMap.set(p.id, {
          rank: index + 1,
          points: Math.max(0, RULES.MAX_RANKING_POINTS - index)
      });
  });

  // 5. Return calculated players in their ORIGINAL order (by mapping the 'calculated' array)
  // This prevents the UI from jumping around when typing.
  return calculated.map(p => {
      const info = rankMap.get(p.id);
      return {
          ...p,
          rank: info ? info.rank : null,
          rankingPoints: info ? info.points : 0
      };
  });
};