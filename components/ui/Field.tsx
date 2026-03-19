import React from 'react';

interface FieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  suffixIcon?: React.ReactNode;
}

export const Field = ({ label, value, onChange, type = 'text', placeholder = "", suffixIcon }: FieldProps) => (
  <div className="flex flex-col gap-1 w-full">
    <label className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <div className="relative">
      <input 
        type={type} 
        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-semibold outline-none focus:border-blue-500 transition-all dark:text-white shadow-sm" 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} 
      />
      {suffixIcon && <div className="absolute right-2.5 top-1/2 -translate-y-1/2">{suffixIcon}</div>}
    </div>
  </div>
);