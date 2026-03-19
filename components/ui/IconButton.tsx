
import React from 'react';

export const IconButton = ({ icon, onClick, color = "blue", title }: { icon: React.ReactNode, onClick: React.MouseEventHandler<HTMLButtonElement>, color?: string, title?: string }) => {
  const colors: { [key: string]: string } = {
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100",
    rose: "text-rose-600 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100"
  };
  return (
    <button 
      type="button"
      onClick={onClick} 
      title={title} 
      className={`p-2 rounded-lg transition-all active:scale-90 flex items-center justify-center ${colors[color] || colors.blue}`}
    >
      {icon}
    </button>
  );
};
