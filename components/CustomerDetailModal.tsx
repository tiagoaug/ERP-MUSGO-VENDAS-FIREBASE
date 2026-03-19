
import React, { useState, useMemo } from 'react';
import { Customer, Sale, Purchase, Supplier, Receipt } from '../types';
import { Field } from './ui/Field';
import { IconButton } from './ui/IconButton';
import { X, PencilSimple, FileText, User, ClockCounterClockwise, MapPin, MagnifyingGlass, Note, Wallet, Warning, CurrencyDollar } from '@phosphor-icons/react';
import { formatMoney, formatDate } from '../lib/utils';
import { exportCustomerHistoryPDF } from '../lib/pdfGenerator';

const Pencil = PencilSimple;
const History = ClockCounterClockwise;
const Search = MagnifyingGlass;
const StickyNote = Note;
const AlertCircle = Warning;

interface CustomerDetailModalProps {
    customer: Customer;
    sales: Sale[];
    purchases?: Purchase[];
    suppliers?: Supplier[];
    receipts?: Receipt[];
    onClose: () => void;
    onUpdate: (c: Customer) => void;
    onReceivePayment?: (saleId: string) => void;
}

const handleOpenMaps = (address: string) => {
    if (address) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    } else {
        window.open('https://www.google.com/maps', '_blank');
    }
};

export const CustomerDetailModal = ({ customer, sales, purchases = [], suppliers = [], receipts = [], onClose, onUpdate, onReceivePayment }: CustomerDetailModalProps) => {
    const [activeTab, setActiveTab] = useState<'data' | 'financial' | 'history'>('financial');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(customer);
    const [searchTerm, setSearchTerm] = useState('');

    // Encontrar se este cliente também é um fornecedor
    const linkedSupplier = useMemo(() => {
        return suppliers.find(s =>
            s.name.toLowerCase() === customer.name.toLowerCase() ||
            (s.phone && s.phone === customer.phone)
        );
    }, [suppliers, customer]);

    // Filtrar compras vinculadas a este fornecedor
    const relatedPurchases = useMemo(() => {
        if (!linkedSupplier) return [];
        return purchases.filter(p => p.supplierId === linkedSupplier.id);
    }, [purchases, linkedSupplier]);

    // Unificar histórico
    const unifiedHistory = useMemo(() => {
        const mappedSales = sales.map(s => ({ ...s, historyEntryType: 'venda' as const }));
        const mappedPurchases = relatedPurchases.map(p => ({ ...p, historyEntryType: 'compra' as const }));
        const mappedReceipts = receipts.map(r => ({ ...r, historyEntryType: 'recebimento' as const }));

        const combined = [...mappedSales, ...mappedPurchases, ...mappedReceipts];

        return combined
            .filter(item => {
                const search = searchTerm.toLowerCase();
                if ('saleNumber' in item) return item.saleNumber.toLowerCase().includes(search);
                if ('purchaseNumber' in item) return item.purchaseNumber.toLowerCase().includes(search);
                if ('receiptNumber' in item) return item.receiptNumber.toLowerCase().includes(search);
                return true;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [sales, relatedPurchases, receipts, searchTerm]);

    // Cálculos Financeiros
    const financialSummary = useMemo(() => {
        const validSales = sales.filter(s => s.status !== 'Cancelada');
        const validReceipts = receipts; // assumindo que recebimento não tem status "Cancelada" explicitamente

        const totalPurchased = validSales.reduce((acc, s) => acc + s.totalValue, 0) + validReceipts.reduce((acc, r) => acc + r.totalValue, 0);
        const totalPaid = validSales.reduce((acc, s) => acc + s.amountPaid, 0) + validReceipts.reduce((acc, r) => acc + (r.amountPaid || 0), 0);
        const totalDebt = (validSales.reduce((acc, s) => acc + s.totalValue, 0) - validSales.reduce((acc, s) => acc + s.amountPaid, 0)) +
            (validReceipts.reduce((acc, r) => acc + r.totalValue, 0) - validReceipts.reduce((acc, r) => acc + (r.amountPaid || 0), 0));
        const openOrders = validSales.filter(s => !s.isPaid).length + validReceipts.filter(r => !r.isPaid).length;

        // Financeiro como Fornecedor (opcional, para visualização rápida)
        const totalSupplied = relatedPurchases.reduce((acc, p) => acc + p.totalValue, 0);
        const totalPaidToSupplier = relatedPurchases.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
        const totalPayableDebt = totalSupplied - totalPaidToSupplier;

        return { totalPurchased, totalPaid, totalDebt, openOrders, totalSupplied, totalPayableDebt };
    }, [sales, relatedPurchases, receipts]);

    const handleSave = () => {
        onUpdate(formData);
        setIsEditing(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slideUp overflow-hidden">
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">{customer.name.charAt(0)}</div>
                        <div>
                            <h3 className="text-sm font-black uppercase dark:text-white leading-none">{customer.name}</h3>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">ID: {customer.id}</span>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Fechar" title="Fechar" className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex border-b dark:border-slate-800 p-1 bg-white dark:bg-slate-900 overflow-x-auto">
                    <button onClick={() => setActiveTab('financial')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'financial' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <Wallet size={14} /> Financeiro
                    </button>
                    <button onClick={() => setActiveTab('data')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'data' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <User size={14} /> Dados
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'history' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <History size={14} /> Histórico
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    {activeTab === 'financial' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700">
                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Total Comprado (Histórico)</p>
                                    <p className="text-xl font-black text-blue-600">R$ {formatMoney(financialSummary.totalPurchased)}</p>
                                </div>
                                <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-100 dark:border-rose-800">
                                    <p className="text-[9px] font-black uppercase text-rose-500 mb-1 flex items-center gap-1"><AlertCircle size={12} /> Pendente (Dívida)</p>
                                    <p className="text-xl font-black text-rose-600">R$ {formatMoney(financialSummary.totalDebt)}</p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl overflow-hidden">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700 flex justify-between items-center">
                                    <h4 className="text-[10px] font-black uppercase text-slate-500">Pedidos em Aberto ({financialSummary.openOrders})</h4>
                                </div>
                                <div className="divide-y dark:divide-slate-700 max-h-48 overflow-y-auto custom-scrollbar">
                                    {sales.filter(s => !s.isPaid).map(s => (
                                        <div key={s.id} className="p-3 flex justify-between items-center text-[10px]">
                                            <div>
                                                <p className="font-bold text-blue-600">{s.saleNumber}</p>
                                                <p className="text-slate-400">{formatDate(s.date)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-700 dark:text-slate-300">Total: R$ {formatMoney(s.totalValue)}</p>
                                                <p className="font-bold text-rose-500">Falta: R$ {formatMoney(s.totalValue - s.amountPaid)}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {sales.filter(s => !s.isPaid && s.status !== 'Cancelada').map(s => (
                                        <div key={s.id} className="p-3 flex justify-between items-center text-[10px] group hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <div>
                                                <p className="font-bold text-blue-600 uppercase">{s.saleNumber}</p>
                                                <p className="text-slate-400">{formatDate(s.date)}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="font-bold text-slate-700 dark:text-slate-300">R$ {formatMoney(s.totalValue)}</p>
                                                    <p className="font-bold text-rose-500">Falta: R$ {formatMoney(s.totalValue - s.amountPaid)}</p>
                                                </div>
                                                <IconButton
                                                    icon={<CurrencyDollar size={14} weight="bold" />}
                                                    color="emerald"
                                                    onClick={() => onReceivePayment?.(s.id)}
                                                    title="Receber agora"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {receipts.filter(r => !r.isPaid).map(r => (
                                        <div key={r.id} className="p-3 flex justify-between items-center text-[10px] group hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <div>
                                                <p className="font-bold text-violet-600 uppercase">{r.receiptNumber || 'ENTRADA'}</p>
                                                <p className="text-slate-400">{formatDate(r.date)}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="font-bold text-slate-700 dark:text-slate-300">R$ {formatMoney(r.totalValue)}</p>
                                                    <p className="font-bold text-rose-500">Falta: R$ {formatMoney(r.totalValue - (r.amountPaid || 0))}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {financialSummary.openOrders === 0 && (
                                        <p className="text-center py-4 text-[9px] text-slate-400 uppercase font-bold">Nenhuma pendência financeira.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        isEditing ?
                            <div className="space-y-4 animate-fadeIn">
                                <Field label="Nome Completo" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} />
                                <Field label="Telefone / WhatsApp" value={formData.phone} onChange={v => setFormData({ ...formData, phone: v })} />

                                <div>
                                    <Field
                                        label="Endereço de Entrega"
                                        value={formData.address || ''}
                                        onChange={v => setFormData({ ...formData, address: v })}
                                        placeholder="Rua, nº, bairro..."
                                        suffixIcon={
                                            <button
                                                onClick={() => handleOpenMaps(formData.address || '')}
                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-blue-600 transition-colors"
                                                title="Ver no Google Maps"
                                            >
                                                <MapPin size={16} />
                                            </button>
                                        }
                                    />
                                </div>
                            </div> :
                            <div className="space-y-6 animate-fadeIn">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border dark:border-slate-800">
                                        <span className="text-[8px] font-black uppercase text-slate-400 block mb-2">Informações de Contato</span>
                                        <p className="text-xs font-bold dark:text-white flex items-center gap-2"><b>Telefone:</b> {customer.phone || 'Não cadastrado'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border dark:border-slate-800">
                                        <span className="text-[8px] font-black uppercase text-slate-400 block mb-2">Resumo de Saldo</span>
                                        <p className="text-xs font-bold dark:text-white flex items-center gap-2">
                                            <b>Saldo Sistema:</b>
                                            <span className={customer.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                                R$ {formatMoney(customer.balance)}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border dark:border-slate-800 relative group">
                                    <span className="text-[8px] font-black uppercase text-slate-400 block mb-2">Endereço Principal</span>
                                    <p className="text-xs font-bold dark:text-white leading-relaxed">{customer.address || 'Endereço não informado'}</p>
                                    {customer.address && (
                                        <button onClick={() => handleOpenMaps(customer.address!)} aria-label="Ver endereço no mapa" title="Ver no mapa" className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all active:scale-95">
                                            <MapPin size={16} />
                                        </button>
                                    )}
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
                                        placeholder="Filtrar por nº do pedido..."
                                        className="w-full bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:ring-2 ring-blue-500/10 outline-none"
                                    />
                                </div>
                                <button
                                    onClick={() => window.open('https://keep.google.com', '_blank')}
                                    className="p-2 bg-yellow-400 text-slate-900 rounded-xl shadow-md hover:bg-yellow-500 transition-all"
                                    title="Notas Externas"
                                >
                                    <StickyNote size={18} />
                                </button>
                            </div>

                            <div className="space-y-2">
                                {unifiedHistory.map(item => {
                                    const isSale = item.historyEntryType === 'venda';
                                    const isReceipt = item.historyEntryType === 'recebimento';
                                    const id = item.id;
                                    const number = isSale ? (item as Sale).saleNumber : (isReceipt ? (item as Receipt).receiptNumber : (item as Purchase).purchaseNumber);
                                    const amount = item.totalValue;
                                    const date = item.date;
                                    const isPaid = item.isPaid;
                                    const status = isSale ? (item as Sale).status : (isPaid ? 'Pago' : 'Pendente');

                                    return (
                                        <div key={id} className={`p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl flex justify-between items-center group hover:border-blue-500 transition-all shadow-sm ${isSale && (item as Sale).status === 'Cancelada' ? 'opacity-50 grayscale' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[8px] font-black uppercase ${isSale ? 'bg-blue-50 text-blue-600' : (isReceipt ? 'bg-violet-50 text-violet-600' : 'bg-emerald-50 text-emerald-600')}`}>
                                                    {isSale ? 'VENDA' : (isReceipt ? 'ENTRADA' : 'COMPRA')}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-tight dark:text-white">{number}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase">{formatDate(date)}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-black ${isSale ? 'text-slate-800 dark:text-white' : 'text-slate-500'}`}>R$ {formatMoney(amount)}</p>
                                                <div className="flex justify-end gap-1">
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${status === 'Entregue' || status === 'Pago' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                        {status}
                                                    </span>
                                                    {!isPaid && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                                                        {isSale ? 'Devendo' : (isReceipt ? 'A Receber' : 'A Pagar')}
                                                    </span>}
                                                </div>
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
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 rounded-b-2xl flex justify-between items-center">
                    {activeTab === 'data' ? (
                        isEditing ?
                            <>
                                <button onClick={() => setIsEditing(false)} className="text-[10px] font-black uppercase text-slate-400">Cancelar</button>
                                <button onClick={handleSave} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">Salvar Alterações</button>
                            </>
                            :
                            <>
                                <div />
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all">
                                    <Pencil size={14} /> Editar Cadastro
                                </button>
                            </>
                    ) :
                        <>
                            <div />
                            <button onClick={() => exportCustomerHistoryPDF(customer, sales)} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
                                <FileText size={14} /> Exportar Histórico PDF
                            </button>
                        </>}
                </div>
            </div>
        </div>
    );
};
