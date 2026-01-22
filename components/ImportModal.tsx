import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { PlayerScore } from '../types';
import { generateId } from '../utils/bowlingLogic';

interface ImportModalProps {
  onClose: () => void;
  onImport: (players: PlayerScore[]) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport }) => {
  const [text, setText] = useState('');

  const handleProcess = () => {
    const lines = text.split('\n');
    const newPlayers: PlayerScore[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // Expected format: "Name [TAB/COMMA] Gender(optional)" or just "Name"
      // If gender column exists and contains 'K' or 'F' or 'W', set isFemale.
      // Just simple parsing for now.
      const parts = trimmed.split(/[\t,;]+/);
      const name = parts[0].trim();
      let isFemale = false;
      
      if (parts.length > 1) {
        const gender = parts[1].toLowerCase();
        if (gender.includes('k') || gender.includes('f') || gender.includes('w')) {
          isFemale = true;
        }
      }

      if (name) {
        newPlayers.push({
          id: generateId(),
          name,
          isFemale,
          g1: 0, g2: 0, g3: 0,
          finalGame: null,
          eliminationTotal: 0,
          eliminationAvg: 0,
          finalTotal: null,
          rank: null,
          rankingPoints: 0
        });
      }
    });

    onImport(newPlayers);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-lg w-full p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Upload size={20} /> Import Zawodników
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <p className="text-slate-300 text-sm mb-2">
          Wklej listę z Excela. Format: <code>Imię Nazwisko [Tab] Płeć (opcjonalnie)</code>.
          Jeśli w kolumnie płeć wpiszesz "K", system naliczy handicap dla kobiet.
        </p>

        <textarea
          className="w-full h-64 bg-slate-900 border border-slate-700 rounded p-3 text-slate-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder={"Jan Kowalski\tM\nAnna Nowak\tK\n..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded">
            Anuluj
          </button>
          <button 
            onClick={handleProcess}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
          >
            Przetwórz i Dodaj
          </button>
        </div>
      </div>
    </div>
  );
};