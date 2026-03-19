
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Customer, Receipt, ReceiptItem, AppGrid, AppColor, ExpenseItem, Variation, BankAccount } from '../types';
import { SearchableSelect } from '../components/SearchableSelect';
import { Field } from '../components/ui/Field';
import { MagnifyingGlass, Plus, X, Cube, Storefront, ShoppingCart, CaretDown, CaretUp, Package, Trash, Check, Hash, ArrowCounterClockwise, PencilSimple, CaretRight, Warning, UserCheck, CheckCircle, EyeSlash, Basket, Calendar, Minus, Image, Calculator, List, ClockCounterClockwise, Receipt as ReceiptIcon, Wallet, CalendarBlank, Chat, UserPlus, ReceiptX, ArrowCircleDown, Stack, TrendUp, FileText, ClipboardText, ArrowRight, Note, Bank } from '@phosphor-icons/react';

// Lucide compat aliases
const Search = MagnifyingGlass;
const Boxes = Cube;
const Box = Cube;
const Store = Storefront;
const Trash2 = Trash;
const RefreshCcw = ArrowCounterClockwise;
const Edit3 = PencilSimple;
const ChevronDown = CaretDown;
const ChevronUp = CaretUp;
const ChevronRight = CaretRight;
const AlertCircle = Warning;
const CheckCircle2 = CheckCircle;
const EyeOff = EyeSlash;
const ShoppingBasket = Basket;
const ImageIcon = Image;
const History = ClockCounterClockwise;
const ReceiptText = ReceiptX;
const CalendarClock = CalendarBlank;
const MessageSquare = Chat;
const Pencil = PencilSimple;
const AlertTriangle = Warning;
const Download = ArrowCircleDown;
const Layers = Stack;
const TrendingUp = TrendUp;
const ClipboardList = ClipboardText;
import { sanitizeNum, formatMoney, generateId, formatDate } from '../lib/utils';
import { IconButton } from '../components/ui/IconButton';
import { CalculatorModal } from '../components/CalculatorModal';

const getColorName = (colorId: string | undefined, colors: AppColor[]) => {
    if (!colorId) return 'Padrão';
    const found = (colors || []).find(c =>
        String(c.id).trim().toLowerCase() === String(colorId).trim().toLowerCase()
    );
    return found ? found.name : colorId;
};

const TabBtn = ({ active, onClick, icon, label, color, badge }: any) => (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-[1.5rem] transition-all relative ${active ? color + ' shadow-lg scale-105' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
        {icon}
        <span className="text-[9px] font-black uppercase">{label}</span>
        {badge && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />}
    </button>
);

const AnnotationModal = ({ item, onSave, onClose }: { item: any, onSave: (notes: string) => void, onClose: () => void }) => {
    const [notes, setNotes] = useState(item.notes || '');
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl flex flex-col animate-slideUp overflow-hidden">
                <div className="p-5 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                        <Note size={18} className="text-blue-500" />
                        <h4 className="text-[10px] font-black uppercase dark:text-white">Anotação do Item</h4>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors" title="Fechar" aria-label="Fechar"><X size={18} /></button>
                </div>
                <div className="p-5">
                    <textarea
                        autoFocus
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Escreva sua anotação aqui..."
                        className="w-full h-32 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500 dark:text-white"
                    />
                    <button onClick={() => onSave(notes)} className="w-full mt-4 py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Salvar Anotação</button>
                </div>
            </div>
        </div>
    );
};

const ReceiptHistoryModal = ({ receipt, products, customers, bankAccounts, onClose, onUpdate, onAddPayment, onDelete }: any) => {
    const [activeTab, setActiveTab] = useState<'items' | 'payments'>('items');
    const [payAmount, setPayAmount] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
    const [payAccountId, setPayAccountId] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editExpenseItems, setEditExpenseItems] = useState<ExpenseItem[]>(receipt.expenseItems || []);
    const [newExpense, setNewExpense] = useState({ description: '', value: '' });

    const customer = customers.find((s: Customer) => s.id === receipt.customerId);

    const handleAddPayment = () => {
        const val = sanitizeNum(payAmount);
        if (val < 0) return alert("Valor inválido");
        onAddPayment(receipt.id, val, payDate, payAccountId || undefined);
        setPayAmount('');
        setPayAccountId('');
    };

    const handleSaveEdit = () => {
        const total = editExpenseItems.reduce((acc, i) => acc + i.value, 0);
        onUpdate({
            ...receipt,
            expenseItems: editExpenseItems,
            totalValue: total,
            isPaid: total === 0 ? true : receipt.isPaid
        });
        setIsEditing(false);
    };

    const addLocalExpense = () => {
        if (!newExpense.description) return alert("Descrição vazia");
        const val = sanitizeNum(newExpense.value);
        if (val <= 0) return alert("Valor inválido");
        setEditExpenseItems([...editExpenseItems, { id: generateId(), description: newExpense.description, value: val }]);
        setNewExpense({ description: '', value: '' });
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] animate-slideUp overflow-hidden">
                <div className="p-5 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <div>
                        <h4 className="text-xs font-black uppercase dark:text-white leading-tight">{customer?.name || 'Cliente Desconhecido'}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{receipt.receiptNumber} • {formatDate(receipt.date)}</p>
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded-md text-[8px] font-black text-blue-600 uppercase border border-blue-100 dark:border-blue-800">
                                <Calendar size={10} /> Venc: {formatDate(receipt.dueDate)}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeTab === 'items' && !isEditing && (
                            <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-blue-100 text-blue-600 rounded-full transition-colors" title="Editar"><Pencil size={18} /></button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors" title="Fechar" aria-label="Fechar"><X size={20} /></button>
                    </div>
                </div>

                <div className="flex p-2 bg-slate-100 dark:bg-slate-950">
                    <button onClick={() => { setActiveTab('items'); setIsEditing(false); }} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'items' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-slate-400'}`}>Itens</button>
                    <button onClick={() => { setActiveTab('payments'); setIsEditing(false); }} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'payments' ? 'bg-white dark:bg-slate-800 shadow text-emerald-600' : 'text-slate-400'}`}>Recebimentos</button>
                </div>

                {isEditing && (
                    <div className="px-5 py-3 border-b dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/10 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-blue-600">Modo de Edição Ativo</span>
                        <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase shadow-lg shadow-blue-600/20 flex items-center gap-1">
                            <Check size={12} /> Salvar Alterações
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                    {activeTab === 'items' ? (
                        <div className="space-y-3">
                            {isEditing && (
                                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-900/30 space-y-3 mb-4">
                                    <h5 className="text-[9px] font-black uppercase text-blue-600 mb-1">Datas do Título</h5>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase">Emissão</label>
                                            <input type="date" value={receipt.date.slice(0, 10)} onChange={e => onUpdate({ ...receipt, date: e.target.value })} title="Data de Emissão" className="w-full bg-white dark:bg-slate-800 border-2 dark:border-slate-700 rounded-xl px-2 py-1.5 text-[10px] font-black outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase">Vencimento</label>
                                            <input type="date" value={receipt.dueDate ? receipt.dueDate.slice(0, 10) : receipt.date.slice(0, 10)} onChange={e => onUpdate({ ...receipt, dueDate: e.target.value })} title="Data de Vencimento" className="w-full bg-white dark:bg-slate-800 border-2 dark:border-slate-700 rounded-xl px-2 py-1.5 text-[10px] font-black outline-none" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {editExpenseItems.map((item: any, idx: number) => (
                                <div key={item.id || idx} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border dark:border-slate-700 relative">
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between gap-2">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={e => {
                                                        const newItems = [...editExpenseItems];
                                                        newItems[idx] = { ...item, description: e.target.value };
                                                        setEditExpenseItems(newItems);
                                                    }}
                                                    placeholder="Descrição"
                                                    className="flex-1 bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none"
                                                />
                                                <button onClick={() => setEditExpenseItems(editExpenseItems.filter((_, i) => i !== idx))} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg" title="Remover Item"><Trash size={14} /></button>
                                            </div>
                                            <input
                                                type="number"
                                                value={item.value}
                                                onChange={e => {
                                                    const newItems = [...editExpenseItems];
                                                    newItems[idx] = { ...item, value: sanitizeNum(e.target.value) };
                                                    setEditExpenseItems(newItems);
                                                }}
                                                placeholder="Valor R$"
                                                className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-[10px] font-black outline-none"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase dark:text-white">{item.description}</span>
                                                <span className="text-sm font-black text-slate-600 dark:text-slate-300">R$ {formatMoney(item.value)}</span>
                                            </div>
                                            {item.notes && (
                                                <p className="mt-2 text-[9px] font-bold text-slate-400 italic bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded-lg border-l-2 border-blue-400">
                                                    {item.notes}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                            {isEditing && (
                                <div className="p-4 border-2 border-dashed rounded-2xl border-slate-200 dark:border-slate-700 space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newExpense.description}
                                            onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                            placeholder="Novo item..."
                                            className="flex-1 bg-white dark:bg-slate-800 border rounded-xl px-3 py-2 text-[10px] font-bold outline-none"
                                        />
                                        <input
                                            type="number"
                                            value={newExpense.value}
                                            onChange={e => setNewExpense({ ...newExpense, value: e.target.value })}
                                            placeholder="Valor R$"
                                            className="w-24 bg-white dark:bg-slate-800 border rounded-xl px-3 py-2 text-[10px] font-black outline-none"
                                        />
                                    </div>
                                    <button onClick={addLocalExpense} className="w-full py-2 bg-slate-700 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2">
                                        <Plus size={14} /> Adicionar Item
                                    </button>
                                </div>
                            )}
                            <div className="p-4 bg-slate-900 text-white rounded-2xl flex justify-between items-center shadow-lg">
                                <span className="text-[10px] font-black uppercase opacity-60">Total Recebimento</span>
                                <span className="text-xl font-black">R$ {formatMoney(isEditing ? editExpenseItems.reduce((acc, i) => acc + i.value, 0) : receipt.totalValue)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700">
                                <h5 className="text-[9px] font-black uppercase text-slate-400 mb-3">Registrar Entrada</h5>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Valor R$" className="bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-xs font-black outline-none" />
                                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="bg-white dark:bg-slate-900 border rounded-xl px-2 py-2 text-[10px] font-black outline-none" title="Data" aria-label="Data" />
                                </div>
                                <div className="space-y-1 mb-3">
                                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Conta de Destino</label>
                                    <select value={payAccountId} onChange={e => setPayAccountId(e.target.value)} className="w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-[10px] font-bold outline-none" title="Selecionar conta">
                                        <option value="">Saldo em Caixa</option>
                                        {bankAccounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <button onClick={handleAddPayment} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-700 transition-colors">Confirmar Entrada</button>
                            </div>

                            <div className="space-y-2">
                                {receipt.paymentHistory?.map((h: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl">
                                        <div>
                                            <p className="text-[10px] font-black uppercase dark:text-white">{h.note || 'Recebimento'}</p>
                                            <p className="text-[8px] font-bold text-slate-400">{formatDate(h.date)}</p>
                                        </div>
                                        <p className="text-xs font-black text-emerald-600">+ R$ {formatMoney(h.amount)}</p>
                                    </div>
                                ))}
                                {(!receipt.paymentHistory || receipt.paymentHistory.length === 0) && <p className="text-center text-[10px] text-slate-400 py-4">Nenhum recebimento registrado.</p>}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800">
                    <button onClick={() => { if (confirm("Excluir registro de recebimento?")) onDelete(receipt.id); }} className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase hover:bg-rose-100 transition-colors flex items-center justify-center gap-2">
                        <Trash2 size={16} /> Excluir Registro
                    </button>
                </div>
            </div>
        </div>
    );
};

interface RecebimentosViewProps {
    customers: Customer[];
    receipts: Receipt[];
    onReceipt: (receipt: Receipt) => void;
    onUpdateReceipt: (receipt: Receipt) => void;
    onDeleteReceipt: (id: string) => void;
    onAddPayment: (receiptId: string, amount: number, date: string, bankAccountId?: string) => void;
    bankAccounts: BankAccount[];
}

export const RecebimentosView = ({ customers, receipts, onReceipt, onUpdateReceipt, onDeleteReceipt, onAddPayment, bankAccounts }: RecebimentosViewProps) => {
    const [tab, setTab] = useState<'general' | 'history'>('general');
    const [customerId, setCustomerId] = useState('');
    const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
    const [showCart, setShowCart] = useState(false);
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);
    const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
    const [annotatingItemIdx, setAnnotatingItemIdx] = useState<number | null>(null);

    const [idType, setIdType] = useState<'auto' | 'manual'>('auto');
    const [manualId, setManualId] = useState('');
    const [expenseForm, setExpenseForm] = useState({ description: '', value: '' });
    const [isCalcOpen, setIsCalcOpen] = useState(false);
    const [isPaidImmediate, setIsPaidImmediate] = useState(false);
    const [receiptAccountId, setReceiptAccountId] = useState('');

    const [generalForm, setGeneralForm] = useState({ date: new Date().toISOString().slice(0, 10), dueDate: new Date().toISOString().slice(0, 10), notes: '', accounted: true });
    const [historySearch, setHistorySearch] = useState('');

    const totalValue = expenseItems.reduce((acc, i) => acc + i.value, 0);

    const addExpenseItem = () => {
        if (!expenseForm.description) return alert("Informe a descrição do item.");
        const val = sanitizeNum(expenseForm.value);
        if (val <= 0) return alert("Informe um valor válido.");

        setExpenseItems(prev => [...prev, { id: generateId(), description: expenseForm.description, value: val }]);
        setExpenseForm({ description: '', value: '' });
    };

    const removeExpenseItem = (id: string) => {
        setExpenseItems(prev => prev.filter(i => i.id !== id));
    };

    const handleSaveAnnotation = (notes: string) => {
        if (annotatingItemIdx !== null) {
            setExpenseItems(prev => prev.map((item, i) => i === annotatingItemIdx ? { ...item, notes } : item));
            setAnnotatingItemIdx(null);
        }
    };

    const handleFinishReceipt = () => {
        if (!customerId) return alert("Selecione um cliente.");
        if (expenseItems.length === 0) return alert("Adicione pelo menos um item.");

        const receiptNumber = idType === 'manual' && manualId ? manualId : `REC-${Date.now().toString().slice(-6)}`;

        onReceipt({
            id: '', receiptNumber, type: 'general',
            customerId, date: generalForm.date, dueDate: generalForm.dueDate,
            totalValue, isPaid: isPaidImmediate,
            expenseItems: expenseItems,
            paymentHistory: [], amountPaid: isPaidImmediate ? totalValue : 0,
            notes: generalForm.notes,
            bankAccountId: isPaidImmediate ? (receiptAccountId || undefined) : undefined,
            accounted: generalForm.accounted
        });

        alert("Recebimento lançado com sucesso!");
        setExpenseItems([]); setCustomerId(''); setManualId(''); setIdType('auto'); setIsPaidImmediate(false); setReceiptAccountId('');
    };

    const filteredHistory = useMemo(() => {
        const term = historySearch.toLowerCase();
        return [...receipts].reverse().filter(p => {
            const customerObj = customers.find(s => s.id === p.customerId);
            const customer = (customerObj?.name || '').toLowerCase();
            const number = (p.receiptNumber || '').toLowerCase();
            const date = formatDate(p.date).toLowerCase();
            return customer.includes(term) || number.includes(term) || date.includes(term);
        });
    }, [receipts, historySearch, customers]);

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-4 animate-fadeIn px-2 h-full">
            {editingReceipt && (
                <ReceiptHistoryModal
                    receipt={editingReceipt}
                    customers={customers}
                    onClose={() => setEditingReceipt(null)}
                    onUpdate={onUpdateReceipt}
                    onAddPayment={onAddPayment}
                    bankAccounts={bankAccounts}
                    onDelete={async (id: string) => {
                        await onDeleteReceipt(id);
                        setEditingReceipt(null);
                    }}
                />
            )}

            {annotatingItemIdx !== null && (
                <AnnotationModal
                    item={expenseItems[annotatingItemIdx]}
                    onSave={handleSaveAnnotation}
                    onClose={() => setAnnotatingItemIdx(null)}
                />
            )}

            {isCalcOpen && (
                <CalculatorModal
                    isOpen={isCalcOpen}
                    initialValue={sanitizeNum(expenseForm.value)}
                    onApply={(val) => setExpenseForm({ ...expenseForm, value: String(val) })}
                    onClose={() => setIsCalcOpen(false)}
                />
            )}

            <div className="flex shrink-0 bg-white dark:bg-slate-900 p-1.5 rounded-[2rem] shadow-xl border dark:border-slate-800 mx-1 overflow-x-auto z-10 relative">
                <TabBtn active={tab === 'general'} onClick={() => setTab('general')} icon={<ReceiptIcon size={14} />} label="Lançar Recebimento" color="bg-blue-600 text-white" />
                <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={<History size={14} />} label="Histórico" color="bg-slate-700 text-white" />
            </div>

            {tab === 'general' && (
                <>
                    <div className={`shrink-0 bg-white dark:bg-slate-900 rounded-[2rem] border-2 dark:border-slate-800 p-2.5 transition-all mx-1 mt-1 ${isHeaderExpanded ? 'shadow-sm' : 'py-2.5 shadow-none'}`}>
                        <div onClick={() => setIsHeaderExpanded(!isHeaderExpanded)} className="flex justify-between items-center cursor-pointer p-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md">
                                    <UserPlus size={18} />
                                </div>
                                <div>
                                    <h2 className="text-xs font-black uppercase dark:text-white tracking-wide mb-0.5">Origem do Recebimento</h2>
                                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                                        {customerId ? customers.find(s => s.id === customerId)?.name || 'Cliente Selecionado' : 'Configurar Recebimento'}
                                    </p>
                                </div>
                            </div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${isHeaderExpanded ? 'bg-amber-500 border-amber-500 text-white rotate-180 shadow-lg shadow-amber-500/30' : 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400'}`}>
                                <ChevronDown size={20} />
                            </div>
                        </div>
                        {isHeaderExpanded && (
                            <div className="space-y-3 animate-fadeIn mt-3 pt-3 border-t dark:border-slate-800 p-1">
                                <SearchableSelect label="Cliente" options={customers} value={customerId} onChange={setCustomerId} placeholder="Selecionar Cliente..." />
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Data" type="date" value={generalForm.date} onChange={v => setGeneralForm({ ...generalForm, date: v })} />
                                    <Field label="Vencimento" type="date" value={generalForm.dueDate} onChange={v => setGeneralForm({ ...generalForm, dueDate: v })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400 pl-1 mb-1 block">Identificação</label>
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-2">
                                        <button onClick={() => setIdType('auto')} className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${idType === 'auto' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-400'}`}>Automático</button>
                                        <button onClick={() => setIdType('manual')} className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${idType === 'manual' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-400'}`}>Manual</button>
                                    </div>
                                    {idType === 'manual' && (
                                        <input
                                            type="text"
                                            placeholder="Digite identificação..."
                                            value={manualId}
                                            onChange={e => setManualId(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-black uppercase outline-none focus:border-blue-500"
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col gap-4 animate-fadeIn px-1 pb-48">
                        {/* Itens já lançados movidos para o topo */}
                        <div className="space-y-2">
                            {expenseItems.map((item, idx) => (
                                <div key={item.id} className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-4 rounded-2xl flex flex-col gap-3 shadow-sm animate-slideUp">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[10px] font-black text-blue-600">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase dark:text-white">{item.description}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Item de Recebimento</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <p className="text-sm font-black text-slate-700 dark:text-slate-300">R$ {formatMoney(item.value)}</p>
                                            <button onClick={() => setAnnotatingItemIdx(idx)} className={`p-1.5 rounded-lg transition-colors ${item.notes ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:bg-slate-100'}`} title="Anotação">
                                                <Note size={16} weight={item.notes ? "fill" : "regular"} />
                                            </button>
                                            <button onClick={() => removeExpenseItem(item.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Excluir"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    {item.notes && (
                                        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/10 flex items-start gap-2">
                                            <Note size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                            <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 italic leading-relaxed">{item.notes}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {expenseItems.length === 0 && (
                                <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] opacity-40">
                                    <Basket size={24} className="mx-auto mb-2" />
                                    <p className="text-[9px] font-black uppercase tracking-widest">Lista de itens vazia</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-5 rounded-[2.5rem] shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${isPaidImmediate ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <CheckCircle2 size={18} />
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase dark:text-white">Já Recebido</h4>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase">Gerar entrada imediata no caixa</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPaidImmediate(!isPaidImmediate)}
                                className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${isPaidImmediate ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                title="Marcar como recebido"
                                aria-label="Marcar como recebido"
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${isPaidImmediate ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Toggle Contabilizar */}
                        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-5 rounded-[2.5rem] shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${generalForm.accounted ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Wallet size={18} />
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase dark:text-white">Contabilizar</h4>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase">Refletir valor no patrimônio</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setGeneralForm(prev => ({ ...prev, accounted: !prev.accounted }))}
                                className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${generalForm.accounted ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                title="Alternar contabilização"
                                aria-label="Alternar contabilização"
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${generalForm.accounted ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {isPaidImmediate && (
                            <div className="bg-white dark:bg-slate-900 border-2 border-emerald-100 dark:border-emerald-900/20 p-5 rounded-[2.5rem] shadow-sm animate-slideUp">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Bank size={16} className="text-emerald-500" />
                                        <h4 className="text-[10px] font-black uppercase text-emerald-600">Local de Depósito</h4>
                                    </div>
                                    <select
                                        value={receiptAccountId}
                                        onChange={e => setReceiptAccountId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl px-4 py-3 text-xs font-bold outline-none transition-all dark:text-white"
                                        title="Selecionar conta bancária"
                                    >
                                        <option value="">Saldo em Caixa (Padrão)</option>
                                        {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name} (R$ {formatMoney(a.balance)})</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-900 border-2 border-blue-100 dark:border-blue-900/20 p-5 rounded-[2.5rem] shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText size={16} className="text-blue-600" />
                                <h3 className="text-[11px] font-black uppercase text-blue-600 tracking-wider">Detalhamento</h3>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black uppercase text-slate-400 pl-1 mb-1 block">Descrição do Item</label>
                                    <input
                                        type="text"
                                        value={expenseForm.description}
                                        onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                        placeholder="Ex: Pagamento Extra, Devolução, etc..."
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:border-blue-500 transition-all dark:text-white"
                                    />
                                </div>

                                <div className="space-y-1 relative">
                                    <label className="text-[9px] font-black uppercase text-slate-400 pl-1 mb-1 block">Valor R$</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={expenseForm.value}
                                            onChange={e => setExpenseForm({ ...expenseForm, value: e.target.value })}
                                            placeholder="0.00"
                                            className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-blue-500 transition-all dark:text-white"
                                        />
                                        <button onClick={() => setIsCalcOpen(true)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors" title="Abrir calculadora" aria-label="Abrir calculadora">
                                            <Calculator size={18} />
                                        </button>
                                    </div>
                                </div>

                                <button onClick={addExpenseItem} className="w-full py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <Plus size={16} /> Adicionar Item
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="fixed bottom-[80px] lg:bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-slate-900/95 border-t z-50 shadow-2xl backdrop-blur-md">
                        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                            <div className="flex flex-col">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor do Recebimento</p>
                                <p className="text-xl font-black dark:text-white leading-none">R$ {formatMoney(totalValue)}</p>
                            </div>
                            <button onClick={handleFinishReceipt} disabled={!customerId || expenseItems.length === 0} className="relative bg-blue-600 text-white px-10 py-4.5 rounded-[2rem] text-[11px] font-black uppercase shadow-xl shadow-blue-600/20 flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                                <CheckCircle2 size={20} /> LANÇAR RECEBIMENTO
                            </button>
                        </div>
                    </div>
                </>
            )}

            {tab === 'history' && (
                <div className="space-y-3 pb-20 px-1">
                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="BUSCAR POR CLIENTE, ID OU DATA..."
                            value={historySearch}
                            onChange={e => setHistorySearch(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border-2 dark:border-slate-800 rounded-[1.5rem] pl-12 pr-4 py-3.5 text-[10px] font-black uppercase outline-none focus:border-slate-500 shadow-sm"
                        />
                    </div>

                    {filteredHistory.map(p => (
                        <div key={p.id} onClick={() => setEditingReceipt(p)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 flex justify-between items-center cursor-pointer shadow-sm hover:border-blue-500 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl text-white bg-blue-500"><ReceiptIcon size={16} /></div>
                                <div>
                                    <p className="text-[11px] font-black uppercase dark:text-white truncate max-w-[150px]">{customers.find(s => s.id === p.customerId)?.name || 'Cliente'}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">{p.receiptNumber} • {formatDate(p.date)}</p>
                                        <div className="flex items-center gap-1 px-1 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded-md text-[7px] font-black text-blue-600 border border-blue-100 dark:border-blue-900/30">
                                            Venc: {formatDate(p.dueDate)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs font-black dark:text-white">R$ {formatMoney(p.totalValue)}</p>
                        </div>
                    ))}

                    {filteredHistory.length === 0 && (
                        <div className="py-20 text-center opacity-40">
                            <History size={32} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nenhum registro encontrado</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
