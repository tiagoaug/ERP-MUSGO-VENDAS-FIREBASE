import React, { useState, useMemo } from 'react';
import { FamilyMember, PersonalCategory, PersonalBudget, PersonalTransaction, Transaction, BankAccount } from '../types';
import { Plus, Users, Layout, Target, Wallet, ArrowUpRight, ArrowDownRight, CaretLeft, Check, Trash, PencilSimple, X, Calculator, ListDashes, CaretDown, CaretUp, Calendar, List, ChartPie, CheckCircle } from '@phosphor-icons/react';
import { formatMoney, formatDate } from '../lib/utils';
import { CalculatorModal } from '../components/CalculatorModal';
import { CategoryComparisonChart } from '../components/CategoryComparisonChart';

interface FinanceiroPessoalProps {
    familyMembers: FamilyMember[];
    categories: PersonalCategory[];
    budgets: PersonalBudget[];
    transactions: PersonalTransaction[];
    businessTransactions: Transaction[];
    actions: {
        addFamilyMember: (m: any) => Promise<void>;
        updateFamilyMember: (m: FamilyMember) => Promise<void>;
        deleteFamilyMember: (id: string) => Promise<void>;
        addCategory: (c: any) => Promise<void>;
        updateCategory: (c: PersonalCategory) => Promise<void>;
        deleteCategory: (id: string) => Promise<void>;
        addBudget: (b: any) => Promise<void>;
        updateBudget: (b: PersonalBudget) => Promise<void>;
        deleteBudget: (id: string) => Promise<void>;
        addPersonalTransaction: (t: any) => Promise<void>;
        updatePersonalTransaction: (t: PersonalTransaction) => Promise<void>;
        deletePersonalTransaction: (id: string) => Promise<void>;
    };
    bankAccounts: BankAccount[];
}

export const FinanceiroPessoalView: React.FC<FinanceiroPessoalProps> = ({
    familyMembers, categories, budgets, transactions, actions, bankAccounts
}) => {
    const [activeTab, setActiveTab] = useState<'resumo' | 'lancamentos' | 'orcamentos' | 'config'>('resumo');
    const [showForm, setShowForm] = useState<'transaction' | 'budget' | 'category' | 'member' | null>(null);
    const [showCalcFor, setShowCalcFor] = useState<'transaction' | 'budget' | null>(null);
    const [showCategoryCentral, setShowCategoryCentral] = useState<'transaction' | 'budget' | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Form states
    const [transactionForm, setTransactionForm] = useState<Partial<PersonalTransaction> & { isInstallment?: boolean; installmentsCount?: number }>({ type: 'expense', amount: 0, date: new Date().toISOString().split('T')[0], isPaid: true, description: '', isInstallment: false, installmentsCount: 2 });
    const [budgetForm, setBudgetForm] = useState<Partial<PersonalBudget>>({ amount: 0, month: new Date().toISOString().substring(0, 7) });
    const [categoryForm, setCategoryForm] = useState<Partial<PersonalCategory>>({ type: 'expense', name: '' });
    const [memberForm, setMemberForm] = useState<Partial<FamilyMember>>({ name: '' });
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

    // Period Filters
    type PeriodType = 'month' | 'quarter' | 'semester' | 'year' | 'all' | 'custom';
    const [period, setPeriod] = useState<PeriodType>('month');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10)
    });

    const [compPeriod, setCompPeriod] = useState<PeriodType>('month');
    const [compDateRange, setCompDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10),
        end: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10)
    });

    const [provisoesMonths, setProvisoesMonths] = useState(4);
    const [provisoesStartMonth, setProvisoesStartMonth] = useState(() => new Date().toISOString().substring(0, 7));

    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

    const handlePeriodChange = (p: PeriodType, isComparison: boolean = false) => {
        const now = new Date();
        const setDates = (pType: PeriodType, targetDate: Date) => {
            let s = new Date();
            let e = new Date();
            if (pType === 'month') {
                s = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
                e = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
            } else if (pType === 'quarter') {
                const q = Math.floor(targetDate.getMonth() / 3);
                s = new Date(targetDate.getFullYear(), q * 3, 1);
                e = new Date(targetDate.getFullYear(), (q + 1) * 3, 0);
            } else if (pType === 'semester') {
                const sem = Math.floor(targetDate.getMonth() / 6);
                s = new Date(targetDate.getFullYear(), sem * 6, 1);
                e = new Date(targetDate.getFullYear(), (sem + 1) * 6, 0);
            } else if (pType === 'year') {
                s = new Date(targetDate.getFullYear(), 0, 1);
                e = new Date(targetDate.getFullYear(), 11, 31);
            } else if (pType === 'all') {
                s = new Date(2000, 0, 1);
                e = new Date(2100, 11, 31);
            }
            return { s, e };
        }

        if (isComparison) {
            setCompPeriod(p);
            if (p !== 'custom') {
                let targetDate = new Date();
                if (p === 'month') targetDate.setMonth(now.getMonth() - 1);
                if (p === 'quarter') targetDate.setMonth(now.getMonth() - 3);
                if (p === 'semester') targetDate.setMonth(now.getMonth() - 6);
                if (p === 'year') targetDate.setFullYear(now.getFullYear() - 1);
                const { s, e } = setDates(p, targetDate);
                setCompDateRange({ start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) });
            }
        } else {
            setPeriod(p);
            if (p !== 'custom') {
                const { s, e } = setDates(p, now);
                setDateRange({ start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) });
                handlePeriodChange(p, true);
            }
        }
    };

    // Derived values
    const filteredTransactions = transactions.filter(t => {
        const d = (t.date || '').split('T')[0];
        return d >= dateRange.start && d <= dateRange.end;
    });
    const compTransactions = transactions.filter(t => {
        const d = (t.date || '').split('T')[0];
        return d >= compDateRange.start && d <= compDateRange.end;
    });

    const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalIncomePaid = filteredTransactions.filter(t => t.type === 'income' && t.isPaid).reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const totalExpensePaid = filteredTransactions.filter(t => t.type === 'expense' && t.isPaid).reduce((acc, t) => acc + t.amount, 0);
    const totalReserve = filteredTransactions.filter(t => t.type === 'reserve' && t.isPaid).reduce((acc, t) => acc + t.amount, 0);
    const totalPlanning = filteredTransactions.filter(t => t.type === 'planning' && t.isPaid).reduce((acc, t) => acc + t.amount, 0);

    const totalOutgoings = totalExpense + totalReserve + totalPlanning;
    const balanceProjected = totalIncome - totalExpense - totalReserve - totalPlanning;
    const balanceActual = totalIncomePaid - totalExpensePaid - totalReserve - totalPlanning;
    const balance = balanceActual; // Main balance is the actual cleared amount

    const getChartColor = (index: number) => {
        const colors = ['#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];
        return colors[index % colors.length];
    };

    const categoryData = categories.filter(c => c.type === 'expense').map((cat, index) => {
        const currentAmount = filteredTransactions.filter(t => t.categoryId === cat.id && t.type === 'expense' && t.isPaid).reduce((sum, t) => sum + t.amount, 0);
        const compAmount = compTransactions.filter(t => t.categoryId === cat.id && t.type === 'expense' && t.isPaid).reduce((sum, t) => sum + t.amount, 0);
        return {
            category: cat.name,
            value: currentAmount,
            prevValue: compAmount,
            color: getChartColor(index)
        };
    }).filter(c => c.value > 0 || c.prevValue > 0);

    // Form Submits
    const handleSaveTransaction = async () => {
        if (!transactionForm.description || !transactionForm.amount || isSaving) return;

        // Auto-select first account if income and only one account exists but none selected
        if (transactionForm.type === 'income' && !transactionForm.bank_account_id) {
            const realAccounts = bankAccounts.filter(acc => acc.id !== 'estoque-virtual');
            if (realAccounts.length === 1) {
                transactionForm.bank_account_id = realAccounts[0].id;
            }
        }

        setIsSaving(true);
        try {
            if (editingTransactionId) {
                await actions.updatePersonalTransaction({ ...transactionForm, id: editingTransactionId } as PersonalTransaction);
            } else {
                // Set isPaid to true by default for income transactions
                if (transactionForm.type === 'income') {
                    transactionForm.isPaid = true;
                }
                if (transactionForm.isInstallment && (transactionForm.installmentsCount || 2) > 1) {
                    const count = transactionForm.installmentsCount || 2;
                    const [y, m, d] = (transactionForm.date || new Date().toISOString().split('T')[0]).split('-');
                    const baseDate = new Date(Number(y), Number(m) - 1, Number(d));
                    const amountPerInstallment = Number((transactionForm.amount / count).toFixed(2));

                    for (let i = 0; i < count; i++) {
                        const installmentDate = new Date(Number(y), Number(m) - 1 + i, Number(d));

                        await actions.addPersonalTransaction({
                            ...transactionForm,
                            amount: amountPerInstallment,
                            date: installmentDate.toISOString().split('T')[0],
                            isPaid: i === 0 ? !!transactionForm.isPaid : false,
                            description: `${transactionForm.description} (${i + 1}/${count})`
                        });
                    }
                } else {
                    await actions.addPersonalTransaction(transactionForm);
                }
            }
            setShowForm(null);
            setEditingTransactionId(null);
            setTransactionForm({ type: 'expense', amount: 0, date: new Date().toISOString().split('T')[0], isPaid: true, description: '', isInstallment: false, installmentsCount: 2 });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveBudget = async () => {
        if (!budgetForm.categoryId || !budgetForm.amount || !budgetForm.month || isSaving) return;
        setIsSaving(true);
        try {
            if (editingBudgetId) {
                await actions.updateBudget({ ...budgetForm, id: editingBudgetId } as PersonalBudget);
            } else {
                // Check for duplication
                const exists = budgets.find(b => b.categoryId === budgetForm.categoryId && b.month === budgetForm.month && b.memberId === budgetForm.memberId);
                if (exists) {
                    if (!window.confirm('Já existe uma meta para esta categoria neste mês. Deseja criar outra mesmo assim?')) {
                        return;
                    }
                }
                await actions.addBudget(budgetForm);
            }
            setShowForm(null);
            setEditingBudgetId(null);
            setBudgetForm({ amount: 0, month: new Date().toISOString().substring(0, 7) });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditBudget = (b: PersonalBudget) => {
        setBudgetForm({
            categoryId: b.categoryId,
            amount: b.amount,
            month: b.month,
            memberId: b.memberId
        });
        setEditingBudgetId(b.id);
        setShowForm('budget');
    };

    const handleSaveCategory = async () => {
        if (!categoryForm.name || isSaving) return;
        setIsSaving(true);
        try {
            if (editingCategoryId) {
                await actions.updateCategory({ ...categoryForm, id: editingCategoryId } as PersonalCategory);
            } else {
                await actions.addCategory(categoryForm);
            }
            setShowForm(null);
            setEditingCategoryId(null);
            setCategoryForm({ type: 'expense', name: '', parentId: undefined });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditCategory = (cat: PersonalCategory) => {
        setCategoryForm({ name: cat.name, type: cat.type, parentId: cat.parentId });
        setEditingCategoryId(cat.id);
        setShowForm('category');
    };

    const handleSaveMember = async () => {
        if (!memberForm.name || isSaving) return;
        setIsSaving(true);
        try {
            await actions.addFamilyMember(memberForm);
            setShowForm(null);
            setMemberForm({ name: '' });
        } finally {
            setIsSaving(false);
        }
    };

    const renderCategoryCentral = () => {
        if (!showCategoryCentral) return null;

        const typeFilter = showCategoryCentral === 'transaction' ? transactionForm.type : 'expense';
        const availableCategories = categories.filter(c => {
            if (showCategoryCentral === 'budget') {
                return c.type === 'expense' || c.type === 'reserve' || c.type === 'planning';
            }
            return c.type === typeFilter;
        });

        return (
            <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 animate-fadeIn" onClick={() => setShowCategoryCentral(null)}>
                <div className="bg-white dark:bg-slate-900 w-full max-w-sm sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl animate-slideUp max-h-[80vh]" onClick={e => e.stopPropagation()}>
                    <div className="p-4 sm:p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                        <h2 className="text-sm font-black uppercase tracking-tight dark:text-white flex items-center gap-2">
                            <ListDashes size={20} className="text-blue-500" />
                            Central de Categorias
                        </h2>
                        <button title="Fechar Categorias" onClick={() => setShowCategoryCentral(null)} className="p-2 bg-white dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 shadow-sm border dark:border-slate-700">
                            <X size={16} weight="bold" />
                        </button>
                    </div>
                    <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <button
                                onClick={() => {
                                    if (showCategoryCentral === 'transaction') setTransactionForm({ ...transactionForm, categoryId: undefined });
                                    if (showCategoryCentral === 'budget') setBudgetForm({ ...budgetForm, categoryId: undefined });
                                    setShowCategoryCentral(null);
                                }}
                                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-slate-600">
                                    <X size={20} weight="bold" />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 text-center uppercase">Sem Categoria</span>
                            </button>

                            {availableCategories.filter(c => !c.parentId).map(c => {
                                const subCategories = availableCategories.filter(sub => sub.parentId === c.id);
                                const hasSubs = subCategories.length > 0;
                                const isExpanded = expandedCategories[c.id];
                                return (
                                    <React.Fragment key={c.id}>
                                        <div className="relative group">
                                            <button
                                                onClick={() => {
                                                    if (showCategoryCentral === 'transaction') setTransactionForm({ ...transactionForm, categoryId: c.id });
                                                    if (showCategoryCentral === 'budget') setBudgetForm({ ...budgetForm, categoryId: c.id });
                                                    setShowCategoryCentral(null);
                                                }}
                                                className={`w-full border border-${c.type === 'reserve' ? 'purple' : c.type === 'planning' ? 'blue' : 'slate'}-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:border-${c.type === 'reserve' ? 'purple' : c.type === 'planning' ? 'blue' : 'blue'}-500 transition-colors bg-white dark:bg-slate-800 shadow-sm hover:shadow-md`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.type === 'income' ? 'bg-emerald-100 text-emerald-600' :
                                                    c.type === 'reserve' ? 'bg-purple-100 text-purple-600' :
                                                        c.type === 'planning' ? 'bg-blue-100 text-blue-600' :
                                                            'bg-rose-100 text-rose-600'
                                                    }`}>
                                                    {c.type === 'income' ? <ArrowUpRight size={20} weight="bold" /> :
                                                        c.type === 'reserve' ? <Wallet size={20} weight="bold" /> :
                                                            c.type === 'planning' ? <Target size={20} weight="bold" /> :
                                                                <ArrowDownRight size={20} weight="bold" />}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 text-center uppercase">{c.name}</span>
                                            </button>

                                            {/* Botão de Expandir Subs (absoluto no canto) */}
                                            {hasSubs && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedCategories(prev => ({ ...prev, [c.id]: !prev[c.id] }));
                                                    }}
                                                    className="absolute top-2 right-2 p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-500 rounded-lg shadow-sm z-10"
                                                    title={isExpanded ? "Recolher Subcategorias" : "Expandir Subcategorias"}
                                                >
                                                    {isExpanded ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
                                                </button>
                                            )}
                                        </div>

                                        {/* Render Subcategories */}
                                        {isExpanded && subCategories.map(sub => (
                                            <button
                                                key={sub.id}
                                                onClick={() => {
                                                    if (showCategoryCentral === 'transaction') setTransactionForm({ ...transactionForm, categoryId: sub.id });
                                                    if (showCategoryCentral === 'budget') setBudgetForm({ ...budgetForm, categoryId: sub.id });
                                                    setShowCategoryCentral(null);
                                                }}
                                                className={`border border-${sub.type === 'reserve' ? 'purple' : sub.type === 'planning' ? 'blue' : 'slate'}-100 dark:border-slate-700/80 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 hover:border-${sub.type === 'reserve' ? 'purple' : sub.type === 'planning' ? 'blue' : 'blue'}-400 transition-colors bg-slate-50 dark:bg-slate-800/50 shadow-sm hover:shadow-md group relative overflow-hidden`}
                                            >
                                                <div className="absolute top-0 left-0 w-1 h-full bg-slate-300 dark:bg-slate-600"></div>
                                                <div className="flex items-center gap-1.5 opacity-50 mb-1">
                                                    <ArrowUpRight size={10} className="text-slate-400 rotate-90" weight="bold" />
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase truncate max-w-[60px]">{c.name}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 text-center uppercase">{sub.name}</span>
                                            </button>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                        {availableCategories.length === 0 && (
                            <div className="text-center py-8 text-slate-400">
                                <p className="text-xs font-bold uppercase italic">Nenhuma categoria encontrada.</p>
                                <button onClick={() => { setShowCategoryCentral(null); setShowForm('category'); }} className="mt-3 text-blue-500 underline text-xs font-bold">Criar Nova Categoria</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Render Forms Modal
    const renderModal = () => {
        if (!showForm) return null;

        return (
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fadeIn p-2 sm:p-4">
                <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl animate-slideUp">
                    <div className="p-4 sm:p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                        <h2 className="text-lg font-black uppercase tracking-tight dark:text-white flex items-center gap-2">
                            {showForm === 'transaction' && <Wallet size={20} className="text-blue-500" />}
                            {showForm === 'budget' && <Target size={20} className="text-purple-500" />}
                            {showForm === 'category' && <Layout size={20} className="text-emerald-500" />}
                            {showForm === 'member' && <Users size={20} className="text-orange-500" />}
                            {showForm === 'transaction' ? 'Novo Lançamento' : showForm === 'budget' ? 'Nova Meta' : showForm === 'category' ? 'Nova Categoria' : 'Novo Membro'}
                        </h2>
                        <button title="Fechar Modal" onClick={() => { setShowForm(null); setEditingCategoryId(null); setCategoryForm({ type: 'expense', name: '' }); }} className="p-2 bg-white dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 shadow-sm border dark:border-slate-700">
                            <X size={16} weight="bold" />
                        </button>
                    </div>

                    <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {showForm === 'transaction' && (
                            <>
                                <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                    <button onClick={() => setTransactionForm({ ...transactionForm, type: 'expense' })} className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${transactionForm.type === 'expense' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Despesa</button>
                                    <button onClick={() => setTransactionForm({ ...transactionForm, type: 'income' })} className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${transactionForm.type === 'income' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Receita</button>
                                    <button onClick={() => setTransactionForm({ ...transactionForm, type: 'reserve' })} className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${transactionForm.type === 'reserve' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Reserva</button>
                                    <button onClick={() => setTransactionForm({ ...transactionForm, type: 'planning' })} className={`py-2 text-[10px] font-black uppercase rounded-lg transition-all ${transactionForm.type === 'planning' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Planejamento</button>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Descrição</label>
                                        <input type="text" value={transactionForm.description || ''} onChange={e => setTransactionForm({ ...transactionForm, description: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors font-bold dark:text-white" placeholder="Ex: Mercado, Conta de Luz" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="relative">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Valor</label>
                                            <div className="relative">
                                                <input type="number" value={transactionForm.amount || ''} onChange={e => setTransactionForm({ ...transactionForm, amount: Number(e.target.value) })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-3 outline-none focus:border-blue-500 transition-colors font-black text-lg dark:text-slate-100 placeholder:text-slate-300" placeholder="0.00" />
                                                <button type="button" onClick={() => setShowCalcFor('transaction')} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" title="Calculadora">
                                                    <Calculator size={20} weight="bold" />
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Data</label>
                                            <input type="date" title="Data do Lançamento" value={transactionForm.date || ''} onChange={e => setTransactionForm({ ...transactionForm, date: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors font-bold dark:text-slate-100" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Membro (Opcional)</label>
                                            <select title="Membro da Família (Opcional)" value={transactionForm.memberId || ''} onChange={e => setTransactionForm({ ...transactionForm, memberId: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors font-bold dark:text-white text-sm appearance-none">
                                                <option value="">Não atribuído</option>
                                                {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Central de Categorias (Opcional)</label>
                                            <div
                                                onClick={() => setShowCategoryCentral('transaction')}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 cursor-pointer hover:border-blue-500 transition-colors flex justify-between items-center"
                                            >
                                                <span className={`font-bold text-sm truncate ${transactionForm.categoryId ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                                                    {transactionForm.categoryId ? categories.find(c => c.id === transactionForm.categoryId)?.name || 'Categoria Removida' : 'Selecione uma Categoria...'}
                                                </span>
                                                <Layout size={18} className="text-slate-400 shrink-0" />
                                            </div>
                                        </div>
                                    </div>

                                    {transactionForm.type === 'income' && (
                                        <div className="animate-fadeIn">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 italic">Conta da Empresa (De onde sai o dinheiro)</label>
                                            <select
                                                title="Conta Bancária da Empresa"
                                                value={transactionForm.bank_account_id || ''}
                                                onChange={e => setTransactionForm({ ...transactionForm, bank_account_id: e.target.value })}
                                                className="w-full bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors font-black text-blue-700 dark:text-blue-300 text-sm appearance-none"
                                            >
                                                <option value="">-- Selecione a Conta da Empresa --</option>
                                                {bankAccounts.filter(acc => acc.id !== 'estoque-virtual').map(acc => (
                                                    <option key={acc.id} value={acc.id}>{acc.name} (Saldo: R$ {formatMoney(acc.balance)})</option>
                                                ))}
                                            </select>
                                            <p className="text-[9px] text-slate-400 mt-1 ml-1 font-bold">* Necessário para descontar do caixa da empresa.</p>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-2 mt-2">
                                        <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${transactionForm.isPaid ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                {transactionForm.isPaid && <Check size={14} weight="bold" />}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={transactionForm.isPaid} onChange={e => setTransactionForm({ ...transactionForm, isPaid: e.target.checked })} />
                                            <span className="text-sm font-bold dark:text-white">Lançamento Pago/Recebido</span>
                                        </label>

                                        {!editingTransactionId && (
                                            <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${transactionForm.isInstallment ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                    {transactionForm.isInstallment && <Check size={14} weight="bold" />}
                                                </div>
                                                <input type="checkbox" className="hidden" checked={transactionForm.isInstallment || false} onChange={e => setTransactionForm({ ...transactionForm, isInstallment: e.target.checked })} />
                                                <span className="text-sm font-bold dark:text-white">Compra Parcelada / Custo Recorrente</span>
                                            </label>
                                        )}

                                        {!editingTransactionId && transactionForm.isInstallment && (
                                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800/50 rounded-xl flex items-center justify-between animate-fadeIn">
                                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Quantidade de Meses/Parcelas</span>
                                                <div className="flex items-center gap-3">
                                                    <button type="button" onClick={() => setTransactionForm(prev => ({ ...prev, installmentsCount: Math.max(2, (prev.installmentsCount || 2) - 1) }))} className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-black shadow flex items-center justify-center">-</button>
                                                    <span className="font-black w-4 text-center dark:text-white">{transactionForm.installmentsCount || 2}</span>
                                                    <button type="button" onClick={() => setTransactionForm(prev => ({ ...prev, installmentsCount: Math.min(72, (prev.installmentsCount || 2) + 1) }))} className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-black shadow flex items-center justify-center">+</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {showForm === 'budget' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Mês Ref.</label>
                                        <input type={"month" as string} title="Mês de Referência" value={budgetForm.month || ''} onChange={e => setBudgetForm({ ...budgetForm, month: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-purple-500 transition-colors font-bold dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Membro (Opcional)</label>
                                        <select title="Membro (Opcional)" value={budgetForm.memberId || ''} onChange={e => setBudgetForm({ ...budgetForm, memberId: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-purple-500 transition-colors font-bold dark:text-white text-sm appearance-none">
                                            <option value="">Família Toda</option>
                                            {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Central de Categoria Alvo</label>
                                    <div
                                        onClick={() => setShowCategoryCentral('budget')}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 cursor-pointer hover:border-purple-500 transition-colors flex justify-between items-center"
                                    >
                                        <span className={`font-bold text-sm truncate ${budgetForm.categoryId ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                                            {budgetForm.categoryId ? categories.find(c => c.id === budgetForm.categoryId)?.name || 'Categoria Removida' : 'Selecione a Categoria de Despesa...'}
                                        </span>
                                        <Layout size={18} className="text-slate-400 shrink-0" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Valor Limite</label>
                                    <div className="relative">
                                        <input type="number" value={budgetForm.amount || ''} onChange={e => setBudgetForm({ ...budgetForm, amount: Number(e.target.value) })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-3 outline-none focus:border-purple-500 transition-colors font-black text-lg dark:text-slate-100 placeholder:text-slate-300" placeholder="0.00" />
                                        <button type="button" onClick={() => setShowCalcFor('budget')} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors" title="Calculadora">
                                            <Calculator size={20} weight="bold" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {showForm === 'category' && (
                            <div className="space-y-4">
                                {!editingCategoryId && (
                                    <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-2">
                                        <button onClick={() => setCategoryForm({ ...categoryForm, type: 'expense' })} className={`py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${categoryForm.type === 'expense' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Despesas</button>
                                        <button onClick={() => setCategoryForm({ ...categoryForm, type: 'income' })} className={`py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${categoryForm.type === 'income' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Receitas</button>
                                        <button onClick={() => setCategoryForm({ ...categoryForm, type: 'reserve' })} className={`py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${categoryForm.type === 'reserve' ? 'bg-white dark:bg-slate-700 text-purple-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Reserva</button>
                                        <button onClick={() => setCategoryForm({ ...categoryForm, type: 'planning' })} className={`py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${categoryForm.type === 'planning' ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Planejamento</button>
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nome da Categoria</label>
                                    <input type="text" value={categoryForm.name || ''} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors font-bold dark:text-white" placeholder="Ex: Moradia, Transporte..." />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Categoria Pai (Tornar Subcategoria)</label>
                                    <select title="Categoria Pai (Opcional)" value={categoryForm.parentId || ''} onChange={e => setCategoryForm({ ...categoryForm, parentId: e.target.value || undefined })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors font-bold dark:text-white text-sm appearance-none">
                                        <option value="">Nenhuma (É Principal)</option>
                                        {categories.filter(c => !c.parentId && c.type === (categoryForm.type || 'expense') && c.id !== editingCategoryId).map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {showForm === 'member' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nome do Membro da Família</label>
                                    <input type="text" value={memberForm.name || ''} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-orange-500 transition-colors font-bold dark:text-white" placeholder="Nome..." />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/80 border-t dark:border-slate-800">
                        <button
                            disabled={isSaving}
                            onClick={() => {
                                if (showForm === 'transaction') handleSaveTransaction();
                                if (showForm === 'budget') handleSaveBudget();
                                if (showForm === 'category') handleSaveCategory();
                                if (showForm === 'member') handleSaveMember();
                            }}
                            className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-[0.98] ${showForm === 'transaction' ? 'bg-blue-600 hover:bg-blue-700' : showForm === 'budget' ? 'bg-purple-600 hover:bg-purple-700' : showForm === 'category' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // --- Resumo Tab Component ---
    const renderResumo = () => (
        <div className="space-y-4 pb-20 fade-in">
            <div className="flex justify-between items-center px-2 mt-4 relative z-20">
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Visão Geral</h2>
                <div className="relative">
                    <button
                        onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                        className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:border-blue-500 transition-colors"
                    >
                        <Calendar size={16} className="text-blue-500" />
                        <span className="capitalize">{period === 'all' ? 'Tudo' : period === 'year' ? 'Ano' : period === 'semester' ? 'Semestre' : period === 'quarter' ? 'Trimestre' : period === 'month' ? 'Mês' : 'Período'}</span>
                        <CaretDown size={12} weight="bold" />
                    </button>
                    {isFiltersExpanded && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-[100] animate-slideDown origin-top-right">
                            <div className="p-2 space-y-1">
                                {['month', 'quarter', 'semester', 'year', 'all', 'custom'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => { handlePeriodChange(p as PeriodType); setIsFiltersExpanded(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors ${period === p ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                    >
                                        {p === 'month' ? 'Mês Atual' : p === 'quarter' ? 'Trimestre Atual' : p === 'semester' ? 'Semestre Atual' : p === 'year' ? 'Ano Atual' : p === 'all' ? 'Todo o Período' : 'Personalizado'}
                                    </button>
                                ))}
                            </div>
                            {period === 'custom' && (
                                <div className="p-3 border-t dark:border-slate-700 space-y-3 bg-slate-50 dark:bg-slate-800/50">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Início</label>
                                        <input type="date" title="Data Inicial" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-500 dark:text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Fim</label>
                                        <input type="date" title="Data Final" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-500 dark:text-white" />
                                    </div>
                                    <div className="space-y-1 mt-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Início (Comp)</label>
                                        <input type="date" title="Data Inicial (Comparação)" value={compDateRange.start} onChange={e => setCompDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-500 dark:text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Fim (Comp)</label>
                                        <input type="date" title="Data Final (Comparação)" value={compDateRange.end} onChange={e => setCompDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-500 dark:text-white" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-end">
                    <div>
                        <span className="text-blue-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                            <Wallet size={12} weight="bold" />
                            Saldo em Caixa
                        </span>
                        <h3 className="text-3xl font-black mt-1">R$ {formatMoney(balanceActual)}</h3>
                    </div>
                    <div className="text-right">
                        <span className="text-blue-200/60 text-[8px] font-black uppercase tracking-widest block">Projetado (Mês)</span>
                        <span className="text-sm font-black text-blue-100/80">R$ {formatMoney(balanceProjected)}</span>
                    </div>
                </div>
                <div className="flex flex-col gap-2 mt-6 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-black/20 rounded-2xl p-4">
                            <div className="flex items-center gap-2 text-emerald-300 mb-1">
                                <ArrowUpRight size={16} weight="bold" />
                                <span className="text-[10px] font-black uppercase tracking-wider">Receitas (Entradas)</span>
                            </div>
                            <span className="text-lg font-black block truncate">R$ {formatMoney(totalIncome)}</span>
                            <div className="flex flex-col gap-0.5 mt-1">
                                <span className="text-[8px] font-bold text-emerald-300/60 block truncate">R$ {formatMoney(totalIncomePaid)} Recebido</span>
                                {totalIncome - totalIncomePaid > 0 && (
                                    <span className="text-[8px] font-bold text-amber-300/80 block truncate italic">R$ {formatMoney(totalIncome - totalIncomePaid)} A Receber</span>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 bg-black/20 rounded-2xl p-4">
                            <div className="flex items-center gap-2 text-rose-300 mb-1">
                                <ArrowDownRight size={16} weight="bold" />
                                <span className="text-[10px] font-black uppercase tracking-wider">Saídas Totais</span>
                            </div>
                            <span className="text-lg font-black block truncate">R$ {totalOutgoings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            {(totalReserve > 0 || totalPlanning > 0) && (
                                <span className="text-[9px] font-bold text-rose-200 block mt-1 opacity-80">Inclui Reservas/Planos</span>
                            )}
                        </div>
                    </div>
                    {(totalReserve > 0 || totalPlanning > 0) && (
                        <div className="flex items-center gap-2">
                            {totalReserve > 0 && (
                                <div className="flex-1 bg-black/20 rounded-2xl p-4 border border-purple-400/30">
                                    <div className="flex items-center gap-2 text-purple-300 mb-1">
                                        <Wallet size={16} weight="bold" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Reservas</span>
                                    </div>
                                    <span className="text-lg font-black block truncate text-purple-100">R$ {totalReserve.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            {totalPlanning > 0 && (
                                <div className="flex-1 bg-black/20 rounded-2xl p-4 border border-blue-400/30">
                                    <div className="flex items-center gap-2 text-blue-300 mb-1">
                                        <Target size={16} weight="bold" />
                                        <span className="text-[10px] font-black uppercase tracking-wider">Planos</span>
                                    </div>
                                    <span className="text-lg font-black block truncate text-blue-100">R$ {totalPlanning.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 px-2 pt-2">
                <button onClick={() => { setActiveTab('lancamentos'); setEditingTransactionId(null); setTransactionForm({ type: 'expense', amount: 0, date: new Date().toISOString().split('T')[0], isPaid: true, description: '' }); setShowForm('transaction'); }} className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Plus size={20} weight="bold" />
                    </div>
                    <span className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 mt-1">Lançar</span>
                </button>
                <button onClick={() => { setActiveTab('orcamentos'); }} className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Target size={20} weight="bold" />
                    </div>
                    <span className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 mt-1">Metas</span>
                </button>
            </div>

            {/* Metas do Mês Summary */}
            {(() => {
                const curMonth = new Date().toISOString().substring(0, 7);
                const monthBudgets = budgets.filter(b => b.month === curMonth);

                if (monthBudgets.length === 0) return null;

                return (
                    <div className="px-2 mt-2">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <Target size={14} weight="bold" className="text-purple-500" />
                                    Metas do Mês
                                </h3>
                                <button onClick={() => setActiveTab('orcamentos')} className="text-[10px] font-bold text-purple-500 uppercase hover:underline">Detalhes</button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {monthBudgets.map(b => {
                                    const cat = categories.find(c => c.id === b.categoryId);
                                    if (!cat) return null;

                                    const amount = transactions
                                        .filter(t => t.categoryId === b.categoryId && t.type === cat.type && t.date.startsWith(curMonth))
                                        .reduce((acc, t) => acc + t.amount, 0);

                                    const progress = Math.min((amount / (b.amount || 1)) * 100, 100);
                                    const isExpense = cat.type === 'expense';
                                    const isOver = isExpense ? amount > b.amount : false;
                                    const color = isOver ? 'rose' : cat.type === 'reserve' ? 'purple' : 'blue';

                                    return (
                                        <div key={b.id} className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 relative group">
                                            <div className="flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{cat.name}</span>
                                                    <span className="text-[9px] font-bold text-slate-400">R$ {formatMoney(amount)} / {formatMoney(b.amount)}</span>
                                                </div>
                                                <button
                                                    onClick={() => { if (window.confirm('Excluir esta meta?')) actions.deleteBudget(b.id); }}
                                                    className="p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Excluir Meta"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${isOver ? 'bg-rose-500' : `bg-${color}-500`}`}
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Provisões Futuras */}
            {(() => {
                const monthsData = Array.from({ length: provisoesMonths }).map((_, offset) => {
                    const [y, m] = (provisoesStartMonth || new Date().toISOString().substring(0, 7)).split('-');
                    const d = new Date(Number(y), Number(m) - 1 + offset, 1);

                    if (isNaN(d.getTime())) return { key: '', label: 'Erro', total: 0 };

                    const monthKey = d.toISOString().substring(0, 7);
                    const monthName = d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');

                    const monthTransactions = (transactions || []).filter(t => {
                        if (!t.date) return false;
                        const tMonth = t.date.substring(0, 7);
                        return tMonth === monthKey && (t.type === 'expense' || t.type === 'planning') && !t.isPaid;
                    });

                    const total = monthTransactions.reduce((acc, t) => acc + t.amount, 0);
                    return { key: monthKey, label: monthName, total };
                });

                return (
                    <div className="px-2 mt-4">
                        <div className="bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20 border border-rose-100 dark:border-rose-800/50 rounded-3xl p-5 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                                <h3 className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-2">
                                    <Calendar size={18} weight="duotone" />
                                    Provisões Futuras
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                    <div className="flex items-center gap-1 bg-white/50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-rose-100 dark:border-rose-800/40 flex-1 sm:flex-initial">
                                        <label className="text-[9px] font-black uppercase text-rose-400 px-1 whitespace-nowrap">Início:</label>
                                        <input
                                            type={"month" as string}
                                            value={provisoesStartMonth}
                                            onChange={e => setProvisoesStartMonth(e.target.value)}
                                            className="bg-transparent text-[11px] font-black uppercase text-rose-600 dark:text-rose-400 outline-none w-full sm:w-32 min-w-[120px]"
                                            title="Mês de início da projeção"
                                            placeholder="YYYY-MM"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 bg-white/50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-rose-100 dark:border-rose-800/40 flex-1 sm:flex-initial">
                                        <label className="text-[9px] font-black uppercase text-rose-400 px-1 whitespace-nowrap">Meses:</label>
                                        <select
                                            value={provisoesMonths}
                                            onChange={e => setProvisoesMonths(Number(e.target.value))}
                                            className="bg-transparent text-[11px] font-black uppercase text-rose-600 dark:text-rose-400 outline-none cursor-pointer w-full sm:w-auto"
                                            title="Número de meses a exibir"
                                        >
                                            {[3, 4, 6, 8, 12, 18, 24].map(n => (
                                                <option key={n} value={n} className="bg-white dark:bg-slate-900">{n} Meses</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                                {monthsData.map(m => (
                                    <div key={m.key} className="bg-white/60 dark:bg-slate-800/60 rounded-2xl p-3 sm:p-5 border border-rose-50 dark:border-rose-900/30 flex flex-col justify-center items-center gap-1 sm:gap-2 transition-all hover:bg-white hover:shadow-lg hover:-translate-y-1">
                                        <span className="text-[10px] sm:text-[11px] font-black uppercase text-slate-400 text-center leading-none tracking-tighter">{m.label}</span>
                                        <span className={`text-[13px] sm:text-base font-black ${m.total > 0 ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'} transition-all duration-300`}>
                                            R$ {formatMoney(m.total)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Charts Area */}
            <div className="px-2 mt-4">
                <CategoryComparisonChart data={categoryData} title="Despesas por Categoria" />
            </div>

            {/* Recent Transactions list preview */}
            <div className="mt-6 px-2">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Recentes</h3>
                    <button onClick={() => setActiveTab('lancamentos')} className="text-[10px] font-bold text-blue-500 uppercase hover:underline">Ver tudo</button>
                </div>
                <div className="space-y-2">
                    {(transactions || []).slice(0, 3).map(t => (
                        <div key={t.id} className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border dark:border-slate-700 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : t.type === 'expense' ? 'bg-rose-100 text-rose-600' : t.type === 'reserve' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {t.type === 'income' ? <ArrowUpRight size={16} weight="bold" /> : t.type === 'expense' ? <ArrowDownRight size={16} weight="bold" /> : t.type === 'reserve' ? <Wallet size={16} weight="bold" /> : <Target size={16} weight="bold" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-black dark:text-white">{t.description}</span>
                                    <span className="text-[10px] font-bold text-slate-400 mt-0.5">{formatDate(t.date)}</span>
                                </div>
                            </div>
                            <span className={`text-xs font-black ${t.type === 'income' ? 'text-emerald-500' : t.type === 'expense' ? 'text-rose-500' : t.type === 'reserve' ? 'text-purple-500' : 'text-blue-500'}`}>
                                {t.type === 'income' ? '+' : '-'} R$ {formatMoney(t.amount)}
                            </span>
                        </div>
                    ))}
                    {(!transactions || transactions.length === 0) && <p className="text-center text-[10px] font-bold text-slate-400 italic py-4">Nenhum lançamento recente</p>}
                </div>
            </div>
        </div>
    );

    // --- Lançamentos Tab ---
    const renderLancamentos = () => (
        <div className="space-y-4 pb-20 fade-in">
            <div className="flex justify-between items-center px-2 mt-4 mb-2">
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Lançamentos</h2>
                <button onClick={() => { setEditingTransactionId(null); setTransactionForm({ type: 'expense', amount: 0, date: new Date().toISOString().split('T')[0], isPaid: true, description: '' }); setShowForm('transaction'); }} className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 shadow-lg transition-transform active:scale-90" title="Novo Lançamento"><Plus size={20} weight="bold" /></button>
            </div>

            <div className="space-y-3">
                {transactions.length > 0 ? transactions.map(t => (
                    <div key={t.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border dark:border-slate-700 flex justify-between items-center hover:border-blue-300 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : t.type === 'expense' ? 'bg-rose-100 text-rose-600' : t.type === 'reserve' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                {t.type === 'income' ? <ArrowUpRight size={20} weight="bold" /> : t.type === 'expense' ? <ArrowDownRight size={20} weight="bold" /> : t.type === 'reserve' ? <Wallet size={20} weight="bold" /> : <Target size={20} weight="bold" />}
                            </div>
                            <div>
                                <p className="text-sm font-black dark:text-white line-clamp-1 break-all">{t.description} {t.businessTransactionId && <span className="text-[9px] bg-blue-100 text-blue-600 rounded-md px-1.5 py-0.5 ml-1 align-middle whitespace-nowrap">Pró-labore</span>}</p>
                                <div className="flex flex-wrap gap-1.5 text-[9px] uppercase font-black text-slate-400 mt-1">
                                    <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">{formatDate(t.date)}</span>
                                    {t.categoryId && <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">{categories.find(c => c.id === t.categoryId)?.name}</span>}
                                    {t.memberId && <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">{familyMembers.find(m => m.id === t.memberId)?.name}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0 pl-2">
                            <span className={`text-sm font-black ${t.type === 'income' ? 'text-emerald-500' : t.type === 'expense' ? 'text-rose-500' : t.type === 'reserve' ? 'text-purple-500' : 'text-blue-500'}`}>
                                {t.type === 'income' ? '+' : '-'} R$ {formatMoney(t.amount)}
                            </span>
                            <div className="flex gap-1 mt-2">
                                <button onClick={() => { setEditingTransactionId(t.id); setTransactionForm(t); setShowForm('transaction'); }} className="text-slate-300 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Editar Lançamento"><PencilSimple size={16} /></button>
                                <button onClick={() => actions.deletePersonalTransaction(t.id)} className="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors" title="Deletar Transação"><Trash size={16} /></button>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-12 flex flex-col items-center opacity-60">
                        <Wallet size={48} weight="duotone" className="text-slate-300 mb-4" />
                        <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Nenhum lançamento</span>
                    </div>
                )}
            </div>
        </div>
    );

    // --- Orçamentos Tab ---
    const renderOrcamentos = () => (
        <div className="space-y-4 pb-20 fade-in">
            <div className="flex justify-between items-center px-2 mt-4 mb-2">
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Metas & Orçamentos</h2>
                <button onClick={() => setShowForm('budget')} className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 shadow-lg transition-transform active:scale-90" title="Nova Meta"><Plus size={20} weight="bold" /></button>
            </div>

            <div className="space-y-4">
                {budgets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {budgets.map(b => {
                            const cat = categories.find(c => c.id === b.categoryId);
                            const catName = cat?.name || 'Categoria Removida';
                            const isExpense = cat?.type === 'expense';
                            const isReserveOrPlan = cat?.type === 'reserve' || cat?.type === 'planning';

                            // Cálculo do quanto de dinheiro já rodou nessa categoria
                            // Se for Despesa, filtramos por 'expense' no MÊS
                            // Se for Reserva/Planejamento, consideramos TODO o acumulado até agora? 
                            // Como a meta de reserva pode ser mensal ou fixa, vou manter 'dentro do mês da meta' por enquanto.
                            const amountInTransactions = transactions.filter(t => t.categoryId === b.categoryId && t.type === cat?.type && t.date.startsWith(b.month)).reduce((acc, t) => acc + t.amount, 0);

                            const progress = Math.min((amountInTransactions / (b.amount || 1)) * 100, 100);
                            const isOver = isExpense ? amountInTransactions > b.amount : false; // Para reservas, passar de 100% é bom, não estourou
                            const memberName = familyMembers.find(m => m.id === b.memberId)?.name;

                            // Ícones e Cores
                            const IconComponent = cat?.type === 'reserve' ? Wallet : cat?.type === 'planning' ? Target : Target;
                            const baseColor = isOver ? 'rose' : cat?.type === 'reserve' ? 'purple' : cat?.type === 'planning' ? 'blue' : 'purple';

                            return (
                                <div key={b.id} className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border dark:border-slate-700 transition-all hover:border-purple-300 relative overflow-hidden group">
                                    {isOver && isExpense && <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500" title="Alerta: Limite Ultrapassado"></div>}

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl text-white ${isOver ? 'bg-rose-500 shadow-rose-500/30' : `bg-${baseColor}-500 shadow-${baseColor}-500/30`} shadow-lg`}>
                                                <IconComponent size={20} weight="fill" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-xs font-black dark:text-white uppercase tracking-wider">{catName}</h3>
                                                    <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-black border border-slate-200 dark:border-slate-600">{b.month}</span>
                                                    {isReserveOrPlan && <span className={`text-[8px] bg-${baseColor}-100 text-${baseColor}-700 px-1.5 py-0.5 rounded font-black uppercase`}>{cat?.type === 'reserve' ? 'Reserva' : 'Plano'}</span>}
                                                </div>
                                                {memberName && <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 uppercase">👤 {memberName}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl">
                                            <button onClick={() => handleEditBudget(b)} className="text-slate-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar Orçamento"><PencilSimple size={16} /></button>
                                            <button onClick={() => {
                                                if (window.confirm('Deseja realmente excluir esta meta?')) {
                                                    actions.deleteBudget(b.id);
                                                }
                                            }} className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20" title="Apagar Orçamento"><Trash size={16} /></button>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase text-slate-400">{isExpense ? 'Gasto Atual' : 'Acumulado / Guardado'}</span>
                                                <span className={`text-sm font-black ${isOver ? 'text-rose-500' : isReserveOrPlan ? `text-${baseColor}-500` : 'text-slate-800 dark:text-slate-100'}`}>R$ {formatMoney(amountInTransactions)}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black uppercase text-slate-400">Limite / Meta</span>
                                                <span className="text-xs font-bold text-slate-500">R$ {formatMoney(b.amount)}</span>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-700 ${isOver ? 'bg-rose-500' : progress > 80 && isExpense ? 'bg-amber-500' : `bg-${baseColor}-500`}`} style={{ width: `${progress}%` }}></div>
                                            </div>
                                            {isOver && isExpense && <span className="absolute -bottom-5 right-0 text-[9px] font-black uppercase text-rose-500 animate-pulse">Estourou {(progress - 100).toFixed(1)}%</span>}
                                            {!isOver && isReserveOrPlan && progress >= 100 && <span className="absolute -bottom-5 right-0 text-[9px] font-black uppercase text-secondary-500 animate-pulse">Meta Atingida! 🏆</span>}
                                        </div>
                                    </div>

                                    {/* Histórico das entradas se for Meta de Reserva / Plano */}
                                    {isReserveOrPlan && amountInTransactions > 0 && (
                                        <div className="mt-4 pt-3 border-t dark:border-slate-700 flex flex-col gap-1.5">
                                            <span className="text-[8px] uppercase font-black text-slate-400">Histórico Recente</span>
                                            {transactions.filter(t => t.categoryId === b.categoryId && t.type === cat?.type && t.date.startsWith(b.month)).slice(-3).map(t => (
                                                <div key={t.id} className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 truncate max-w-[150px]">{t.description || 'Alocação'}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-400 text-[9px]">{formatDate(t.date)}</span>
                                                        <span className={`font-bold text-${baseColor}-500`}>+R$ {formatMoney(t.amount)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Novo Painel de Diferença Projetada */}
                        <div className="bg-white dark:bg-slate-900 md:col-span-1 border dark:border-slate-800 p-6 rounded-[2rem] shadow-sm flex flex-col justify-center text-center">
                            <p className="text-[10px] font-black uppercase text-slate-400">Diferença Projetada</p>
                            <div className="flex items-center gap-2 justify-center mt-2">
                                <p className={`text-2xl font-black ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    R$ {formatMoney(Math.abs(balance))}
                                </p>
                                <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${balance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {balance >= 0 ? 'Positivo' : 'Negativo'}
                                </div>
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                                {balance >= 0 ? 'Seu saldo cobre todas as previsões.' : 'Suas previsões excedem sua receita.'}
                            </p>
                        </div>

                        {/* Novo Painel de Status Financeiro */}
                        <div className="bg-white dark:bg-slate-900 md:col-span-1 border dark:border-slate-800 p-6 rounded-[2rem] shadow-sm flex flex-col justify-center text-center">
                            <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center ${balance >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {balance >= 0 ? <CheckCircle size={24} /> : <X size={24} />}
                            </div>
                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-1">Status do Mês</h4>
                            <p className={`text-sm font-black uppercase ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {balance >= 0 ? 'Saúde Financeira OK' : 'Atenção: Saldo Negativo'}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-2 leading-relaxed">
                                {balance >= 0
                                    ? 'Continue mantendo suas despesas dentro do planejado.'
                                    : 'Considere reduzir gastos ou realizar um aporte pro-labore.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 flex flex-col items-center opacity-60">
                        <Target size={48} weight="duotone" className="text-slate-300 mb-4" />
                        <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Nenhum orçamento definido</span>
                    </div>
                )}
            </div>
        </div>
    );

    // --- Configurações Tab ---
    const renderConfig = () => (
        <div className="space-y-8 pb-20 fade-in px-2 mt-4">
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-6">Configurações</h2>

            {/* Membros */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-5 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><Users size={18} /> Integrantes Família</h3>
                    <button onClick={() => setShowForm('member')} className="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 text-[9px] px-3 py-1.5 rounded-full font-black uppercase hover:bg-orange-100 transition-colors">Adicionar +</button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {familyMembers.map(m => (
                        <div key={m.id} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-4 py-1.5 pr-1.5 rounded-full flex items-center gap-3">
                            <span className="text-xs font-bold dark:text-white uppercase">{m.name}</span>
                            <button title="Excluir Integrante" onClick={() => actions.deleteFamilyMember(m.id)} className="w-6 h-6 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"><Trash size={12} /></button>
                        </div>
                    ))}
                    {familyMembers.length === 0 && <span className="text-xs text-slate-400 italic font-bold">Nenhum integrante cadastrado</span>}
                </div>
            </div>

            {/* Categorias Pessoais */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-5 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><Layout size={18} /> Categorias Pessoais</h3>
                    <button onClick={() => { setEditingCategoryId(null); setShowForm('category'); }} className="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-[9px] px-3 py-1.5 rounded-full font-black uppercase hover:bg-emerald-100 transition-colors">Criar Nova</button>
                </div>
                <div className="space-y-2.5">
                    {categories.filter(c => !c.parentId).map(c => {
                        const subCategories = categories.filter(sub => sub.parentId === c.id);
                        const hasSubs = subCategories.length > 0;
                        const isExpanded = expandedCategories[c.id];
                        return (
                            <React.Fragment key={c.id}>
                                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {hasSubs && (
                                            <button onClick={() => setExpandedCategories(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-blue-600 transition-colors">
                                                {isExpanded ? <CaretUp size={16} weight="bold" /> : <CaretDown size={16} weight="bold" />}
                                            </button>
                                        )}
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.type === 'income' ? 'bg-blue-100 text-blue-500' : 'bg-rose-100 text-rose-500'}`}>
                                            {c.type === 'income' ? <ArrowUpRight size={16} weight="bold" /> : <ArrowDownRight size={16} weight="bold" />}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black dark:text-white uppercase">{c.name}</span>
                                            {c.type === 'income' && <span className="text-[8px] font-bold text-slate-400">RECEITA / ENTRADA</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button title="Editar Categoria" onClick={() => handleEditCategory(c)} className="text-slate-300 hover:text-blue-500 p-2 transition-colors"><PencilSimple size={16} /></button>
                                        <button title="Apagar Categoria" onClick={() => {
                                            if (categories.some(sub => sub.parentId === c.id)) {
                                                alert("Não é possível apagar esta categoria pois ela possui subcategorias. Apague ou mova as subcategorias primeiro.");
                                                return;
                                            }
                                            actions.deleteCategory(c.id);
                                        }} className="text-slate-300 hover:text-rose-500 p-2 transition-colors"><Trash size={16} /></button>
                                    </div>
                                </div>

                                {/* Subcategorias */}
                                {isExpanded && subCategories.map(sub => (
                                    <div key={sub.id} className="ml-8 bg-slate-50/50 dark:bg-slate-800/30 border-l-[3px] border-y border-r border-slate-200 dark:border-slate-700 border-l-slate-300 dark:border-l-slate-600 p-2 rounded-r-2xl rounded-l-md flex items-center justify-between">
                                        <div className="flex items-center gap-2 opacity-80">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${sub.type === 'income' ? 'bg-blue-100/50 text-blue-500' : 'bg-rose-100/50 text-rose-500'}`}>
                                                <ArrowUpRight size={12} weight="bold" className="rotate-90" />
                                            </div>
                                            <span className="text-xs font-bold dark:text-slate-300 uppercase">{sub.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-80">
                                            <button title="Editar Subcategoria" onClick={() => handleEditCategory(sub)} className="text-slate-400 hover:text-blue-500 p-1.5 transition-colors"><PencilSimple size={14} /></button>
                                            <button title="Apagar Subcategoria" onClick={() => actions.deleteCategory(sub.id)} className="text-slate-400 hover:text-rose-500 p-1.5 transition-colors"><Trash size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </React.Fragment>
                        );
                    })}
                    {categories.filter(c => !c.parentId).length === 0 && <span className="text-xs text-slate-400 italic block font-bold">Nenhuma categoria cadastrada</span>}
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900/50 relative">
            <header className="px-4 sm:px-5 pt-6 sm:pt-8 pb-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    <h1 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight">Centro Pessoal</h1>
                </div>

                {/* Custom Tabs Navigation for this Sub-module */}
                <div className="flex bg-white/50 dark:bg-slate-800/80 rounded-full p-1 border-2 border-slate-200 dark:border-slate-700 backdrop-blur-xl shadow-lg shadow-slate-200/50 dark:shadow-black/20 self-stretch sm:self-auto overflow-x-auto no-scrollbar">
                    <div className="flex items-center justify-between w-full sm:w-auto min-w-max">
                        {[
                            { id: 'resumo', icon: Layout, label: 'Resumo' },
                            { id: 'lancamentos', icon: Wallet, label: 'Lançamentos' },
                            { id: 'orcamentos', icon: Target, label: 'Metas' },
                            { id: 'relatorios', icon: ChartPie, label: 'Relatórios' },
                            { id: 'config', icon: Users, label: 'Configs' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                title={tab.label}
                                onClick={() => {
                                    if (tab.id === 'relatorios' && (window as any).setView) {
                                        (window as any).setView('financeiro_pessoal_relatorios');
                                    } else {
                                        setActiveTab(tab.id as any);
                                    }
                                }}
                                className={`flex-1 sm:flex-initial p-2 sm:p-2.5 rounded-full transition-all duration-300 active:scale-95 flex items-center justify-center gap-1.5 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-700'}`}
                            >
                                <tab.icon size={18} weight={activeTab === tab.id ? "fill" : "bold"} />
                                <span className={`text-[10px] font-black uppercase transition-all ${activeTab === tab.id ? 'block' : 'hidden md:block'}`}>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
                {activeTab === 'resumo' && renderResumo()}
                {activeTab === 'lancamentos' && renderLancamentos()}
                {activeTab === 'orcamentos' && renderOrcamentos()}
                {activeTab === 'config' && renderConfig()}
            </div>


            {renderCategoryCentral()}
            {renderModal()}

            <CalculatorModal
                isOpen={!!showCalcFor}
                initialValue={showCalcFor === 'transaction' ? (transactionForm.amount || 0) : showCalcFor === 'budget' ? (budgetForm.amount || 0) : 0}
                onApply={(val) => {
                    if (showCalcFor === 'transaction') setTransactionForm({ ...transactionForm, amount: val });
                    if (showCalcFor === 'budget') setBudgetForm({ ...budgetForm, amount: val });
                    setShowCalcFor(null);
                }}
                onClose={() => setShowCalcFor(null)}
            />
        </div>
    );
};
