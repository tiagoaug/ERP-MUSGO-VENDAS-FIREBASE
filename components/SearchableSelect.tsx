
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MagnifyingGlass, CaretDown, X, User, CaretRight, CheckCircle, ArrowLeft, Funnel } from '@phosphor-icons/react';
const Search = MagnifyingGlass;
const ChevronDown = CaretDown;
const ChevronRight = CaretRight;
const CheckCircle2 = CheckCircle;
const Filter = Funnel;

interface Option {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const SearchableSelect = ({ label, options, value, onChange, placeholder, onFocus, onBlur }: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => options.find(opt => opt.id === value), [options, value]);

  const filteredOptions = useMemo(() => {
    if (!filter) return options;
    return options.filter(opt => opt.name.toLowerCase().includes(filter.toLowerCase()));
  }, [options, filter]);

  useEffect(() => {
    if (isOpen) {
      onFocus?.();
      // Foco automático dependendo do tamanho da tela
      setTimeout(() => {
        if (window.innerWidth >= 768) {
          inputRef.current?.focus();
        } else {
          mobileInputRef.current?.focus();
        }
      }, 100);
    } else {
      onBlur?.();
    }
  }, [isOpen]);

  // Fecha ao clicar fora (Apenas desktop)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (window.innerWidth >= 768 && wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setFilter('');
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full" ref={wrapperRef}>
      <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] pl-1">
        {label}
      </label>

      {/* TRIGGER (BOTÃO QUE ABRE A SELEÇÃO) */}
      <div
        className={`w-full bg-white dark:bg-slate-900 border-2 rounded-2xl px-4 py-3.5 text-sm font-bold outline-none transition-all dark:text-white shadow-sm flex items-center justify-between cursor-pointer group ${isOpen ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-100 dark:border-slate-800 hover:border-blue-200'}`}
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 rounded-lg ${selectedOption ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
            <User size={16} />
          </div>
          <span className={`truncate leading-tight ${selectedOption ? 'text-slate-800 dark:text-white font-extrabold uppercase' : 'text-slate-400 font-medium'}`}>
            {selectedOption?.name || placeholder || 'Toque para selecionar...'}
          </span>
        </div>
        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
      </div>

      {/* --- MODO DESKTOP (DROPDOWN CLASSICO) --- */}
      {isOpen && (
        <div className="hidden md:block absolute z-[200] mt-16 w-[inherit] min-w-[300px] bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden animate-slideUp">
          <div className="p-4 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 group-focus-within:scale-110 transition-transform" size={18} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Filtrar lista..."
                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 pl-12 pr-10 py-3 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all dark:text-white shadow-inner uppercase"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filteredOptions.map(option => (
              <li
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`px-5 py-3 text-[12px] font-black uppercase cursor-pointer rounded-xl transition-all flex items-center justify-between group ${option.id === value ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300'}`}
              >
                <span className="truncate">{option.name}</span>
                {option.id === value && <CheckCircle2 size={16} />}
              </li>
            ))}
            {filteredOptions.length === 0 && (
              <li className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase list-none">Nenhum resultado</li>
            )}
          </ul>
        </div>
      )}

      {/* --- MODO MOBILE (MODAL FULL SCREEN) --- */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-[9999] bg-white dark:bg-slate-950 flex flex-col animate-fadeIn">
          {/* Header Mobile Expandido */}
          <div className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 shadow-sm shrink-0 flex flex-col gap-2 pt-2 pb-4 px-4">

            {/* Linha 1: Botão Voltar e Título */}
            <div className="flex items-center gap-3 py-2">
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Voltar"
                title="Voltar"
                className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Selecionando</span>
                <h3 className="text-sm font-black uppercase dark:text-white leading-none truncate pr-2">{label}</h3>
              </div>
            </div>

            {/* Linha 2: Campo de Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={18} />
              <input
                ref={mobileInputRef}
                type="text"
                placeholder="Filtrar por nome..."
                className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 pl-10 pr-4 py-3.5 rounded-xl text-sm font-black uppercase outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all dark:text-white shadow-inner"
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              {filter && (
                <button
                  onClick={() => setFilter('')}
                  aria-label="Limpar filtro"
                  title="Limpar"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Lista Mobile */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-slate-50/50 dark:bg-slate-950">
            <div className="flex items-center justify-between px-2 mb-3">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                {filteredOptions.length} Opções
              </p>
              <Filter size={12} className="text-slate-300" />
            </div>

            <div className="space-y-2 pb-10">
              {filteredOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className={`w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] border-2 ${option.id === value ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${option.id === value ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      {option.name.charAt(0)}
                    </div>
                    <span className="text-sm font-black uppercase truncate">{option.name}</span>
                  </div>

                  {option.id === value ? (
                    <CheckCircle2 size={18} className="text-white shrink-0" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-300 shrink-0" />
                  )}
                </button>
              ))}

              {filteredOptions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                  <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Search size={24} className="text-slate-400" />
                  </div>
                  <p className="text-xs font-black uppercase text-slate-500">Nenhum resultado</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">Verifique a ortografia</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
