import React, { useState, useMemo } from 'react';
import { Transaction, Sale, Purchase, Customer, Supplier, Receipt, ExpenseCategory, BankAccount, AccountTransfer } from '../types';
import { formatMoney, formatDate, sanitizeNum, generateId } from '../lib/utils';
import { CategoryPieChart } from '../components/CategoryPieChart';
import {
    CurrencyDollar, Package, ArrowSquareUpRight, ArrowSquareDownLeft,
    Lightning, ShoppingCart, ArrowsClockwise, Clock, WarningCircle, Truck,
    ArrowUpRight, ArrowDownLeft, Wallet, TrendUp, TrendDown, Calendar, Funnel, FileText, CheckCircle, Warning, ShoppingBag, X, Check, MagnifyingGlass,
    ChartPie, ClockCounterClockwise, Plus, CaretDown, Pencil, Trash, Bank, ArrowsLeftRight, Scales
} from '@phosphor-icons/react';

// Lucide compat aliases
const TrendingUp = TrendUp;
const TrendingDown = TrendDown;
const Filter = Funnel;
const CheckCircle2 = CheckCircle;
const AlertCircle = Warning;
const DollarSign = CurrencyDollar;

interface FinanceiroViewProps {
    transactions: Transaction[];
    sales: Sale[];
    purchases: Purchase[];
    customers: Customer[];
    suppliers: Supplier[];
    onReceive: (saleId: string, amount: number, date: string) => void;
    onPay: (purchaseId: string, amount: number, date: string) => void;
    onDeletePaymentFromSale: (saleId: string, paymentId: string) => void;
    onUpdatePaymentInSale: (saleId: string, paymentId: string, amount: number, date: string) => void;
    onDeletePaymentFromPurchase: (purchaseId: string, paymentId: string) => void;
    onUpdatePaymentInPurchase: (purchaseId: string, paymentId: string, amount: number, date: string) => void;
    onUpdatePurchase: (purchase: Purchase) => void;
    onDeletePurchase?: (purchaseId: string) => void;
    receipts: Receipt[];
    onReceiveReceipt: (receiptId: string, amount: number, date: string, bankAccountId?: string) => void;
    categories: ExpenseCategory[];
    bankAccounts: BankAccount[];
    onAddAccount: (name: string, balance: number) => void;
    onUpdateAccount: (id: string, updates: Partial<BankAccount>) => void;
    onDeleteAccount: (id: string) => void;
    onTransfer: (transfer: Omit<AccountTransfer, 'id' | 'created_at'>) => void;
    onAdjustBalance: (accountId: string, newBalance: number) => void;
    onReceiveSale: (saleId: string, amount: number, date: string, bankAccountId?: string) => void;
    onPayPurchase: (purchaseId: string, amount: number, date: string, bankAccountId?: string) => void;
}

export const FinanceiroView = ({
    transactions, sales, purchases, customers, suppliers,
    onReceiveReceipt, categories,
    bankAccounts, onAddAccount, onUpdateAccount, onDeleteAccount,
    onTransfer, onAdjustBalance, onReceiveSale, onPayPurchase,
    onDeletePaymentFromSale, onUpdatePaymentInSale,
    onDeletePaymentFromPurchase, onUpdatePaymentInPurchase,
    onUpdatePurchase, onDeletePurchase, receipts
}: FinanceiroViewProps) => {
    const [tab, setTab] = useState<'overview' | 'accounts' | 'receivables' | 'payables' | 'history'>('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('pending');
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    // Estado do Modal de Transação
    const [selectedTransaction, setSelectedTransaction] = useState<{
        id: string;
        type: 'receivable' | 'payable';
        docNumber: string;
        entityName: string;
        total: number;
        remaining: number;
        paymentHistory: any[];
        items?: any[];
        rawPurchase?: Purchase;
    } | null>(null);

    // Cálculos Consolidados
    const summary = useMemo(() => {
        const totalCash = transactions.reduce((acc, t) => acc + t.amount, 0);

        const totalReceivable = sales
            .filter(s => !s.isPaid && s.status !== 'Cancelada' && s.totalValue > 0)
            .reduce((acc, s) => acc + (s.totalValue - s.amountPaid), 0) +
            receipts
                .filter(r => !r.isPaid && r.totalValue > 0)
                .reduce((acc, r) => acc + (r.totalValue - (r.amountPaid || 0)), 0);

        const totalPayable = purchases
            .filter(p => !p.isPaid && p.accounted !== false && p.totalValue > 0)
            .reduce((acc, p) => acc + (p.totalValue - (p.amountPaid || 0)), 0);

        // Histórico de movimentações (apenas soma dos positivos e negativos para visualização rápida)
        const income = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
        const expense = transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);

        // Agregação de despesas por categoria
        const expenseByCategory: Record<string, number> = {};

        const getCategoryName = (catIdOrName: string | undefined) => {
            if (!catIdOrName) return 'Geral';
            const found = categories.find(c => c.id === catIdOrName || c.name === catIdOrName);
            return found ? found.name : catIdOrName;
        };

        purchases.filter(p => p.accounted !== false).forEach(p => {
            if (p.type === 'general' && p.expenseItems && p.expenseItems.length > 0) {
                p.expenseItems.forEach((item: any) => {
                    const catName = getCategoryName(item.category);
                    expenseByCategory[catName] = (expenseByCategory[catName] || 0) + item.value;
                });
            } else {
                // Se for estoque ou despesa sem itens, usa o categoryId da compra ou fallback
                const catName = p.type === 'inventory' ? 'Estoque' : getCategoryName(p.categoryId);
                expenseByCategory[catName] = (expenseByCategory[catName] || 0) + (p.totalValue || 0);
            }
        });

        const CATEGORY_COLORS: Record<string, string> = {
            'Alimentação': '#f43f5e', 'Aluguel': '#8b5cf6', 'Combustível': '#f59e0b',
            'Transporte': '#f59e0b', 'Comissões': '#10b981', 'Educação': '#3b82f6',
            'Energia Elétrica': '#fbbf24', 'Embalagens': '#6366f1', 'Frete': '#06b6d4',
            'Impostos': '#ef4444', 'Manutenção': '#ec4899', 'Marketing': '#d946ef',
            'Publicidade': '#d946ef', 'Materiais': '#94a3b8', 'Água/Esgoto': '#0ea5e9',
            'Saneamento': '#0ea5e9', 'Salários': '#22c55e', 'Encargos': '#22c55e',
            'Internet': '#a855f7', 'Telefone': '#a855f7', 'Viagens': '#fb923c',
            'Estoque': '#2563eb', 'Geral': '#64748b', 'Outros': '#475569'
        };

        const chartData = Object.entries(expenseByCategory).map(([cat, val]) => ({
            category: cat,
            value: val,
            color: CATEGORY_COLORS[cat] || '#94a3b8'
        }));

        return { totalCash, totalReceivable, totalPayable, income, expense, chartData };
    }, [transactions, sales, purchases, receipts]);

    const receivablesList = useMemo(() => {
        const salesMapped = sales
            .filter(s => s.status !== 'Cancelada' && s.totalValue > 0)
            .map(s => {
                const customer = customers.find(c => c.id === s.customerId);
                return {
                    id: s.id,
                    entityName: customer?.name || 'Cliente Desconhecido',
                    docNumber: s.saleNumber,
                    date: s.date,
                    dueDate: s.dueDate,
                    total: s.totalValue,
                    paid: s.amountPaid,
                    remaining: s.totalValue - s.amountPaid,
                    status: s.isPaid ? 'Liquidado' : (new Date(s.dueDate) < new Date() ? 'Atrasado' : 'A Vencer'),
                    type: 'sale',
                    paymentHistory: s.paymentHistory || [],
                    items: s.items || [] // Fixed to use 'items' as per Sale interface
                };
            });

        const receiptsList = receipts
            .filter(r => r.totalValue > 0)
            .map(r => {
                const customer = customers.find(c => c.id === r.customerId);
                return {
                    id: r.id,
                    entityName: customer?.name || r.itemDescription || 'Cliente Desconhecido',
                    docNumber: r.receiptNumber,
                    date: r.date,
                    dueDate: r.dueDate,
                    total: r.totalValue,
                    paid: r.amountPaid || 0,
                    remaining: r.totalValue - (r.amountPaid || 0),
                    status: r.isPaid ? 'Liquidado' : (new Date(r.dueDate) < new Date() ? 'Atrasado' : 'A Vencer'),
                    type: 'receipt',
                    paymentHistory: r.paymentHistory || [],
                    items: (r.items && r.items.length > 0) ? r.items : (r.expenseItems || [])
                };
            });

        return [...salesMapped, ...receiptsList].sort((a, b) => b.remaining - a.remaining);
    }, [sales, receipts, customers]);

    const payablesList = useMemo(() => {
        return purchases
            .filter(p => p.accounted !== false && p.totalValue > 0)
            .map(p => {
                const supplier = suppliers.find(s => s.id === p.supplierId);
                return {
                    id: p.id,
                    entityName: supplier?.name || p.itemDescription || 'Fornecedor Desconhecido',
                    docNumber: p.purchaseNumber,
                    date: p.date,
                    dueDate: p.dueDate,
                    total: p.totalValue,
                    paid: p.amountPaid || 0,
                    remaining: p.totalValue - (p.amountPaid || 0),
                    type: p.type === 'inventory' ? 'Estoque' : 'Despesa',
                    isPaid: p.isPaid,
                    status: p.isPaid ? 'Pago' : (new Date(p.dueDate) < new Date() ? 'Atrasado' : 'Pendente'),
                    paymentHistory: p.paymentHistory || [],
                    items: (p.items && p.items.length > 0) ? p.items : (p.expenseItems || []),
                    rawPurchase: p
                };
            })
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [purchases, suppliers]);

    const filteredPayables = useMemo(() => {
        let list = payablesList;
        if (searchTerm) {
            list = list.filter(item =>
                item.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.docNumber.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (filterStatus === 'pending') list = list.filter(i => !i.isPaid);
        if (filterStatus === 'paid') list = list.filter(i => i.isPaid);
        return list;
    }, [payablesList, searchTerm, filterStatus]);

    const filteredReceivables = useMemo(() => {
        let list = receivablesList;
        if (searchTerm) {
            list = list.filter(item =>
                item.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.docNumber.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (filterStatus === 'pending') list = list.filter(i => i.status !== 'Liquidado');
        if (filterStatus === 'paid') list = list.filter(i => i.status === 'Liquidado');
        return list;
    }, [receivablesList, searchTerm, filterStatus]);

    // Modals for Bank Accounts
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
    const [adjustingAccount, setAdjustingAccount] = useState<BankAccount | null>(null);

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20 px-2">
            {/* MODAL DE TRANSAÇÃO FINANCEIRA */}
            {selectedTransaction && (
                <FinancialTransactionModal
                    data={selectedTransaction}
                    onClose={() => setSelectedTransaction(null)}
                    onConfirm={(amount, date) => {
                        if (selectedTransaction.type === 'receivable') {
                            if (selectedTransaction.docNumber?.startsWith('REC')) {
                                onReceiveReceipt(selectedTransaction.id, amount, date);
                            } else {
                                onReceiveSale(selectedTransaction.id, amount, date);
                            }
                        } else {
                            onPayPurchase(selectedTransaction.id, amount, date);
                        }
                        setSelectedTransaction(null);
                    }}
                    onDeletePayment={(paymentId) => {
                        if (selectedTransaction.type === 'receivable') onDeletePaymentFromSale(selectedTransaction.id, paymentId);
                        else onDeletePaymentFromPurchase(selectedTransaction.id, paymentId);
                        setSelectedTransaction(null);
                    }}
                    onUpdatePayment={(paymentId, amount, date) => {
                        if (selectedTransaction.type === 'receivable') onUpdatePaymentInSale(selectedTransaction.id, paymentId, amount, date);
                        else onUpdatePaymentInPurchase(selectedTransaction.id, paymentId, amount, date);
                        setSelectedTransaction(null);
                    }}
                    onUpdatePurchase={onUpdatePurchase}
                    onDeletePurchase={onDeletePurchase}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black uppercase dark:text-white tracking-tight">Painel Financeiro</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle de Fluxo e Balanço</p>
                </div>
                {tab === 'accounts' && (
                    <button
                        onClick={() => { setEditingAccount(null); setIsAccountModalOpen(true); }}
                        className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus size={16} weight="bold" /> Nova Conta
                    </button>
                )}
            </div>

            {/* TABS DE NAVEGAÇÃO */}
            <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-[2rem] shadow-sm border dark:border-slate-800 overflow-x-auto">
                <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} label="Visão Geral" icon={<TrendingUp size={16} />} />
                <TabButton active={tab === 'accounts'} onClick={() => setTab('accounts')} label="Contas" icon={<Bank size={16} />} color="text-emerald-600" />
                <TabButton active={tab === 'receivables'} onClick={() => setTab('receivables')} label="A Receber" icon={<ArrowUpRight size={16} />} color="text-blue-600" />
                <TabButton active={tab === 'payables'} onClick={() => setTab('payables')} label="A Pagar" icon={<ArrowDownLeft size={16} />} color="text-rose-600" />
                <TabButton active={tab === 'history'} onClick={() => setTab('history')} label="Extrato Caixa" icon={<FileText size={16} />} />
            </div>

            {/* CONTEÚDO DAS TABS */}
            {tab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                    <SummaryCard title="Saldo em Caixa" value={summary.totalCash} icon={<DollarSign size={24} weight="fill" />} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" />
                    <SummaryCard title="Contas a Receber" value={summary.totalReceivable} icon={<TrendingUp size={24} weight="fill" />} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" />
                    <SummaryCard title="Contas a Pagar" value={summary.totalPayable} icon={<TrendingDown size={24} weight="fill" />} color="text-rose-600" bg="bg-rose-50 dark:bg-rose-900/20" />

                    <div className="md:col-span-3 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                <ChartPie size={18} weight="duotone" /> Projeção de Balanço
                            </h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black uppercase text-slate-400">Distribuição Financeira</span>
                                <span className="text-sm font-black dark:text-white">R$ {formatMoney(summary.totalReceivable + summary.totalPayable)}</span>
                            </div>
                            <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden">
                                <div className={`bg-blue-500 transition-all w-[${Math.round((summary.totalReceivable / (summary.totalReceivable + summary.totalPayable || 1)) * 100)}%]`}></div>
                                <div className={`bg-rose-500 transition-all w-[${Math.round((summary.totalPayable / (summary.totalReceivable + summary.totalPayable || 1)) * 100)}%]`}></div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                                    <span className="text-[9px] font-black uppercase text-slate-400">Recebíveis ({Math.round((summary.totalReceivable / (summary.totalReceivable + summary.totalPayable || 1)) * 100)}%)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-rose-500 rounded-sm"></div>
                                    <span className="text-[9px] font-black uppercase text-slate-400">Pendentes ({Math.round((summary.totalPayable / (summary.totalReceivable + summary.totalPayable || 1)) * 100)}%)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'accounts' && (
                <div className="space-y-6 animate-slideUp">
                    {/* Botões de Ação de Conta */}
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        <button
                            onClick={() => setIsTransferModalOpen(true)}
                            className="flex-shrink-0 px-6 py-4 bg-emerald-600 text-white rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                        >
                            <ArrowsLeftRight size={18} weight="bold" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Transferir Valores</span>
                        </button>
                    </div>

                    {/* Grade de Contas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Card do Saldo em Caixa (Padrão) */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border-2 border-emerald-100 dark:border-emerald-900/30 relative overflow-hidden group shadow-sm">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                                <Wallet size={80} weight="fill" />
                            </div>
                            <div className="relative">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Conta Principal</p>
                                <h4 className="text-lg font-black dark:text-white uppercase mb-4">Saldo em Caixa</h4>
                                <p className="text-3xl font-black text-emerald-600 mb-6">R$ {formatMoney(summary.totalCash)}</p>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg text-[8px] font-black uppercase">Sistema</span>
                                </div>
                            </div>
                        </div>

                        {/* Cards das Outras Contas */}
                        {bankAccounts.map(account => (
                            <div key={account.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 relative overflow-hidden group shadow-sm transition-all hover:border-blue-200 dark:hover:border-blue-900/30">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                                    <Bank size={80} weight="fill" />
                                </div>
                                <div className="relative">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Conta Bancária</p>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingAccount(account); setIsAccountModalOpen(true); }} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 rounded-lg transition-colors" title="Editar"><Pencil size={14} weight="bold" /></button>
                                            <button onClick={() => { if (confirm('Excluir esta conta?')) onDeleteAccount(account.id); }} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-500 rounded-lg transition-colors" title="Excluir"><Trash size={14} weight="bold" /></button>
                                        </div>
                                    </div>
                                    <h4 className="text-lg font-black dark:text-white uppercase mb-4">{account.name}</h4>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white mb-6">R$ {formatMoney(account.balance)}</p>
                                    <button
                                        onClick={() => { setAdjustingAccount(account); setIsAdjustModalOpen(true); }}
                                        className="text-[9px] font-black uppercase text-blue-600 flex items-center gap-1 hover:gap-2 transition-all"
                                    >
                                        <Scales size={14} /> Ajustar Saldo
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {bankAccounts.length === 0 && (
                        <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/20 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <Bank size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-sm font-black uppercase text-slate-300">Nenhuma conta bancária cadastrada.</p>
                            <button
                                onClick={() => { setEditingAccount(null); setIsAccountModalOpen(true); }}
                                className="mt-4 text-[10px] font-black uppercase text-blue-600 hover:underline"
                            >
                                Criar primeira conta
                            </button>
                        </div>
                    )}
                </div>
            )}

            {tab === 'receivables' && (
                <div className="space-y-4 animate-slideUp">
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/30 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20"><TrendUp size={24} weight="bold" /></div>
                            <div>
                                <h4 className="text-sm font-black uppercase text-blue-800 dark:text-blue-300">Carteira de Cobrança</h4>
                                <p className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400 uppercase tracking-widest">Acompanhamento de Amortizações de Vendas</p>
                            </div>
                        </div>
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-black uppercase text-blue-400 opacity-60">Total em Aberto</p>
                            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">R$ {formatMoney(summary.totalReceivable)}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {Object.entries(
                            filteredReceivables.reduce((acc, item) => {
                                if (!acc[item.entityName]) acc[item.entityName] = [];
                                acc[item.entityName].push(item);
                                return acc;
                            }, {} as Record<string, typeof filteredReceivables>)
                        ).map(([name, items]) => {
                            const isGroupExpanded = expandedItem === `group-rec-${name}`;
                            const groupTotal = items.reduce((acc, i) => acc + i.remaining, 0);
                            return (
                                <div key={name} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <button
                                        onClick={() => setExpandedItem(isGroupExpanded ? null : `group-rec-${name}`)}
                                        className="w-full p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs">
                                                {items.length}
                                            </div>
                                            <div className="text-left">
                                                <h5 className="text-[11px] font-black uppercase dark:text-white">{name}</h5>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">{items.length} registro(s)</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-blue-600">R$ {formatMoney(groupTotal)}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase">Pendente</p>
                                            </div>
                                            <div className={`transition-transform duration-300 ${isGroupExpanded ? 'rotate-180' : ''}`}>
                                                <CaretDown size={20} />
                                            </div>
                                        </div>
                                    </button>

                                    {isGroupExpanded && (
                                        <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                                            {items.map((item) => {
                                                const progress = (item.paid / item.total) * 100;
                                                return (
                                                    <div key={item.id} className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-[2rem] border dark:border-slate-800 flex flex-col">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">PED: {item.docNumber}</p>
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase ${item.status === 'Atrasado' ? 'bg-rose-100 text-rose-600' : (item.status === 'Liquidado' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600')}`}>
                                                                {item.status}
                                                            </span>
                                                        </div>

                                                        <div className="space-y-1 mb-4">
                                                            <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                <div className={`h-full bg-blue-500 w-[${Math.round(progress)}%]`}></div>
                                                            </div>
                                                            <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase flex justify-between mt-1 items-center">
                                                                <span>Liquidado: <span className="text-emerald-600 font-extrabold text-[11px] sm:text-[13px] bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded ml-1">R$ {formatMoney(item.paid)}</span></span>
                                                                <span className="flex items-center gap-1">
                                                                    <span className="text-[10px] text-slate-400">Pendente: R$ 0,00</span>
                                                                    <span>{Math.round(progress)}%</span>
                                                                </span>
                                                            </p>
                                                        </div>

                                                        <div className="flex justify-between items-end mb-4 text-xs sm:text-sm">
                                                            <div>
                                                                <p className="text-slate-500 uppercase font-bold text-[10px] sm:text-xs">Vencimento</p>
                                                                <p className="font-black dark:text-white mt-0.5">{formatDate(item.dueDate)}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-slate-500 uppercase font-bold text-[10px] sm:text-xs">Restante</p>
                                                                <p className={`font-black text-sm sm:text-base mt-0.5 ${item.remaining === 0 ? 'text-emerald-500' : 'text-blue-600'}`}>
                                                                    R$ {formatMoney(item.remaining)}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => setSelectedTransaction({
                                                                id: item.id,
                                                                type: 'receivable',
                                                                docNumber: item.docNumber,
                                                                entityName: item.entityName,
                                                                total: item.total,
                                                                remaining: item.remaining,
                                                                paymentHistory: item.paymentHistory,
                                                                items: item.items
                                                            })}
                                                            className="w-full py-3 sm:py-2.5 bg-blue-600 text-white rounded-xl text-[10px] sm:text-[11px] font-black uppercase shadow-lg shadow-blue-600/20 active:scale-95 transition-all mt-2"
                                                        >
                                                            Detalhes / Receber
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredReceivables.length === 0 && <p className="text-center py-10 text-[10px] font-black uppercase text-slate-400">Nenhum recebível encontrado.</p>}
                    </div>
                </div>
            )}

            {/* BUSCA E FILTROS */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <MagnifyingGlass size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, fornecedor ou documento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold outline-none focus:border-blue-500 transition-all dark:text-white shadow-sm"
                    />
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl self-start">
                    <button onClick={() => setFilterStatus('pending')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filterStatus === 'pending' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-400'}`}>Pendentes</button>
                    <button onClick={() => setFilterStatus('paid')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filterStatus === 'paid' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-400'}`}>Liquidadas</button>
                    <button onClick={() => setFilterStatus('all')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filterStatus === 'all' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-400'}`}>Todas</button>
                </div>
            </div>

            {tab === 'payables' && (
                <div className="space-y-6 animate-slideUp">
                    {Object.entries(
                        filteredPayables.reduce((acc, item) => {
                            if (!acc[item.entityName]) acc[item.entityName] = [];
                            acc[item.entityName].push(item);
                            return acc;
                        }, {} as Record<string, typeof filteredPayables>)
                    ).map(([name, items]) => {
                        const isGroupExpanded = expandedItem === `group-pay-${name}`;
                        const groupTotal = items.reduce((acc, i) => acc + i.remaining, 0);
                        return (
                            <div key={name} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setExpandedItem(isGroupExpanded ? null : `group-pay-${name}`)}
                                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-xl flex items-center justify-center font-black text-xs">
                                            {items.length}
                                        </div>
                                        <div className="text-left">
                                            <h5 className="text-[11px] font-black uppercase dark:text-white">{name}</h5>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{items.length} registro(s)</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-rose-600">R$ {formatMoney(groupTotal)}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">A Vencer</p>
                                        </div>
                                        <div className={`transition-transform duration-300 ${isGroupExpanded ? 'rotate-180' : ''}`}>
                                            <CaretDown size={20} />
                                        </div>
                                    </div>
                                </button>

                                {isGroupExpanded && (
                                    <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                                        {items.map((item) => {
                                            const progress = item.total > 0 ? Math.min(100, Math.max(0, (item.paid / item.total) * 100)) : 0;
                                            return (
                                                <div key={item.id} className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-[2rem] border dark:border-slate-800 flex flex-col">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded-full text-[9px] sm:text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">
                                                            {item.type === 'Estoque' ? <Truck size={12} /> : <ShoppingBag size={12} />} {item.type}
                                                        </div>
                                                        <span className={`px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase ${item.status === 'Atrasado' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                            {item.status}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1 mb-4">
                                                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div className={`h-full bg-rose-500 w-[${Math.round(progress)}%]`}></div>
                                                        </div>
                                                        <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase flex justify-between mt-1 items-center">
                                                            <span>Pago: <span className="text-emerald-600 font-extrabold text-[11px] sm:text-[13px] bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded ml-1">R$ {formatMoney(item.paid)}</span></span>
                                                            <span className="flex items-center gap-1">
                                                                {item.remaining === 0 && <span className="text-[10px] text-slate-400 mr-2">Pendente: R$ 0,00</span>}
                                                                <span>{Math.round(progress)}%</span>
                                                            </span>
                                                        </p>
                                                    </div>

                                                    <div className="flex justify-between items-end mb-4 text-xs sm:text-sm">
                                                        <div>
                                                            <p className="text-slate-500 uppercase font-bold text-[10px] sm:text-xs">Vencimento</p>
                                                            <p className={`font-black mt-0.5 ${new Date(item.dueDate) < new Date() && item.remaining > 0 ? 'text-rose-600' : 'dark:text-white'}`}>{formatDate(item.dueDate)}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-slate-500 uppercase font-bold text-[10px] sm:text-xs">Restante</p>
                                                            <p className={`font-black text-sm sm:text-base mt-0.5 ${item.remaining === 0 ? 'text-emerald-500' : 'text-rose-600'}`}>R$ {formatMoney(item.remaining)}</p>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => setSelectedTransaction({
                                                            id: item.id,
                                                            type: 'payable',
                                                            docNumber: item.docNumber,
                                                            entityName: item.entityName,
                                                            total: item.total,
                                                            remaining: item.remaining,
                                                            paymentHistory: item.paymentHistory,
                                                            items: item.items,
                                                            rawPurchase: item.rawPurchase
                                                        })}
                                                        className="w-full py-3 sm:py-2.5 bg-rose-600 text-white rounded-xl text-[10px] sm:text-[11px] font-black uppercase shadow-lg shadow-rose-600/20 active:scale-95 transition-all mt-2"
                                                    >
                                                        Detalhes / Pagar
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>

                                )}
                            </div>
                        );
                    })}
                    {filteredPayables.length === 0 && <p className="text-center py-10 text-[10px] font-black uppercase text-slate-400">Nenhuma conta encontrada.</p>}
                </div>
            )}

            {tab === 'history' && (
                <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2.5rem] shadow-sm overflow-hidden animate-slideUp">
                    <div className="p-6 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest">Extrato de Movimentações</h4>
                    </div>
                    <div className="divide-y dark:divide-slate-800 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {[...transactions].reverse().map((t) => (
                            <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${t.amount > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                        {t.amount > 0 ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase dark:text-white">{t.description}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">{formatDate(t.date)}</p>
                                    </div>
                                </div>
                                <p className={`text-sm font-black ${t.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {t.amount > 0 ? '+' : ''} R$ {formatMoney(t.amount)}
                                </p>
                            </div>
                        ))}
                        {transactions.length === 0 && <p className="text-center py-10 text-[10px] font-black uppercase text-slate-400">Nenhuma transação registrada.</p>}
                    </div>
                </div>
            )}
            {isAccountModalOpen && (
                <AccountModal
                    account={editingAccount}
                    onClose={() => setIsAccountModalOpen(false)}
                    onSave={(name: string, balance: number) => {
                        if (editingAccount) onUpdateAccount(editingAccount.id, { name });
                        else onAddAccount(name, balance);
                        setIsAccountModalOpen(false);
                    }}
                />
            )}

            {isTransferModalOpen && (
                <TransferModal
                    accounts={bankAccounts}
                    cashBalance={summary.totalCash}
                    onClose={() => setIsTransferModalOpen(false)}
                    onConfirm={(transfer: any) => {
                        onTransfer(transfer);
                        setIsTransferModalOpen(false);
                    }}
                />
            )}

            {isAdjustModalOpen && adjustingAccount && (
                <AdjustBalanceModal
                    account={adjustingAccount}
                    onClose={() => setIsAdjustModalOpen(false)}
                    onConfirm={(newBalance: number) => {
                        onAdjustBalance(adjustingAccount.id, newBalance);
                        setIsAdjustModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

const SummaryCard = ({ title, value, icon, color, bg }: any) => (
    <div className={`${bg} p-6 rounded-[2.5rem] shadow-sm flex items-center gap-4 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all group`}>
        <div className={`p-4 rounded-2xl bg-white dark:bg-slate-900 shadow-sm ${color} group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{title}</p>
            <h3 className={`text-2xl font-black ${color.includes('emerald') ? 'dark:text-emerald-400' : color.includes('blue') ? 'dark:text-blue-400' : 'dark:text-rose-400'}`}>
                R$ {formatMoney(value)}
            </h3>
        </div>
    </div>
);

const TabButton = ({ active, onClick, label, icon, badge, color }: any) => (
    <button
        onClick={onClick}
        className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-4 rounded-[1.5rem] transition-all relative ${active ? 'bg-slate-900 text-white shadow-lg scale-105 z-10' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
    >
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
);

const AccountModal = ({ account, onClose, onSave }: any) => {
    const [name, setName] = useState(account?.name || '');
    const [balance, setBalance] = useState(String(account?.balance || 0));

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border-2 border-slate-100 dark:border-slate-800 p-8 animate-slideUp">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xl font-black uppercase dark:text-white">{account ? 'Editar Conta' : 'Nova Conta'}</h4>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" title="Fechar"><X size={20} weight="bold" /></button>
                </div>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nome da Conta / Banco</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Banco Inter, Nubank, Cofre" className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 text-xs font-bold outline-none transition-all dark:text-white" />
                    </div>
                    {!account && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Saldo Inicial</label>
                            <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0,00" className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 text-xs font-bold outline-none transition-all dark:text-white" />
                        </div>
                    )}
                    <button onClick={() => { if (!name) return alert('Nome é obrigatório'); onSave(name, sanitizeNum(balance)); }} className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all mt-4">
                        {account ? 'Salvar Alterações' : 'Criar Conta'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const TransferModal = ({ accounts, cashBalance, onClose, onConfirm }: any) => {
    const [from, setFrom] = useState<'cash' | string>('cash');
    const [to, setTo] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [desc, setDesc] = useState('');

    const handleSubmit = () => {
        const val = sanitizeNum(amount);
        if (val <= 0) return alert('Valor deve ser maior que zero');
        if (!to || from === to) return alert('Selecione contas diferentes');

        onConfirm({
            date,
            fromAccountId: from === 'cash' ? undefined : from,
            toAccountId: to === 'cash' ? undefined : to,
            amount: val,
            description: desc || 'Transferência entre contas'
        });
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border-2 border-slate-100 dark:border-slate-800 p-8 animate-slideUp">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xl font-black uppercase dark:text-white">Transferência de Valores</h4>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" title="Fechar"><X size={20} weight="bold" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 text-rose-500">Origem (Sairá de:)</label>
                        <select value={from} onChange={e => setFrom(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-rose-500 rounded-2xl px-4 py-3 text-xs font-bold outline-none transition-all dark:text-white" title="Conta de Origem">
                            <option value="cash">Saldo em Caixa (R$ {formatMoney(cashBalance)})</option>
                            {accounts.filter((a: any) => a.id !== 'estoque-virtual').map((a: any) => <option key={a.id} value={a.id}>{a.name} (R$ {formatMoney(a.balance)})</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 text-emerald-500">Destino (Irá para:)</label>
                        <select value={to} onChange={e => setTo(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl px-4 py-3 text-xs font-bold outline-none transition-all dark:text-white" title="Conta de Destino">
                            <option value="">Selecione o Destino...</option>
                            <option value="cash">Saldo em Caixa</option>
                            {accounts.filter((a: any) => a.id !== 'estoque-virtual').map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 text-blue-500">Valor R$</label>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 text-sm font-black outline-none transition-all dark:text-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Data</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-2.5 text-[11px] font-black outline-none transition-all dark:text-white" title="Data da Transferência" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Descrição Opcional</label>
                        <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Reposição de Caixa, Saque Banco..." className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl px-4 py-3 text-xs font-bold outline-none transition-all dark:text-white" />
                    </div>
                    <button onClick={handleSubmit} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-blue-600/20 active:scale-95 transition-all mt-4 flex items-center justify-center gap-2">
                        <ArrowsLeftRight size={18} /> Confirmar Transferência
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdjustBalanceModal = ({ account, onClose, onConfirm }: any) => {
    const [balance, setBalance] = useState(String(account.balance));

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl border-2 border-slate-100 dark:border-slate-800 p-8 animate-slideUp">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xl font-black uppercase dark:text-white flex items-center gap-2"><Scales size={24} /> Balanço</h4>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" title="Fechar"><X size={20} weight="bold" /></button>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl mb-6">
                    <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">{account.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Informe o saldo real atual desta conta para ajustar o sistema.</p>
                </div>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Saldo Final Real</label>
                        <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0,00" className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-3xl px-6 py-4 text-xl font-black outline-none transition-all dark:text-white text-center" />
                    </div>
                    <button onClick={() => onConfirm(sanitizeNum(balance))} className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all mt-4">
                        Confirmar Ajuste
                    </button>
                </div>
            </div>
        </div>
    );
};

const FinancialTransactionModal = ({
    data, onClose, onConfirm,
    onDeletePayment, onUpdatePayment, onUpdatePurchase, onDeletePurchase
}: {
    data: any, onClose: () => void, onConfirm: (amount: number, date: string) => void,
    onDeletePayment: (paymentId: string) => void,
    onUpdatePayment: (paymentId: string, amount: number, date: string) => void,
    onUpdatePurchase: (purchase: Purchase) => void,
    onDeletePurchase?: (purchaseId: string) => void
}) => {
    const [amount, setAmount] = useState(String(data.remaining));
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [editingPayment, setEditingPayment] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');
    const [isEditingItems, setIsEditingItems] = useState(false);
    const [editItems, setEditItems] = useState<any[]>(data.items || []);
    const [newItem, setNewItem] = useState({ description: '', value: '' });

    const handleConfirm = () => {
        const val = sanitizeNum(amount);
        if (val < 0 || val > data.remaining) return alert("Valor inválido. Deve ser maior ou igual a zero e menor ou igual ao restante.");
        onConfirm(val, date);
    };

    const handleSaveItems = () => {
        const total = editItems.reduce((acc, i) => acc + (i.value || 0), 0);
        onUpdatePurchase({
            ...data.rawPurchase, // We need the original purchase object
            expenseItems: editItems,
            totalValue: total
        });
        setIsEditingItems(false);
    };

    const addLocalItem = () => {
        if (!newItem.description) return alert("Descrição vazia");
        const val = sanitizeNum(newItem.value);
        if (val <= 0) return alert("Valor inválido");
        setEditItems([...editItems, { id: generateId(), description: newItem.description, value: val }]);
        setNewItem({ description: '', value: '' });
    };

    const startEdit = (p: any) => {
        setEditingPayment(p.id);
        setEditAmount(String(p.amount));
        setEditDate(p.date);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col animate-slideUp border-2 border-slate-100 dark:border-slate-800 overflow-hidden max-h-[90vh]">
                <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <div>
                        <h4 className="text-sm font-black uppercase dark:text-white leading-tight flex items-center gap-2">
                            {data.type === 'receivable' ? <TrendUp weight="bold" /> : <TrendDown weight="bold" />}
                            Gestão de Amortização
                        </h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{data.entityName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {data.type === 'payable' && !isEditingItems && (
                            <>
                                <button onClick={() => setIsEditingItems(true)} className="p-2 hover:bg-blue-100 text-blue-600 rounded-full transition-colors" title="Editar Itens"><Pencil size={18} /></button>
                                {onDeletePurchase && (
                                    <button onClick={() => { if (confirm('Excluir esta despesa permanentemente?')) { onDeletePurchase(data.id); onClose(); } }} className="p-2 hover:bg-rose-100 text-rose-600 rounded-full transition-colors" title="Excluir Registro"><Trash size={18} /></button>
                                )}
                            </>
                        )}
                        <button onClick={onClose} aria-label="Fechar" title="Fechar" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20} weight="bold" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
                    {/* INFO PRINCIPAL */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`p-4 rounded-3xl border-2 ${data.type === 'receivable' ? 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' : 'bg-rose-50/50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/30'}`}>
                            <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Total do Título</p>
                            <p className="text-lg font-black dark:text-white">R$ {formatMoney(data.total)}</p>
                        </div>
                        <div className={`p-4 rounded-3xl border-2 ${data.type === 'receivable' ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-blue-900/30' : 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30'}`}>
                            <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Restante em Aberto</p>
                            <p className={`text-lg font-black ${data.type === 'receivable' ? 'text-blue-600' : 'text-rose-600'}`}>R$ {formatMoney(data.remaining)}</p>
                        </div>
                    </div>

                    {/* ITENS DA DÍVIDA */}
                    <div className="space-y-3">
                        <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center justify-between">
                            <span className="flex items-center gap-2"><Package size={14} weight="bold" /> Itens da Transação</span>
                            {isEditingItems && <span className="text-blue-500 text-[8px] animate-pulse">MODO EDIÇÃO</span>}
                        </h5>
                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-4 border dark:border-slate-800 space-y-2">
                            {isEditingItems ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        {editItems.map((item, idx) => (
                                            <div key={item.id || idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-700 flex items-center justify-between gap-2 shadow-sm">
                                                <div className="flex-1 min-w-0">
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={(e) => {
                                                            const up = [...editItems];
                                                            up[idx].description = e.target.value;
                                                            setEditItems(up);
                                                        }}
                                                        placeholder="Descrição do item"
                                                        title="Editar descrição do item"
                                                        className="w-full bg-transparent text-[10px] font-black uppercase outline-none focus:text-blue-600"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={item.value}
                                                        onChange={(e) => {
                                                            const up = [...editItems];
                                                            up[idx].value = sanitizeNum(e.target.value);
                                                            setEditItems(up);
                                                        }}
                                                        placeholder="0,00"
                                                        title="Editar valor do item"
                                                        className="w-full bg-transparent text-[9px] font-bold text-slate-400 outline-none"
                                                    />
                                                </div>
                                                <button onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))} title="Remover item" className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-900/30 space-y-2">
                                        <input type="text" placeholder="DESCRIÇÃO" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} className="w-full bg-white dark:bg-slate-800 px-3 py-2 rounded-lg text-[9px] font-black uppercase border dark:border-slate-700 outline-none" />
                                        <div className="flex gap-2">
                                            <input type="number" placeholder="VALOR R$" title="Adicionar valor do item" value={newItem.value} onChange={e => setNewItem({ ...newItem, value: e.target.value })} className="flex-1 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg text-[9px] font-black border dark:border-slate-700 outline-none" />
                                            <button onClick={addLocalItem} title="Adicionar item" className="px-4 bg-blue-600 text-white rounded-lg text-[10px] font-black flex items-center justify-center"><Plus size={14} /></button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setIsEditingItems(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-[9px] font-black uppercase">Cancelar</button>
                                        <button onClick={handleSaveItems} className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-emerald-600/20">Salvar Alterações</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {data.items && data.items.length > 0 ? (
                                        data.items.map((it: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-[10px] font-bold border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0 last:pb-0">
                                                <div className="flex flex-col">
                                                    <span className="uppercase dark:text-white truncate max-w-[200px]">{it.description || 'Item'}</span>
                                                    <span className="text-[8px] text-slate-400 uppercase">{it.quantity || 1} {it.unit || 'un'} x R$ {formatMoney(it.costPrice || it.priceAtSale || it.unitPrice || it.value || 0)}</span>
                                                </div>
                                                <span className="font-black dark:text-slate-300">R$ {formatMoney((it.quantity || 1) * (it.costPrice || it.priceAtSale || it.unitPrice || it.value || 0))}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[9px] text-slate-400 text-center italic py-2">Nenhum item detalhado encontrado.</p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* FORMULÁRIO DE NOVA BAIXA */}
                    {data.remaining > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border dark:border-slate-800 space-y-4">
                            <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                <Plus size={14} weight="bold" /> Registrar Nova Amortização
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Valor</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">R$</span>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            aria-label="Valor da amortização"
                                            title="Informe o valor decorrente"
                                            placeholder="0,00"
                                            className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-3 text-xs font-black outline-none focus:border-blue-500 transition-all dark:text-white shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Data</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        aria-label="Data da amortização"
                                        title="Informe a data do recebimento/pagamento"
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-[10px] font-black outline-none focus:border-blue-500 transition-all dark:text-white shadow-sm"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleConfirm}
                                aria-label="Confirmar amortização"
                                title="Lançar recebimento ou pagamento"
                                className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-white ${data.type === 'receivable' ? 'bg-blue-600 shadow-blue-600/30' : 'bg-rose-600 shadow-rose-600/30'}`}
                            >
                                <Check size={16} weight="bold" /> Confirmar Recebimento
                            </button>
                        </div>
                    )}

                    {/* HISTÓRICO DE PAGAMENTOS */}
                    <div className="space-y-4">
                        <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <ClockCounterClockwise size={16} weight="bold" /> Histórico de Amortizações
                        </h5>
                        <div className="space-y-2">
                            {data.paymentHistory.map((p: any) => (
                                <div key={p.id} className="group bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                                    {editingPayment === p.id ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="number"
                                                    value={editAmount}
                                                    onChange={e => setEditAmount(e.target.value)}
                                                    aria-label="Editar valor"
                                                    title="Valor da amortização"
                                                    placeholder="0,00"
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] font-black outline-none dark:text-white"
                                                />
                                                <input
                                                    type="date"
                                                    value={editDate}
                                                    onChange={e => setEditDate(e.target.value)}
                                                    aria-label="Editar data"
                                                    title="Data da amortização"
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] font-black outline-none dark:text-white"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingPayment(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[8px] font-black uppercase">Cancelar</button>
                                                <button
                                                    onClick={() => {
                                                        onUpdatePayment(p.id, sanitizeNum(editAmount), editDate);
                                                        setEditingPayment(null);
                                                    }}
                                                    className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-[8px] font-black uppercase"
                                                >
                                                    Salvar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${data.type === 'receivable' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    <Calendar size={14} weight="bold" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black dark:text-white">{formatDate(p.date)}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase">Amortização Registrada</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`text-xs font-black ${data.type === 'receivable' ? 'text-blue-600' : 'text-rose-600'}`}>R$ {formatMoney(p.amount)}</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEdit(p)} aria-label="Editar amortização" title="Editar este registro" className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 rounded-lg transition-colors"><Plus size={14} weight="bold" /></button>
                                                    <button onClick={() => onDeletePayment(p.id)} aria-label="Excluir amortização" title="Excluir este registro" className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-500 rounded-lg transition-colors"><X size={14} weight="bold" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {data.paymentHistory.length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                                    <ClockCounterClockwise size={32} className="mx-auto text-slate-200 mb-2" />
                                    <p className="text-[10px] font-black uppercase text-slate-300">Nenhum pagamento registrado ainda</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
