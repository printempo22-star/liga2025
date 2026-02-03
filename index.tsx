import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
    Trophy, Users, Plus, Trash2, LogOut, LayoutDashboard, Award, 
    X, Download, HardDrive, Calendar, ArrowRight, Save, Sparkles, 
    UserPlus, ClipboardPaste, ArrowDownUp, FileJson
} from 'lucide-react';

// --- KONFIGURACJA ---
const CREDENTIALS = { 
    ADMIN: { user: 'admin', pass: 'liga2025' },
    GUEST: { user: 'gość', pass: 'gość123' }
};
const RULES = { FEMALE_HDCP: 8, FINALISTS_COUNT: 12, MAX_RANKING_POINTS: 24 };
const STORAGE_KEY = 'bowling_league_2025_data';

// --- LOGIKA POMOCNICZA ---
const generateId = () => Math.random().toString(36).substring(2, 15);

const calculatePlayerStats = (player: any) => {
    const hdcp = player.isFemale ? RULES.FEMALE_HDCP : 0;
    const g1 = Number(player.g1) || 0;
    const g2 = Number(player.g2) || 0;
    const g3 = Number(player.g3) || 0;
    
    const eliminationTotal = g1 + g2 + g3 + (hdcp * 3);
    const eliminationAvg = eliminationTotal / 3;
    
    let finalTotal = null;
    if (player.finalGame !== null && player.finalGame !== undefined && player.finalGame !== "") {
        finalTotal = Number(player.finalGame) + hdcp + eliminationAvg;
    }

    return { ...player, eliminationTotal, eliminationAvg, finalTotal };
};

const processRanks = (players: any[]) => {
    const calculated = players.map(calculatePlayerStats);
    const sortedByElim = [...calculated].sort((a, b) => b.eliminationTotal - a.eliminationTotal);
    const finalistsIds = new Set(sortedByElim.slice(0, RULES.FINALISTS_COUNT).map(p => p.id));

    const finalOrder = [...calculated].sort((a, b) => {
        const aFin = finalistsIds.has(a.id);
        const bFin = finalistsIds.has(b.id);
        if (aFin && !bFin) return -1;
        if (!aFin && bFin) return 1;
        if (aFin && bFin) {
            const scoreA = a.finalTotal || 0;
            const scoreB = b.finalTotal || 0;
            if (Math.abs(scoreB - scoreA) > 0.01) return scoreB - scoreA;
            return b.eliminationAvg - a.eliminationAvg;
        }
        return b.eliminationTotal - a.eliminationTotal;
    });

    return calculated.map(p => {
        const rank = finalOrder.findIndex(x => x.id === p.id) + 1;
        const points = Math.max(0, RULES.MAX_RANKING_POINTS - (rank - 1));
        return { ...p, rank, rankingPoints: points };
    });
};

// --- GŁÓWNY PROGRAM ---
const App = () => {
    const [role, setRole] = useState<'NONE' | 'ADMIN' | 'GUEST'>('NONE');
    const [loginForm, setLoginForm] = useState({ user: 'gość', pass: '' });
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [view, setView] = useState<'DASHBOARD' | 'TOURNAMENT' | 'RANKING'>('DASHBOARD');
    const [activeId, setActiveId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [showAdd, setShowAdd] = useState(false);

    useEffect(() => {
        const hideOverlay = () => {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.style.display = 'none';
        };

        const loadData = async () => {
            try {
                // Próba wczytania data.json z ignorowaniem błędów sieciowych/CORS
                const response = await fetch('data.json?t=' + Date.now()).catch(() => null);
                if (response && response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setTournaments(data);
                        hideOverlay();
                        return;
                    }
                }
            } catch (err) {
                console.log("Tryb offline/lokalny - używam LocalStorage");
            }
            
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setTournaments(JSON.parse(saved));
            hideOverlay();
        };

        loadData();
    }, []);

    useEffect(() => {
        if (tournaments.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
        }
    }, [tournaments]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (loginForm.user === 'admin' && loginForm.pass === CREDENTIALS.ADMIN.pass) setRole('ADMIN');
        else if (loginForm.user === 'gość' && loginForm.pass === CREDENTIALS.GUEST.pass) setRole('GUEST');
        else setError('Błędne hasło');
    };

    const handleDownload = () => {
        const blob = new Blob([JSON.stringify(tournaments, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.json';
        a.click();
    };

    if (role === 'NONE') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
                <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-800 animate-in">
                    <div className="text-center mb-6">
                        <Award size={64} className="text-blue-500 mx-auto mb-2" />
                        <h1 className="text-2xl font-bold">Liga Bowlingowa</h1>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <select className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white" value={loginForm.user} onChange={e=>setLoginForm({...loginForm, user: e.target.value})}>
                            <option value="gość">Logowanie: Gość</option>
                            <option value="admin">Logowanie: Admin</option>
                        </select>
                        <input type="password" placeholder="Hasło" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white" value={loginForm.pass} onChange={e=>setLoginForm({...loginForm, pass: e.target.value})} />
                        {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                        <button className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold">Zaloguj</button>
                    </form>
                </div>
            </div>
        );
    }

    const activeTournament = tournaments.find(t => t.id === activeId);

    return (
        <div className="min-h-screen flex flex-col bg-slate-950">
            <nav className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-40 shadow-lg">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="font-bold text-xl flex items-center gap-2 cursor-pointer" onClick={() => setView('DASHBOARD')}>
                        <Trophy className="text-blue-500" /> Liga 2025
                    </div>
                    <button onClick={() => setRole('NONE')} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><LogOut size={20}/></button>
                </div>
            </nav>

            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
                {view === 'DASHBOARD' && (
                    <div className="space-y-8 animate-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold">Pulpit</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setView('RANKING')} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm">Ranking</button>
                                {role === 'ADMIN' && <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 rounded-lg text-sm">+ Nowy</button>}
                            </div>
                        </div>

                        {role === 'ADMIN' && (
                            <div className="bg-blue-900/10 border border-blue-800/50 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                                <p className="text-slate-400 text-sm">Aby zapisać dane na stałe na GitHubie: pobierz plik i podmień go w folderze projektu.</p>
                                <button onClick={handleDownload} className="bg-green-600 px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Download size={18}/> Pobierz data.json</button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {tournaments.map(t => (
                                <div key={t.id} onClick={() => {setActiveId(t.id); setView('TOURNAMENT')}} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 cursor-pointer hover:border-blue-500 transition-all shadow-md">
                                    <div className="text-xs text-slate-500 mb-1">{t.date}</div>
                                    <h3 className="text-xl font-bold mb-4">{t.name}</h3>
                                    <div className="flex justify-between items-center text-sm text-slate-400">
                                        <span>{t.players?.length || 0} graczy</span>
                                        <ArrowRight size={18} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'TOURNAMENT' && activeTournament && (
                    <TournamentDetail 
                        tournament={activeTournament} 
                        role={role} 
                        onBack={() => setView('DASHBOARD')}
                        onUpdate={(upt: any) => setTournaments(tournaments.map(x => x.id === upt.id ? upt : x))}
                        onDelete={(id: string) => { if(confirm('Usunąć turniej?')) { setTournaments(tournaments.filter(x => x.id !== id)); setView('DASHBOARD'); } }}
                    />
                )}

                {view === 'RANKING' && <RankingView tournaments={tournaments} onBack={() => setView('DASHBOARD')} />}
            </main>

            {showAdd && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 w-full max-w-sm">
                        <h3 className="text-xl font-bold mb-4">Dodaj Turniej</h3>
                        <form onSubmit={(e: any) => {
                            e.preventDefault();
                            const newT = { id: generateId(), name: e.target.name.value, date: e.target.date.value, players: [] };
                            setTournaments([newT, ...tournaments]);
                            setShowAdd(false);
                        }} className="space-y-4">
                            <input name="name" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3" placeholder="Nazwa" required />
                            <input name="date" type="date" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3" defaultValue={new Date().toISOString().split('T')[0]} required />
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={()=>setShowAdd(false)} className="flex-1 bg-slate-800 py-3 rounded-lg">Anuluj</button>
                                <button className="flex-1 bg-blue-600 py-3 rounded-lg font-bold">Stwórz</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const TournamentDetail = ({ tournament, role, onBack, onUpdate, onDelete }: any) => {
    const [tab, setTab] = useState('PLAYERS');
    const isAdmin = role === 'ADMIN';

    const handleUpdate = (newList: any[]) => {
        onUpdate({ ...tournament, players: processRanks(newList) });
    };

    const finalistsIds = useMemo(() => {
        const sorted = [...(tournament.players || [])].sort((a,b) => b.eliminationTotal - a.eliminationTotal);
        return new Set(sorted.slice(0, RULES.FINALISTS_COUNT).map(p => p.id));
    }, [tournament.players]);

    return (
        <div className="space-y-6 animate-in">
            <div className="flex justify-between items-center">
                <button onClick={onBack} className="text-slate-400 hover:text-white">&larr; Wróć</button>
                <h1 className="text-2xl font-bold">{tournament.name}</h1>
                {isAdmin && <button onClick={() => onDelete(tournament.id)} className="text-red-500"><Trash2 size={20}/></button>}
            </div>

            <div className="flex border-b border-slate-800 overflow-x-auto gap-2">
                {[
                    {id:'PLAYERS', l:'Zawodnicy'}, 
                    {id:'ELIM', l:'Eliminacje'}, 
                    {id:'FINAL', l:'Finał'}, 
                    {id:'RESULTS', l:'Wyniki'}
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-slate-500'}`}>{t.l}</button>
                ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                {tab === 'PLAYERS' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg">Zgłoszeni gracze</h3>
                            {isAdmin && <button onClick={() => handleUpdate([...(tournament.players || []), { id: generateId(), name: 'Nowy', isFemale: false, g1:0, g2:0, g3:0, finalGame: null }])} className="bg-blue-600 px-3 py-1 rounded text-sm">+ Dodaj</button>}
                        </div>
                        <table className="w-full text-sm">
                            <thead className="text-left text-slate-500 border-b border-slate-800"><tr><th className="py-2">Gracz</th><th>Płeć (HDCP)</th>{isAdmin && <th>Usuń</th>}</tr></thead>
                            <tbody>
                                {(tournament.players || []).map((p: any) => (
                                    <tr key={p.id} className="border-b border-slate-800/50">
                                        <td className="py-2"><input disabled={!isAdmin} className="bg-transparent w-full outline-none focus:text-blue-400" value={p.name} onChange={e => handleUpdate(tournament.players.map((x:any)=>x.id===p.id?{...x,name:e.target.value}:x))} /></td>
                                        <td><button disabled={!isAdmin} onClick={() => handleUpdate(tournament.players.map((x:any)=>x.id===p.id?{...x,isFemale:!x.isFemale}:x))} className={`px-2 py-1 rounded text-[10px] ${p.isFemale?'bg-pink-900 text-pink-300':'bg-slate-800 text-slate-400'}`}>{p.isFemale?'Kobieta (+8)':'Mężczyzna'}</button></td>
                                        {isAdmin && <td><button onClick={()=>handleUpdate(tournament.players.filter((x:any)=>x.id!==p.id))} className="text-red-900 hover:text-red-500"><Trash2 size={16}/></button></td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {tab === 'ELIM' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-slate-500 border-b border-slate-800"><tr><th className="py-2">Gracz</th><th>G1</th><th>G2</th><th>G3</th><th className="text-right">Suma</th></tr></thead>
                            <tbody>
                                {(tournament.players || []).map((p: any) => (
                                    <tr key={p.id} className={`border-b border-slate-800/50 ${finalistsIds.has(p.id) ? 'bg-blue-500/5' : ''}`}>
                                        <td className="py-2 font-medium">{p.name} {p.isFemale && <span className="text-[10px] text-pink-500">(+24)</span>}</td>
                                        {['g1','g2','g3'].map(g => (
                                            <td key={g}><input disabled={!isAdmin} type="number" className="w-12 bg-slate-800 border border-slate-700 rounded p-1 text-center" value={p[g]||''} onChange={e=>handleUpdate(tournament.players.map((x:any)=>x.id===p.id?{...x,[g]:parseInt(e.target.value)||0}:x))} /></td>
                                        ))}
                                        <td className="text-right font-bold text-blue-400">{p.eliminationTotal}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {tab === 'FINAL' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-slate-500 border-b border-slate-800"><tr><th className="py-2">Gracz</th><th className="text-center">Gra Finałowa</th><th className="text-right">Wynik Total</th></tr></thead>
                            <tbody>
                                {(tournament.players || []).filter((p: any) => finalistsIds.has(p.id)).sort((a:any,b:any)=>b.eliminationTotal-a.eliminationTotal).map((p: any) => (
                                    <tr key={p.id} className="border-b border-slate-800/50">
                                        <td className="py-2 font-bold">{p.name}</td>
                                        <td className="text-center"><input disabled={!isAdmin} type="number" className="w-16 bg-slate-800 border border-amber-900 rounded p-1 text-center font-bold text-amber-500" value={p.finalGame ?? ''} onChange={e=>handleUpdate(tournament.players.map((x:any)=>x.id===p.id?{...x,finalGame:e.target.value===''?null:parseInt(e.target.value)}:x))} /></td>
                                        <td className="text-right font-black text-amber-400">{p.finalTotal ? p.finalTotal.toFixed(2) : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {finalistsIds.size === 0 && <p className="text-center py-10 text-slate-500">Brak zawodników w finale. Uzupełnij wyniki eliminacji.</p>}
                    </div>
                )}

                {tab === 'RESULTS' && (
                    <div className="space-y-2">
                        {(tournament.players || []).sort((a:any,b:any)=>b.rankingPoints - a.rankingPoints).map((p:any, i:number) => (
                            <div key={p.id} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl border border-slate-800">
                                <span className="text-sm"><span className="text-slate-500 mr-2">{i+1}.</span> <span className="font-bold">{p.name}</span></span>
                                <span className="text-blue-400 font-bold">{p.rankingPoints} pkt</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const RankingView = ({ tournaments, onBack }: any) => {
    const stats = useMemo(() => {
        const map = new Map();
        tournaments.forEach((t: any) => {
            (t.players || []).forEach((p: any) => {
                const s = map.get(p.name) || { name: p.name, points: 0, count: 0 };
                s.points += p.rankingPoints || 0;
                s.count++;
                map.set(p.name, s);
            });
        });
        return Array.from(map.values()).sort((a: any, b: any) => b.points - a.points);
    }, [tournaments]);

    return (
        <div className="space-y-6 animate-in">
            <button onClick={onBack} className="text-slate-500">&larr; Wróć</button>
            <h2 className="text-2xl font-bold">Ranking Generalny</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-950 text-slate-500"><tr><th className="p-4 w-12">#</th><th className="p-4">Gracz</th><th className="p-4">Gry</th><th className="p-4 text-right">Punkty</th></tr></thead>
                    <tbody>
                        {stats.map((s, i) => (
                            <tr key={s.name} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                <td className="p-4 font-mono text-slate-600">#{i+1}</td>
                                <td className="p-4 font-bold">{s.name}</td>
                                <td className="p-4 text-slate-400">{s.count}</td>
                                <td className="p-4 text-right font-black text-blue-400 text-xl">{s.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

try {
    const rootEl = document.getElementById('root');
    if (rootEl) {
        const root = createRoot(rootEl);
        root.render(<App />);
    }
} catch (e) {
    console.error("Krytyczny błąd renderowania:", e);
}
