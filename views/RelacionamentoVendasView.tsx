
import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Customer, PaymentRecord, SaleStatus, Product, SaleItem, Receipt } from '../types';
import { formatMoney, formatDate, sanitizeNum, generateId, formatSaleToText, formatSaleToSeparationText, formatSaleToSimpleListText, formatSaleToProductListText, formatReceiptToText } from '../lib/utils'; // Refreshing module resolution
import { exportSeparationListPDF, exportReceiptPDF, exportSelectedSalesPDF } from '../lib/pdfGenerator';
import {
    MagnifyingGlass, User, CurrencyDollar, Calendar, ArrowUpRight, ArrowDownLeft,
    CaretRight, ClockCounterClockwise, Wallet, UserCheck, Timer, CheckCircle,
    XCircle, DeviceMobile, HandHeart, Warning, TrendUp,
    CaretDown, CaretUp, Plus, CreditCard, Receipt as ReceiptIcon, Clock, Minus,
    MinusCircle, ArrowCircleDown, Info, Sparkle, PencilSimple, Trash, Check, X, Lightning, Lock, Package, GitBranch, Cube, Coins, Note, Copy, Prohibit, Funnel, ListChecks, FileText, FilePdf
} from '@phosphor-icons/react';
import { CustomerDetailModal } from '../components/CustomerDetailModal';

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
const Split = GitBranch;
const Minus_icon = Minus;

interface RelacionamentoVendasViewProps {
    sales: Sale[];
    customers: Customer[];
    products: Product[];
    colors: any[];
    showMiniatures: boolean;
    onUpdateSale: (sale: Sale) => void;
    onAddPayment: (saleId: string, amount: number, date: string) => void;
    onAddSale: (sale: Omit<Sale, 'id'>) => void;
    onUpdateCustomer: (customer: Customer) => void;
    receipts: Receipt[];
    onAddReceiptPayment: (receiptId: string, amount: number, date: string, note?: string) => void;
    onDeleteReceipt: (receiptId: string) => void;
    onDeleteReceiptPayment: (receiptId: string, paymentId: string) => void;
    onUpdateReceiptPayment: (receiptId: string, paymentId: string, amount: number, date: string) => void;
    deepLinkTarget?: { customerId: string; saleId: string; type: 'sale' | 'receipt' };
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

export const RelacionamentoVendasView = ({ sales, customers, products, colors, showMiniatures, onUpdateSale, onAddPayment, onAddSale, onUpdateCustomer, receipts, onAddReceiptPayment, onDeleteReceipt, onDeleteReceiptPayment, onUpdateReceiptPayment, deepLinkTarget, onClearDeepLink }: RelacionamentoVendasViewProps) => {
    const [search, setSearch] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
    const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

    // Deep link effect
    useEffect(() => {
        if (deepLinkTarget) {
            setSelectedCustomerId(deepLinkTarget.customerId);
            setExpandedSaleId(deepLinkTarget.saleId);
            if (onClearDeepLink) {
                // Clear immediately so we don't re-trigger if the user manually closes it
                onClearDeepLink();
            }
        }
    }, [deepLinkTarget, onClearDeepLink]);

    // Auto-scroll when a record is expanded via deep link
    useEffect(() => {
        if (expandedSaleId) {
            // Wait for render/expansion animation
            setTimeout(() => {
                const element = document.getElementById(`sale-${expandedSaleId}`) || document.getElementById(`receipt-${expandedSaleId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    }, [expandedSaleId]);

    const [payAmount, setPayAmount] = useState<string>('');
    const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [payNote, setPayNote] = useState<string>('');
    const [selectedSales, setSelectedSales] = useState<string[]>([]);

    // Novo: Filtro de Status para a lateral
    const [sidebarStatus, setSidebarStatus] = useState<SaleStatus | 'Todos'>('Todos');

    // Novo: Estado para menu de separação
    const [separationSale, setSeparationSale] = useState<Sale | null>(null);

    // Estados para edição de pagamento (Vendas)
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
    const [editPayForm, setEditPayForm] = useState({ amount: '', date: '' });

    // Estados para edição de pagamento (Recebimentos)
    const [editingReceiptPaymentId, setEditingReceiptPaymentId] = useState<string | null>(null);
    const [editReceiptPayForm, setEditReceiptPayForm] = useState({ amount: '', date: '', note: '' });

    // Estado para "Teleporte" de Aprovação
    const [approvingSale, setApprovingSale] = useState<Sale | null>(null);
    const [approvePaymentType, setApprovePaymentType] = useState<'cash' | 'credit'>('cash');

    // Estado para Liberação Parcial
    const [partialSale, setPartialSale] = useState<Sale | null>(null);

    // Novo: Estado de carregamento específico para amortização
    const [isLaunchingPayment, setIsLaunchingPayment] = useState(false);

    // Novo: Estado expansível do Topo
    const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);

    // Filtros e Ordenação para pedidos do cliente selecionado
    const [custSortField, setCustSortField] = useState<'date' | 'saleNumber'>('date');
    const [custSortOrder, setCustSortOrder] = useState<'asc' | 'desc'>('desc');
    const [searchNumber, setSearchNumber] = useState('');
    const [hiddenStatuses, setHiddenStatuses] = useState<SaleStatus[]>([]);
    const [showStatusFilters, setShowStatusFilters] = useState(false);

    const statuses: SaleStatus[] = ['Pendente', 'Em produção', 'Entregue', 'Cancelada', 'Aguardando Estoque', 'Aguardando Aprovação'];

    // Cálculos Separados: Análise vs Pendente
    const stats = useMemo(() => {
        let totalAnalysis = 0;
        let totalPending = 0;
        let pendingCount = 0;

        sales.forEach(s => {
            if (s.status === 'Cancelada' || s.isPaid) return;
            const debt = s.totalValue - s.amountPaid;

            if (s.status === 'Aguardando Aprovação' || s.status === 'Aguardando Estoque') {
                totalAnalysis += debt;
            } else {
                totalPending += debt;
                pendingCount++;
            }
        });

        receipts.forEach(r => {
            if (r.isPaid) return;
            const debt = r.totalValue - (r.amountPaid || 0);
            totalPending += debt;
            pendingCount++;
        });

        return { totalAnalysis, totalPending, pendingCount };
    }, [sales, receipts]);

    const filteredCustomers = useMemo(() => {
        let list = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

        if (sidebarStatus !== 'Todos') {
            list = list.filter(c => {
                // Filtra clientes que possuem pelo menos uma venda não-pago com o status selecionado
                return sales.some(s => s.customerId === c.id && !s.isPaid && s.status === sidebarStatus);
            });
        }

        return list;
    }, [customers, search, sidebarStatus, sales]);

    const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [selectedCustomerId, customers]);

    const customerSummary = useMemo(() => {
        if (!selectedCustomerId) return null;
        const custSales = sales.filter(s => s.customerId === selectedCustomerId && s.status !== 'Cancelada');
        const custReceipts = receipts.filter(r => r.customerId === selectedCustomerId);

        const debtAnalysis = custSales.filter(s => s.status === 'Aguardando Aprovação' || s.status === 'Aguardando Estoque').reduce((acc, s) => acc + (s.totalValue - s.amountPaid), 0);
        const saleDebtPending = custSales.filter(s => s.status !== 'Aguardando Aprovação' && s.status !== 'Aguardando Estoque' && !s.isPaid).reduce((acc, s) => acc + (s.totalValue - s.amountPaid), 0);

        const unpaidReceipts = custReceipts.filter(r => !r.isPaid);
        const receiptDebtPending = unpaidReceipts.reduce((acc, r) => acc + (r.totalValue - (r.amountPaid || 0)), 0);

        return {
            debtAnalysis,
            debtPending: saleDebtPending + receiptDebtPending,
            totalBought: custSales.reduce((acc, s) => acc + s.totalValue, 0) + custReceipts.reduce((acc, r) => acc + r.totalValue, 0),
            visibleReceipts: unpaidReceipts
        };
    }, [selectedCustomerId, sales, receipts]);

    // Lista ordenada de pedidos do cliente selecionado (filtra não-cancelados e não-pagos, aplica sort)
    const sortedCustomerSales = useMemo(() => {
        if (!selectedCustomerId) return [];
        // ... (resto da lógica continua inalterado)
        let list = sales.filter(s => s.customerId === selectedCustomerId && !s.isPaid);
        if (hiddenStatuses.length > 0) { list = list.filter(s => !hiddenStatuses.some(h => h.trim() === s.status.trim())); }
        if (searchNumber.trim()) { const q = searchNumber.trim().toLowerCase(); list = list.filter(s => s.saleNumber?.toLowerCase().includes(q)); }
        list.sort((a, b) => { let valA = custSortField === 'date' ? (a.date || '') : (a.saleNumber || ''); let valB = custSortField === 'date' ? (b.date || '') : (b.saleNumber || ''); if (valA < valB) return custSortOrder === 'asc' ? -1 : 1; if (valA > valB) return custSortOrder === 'asc' ? 1 : -1; return 0; });
        return list;
    }, [selectedCustomerId, sales, custSortField, custSortOrder, hiddenStatuses, searchNumber]);

    const handleLaunchPayment = async (saleId: string) => {
        const val = sanitizeNum(payAmount);
        if (val <= 0) return alert("Informe um valor válido.");
        if (!payDate) return alert("Informe a data do pagamento.");
        setIsLaunchingPayment(true);
        try {
            await onAddPayment(saleId, val, payDate);
            setPayAmount('');
            setPayDate(new Date().toISOString().slice(0, 10));
            setExpandedSaleId(null);
        } catch (err) {
            // Error already handled by withSaving alert
        } finally {
            setIsLaunchingPayment(false);
        }
    };

    const handleQuitarVenda = async (sale: Sale) => {
        const remaining = sale.totalValue - sale.amountPaid;
        if (remaining <= 0) return alert("Esta venda já está quitada.");
        if (!confirm(`Deseja quitar o valor total de R$ ${formatMoney(remaining)}?`)) return;

        setIsLaunchingPayment(true);
        try {
            await onAddPayment(sale.id, remaining, new Date().toISOString().slice(0, 10));
            setPayAmount('');
            setExpandedSaleId(null);
        } catch (err) {
            // Error already handled
        } finally {
            setIsLaunchingPayment(false);
        }
    };

    const handleLaunchReceiptPayment = async (receiptId: string) => {
        const val = sanitizeNum(payAmount);
        if (val <= 0) return alert("Valor inválido");
        setIsLaunchingPayment(true);
        try {
            await onAddReceiptPayment(receiptId, val, payDate, payNote);
            setPayAmount('');
            setPayNote('');
            setExpandedSaleId(null);
        } catch (err) {
            // Error already handled by withSaving alert
        } finally {
            setIsLaunchingPayment(false);
        }
    };

    const handleEditPayment = (sale: Sale, paymentId: string) => {
        const amt = sanitizeNum(editPayForm.amount);
        if (amt <= 0) return alert("Valor inválido.");

        const newHistory = (sale.paymentHistory || []).map(p =>
            p.id === paymentId ? { ...p, amount: amt, date: editPayForm.date } : p
        );

        const newAmountPaid = newHistory.reduce((acc, p) => acc + p.amount, 0);

        onUpdateSale({
            ...sale,
            paymentHistory: newHistory,
            amountPaid: newAmountPaid,
            isPaid: newAmountPaid >= sale.totalValue
        });

        setEditingPaymentId(null);
    };

    const handleDeletePayment = (sale: Sale, paymentId: string) => {
        if (!confirm("Tem certeza que deseja excluir este lançamento de pagamento?")) return;
        const newHistory = (sale.paymentHistory || []).filter(p => p.id !== paymentId);
        const newAmountPaid = newHistory.reduce((acc, p) => acc + p.amount, 0);
        onUpdateSale({
            ...sale,
            paymentHistory: newHistory,
            amountPaid: newAmountPaid,
            isPaid: newAmountPaid >= sale.totalValue
        });
    };

    const handleExportReceiptPDF = async (r: Receipt) => {
        const customer = customers.find(c => c.id === r.customerId);
        await exportReceiptPDF(r, customer);
    };

    const handleCopyReceiptText = (r: Receipt) => {
        const customer = customers.find(c => c.id === r.customerId);
        const text = formatReceiptToText(r, customer);
        navigator.clipboard.writeText(text);
        alert("Dados do recebimento copiados (Texto)!");
    };

    const handleEditReceiptPayment = (receiptId: string, paymentId: string) => {
        const amt = sanitizeNum(editReceiptPayForm.amount);
        if (amt <= 0) return alert("Valor inválido.");
        onUpdateReceiptPayment(receiptId, paymentId, amt, editReceiptPayForm.date);
        setEditingReceiptPaymentId(null);
    };

    const handleDeleteReceiptPayment = (receiptId: string, paymentId: string) => {
        if (!confirm("Tem certeza que deseja excluir esta amortização? O registro financeiro também será removido.")) return;
        onDeleteReceiptPayment(receiptId, paymentId);
    };

    const handleFinalApproveTeleport = () => {
        if (!approvingSale) return;

        const timestamp = new Date().toISOString();
        const dateStr = timestamp.slice(0, 10);
        const isCash = approvePaymentType === 'cash';

        const initialPayment = isCash ? [{
            id: generateId(),
            date: dateStr,
            amount: approvingSale.totalValue,
            note: 'Pagamento Integral (Aprovação Direta)'
        }] : [];

        const updated: Sale = {
            ...approvingSale,
            status: 'Pendente',
            paymentType: approvePaymentType,
            isPaid: isCash,
            amountPaid: isCash ? approvingSale.totalValue : 0,
            paymentHistory: initialPayment
        };

        onUpdateSale(updated);
        setApprovingSale(null);
    };

    // Função auxiliar para checar se o estoque físico cobre o pedido
    const checkStockAvailability = (sale: Sale) => {
        let isFullyAvailable = true;
        for (const item of sale.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) { isFullyAvailable = false; break; }

            let currentStock = 0;
            const cName = getColorName(item.colorId, colors);

            if (item.isWholesale) {
                // Soma estoque de atacado para o mesmo nome de cor e ID de distribuição
                currentStock = (product.wholesaleStock || [])
                    .filter(w => w.distributionId === item.distributionId && getColorName(w.colorId, colors) === cName)
                    .reduce((acc, curr) => acc + sanitizeNum(curr.boxes), 0);
            } else {
                // Soma estoque de varejo para o mesmo nome de cor e tamanho
                const variation = product.variations.find(v => v.id === item.variationId);
                const size = variation?.size;
                currentStock = (product.variations || [])
                    .filter(v => v.size === size && getColorName(v.colorId, colors) === cName)
                    .reduce((acc, curr) => acc + sanitizeNum(curr.stock), 0);
            }

            if (currentStock < sanitizeNum(item.quantity)) {
                isFullyAvailable = false;
                break;
            }
        }
        return isFullyAvailable;
    };

    const handleCancelSale = (sale: Sale) => {
        if (!confirm(`TEM CERTEZA QUE DESEJA CANCELAR O PEDIDO ${sale.saleNumber}?\n\nISSO IRÁ ESTORNAR OS PRODUTOS PARA O ESTOQUE.`)) return;
        onUpdateSale({ ...sale, status: 'Cancelada' });
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 animate-fadeIn px-1 sm:px-2 pb-24">
            {/* modais */}
            {approvingSale && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] shadow-2xl p-8 flex flex-col animate-slideUp border dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-xl shadow-amber-500/20 animate-pulse">
                                <Zap size={24} />
                            </div>
                            <div>
                                <h4 className="text-base font-black uppercase dark:text-white leading-tight">Teleporte de Aprovação</h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Liberando Pedido {approvingSale.saleNumber}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 text-center">
                                <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Valor do Pedido</p>
                                <p className="text-3xl font-black text-slate-900 dark:text-white">R$ {formatMoney(approvingSale.totalValue)}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setApprovePaymentType('cash')} title="Pagar à Vista" aria-label="Pagar à Vista" className={`p-5 rounded-[1.8rem] border-2 transition-all flex flex-col items-center gap-2 ${approvePaymentType === 'cash' ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl scale-[1.03]' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}>
                                    <CheckCircle2 size={24} />
                                    <span className="text-[9px] font-black uppercase">À Vista</span>
                                    <span className="text-[7px] font-bold opacity-70">Recebido</span>
                                </button>
                                <button onClick={() => setApprovePaymentType('credit')} title="Pagar a Prazo" aria-label="Pagar a Prazo" className={`p-5 rounded-[1.8rem] border-2 transition-all flex flex-col items-center gap-2 ${approvePaymentType === 'credit' ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-[1.03]' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}>
                                    <CreditCard size={24} />
                                    <span className="text-[9px] font-black uppercase">A Prazo</span>
                                    <span className="text-[7px] font-bold opacity-70">Pendente</span>
                                </button>
                            </div>

                            <div className="pt-6 flex flex-col gap-3">
                                <button onClick={handleFinalApproveTeleport} title="Confirmar Liberação" aria-label="Confirmar Liberação" className="w-full py-4.5 bg-blue-600 text-white rounded-[2rem] text-[11px] font-black uppercase shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-3">
                                    <Check size={18} /> Confirmar Liberação
                                </button>
                                <button onClick={() => setApprovingSale(null)} title="Cancelar Liberação" aria-label="Cancelar Liberação" className="w-full py-3.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER ACORDEÃO */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
                {/* Header Compact - Always visible */}
                <div
                    onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
                    className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/20">
                            <HeartHandshake size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase dark:text-white leading-none tracking-tight">Histórico de Clientes</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Créditos e Cobranças</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        {/* SEARCH INPUT INTENTIONAL PLACEMENT */}
                        <div onClick={e => e.stopPropagation()} className="relative flex-1 sm:w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                title="Pesquisar Cliente" aria-label="Pesquisar Cliente"
                                type="text" placeholder="PESQUISAR CLIENTE..." value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-[1.5rem] pl-12 pr-4 py-3 text-[10px] font-black uppercase outline-none focus:ring-2 ring-blue-500/20 shadow-inner"
                            />
                        </div>
                        <button
                            title={isHeaderExpanded ? "Recolher" : "Expandir"}
                            aria-label={isHeaderExpanded ? "Recolher Resumo" : "Expandir Resumo"}
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                        >
                            <ChevronDown size={20} className={`transform transition-transform duration-300 ${isHeaderExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Expanded Content */}
                <div className={`transition-all duration-500 ease-in-out ${isHeaderExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    <div className="p-4 sm:p-6 pt-0 border-t dark:border-slate-800 flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* CARD VERMELHO: PENDENTE PGTO */}
                                <div className="p-3 sm:p-4 bg-rose-50 dark:bg-rose-950/20 rounded-[1.8rem] border border-rose-100 dark:border-rose-900/30">
                                    <p className="text-[8px] font-black uppercase text-rose-600 mb-1 tracking-widest">Pendente (Vencidos)</p>
                                    <p className="text-lg sm:text-xl font-black text-rose-600 leading-none">R$ {formatMoney(stats.totalPending)}</p>
                                </div>

                                {/* CARD LARANJA: EM ANÁLISE */}
                                <div className="p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/20 rounded-[1.8rem] border border-amber-100 dark:border-amber-900/30">
                                    <p className="text-[8px] font-black uppercase text-amber-600 mb-1 tracking-widest">Em Análise</p>
                                    <p className="text-lg sm:text-xl font-black text-amber-600 leading-none">R$ {formatMoney(stats.totalAnalysis)}</p>
                                </div>

                                <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/20 rounded-[1.8rem] border border-blue-100 dark:border-blue-900/30 flex-col justify-center">
                                    <p className="text-[8px] font-black uppercase text-blue-500 mb-1 tracking-widest">Contas em Aberto</p>
                                    <div className="flex items-center gap-2">
                                        <p className="text-lg sm:text-xl font-black text-blue-600 leading-none">{stats.pendingCount}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="hidden lg:flex w-64 bg-slate-900 rounded-[2.5rem] p-6 text-white flex-col justify-center relative overflow-hidden shadow-inner border border-slate-800">
                            <TrendingUp className="absolute -right-6 -bottom-6 text-white/5 rotate-12" size={120} />
                            <div className="relative z-10 space-y-4">
                                <div>
                                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">Acompanhamento</p>
                                    <h4 className="text-sm font-black tracking-tight leading-tight">Monitor de Pendências</h4>
                                </div>
                                <div className="pt-3 border-t border-white/10">
                                    <p className="text-[9px] font-bold text-slate-400 leading-relaxed uppercase">Use esta tela para abater haveres ou registrar novos pagamentos parciais.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* BARRA LATERAL */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-3xl border dark:border-slate-800 shadow-sm flex flex-col gap-2">
                        {/* A pesquisa original daqui foi movida para o Acordeão do cabeçalho. Mantemos apenas o array de status como atalho. */}
                        {/* NOVO: Filtro de Status na Sidebar */}
                        <div className="flex px-2 py-1 gap-1 overflow-x-auto custom-scrollbar no-scrollbar">
                            <button
                                onClick={() => setSidebarStatus('Todos')}
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all shrink-0 ${sidebarStatus === 'Todos' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100'}`}
                            >Todos</button>
                            {statuses.map(st => (
                                <button
                                    key={st}
                                    onClick={() => setSidebarStatus(st)}
                                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all shrink-0 ${sidebarStatus === st ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100'}`}
                                >{st}</button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                        {filteredCustomers.map(c => {
                            const custSales = sales.filter(s => s.customerId === c.id && s.status !== 'Cancelada');
                            const isActive = selectedCustomerId === c.id;

                            // Cálculos individuais
                            const pendingVal = custSales.filter(s => s.status !== 'Aguardando Aprovação' && s.status !== 'Aguardando Estoque' && !s.isPaid)
                                .reduce((acc, s) => acc + (s.totalValue - s.amountPaid), 0);

                            const custReceipts = receipts.filter(r => r.customerId === c.id && !r.isPaid);
                            const receiptPendingVal = custReceipts.reduce((acc, r) => acc + (r.totalValue - (r.amountPaid || 0)), 0);

                            const analysisVal = custSales.filter(s => s.status === 'Aguardando Aprovação' || s.status === 'Aguardando Estoque')
                                .reduce((acc, s) => acc + (s.totalValue - s.amountPaid), 0);

                            const totalPendingVal = pendingVal + receiptPendingVal;

                            return (
                                <button
                                    key={c.id}
                                    onClick={() => { setSelectedCustomerId(c.id); setExpandedSaleId(null); }}
                                    className={`w-full p-4 rounded-3xl border-2 transition-all flex items-center justify-between group ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-xl translate-x-1' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-blue-200'}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                            {c.name.charAt(0)}
                                        </div>
                                        <div className="text-left min-w-0 leading-tight">
                                            <p className="text-[11px] font-black uppercase truncate">{c.name}</p>
                                            <p className={`text-[8px] font-bold uppercase mt-0.5 ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
                                                {c.phone || 'S/ Tel'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 flex flex-col items-end">
                                        {totalPendingVal > 0 ? (
                                            <>
                                                <span className={`text-[10px] font-black ${isActive ? 'text-white' : 'text-rose-500'}`}>
                                                    R$ {formatMoney(totalPendingVal)}
                                                </span>
                                                <span className={`text-[7px] font-black uppercase ${isActive ? 'text-white/50' : 'text-rose-400'}`}>
                                                    Vencido
                                                </span>
                                            </>
                                        ) : analysisVal > 0 ? (
                                            <>
                                                <span className={`text-[10px] font-black ${isActive ? 'text-white' : 'text-amber-600'}`}>
                                                    R$ {formatMoney(analysisVal)}
                                                </span>
                                                <span className={`text-[7px] font-black uppercase ${isActive ? 'text-white/50' : 'text-amber-500'}`}>
                                                    Em Análise
                                                </span>
                                            </>
                                        ) : (
                                            <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/20' : 'bg-emerald-50'}`}>
                                                <CheckCircle2 size={14} className={isActive ? 'text-white' : 'text-emerald-500'} />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* DETALHES */}
                <div className="lg:col-span-9">
                    {selectedCustomerId ? (
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col h-full animate-slideUp">
                            <div className="p-4 sm:p-6 md:p-8 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center font-black text-xl shadow-xl shadow-blue-600/20">
                                        {selectedCustomer?.name.charAt(0)}
                                    </div>
                                    <div className="leading-tight">
                                        <div className="flex items-center gap-2">
                                            <h3
                                                onClick={() => setViewingCustomer(selectedCustomer || null)}
                                                className="text-lg font-black uppercase dark:text-white truncate max-w-[200px] cursor-pointer hover:text-blue-600 transition-colors underline decoration-blue-500/30 underline-offset-4"
                                                title="Clique para abrir histórico completo"
                                            >
                                                {selectedCustomer?.name}
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    if (selectedCustomer) {
                                                        setViewingCustomer(selectedCustomer);
                                                    }
                                                }}
                                                className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-1.5"
                                                title="Ver Detalhes/Histórico em Foco"
                                            >
                                                <History size={14} />
                                                <span className="text-[8px] font-black uppercase">Histórico</span>
                                            </button>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={() => {
                                                if (selectedCustomer?.phone) window.open(`https://wa.me/55${selectedCustomer.phone.replace(/\D/g, '')}`, '_blank');
                                            }} title="Abrir WhatsApp" aria-label="Abrir WhatsApp" className="px-3 py-1 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-lg flex items-center gap-1.5 shadow-md active:scale-95 transition-all">
                                                <Smartphone size={10} /> WhatsApp
                                            </button>
                                            <button title="ID do Cliente" aria-label="ID do Cliente" className="px-3 py-1 bg-white dark:bg-slate-800 text-slate-400 text-[8px] font-black uppercase rounded-lg border dark:border-slate-700">
                                                ID: {selectedCustomer?.id.slice(0, 6)}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto mt-4 sm:mt-0">
                                    {/* CARD HAVER (NOVO) */}
                                    {(selectedCustomer?.balance || 0) > 0 && (
                                        <div className="text-right p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800 flex-1 sm:flex-none min-w-[100px]">
                                            <p className="text-[7px] sm:text-[8px] font-black uppercase text-emerald-600 tracking-widest mb-1 flex items-center justify-end gap-1"><Coins size={10} /> Haver Disp.</p>
                                            <p className="text-lg sm:text-xl font-black leading-none text-emerald-600">R$ {formatMoney(selectedCustomer?.balance || 0)}</p>
                                        </div>
                                    )}

                                    {customerSummary && customerSummary.debtAnalysis > 0 && (
                                        <div className="text-right p-2 sm:p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800 flex-1 sm:flex-none min-w-[100px]">
                                            <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-1">Em Análise</p>
                                            <p className="text-lg sm:text-xl font-black leading-none text-amber-600">R$ {formatMoney(customerSummary.debtAnalysis)}</p>
                                        </div>
                                    )}
                                    {customerSummary && customerSummary.debtPending > 0 && (
                                        <div className="text-right p-2 sm:p-3 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-800 flex-1 sm:flex-none min-w-[100px]">
                                            <p className="text-[10px] font-black uppercase text-rose-600 tracking-widest mb-1">A Pagar</p>
                                            <p className="text-lg sm:text-xl font-black leading-none text-rose-600">R$ {formatMoney(customerSummary.debtPending)}</p>
                                        </div>
                                    )}

                                    {selectedCustomer && (sortedCustomerSales.length > 0 || (customerSummary?.visibleReceipts.length || 0) > 0) && (
                                        <button
                                            onClick={() => {
                                                const visibleIds = [
                                                    ...sortedCustomerSales.map(s => s.id),
                                                    ...(customerSummary?.visibleReceipts.map(r => r.id) || [])
                                                ];
                                                if (selectedSales.length === visibleIds.length) {
                                                    setSelectedSales([]);
                                                } else {
                                                    setSelectedSales(visibleIds);
                                                }
                                            }}
                                            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border-2 ${selectedSales.length > 0 && selectedSales.length === (sortedCustomerSales.length + (customerSummary?.visibleReceipts.length || 0))
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20'
                                                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-500 hover:border-blue-200'
                                                }`}
                                        >
                                            {selectedSales.length > 0 && selectedSales.length === (sortedCustomerSales.length + (customerSummary?.visibleReceipts.length || 0)) ? <Check size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
                                            {selectedSales.length > 0 && selectedSales.length === (sortedCustomerSales.length + (customerSummary?.visibleReceipts.length || 0)) ? 'Deselecionar Tudo' : 'Selecionar Tudo'}
                                        </button>
                                    )}

                                    {selectedSales.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={async () => {
                                                    if (!selectedCustomer) return;
                                                    const selected = [
                                                        ...sales.filter(s => selectedSales.includes(s.id)),
                                                        ...receipts.filter(r => selectedSales.includes(r.id))
                                                    ];
                                                    await exportSelectedSalesPDF(selectedCustomer, selected);
                                                }}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all animate-fadeIn"
                                            >
                                                <FilePdf size={16} /> Exportar ({selectedSales.length})
                                            </button>
                                            <button
                                                onClick={() => setSelectedSales([])}
                                                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                                                title="Limpar Seleção"
                                            >
                                                <X size={18} weight="bold" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 sm:p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 pb-16">
                                <div className="space-y-4">
                                    {/* FILTRO DE PEDIDOS DO CLIENTE */}
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-800">
                                            <div className="relative flex-1 min-w-[150px]">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar Nº pedido..."
                                                    value={searchNumber}
                                                    onChange={e => setSearchNumber(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-[9px] font-black uppercase outline-none focus:border-blue-500 transition-colors"
                                                />
                                            </div>
                                            <div className="flex items-center gap-1.5 ml-auto">
                                                <span className="text-[8px] font-black uppercase text-slate-400">Ord:</span>
                                                <button
                                                    onClick={() => setCustSortField('date')}
                                                    title="Ordenar por data" aria-label="Ordenar por data"
                                                    className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${custSortField === 'date' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                                >Data</button>
                                                <button
                                                    onClick={() => setCustSortField('saleNumber')}
                                                    title="Ordenar por número" aria-label="Ordenar por número"
                                                    className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${custSortField === 'saleNumber' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                                >Nº Pedido</button>
                                            </div>
                                            <button
                                                onClick={() => setCustSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                                title="Alternar ordem" aria-label="Alternar ordem"
                                                className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-xl text-[8px] font-black uppercase text-slate-500 hover:border-blue-500 transition-all"
                                            >
                                                {custSortOrder === 'desc' ? <><ChevronDown size={12} /> Recente</> : <><ChevronDown size={12} className="rotate-180" /> Antigo</>}
                                            </button>
                                        </div>

                                        {/* OCULTAÇÃO DE STATUS (ACORDEÃO) */}
                                        <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                                            <button
                                                onClick={() => setShowStatusFilters(!showStatusFilters)}
                                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <Filter size={14} className={hiddenStatuses.length > 0 ? 'text-rose-500' : 'text-slate-400'} />
                                                    <span className="text-[9px] font-black uppercase text-slate-500">Filtrar por Status</span>
                                                    {hiddenStatuses.length > 0 && (
                                                        <span className="bg-rose-100 text-rose-600 text-[7px] font-black px-1.5 py-0.5 rounded-md">
                                                            {hiddenStatuses.length}
                                                        </span>
                                                    )}
                                                </div>
                                                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${showStatusFilters ? 'rotate-180' : ''}`} />
                                            </button>

                                            <div className={`transition-all duration-300 ease-in-out ${showStatusFilters ? 'max-h-48 opacity-100 p-3 pt-0' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                                <div className="flex flex-wrap gap-1.5 pt-3 border-t dark:border-slate-800">
                                                    {statuses.map(st => {
                                                        const isHidden = hiddenStatuses.includes(st);
                                                        return (
                                                            <button
                                                                key={st}
                                                                onClick={() => {
                                                                    setHiddenStatuses(prev =>
                                                                        isHidden ? prev.filter(x => x !== st) : [...prev, st]
                                                                    );
                                                                }}
                                                                className={`px-2 py-1 rounded-full text-[7px] font-black uppercase transition-all border whitespace-nowrap ${isHidden ? 'bg-rose-50 text-rose-500 border-rose-200' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800 hover:border-blue-300'}`}
                                                            >
                                                                {st}
                                                            </button>
                                                        );
                                                    })}
                                                    {hiddenStatuses.length > 0 && (
                                                        <button
                                                            onClick={() => setHiddenStatuses([])}
                                                            className="text-[7px] font-black uppercase text-blue-500 hover:underline px-1 ml-auto"
                                                        >
                                                            Limpar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-zinc-900/60 dark:bg-slate-800/40 p-2 sm:p-4 rounded-3xl space-y-4">
                                        {sortedCustomerSales.map(s => {

                                            const isExpanded = expandedSaleId === s.id;
                                            const remaining = s.totalValue - s.amountPaid;
                                            const progress = (s.amountPaid / s.totalValue) * 100;
                                            const isAwaitingApproval = s.status === 'Aguardando Aprovação' || s.status === 'Aguardando Estoque';

                                            // VERIFICAÇÃO DE ESTOQUE DISPONÍVEL (FEEDBACK VERDE)
                                            const isStockReady = checkStockAvailability(s);
                                            const canReleaseNow = isAwaitingApproval && isStockReady;

                                            return (
                                                <div key={s.id} id={`sale-${s.id}`} className={`relative bg-white dark:bg-slate-900 border-2 dark:border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-500 ${s.status === 'Cancelada' ? 'opacity-50 grayscale border-slate-100' : isExpanded ? 'border-blue-500 shadow-2xl -translate-y-1' : (canReleaseNow ? 'border-emerald-400 shadow-emerald-100 dark:shadow-none' : 'border-slate-100 hover:border-blue-200')}`}>
                                                    {/* FAIXA VERDE SE ESTIVER PRONTO */}
                                                    {canReleaseNow && !isExpanded && (
                                                        <div className="bg-emerald-500 text-white text-[10px] font-black uppercase text-center py-1.5 tracking-widest flex items-center justify-center gap-2">
                                                            <PackageCheck size={12} /> Estoque Disponível na Loja
                                                        </div>
                                                    )}

                                                    {/* Checkbox de Seleção */}
                                                    <div className="absolute top-4 right-4 z-10">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedSales(prev =>
                                                                    prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                                                );
                                                            }}
                                                            title="Selecionar Pedido"
                                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shadow-md ${selectedSales.includes(s.id) ? 'bg-blue-600 border-blue-600 text-white shadow-blue-500/20' : 'bg-white dark:bg-slate-800 border-amber-500 dark:border-amber-400 text-transparent hover:scale-110'}`}
                                                        >
                                                            <Check size={12} weight="bold" />
                                                        </button>
                                                    </div>

                                                    {/* FAIXA ROSE SE CANCELADO */}
                                                    {s.status === 'Cancelada' && (
                                                        <div className="bg-rose-600 text-white text-[10px] font-black uppercase text-center py-1.5 tracking-widest flex items-center justify-center gap-2">
                                                            <Prohibit size={12} weight="bold" /> PEDIDO CANCELADO
                                                        </div>
                                                    )}

                                                    <div
                                                        onClick={() => setExpandedSaleId(isExpanded ? null : s.id)}
                                                        className={`w-full p-2.5 sm:p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer transition-colors gap-3 sm:gap-4 ${isExpanded ? 'bg-blue-50/10' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                                                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${isExpanded ? 'bg-blue-600 text-white rotate-12' : (isAwaitingApproval ? (canReleaseNow ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600') : 'bg-rose-100 text-rose-600')}`}>
                                                                {isAwaitingApproval ? (canReleaseNow ? <PackageCheck size={18} /> : <Clock size={18} />) : <AlertCircle size={18} />}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5">
                                                                    <p className="text-[11px] sm:text-[12px] font-black text-blue-600 leading-none truncate">{s.saleNumber}</p>
                                                                    <button onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const cust = customers.find(c => c.id === s.customerId);
                                                                        navigator.clipboard.writeText(formatSaleToText(s, cust, products, colors));
                                                                        alert('Pedido copiado!');
                                                                    }} title="Copiar Pedido" aria-label="Copiar Pedido" className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"><Copy size={16} /></button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSeparationSale(s);
                                                                        }}
                                                                        title="Lista de Separação (Sem Valores)"
                                                                        aria-label="Lista de Separação"
                                                                        className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                                                                    >
                                                                        <ListChecks size={18} />
                                                                    </button>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    {isAwaitingApproval ? (
                                                                        <span className={`${canReleaseNow ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'} text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0`}>
                                                                            {canReleaseNow ? 'PODE LIBERAR' : 'EM ANÁLISE'}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="bg-rose-100 text-rose-600 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0">PENDENTE PGTO</span>
                                                                    )}
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 whitespace-nowrap"><Calendar size={10} /> {formatDate(s.date)}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-1 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                                                            <div className="text-left sm:text-right flex-1 sm:flex-none pl-1">
                                                                <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1 ${isAwaitingApproval ? 'text-amber-500' : 'text-rose-500'}`}>
                                                                    {isAwaitingApproval ? 'Saldo Análise' : 'Saldo Devedor'}
                                                                </p>
                                                                <p className={`text-xl sm:text-2xl font-black leading-none whitespace-nowrap ${isAwaitingApproval ? 'text-amber-600' : 'text-rose-600'}`}>
                                                                    R$ {formatMoney(Math.abs(remaining))}
                                                                </p>
                                                            </div>

                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {(s.status === 'Aguardando Aprovação' || s.status === 'Aguardando Estoque') && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); if (canReleaseNow) setApprovingSale(s); }}
                                                                        className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white rounded-xl shadow-lg active:scale-95 transition-all z-50 ${canReleaseNow ? 'bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600 cursor-pointer' : 'bg-slate-300 shadow-none cursor-not-allowed'}`}
                                                                        title={canReleaseNow ? "Estoque Suficiente: Liberar Agora" : "Aguardando Estoque"}
                                                                        aria-label={canReleaseNow ? "Liberar Agora" : "Aguardando Estoque"}
                                                                        disabled={!canReleaseNow}
                                                                    >
                                                                        {canReleaseNow ? <CheckCircle2 size={18} /> : <Lock size={18} />}
                                                                    </button>
                                                                )}

                                                                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 border-2 ${isExpanded ? 'bg-amber-500 border-amber-500 text-white rotate-180 shadow-lg shadow-amber-500/30' : 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400'}`}>
                                                                    <ChevronDown size={18} />
                                                                </div>
                                                                {(() => {
                                                                    const isBlocked = (s.status === 'Entregue' && s.isPaid) || s.status === 'Cancelada';
                                                                    return (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (isBlocked) return;
                                                                                handleCancelSale(s);
                                                                            }}
                                                                            className={`w-9 h-9 sm:w-10 sm:h-10 border-2 rounded-full flex items-center justify-center shadow-sm transition-all shrink-0 ${isBlocked
                                                                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                                                                : 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white'
                                                                                }`}
                                                                            title={s.status === 'Cancelada' ? "PEDIDO JÁ CANCELADO" : isBlocked ? "PEDIDO ENTREGUE E PAGO" : "CANCELAR PEDIDO"}
                                                                            aria-label="Cancelar Pedido"
                                                                            disabled={isBlocked}
                                                                        >
                                                                            <Prohibit size={18} weight="bold" />
                                                                        </button>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>     {isExpanded && (
                                                        <div className="p-6 pt-0 space-y-6 animate-fadeIn border-t dark:border-slate-800">
                                                            <div className="space-y-4 pt-6">
                                                                {/* BARRA DE PROGRESSO COM VALORES CLAROS */}
                                                                <div className="flex items-end justify-between">
                                                                    <div>
                                                                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Pago até agora</p>
                                                                        <p className="text-xl font-black text-slate-800 dark:text-white">R$ {formatMoney(s.amountPaid)}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total da Venda</p>
                                                                        <p className="text-base font-bold text-slate-500 dark:text-slate-400">R$ {formatMoney(s.totalValue)}</p>
                                                                        {s.discount && s.discount > 0 && (
                                                                            <p className="text-[9px] font-black text-blue-500 uppercase mt-0.5">Desconto: R$ {formatMoney(s.discount)}</p>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="relative h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border dark:border-slate-700">
                                                                    <div
                                                                        className={`absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)] w-[${Math.round(Math.min(100, progress))}%]`}
                                                                    ></div>
                                                                </div>

                                                                {remaining <= 0 && (
                                                                    <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">
                                                                        <CheckCircle2 size={16} /> Dívida Totalmente Quitada
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* BOTAO GOOGLE KEEP */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const cust = customers.find(c => c.id === s.customerId);
                                                                    window.open(`https://keep.google.com/u/0/#createNote?text=${encodeURIComponent(formatSaleToText(s, cust, products, colors))}`, '_blank');
                                                                }}
                                                                className="w-full py-4 bg-yellow-500 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                                                            >
                                                                <Note size={24} weight="fill" /> Exportar para Google Keep
                                                            </button>

                                                            {/* LISTA DE ITENS DO PEDIDO */}
                                                            <div className="space-y-3">
                                                                <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2 px-1">
                                                                    <Box size={14} /> Itens do Pedido
                                                                </h5>
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    {s.items.map((item, idx) => {
                                                                        const product = products.find(p => p.id === item.productId);
                                                                        const colorName = colors.find(c => c.id === item.colorId)?.name || item.colorId || 'Padrão';
                                                                        return (
                                                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-800 group hover:border-blue-200 transition-colors">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center border dark:border-slate-700 overflow-hidden shrink-0">
                                                                                        {showMiniatures && product?.image ? <img src={product.image} alt={product.reference} className="w-full h-full object-cover" /> : <Box size={14} className="text-slate-300" />}
                                                                                    </div>
                                                                                    <div className="leading-tight">
                                                                                        <p className="text-[10px] font-black uppercase dark:text-white">{product?.reference || 'REF'}</p>
                                                                                        <p className="text-[8px] font-bold text-slate-400 uppercase">{getColorName(item.colorId, colors)} • {item.isWholesale ? 'Atacado' : 'Varejo'}</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <p className="text-[10px] font-black text-blue-600">{item.quantity}x</p>
                                                                                    <p className="text-[8px] font-bold text-slate-400">R$ {formatMoney(item.priceAtSale)}</p>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between px-1">
                                                                    <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                                                                        <ReceiptText size={14} /> Extrato Financeiro
                                                                    </h5>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{(s.paymentHistory || []).length} Lançamentos</span>
                                                                </div>

                                                                <div className="bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-inner relative">
                                                                    {/* Linha vertical de timeline */}
                                                                    <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-200 dark:bg-slate-800 z-0"></div>

                                                                    <div className="divide-y-2 dark:divide-slate-800 max-h-[300px] overflow-y-auto custom-scrollbar relative z-10 p-2">
                                                                        {/* Item Inicial: A Venda */}
                                                                        <div className="flex items-start gap-4 p-4 opacity-70">
                                                                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0 border-4 border-slate-50 dark:border-slate-950 text-[10px] font-bold">IN</div>
                                                                            <div className="flex-1 pt-1">
                                                                                <p className="text-[10px] font-black uppercase dark:text-white">Registro da Venda</p>
                                                                                <p className="text-[8px] font-bold text-slate-400 uppercase">{formatDate(s.date)}</p>
                                                                            </div>
                                                                            <div className="pt-1">
                                                                                <span className="text-xs font-black text-slate-400">R$ {formatMoney(s.totalValue)}</span>
                                                                            </div>
                                                                        </div>

                                                                        {(s.paymentHistory || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((h, i) => (
                                                                            <div key={h.id} className="group relative">
                                                                                {editingPaymentId === h.id ? (
                                                                                    <div className="m-2 p-3 bg-white dark:bg-slate-800 rounded-xl border-2 border-blue-100 dark:border-blue-900/30 shadow-lg animate-fadeIn ml-10">
                                                                                        <p className="text-[8px] font-black uppercase text-blue-600 mb-2">Editar Lançamento</p>
                                                                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                                                                            <div className="space-y-1">
                                                                                                <label className="text-[7px] font-bold uppercase text-slate-400">Valor</label>
                                                                                                <input
                                                                                                    title="Valor Pago" aria-label="Valor Pago"
                                                                                                    type="number" value={editPayForm.amount}
                                                                                                    onChange={e => setEditPayForm({ ...editPayForm, amount: e.target.value })}
                                                                                                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-2 text-xs font-black"
                                                                                                />
                                                                                            </div>
                                                                                            <div className="space-y-1">
                                                                                                <label className="text-[7px] font-bold uppercase text-slate-400">Data</label>
                                                                                                <input
                                                                                                    title="Data do Pagamento" aria-label="Data do Pagamento"
                                                                                                    type="date" value={editPayForm.date}
                                                                                                    onChange={e => setEditPayForm({ ...editPayForm, date: e.target.value })}
                                                                                                    className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-2 text-[10px] font-black"
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex gap-2">
                                                                                            <button onClick={() => setEditingPaymentId(null)} title="Cancelar Edição" aria-label="Cancelar Edição" className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-[8px] font-black uppercase rounded-lg">Cancelar</button>
                                                                                            <button onClick={() => handleEditPayment(s, h.id)} title="Salvar Edição" aria-label="Salvar Edição" className="flex-[2] py-2 bg-blue-600 text-white text-[8px] font-black uppercase rounded-lg flex items-center justify-center gap-1"><Check size={10} /> Salvar</button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-start gap-4 p-4 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors rounded-xl">
                                                                                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 border-4 border-slate-50 dark:border-slate-950 shadow-sm z-10">
                                                                                            <Check size={14} />
                                                                                        </div>
                                                                                        <div className="flex-1 pt-1 min-w-0">
                                                                                            <div className="flex justify-between items-start">
                                                                                                <div>
                                                                                                    <p className="text-[10px] font-black uppercase dark:text-white leading-tight">{h.note || 'Pagamento Recebido'}</p>
                                                                                                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{formatDate(h.date)}</p>
                                                                                                </div>
                                                                                                <div className="flex flex-col items-end gap-1">
                                                                                                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                                                                                        - R$ {formatMoney(h.amount)}
                                                                                                    </span>
                                                                                                    {s.status === 'Cancelada' && (
                                                                                                        <span className="text-[7px] font-black text-rose-500 uppercase bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded-md">Bloqueado</span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                            {/* Ações de Edição (Só aparecem no hover) */}
                                                                                            {s.status !== 'Cancelada' && (
                                                                                                <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                                    <button onClick={() => { setEditingPaymentId(h.id); setEditPayForm({ amount: String(h.amount), date: h.date.slice(0, 10) }); }} title="Editar Pagamento" aria-label="Editar Pagamento" className="text-[8px] font-bold uppercase text-amber-500 hover:text-amber-600 flex items-center gap-1"><Pencil size={10} /> Editar</button>
                                                                                                    <button onClick={() => handleDeletePayment(s, h.id)} title="Excluir Pagamento" aria-label="Excluir Pagamento" className="text-[8px] font-bold uppercase text-rose-500 hover:text-rose-600 flex items-center gap-1"><Trash2 size={10} /> Excluir</button>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}

                                                                        {(!s.paymentHistory || s.paymentHistory.length === 0) && (
                                                                            <div className="p-8 text-center ml-8">
                                                                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest italic">Aguardando primeiro pagamento...</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* HISTÓRICO DE LIBERAÇÕES PARCIAIS */}
                                                                {(s.releaseHistory || []).length > 0 && (
                                                                    <div className="space-y-3 mt-6">
                                                                        <div className="flex items-center justify-between px-1">
                                                                            <h5 className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em] flex items-center gap-2">
                                                                                <Split size={14} /> Histórico de Liberações
                                                                            </h5>
                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">{(s.releaseHistory || []).length} Liberações</span>
                                                                        </div>
                                                                        <div className="bg-indigo-50/30 dark:bg-indigo-900/10 border-2 border-indigo-100 dark:border-indigo-800/50 rounded-[2rem] p-4 space-y-3">
                                                                            {(s.releaseHistory || []).map((rel, ridx) => (
                                                                                <div key={ridx} className="flex justify-between items-center text-[10px] font-bold">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg text-[8px] font-black">{rel.saleNumber}</span>
                                                                                        <span className="text-slate-500 uppercase">{formatDate(rel.date)}</span>
                                                                                    </div>
                                                                                    <div className="text-indigo-600">
                                                                                        {rel.items.reduce((acc, i) => acc + i.quantity, 0)} ITENS
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {!isAwaitingApproval && remaining > 0 && s.status !== 'Cancelada' && (
                                                                <div className="space-y-4 bg-blue-600 p-6 rounded-[2.2rem] shadow-xl shadow-blue-600/20 relative overflow-hidden group">
                                                                    <Sparkles className="absolute -right-4 -top-4 text-white/10 group-hover:rotate-12 transition-transform" size={80} />
                                                                    <h5 className="text-[10px] font-black uppercase text-white flex items-center gap-2 relative z-10"><Plus size={14} /> Novo Lançamento (Abater Dívida)</h5>
                                                                    <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                                                                        <div className="flex-[2] relative">
                                                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300 text-[11px] font-black">R$</span>
                                                                            <input
                                                                                title="Valor do Pagamento" aria-label="Valor do Pagamento"
                                                                                type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                                                                                placeholder="Valor pago?"
                                                                                className="w-full bg-white/10 border-2 border-white/20 text-white placeholder:text-white/40 rounded-[1.2rem] pl-10 pr-4 py-3 text-sm font-black outline-none focus:border-white/50 focus:bg-white/20 transition-all shadow-inner"
                                                                            />
                                                                        </div>
                                                                        <div className="flex-1 relative">
                                                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={14} />
                                                                            <input
                                                                                title="Data do Pagamento" aria-label="Data do Pagamento"
                                                                                type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                                                                                className="w-full bg-white/10 border-2 border-white/20 text-white rounded-[1.2rem] pl-11 pr-3 py-3 text-[11px] font-black outline-none focus:border-white/50 transition-all shadow-inner"
                                                                            />
                                                                        </div>
                                                                        <button
                                                                            disabled={isLaunchingPayment}
                                                                            onClick={() => handleLaunchPayment(s.id)}
                                                                            title="Lançar Pagamento" aria-label="Lançar Pagamento"
                                                                            className={`px-8 py-3 ${isLaunchingPayment ? 'bg-slate-200 text-slate-400' : 'bg-white text-blue-600'} rounded-[1.2rem] text-[11px] font-black uppercase shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2`}
                                                                        >
                                                                            {isLaunchingPayment ? <Clock size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                                            {isLaunchingPayment ? 'LANÇANDO...' : 'LANÇAR'}
                                                                        </button>
                                                                    </div>
                                                                    <div className="relative z-10 pt-2 border-t border-white/10">
                                                                        <button
                                                                            disabled={isLaunchingPayment}
                                                                            onClick={() => handleQuitarVenda(s)}
                                                                            title="Quitar Valor Total" aria-label="Quitar Valor Total"
                                                                            className="w-full py-2.5 bg-white/20 text-white hover:bg-white hover:text-blue-600 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border border-white/30"
                                                                        >
                                                                            <CheckCircle2 size={16} /> Quitação (Pagar Totalidade)
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {isAwaitingApproval && (
                                                                <div className={`p-6 border-2 border-dashed rounded-[2.2rem] text-center ${canReleaseNow ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800'}`}>
                                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${canReleaseNow ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400 dark:bg-slate-800'}`}>
                                                                        {canReleaseNow ? <PackageCheck size={20} /> : <Lock size={20} />}
                                                                    </div>
                                                                    <h5 className={`text-[10px] font-black uppercase mb-1 ${canReleaseNow ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                                        {canReleaseNow ? 'ESTOQUE FÍSICO SUFICIENTE' : 'APROVAÇÃO NECESSÁRIA'}
                                                                    </h5>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-4">
                                                                        {canReleaseNow ? 'Você pode liberar este pedido usando o estoque atual da loja.' : 'Aguarde o estoque ou realize uma liberação parcial.'}
                                                                    </p>

                                                                    {s.status !== 'Cancelada' && (
                                                                        <div className="flex flex-col gap-2">
                                                                            <button
                                                                                onClick={() => canReleaseNow && setApprovingSale(s)}
                                                                                disabled={!canReleaseNow}
                                                                                title={canReleaseNow ? 'Liberar Agora' : 'Aguardando Estoque Completo'} aria-label={canReleaseNow ? 'Liberar Agora' : 'Aguardando Estoque Completo'}
                                                                                className={`w-full py-3.5 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all flex items-center justify-center gap-2 ${canReleaseNow ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'}`}
                                                                            >
                                                                                {canReleaseNow ? <Zap size={14} /> : <Lock size={14} />}
                                                                                {canReleaseNow ? 'LIBERAR AGORA' : 'AGUARDANDO ESTOQUE COMPLETO'}
                                                                            </button>

                                                                            <button
                                                                                onClick={() => setPartialSale(s)}
                                                                                title="Liberação Parcial" aria-label="Liberação Parcial"
                                                                                className="w-full py-3.5 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 active:scale-95 transition-all"
                                                                            >
                                                                                <Split size={14} className="inline mr-2" /> LIBERAÇÃO PARCIAL (SUB-VENDA)
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {s.status === 'Cancelada' && (
                                                                        <div className="bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 p-6 rounded-2xl border-2 border-dashed border-rose-200 dark:border-rose-800">
                                                                            <p className="text-[10px] font-black uppercase">Pedido Bloqueado</p>
                                                                            <p className="text-[8px] font-bold uppercase mt-1">Este pedido foi cancelado e não permite mais alterações.</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="flex justify-center pt-2">
                                                                <button onClick={() => setExpandedSaleId(null)} title="Recolher Detalhes" aria-label="Recolher Detalhes" className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors py-2 px-4">
                                                                    <ChevronUp size={14} /> Recolher Detalhes
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* RENDERIZAÇÃO DE RECEBIMENTOS (Separada das Vendas) */}
                                        {receipts.filter(r => r.customerId === selectedCustomerId && !r.isPaid).map(r => {
                                            const isExpanded = expandedSaleId === r.id;
                                            const remaining = r.totalValue - (r.amountPaid || 0);
                                            const progress = r.totalValue > 0 ? ((r.amountPaid || 0) / r.totalValue) * 100 : 0;

                                            return (
                                                <div key={r.id} id={`receipt-${r.id}`} className={`relative bg-white dark:bg-slate-900 border-2 dark:border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-500 ${isExpanded ? 'border-violet-500 shadow-2xl -translate-y-1' : 'border-slate-100 hover:border-violet-200'}`}>
                                                    {/* Checkbox de Seleção */}
                                                    <div className="absolute top-4 right-4 z-10">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedSales(prev =>
                                                                    prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]
                                                                );
                                                            }}
                                                            title="Selecionar Recebimento"
                                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shadow-md ${selectedSales.includes(r.id) ? 'bg-violet-600 border-violet-600 text-white shadow-violet-500/20' : 'bg-white dark:bg-slate-800 border-amber-500 dark:border-amber-400 text-transparent hover:scale-110'}`}
                                                        >
                                                            <Check size={12} weight="bold" />
                                                        </button>
                                                    </div>
                                                    <div
                                                        onClick={() => setExpandedSaleId(isExpanded ? null : r.id)}
                                                        className={`w-full p-2.5 sm:p-4 md:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer transition-colors gap-3 sm:gap-4 ${isExpanded ? 'bg-violet-50/10' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                                                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${isExpanded ? 'bg-violet-600 text-white rotate-12' : 'bg-violet-100 text-violet-600'}`}>
                                                                <ReceiptText size={18} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5">
                                                                    <p className="text-[11px] sm:text-[12px] font-black text-violet-600 leading-none truncate">{r.receiptNumber}</p>
                                                                    {(() => {
                                                                        const isOverdue = r.dueDate && new Date(r.dueDate) < new Date() && remaining > 0;
                                                                        const isPaid = remaining <= 0;

                                                                        if (isPaid) return <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0 px-2 tracking-widest">QUITADO</span>;
                                                                        if (isOverdue) return <span className="bg-rose-100 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0 px-2 tracking-widest">ATRASADO</span>;
                                                                        return <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0 px-2 tracking-widest">PENDENTE</span>;
                                                                    })()}
                                                                    <span className="bg-violet-100 text-violet-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Recebimento Geral</span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1 whitespace-nowrap">
                                                                        <Calendar size={10} /> Emissão: {formatDate(r.date)}
                                                                    </p>
                                                                    {r.dueDate && (
                                                                        <>
                                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500">•</span>
                                                                            <p className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1 whitespace-nowrap">
                                                                                <Clock size={10} /> Venc: {formatDate(r.dueDate)}
                                                                            </p>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                {/* Barra de Progresso no Card Compacto */}
                                                                <div className="w-full max-w-[200px]">
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <span className="text-[7px] font-black text-slate-400 uppercase">Progresso da Quitação</span>
                                                                        <span className="text-[7px] font-black text-violet-600 uppercase">{Math.round(progress)}%</span>
                                                                    </div>
                                                                    <div className="relative h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border dark:border-slate-700">
                                                                        <div
                                                                            className={`absolute top-0 left-0 h-full bg-violet-500 rounded-full transition-all duration-1000 w-[${Math.round(Math.min(100, progress))}%]`}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                                                            <div className="text-left sm:text-right flex-1 sm:flex-none px-1">
                                                                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest mb-0.5 sm:mb-1 text-violet-500">
                                                                    Saldo em Aberto
                                                                </p>
                                                                <p className="text-lg sm:text-2xl font-black leading-none whitespace-nowrap text-violet-600">
                                                                    R$ {formatMoney(remaining)}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 no-scrollbar">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleExportReceiptPDF(r); }}
                                                                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-violet-50 border-2 border-violet-100 text-violet-600 hover:bg-violet-600 hover:border-violet-600 hover:text-white transition-all shrink-0"
                                                                    title="Exportar Recibo PDF"
                                                                >
                                                                    <FilePdf size={16} className="sm:w-[18px] sm:h-[18px]" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleCopyReceiptText(r); }}
                                                                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-slate-50 border-2 border-slate-100 text-slate-500 hover:bg-slate-500 hover:border-slate-500 hover:text-white transition-all shrink-0"
                                                                    title="Copiar Texto do Recibo"
                                                                >
                                                                    <Copy size={16} className="sm:w-[18px] sm:h-[18px]" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm(`Excluir este recebimento (${r.receiptNumber}) e todos os seus lançamentos financeiros?`)) {
                                                                            onDeleteReceipt(r.id);
                                                                        }
                                                                    }}
                                                                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-rose-50 border-2 border-rose-100 text-rose-500 hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-all shrink-0"
                                                                    title="Excluir Recebimento"
                                                                >
                                                                    <Trash size={16} className="sm:w-[18px] sm:h-[18px]" />
                                                                </button>
                                                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 border-2 ${isExpanded ? 'bg-violet-500 border-violet-500 text-white rotate-180 shadow-lg shadow-violet-500/30' : 'bg-violet-50 border-violet-100 text-violet-600 dark:bg-slate-800 dark:border-slate-700 dark:text-violet-400'}`}>
                                                                    <ChevronDown size={16} className="sm:w-[18px] sm:h-[18px]" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="px-5 pb-5 animate-slideDown space-y-4">
                                                            {/* Descrição do Item */}
                                                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-700">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Descrição / Detalhes</p>
                                                                <p className="text-[10px] font-bold dark:text-white leading-relaxed">
                                                                    {r.itemDescription || "Sem descrição detalhada."}
                                                                </p>
                                                            </div>

                                                            {/* Grid de Ações e Histórico */}
                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                {/* Extrato de Pagamentos (MOVIDO PARA CIMA) */}
                                                                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border dark:border-slate-800 space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <h6 className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                                                                            <History size={14} /> Extrato de Amortizações
                                                                        </h6>
                                                                        <span className="text-[8px] font-bold text-slate-400">{(r.paymentHistory || []).length} Lançamentos</span>
                                                                    </div>
                                                                    <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                                                                        {(r.paymentHistory || []).length > 0 ? (
                                                                            (r.paymentHistory || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((p, idx) => (
                                                                                <div key={p.id} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 group hover:border-violet-200 transition-colors shadow-sm">
                                                                                    {editingReceiptPaymentId === p.id ? (
                                                                                        <div className="space-y-2">
                                                                                            <div className="flex gap-2">
                                                                                                <input
                                                                                                    type="number"
                                                                                                    title="Novo valor da amortização"
                                                                                                    placeholder="Valor"
                                                                                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-[10px] font-black"
                                                                                                    value={editReceiptPayForm.amount}
                                                                                                    onChange={e => setEditReceiptPayForm({ ...editReceiptPayForm, amount: e.target.value })}
                                                                                                />
                                                                                                <input
                                                                                                    type="date"
                                                                                                    title="Nova data da amortização"
                                                                                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-[10px] font-black"
                                                                                                    value={editReceiptPayForm.date}
                                                                                                    onChange={e => setEditReceiptPayForm({ ...editReceiptPayForm, date: e.target.value })}
                                                                                                />
                                                                                            </div>
                                                                                            <div className="flex justify-end gap-2">
                                                                                                <button onClick={() => setEditingReceiptPaymentId(null)} className="text-[8px] font-black uppercase text-slate-400">Cancelar</button>
                                                                                                <button onClick={() => handleEditReceiptPayment(r.id, p.id)} className="text-[8px] font-black uppercase text-violet-600">Salvar</button>
                                                                                            </div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex items-center justify-between">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center shrink-0">
                                                                                                    <Check size={14} />
                                                                                                </div>
                                                                                                <div className="leading-tight">
                                                                                                    <p className="text-[9px] font-black dark:text-white uppercase">{p.note || 'Amortização'}</p>
                                                                                                    <p className="text-[7px] font-bold text-slate-400 uppercase">{formatDate(p.date)}</p>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-2">
                                                                                                <p className="text-[10px] font-black text-emerald-600 mr-1">
                                                                                                    R$ {formatMoney(p.amount)}
                                                                                                </p>
                                                                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                                    <button
                                                                                                        onClick={() => {
                                                                                                            setEditingReceiptPaymentId(p.id);
                                                                                                            setEditReceiptPayForm({ amount: String(p.amount), date: p.date, note: p.note || '' });
                                                                                                        }}
                                                                                                        className="p-1 text-slate-400 hover:text-blue-500"
                                                                                                        title="Editar"
                                                                                                    >
                                                                                                        <Pencil size={12} />
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={() => handleDeleteReceiptPayment(r.id, p.id)}
                                                                                                        className="p-1 text-slate-400 hover:text-rose-500"
                                                                                                        title="Excluir"
                                                                                                    >
                                                                                                        <Trash size={12} />
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <div className="py-8 text-center bg-white dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                                                                                <p className="text-[9px] font-bold text-slate-400 uppercase italic">Nenhum pagamento registrado.</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Formulário de Amortização (MOVIDO PARA BAIXO) */}
                                                                <div className="p-4 bg-violet-50/30 dark:bg-violet-900/10 rounded-2xl border-2 border-violet-100 dark:border-violet-900/30 space-y-4 relative overflow-hidden">
                                                                    <Sparkles className="absolute -right-4 -top-4 text-violet-500/10" size={60} />
                                                                    <h6 className="text-[10px] font-black uppercase text-violet-600 flex items-center gap-2">
                                                                        <Plus size={14} /> Amortizar Recebimento
                                                                    </h6>
                                                                    <div className="space-y-3 relative z-10">
                                                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                                                                            <div className="flex-1">
                                                                                <label className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase ml-1">Valor R$</label>
                                                                                <input
                                                                                    type="number"
                                                                                    placeholder="0,00"
                                                                                    title="Valor da amortização"
                                                                                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 sm:py-2.5 text-sm sm:text-xs font-black outline-none focus:border-violet-500 transition-all dark:text-white"
                                                                                    value={payAmount}
                                                                                    onChange={e => setPayAmount(e.target.value)}
                                                                                />
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <label className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase ml-1">Data</label>
                                                                                <input
                                                                                    type="date"
                                                                                    title="Data da amortização"
                                                                                    className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 sm:py-2.5 text-xs sm:text-[10px] font-black outline-none focus:border-violet-500 transition-all dark:text-white"
                                                                                    value={payDate}
                                                                                    onChange={e => setPayDate(e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[7px] font-black text-slate-400 uppercase ml-1">Observação (Opcional)</label>
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Ex: Pago via PIX, dinheiro..."
                                                                                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none focus:border-violet-500 transition-all dark:text-white"
                                                                                value={payNote}
                                                                                onChange={e => setPayNote(e.target.value)}
                                                                            />
                                                                        </div>
                                                                        <button
                                                                            disabled={isLaunchingPayment}
                                                                            onClick={() => handleLaunchReceiptPayment(r.id)}
                                                                            className={`w-full py-3 ${isLaunchingPayment ? 'bg-slate-400' : 'bg-violet-600'} text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-violet-600/20 active:scale-95 transition-all flex items-center justify-center gap-2`}
                                                                        >
                                                                            {isLaunchingPayment ? (
                                                                                <Clock size={16} className="animate-spin" />
                                                                            ) : (
                                                                                <CheckCircle2 size={16} />
                                                                            )}
                                                                            {isLaunchingPayment ? 'PROCESSANDO...' : 'Confirmar Pagamento'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-center">
                                                                <button onClick={() => setExpandedSaleId(null)} className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 flex items-center gap-1">
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
                        </div>
                    ) : (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800 opacity-40">
                            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
                                <User size={48} className="text-slate-300" />
                            </div>
                            <h3 className="text-sm font-black uppercase text-slate-400 tracking-[0.4em]">Selecione um Cliente</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-3 max-w-xs leading-relaxed">
                                Toque em um cliente na lista ao lado para gerenciar pendências e haveres.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE SEPARAÇÃO */}
            {
                separationSale && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-sm border dark:border-slate-800 shadow-2xl overflow-hidden animate-slideUp">
                            <div className="p-6 text-center border-b dark:border-slate-800">
                                <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-600/20">
                                    <ListChecks size={32} />
                                </div>
                                <h4 className="text-lg font-black uppercase dark:text-white leading-tight">Lista de Separação</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Escolha como deseja prosseguir com o pedido {separationSale.saleNumber}</p>
                            </div>

                            <div className="p-4 pb-12 space-y-3">
                                <button
                                    onClick={() => {
                                        const cust = customers.find(c => c.id === separationSale.customerId);
                                        navigator.clipboard.writeText(formatSaleToSeparationText(separationSale, cust, products, colors));
                                        alert('Lista de separação copiada!');
                                        setSeparationSale(null);
                                    }}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-2xl border-2 border-transparent hover:border-blue-500 transition-all flex items-center gap-4 group"
                                >
                                    <div className="p-3 bg-white dark:bg-slate-700 rounded-xl text-slate-400 group-hover:text-blue-500 shadow-sm">
                                        <Copy size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[11px] font-black uppercase dark:text-white">Copiar Texto</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Área de transferência</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        const cust = customers.find(c => c.id === separationSale.customerId);
                                        const cartItems = separationSale.items.map(item => {
                                            const product = products.find(p => p.id === item.productId);
                                            const colorName = colors.find(c => c.id === item.colorId)?.name || item.colorId || '';
                                            return {
                                                ...item,
                                                name: product?.reference || 'Produto',
                                                variationName: colorName,
                                                price: item.priceAtSale
                                            };
                                        });
                                        exportSeparationListPDF({
                                            customer: cust || { name: 'Cliente Geral' } as any,
                                            items: cartItems as any,
                                            date: separationSale.date
                                        });
                                        setSeparationSale(null);
                                    }}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-2xl border-2 border-transparent hover:border-emerald-500 transition-all flex items-center gap-4 group"
                                >
                                    <div className="p-3 bg-white dark:bg-slate-700 rounded-xl text-slate-400 group-hover:text-emerald-500 shadow-sm">
                                        <FileText size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[11px] font-black uppercase dark:text-white">Gerar PDF</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Lista p/ Impressão</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        const cust = customers.find(c => c.id === separationSale.customerId);
                                        navigator.clipboard.writeText(formatSaleToSimpleListText(separationSale, cust, products, colors));
                                        alert('Lista simples copiada!');
                                        setSeparationSale(null);
                                    }}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-2xl border-2 border-transparent hover:border-amber-500 transition-all flex items-center gap-4 group"
                                >
                                    <div className="p-3 bg-white dark:bg-slate-700 rounded-xl text-slate-400 group-hover:text-amber-500 shadow-sm">
                                        <Copy size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[11px] font-black uppercase dark:text-white">Lista Simples</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Texto sem ícones e com valores</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        const cust = customers.find(c => c.id === separationSale.customerId);
                                        navigator.clipboard.writeText(formatSaleToProductListText(separationSale, cust, products, colors));
                                        alert('Lista de produtos copiada!');
                                        setSeparationSale(null);
                                    }}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-2xl border-2 border-transparent hover:border-violet-500 transition-all flex items-center gap-4 group"
                                >
                                    <div className="p-3 bg-white dark:bg-slate-700 rounded-xl text-slate-400 group-hover:text-violet-500 shadow-sm">
                                        <Copy size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[11px] font-black uppercase dark:text-white">Lista Produtos</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Referência, cor e quantidade (cx)</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setSeparationSale(null)}
                                    className="w-full py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                viewingCustomer && (
                    <CustomerDetailModal
                        customer={viewingCustomer}
                        sales={sales.filter(s => s.customerId === viewingCustomer.id)}
                        onClose={() => setViewingCustomer(null)}
                        onUpdate={(c) => {
                            onUpdateCustomer(c);
                            setViewingCustomer(null);
                        }}
                    />
                )
            }
        </div >
    );
};

const PartialReleaseModal = ({ sale, products, colors, showMiniatures, onClose, onConfirm }: {
    sale: Sale,
    products: Product[],
    colors: any[],
    showMiniatures: boolean,
    onClose: () => void,
    onConfirm: (originalSale: Sale, releasedItems: SaleItem[], paymentType: 'cash' | 'credit') => void
}) => {
    const [releaseQuantities, setReleaseQuantities] = useState<Record<string, number>>({});
    const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');

    const getItemKey = (item: SaleItem) => `${item.productId}-${item.variationId || item.distributionId}-${item.colorId}`;

    const releasedTotal = sale.items.reduce((acc, item) => {
        const key = getItemKey(item);
        const qtyToRelease = releaseQuantities[key] || 0;
        return acc + (qtyToRelease * item.priceAtSale);
    }, 0);

    const handleQuantityChange = (item: SaleItem, val: string) => {
        const qty = parseInt(val.replace(/\D/g, '') || '0');
        const key = getItemKey(item);

        const product = products.find(p => p.id === item.productId);
        let availablePhysical = 0;
        if (product) {
            if (item.isWholesale) {
                const ws = product.wholesaleStock.find(w => w.distributionId === item.distributionId && w.colorId === item.colorId);
                availablePhysical = ws ? ws.boxes : 0;
            } else {
                const v = product.variations.find(va => va.id === item.variationId);
                availablePhysical = v ? v.stock : 0;
            }
        }

        const maxAllowed = Math.min(item.quantity, availablePhysical);
        const safeQty = Math.min(Math.max(0, qty), maxAllowed);
        setReleaseQuantities(prev => ({ ...prev, [key]: safeQty }));
    };

    const handleConfirm = () => {
        const releasedItems: SaleItem[] = [];
        sale.items.forEach(item => {
            const key = getItemKey(item);
            const qty = releaseQuantities[key] || 0;
            if (qty > 0) {
                releasedItems.push({ ...item, quantity: qty });
            }
        });

        if (releasedItems.length === 0) return alert("Selecione pelo menos um item para liberar.");
        onConfirm(sale, releasedItems, paymentType);
    };

    const toggleFullItem = (item: SaleItem) => {
        const key = getItemKey(item);
        const current = releaseQuantities[key] || 0;

        const product = products.find(p => p.id === item.productId);
        let availablePhysical = 0;
        if (product) {
            if (item.isWholesale) {
                const ws = product.wholesaleStock.find(w => w.distributionId === item.distributionId && w.colorId === item.colorId);
                availablePhysical = ws ? ws.boxes : 0;
            } else {
                const v = product.variations.find(va => va.id === item.variationId);
                availablePhysical = v ? v.stock : 0;
            }
        }

        const maxAllowed = Math.min(item.quantity, availablePhysical);

        setReleaseQuantities(prev => ({
            ...prev,
            [key]: current === maxAllowed ? 0 : maxAllowed
        }));
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] animate-slideUp border dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-lg">
                            <Split size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black uppercase dark:text-white leading-tight">Liberação Parcial</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Selecione itens para criar um novo pedido liberado</p>
                        </div>
                    </div>
                    <button onClick={onClose} title="Fechar Liberação Parcial" aria-label="Fechar Liberação Parcial" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {sale.items.map((item, idx) => {
                        const product = products.find(p => p.id === item.productId);
                        const key = getItemKey(item);
                        const releaseQty = releaseQuantities[key] || 0;
                        const isSelected = releaseQty > 0;

                        return (
                            <div key={idx} className={`p-4 rounded-2xl border-2 transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center border dark:border-slate-600 overflow-hidden shrink-0">
                                            {showMiniatures && product?.image ? <img src={product.image} alt={`Foto do produto ${product.reference}`} className="w-full h-full object-cover" /> : <Box size={16} className="text-slate-300" />}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase dark:text-white truncate max-w-[150px]">{product?.reference}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">
                                                {getColorName(item.colorId, colors)} • {item.isWholesale ? 'CX' : 'UN'}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => toggleFullItem(item)} title={isSelected ? 'Desmarcar Tudo' : 'Selecionar Tudo'} aria-label={isSelected ? 'Desmarcar Tudo' : 'Selecionar Tudo'} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {isSelected ? 'Selecionado' : 'Selecionar Tudo'}
                                    </button>
                                </div>

                                <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 p-2 rounded-xl border dark:border-slate-700">
                                    <span className="text-[9px] font-black uppercase text-slate-400 ml-2">Liberar:</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleQuantityChange(item, String(releaseQty - 1))} title="Diminuir Quantidade" aria-label="Diminuir Quantidade" className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:bg-slate-200"><Minus size={12} /></button>
                                        <input
                                            type="number"
                                            title="Quantidade a Liberar" aria-label="Quantidade a Liberar"
                                            value={releaseQty}
                                            onChange={e => handleQuantityChange(item, e.target.value)}
                                            className="w-12 text-center text-xs font-black bg-transparent outline-none dark:text-white"
                                        />
                                        <button onClick={() => handleQuantityChange(item, String(releaseQty + 1))} title="Aumentar Quantidade" aria-label="Aumentar Quantidade" className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:bg-slate-200"><Plus size={12} /></button>
                                    </div>
                                    {(() => {
                                        const productObj = products.find(p => p.id === item.productId);
                                        let phys = 0;
                                        if (productObj) {
                                            const cName = getColorName(item.colorId, colors);
                                            if (item.isWholesale) {
                                                phys = (productObj.wholesaleStock || [])
                                                    .filter(w => w.distributionId === item.distributionId && getColorName(w.colorId, colors) === cName)
                                                    .reduce((acc, curr) => acc + sanitizeNum(curr.boxes), 0);
                                            } else {
                                                const variation = productObj.variations.find(v => v.id === item.variationId);
                                                const size = variation?.size;
                                                phys = (productObj.variations || [])
                                                    .filter(v => v.size === size && getColorName(v.colorId, colors) === cName)
                                                    .reduce((acc, curr) => acc + (curr.stock || 0), 0);
                                            }
                                        }
                                        return <span className={`text-[9px] font-bold mr-2 ${phys < item.quantity ? 'text-amber-500' : 'text-slate-400'}`}>Pedido: {item.quantity} (Físico: {phys})</span>;
                                    })()}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="p-6 pb-12 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Novo Sub-Pedido</p>
                            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm">
                                <button onClick={() => setPaymentType('cash')} title="Pagamento à Vista" aria-label="Pagamento à Vista" className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${paymentType === 'cash' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}>À Vista</button>
                                <button onClick={() => setPaymentType('credit')} title="Pagamento a Prazo" aria-label="Pagamento a Prazo" className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${paymentType === 'credit' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}>A Prazo</button>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Total Liberado</p>
                            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">R$ {formatMoney(releasedTotal)}</p>
                        </div>
                    </div>
                    <button onClick={handleConfirm} title="Confirmar Liberação Parcial" aria-label="Confirmar Liberação Parcial" className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all">
                        <CheckCircle2 size={18} /> Confirmar Liberação Parcial
                    </button>
                </div>
            </div>
        </div>
    );
};
