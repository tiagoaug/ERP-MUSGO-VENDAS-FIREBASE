
import React, { useState, useMemo } from 'react';
import { Cheque, Supplier, Purchase } from '../types';
import { formatMoney, formatDate } from '../lib/utils';
import { MagnifyingGlass, FileText, Calendar, WarningCircle, CheckCircle, EyeSlash } from '@phosphor-icons/react';

interface ChequeControlCardProps {
    cheques: Cheque[];
    suppliers: Supplier[];
    purchases: Purchase[];
    onHide: () => void;
}

export const ChequeControlCard = ({ cheques, suppliers, purchases, onHide }: ChequeControlCardProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');

    const filteredCheques = useMemo(() => {
        return cheques.filter(c => {
            const supplier = suppliers.find(s => s.id === c.supplierId);
            const purchase = purchases.find(p => p.id === c.purchaseId);
            const search = searchTerm.toLowerCase();
            const matchesSearch =
                c.number.toLowerCase().includes(search) ||
                (supplier?.name || '').toLowerCase().includes(search) ||
                (purchase?.purchaseNumber || '').toLowerCase().includes(search) ||
                (c.purchaseId || '').toLowerCase().includes(search);

            const matchesStatus =
                filterStatus === 'all' ||
                (filterStatus === 'pending' && !c.isPaid) ||
                (filterStatus === 'paid' && c.isPaid);

            return matchesSearch && matchesStatus;
        }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [cheques, suppliers, searchTerm, filterStatus]);

    const getMaturityInfo = (dueDate: string, isPaid: boolean) => {
        if (isPaid) return { label: 'Liquidado', color: 'text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-800' };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate + 'T00:00:00');
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { label: `Vencido (${Math.abs(diffDays)}d)`, color: 'text-rose-600', bgColor: 'bg-rose-50 dark:bg-rose-900/10 border-rose-200' };
        if (diffDays === 0) return { label: 'Vence Hoje', color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' };

        return {
            label: `Vence em ${diffDays}d`,
            color: diffDays <= 7 ? 'text-rose-600' : 'text-emerald-600',
            bgColor: diffDays <= 7 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200'
        };
    };

    return (
        <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] p-5 sm:p-8 shadow-sm flex flex-col h-full overflow-hidden transition-all">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg">
                        <FileText size={18} weight="fill" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase dark:text-white leading-none tracking-widest text-indigo-600">Controle de Cheques</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{filteredCheques.length} Cheques Encontrados</p>
                    </div>
                </div>
                <button onClick={onHide} className="text-slate-400 hover:text-slate-600 transition-colors" title="Ocultar Card" aria-label="Ocultar Card">
                    <EyeSlash size={20} />
                </button>
            </div>

            <div className="space-y-4 mb-6">
                <div className="relative">
                    <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Nº Cheque, Fornecedor ou ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-[10px] font-black uppercase outline-none focus:border-indigo-500 transition-all dark:text-white"
                    />
                </div>
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button onClick={() => setFilterStatus('all')} className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${filterStatus === 'all' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-400'}`}>Tudo</button>
                    <button onClick={() => setFilterStatus('pending')} className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${filterStatus === 'pending' ? 'bg-white dark:bg-slate-700 shadow text-rose-600' : 'text-slate-400'}`}>Pendentes</button>
                    <button onClick={() => setFilterStatus('paid')} className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${filterStatus === 'paid' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-400'}`}>Liquidados</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 max-h-[400px]">
                {filteredCheques.map(c => {
                    const supplier = suppliers.find(s => s.id === c.supplierId);
                    const maturity = getMaturityInfo(c.dueDate, c.isPaid);
                    return (
                        <div key={c.id} className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 group hover:scale-[1.01] ${c.isPaid ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 opacity-60 grayscale' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-500 shadow-sm'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                            <span className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400">CHEQUE Nº {c.number}</span>
                                        </div>
                                        {c.isPaid ?
                                            <CheckCircle size={14} className="text-emerald-500" weight="fill" /> :
                                            <WarningCircle size={14} className={maturity.color} weight="fill" />
                                        }
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{supplier?.name || 'Fornecedor Desconhecido'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black dark:text-white">R$ {formatMoney(c.amount)}</p>
                                    <p className="text-[8px] font-black text-indigo-600 uppercase">
                                        {purchases.find(p => p.id === c.purchaseId)?.purchaseNumber || 'Dívida S/ Nº'}
                                    </p>
                                </div>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg border flex items-center justify-between ${maturity.bgColor}`}>
                                <div className="flex items-center gap-2">
                                    <Calendar size={12} weight="bold" className={maturity.color} />
                                    <span className={`text-[9px] font-black uppercase ${maturity.color}`}>{maturity.label}</span>
                                </div>
                                {!c.isPaid && (
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Vecto: {formatDate(c.dueDate)}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
                {filteredCheques.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 opacity-30">
                        <FileText size={40} weight="thin" />
                        <p className="text-[10px] font-black uppercase mt-2">Nenhum cheque encontrado</p>
                    </div>
                )}
            </div>
        </div>
    );
};
