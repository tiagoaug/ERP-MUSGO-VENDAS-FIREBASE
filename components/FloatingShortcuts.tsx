
import React, { useState } from 'react';
import { ViewType } from '../types';
import {
  House, ShoppingCart, Users, Stack, ShoppingBag, ChartBar,
  Package, ClockCounterClockwise, Truck, ChartPie, Handshake,
  SquaresFour, X, CaretRight, CurrencyDollar
} from '@phosphor-icons/react';

interface FloatingShortcutsProps {
  setView: (view: ViewType) => void;
  isDesktopOnly?: boolean;
}

export const FloatingShortcuts = ({ setView, isDesktopOnly }: FloatingShortcutsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = (view: ViewType) => {
    setView(view);
    setIsOpen(false);
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[80] flex flex-col items-end ${isDesktopOnly ? 'hidden lg:flex' : 'flex'}`}>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[75] animate-fadeIn transition-all duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {isOpen && (
        <div className="mb-4 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 p-2 rounded-[2rem] shadow-2xl flex flex-col gap-1 w-72 animate-slideUp max-h-[75vh] overflow-y-auto custom-scrollbar relative z-[80]">

          <ShortcutListItem icon={<House size={20} weight="duotone" />} label="Início / Dashboard" onClick={() => handleNavigate('dashboard')} color="bg-slate-700" />

          <div className="my-1 border-t border-slate-700/30"></div>

          <ShortcutListItem icon={<ShoppingCart size={20} weight="duotone" />} label="Nova Venda" onClick={() => handleNavigate('vender')} color="bg-emerald-600" />
          <ShortcutListItem icon={<Handshake size={20} weight="duotone" />} label="Relacionamento" onClick={() => handleNavigate('relacionamento')} color="bg-rose-600" />

          <div className="my-1 border-t border-slate-700/30"></div>

          <ShortcutListItem icon={<Users size={20} weight="duotone" />} label="Cadastros" onClick={() => handleNavigate('cadastros')} color="bg-purple-600" />
          <ShortcutListItem icon={<Stack size={20} weight="duotone" />} label="Produtos" onClick={() => handleNavigate('produtos')} color="bg-orange-600" />
          <ShortcutListItem icon={<Package size={20} weight="duotone" />} label="Estoque" onClick={() => handleNavigate('estoque')} color="bg-indigo-600" />

          <div className="my-1 border-t border-slate-700/30"></div>

          <ShortcutListItem icon={<ShoppingBag size={20} weight="duotone" />} label="Compras" onClick={() => handleNavigate('compras')} color="bg-pink-600" />
          <ShortcutListItem icon={<CurrencyDollar size={20} weight="duotone" />} label="Recebimentos" onClick={() => handleNavigate('recebimentos')} color="bg-indigo-500" />
          <ShortcutListItem icon={<ChartBar size={20} weight="duotone" />} label="Financeiro" onClick={() => handleNavigate('financeiro')} color="bg-green-600" />
          <ShortcutListItem icon={<ClockCounterClockwise size={20} weight="duotone" />} label="Histórico" onClick={() => handleNavigate('vendas')} color="bg-cyan-700" />
          <ShortcutListItem icon={<ChartPie size={20} weight="duotone" />} label="Relatórios e Backup" onClick={() => handleNavigate('relatorios')} color="bg-cyan-600" />
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative z-[80] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${isOpen ? 'bg-slate-800 text-white rotate-90 scale-90' : 'bg-orange-400 text-white hover:scale-110 hover:bg-orange-500'}`}
        aria-label="Atalhos de navegação"
      >
        {isOpen ? <X size={28} weight="bold" /> : <SquaresFour size={28} weight="fill" />}
      </button>
    </div>
  );
};

const ShortcutListItem = ({ icon, label, onClick, color }: any) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 p-3 hover:bg-white/10 rounded-2xl transition-all w-full text-left group shrink-0"
  >
    <div className={`w-10 h-10 rounded-xl ${color} text-white flex items-center justify-center shadow-lg shrink-0`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <h4 className="text-[12px] font-black uppercase text-white tracking-wider">{label}</h4>
    </div>
    <CaretRight size={14} weight="bold" className="text-slate-500 group-hover:text-white" />
  </button>
);
