
import React from 'react';

interface NavItemProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
}

export const NavItem = ({ active, icon, label, onClick, badge }: NavItemProps) => (
  <button onClick={onClick} className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${active ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'} text-[10px] uppercase tracking-tighter`}>
    {icon} <span>{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-rose-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-pulse">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);
