import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, title, message, onConfirm, onCancel 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-w-sm w-full p-6 relative">
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-900">
            <AlertTriangle size={24} />
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          <p className="text-slate-400 text-sm mb-6">{message}</p>
          
          <div className="flex gap-3 w-full">
            <button 
              onClick={onCancel}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors"
            >
              Anuluj
            </button>
            <button 
              onClick={onConfirm}
              className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold shadow-lg shadow-red-900/20 transition-colors"
            >
              Usuń
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};