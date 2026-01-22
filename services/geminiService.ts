import { GoogleGenAI } from "@google/genai";
import { Tournament } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const analyzeTournament = async (tournament: Tournament): Promise<string> => {
  const ai = getClient();
  if (!ai) {
    return "Klucz API nie został skonfigurowany. Analiza AI niedostępna.";
  }

  // Format data for the model
  const leaderboard = tournament.players
    .sort((a, b) => (b.finalTotal || b.eliminationTotal) - (a.finalTotal || a.eliminationTotal))
    .slice(0, 5)
    .map(p => `${p.name} (Wynik: ${p.finalTotal || p.eliminationTotal})`)
    .join(", ");

  const prompt = `
    Jesteś komentatorem sportowym ligi bowlingowej.
    Oto dane z turnieju "${tournament.name}" (Data: ${tournament.date}).
    Top 5 graczy: ${leaderboard}.
    
    Napisz krótkie, ekscytujące podsumowanie turnieju w języku polskim. 
    Wyróżnij zwycięzcę i wspomnij o poziomie rywalizacji. 
    Maksymalnie 3 zdania.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Błąd generowania analizy.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Wystąpił błąd podczas łączenia z asystentem AI.";
  }
};