import React from 'react';
import { formatMoney } from '../lib/utils';

interface StatBoxProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: 'blue' | 'indigo' | 'emerald' | 'rose';
    onClick?: () => void;
    isBlurred?: boolean;
}

export const StatBox = ({ label, value, icon, color, onClick, isBlurred }: StatBoxProps) => {
    const colors: { [key: string]: string } = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 border-blue-100 dark:border-blue-900/50',
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-900/50',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-900/50',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 border-rose-100 dark:border-rose-900/50'
    };

    return (
        <div
            onClick={onClick}
            className={`bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-[1.75rem] border dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 shadow-sm transition-all ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-95 hover:border-blue-400' : ''} ${colors[color]}`}
        >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 bg-white dark:bg-slate-800 shadow-sm">{icon}</div>
            <div className="min-w-0 w-full leading-tight">
                <p className="text-[9px] sm:text-[10px] font-black opacity-60 uppercase tracking-widest mb-1 break-words whitespace-normal">{label}</p>
                <p className={`text-base sm:text-xl font-black dark:text-white leading-none transition-all duration-300 truncate ${isBlurred ? 'blur-md select-none opacity-50' : ''}`}>
                    R$ {formatMoney(value)}
                </p>
            </div>
        </div>
    );
};
