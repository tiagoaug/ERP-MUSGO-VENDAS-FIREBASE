
import React, { useState, useMemo, useEffect } from 'react';
import { Purchase, Supplier, PaymentRecord, Product, PurchaseItem, Category } from '../types';
import { formatMoney, formatDate, sanitizeNum, generateId } from '../lib/utils';
import { exportSupplierPurchaseHistoryPDF, exportPurchaseDetailPDF, exportSelectedPurchasesPDF } from '../lib/pdfGenerator';
import {
    MagnifyingGlass, User, CurrencyDollar, Calendar, ArrowUpRight, ArrowDownLeft,
    CaretRight, ClockCounterClockwise, Wallet, UserCheck, Timer, CheckCircle,
    XCircle, DeviceMobile, HandHeart, Warning, TrendUp,
    CaretDown, CaretUp, Plus, CreditCard, Receipt as ReceiptIcon, Clock, Minus,
    MinusCircle, ArrowCircleDown, Info, Sparkle, PencilSimple, Trash, Check, X, Lightning, Lock, Package, GitBranch, Cube, Coins, Note, Copy, Prohibit, Funnel, ListChecks, FileText, FilePdf, Tag, Handshake, ShoppingBag
} from '@phosphor-icons/react';
import { SupplierDetailModal } from '../components/SupplierDetailModal';

// Lucide compat aliases
const Search = MagnifyingGlass;
const DollarSign = CurrencyDollar;
const ChevronRight = CaretRight;
const History = ClockCounterClockwise;
const Timer_icon = Timer;
const CheckCircle2 = CheckCircle;
const Smartphone = DeviceMobile;
const HeartHandshake = HandHeart;
const TrendingUp = TrendUp;
const TrendingDown = TrendUp;
const AlertCircle = Warning;
const AlertTriangle = Warning;
const ChevronDown = CaretDown;
const ChevronUp = CaretUp;
const ReceiptText = ReceiptIcon;
const ArrowDownCircle = ArrowCircleDown;
const Sparkles = Sparkle;
const Filter = Funnel;
const Pencil = PencilSimple;
const Trash2 = Trash;
const Zap = Lightning;
const PackageCheck = Package;
const Boxes = Cube;
const Box = (p: any) => <Cube {...p} />;

interface RelacionamentoComprasViewProps {
    purchases: Purchase[];
    suppliers: Supplier[];
    products: Product[];
    colors: any[];
    showMiniatures: boolean;
    categories: Category[];
    onUpdatePurchase: (purchase: Purchase) => void;
    onAddPayment: (purchaseId: string, amount: number, date: string, bankAccountId?: string) => void;
    onAddPurchase: (purchase: Purchase) => void;
    onDeletePurchase: (purchaseId: string) => void;
    onDeletePayment: (purchaseId: string, paymentId: string) => void;
    onUpdatePayment: (purchaseId: string, paymentId: string, amount: number, date: string) => void;
    bankAccounts: any[];
    deepLinkTarget?: { supplierId: string; purchaseId: string; };
    onClearDeepLink?: () => void;
}

const getColorName = (colorId: string | undefined, colors: any[]) => {
    if (!colorId) return 'Padrão';
    const cleanId = String(colorId).trim().toLowerCase();
    const found = (colors || []).find(c =>
        String(c.id).trim().toLowerCase() === cleanId ||
        String(c.name).trim().toLowerCase() === cleanId
    );
    return found ? found.name : colorId.trim();
};

export const RelacionamentoComprasView = ({
    purchases,
    suppliers,
    products,
    colors,
    showMiniatures,
    categories,
    onUpdatePurchase,
    onAddPayment,
    onAddPurchase,
    onDeletePurchase,
    onDeletePayment,
    onUpdatePayment,
    bankAccounts,
    deepLinkTarget,
    onClearDeepLink
}: RelacionamentoComprasViewProps) => {
    const [search, setSearch] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
    const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);

    // Deep link effect
    useEffect(() => {
        if (deepLinkTarget) {
            setSelectedSupplierId(deepLinkTarget.supplierId);
            setExpandedPurchaseId(deepLinkTarget.purchaseId);
            if (onClearDeepLink) {
                // Clear immediately so we don't re-trigger if the user manually closes it
                onClearDeepLink();
            }
        }
    }, [deepLinkTarget, onClearDeepLink]);

    // Auto-scroll when a record is expanded via deep link
    useEffect(() => {
        if (expandedPurchaseId) {
            // Wait for render/expansion animation
            setTimeout(() => {
                const element = document.getElementById(`purchase-${expandedPurchaseId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    }, [expandedPurchaseId]);

    const [payAmount, setPayAmount] = useState<string>('');
    const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('cash');

    // Filtros
    const [searchNumber, setSearchNumber] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'Todos'>('Todos');
    const [sortField, setSortField] = useState<'date' | 'purchaseNumber'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
    const [editPayForm, setEditPayForm] = useState({ amount: '', date: '' });
    const [isLaunchingPayment, setIsLaunchingPayment] = useState(false);
    const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>([]);

    // Cálculos estatísticos
    const stats = useMemo(() => {
        const pendingPurchases = purchases.filter(p => !p.isPaid && (p.accounted ?? true));
        const totalPending = pendingPurchases.reduce((acc, p) => acc + (p.totalValue - (p.amountPaid || 0)), 0);
        return { totalPending, pendingCount: pendingPurchases.length };
    }, [purchases]);

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    }, [suppliers, search]);

    const selectedSupplier = useMemo(() => suppliers.find(s => s.id === selectedSupplierId), [selectedSupplierId, suppliers]);

    const supplierSummary = useMemo(() => {
        if (!selectedSupplierId) return null;
        const suppPurchases = purchases.filter(p => p.supplierId === selectedSupplierId);
        const debtPending = suppPurchases.filter(p => !p.isPaid && (p.accounted ?? true)).reduce((acc, p) => acc + (p.totalValue - (p.amountPaid || 0)), 0);
        const totalBought = suppPurchases.reduce((acc, p) => acc + p.totalValue, 0);
        return { debtPending, totalBought };
    }, [selectedSupplierId, purchases]);

    const sortedSupplierPurchases = useMemo(() => {
        if (!selectedSupplierId) return [];
        let list = purchases.filter(p => p.supplierId === selectedSupplierId && !p.isPaid && (p.accounted ?? true));

        if (searchNumber.trim()) {
            const q = searchNumber.trim().toLowerCase();
            list = list.filter(p => p.purchaseNumber?.toLowerCase().includes(q));
        }

        if (selectedCategoryId !== 'Todos') {
            list = list.filter(p => p.categoryId === selectedCategoryId);
        }

        list.sort((a, b) => {
            let valA = sortField === 'date' ? (a.date || '') : (a.purchaseNumber || '');
            let valB = sortField === 'date' ? (b.date || '') : (b.purchaseNumber || '');
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [selectedSupplierId, purchases, sortField, sortOrder, searchNumber, selectedCategoryId]);

    const handleLaunchPayment = async (purchaseId: string) => {
        const val = sanitizeNum(payAmount);
        if (val <= 0) return alert("Informe um valor válido.");
        if (!payDate) return alert("Informe a data do pagamento.");
        setIsLaunchingPayment(true);
        try {
            await onAddPayment(purchaseId, val, payDate, selectedBankAccountId);
            setPayAmount('');
            setPayDate(new Date().toISOString().slice(0, 10));
        } catch (err) {
            // handled
        } finally {
            setIsLaunchingPayment(false);
        }
    };

    const handleQuitarCompra = async (purchase: Purchase) => {
        const remaining = purchase.totalValue - (purchase.amountPaid || 0);
        if (remaining <= 0) return alert("Esta compra já está quitada.");
        if (!confirm(`Deseja quitar o valor total de R$ ${formatMoney(remaining)}?`)) return;

        setIsLaunchingPayment(true);
        try {
            await onAddPayment(purchase.id, remaining, new Date().toISOString().slice(0, 10), selectedBankAccountId);
            setPayAmount('');
            setExpandedPurchaseId(null);
        } catch (err) {
            // handled
        } finally {
            setIsLaunchingPayment(false);
        }
    };

    const handleDeletePurchase = (id: string) => {
        if (confirm("Tem certeza que deseja excluir esta compra?")) {
            onDeletePurchase(id);
        }
    };

    const handleExportPDF = () => {
        if (selectedSupplier) {
            exportSupplierPurchaseHistoryPDF(selectedSupplier, purchases.filter(p => p.supplierId === selectedSupplier.id), products);
        }
    };

    const handleExportSpecificPurchase = (purchase: Purchase) => {
        if (selectedSupplier) {
            exportPurchaseDetailPDF(purchase, selectedSupplier, products);
        }
    };

    const handleExportSelected = () => {
        if (selectedSupplier && selectedPurchaseIds.length > 0) {
            const selected = purchases.filter(p => selectedPurchaseIds.includes(p.id));
            exportSelectedPurchasesPDF(selectedSupplier, selected);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedPurchaseIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (selectedPurchaseIds.length === sortedSupplierPurchases.length) {
            setSelectedPurchaseIds([]);
        } else {
            setSelectedPurchaseIds(sortedSupplierPurchases.map(p => p.id));
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 animate-fadeIn px-1 sm:px-2 pb-24">
            {/* Header / Stats */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch">
                <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/20">
                            <Handshake size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase dark:text-white leading-none tracking-tight">Histórico de Compras</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Central de Finanças e Pagamentos</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <div className="p-3 sm:p-4 bg-rose-50 dark:bg-rose-950/20 rounded-[1.8rem] border border-rose-100 dark:border-rose-900/30">
                            <p className="text-[8px] font-black uppercase text-rose-600 mb-1 tracking-widest">Total a Pagar</p>
                            <p className="text-lg sm:text-xl font-black text-rose-600 leading-none">R$ {formatMoney(stats.totalPending)}</p>
                        </div>
                        <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/20 rounded-[1.8rem] border border-blue-100 dark:border-blue-900/30 flex-col justify-center">
                            <p className="text-[8px] font-black uppercase text-blue-500 mb-1 tracking-widest">Compras Pendentes</p>
                            <p className="text-lg sm:text-xl font-black text-blue-600 leading-none">{stats.pendingCount}</p>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:flex w-64 bg-slate-900 rounded-[2.5rem] p-6 text-white flex-col justify-center relative overflow-hidden shadow-xl border border-slate-800">
                    <TrendingDown className="absolute -right-6 -bottom-6 text-white/5 rotate-12" size={120} />
                    <div className="relative z-10 space-y-4">
                        <div>
                            <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">Pagamentos</p>
                            <h4 className="text-sm font-black tracking-tight leading-tight">Controle de Saídas</h4>
                        </div>
                        <div className="pt-3 border-t border-white/10">
                            <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase">Gerencie os pagamentos aos seus fornecedores e quite faturas em aberto.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Sidebar Suppliers */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-3xl border dark:border-slate-800 shadow-sm">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                title="Pesquisar Fornecedor" aria-label="Pesquisar Fornecedor"
                                type="text" placeholder="PESQUISAR FORNECEDOR..." value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] pl-12 pr-4 py-3.5 text-[10px] font-black uppercase outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                        {filteredSuppliers.map(s => {
                            const debt = purchases.filter(p => p.supplierId === s.id && !p.isPaid && (p.accounted ?? true)).reduce((acc, p) => acc + (p.totalValue - (p.amountPaid || 0)), 0);
                            const isActive = selectedSupplierId === s.id;

                            // Define color based on debt
                            const colorClass = debt > 0 ? (isActive ? 'text-white' : 'text-rose-500') : (isActive ? 'text-white/70' : 'text-emerald-500');

                            return (
                                <button
                                    key={s.id}
                                    onClick={() => { setSelectedSupplierId(s.id); setExpandedPurchaseId(null); }}
                                    className={`w-full p-4 rounded-3xl border-2 transition-all flex items-center justify-between group ${isActive ? 'bg-emerald-700 border-emerald-700 text-white shadow-xl translate-x-1' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-emerald-200'}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                            {s.name.charAt(0)}
                                        </div>
                                        <div className="text-left min-w-0 leading-tight">
                                            <p className="text-[11px] font-black uppercase truncate">{s.name}</p>
                                            <p className={`text-[8px] font-bold uppercase mt-0.5 ${isActive ? 'text-white/60' : 'text-slate-400'}`}>{s.phone || 'S/ Tel'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`text-[10px] font-black ${colorClass}`}>R$ {formatMoney(debt)}</p>
                                        {debt > 0 && <p className={`text-[7px] font-black uppercase ${isActive ? 'text-white/50' : 'text-rose-400'}`}>A Pagar</p>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Details Section */}
                <div className="lg:col-span-9">
                    {selectedSupplierId ? (
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col h-full animate-slideUp">
                            <div className="p-6 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-emerald-700 text-white rounded-xl sm:rounded-[1.5rem] flex items-center justify-center font-black text-base sm:text-xl shadow-xl shadow-emerald-700/20 shrink-0">
                                        {selectedSupplier?.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <h3 className="text-sm sm:text-lg font-black uppercase dark:text-white truncate max-w-[200px]">{selectedSupplier?.name}</h3>
                                            <button
                                                onClick={() => setViewingSupplier(selectedSupplier || null)}
                                                className="p-1 px-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-1.5 shrink-0"
                                            >
                                                <History size={12} />
                                                <span className="text-[8px] font-black uppercase">Histórico</span>
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <button onClick={() => selectedSupplier?.phone && window.open(`https://wa.me/55${selectedSupplier.phone.replace(/\D/g, '')}`, '_blank')} className="px-2 sm:px-3 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-lg flex items-center gap-1.5">
                                                <Smartphone size={10} /> WhatsApp
                                            </button>
                                            <button onClick={handleExportPDF} className="px-2 sm:px-3 py-1 bg-slate-800 text-white text-[8px] font-black uppercase rounded-lg flex items-center gap-1.5">
                                                <FilePdf size={10} /> Exportar PDF
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right p-3 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-800 min-w-[120px]">
                                    <p className="text-[10px] font-black uppercase text-rose-600 mb-1">Saldo a Pagar</p>
                                    <p className="text-xl font-black text-rose-600">R$ {formatMoney(supplierSummary?.debtPending || 0)}</p>
                                </div>
                            </div>

                            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 pb-16">
                                {/* Filters Toolbar */}
                                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-800">
                                    <div className="relative flex-1 min-w-[150px]">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text" placeholder="Buscar Nº Compra..." value={searchNumber} onChange={e => setSearchNumber(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-[9px] font-black uppercase outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Tag size={14} className="text-slate-400" />
                                        <select
                                            title="Filtrar por Categoria"
                                            value={selectedCategoryId}
                                            onChange={e => setSelectedCategoryId(e.target.value)}
                                            className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3 py-2 text-[9px] font-black uppercase outline-none focus:border-emerald-500"
                                        >
                                            <option value="Todos">Todas Categorias</option>
                                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={toggleAll} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-[9px] font-black uppercase text-slate-500 hover:border-emerald-500 transition-all">
                                            <ListChecks size={14} className={selectedPurchaseIds.length > 0 ? "text-emerald-600" : "text-slate-400"} />
                                            {selectedPurchaseIds.length === sortedSupplierPurchases.length && sortedSupplierPurchases.length > 0 ? "Desmarcar Todos" : "Selecionar Todos"}
                                        </button>

                                        {selectedPurchaseIds.length > 0 && (
                                            <button onClick={handleExportSelected} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-emerald-600/20 active:scale-95 transition-all">
                                                <FilePdf size={14} /> Exportar ({selectedPurchaseIds.length})
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-auto">
                                        <button onClick={() => setSortField('date')} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${sortField === 'date' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Data</button>
                                        <button onClick={() => setSortField('purchaseNumber')} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${sortField === 'purchaseNumber' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Nº</button>
                                        <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-1 px-2 border dark:border-slate-700 rounded-lg text-[8px] font-black uppercase">
                                            {sortOrder === 'desc' ? 'DESC' : 'ASC'}
                                        </button>
                                    </div>
                                </div>

                                {/* Purchase Cards */}
                                <div className="space-y-4">
                                    {sortedSupplierPurchases.map(p => {
                                        const isExpanded = expandedPurchaseId === p.id;
                                        const remaining = p.totalValue - (p.amountPaid || 0);
                                        const progress = ((p.amountPaid || 0) / p.totalValue) * 100;
                                        const category = categories.find(c => c.id === p.categoryId);

                                        return (
                                            <div key={p.id} id={`purchase-${p.id}`} className={`bg-white dark:bg-slate-900 border-2 dark:border-slate-800 rounded-3xl overflow-hidden transition-all duration-500 ${isExpanded ? 'border-emerald-600 shadow-2xl scale-[1.01]' : 'border-slate-100 hover:border-emerald-200'}`}>
                                                <div className="p-5 flex flex-col sm:flex-row justify-between items-center cursor-pointer gap-4">
                                                    <div className="flex items-center gap-4 flex-1 w-full">
                                                        <div
                                                            onClick={(e) => { e.stopPropagation(); toggleSelection(p.id); }}
                                                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedPurchaseIds.includes(p.id) ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-500'}`}
                                                        >
                                                            {selectedPurchaseIds.includes(p.id) && <Check size={14} weight="bold" />}
                                                        </div>
                                                        <div onClick={() => setExpandedPurchaseId(isExpanded ? null : p.id)} className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isExpanded ? 'bg-emerald-600 text-white rotate-12' : 'bg-emerald-50 text-emerald-600'}`}>
                                                            <ShoppingBag size={20} />
                                                        </div>
                                                        <div onClick={() => setExpandedPurchaseId(isExpanded ? null : p.id)} className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <p className="text-[12px] font-black text-emerald-700 leading-none">{p.purchaseNumber || 'COMPRA'}</p>
                                                                {category && <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">{category.name}</span>}
                                                            </div>
                                                            <div className="mt-2 space-y-1">
                                                                {(p.itemDescription || p.notes) && (
                                                                    <div className="flex items-start gap-1.5 mb-1.5 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                        <Note size={12} className="text-slate-400 mt-0.5 shrink-0" />
                                                                        <p className="text-[9px] font-bold text-slate-500 leading-normal line-clamp-2 uppercase">
                                                                            {p.itemDescription || p.notes}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                                                        <Calendar size={12} className="text-slate-300 shrink-0" />
                                                                        <span className="shrink-0">Emissão:</span>
                                                                        <span className="font-black text-slate-500 whitespace-nowrap">{formatDate(p.date)}</span>
                                                                    </p>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                                                        <Clock size={12} className="text-rose-400 shrink-0" />
                                                                        <span className="shrink-0">Vencimento:</span>
                                                                        <span className="font-black text-rose-500 whitespace-nowrap">{formatDate(p.dueDate || p.date)}</span>
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {p.type !== 'inventory' ? (
                                                                        <span className="bg-rose-100 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Pendente</span>
                                                                    ) : (
                                                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Estoque</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-end gap-6 w-full sm:w-auto">
                                                        <div className="text-right min-w-[100px]" onClick={() => setExpandedPurchaseId(isExpanded ? null : p.id)}>
                                                            <p className={`text-[9px] font-black uppercase mb-1 tracking-widest ${p.type !== 'inventory' ? 'text-rose-500' : 'text-slate-400'}`}>{p.type !== 'inventory' ? 'Saldo Devedor' : 'Total Compra'}</p>
                                                            <p className={`text-xl font-black leading-none ${p.type !== 'inventory' ? 'text-rose-600' : 'dark:text-white'}`}>R$ {formatMoney(remaining)}</p>
                                                        </div>
                                                        <div onClick={() => setExpandedPurchaseId(isExpanded ? null : p.id)} className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isExpanded ? 'bg-emerald-600 text-white rotate-180' : 'bg-slate-50 text-slate-400'}`}>
                                                            <ChevronDown size={18} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="p-6 pt-0 space-y-6 animate-fadeIn border-t dark:border-slate-800">
                                                        <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => handleExportSpecificPurchase(p)} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-colors">
                                                                    <FilePdf size={14} /> <span className="hidden xs:inline">Detalhe PDF</span><span className="xs:hidden">PDF</span>
                                                                </button>
                                                            </div>
                                                            <div className="flex-1 flex justify-center">
                                                                {p.type === 'general' ? (
                                                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border dark:border-slate-700 max-w-full overflow-hidden">
                                                                        <Tag size={14} className="text-slate-400 shrink-0" />
                                                                        <span className="text-[9px] xs:text-[10px] font-black uppercase text-slate-500 mr-1 shrink-0">Cat:</span>
                                                                        <select
                                                                            title="Alterar Categoria"
                                                                            value={p.categoryId || ''}
                                                                            onChange={(e) => {
                                                                                onUpdatePurchase({ ...p, categoryId: e.target.value });
                                                                            }}
                                                                            className="bg-transparent border-none text-[9px] xs:text-[10px] font-black uppercase outline-none text-blue-600 focus:ring-0 truncate"
                                                                        >
                                                                            <option value="">Sem Categoria</option>
                                                                            {categories.map(cat => (
                                                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border dark:border-slate-700 text-center">
                                                                        <Package size={14} className="text-slate-400 shrink-0" />
                                                                        <span className="text-[9px] xs:text-[10px] font-black uppercase text-slate-500">Estoque</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 justify-end">
                                                                <button onClick={() => handleDeletePurchase(p.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-colors" title="Excluir Compra">
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div className="flex items-end justify-between">
                                                                <div>
                                                                    <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Pago ao Fornecedor</p>
                                                                    <p className="text-xl font-black dark:text-white">R$ {formatMoney(p.amountPaid || 0)}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total da Nota</p>
                                                                    <p className="text-base font-bold text-slate-500">R$ {formatMoney(p.totalValue)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="relative h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border dark:border-slate-700">
                                                                {/* eslint-disable-next-line react/forbid-dom-props */}
                                                                <div
                                                                    className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-1000 dynamic-width"
                                                                    style={{ width: `${Math.min(100, progress)}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>


                                                        {/* Items List */}
                                                        <div className="space-y-3">
                                                            <h5 className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2"><Box size={14} /> Itens da Compra</h5>
                                                            <div className="grid grid-cols-1 gap-2">
                                                                {p.items?.map((item, idx) => {
                                                                    const product = products.find(prod => prod.id === item.productId);
                                                                    return (
                                                                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-800">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center border dark:border-slate-700">
                                                                                    {showMiniatures && product?.image ? <img src={product.image} className="w-full h-full object-cover rounded-lg" alt={`Produto: ${product?.reference || 'Sem Ref.'}`} title={product?.reference} /> : <Box size={14} className="text-slate-300" />}
                                                                                </div>
                                                                                <div className="leading-tight">
                                                                                    <p className="text-[10px] font-black uppercase dark:text-white">{product?.reference || 'ITEM'}</p>
                                                                                    <p className="text-[8px] font-bold text-slate-400 uppercase">{item.quantity} un • R$ {formatMoney(item.costPrice)}/un</p>
                                                                                </div>
                                                                            </div>
                                                                            <p className="text-[10px] font-black text-emerald-700">R$ {formatMoney(item.costPrice * item.quantity)}</p>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Payment History */}
                                                        <div className="space-y-3">
                                                            <h5 className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2"><ReceiptText size={14} /> Histórico de Pagamentos</h5>
                                                            <div className="bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] overflow-hidden">
                                                                <div className="divide-y-2 dark:divide-slate-800">
                                                                    {(p.paymentHistory || []).map(pay => (
                                                                        <div key={pay.id} className="p-4 flex items-center justify-between hover:bg-white dark:hover:bg-slate-900 transition-colors group">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Check size={14} /></div>
                                                                                <div>
                                                                                    <p className="text-[10px] font-black uppercase dark:text-white">{pay.note || 'Pagamento Efetuado'}</p>
                                                                                    <p className="text-[8px] font-bold text-slate-400 uppercase">{formatDate(pay.date)}</p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-3">
                                                                                <p className="text-[10px] font-black text-emerald-600">R$ {formatMoney(pay.amount)}</p>
                                                                                <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                                                                    <button onClick={() => { onDeletePayment(p.id, pay.id); }} className="p-1 px-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Excluir Pagamento"><Trash size={12} /></button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {(!p.paymentHistory || p.paymentHistory.length === 0) && (
                                                                        <div className="p-8 text-center text-slate-400 text-[9px] font-black uppercase italic tracking-widest">Nenhum pagamento efetuado...</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Action Toolbar */}
                                                        {remaining > 0 && (
                                                            <div className="p-6 bg-emerald-600 rounded-[2.2rem] shadow-xl relative overflow-hidden group">
                                                                <Sparkles className="absolute -right-4 -top-4 text-white/10 group-hover:rotate-12 transition-all" size={80} />
                                                                <h5 className="text-[10px] font-black uppercase text-white flex items-center gap-2 relative z-10"><Plus size={14} /> Novo Lançamento</h5>
                                                                <div className="flex flex-col sm:flex-row gap-3 mt-4 relative z-10">
                                                                    <div className="flex-[2] relative">
                                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-200 text-[11px] font-black">R$</span>
                                                                        <input type="number" title="Valor do Pagamento" placeholder="Qual o valor?" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 text-white placeholder:text-white/40 rounded-2xl pl-10 pr-4 py-3 text-sm font-black outline-none focus:border-white/50" />
                                                                    </div>
                                                                    <div className="flex-1 relative">
                                                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-200" size={14} />
                                                                        <input type="date" title="Data do Pagamento" placeholder="Data" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 text-white rounded-2xl pl-11 pr-3 py-3 text-[11px] font-black outline-none focus:border-white/50" />
                                                                    </div>
                                                                    <div className="flex-1 relative">
                                                                        <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-200" size={14} />
                                                                        <select
                                                                            title="Conta de Pagamento"
                                                                            value={selectedBankAccountId}
                                                                            onChange={e => setSelectedBankAccountId(e.target.value)}
                                                                            className="w-full bg-white/10 border-2 border-white/20 text-white rounded-2xl pl-11 pr-3 py-3 text-[11px] font-black outline-none focus:border-white/50 appearance-none"
                                                                        >
                                                                            <option value="cash" className="text-slate-900">SALDO EM CAIXA</option>
                                                                            {bankAccounts.map(acc => (
                                                                                <option key={acc.id} value={acc.id} className="text-slate-900">{acc.name.toUpperCase()}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <button disabled={isLaunchingPayment} onClick={() => handleLaunchPayment(p.id)} className="flex-1 bg-white text-emerald-700 rounded-2xl px-6 py-3 text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all shadow-xl">
                                                                        Lançar
                                                                    </button>
                                                                    <button disabled={isLaunchingPayment} onClick={() => handleQuitarCompra(p)} className="flex-1 bg-emerald-800 text-white border border-emerald-400/30 rounded-2xl px-4 py-3 text-[10px] font-black uppercase hover:scale-105 transition-all flex items-center justify-center gap-2">
                                                                        <Lightning size={16} weight="fill" /> Quitar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex justify-between items-center pt-2">
                                                            <button onClick={() => handleDeletePurchase(p.id)} className="flex items-center gap-1.5 text-rose-500 hover:text-rose-600 transition-colors text-[9px] font-black uppercase">
                                                                <Trash2 size={14} /> Excluir Compra
                                                            </button>
                                                            <button onClick={() => setExpandedPurchaseId(null)} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 py-2 px-4">
                                                                <ChevronUp size={14} /> Recolher
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800 opacity-40">
                            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
                                <User size={48} className="text-slate-300" />
                            </div>
                            <h3 className="text-sm font-black uppercase text-slate-400 tracking-[0.4em]">Selecione um Fornecedor</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-3 max-w-xs leading-relaxed">
                                Navegue pela lista ao lado para gerenciar as contas de seus fornecedores.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {viewingSupplier && (
                <SupplierDetailModal
                    supplier={viewingSupplier}
                    purchases={purchases.filter(p => p.supplierId === viewingSupplier.id)}
                    sales={[]} // Not needed here for basic view but modal requires it
                    customers={[]}
                    onClose={() => setViewingSupplier(null)}
                    onUpdate={() => setViewingSupplier(null)}
                />
            )}
        </div>
    );
};
