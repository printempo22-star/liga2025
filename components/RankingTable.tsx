import React, { useMemo, useState } from 'react';
import { Tournament, GlobalPlayerStats } from '../types';
import { Trophy, Calendar, FileText, FileSpreadsheet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RankingTableProps {
  tournaments: Tournament[];
}

export const RankingTable: React.FC<RankingTableProps> = ({ tournaments }) => {
  const [selectedTournaments, setSelectedTournaments] = useState<string[]>([]);
  const [useAll, setUseAll] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Initialize selected with all IDs when tournaments change
  React.useEffect(() => {
    if (useAll) {
      setSelectedTournaments(tournaments.map(t => t.id));
    }
  }, [tournaments, useAll]);

  const toggleTournament = (id: string) => {
    if (useAll) {
      setUseAll(false);
      setSelectedTournaments([id]); // Start with just this one
    } else {
      if (selectedTournaments.includes(id)) {
        setSelectedTournaments(prev => prev.filter(tid => tid !== id));
      } else {
        setSelectedTournaments(prev => [...prev, id]);
      }
    }
  };

  const globalStats: GlobalPlayerStats[] = useMemo(() => {
    const statsMap = new Map<string, GlobalPlayerStats>();
    const filteredTournaments = tournaments.filter(t => useAll || selectedTournaments.includes(t.id));

    filteredTournaments.forEach(t => {
      t.players.forEach(p => {
        const key = p.name.trim(); // Identify by name
        if (!statsMap.has(key)) {
          statsMap.set(key, {
            name: p.name,
            totalPoints: 0,
            tournamentsPlayed: 0,
            globalAverage: 0,
            history: []
          });
        }
        
        const entry = statsMap.get(key)!;
        entry.totalPoints += p.rankingPoints;
        entry.tournamentsPlayed += 1;
        entry.history.push({ tournamentName: t.name, points: p.rankingPoints });
        
        // Update average (weighted running avg calculation)
        const currentSum = entry.globalAverage * ((entry.tournamentsPlayed - 1) * 3);
        const newSum = currentSum + p.eliminationTotal;
        entry.globalAverage = newSum / (entry.tournamentsPlayed * 3);
      });
    });

    return Array.from(statsMap.values()).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.globalAverage - a.globalAverage; // Tie-breaker
    });
  }, [tournaments, selectedTournaments, useAll]);

  const chartData = globalStats.slice(0, 10).map(p => ({
    name: p.name.split(' ')[0], // First name for chart
    points: p.totalPoints
  }));

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      // @ts-ignore
      if (!window.jspdf) {
        alert("Błąd: Biblioteka jsPDF nie załadowała się. Odśwież stronę.");
        setIsExporting(false);
        return;
      }

      // Default title without prompt
      const customTitle = "Ranking Ligi Bowlingowej 2025";

      // @ts-ignore
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Data preparation
      const tableColumn = ["Lp.", "Zawodnik", "Turnieje", "Srednia", "Punkty"];
      const tableRows = globalStats.map((stat, index) => [
        index + 1,
        stat.name,
        stat.tournamentsPlayed,
        stat.globalAverage.toFixed(2),
        stat.totalPoints
      ]);

      // --- FONT LOADING LOGIC ---
      let fontLoaded = false;
      try {
        const fetchFont = async () => {
             // Use a very standard font file from CDN that usually has basic latin-ext
             const fontUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf";
             const response = await fetch(fontUrl);
             if (!response.ok) throw new Error("Network response was not ok");
             return await response.arrayBuffer(); 
        };

        // Short timeout - if font takes too long, just render without it
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 2000)
        );

        const buffer = await Promise.race([fetchFont(), timeout]) as ArrayBuffer;
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64data = btoa(binary);

        doc.addFileToVFS("Roboto-Regular.ttf", base64data);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal", "Identity-H");
        doc.setFont("Roboto");
        fontLoaded = true;
      } catch (err) {
        console.warn("Font loading skipped (using fallback):", err);
      }
      // ---------------------------

      // Header
      doc.setFontSize(16);
      doc.text(customTitle, 14, 15);
      
      doc.setFontSize(10);
      doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 22);
      doc.text(`Turnieje wliczane: ${useAll ? tournaments.length : selectedTournaments.length}`, 14, 27);
      
      if (!fontLoaded) {
          doc.setTextColor(220, 38, 38);
          doc.setFontSize(8);
          doc.text("(Polskie znaki mogą nie wyświetlać się poprawnie w trybie offline)", 14, 32);
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(10);
      }

      // Table
      // @ts-ignore
      if (doc.autoTable) {
        // @ts-ignore
        doc.autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: 35,
          styles: { 
            font: fontLoaded ? "Roboto" : "helvetica", 
            fontStyle: "normal",
            fontSize: 10 
          },
          headStyles: { fillColor: [30, 58, 138] },
          theme: 'grid'
        });
        doc.save(`ranking_bowling_${new Date().toISOString().split('T')[0]}.pdf`);
      } else {
        alert("Błąd wtyczki AutoTable.");
      }

    } catch (e) {
      console.error("PDF Export Error:", e);
      alert("Wystąpił błąd podczas generowania PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    try {
       // @ts-ignore
       if (!window.XLSX) {
         alert("Błąd: Biblioteka Excel nie jest dostępna.");
         return;
       }
       const ws_data = [
         ["Miejsce", "Zawodnik", "Liczba Turniejów", "Średnia Eliminacji", "Punkty Rankingowe"],
         ...globalStats.map((stat, index) => [
           index + 1,
           stat.name,
           stat.tournamentsPlayed,
           parseFloat(stat.globalAverage.toFixed(2)),
           stat.totalPoints
         ])
       ];

       // @ts-ignore
       const ws = window.XLSX.utils.aoa_to_sheet(ws_data);
       // @ts-ignore
       const wb = window.XLSX.utils.book_new();
       // @ts-ignore
       window.XLSX.utils.book_append_sheet(wb, ws, "Ranking");
       // @ts-ignore
       window.XLSX.writeFile(wb, `ranking_bowling_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error("Excel Export Error:", e);
      alert("Błąd eksportu Excel.");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Filters */}
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar size={18} /> Wybierz Turnieje do Rankingu
          </h3>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-2 bg-red-900/40 hover:bg-red-800 text-red-200 rounded border border-red-800 transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              <FileText size={16} /> 
              <span className="text-xs font-bold">{isExporting ? 'Generowanie...' : 'PDF'}</span>
            </button>
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3 py-2 bg-green-900/40 hover:bg-green-800 text-green-200 rounded border border-green-800 transition-colors"
            >
              <FileSpreadsheet size={16} /> 
              <span className="text-xs font-bold">Excel</span>
            </button>
            <div className="hidden sm:block w-px bg-slate-600 mx-1"></div>
            <button 
              onClick={() => setUseAll(!useAll)}
              className={`text-sm px-3 py-1 rounded border ${useAll ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-500 text-slate-400'}`}
            >
              {useAll ? 'Ranking Całościowy' : 'Własny Wybór'}
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {tournaments.map(t => (
            <button
              key={t.id}
              onClick={() => toggleTournament(t.id)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                (useAll || selectedTournaments.includes(t.id))
                  ? 'bg-blue-900/50 text-blue-200 border border-blue-700'
                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-600'
              }`}
            >
              {t.name} <span className="opacity-50">({t.date})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table */}
        <div className="lg:col-span-2 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase font-medium">
              <tr>
                <th className="p-4 w-16">#</th>
                <th className="p-4">Zawodnik</th>
                <th className="p-4 text-center">Turnieje</th>
                <th className="p-4 text-center">Średnia (Elim)</th>
                <th className="p-4 text-right">Punkty Rankingowe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {globalStats.map((stat, idx) => (
                <tr key={stat.name} className="hover:bg-slate-750 transition-colors">
                  <td className="p-4 font-mono text-slate-500">{idx + 1}</td>
                  <td className="p-4 font-bold text-white flex items-center gap-2">
                    {idx === 0 && <Trophy size={16} className="text-yellow-400" />}
                    {idx === 1 && <Trophy size={16} className="text-gray-400" />}
                    {idx === 2 && <Trophy size={16} className="text-amber-600" />}
                    {stat.name}
                  </td>
                  <td className="p-4 text-center">{stat.tournamentsPlayed}</td>
                  <td className="p-4 text-center">{stat.globalAverage.toFixed(2)}</td>
                  <td className="p-4 text-right font-bold text-blue-400 text-lg">{stat.totalPoints}</td>
                </tr>
              ))}
              {globalStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Brak danych do wyświetlenia.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Chart */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex flex-col h-[400px]">
          <h3 className="text-white font-bold mb-4">Top 10 - Punkty</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                  itemStyle={{ color: '#60a5fa' }}
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                />
                <Bar dataKey="points" radius={[0, 4, 4, 0]}>
                   {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index < 3 ? '#3b82f6' : '#1e40af'} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};