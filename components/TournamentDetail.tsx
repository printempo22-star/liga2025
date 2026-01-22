import React, { useState, useEffect, useMemo } from 'react';
import { Tournament, PlayerScore, UserRole } from '../types';
import { RULES } from '../constants';
import { calculateEliminationStats, calculateFinalScore, assignRanksAndPoints, sortPlayers, generateId } from '../utils/bowlingLogic';
import { ImportModal } from './ImportModal';
import { analyzeTournament } from '../services/geminiService';
import { Save, Plus, Trash2, Users, Trophy, Sparkles, Lock, ArrowRight, UserPlus, ClipboardPaste, ArrowDownUp } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

interface TournamentDetailProps {
  tournament: Tournament;
  role: UserRole;
  onUpdate: (updated: Tournament) => void;
  onBack: () => void;
}

type Tab = 'PLAYERS' | 'ELIMINATION' | 'FINALS' | 'RESULTS';

export const TournamentDetail: React.FC<TournamentDetailProps> = ({ tournament, role, onUpdate, onBack }) => {
  const [activeTab, setActiveTab] = useState<Tab>('PLAYERS');
  const [localPlayers, setLocalPlayers] = useState<PlayerScore[]>(tournament.players);
  const [showImport, setShowImport] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // State for sorting in Tab 3
  const [sortByAvg, setSortByAvg] = useState(false);

  // Deletion modal state
  const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);

  const isAdmin = role === UserRole.ADMIN;
  const isGuest = role === UserRole.GUEST;

  // Sync prop changes
  useEffect(() => {
    setLocalPlayers(tournament.players);
  }, [tournament]);

  // Auto-save logic wrapper
  const updatePlayers = (newPlayers: PlayerScore[]) => {
    const recalculated = assignRanksAndPoints(newPlayers);
    setLocalPlayers(recalculated); // Keeps original order
    onUpdate({ ...tournament, players: recalculated });
  };

  const handleScoreChange = (id: string, field: 'g1' | 'g2' | 'g3' | 'finalGame', value: string) => {
    if (!isAdmin) return;
    const numValue = value === '' ? 0 : parseInt(value, 10);
    
    const updated = localPlayers.map(p => {
      if (p.id !== id) return p;
      const updatedPlayer = { ...p, [field]: isNaN(numValue) ? 0 : numValue };
      // Recalc stats immediately
      const withElim = calculateEliminationStats(updatedPlayer);
      return calculateFinalScore(withElim);
    });
    
    updatePlayers(updated);
  };

  const handleNameChange = (id: string, newName: string) => {
    if (!isAdmin) return;
    const updated = localPlayers.map(p => p.id === id ? { ...p, name: newName } : p);
    updatePlayers(updated);
  };

  const handleAddPlayer = () => {
    if (!isAdmin) return;
    const newPlayer: PlayerScore = {
      id: generateId(),
      name: `Nowy Gracz ${localPlayers.length + 1}`,
      isFemale: false,
      g1: 0, g2: 0, g3: 0,
      finalGame: null,
      eliminationTotal: 0,
      eliminationAvg: 0,
      finalTotal: null,
      rank: null,
      rankingPoints: 0
    };
    updatePlayers([...localPlayers, newPlayer]);
  };

  // Handle pasting columns from Excel (supports multi-column paste via tabs)
  const handlePaste = (e: React.ClipboardEvent, startPlayerId: string, startField: 'g1' | 'g2' | 'g3' | 'finalGame', viewList: PlayerScore[]) => {
    if (!isAdmin) return;
    e.preventDefault();
    
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    // Split by new line to get rows
    const rows = pasteData.split(/\r?\n/).filter(r => r.trim() !== '');
    if (rows.length === 0) return;

    // Find the starting index in the CURRENT VISIBLE LIST
    const startIndex = viewList.findIndex(p => p.id === startPlayerId);
    if (startIndex === -1) return;

    const elimFields = ['g1', 'g2', 'g3'];
    const updates = new Map<string, Partial<PlayerScore>>();

    rows.forEach((row, rowIndex) => {
        const targetPlayerIndex = startIndex + rowIndex;
        if (targetPlayerIndex >= viewList.length) return;

        const player = viewList[targetPlayerIndex];
        const columns = row.split('\t');
        const playerUpdates: Partial<PlayerScore> = {};

        columns.forEach((val, colIndex) => {
            const numVal = parseInt(val.trim(), 10);
            if (isNaN(numVal)) return;

            if (startField !== 'finalGame') {
                const startFieldIndex = elimFields.indexOf(startField);
                if (startFieldIndex !== -1) {
                    const targetFieldIndex = startFieldIndex + colIndex;
                    if (targetFieldIndex < elimFields.length) {
                        const targetField = elimFields[targetFieldIndex];
                        playerUpdates[targetField as 'g1' | 'g2' | 'g3'] = numVal;
                    }
                }
            } else if (colIndex === 0) {
                 playerUpdates.finalGame = numVal;
            }
        });

        if (Object.keys(playerUpdates).length > 0) {
            updates.set(player.id, playerUpdates);
        }
    });

    const newPlayers = localPlayers.map(p => {
        if (updates.has(p.id)) {
            const changes = updates.get(p.id)!;
            const updatedP = { ...p, ...changes };
            const withElim = calculateEliminationStats(updatedP);
            return calculateFinalScore(withElim);
        }
        return p;
    });

    updatePlayers(newPlayers);
  };

  const handleImport = (imported: PlayerScore[]) => {
    updatePlayers([...localPlayers, ...imported]);
  };

  const initiateDeletePlayer = (id: string) => {
    if(!isAdmin) return;
    setPlayerToDelete(id);
  };

  const confirmDeletePlayer = () => {
    if (playerToDelete) {
      updatePlayers(localPlayers.filter(p => p.id !== playerToDelete));
      setPlayerToDelete(null);
    }
  };

  const handleToggleGender = (id: string) => {
    if(!isAdmin) return;
    const updated = localPlayers.map(p => {
       if(p.id !== id) return p;
       const pNew = { ...p, isFemale: !p.isFemale };
       return calculateFinalScore(calculateEliminationStats(pNew));
    });
    updatePlayers(updated);
  };

  const handleAiAnalyze = async () => {
    setIsAnalyzing(true);
    const text = await analyzeTournament({ ...tournament, players: localPlayers });
    setAiAnalysis(text);
    setIsAnalyzing(false);
  };

  // Logic to identify finalists based on score
  const finalistsIds = useMemo(() => {
    // Sort a copy to find who qualifies
    const sorted = [...localPlayers].sort((a, b) => {
        if (b.eliminationTotal !== a.eliminationTotal) return b.eliminationTotal - a.eliminationTotal;
        return a.name.localeCompare(b.name);
    });
    return new Set(sorted.slice(0, RULES.FINALISTS_COUNT).map(p => p.id));
  }, [localPlayers]);

  // Tab 2 View:
  // Admin -> Original Order
  // Guest -> Sorted by Score Descending
  const eliminationView = useMemo(() => {
    if (isGuest) {
        return [...localPlayers].sort((a, b) => b.eliminationTotal - a.eliminationTotal);
    }
    return localPlayers;
  }, [localPlayers, isGuest]);

  // Tab 3 View: Top 12. 
  const finalsView = useMemo(() => {
      const finalists = localPlayers.filter(p => finalistsIds.has(p.id));
      if (sortByAvg) {
          return [...finalists].sort((a, b) => b.eliminationAvg - a.eliminationAvg);
      }
      return finalists;
  }, [localPlayers, finalistsIds, sortByAvg]);

  // Tab 4 View: Fully sorted
  const resultsView = useMemo(() => {
      return sortPlayers(localPlayers, 'FINAL');
  }, [localPlayers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800 p-6 rounded-lg border border-slate-700">
        <div>
          <button onClick={onBack} className="text-sm text-slate-400 hover:text-white mb-2">&larr; Powrót do listy</button>
          <h1 className="text-3xl font-bold text-white">{tournament.name}</h1>
          <p className="text-slate-400">{tournament.date}</p>
        </div>
        
        <div className="flex gap-2">
           <button 
             onClick={handleAiAnalyze}
             disabled={isAnalyzing}
             className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded shadow-lg shadow-purple-900/20 disabled:opacity-50"
           >
             <Sparkles size={18} />
             {isAnalyzing ? 'Analizowanie...' : 'AI Komentarz'}
           </button>
           {isAdmin && (
             <div className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-800 rounded text-xs flex items-center">
                <Lock size={12} className="mr-1"/> Tryb Administratora
             </div>
           )}
           {isGuest && (
             <div className="px-3 py-1 bg-blue-900/30 text-blue-400 border border-blue-800 rounded text-xs flex items-center">
                <Users size={12} className="mr-1"/> Tryb Gościa
             </div>
           )}
        </div>
      </div>

      {aiAnalysis && (
        <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg text-purple-200 relative animate-in fade-in slide-in-from-top-4">
            <button onClick={() => setAiAnalysis(null)} className="absolute top-2 right-2 text-purple-400 hover:text-white"><Trash2 size={16}/></button>
            <h4 className="font-bold mb-1 flex items-center gap-2"><Sparkles size={16} /> Asystent Turniejowy:</h4>
            <p className="text-sm leading-relaxed">{aiAnalysis}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex border-b border-slate-700 space-x-1 overflow-x-auto pb-1">
        {[
          { id: 'PLAYERS', label: '1. Zawodnicy', icon: Users },
          { id: 'ELIMINATION', label: '2. Eliminacje', icon: Trophy },
          { id: 'FINALS', label: '3. Finał (Top 12)', icon: Trophy },
          { id: 'RESULTS', label: '4. Wyniki', icon: Save },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap rounded-t-lg
              ${activeTab === tab.id 
                ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-500' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 min-h-[500px]">
        
        {/* TAB: PLAYERS */}
        {activeTab === 'PLAYERS' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Lista Startowa ({localPlayers.length})</h2>
              {isAdmin && (
                <div className="flex gap-2">
                   <button 
                    onClick={handleAddPlayer}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium"
                   >
                     <Plus size={16} /> Dodaj Gracza
                   </button>
                   <button 
                    onClick={() => setShowImport(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium"
                   >
                     <UserPlus size={16} /> Import Excel
                   </button>
                </div>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase font-medium">
                  <tr>
                    <th className="p-3">Lp.</th>
                    <th className="p-3">Imię i Nazwisko</th>
                    <th className="p-3 text-center">Płeć (HDCP +8)</th>
                    <th className="p-3 text-center">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {localPlayers.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-750">
                      <td className="p-3">{idx + 1}</td>
                      <td className="p-3 font-medium text-white">
                        <input 
                           type="text"
                           disabled={!isAdmin}
                           value={p.name}
                           onChange={(e) => handleNameChange(p.id, e.target.value)}
                           className="bg-transparent border-b border-transparent focus:border-blue-500 hover:border-slate-600 outline-none w-full py-1"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button 
                           onClick={() => handleToggleGender(p.id)}
                           disabled={!isAdmin}
                           className={`px-3 py-1 rounded text-xs font-bold ${p.isFemale ? 'bg-pink-900 text-pink-300 border border-pink-700' : 'bg-blue-900 text-blue-300 border border-blue-700'}`}
                        >
                          {p.isFemale ? 'KOBIETA (+8)' : 'MĘŻCZYZNA'}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        {isAdmin && (
                            <button onClick={() => initiateDeletePlayer(p.id)} className="text-red-400 hover:text-red-300 p-2 hover:bg-slate-700 rounded transition-colors" title="Usuń">
                                <Trash2 size={18} />
                            </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {localPlayers.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-500">Brak zawodników. Użyj przycisku Dodaj lub Importuj.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ELIMINATION */}
        {activeTab === 'ELIMINATION' && (
           <div className="space-y-4">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Runda Eliminacyjna (3 Gry)</h2>
                <div className="flex items-center gap-4">
                    {isAdmin && <div className="text-xs text-blue-400 flex items-center gap-1"><ClipboardPaste size={14}/> Wklej 3 kolumny z Excela w pole "Gra 1"</div>}
                    <div className="text-sm text-slate-400">
                        {isGuest ? 'Widok: Posortowany wg wyniku.' : 'Widok: Kolejność wprowadzania.'} Top 12 awansuje.
                    </div>
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase font-medium">
                        <tr>
                            <th className="p-2 text-left">{isGuest ? 'Msc' : 'Lp.'} / Gracz</th>
                            <th className="p-2 w-20 text-center">HDCP</th>
                            <th className="p-2 w-24 text-center">Gra 1</th>
                            <th className="p-2 w-24 text-center">Gra 2</th>
                            <th className="p-2 w-24 text-center">Gra 3</th>
                            <th className="p-2 w-24 text-right font-bold text-blue-400">SUMA</th>
                            <th className="p-2 w-24 text-right">Średnia</th>
                            {isAdmin && <th className="p-2 w-10 text-center"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {eliminationView.map((p, idx) => (
                            <tr key={p.id} className={`hover:bg-slate-750 ${finalistsIds.has(p.id) ? 'bg-blue-900/10' : ''}`}>
                                <td className="p-2 font-medium text-white">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 text-xs w-6">{idx + 1}.</span>
                                        {p.name}
                                        {finalistsIds.has(p.id) && <span className="ml-2 text-xs text-green-400 font-bold bg-green-900/30 px-1 rounded">Q</span>}
                                    </div>
                                </td>
                                <td className="p-2 text-center text-xs">{p.isFemale ? `+${RULES.FEMALE_HDCP}` : '-'}</td>
                                {['g1', 'g2', 'g3'].map((g) => (
                                    <td key={g} className="p-2 text-center">
                                        <input 
                                            type="number" 
                                            disabled={!isAdmin}
                                            value={p[g as keyof PlayerScore] as number || ''}
                                            onChange={(e) => handleScoreChange(p.id, g as any, e.target.value)}
                                            onPaste={(e) => handlePaste(e, p.id, g as any, eliminationView)}
                                            className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center text-white focus:border-blue-500 outline-none disabled:opacity-50"
                                            placeholder="0"
                                        />
                                    </td>
                                ))}
                                <td className="p-2 text-right font-bold text-blue-300 text-base">{p.eliminationTotal}</td>
                                <td className="p-2 text-right text-slate-400">{p.eliminationAvg.toFixed(1)}</td>
                                {isAdmin && (
                                    <td className="p-2 text-center">
                                        <button onClick={() => initiateDeletePlayer(p.id)} className="text-red-400 hover:text-red-300 opacity-50 hover:opacity-100 p-1" title="Usuń zawodnika">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
           </div>
        )}

        {/* TAB: FINALS */}
        {activeTab === 'FINALS' && (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Trophy className="text-amber-500" /> Finał (Top {RULES.FINALISTS_COUNT})
                    </h2>
                    <button 
                      onClick={() => setSortByAvg(!sortByAvg)}
                      className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded border transition-colors ${
                        sortByAvg 
                          ? 'bg-blue-600 border-blue-500 text-white' 
                          : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'
                      }`}
                    >
                      <ArrowDownUp size={16} /> {sortByAvg ? 'Sortuj: Średnia Elim.' : 'Sortuj: Kolejność Wprow.'}
                    </button>
                </div>
                
                <div className="bg-amber-900/20 border border-amber-800 p-4 rounded text-amber-100 text-sm mb-4">
                    Zasada: Wynik Końcowy = Wynik Gry Finałowej + Średnia z Eliminacji.
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-slate-300">
                        <thead className="bg-slate-900 text-slate-400 uppercase font-medium">
                            <tr>
                                <th className="p-3 text-left">Gracz</th>
                                <th className="p-3 text-right">Średnia Elim.</th>
                                <th className="p-3 text-center text-amber-500 font-bold w-32">GRA FINAŁOWA</th>
                                <th className="p-3 text-center">HDCP</th>
                                <th className="p-3 text-right font-bold text-xl text-white">WYNIK KOŃCOWY</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {/* Display Finalists in Entry Order (finalsView) */}
                            {finalsView.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-750">
                                    <td className="p-3 font-medium text-white text-lg">{p.name}</td>
                                    <td className="p-3 text-right text-slate-400">{p.eliminationAvg.toFixed(2)}</td>
                                    <td className="p-3 text-center">
                                        <input 
                                            type="number" 
                                            disabled={!isAdmin}
                                            placeholder="0"
                                            value={p.finalGame === null ? '' : p.finalGame}
                                            onChange={(e) => handleScoreChange(p.id, 'finalGame', e.target.value)}
                                            onPaste={(e) => handlePaste(e, p.id, 'finalGame', finalsView)}
                                            className="w-24 bg-slate-900 border border-amber-700/50 rounded p-2 text-center text-white text-lg font-bold focus:border-amber-500 outline-none focus:ring-1 focus:ring-amber-500"
                                        />
                                    </td>
                                    <td className="p-3 text-center text-xs">{p.isFemale ? `+${RULES.FEMALE_HDCP}` : '0'}</td>
                                    <td className="p-3 text-right font-bold text-2xl text-amber-400">
                                        {p.finalTotal !== null ? p.finalTotal.toFixed(2) : '-'}
                                    </td>
                                </tr>
                            ))}
                            {finalsView.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-6 text-center text-slate-500">
                                        Brak wyników eliminacji. Wprowadź punkty w zakładce 2, aby wyłonić Top 12.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* TAB: RESULTS */}
        {activeTab === 'RESULTS' && (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-white">Klasyfikacja Końcowa Turnieju</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                        <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-3">Podium</h3>
                        {resultsView.slice(0, 3).map((p, i) => (
                            <div key={p.id} className="flex items-center gap-4 mb-3 p-3 bg-slate-800 rounded border border-slate-700">
                                <div className={`text-2xl font-bold w-10 text-center ${i===0?'text-yellow-400':i===1?'text-gray-300':'text-amber-700'}`}>
                                    {i+1}
                                </div>
                                <div className="flex-1">
                                    <div className="text-white font-bold text-lg">{p.name}</div>
                                    <div className="text-xs text-slate-400">
                                        Śr. Elim: {p.eliminationAvg.toFixed(2)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-blue-400 font-bold text-xl">{p.rankingPoints} pkt</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-slate-300">
                            <thead className="bg-slate-900 text-slate-400 uppercase font-medium">
                                <tr>
                                    <th className="p-2 text-left">Msc</th>
                                    <th className="p-2 text-left">Gracz</th>
                                    <th className="p-2 text-right">Pkt Rank</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {resultsView.slice(3).map((p, i) => (
                                    <tr key={p.id}>
                                        <td className="p-2 text-slate-500">{i + 4}</td>
                                        <td className="p-2">
                                          <div className="text-white font-medium">{p.name}</div>
                                          <div className="text-xs text-slate-500">Śr. Elim: {p.eliminationAvg.toFixed(2)}</div>
                                        </td>
                                        <td className="p-2 text-right font-mono text-blue-400">{p.rankingPoints}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />}
      
      {/* Player Deletion Confirmation */}
      <ConfirmationModal
        isOpen={!!playerToDelete}
        title="Usuwanie Zawodnika"
        message="Czy na pewno usunąć tego zawodnika? Wszystkie jego wyniki z tego turnieju zostaną usunięte."
        onConfirm={confirmDeletePlayer}
        onCancel={() => setPlayerToDelete(null)}
      />
    </div>
  );
};