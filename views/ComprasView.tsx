import React, { useState, useMemo, useEffect } from 'react';
import { Product, Supplier, Purchase, PurchaseItem, AppGrid, GridDistribution, Variation, ExpenseItem, Sale, AppColor, ExpenseCategory, BankAccount } from '../types';
import { SearchableSelect } from '../components/SearchableSelect';
import { Field } from '../components/ui/Field';
import { MagnifyingGlass, Plus, X, Cube, Storefront, ShoppingCart, CaretDown, CaretUp, Package, Trash, Check, Hash, ArrowCounterClockwise, PencilSimple, CaretRight, Warning, UserCheck, CheckCircle, EyeSlash, Basket, Calendar, Minus, Image, Calculator, List, ClockCounterClockwise, Receipt, Wallet, CalendarBlank, Chat, UserPlus, ReceiptX, ArrowCircleDown, Stack, TrendUp, FileText, ClipboardText, ArrowRight, Note, Tag } from '@phosphor-icons/react';

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

const PurchaseHistoryModal = ({ purchase, products, suppliers, grids, colors, categories, bankAccounts, onClose, onUpdate, onAddPayment, onDelete }: any) => {
    const [activeTab, setActiveTab] = useState<'items' | 'payments'>('items');
    const [payAmount, setPayAmount] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('cash');
    const [isEditing, setIsEditing] = useState(false);
    const [editExpenseItems, setEditExpenseItems] = useState<ExpenseItem[]>(purchase.expenseItems || []);
    const [editCategoryId, setEditCategoryId] = useState<string>(purchase.categoryId || '');
    const [newExpense, setNewExpense] = useState({ description: '', value: '' });

    const supplier = suppliers.find((s: Supplier) => s.id === purchase.supplierId);

    const handleAddPayment = () => {
        const val = sanitizeNum(payAmount);
        if (val < 0) return alert("Valor inválido");
        onAddPayment(purchase.id, val, payDate, selectedBankAccountId);
        setPayAmount('');
    };

    const handleSaveEdit = () => {
        const total = editExpenseItems.reduce((acc, i) => acc + i.value, 0);
        onUpdate({
            ...purchase,
            expenseItems: editExpenseItems,
            categoryId: editCategoryId,
            totalValue: total,
            isPaid: total === (purchase.amountPaid || 0) ? true : purchase.isPaid
        });
        setIsEditing(false);
    };

    const addLocalExpense = () => {
        if (!newExpense.description) return alert("Descrição vazia");
        const val = sanitizeNum(newExpense.value);
        if (val <= 0) return alert("Valor inválido");
        setEditExpenseItems([...editExpenseItems, {
            id: generateId(),
            description: newExpense.description,
            value: val
        }]);
        setNewExpense({ description: '', value: '' });
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] animate-slideUp overflow-hidden">
                <div className="p-5 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <div>
                        <h4 className="text-xs font-black uppercase dark:text-white leading-tight">{supplier?.name || 'Fornecedor Desconhecido'}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{purchase.purchaseNumber} • {formatDate(purchase.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {purchase.type === 'general' && activeTab === 'items' && !isEditing && (
                            <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-blue-100 text-blue-600 rounded-full transition-colors" title="Editar Itens"><Pencil size={18} /></button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors" title="Fechar" aria-label="Fechar"><X size={20} /></button>
                    </div>
                </div>

                <div className="flex p-2 bg-slate-100 dark:bg-slate-950">
                    <button onClick={() => { setActiveTab('items'); setIsEditing(false); }} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'items' ? 'bg-white dark:bg-slate-800 shadow text-blue-600' : 'text-slate-400'}`}>Itens</button>
                    <button onClick={() => { setActiveTab('payments'); setIsEditing(false); }} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${activeTab === 'payments' ? 'bg-white dark:bg-slate-800 shadow text-emerald-600' : 'text-slate-400'}`}>Pagamentos</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                    {activeTab === 'items' ? (
                        <div className="space-y-3">
                            {isEditing ? (
                                <div className="space-y-4">
                                    {purchase.type === 'general' && (
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black uppercase text-slate-400 pl-1 block">Categoria da Despesa</label>
                                            <select
                                                value={editCategoryId}
                                                onChange={e => setEditCategoryId(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-950 border dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-black uppercase outline-none focus:border-blue-500 transition-all dark:text-white"
                                                title="Categoria da Despesa"
                                            >
                                                <option value="">Geral</option>
                                                {categories?.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        {editExpenseItems.map((item, idx) => (
                                            <div key={item.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800 space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <input
                                                            type="text"
                                                            value={item.description}
                                                            onChange={(e) => {
                                                                const up = [...editExpenseItems];
                                                                up[idx].description = e.target.value;
                                                                setEditExpenseItems(up);
                                                            }}
                                                            placeholder="DESCRIÇÃO"
                                                            title="Descrição do item"
                                                            className="w-full bg-transparent text-[10px] font-black uppercase outline-none focus:text-blue-600"
                                                        />
                                                        <input
                                                            type="number"
                                                            value={item.value}
                                                            onChange={(e) => {
                                                                const up = [...editExpenseItems];
                                                                up[idx].value = sanitizeNum(e.target.value);
                                                                setEditExpenseItems(up);
                                                            }}
                                                            placeholder="VALOR R$"
                                                            title="Valor do item"
                                                            className="w-full bg-transparent text-[9px] font-bold text-slate-400 outline-none"
                                                        />
                                                    </div>
                                                    <button onClick={() => setEditExpenseItems(editExpenseItems.filter((_, i) => i !== idx))} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg" title="Remover item"><Trash size={14} /></button>
                                                </div>
                                                {/* Categoria removida do item individual */}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-900/30 space-y-2">
                                        <p className="text-[8px] font-black uppercase text-blue-600">Adicionar Item</p>
                                        <input type="text" placeholder="DESCRIÇÃO" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} className="w-full bg-white dark:bg-slate-800 px-3 py-2 rounded-lg text-[9px] font-black uppercase border dark:border-slate-700 outline-none" />
                                        <div className="flex gap-2">
                                            <input type="number" placeholder="VALOR R$" value={newExpense.value} onChange={e => setNewExpense({ ...newExpense, value: e.target.value })} className="flex-1 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg text-[9px] font-black border dark:border-slate-700 outline-none" />
                                            <button onClick={addLocalExpense} className="px-4 bg-emerald-600 text-white rounded-lg text-[10px] font-black" title="Adicionar item"><Plus size={14} /></button>
                                        </div>
                                    </div>
                                    <button onClick={handleSaveEdit} className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg">Salvar Alterações</button>
                                    <button onClick={() => setIsEditing(false)} className="w-full py-2 text-slate-400 text-[9px] font-black uppercase">Cancelar</button>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3 mb-4">
                                        {purchase.type === 'general' ? (
                                            purchase.expenseItems?.map((item: any, idx: number) => (
                                                <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border dark:border-slate-700 flex justify-between items-center">
                                                    <div>
                                                        <span className="block text-[10px] font-black uppercase dark:text-white">{item.description}</span>
                                                        <span className="text-[8px] font-bold text-emerald-600 uppercase">Item de Despesa</span>
                                                    </div>
                                                    <span className="text-sm font-black text-slate-600 dark:text-slate-300">R$ {formatMoney(item.value)}</span>
                                                </div>
                                            ))
                                        ) : (
                                            (() => {
                                                const pIds = Array.from(new Set(purchase.items?.map((i: any) => i.productId)));
                                                return pIds.map(pid => {
                                                    const p = products.find((pr: Product) => pr.id === pid);
                                                    const pItems = purchase.items?.filter((i: any) => i.productId === pid) || [];
                                                    const colorNames = Array.from(new Set(pItems.map((i: any) => getColorName(i.colorId, colors))));

                                                    return (
                                                        <div key={pid as string} className="space-y-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700">
                                                            <div className="flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                                                                <Package size={14} className="text-indigo-500" />
                                                                <span className="text-[10px] font-black uppercase dark:text-white">{p?.reference || 'Item removido'}</span>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {colorNames.map(cName => {
                                                                    const cItems = pItems.filter((i: any) => getColorName(i.colorId, colors) === cName);
                                                                    const colorTotal = cItems.reduce((acc: number, i: any) => acc + (i.costPrice * i.quantity), 0);

                                                                    return (
                                                                        <div key={cName as string} className="pl-2 space-y-1">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-[9px] font-black text-slate-400 uppercase">{cName as string}</span>
                                                                                <span className="text-[9px] font-bold text-slate-500">R$ {formatMoney(colorTotal)}</span>
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {cItems.map((item: any, idx: number) => (
                                                                                    <div key={idx} className="bg-white dark:bg-slate-900 border dark:border-slate-800 px-2 py-1 rounded-lg flex gap-2 items-center">
                                                                                        <span className="text-[9px] font-black dark:text-white">{item.quantity} {item.isWholesale ? 'CX' : 'UN'}</span>
                                                                                        <span className="text-[8px] font-bold text-slate-400">@ R$ {formatMoney(item.costPrice)}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()
                                        )}
                                    </div>
                                    <div className="p-4 bg-slate-900 text-white rounded-2xl flex justify-between items-center shadow-lg mb-4">
                                        <span className="text-[10px] font-black uppercase opacity-60">Total Compra</span>
                                        <span className="text-xl font-black">R$ {formatMoney(purchase.totalValue)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700">
                                <h5 className="text-[9px] font-black uppercase text-slate-400 mb-3">Registrar Pagamento</h5>
                                <div className="space-y-2 mb-3">
                                    <div className="flex gap-2">
                                        <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Valor R$" className="flex-1 bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-xs font-black outline-none" />
                                        <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-28 bg-white dark:bg-slate-900 border rounded-xl px-2 py-2 text-[10px] font-black outline-none" title="Data de pagamento" aria-label="Data de pagamento" />
                                    </div>
                                    <select
                                        value={selectedBankAccountId}
                                        onChange={e => setSelectedBankAccountId(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-[10px] font-black outline-none"
                                        title="Conta para Pagamento"
                                    >
                                        <option value="cash">Saldo em Caixa</option>
                                        {bankAccounts.map((a: BankAccount) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <button onClick={() => { const val = sanitizeNum(payAmount); if (val <= 0) return alert("Valor inválido."); onAddPayment(purchase.id, val, payDate, selectedBankAccountId === 'cash' ? undefined : selectedBankAccountId); setPayAmount(''); }} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-700 transition-colors">Confirmar Pagamento</button>
                            </div>

                            <div className="space-y-2">
                                {purchase.paymentHistory?.map((h: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl">
                                        <div>
                                            <p className="text-[10px] font-black uppercase dark:text-white">{h.note || 'Pagamento'}</p>
                                            <p className="text-[8px] font-bold text-slate-400">{formatDate(h.date)}</p>
                                        </div>
                                        <p className="text-xs font-black text-emerald-600">- R$ {formatMoney(h.amount)}</p>
                                    </div>
                                ))}
                                {(!purchase.paymentHistory || purchase.paymentHistory.length === 0) && <p className="text-center text-[10px] text-slate-400 py-4">Nenhum pagamento registrado.</p>}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800">
                    <button onClick={() => { if (confirm("Excluir registro de compra?")) onDelete(purchase.id); }} className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase hover:bg-rose-100 transition-colors flex items-center justify-center gap-2">
                        <Trash2 size={16} /> Excluir Registro
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ComprasViewProps {
    products: Product[];
    suppliers: Supplier[];
    grids: AppGrid[];
    colors: AppColor[];
    sales: Sale[];
    showMiniatures: boolean;
    purchases: Purchase[];
    categories: ExpenseCategory[];
    bankAccounts: BankAccount[];
    initialSupplierId?: string;
    onPurchase: (purchase: Purchase) => void;
    onUpdatePurchase: (purchase: Purchase) => void;
    onDeletePurchase: (id: string) => void;
    onAddPayment: (purchaseId: string, amount: number, date: string, bankAccountId?: string) => void;
}

export const ComprasView = ({ products, suppliers, grids, colors, sales, showMiniatures, purchases, categories, bankAccounts, initialSupplierId, onPurchase, onUpdatePurchase, onDeletePurchase, onAddPayment }: ComprasViewProps) => {
    const [tab, setTab] = useState<'retail' | 'wholesale' | 'general' | 'history' | 'demand'>('general');
    const [supplierId, setSupplierId] = useState(initialSupplierId || '');
    const [items, setItems] = useState<PurchaseItem[]>([]);
    const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [showCart, setShowCart] = useState(false);
    const [expandedModels, setExpandedModels] = useState<string[]>([]);
    const [tempQuantities, setTempQuantities] = useState<Record<string, string>>({});
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [annotatingItem, setAnnotatingItem] = useState<{ type: 'inventory' | 'general', index: number } | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Estados novos para Despesas (Detalhamento)
    const [idType, setIdType] = useState<'auto' | 'manual'>('auto');
    const [manualId, setManualId] = useState('');
    const [expenseForm, setExpenseForm] = useState({
        description: '',
        value: '',
        notes: ''
    });
    const [isCalcOpen, setIsCalcOpen] = useState(false);
    const [isPaidImmediate, setIsPaidImmediate] = useState(false);
    const [cheques, setCheques] = useState<{ number: string, amount: string, dueDate: string }[]>([]);

    // Novo estado para o escopo da demanda
    const [demandScope, setDemandScope] = useState<'critical' | 'full'>('critical');

    const [generalForm, setGeneralForm] = useState({ date: new Date().toISOString().slice(0, 10), dueDate: new Date().toISOString().slice(0, 10), notes: '', categoryId: '', accounted: true });
    const [historySearch, setHistorySearch] = useState('');
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('cash');

    const CATEGORIES_LIST = categories.length > 0 ? categories.map(c => c.name) : ['Outros'];

    useEffect(() => {
        if (initialSupplierId) { setSupplierId(initialSupplierId); setTab('wholesale'); setIsHeaderExpanded(false); }
    }, [initialSupplierId]);

    const toggleModel = (id: string) => setExpandedModels(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]);

    const handleQtyChange = (key: string, val: string) => {
        const sanitized = val.replace(/\D/g, '');
        setTempQuantities(prev => ({ ...prev, [key]: sanitized }));
    };

    const adjustQty = (key: string, delta: number, currentInList: number) => {
        const currentVal = tempQuantities[key] !== undefined ? parseInt(tempQuantities[key] || '0') : currentInList;
        const next = Math.max(0, currentVal + delta);
        setTempQuantities(prev => ({ ...prev, [key]: String(next) }));
    };

    // Ajuste manual de quantidade no modal de conferência
    const updateItemQty = (idx: number, newQty: number) => {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(0, newQty) } : item));
    };

    const addItemToPurchase = (p: Product, varOrDistId: string, isWholesale: boolean, colorId?: string) => {
        const key = `${p.id}-${varOrDistId}-${colorId || ''}`;
        const qtyInput = tempQuantities[key] !== undefined ? parseInt(tempQuantities[key] || '0') : 0;

        if (qtyInput < 0) return alert("Quantidade inválida.");

        if (qtyInput === 0) {
            setItems(prev => prev.filter(i => {
                const matchesProduct = i.productId === p.id;
                const matchesVar = isWholesale
                    ? (i.distributionId === varOrDistId && i.colorId === colorId)
                    : (i.variationId === varOrDistId);
                return !(matchesProduct && matchesVar);
            }));
            return;
        }

        let price = 0;
        if (isWholesale) {
            // Busca o item de atacado específico para pegar o preço de custo correto (da caixa)
            const wsItem = (p.wholesaleStock || []).find(ws => ws.distributionId === varOrDistId && ws.colorId === colorId);
            if (wsItem && wsItem.costPricePerBox > 0) {
                // No sistema, para o carrinho de compras de atacado, o costPrice que guardamos é o da CAIXA
                price = wsItem.costPricePerBox;
            } else {
                // Fallback para cálculo baseado no par se não achar o item de atacado configurado
                let dist = (grids || []).flatMap(g => g.distributions || []).find(d => d.id === varOrDistId);
                const pairsCount = dist ? (Object.values(dist.quantities || {}) as number[]).reduce((a: number, b: number) => a + b, 0) : 0;
                const baseCost = (p.variations || []).find(v => v.colorId === colorId)?.costPrice || (p.variations || [])[0]?.costPrice || 0;
                price = baseCost * pairsCount;
            }
        } else {
            const v = (p.variations || []).find(v => v.id === varOrDistId);
            price = v?.costPrice || 0;
        }

        setItems(prev => {
            const idx = prev.findIndex(i => i.productId === p.id && (isWholesale ? (i.distributionId === varOrDistId && i.colorId === colorId) : i.variationId === varOrDistId));
            const newItem = {
                productId: p.id,
                variationId: !isWholesale ? varOrDistId : undefined,
                distributionId: isWholesale ? varOrDistId : undefined,
                isWholesale,
                colorId: colorId,
                quantity: qtyInput,
                costPrice: price
            };

            if (idx > -1) {
                const upd = [...prev];
                // Se já existe e o preço era 0, mas agora temos um preço válido, atualiza o preço também.
                // Caso contrário, mantém o preço que já estava (para não sobrescrever edições manuais no carrinho se houver)
                if (upd[idx].costPrice === 0 && price > 0) upd[idx].costPrice = price;
                upd[idx].quantity = qtyInput;
                return upd;
            }
            return [...prev, newItem];
        });
    };

    const updateItemPrice = (index: number, newPrice: number) => {
        setItems(prev => {
            const upd = [...prev];
            if (upd[index]) upd[index].costPrice = newPrice;
            return upd;
        });
    };

    // Funções para Despesas (Detalhamento)
    const addExpenseItem = () => {
        if (!expenseForm.description) return alert("Informe a descrição do item.");
        const val = sanitizeNum(expenseForm.value);
        if (val <= 0) return alert("Informe um valor válido.");

        setExpenseItems(prev => [...prev, {
            id: generateId(),
            description: expenseForm.description,
            value: val,
            notes: expenseForm.notes
        }]);
        setExpenseForm({
            description: '',
            value: '',
            notes: ''
        });
    };

    const removeExpenseItem = (id: string) => {
        setExpenseItems(prev => prev.filter(i => i.id !== id));
    };

    // Lógica de cálculo de demanda (Faltas)
    const demandSummary = useMemo(() => {
        const summary: Record<string, { items: PurchaseItem[], missingTotal: number }> = {};
        const requiredBySku: Record<string, number> = {};

        // Filtra vendas baseadas no escopo selecionado
        const targetStatuses = demandScope === 'critical'
            ? ['Aguardando Estoque']
            : ['Aguardando Estoque', 'Aguardando Aprovação'];

        // 1. Somar necessidade total de pedidos no escopo
        sales.filter(s => targetStatuses.includes(s.status)).forEach(sale => {
            sale.items.forEach(item => {
                const key = item.isWholesale
                    ? `${item.productId}|WS|${item.distributionId}|${item.colorId || ''}`
                    : `${item.productId}|RT|${item.variationId}`;
                requiredBySku[key] = (requiredBySku[key] || 0) + item.quantity;
            });
        });

        // 2. Calcular déficit e agrupar por fornecedor
        Object.entries(requiredBySku).forEach(([key, requiredQty]) => {
            const parts = key.split('|');
            const productId = parts[0];
            const type = parts[1];
            const product = products.find(p => p.id === productId);

            if (!product) return;

            let currentStock = 0;
            let costPrice = 0;
            let newItem: PurchaseItem | null = null;

            if (type === 'WS') {
                const distId = parts[2];
                const colorId = parts[3];
                const ws = (product.wholesaleStock || []).find(w => w.distributionId === distId && w.colorId === colorId);
                currentStock = ws ? ws.boxes : 0;

                // Pega o preço da caixa diretamente do estoque de atacado
                if (ws && ws.costPricePerBox > 0) {
                    costPrice = ws.costPricePerBox;
                } else {
                    // Fallback
                    const dist = (grids || []).flatMap(g => g.distributions || []).find(d => d.id === distId);
                    const pairs = dist ? (Object.values(dist.quantities || {}) as number[]).reduce((a: number, b: number) => a + b, 0) : 0;
                    costPrice = ((product.variations || []).find(v => v.colorId === colorId)?.costPrice || (product.variations || [])[0]?.costPrice || 0) * pairs;
                }

                newItem = {
                    productId, distributionId: distId, colorId, isWholesale: true,
                    quantity: 0, costPrice
                };
            } else {
                const varId = parts[2];
                const v = (product.variations || []).find(va => va.id === varId);
                currentStock = v ? v.stock : 0;
                costPrice = v?.costPrice || 0;

                newItem = {
                    productId, variationId: varId, colorId: v?.colorId, isWholesale: false,
                    quantity: 0, costPrice
                };
            }

            // A falta real é: O que eu preciso vender - O que eu tenho físico
            const missing = Math.max(0, requiredQty - currentStock);

            if (missing > 0 && newItem) {
                newItem.quantity = missing;
                const suppId = product.supplierId || 'unknown';

                if (!summary[suppId]) {
                    summary[suppId] = { items: [], missingTotal: 0 };
                }
                summary[suppId].items.push(newItem);
                summary[suppId].missingTotal += missing;
            }
        });

        return summary;
    }, [sales, products, demandScope]);

    const hasDemands = Object.keys(demandSummary).length > 0;

    const handleLoadDemand = (suppId: string, demandItems: PurchaseItem[]) => {
        setSupplierId(suppId);
        setItems(demandItems.map(i => ({ ...i, notes: undefined }))); // Limpa notas se vier de demanda
        // Preencher inputs temporários para a UI refletir a quantidade
        const newTemps: Record<string, string> = {};
        demandItems.forEach(i => {
            const key = `${i.productId}-${i.isWholesale ? i.distributionId : i.variationId}-${i.colorId || ''}`;
            newTemps[key] = String(i.quantity);
        });
        setTempQuantities(newTemps);

        // Define a tab correta baseada na maioria dos itens (se houver misto, prioriza atacado)
        const hasWholesale = demandItems.some(i => i.isWholesale);
        setTab(hasWholesale ? 'wholesale' : 'retail');
        setIsHeaderExpanded(false);
        setShowCart(true); // Abre o carrinho para conferência
    };

    const handleSaveAnnotation = (notes: string) => {
        if (!annotatingItem) return;
        if (annotatingItem.type === 'general') {
            setExpenseItems(prev => prev.map((item, i) => i === annotatingItem.index ? { ...item, notes } : item));
        } else {
            setItems(prev => prev.map((item, i) => i === annotatingItem.index ? { ...item, notes } : item));
        }
        setAnnotatingItem(null);
    };

    const filteredProducts = useMemo(() => {
        if (!supplierId) return [];
        return products.filter(p => {
            const matchesSearch = (p.reference || '').toLowerCase().includes(productSearch.toLowerCase());
            // Comparação robusta (converte para string e trata null/undefined como vazio)
            const pSupp = String(p.supplierId || '').trim().toLowerCase();
            const sSupp = String(supplierId || '').trim().toLowerCase();
            const matchesSupplier = pSupp === sSupp;
            const isActive = (p.status || 'active') === 'active';
            return matchesSearch && matchesSupplier && isActive;
        });
    }, [products, productSearch, supplierId]);

    const totalValue = tab === 'general' ? expenseItems.reduce((acc, i) => acc + i.value, 0) : items.reduce((a, b) => {
        if (b.isWholesale) {
            // No atacado, o costPrice agora já é o preço da CAIXA (corrigido acima)
            return a + (b.quantity * b.costPrice);
        }
        return a + (b.quantity * b.costPrice);
    }, 0);

    const filteredHistory = useMemo(() => {
        const term = historySearch.toLowerCase();
        return [...purchases].reverse().filter(p => {
            const supplierObj = suppliers.find(s => s.id === p.supplierId);
            const supplier = (supplierObj?.name || '').toLowerCase();
            const number = (p.purchaseNumber || '').toLowerCase();
            const date = formatDate(p.date).toLowerCase();
            return supplier.includes(term) || number.includes(term) || date.includes(term);
        });
    }, [purchases, historySearch, suppliers]);

    const handleFinishPurchase = () => {
        if (!supplierId) return alert("Selecione um fornecedor.");
        if (tab === 'general' && expenseItems.length === 0) return alert("Adicione pelo menos um item à despesa.");
        if (tab !== 'general' && items.length === 0) return alert("Adicione itens ao carrinho.");

        const purchaseNumber = idType === 'manual' && manualId ? manualId : `ENT-${Date.now().toString().slice(-6)}`;

        onPurchase({
            id: '', purchaseNumber, type: tab === 'general' ? 'general' : 'inventory',
            isWholesale: tab === 'wholesale', supplierId, date: generalForm.date, dueDate: generalForm.dueDate,
            totalValue, isPaid: tab === 'general' ? isPaidImmediate : false,
            items: tab !== 'general' ? items : undefined,
            expenseItems: tab === 'general' ? expenseItems : undefined,
            paymentHistory: [], amountPaid: (tab === 'general' && isPaidImmediate) ? totalValue : 0,
            notes: generalForm.notes,
            bankAccountId: (tab === 'general' && isPaidImmediate) ? (selectedBankAccountId === 'cash' ? undefined : selectedBankAccountId) : undefined,
            categoryId: tab === 'general' ? (generalForm.categoryId || (categories.length > 0 ? categories[0].id : undefined)) : undefined,
            accounted: generalForm.accounted,
            cheques: tab === 'general' && !isPaidImmediate ? cheques.map(c => ({
                id: '',
                number: c.number,
                amount: sanitizeNum(c.amount),
                dueDate: c.dueDate,
                isPaid: false,
                purchaseId: '',
                supplierId: supplierId
            })) : undefined
        });

        alert(tab === 'general' ? "Despesa lançada com sucesso!" : "Entrada de estoque realizada com sucesso!");
        setItems([]); setExpenseItems([]); setSupplierId(''); setShowCart(false); setTempQuantities({}); setManualId(''); setIdType('auto'); setIsPaidImmediate(false);
        setCheques([]);
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-4 animate-fadeIn px-2 h-full">
            {editingPurchase && (
                <PurchaseHistoryModal
                    purchase={editingPurchase}
                    products={products}
                    suppliers={suppliers}
                    grids={grids}
                    colors={colors}
                    categories={categories}
                    bankAccounts={bankAccounts}
                    onClose={() => setEditingPurchase(null)}
                    onUpdate={onUpdatePurchase}
                    onAddPayment={onAddPayment}
                    onDelete={async (id: string) => {
                        await onDeletePurchase(id);
                        setEditingPurchase(null);
                    }}
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

            {annotatingItem && (
                <AnnotationModal
                    item={annotatingItem.type === 'general' ? expenseItems[annotatingItem.index] : items[annotatingItem.index]}
                    onSave={handleSaveAnnotation}
                    onClose={() => setAnnotatingItem(null)}
                />
            )}

            {showCart && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col animate-slideUp overflow-hidden max-h-[90vh]">
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="text-emerald-500" size={24} />
                                <h3 className="text-sm font-black uppercase dark:text-white">Conferência de Entrada</h3>
                            </div>
                            <button onClick={() => setShowCart(false)} className="p-2 hover:bg-slate-200 rounded-full" title="Fechar" aria-label="Fechar"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {items.length === 0 ? (
                                <p className="text-center py-10 text-slate-400 font-bold uppercase text-[10px]">Lote vazio</p>
                            ) : (() => {
                                const productsInCart = Array.from(new Set(items.map(i => i.productId)));
                                return productsInCart.map(pid => {
                                    const p = products.find(prod => prod.id === pid);
                                    const pItems = items.filter(i => i.productId === pid);
                                    const colorNames = Array.from(new Set(pItems.map(i => getColorName(i.colorId, colors))));

                                    return (
                                        <div key={pid} className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border dark:border-slate-800">
                                            <div className="flex items-center gap-2 border-b dark:border-slate-800 pb-2">
                                                <Package size={16} className="text-blue-500" />
                                                <span className="text-[11px] font-black uppercase dark:text-white">{p?.reference || 'Item removido'}</span>
                                            </div>
                                            <div className="space-y-2">
                                                {colorNames.map(cName => {
                                                    const cItems = pItems.filter(i => getColorName(i.colorId, colors) === cName);

                                                    return (
                                                        <div key={cName as string} className="pl-2 space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1 h-4 bg-blue-500/50 rounded-full"></div>
                                                                <span className="text-[9px] font-black text-slate-500 uppercase">{cName as string}</span>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(() => {
                                                                    // Unifica itens do mesmo produto/cor/tamanho no carrinho
                                                                    const merged = cItems.reduce((acc: any[], curr: any) => {
                                                                        const existing = acc.find(a => (a.variationId === curr.variationId && a.distributionId === curr.distributionId));
                                                                        if (existing) {
                                                                            existing.quantity += curr.quantity;
                                                                            // Nota: mantemos a referência do índice original para ações de botões se necessário,
                                                                            // mas aqui estamos apenas renderizando.
                                                                        } else {
                                                                            acc.push({ ...curr });
                                                                        }
                                                                        return acc;
                                                                    }, []);

                                                                    return merged.map((item) => {
                                                                        const idx = items.findIndex(i => i === item);
                                                                        const dist = item.isWholesale ? (grids || []).flatMap(g => g.distributions || []).find(d => d.id === item.distributionId) : null;
                                                                        const pairsInBox = dist ? (Object.values(dist.quantities || {}) as number[]).reduce((a, b) => a + b, 0) : 1;
                                                                        const subtotal = item.quantity * item.costPrice * (item.isWholesale ? pairsInBox : 1);

                                                                        return (
                                                                            <div key={`${pid}-${cName as string}-${item.variationId || item.distributionId}`} className="space-y-1">
                                                                                <div className="flex flex-col bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border dark:border-slate-800 gap-3">
                                                                                    <div className="flex justify-between items-center">
                                                                                        <div className="flex flex-col">
                                                                                            <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase leading-none">
                                                                                                {item.isWholesale ? ` Grade ${dist?.name || 'Pad.'}` : ` Tam ${p?.variations.find(v => v.id === item.variationId)?.size || '?'}`}
                                                                                            </span>
                                                                                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                                                                                                {item.quantity} {item.isWholesale ? 'Caixas' : 'Unidades'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <button onClick={() => setAnnotatingItem({ type: 'inventory', index: idx })} className={`p-1.5 rounded-lg transition-colors ${item.notes ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:bg-slate-100'}`} title="Anotação">
                                                                                                <Note size={16} weight={item.notes ? "fill" : "regular"} />
                                                                                            </button>
                                                                                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border dark:border-slate-700">
                                                                                                <button onClick={() => updateItemQty(idx, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-700" title="Diminuir" aria-label="Diminuir"><Minus size={10} /></button>
                                                                                                <span className="w-6 text-center text-[9px] font-black">{item.quantity}</span>
                                                                                                <button onClick={() => updateItemQty(idx, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-700" title="Aumentar" aria-label="Aumentar"><Plus size={10} /></button>
                                                                                            </div>
                                                                                            <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 hover:scale-110 transition-transform p-1" title="Excluir item" aria-label="Excluir item"><Trash2 size={16} /></button>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="flex items-center gap-3 pt-2 border-t dark:border-slate-800">
                                                                                        <div className="flex-1">
                                                                                            <label className="text-[7px] font-black uppercase text-slate-400 block mb-1">Custo {item.isWholesale ? 'da Caixa' : 'da Unidade'}</label>
                                                                                            <div className="relative">
                                                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">R$</span>
                                                                                                <input
                                                                                                    type="number"
                                                                                                    step="0.01"
                                                                                                    value={item.costPrice}
                                                                                                    onChange={(e) => updateItemPrice(idx, sanitizeNum(e.target.value))}
                                                                                                    title="Editar preço de custo"
                                                                                                    className="w-full bg-slate-50 dark:bg-slate-800 pl-6 pr-2 py-1.5 rounded-lg text-[10px] font-black outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="text-right">
                                                                                            <label className="text-[7px] font-black uppercase text-slate-400 block mb-1">Subtotal</label>
                                                                                            <span className="text-[10px] font-black text-emerald-600 block pt-1.5">R$ {formatMoney(subtotal)}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                {item.notes && (
                                                                                    <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-xl border border-amber-100 dark:border-amber-900/10 flex items-start gap-2 mt-1">
                                                                                        <Note size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                                                                        <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 italic leading-relaxed">{item.notes}</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    });
                                                                })()}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                            <div className="p-5 bg-slate-900 rounded-2xl text-white flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase opacity-50">Custo Lote</span>
                                <span className="text-xl font-black">R$ {formatMoney(totalValue)}</span>
                            </div>
                        </div>
                        <div className="p-6 border-t dark:border-slate-800 space-y-4">
                            {/* Toggle Contabilizar no Carrinho para garantir visibilidade */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border-2 dark:border-slate-800 flex justify-between items-center transition-all">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-2xl ${generalForm.accounted ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                        <Wallet size={18} weight={generalForm.accounted ? "fill" : "regular"} />
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase dark:text-white tracking-tight">Contabilizar esta compra</h4>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase leading-none mt-0.5">Refletir valor no patrimônio estimado</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setGeneralForm(prev => ({ ...prev, accounted: !prev.accounted }))}
                                    className={`w-12 h-6 rounded-full p-1 transition-all duration-300 relative ${generalForm.accounted ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                    title="Alternar contabilização"
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${generalForm.accounted ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <button onClick={handleFinishPurchase} className="w-full py-4.5 bg-emerald-600 text-white rounded-[2rem] text-[11px] font-black uppercase flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 active:scale-95 transition-all">
                                <Check size={20} weight="bold" /> Confirmar Entrada de Estoque
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex shrink-0 bg-white dark:bg-slate-900 p-1.5 rounded-[2rem] shadow-xl border dark:border-slate-800 mx-1 overflow-x-auto z-10 relative">
                <TabBtn active={tab === 'general'} onClick={() => setTab('general')} icon={<ShoppingCart size={14} />} label="Despesas" color="bg-emerald-600 text-white" />
                <TabBtn active={tab === 'wholesale'} onClick={() => setTab('wholesale')} icon={<Boxes size={14} />} label="Atacado" color="bg-indigo-600 text-white" />
                <TabBtn active={tab === 'retail'} onClick={() => setTab('retail')} icon={<Store size={14} />} label="Varejo" color="bg-blue-600 text-white" />
                <TabBtn
                    active={tab === 'demand'}
                    onClick={() => setTab('demand')}
                    icon={<ClipboardList size={14} />}
                    label="Demandas"
                    color="bg-amber-500 text-white"
                    badge={hasDemands}
                />
                <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={<History size={14} />} label="Histórico" color="bg-slate-700 text-white" />
            </div>

            {/* HEADER DE CONFIGURAÇÃO (Só aparece se não for histórico ou demanda, pois demanda auto-configura) */}
            {tab !== 'history' && tab !== 'demand' && (
                <div className={`shrink-0 bg-white dark:bg-slate-900 rounded-[2rem] border-2 dark:border-slate-800 p-2.5 transition-all mx-1 mt-1 ${isHeaderExpanded ? 'shadow-sm' : 'py-2.5 shadow-none'}`}>
                    <div onClick={() => setIsHeaderExpanded(!isHeaderExpanded)} className="flex justify-between items-center cursor-pointer p-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-md">
                                <Box size={18} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xs font-black uppercase dark:text-white tracking-wide">Origem da Mercadoria</h2>
                                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase border ${generalForm.accounted ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                                        {generalForm.accounted ? 'Contabilizado' : 'Não Contabilizado'}
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                                    {supplierId ? suppliers.find(s => s.id === supplierId)?.name || 'Fornecedor Selecionado' : 'Configurar Entrada'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {supplierId && (tab === 'retail' || tab === 'wholesale') && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsSearchOpen(!isSearchOpen); }}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 ${isSearchOpen ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
                                    title="Procurar modelos"
                                >
                                    <MagnifyingGlass size={18} weight={isSearchOpen ? "bold" : "regular"} />
                                </button>
                            )}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${isHeaderExpanded ? 'bg-amber-500 border-amber-500 text-white rotate-180 shadow-lg shadow-amber-500/30' : 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400'}`}>
                                <ChevronDown size={20} />
                            </div>
                        </div>
                    </div>
                    {isHeaderExpanded && (
                        <div className="space-y-3 animate-fadeIn mt-3 pt-3 border-t dark:border-slate-800 p-1">
                            <SearchableSelect label="Fornecedor da Remessa" options={suppliers} value={supplierId} onChange={setSupplierId} placeholder="Selecionar Fornecedor..." />
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Data Entrada" type="date" value={generalForm.date} onChange={v => setGeneralForm({ ...generalForm, date: v })} />
                                <Field label="Data Título" type="date" value={generalForm.dueDate} onChange={v => setGeneralForm({ ...generalForm, dueDate: v })} />
                            </div>
                            {/* Seletor de Tipo de ID */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 pl-1 mb-1 block">Identificação da Nota/Recibo</label>
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-2">
                                    <button onClick={() => setIdType('auto')} className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${idType === 'auto' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-400'}`}>Automático</button>
                                    <button onClick={() => setIdType('manual')} className={`flex-1 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${idType === 'manual' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-400'}`}>Manual</button>
                                </div>
                                {idType === 'manual' && (
                                    <input
                                        type="text"
                                        placeholder="Digite o nº da nota..."
                                        value={manualId}
                                        onChange={e => setManualId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-black uppercase outline-none focus:border-blue-500"
                                    />
                                )}
                            </div>

                            {/* Toggle Contabilizar */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border dark:border-slate-700 flex justify-between items-center mt-2">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${generalForm.accounted ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <Wallet size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase dark:text-white">Contabilizar</h4>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Refletir valor no patrimônio</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setGeneralForm(prev => ({ ...prev, accounted: !prev.accounted }))}
                                    title="Alternar contabilização"
                                    aria-label="Alternar contabilização"
                                    className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${generalForm.accounted ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${generalForm.accounted ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ABA GERAL (DESPESAS) COM DETALHAMENTO */}
            {tab === 'general' && (
                <div className="flex-1 flex flex-col gap-4 animate-fadeIn px-1 pb-20">
                    <div className="bg-white dark:bg-slate-900 border-2 border-emerald-100 dark:border-emerald-900/20 p-5 rounded-[2.5rem] shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText size={16} className="text-emerald-600" />
                            <h3 className="text-[11px] font-black uppercase text-emerald-600 tracking-wider">Detalhamento da Despesa</h3>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 pl-1 mb-1 block">Categoria da Despesa</label>
                                <select
                                    value={generalForm.categoryId || (categories.length > 0 ? categories[0].id : '')}
                                    onChange={e => setGeneralForm({ ...generalForm, categoryId: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:border-emerald-500 transition-all dark:text-white"
                                    title="Selecione a categoria da despesa"
                                >
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 pl-1 mb-1 block">Descrição do Item</label>
                                <input
                                    type="text"
                                    value={expenseForm.description}
                                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                    placeholder="Ex: Frete, Embalagens, Aluguel..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:border-emerald-500 transition-all dark:text-white"
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
                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-black outline-none focus:border-emerald-500 transition-all dark:text-white"
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

                    <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-5 rounded-[2.5rem] shadow-sm flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${isPaidImmediate ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <CheckCircle2 size={18} />
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase dark:text-white">Marcar como Pago</h4>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase">Gerar saída imediata no caixa</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPaidImmediate(!isPaidImmediate)}
                                title="Alternar pagamento imediato"
                                aria-label="Alternar pagamento imediato"
                                className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${isPaidImmediate ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${isPaidImmediate ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {isPaidImmediate && (
                            <div className="space-y-1 pt-2 border-t dark:border-slate-800">
                                <label className="text-[9px] font-black uppercase text-slate-400 pl-1 mb-1 block">Conta para Pagamento</label>
                                <select
                                    value={selectedBankAccountId}
                                    onChange={e => setSelectedBankAccountId(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:border-emerald-500 transition-all dark:text-white"
                                    title="Selecione a conta para pagamento"
                                >
                                    <option value="cash">Saldo em Caixa</option>
                                    {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        )}

                        {!isPaidImmediate && tab === 'general' && (
                            <div className="space-y-4 pt-4 border-t dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black uppercase dark:text-white">Pagamento em Cheque</h4>
                                    <button
                                        onClick={() => setCheques([...cheques, { number: '', amount: '', dueDate: generalForm.dueDate }])}
                                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                                        title="Adicionar Cheque"
                                    >
                                        <Plus size={16} weight="bold" />
                                    </button>
                                </div>

                                {cheques.map((ch, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border dark:border-slate-700 space-y-3 relative group">
                                        <button
                                            onClick={() => setCheques(cheques.filter((_, i) => i !== idx))}
                                            className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remover Cheque"
                                        >
                                            <X size={12} weight="bold" />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase text-slate-400 pl-1 block">Nº Cheque</label>
                                                <input
                                                    type="text"
                                                    value={ch.number}
                                                    onChange={e => {
                                                        const up = [...cheques];
                                                        up[idx].number = e.target.value;
                                                        setCheques(up);
                                                    }}
                                                    className="w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-xs font-black outline-none"
                                                    placeholder="000000"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase text-slate-400 pl-1 block">Valor R$</label>
                                                <input
                                                    type="number"
                                                    value={ch.amount}
                                                    onChange={e => {
                                                        const up = [...cheques];
                                                        up[idx].amount = e.target.value;
                                                        setCheques(up);
                                                    }}
                                                    className="w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-xs font-black outline-none"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase text-slate-400 pl-1 block">Vencimento</label>
                                                <input
                                                    type="date"
                                                    value={ch.dueDate}
                                                    onChange={e => {
                                                        const up = [...cheques];
                                                        up[idx].dueDate = e.target.value;
                                                        setCheques(up);
                                                    }}
                                                    className="w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-[10px] font-black outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {cheques.length > 0 && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/10 flex justify-between items-center mt-2">
                                        <span className="text-[9px] font-black uppercase text-blue-600">Total em Cheques</span>
                                        <span className="text-[11px] font-black text-blue-600">
                                            R$ {formatMoney(cheques.reduce((acc, c) => acc + sanitizeNum(c.amount), 0))}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* LISTA DE ITENS DA DESPESA */}
                    <div className="space-y-2">
                        {expenseItems.map((item, idx) => (
                            <div key={item.id} className="space-y-2">
                                <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm animate-slideUp">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-[10px] font-black text-emerald-600">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase dark:text-white">{item.description}</p>
                                            <p className="text-[9px] font-bold text-emerald-600 uppercase">{item.category || 'Geral'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-300">R$ {formatMoney(item.value)}</p>
                                        <button onClick={() => setAnnotatingItem({ type: 'general', index: idx })} className={`p-1.5 rounded-lg transition-colors ${item.notes ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:bg-slate-100'}`} title="Anotação">
                                            <Note size={16} weight={item.notes ? "fill" : "regular"} />
                                        </button>
                                        <button onClick={() => removeExpenseItem(item.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Excluir" aria-label="Excluir"><Trash2 size={16} /></button>
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
                            <div className="py-10 text-center opacity-40 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem]">
                                <ReceiptText size={32} className="mx-auto mb-2 text-slate-300" />
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nenhum item adicionado</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ABA DE DEMANDAS / FALTAS */}
            {tab === 'demand' && (
                <div className="flex-1 space-y-4 pb-20 animate-fadeIn">
                    <div className="px-2">
                        <h3 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest mb-1">Planejamento de Compras</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Análise de estoque necessário vs disponível</p>
                    </div>

                    {/* SELETOR DE ESCOPO */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mx-1">
                        <button
                            onClick={() => setDemandScope('critical')}
                            className={`flex-1 py-3 text-[9px] font-black uppercase rounded-xl transition-all flex flex-col items-center gap-1 ${demandScope === 'critical' ? 'bg-white dark:bg-slate-700 shadow text-amber-600' : 'text-slate-400'}`}
                        >
                            <AlertTriangle size={14} /> Somente Falta de Estoque
                        </button>
                        <button
                            onClick={() => setDemandScope('full')}
                            className={`flex-1 py-3 text-[9px] font-black uppercase rounded-xl transition-all flex flex-col items-center gap-1 ${demandScope === 'full' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-400'}`}
                        >
                            <TrendingUp size={14} /> Estoque + Aprovação (Total)
                        </button>
                    </div>

                    {Object.keys(demandSummary).length === 0 ? (
                        <div className="text-center py-20 opacity-40 flex flex-col items-center">
                            <CheckCircle2 size={48} className="text-emerald-500 mb-3" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma falta de estoque detectada.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {Object.entries(demandSummary).map(([suppId, data]: [string, { items: PurchaseItem[], missingTotal: number }]) => {
                                const supplierName = suppliers.find(s => s.id === suppId)?.name || 'Fornecedor Desconhecido';
                                return (
                                    <div key={suppId} className={`bg-white dark:bg-slate-900 border-2 p-5 rounded-[2.5rem] shadow-sm relative overflow-hidden group transition-colors ${demandScope === 'full' ? 'border-indigo-100 dark:border-indigo-900/20' : 'border-amber-100 dark:border-amber-900/20'}`}>
                                        <div className={`absolute top-0 right-0 p-3 rounded-bl-[2rem] font-black text-[9px] uppercase tracking-widest border-b-2 border-l-2 ${demandScope === 'full' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-900/20' : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:border-amber-900/20'}`}>
                                            Comprar: {data.missingTotal}
                                        </div>

                                        <h4 className="text-[12px] font-black uppercase dark:text-white mb-4 pr-16">{supplierName}</h4>

                                        <div className="space-y-4 mb-6 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                            {(() => {
                                                const productGroups = Array.from(new Set(data.items.map(i => i.productId)));
                                                return productGroups.map(pid => {
                                                    const prod = products.find(p => p.id === pid);
                                                    const pItems = data.items.filter(i => i.productId === pid);
                                                    const colorNames = Array.from(new Set(pItems.map(i => getColorName(i.colorId, colors))));

                                                    return (
                                                        <div key={pid} className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                                                <span className="text-[11px] font-black uppercase dark:text-white">{prod?.reference}</span>
                                                            </div>
                                                            <div className="pl-3 space-y-1">
                                                                {colorNames.map(cName => {
                                                                    const cItems = pItems.filter(i => getColorName(i.colorId, colors) === cName);
                                                                    return (
                                                                        <div key={cName as string} className="flex justify-between items-center text-[10px] bg-slate-50/50 dark:bg-slate-800/40 p-2 rounded-xl">
                                                                            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase">{cName as string}</span>
                                                                            <div className="flex gap-2">
                                                                                {cItems.map((item, idx) => (
                                                                                    <span key={idx} className={`font-black px-2 py-0.5 rounded-md ${demandScope === 'full' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-rose-500 bg-rose-50 dark:bg-rose-900/20'}`}>
                                                                                        {item.quantity} {item.isWholesale ? 'CX' : 'UN'}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>

                                        <button
                                            onClick={() => handleLoadDemand(suppId, data.items)}
                                            className={`w-full py-4 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all ${demandScope === 'full' ? 'bg-indigo-600 shadow-indigo-500/20' : 'bg-amber-500 shadow-amber-500/20'}`}
                                        >
                                            Gerar Pedido <ArrowRight size={14} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ABA DE COMPRA ATACADO/VAREJO */}
            {(tab === 'retail' || tab === 'wholesale') && (
                <div className="flex-1 flex flex-col gap-3 min-h-0">
                    {!supplierId ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4 bg-white/50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 m-1">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600">
                                <UserPlus size={32} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase dark:text-white">Selecione o Fornecedor</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Selecione uma origem acima para listar os produtos</p>
                            </div>
                            <button onClick={() => setIsHeaderExpanded(true)} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Abrir Configuração</button>
                        </div>
                    ) : (
                        <>
                            {isSearchOpen && (
                                <div className="relative mx-1 animate-slideDown overflow-hidden transition-all duration-300 bg-white dark:bg-slate-900 rounded-[1.5rem] border-2 border-blue-500 shadow-lg shadow-blue-500/10 mb-2">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} weight="bold" />
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="PROCURAR MODELOS..."
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        className="w-full bg-transparent pl-12 pr-12 py-3.5 text-[10px] font-black uppercase outline-none dark:text-white placeholder:text-slate-400"
                                    />
                                    <button
                                        onClick={() => { setIsSearchOpen(false); setProductSearch(''); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                                        title="Fechar pesquisa"
                                    >
                                        <X size={14} weight="bold" />
                                    </button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-3 pb-44 lg:pb-12">
                                {filteredProducts.map(p => {
                                    const isExpanded = expandedModels.includes(p.id);
                                    const itemsInLot = items.filter(i => i.productId === p.id);
                                    const hasItems = itemsInLot.length > 0;

                                    // Check if product has variations for the CURRENT tab
                                    const hasCurrentTabVariations = tab === 'retail'
                                        ? (p.variations && p.variations.length > 0)
                                        : (p.wholesaleStock && p.wholesaleStock.length > 0);

                                    // Check if product has variations for the OTHER tab
                                    const hasOtherTabVariations = tab === 'retail'
                                        ? (p.wholesaleStock && p.wholesaleStock.length > 0)
                                        : (p.variations && p.variations.length > 0);

                                    return (
                                        <div key={p.id} className={`bg-white dark:bg-slate-900 border-2 transition-all rounded-[2rem] overflow-hidden shadow-sm ${hasItems ? 'border-blue-500 shadow-blue-50 dark:shadow-none' : 'dark:border-slate-800'} ${!hasCurrentTabVariations ? 'opacity-70' : ''}`}>
                                            <button onClick={() => toggleModel(p.id)} className={`w-full p-4 flex items-center gap-4 transition-colors ${hasItems ? 'bg-blue-50/30 dark:bg-blue-900/5' : 'hover:bg-slate-50'}`} title="Expandir/Recolher">
                                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shrink-0 border dark:border-slate-700 flex items-center justify-center">
                                                    {showMiniatures && p.image ? <img src={p.image} alt={`Imagem de ${p.reference}`} title={`Imagem de ${p.reference}`} className="w-full h-full object-cover" /> : <Box size={20} className="text-slate-300" />}
                                                </div>
                                                <div className="text-left flex-1 min-w-0">
                                                    <h4 className="text-[12px] font-black uppercase dark:text-white">{p.reference}</h4>
                                                    {hasItems && <span className="text-[7px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full uppercase">{itemsInLot.length} variantes no lote</span>}
                                                    {!hasCurrentTabVariations && hasOtherTabVariations && (
                                                        <span className="text-[7px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full uppercase ml-2">Disponível em {tab === 'retail' ? 'ATACADO' : 'VAREJO'}</span>
                                                    )}
                                                </div>
                                                {/* Ícone Produto Compra Atualizado */}
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 border-2 ${isExpanded ? 'bg-amber-500 border-amber-500 text-white rotate-180 shadow-lg shadow-amber-500/30' : 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400'}`}>
                                                    <ChevronDown size={18} />
                                                </div>
                                            </button>
                                            {isExpanded && (
                                                <div className="p-4 pt-0 space-y-2 animate-fadeIn border-t dark:border-slate-800 bg-zinc-900/60">
                                                    {!hasCurrentTabVariations ? (
                                                        <div className="py-8 text-center bg-white dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-700">
                                                            <EyeOff size={24} className="mx-auto mb-2 text-slate-300" />
                                                            <p className="text-[9px] font-black uppercase text-slate-400">Este modelo não possui itens para {tab === 'retail' ? 'Varejo' : 'Atacado'}</p>
                                                            {hasOtherTabVariations && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setTab(tab === 'retail' ? 'wholesale' : 'retail'); }}
                                                                    className="mt-2 text-[8px] font-black uppercase text-blue-600 hover:underline"
                                                                >
                                                                    Alternar para {tab === 'retail' ? 'Atacado' : 'Varejo'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        (() => {
                                                            const itemsOfTab = tab === 'retail' ? (p.variations || []) : (p.wholesaleStock || []);
                                                            const colorNames = Array.from(new Set(itemsOfTab.map((v: any) => getColorName(v.colorId, colors))));

                                                            return colorNames.map(colorName => {
                                                                const subItems = itemsOfTab.filter((v: any) => getColorName(v.colorId, colors) === colorName);

                                                                return (
                                                                    <div key={colorName as string} className="space-y-2 mb-4 p-3 bg-white dark:bg-slate-900/40 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm">
                                                                        <div className="px-2 pb-1 border-b dark:border-slate-800 mb-2">
                                                                            <span className={`text-[12px] font-black uppercase tracking-widest ${tab === 'retail' ? 'text-blue-600' : 'text-indigo-600'}`}>{colorName as string}</span>
                                                                        </div>

                                                                        <div className="space-y-2">
                                                                            {(() => {
                                                                                // Mescla variações que têm o mesmo tamanho/grade dentro do grupo de nome de cor
                                                                                const merged = subItems.reduce((acc: any[], curr: any) => {
                                                                                    const prop = tab === 'retail' ? curr.size : curr.distributionId;
                                                                                    const existing = acc.find(a => (tab === 'retail' ? a.size === prop : a.distributionId === prop));
                                                                                    if (existing) {
                                                                                        if (tab === 'retail') existing.stock = (existing.stock || 0) + (curr.stock || 0);
                                                                                        else existing.boxes = (existing.boxes || 0) + (curr.boxes || 0);
                                                                                    } else {
                                                                                        acc.push({ ...curr });
                                                                                    }
                                                                                    return acc;
                                                                                }, []);

                                                                                return merged.map((v: any) => {
                                                                                    const varId = tab === 'retail' ? v.id : v.distributionId;
                                                                                    const key = `${p.id}-${varId}-${v.colorId || ''}`;
                                                                                    const confirmed = items.find(i => i.productId === p.id && (tab === 'retail' ? i.variationId === v.id : (i.distributionId === v.distributionId && i.colorId === v.colorId)));
                                                                                    const currentVal = tempQuantities[key] !== undefined ? tempQuantities[key] : (confirmed ? String(confirmed.quantity) : '0');

                                                                                    return (
                                                                                        <div key={v.id} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${confirmed ? 'bg-white border-blue-500 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                                                                            <div className="flex flex-col flex-1 min-w-0">
                                                                                                <span className={`text-[10px] font-black uppercase ${confirmed ? 'text-blue-600' : 'dark:text-white'}`}>
                                                                                                    {v.size ? `TAM ${v.size}` : `CX ${grids.flatMap(g => g.distributions || []).find(d => d.id === v.distributionId)?.name || 'Padrão'}`}
                                                                                                </span>
                                                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase ${(v.stock || v.boxes || 0) <= 5 ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                                                                        Estoque: {v.stock || v.boxes || 0}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>

                                                                                            <div className="flex items-center gap-2 relative">
                                                                                                <div className="flex items-center bg-slate-50 dark:bg-slate-900 rounded-xl p-0.5 gap-1 border border-slate-200 dark:border-slate-700 shadow-inner">
                                                                                                    <button onClick={(e) => { e.stopPropagation(); adjustQty(key, -1, confirmed?.quantity || 0) }} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg text-slate-500 active:scale-90 transition-transform" title="Diminuir" aria-label="Diminuir"><Minus size={12} /></button>
                                                                                                    <input
                                                                                                        type="text"
                                                                                                        inputMode="numeric"
                                                                                                        value={currentVal}
                                                                                                        onClick={e => e.stopPropagation()}
                                                                                                        onChange={e => handleQtyChange(key, e.target.value)}
                                                                                                        className="w-10 text-center font-black text-xs outline-none bg-transparent dark:text-white"
                                                                                                        placeholder="0"
                                                                                                    />
                                                                                                    <button onClick={(e) => { e.stopPropagation(); adjustQty(key, 1, confirmed?.quantity || 0) }} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl rounded-lg text-slate-500 active:scale-90 transition-transform" title="Aumentar" aria-label="Aumentar"><Plus size={12} /></button>
                                                                                                </div>

                                                                                                <button
                                                                                                    onClick={(e) => { e.stopPropagation(); addItemToPurchase(p, varId, tab === 'wholesale', v.colorId) }}
                                                                                                    className={`p-2.5 rounded-xl transition-all shadow-md active:scale-90 ${confirmed ? 'bg-emerald-600' : 'bg-blue-600'}`}
                                                                                                >
                                                                                                    {confirmed ? <Check size={18} className="text-white" /> : <Plus size={18} className="text-white" />}
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                });
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            });
                                                        })()
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                                {filteredProducts.length === 0 && (
                                    <div className="py-20 text-center space-y-3 bg-white/30 dark:bg-slate-800/20 rounded-3xl m-2 border-2 border-dashed border-slate-100 dark:border-slate-800">
                                        <Box size={40} className="mx-auto mb-2 text-slate-300" />
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Nenhum produto encontrado</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Fornecedor: {suppliers.find(s => s.id === supplierId)?.name || 'N/A'}</p>
                                        </div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase max-w-[200px] mx-auto">Certifique-se de que existem produtos cadastrados e vinculados a este fornecedor no menu de Produtos.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {tab === 'history' && (
                <div className="space-y-3 pb-20 px-1">
                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="BUSCAR POR FORNECEDOR, ID OU DATA..."
                            value={historySearch}
                            onChange={e => setHistorySearch(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border-2 dark:border-slate-800 rounded-[1.5rem] pl-12 pr-4 py-3.5 text-[10px] font-black uppercase outline-none focus:border-slate-500 shadow-sm"
                        />
                    </div>

                    {filteredHistory.map(p => (
                        <div key={p.id} onClick={() => setEditingPurchase(p)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 flex justify-between items-center cursor-pointer shadow-sm hover:border-blue-500 transition-all">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl text-white ${p.type === 'general' ? 'bg-emerald-500' : 'bg-indigo-500'}`}><Package size={16} /></div>
                                <div>
                                    <p className="text-[11px] font-black uppercase dark:text-white truncate max-w-[150px]">{suppliers.find(s => s.id === p.supplierId)?.name || 'Fornecedor'}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{p.purchaseNumber} • {formatDate(p.date)}</p>
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

            {tab !== 'history' && tab !== 'demand' && (
                <div className="fixed bottom-[80px] lg:bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-slate-900/95 border-t z-50 shadow-2xl backdrop-blur-md">
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo Remessa</p>
                            <p className="text-xl font-black dark:text-white leading-none">R$ {formatMoney(totalValue)}</p>
                        </div>
                        {tab === 'general' ? (
                            <button onClick={handleFinishPurchase} disabled={!supplierId || expenseItems.length === 0} className="relative bg-emerald-600 text-white px-10 py-4.5 rounded-[2rem] text-[11px] font-black uppercase shadow-xl shadow-emerald-600/20 flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                                <CheckCircle2 size={20} /> LANÇAR DESPESA
                            </button>
                        ) : (
                            <button onClick={() => setShowCart(true)} disabled={!supplierId || items.length === 0} className="relative bg-emerald-600 text-white px-10 py-4.5 rounded-[2rem] text-[11px] font-black uppercase shadow-xl shadow-emerald-600/20 flex items-center gap-3 active:scale-95 transition-all disabled:opacity-50">
                                <ShoppingCart size={20} /> CONFERIR LOTE
                                {items.length > 0 && <span className="absolute -top-2 -right-2 bg-rose-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2 border-white animate-bounce shadow-md">{items.length}</span>}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
