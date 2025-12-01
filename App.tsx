import React, { useState, useEffect, useRef } from 'react';
import { UserRole, Tournament } from './types';
import { CREDENTIALS } from './constants';
import { generateId } from './utils/bowlingLogic';
import { LogIn, LogOut, Plus, Trash2, Calendar, LayoutDashboard, Award, X, Save, User, Download, Upload, FileJson } from 'lucide-react';

import { TournamentDetail } from './components/TournamentDetail';
import { RankingTable } from './components/RankingTable';
import { ConfirmationModal } from './components/ConfirmationModal';

const STORAGE_KEY = 'bowling_league_data_v1';

const App = () => {
  const [role, setRole] = useState<UserRole>(UserRole.NONE);
  
  // Login State
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'GUEST'>('GUEST');
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [view, setView] = useState<'DASHBOARD' | 'TOURNAMENT' | 'RANKING'>('DASHBOARD');
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
  
  // Modal state for adding tournament
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState('');
  const [newTournamentDate, setNewTournamentDate] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);

  // Modal state for deletion
  const [tournamentToDelete, setTournamentToDelete] = useState<string | null>(null);

  // Import handling
  const [importCandidate, setImportCandidate] = useState<Tournament[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== 'undefined' && saved !== 'null') {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setTournaments(parsed);
        }
      } catch (e) {
        console.error("Failed to load data", e);
      }
    }
    setDataLoaded(true);
  }, []);

  // Save data
  useEffect(() => {
    if (dataLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
    }
  }, [tournaments, dataLoaded]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedRole === 'ADMIN') {
      if (passwordInput === CREDENTIALS.ADMIN_PASS) {
        setRole(UserRole.ADMIN);
      } else {
        setError('Błędne hasło dla Administratora');
      }
    } else {
      if (passwordInput === CREDENTIALS.GUEST_PASS) {
        setRole(UserRole.GUEST);
      } else {
        setError('Błędne hasło dla Gościa');
      }
    }
  };

  const handleLogout = () => {
    setRole(UserRole.NONE);
    setPasswordInput('');
    setSelectedRole('GUEST');
    setView('DASHBOARD');
  };

  const openAddModal = () => {
    setNewTournamentName('');
    setNewTournamentDate(new Date().toISOString().split('T')[0]);
    setShowAddModal(true);
  };

  const handleAddTournament = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTournamentName || !newTournamentDate) return;

    const newT: Tournament = {
      id: generateId(),
      name: newTournamentName,
      date: newTournamentDate,
      players: [],
      isFinished: false
    };
    
    setTournaments([newT, ...tournaments]);
    setShowAddModal(false);
  };

  const initiateDeleteTournament = (id: string) => {
    setTournamentToDelete(id);
  };

  const confirmDeleteTournament = () => {
    if (tournamentToDelete) {
      setTournaments(tournaments.filter(t => t.id !== tournamentToDelete));
      setTournamentToDelete(null);
    }
  };

  const updateTournament = (updated: Tournament) => {
    setTournaments(tournaments.map(t => t.id === updated.id ? updated : t));
  };

  const openTournament = (id: string) => {
    setActiveTournamentId(id);
    setView('TOURNAMENT');
  };

  // --- Backup Functions ---

  const handleExportData = () => {
    const dataStr = JSON.stringify(tournaments, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `bowling_liga_backup_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          // Validate structure loosely
          if (parsed.length > 0 && (!parsed[0].id || !parsed[0].players)) {
             alert("Nieprawidłowy format pliku (brak struktury turnieju).");
             return;
          }
          // Set as candidate for confirmation
          setImportCandidate(parsed);
        } else {
          alert("Nieprawidłowy format pliku (musi być tablicą JSON).");
        }
      } catch (err) {
        alert("Błąd odczytu pliku JSON.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const confirmImport = () => {
    if (importCandidate) {
      setTournaments(importCandidate);
      setImportCandidate(null);
    }
  };

  if (role === UserRole.NONE) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-lg shadow-xl border border-slate-700 max-w-md w-full">
          <div className="text-center mb-8">
             <div className="inline-block p-4 bg-blue-600 rounded-full mb-4 shadow-lg shadow-blue-900/50">
                <Award size={48} className="text-white" />
             </div>
             <h1 className="text-2xl font-bold text-white">Liga Bowlingowa 2025</h1>
             <p className="text-slate-400">Panel Logowania</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            
            <div>
              <label className="block text-sm text-slate-300 mb-1">Wybierz użytkownika</label>
              <div className="relative">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'ADMIN' | 'GUEST')}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="GUEST">Gość (Podgląd)</option>
                  <option value="ADMIN">Administrator (Edycja)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">Hasło</label>
              <input
                type="password"
                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Wpisz hasło..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>

            {error && <p className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded border border-red-900/50">{error}</p>}
            
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded transition-colors shadow-lg shadow-blue-900/30"
            >
              Zaloguj się
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeTournament = tournaments.find(t => t.id === activeTournamentId);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col relative">
      {/* Navbar */}
      <nav className="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl text-white cursor-pointer" onClick={() => setView('DASHBOARD')}>
            <Award className="text-blue-500" /> Liga Bowlingowa
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:inline">
              Zalogowano jako: <span className="text-white font-medium">{role === UserRole.ADMIN ? 'Administrator' : 'Gość'}</span>
            </span>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Wyloguj"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        
        {view === 'DASHBOARD' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                 <LayoutDashboard /> Pulpit Turniejów
              </h2>
              <div className="flex gap-2 w-full sm:w-auto">
                 <button 
                  onClick={() => setView('RANKING')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded border border-slate-600"
                 >
                   <Award size={18} /> Ranking Ogólny
                 </button>
                 {role === UserRole.ADMIN && (
                   <button 
                    onClick={openAddModal}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg shadow-blue-900/20"
                   >
                     <Plus size={18} /> Nowy Turniej
                   </button>
                 )}
              </div>
            </div>

            {/* Backup / Restore Section */}
            {role === UserRole.ADMIN && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 text-slate-400 text-sm">
                  <div className="p-2 bg-slate-800 rounded border border-slate-700">
                    <FileJson size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <strong className="text-slate-200 block">Kopia Zapasowa Danych</strong>
                    Zapisz bazę danych na dysku lub wczytaj ją na nowym urządzeniu.
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleExportData}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded border border-slate-600"
                  >
                    <Download size={14} /> Pobierz dane (Backup)
                  </button>
                  <button 
                    onClick={handleImportClick}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded border border-slate-600"
                  >
                    <Upload size={14} /> Wczytaj dane
                  </button>
                  <input 
                    type="file" 
                    accept=".json" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                </div>
              </div>
            )}

            {/* Tournament List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.map(t => (
                <div key={t.id} className="group bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-xl overflow-hidden transition-all shadow-lg hover:shadow-blue-900/10 flex flex-col">
                  <div className="p-6 flex-1 cursor-pointer" onClick={() => openTournament(t.id)}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-900/30 text-blue-400 rounded-lg">
                        <Calendar size={24} />
                      </div>
                      <span className="text-xs font-mono text-slate-500 border border-slate-700 px-2 py-1 rounded">{t.date}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{t.name}</h3>
                    <p className="text-slate-400 text-sm">
                      {t.players.length} zawodników • {t.players.filter(p => p.finalGame !== null).length > 0 ? 'W trakcie/Zakończony' : 'Rejestracja'}
                    </p>
                  </div>
                  
                  {role === UserRole.ADMIN && (
                    <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700 flex justify-end">
                      <button 
                        onClick={(e) => { e.stopPropagation(); initiateDeleteTournament(t.id); }}
                        className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} /> Usuń
                      </button>
                    </div>
                  )}
                </div>
              ))}
              
              {tournaments.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                   Brak turniejów. {role === UserRole.ADMIN && 'Dodaj pierwszy turniej!'}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'TOURNAMENT' && activeTournament && (
          <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
             <TournamentDetail 
                tournament={activeTournament} 
                role={role}
                onUpdate={updateTournament}
                onBack={() => setView('DASHBOARD')}
             />
          </div>
        )}

        {view === 'RANKING' && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-300 space-y-6">
            <button onClick={() => setView('DASHBOARD')} className="text-sm text-slate-400 hover:text-white mb-2">&larr; Powrót do pulpitu</button>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Award className="text-yellow-500" /> Ranking Ogólny
            </h2>
            <RankingTable tournaments={tournaments} />
          </div>
        )}

      </main>

      {/* Add Tournament Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
           <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full p-6 relative">
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X size={24} />
              </button>
              
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Plus className="text-blue-500" /> Nowy Turniej
              </h3>
              
              <form onSubmit={handleAddTournament} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Nazwa Turnieju</label>
                  <input 
                    type="text" 
                    required
                    value={newTournamentName}
                    onChange={(e) => setNewTournamentName(e.target.value)}
                    placeholder="np. Puchar Wiosny 2025"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-blue-500 outline-none"
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Data</label>
                  <input 
                    type="date" 
                    required
                    value={newTournamentDate}
                    onChange={(e) => setNewTournamentDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-blue-500 outline-none"
                  />
                </div>
                
                <div className="pt-4 flex gap-3">
                   <button 
                     type="button" 
                     onClick={() => setShowAddModal(false)}
                     className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors"
                   >
                     Anuluj
                   </button>
                   <button 
                     type="submit" 
                     className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold shadow-lg shadow-blue-900/30 transition-colors flex items-center justify-center gap-2"
                   >
                     <Save size={18} /> Utwórz
                   </button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!tournamentToDelete}
        title="Usuwanie Turnieju"
        message="Czy na pewno chcesz usunąć ten turniej? Ta operacja jest nieodwracalna, a wszystkie wyniki zawodników zostaną utracone."
        onConfirm={confirmDeleteTournament}
        onCancel={() => setTournamentToDelete(null)}
      />

      {/* Import Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!importCandidate}
        title="Wczytywanie Bazy Danych"
        message={`Czy na pewno chcesz wczytać bazę danych zawierającą ${importCandidate?.length || 0} turniejów? Obecne dane zostaną nadpisane.`}
        onConfirm={confirmImport}
        onCancel={() => setImportCandidate(null)}
      />

    </div>
  );
};

export default App;