
import React, { useState, useMemo } from 'react';
import { Customer, Sale, Purchase, Supplier } from '../types';
import { Field } from './ui/Field';
import { IconButton } from './ui/IconButton';
import { X, PencilSimple, FileText, User, ClockCounterClockwise, MapPin, MagnifyingGlass, Note, Wallet, Warning, ArrowClockwise, CurrencyDollar } from '@phosphor-icons/react';
import { formatMoney, formatDate } from '../lib/utils';

const Pencil = PencilSimple;
const History = ClockCounterClockwise;
const Search = MagnifyingGlass;
const StickyNote = Note;
const AlertCircle = Warning;

interface SupplierDetailModalProps {
    supplier: Supplier;
    purchases: Purchase[];
    sales?: Sale[];
    customers?: Customer[];
    onClose: () => void;
    onUpdate: (s: Supplier) => void;
    onAddPayment?: (purchaseId: string) => void;
}

const handleOpenMaps = (address: string) => {
    if (address) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    } else {
        window.open('https://www.google.com/maps', '_blank');
    }
};

export const SupplierDetailModal = ({ supplier, purchases, sales = [], customers = [], onClose, onUpdate, onAddPayment }: SupplierDetailModalProps) => {
    const [activeTab, setActiveTab] = useState<'financial' | 'history' | 'data'>('financial');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(supplier);
    const [searchTerm, setSearchTerm] = useState('');

    // Encontrar se este fornecedor também é um cliente
    const linkedCustomer = useMemo(() => {
        return customers.find(c =>
            c.name.toLowerCase() === supplier.name.toLowerCase() ||
            (c.phone && c.phone === supplier.phone)
        );
    }, [customers, supplier]);

    // Filtrar vendas vinculadas a este cliente
    const relatedSales = useMemo(() => {
        if (!linkedCustomer) return [];
        return sales.filter(s => s.customerId === linkedCustomer.id);
    }, [sales, linkedCustomer]);

    // Unificar histórico
    const unifiedHistory = useMemo(() => {
        const mappedPurchases = purchases.map(p => ({ ...p, historyEntryType: 'compra' as const }));
        const mappedSales = relatedSales.map(s => ({ ...s, historyEntryType: 'venda' as const }));

        const combined = [...mappedPurchases, ...mappedSales];

        return combined
            .filter(item => {
                const search = searchTerm.toLowerCase();
                if ('purchaseNumber' in item) return item.purchaseNumber.toLowerCase().includes(search);
                if ('saleNumber' in item) return item.saleNumber.toLowerCase().includes(search);
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [purchases, relatedSales, searchTerm]);

    // Cálculos Financeiros
    const financialSummary = useMemo(() => {
        const validPurchases = purchases.filter(p => !p.isPaid && (p.accounted ?? true));
        const totalPurchased = purchases.reduce((acc, p) => acc + p.totalValue, 0);
        const totalPaid = purchases.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
        const totalDebt = validPurchases.reduce((acc, p) => acc + (p.totalValue - (p.amountPaid || 0)), 0);
        const openOrders = validPurchases.length;

        // Como Cliente
        const totalSold = relatedSales.reduce((acc, s) => acc + s.totalValue, 0);
        const totalReceived = relatedSales.reduce((acc, s) => acc + s.amountPaid, 0);
        const totalReceivableDebt = totalSold - totalReceived;

        return { totalPurchased, totalPaid, totalDebt, openOrders, totalSold, totalReceivableDebt };
    }, [purchases, relatedSales]);

    const handleSave = () => {
        onUpdate(formData);
        setIsEditing(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slideUp overflow-hidden">
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">{supplier.name.charAt(0)}</div>
                        <div>
                            <h3 className="text-sm font-black uppercase dark:text-white leading-none">{supplier.name}</h3>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Fornecedor • ID: {supplier.id}</span>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex border-b dark:border-slate-800 p-1 bg-white dark:bg-slate-900 overflow-x-auto">
                    <button onClick={() => setActiveTab('financial')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'financial' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <Wallet size={14} /> Financeiro
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'history' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <History size={14} /> Histórico
                    </button>
                    <button onClick={() => setActiveTab('data')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'data' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <User size={14} /> Dados
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    {activeTab === 'financial' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700">
                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Total Comprado</p>
                                    <p className="text-xl font-black text-slate-800 dark:text-white">R$ {formatMoney(financialSummary.totalPurchased)}</p>
                                </div>
                                <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-100 dark:border-rose-800">
                                    <p className="text-[9px] font-black uppercase text-rose-500 mb-1 flex items-center gap-1"><AlertCircle size={12} /> A Pagar (Dívida)</p>
                                    <p className="text-xl font-black text-rose-600">R$ {formatMoney(financialSummary.totalDebt)}</p>
                                </div>
                            </div>

                            {linkedCustomer && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                                    <p className="text-[8px] font-black uppercase text-blue-500 mb-2">Este fornecedor também é Cliente</p>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold text-slate-500 uppercase">Saldo a Receber:</span>
                                        <span className="font-black text-blue-600 uppercase">R$ {formatMoney(financialSummary.totalReceivableDebt)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl overflow-hidden">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700 flex justify-between items-center">
                                    <h4 className="text-[10px] font-black uppercase text-slate-500">Pendências de Pagamento ({financialSummary.openOrders})</h4>
                                </div>
                                <div className="divide-y dark:divide-slate-700 max-h-64 overflow-y-auto custom-scrollbar">
                                    {purchases.filter(p => !p.isPaid).map(p => (
                                        <div key={p.id} className="p-3 space-y-2 group hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <div className="flex justify-between items-center text-[10px]">
                                                <div>
                                                    <p className="font-bold text-emerald-600 uppercase">{p.purchaseNumber}</p>
                                                    <div className="flex gap-2">
                                                        <p className="text-slate-400">Emissão: {formatDate(p.date)}</p>
                                                        <p className="font-black text-rose-500 uppercase">Vencimento: {formatDate(p.dueDate || p.date)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className="font-bold text-slate-700 dark:text-slate-300">Total: R$ {formatMoney(p.totalValue)}</p>
                                                        <p className="font-bold text-rose-500">Falta: R$ {formatMoney(p.totalValue - (p.amountPaid || 0))}</p>
                                                    </div>
                                                    <IconButton
                                                        icon={<CurrencyDollar size={14} weight="bold" />}
                                                        color="emerald"
                                                        onClick={() => onAddPayment?.(p.id)}
                                                        title="Pagar agora"
                                                    />
                                                </div>
                                            </div>

                                            {/* Exibição de Cheques desta compra */}
                                            {p.cheques && p.cheques.length > 0 && (
                                                <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-1">
                                                    {p.cheques.map(c => (
                                                        <div key={c.id} className={`flex justify-between items-center p-2 rounded-lg text-[9px] ${c.isPaid ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 grayscale opacity-60' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border border-blue-100 dark:border-blue-900/10'}`}>
                                                            <div className="flex items-center gap-2">
                                                                <FileText size={12} weight="bold" />
                                                                <span className="font-black">CHEQUE Nº {c.number}</span>
                                                                <span className="font-bold opacity-70">• Venc: {formatDate(c.dueDate)}</span>
                                                            </div>
                                                            <span className="font-black">R$ {formatMoney(c.amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {financialSummary.openOrders === 0 && (
                                        <p className="text-center py-4 text-[9px] text-slate-400 uppercase font-bold">Nenhuma conta a pagar.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                                    <input
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        type="text"
                                        placeholder="Filtrar por nº do pedido/compra..."
                                        className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs font-bold transition-all outline-none ring-blue-500/0 focus:ring-2 focus:ring-blue-500/10"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                {unifiedHistory.map(item => {
                                    const isSale = item.historyEntryType === 'venda';
                                    const id = item.id;
                                    const number = isSale ? (item as Sale).saleNumber : (item as Purchase).purchaseNumber;
                                    const amount = item.totalValue;
                                    const date = item.date;
                                    const isPaid = item.isPaid;

                                    return (
                                        <div key={id} className="p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl flex justify-between items-center group hover:border-blue-500 transition-all shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[8px] font-black uppercase ${isSale ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {isSale ? 'VENDA' : 'COMPRA'}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-tight dark:text-white">{number}</p>
                                                    {(!isSale && ((item as Purchase).itemDescription || (item as Purchase).notes)) && (
                                                        <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5 italic line-clamp-1">
                                                            Motivo: {(item as Purchase).itemDescription || (item as Purchase).notes}
                                                        </p>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Emissão: {formatDate(date)}</p>
                                                        <p className="text-[8px] font-black text-rose-500 uppercase">Venc: {formatDate(item.dueDate || date)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black dark:text-white">R$ {formatMoney(amount)}</p>
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    {isPaid ? 'Pago' : 'Pendente'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {unifiedHistory.length === 0 && (
                                    <div className="text-center py-10 opacity-30">
                                        <History size={30} className="mx-auto mb-2" />
                                        <p className="text-[9px] font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        isEditing ?
                            <div className="space-y-4 animate-fadeIn">
                                <Field label="Razão Social / Nome" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} />
                                <Field label="Contato / Representante" value={formData.contact} onChange={v => setFormData({ ...formData, contact: v })} />
                                <Field label="Telefone" value={formData.phone || ''} onChange={v => setFormData({ ...formData, phone: v })} />
                                <Field label="E-mail" value={formData.email || ''} onChange={v => setFormData({ ...formData, email: v })} />
                            </div> :
                            <div className="space-y-6 animate-fadeIn">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border dark:border-slate-800">
                                        <span className="text-[8px] font-black uppercase text-slate-400 block mb-1">Contato</span>
                                        <p className="text-xs font-bold dark:text-white">{supplier.contact || 'Não informado'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border dark:border-slate-800">
                                        <span className="text-[8px] font-black uppercase text-slate-400 block mb-1">Telefone</span>
                                        <p className="text-xs font-bold dark:text-white">{supplier.phone || 'Não informado'}</p>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border dark:border-slate-800">
                                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-1">E-mail</span>
                                    <p className="text-xs font-bold dark:text-white">{supplier.email || 'Não informado'}</p>
                                </div>
                            </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 rounded-b-2xl flex justify-between items-center">
                    {activeTab === 'data' ? (
                        isEditing ?
                            <>
                                <button onClick={() => setIsEditing(false)} className="text-[10px] font-black uppercase text-slate-400">Cancelar</button>
                                <button onClick={handleSave} className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all">Salvar Alterações</button>
                            </>
                            :
                            <>
                                <div />
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all">
                                    <Pencil size={14} /> Editar Cadastro
                                </button>
                            </>
                    ) :
                        <div />
                    }
                </div>
            </div>
        </div>
    );
};
