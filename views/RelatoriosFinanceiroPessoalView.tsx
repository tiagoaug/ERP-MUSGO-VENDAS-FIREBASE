
import React, { useState, useMemo } from 'react';
import { FamilyMember, PersonalCategory, PersonalTransaction } from '../types';
import { generateReportPDF } from '../lib/pdfGenerator';
import { formatMoney, formatDate } from '../lib/utils';
import {
    FileText,
    Calendar,
    Users,
    ListDashes,
    Printer,
    DeviceMobile,
    ArrowLeft,
    ChartBar,
    Wallet,
    Target,
    ArrowUpRight,
    ArrowDownRight,
    CheckCircle
} from '@phosphor-icons/react';

interface RelatoriosFinanceiroPessoalViewProps {
    familyMembers: FamilyMember[];
    categories: PersonalCategory[];
    transactions: PersonalTransaction[];
    onBack: () => void;
}

type PeriodType = 'month' | 'quarter' | 'semester' | 'year' | 'all' | 'custom';

export const RelatoriosFinanceiroPessoalView: React.FC<RelatoriosFinanceiroPessoalViewProps> = ({
    familyMembers, categories, transactions, onBack
}) => {
    const [period, setPeriod] = useState<PeriodType>('month');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10)
    });
    const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

    // Filter Logic
    const handlePeriodChange = (p: PeriodType) => {
        setPeriod(p);
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (p === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (p === 'quarter') {
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1);
            end = new Date(now.getFullYear(), (q + 1) * 3, 0);
        } else if (p === 'semester') {
            const s = now.getMonth() < 6 ? 0 : 6;
            start = new Date(now.getFullYear(), s, 1);
            end = new Date(now.getFullYear(), s + 6, 0);
        } else if (p === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
        } else if (p === 'all') {
            start = new Date(2000, 0, 1);
            end = new Date(2100, 11, 31);
        }

        setDateRange({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t =>
            (t.date || '').substring(0, 10) >= dateRange.start &&
            (t.date || '').substring(0, 10) <= dateRange.end &&
            (selectedMemberId === 'all' || t.memberId === selectedMemberId) &&
            (selectedCategoryId === 'all' || t.categoryId === selectedCategoryId)
        );
    }, [transactions, dateRange, selectedMemberId, selectedCategoryId]);

    const dateLabel = useMemo(() => {
        if (period === 'all') return 'Todo o Período';
        return `${formatDate(dateRange.start)} à ${formatDate(dateRange.end)}`;
    }, [period, dateRange]);

    // Report Generators
    const generateAllExpenses = async (format: 'a4' | 'mobile') => {
        const expenses = filteredTransactions.filter(t => t.type === 'expense');
        const data = expenses.map(t => [
            formatDate(t.date),
            t.description,
            categories.find(c => c.id === t.categoryId)?.name || 'Sem Categoria',
            familyMembers.find(m => m.id === t.memberId)?.name || 'N/A',
            formatMoney(t.amount)
        ]);
        const total = expenses.reduce((acc, t) => acc + t.amount, 0);

        await generateReportPDF(
            "Despesas Detalhadas",
            ['DATA', 'DESCRIÇÃO', 'CATEGORIA', 'MEMBRO', 'VALOR'],
            data,
            [{ label: 'TOTAL DESPESAS', value: `R$ ${formatMoney(total)}` }],
            format,
            dateLabel
        );
    };

    const generateExpensesByCategory = async (format: 'a4' | 'mobile') => {
        const stats: Record<string, number> = {};
        filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
            const catName = categories.find(c => c.id === t.categoryId)?.name || 'Sem Categoria';
            stats[catName] = (stats[catName] || 0) + t.amount;
        });

        const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
        const data = sorted.map(([name, amount]) => [name, formatMoney(amount)]);
        const total = sorted.reduce((acc, [, amount]) => acc + amount, 0);

        await generateReportPDF(
            "Despesas por Categoria",
            ['CATEGORIA', 'TOTAL'],
            data,
            [{ label: 'TOTAL GERAL', value: `R$ ${formatMoney(total)}` }],
            format,
            dateLabel
        );
    };

    const generateMemberSummary = async (format: 'a4' | 'mobile') => {
        const stats: Record<string, { income: number, expense: number, reserve: number, planning: number }> = {};

        filteredTransactions.forEach(t => {
            const memberName = familyMembers.find(m => m.id === t.memberId)?.name || 'Comum/N/A';
            if (!stats[memberName]) stats[memberName] = { income: 0, expense: 0, reserve: 0, planning: 0 };

            if (t.type === 'income') stats[memberName].income += t.amount;
            else if (t.type === 'expense') stats[memberName].expense += t.amount;
            else if (t.type === 'reserve') stats[memberName].reserve += t.amount;
            else if (t.type === 'planning') stats[memberName].planning += t.amount;
        });

        const data = Object.entries(stats).map(([name, s]) => [
            name,
            formatMoney(s.income),
            formatMoney(s.expense),
            formatMoney(s.reserve + s.planning),
            formatMoney(s.income - s.expense - s.reserve - s.planning)
        ]);

        await generateReportPDF(
            "Resumo por Membro",
            ['MEMBRO', 'RECEITAS', 'SAÍDAS', 'RESERVAS', 'SALDO'],
            data,
            [],
            format,
            dateLabel
        );
    };

    const generateConsolidatedFinance = async (format: 'a4' | 'mobile') => {
        const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const reserve = filteredTransactions.filter(t => t.type === 'reserve').reduce((acc, t) => acc + t.amount, 0);
        const planning = filteredTransactions.filter(t => t.type === 'planning').reduce((acc, t) => acc + t.amount, 0);

        const data = [
            ['TOTAL DE RECEITAS', `R$ ${formatMoney(income)}`],
            ['TOTAL DE SAÍDAS (GASTOS)', `R$ ${formatMoney(expense)}`],
            ['TOTAL EM RESERVAS', `R$ ${formatMoney(reserve)}`],
            ['TOTAL EM PLANEJAMENTO', `R$ ${formatMoney(planning)}`],
            ['SALDO OPERACIONAL LÍQUIDO', `R$ ${formatMoney(income - expense)}`],
            ['SALDO FINAL DISPONÍVEL', `R$ ${formatMoney(income - expense - reserve - planning)}`]
        ];

        await generateReportPDF(
            "Balanço Financeiro Pessoal",
            ['CATEGORIA FINANCEIRA', 'VALOR'],
            data,
            [],
            format,
            dateLabel
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-24 px-2">
            {/* HEADER */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        title="Voltar para Financeiro Pessoal"
                        className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 hover:text-blue-600 transition-colors"
                    >
                        <ArrowLeft size={20} weight="bold" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black uppercase dark:text-white tracking-tight">Central de Relatórios</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financeiro Pessoal</p>
                    </div>
                </div>
            </div>

            {/* FILTERS */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border dark:border-slate-800 shadow-sm space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Período */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                            <Calendar size={14} /> Período
                        </label>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                            {['month', 'year', 'all', 'custom'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => handlePeriodChange(p as PeriodType)}
                                    className={`flex-1 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${period === p ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-400'}`}
                                >
                                    {p === 'month' ? 'Mês' : p === 'year' ? 'Ano' : p === 'all' ? 'Tudo' : 'Proprio'}
                                </button>
                            ))}
                        </div>
                        {period === 'custom' && (
                            <div className="flex gap-2 animate-fadeIn">
                                <input type="date" title="Data Inicial" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} className="flex-1 bg-slate-50 dark:bg-slate-800 border rounded-xl px-2 py-2 text-xs font-bold dark:text-white" />
                                <input type="date" title="Data Final" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} className="flex-1 bg-slate-50 dark:bg-slate-800 border rounded-xl px-2 py-2 text-xs font-bold dark:text-white" />
                            </div>
                        )}
                    </div>

                    {/* Membro */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                            <Users size={14} /> Membro da Família
                        </label>
                        <select
                            value={selectedMemberId}
                            onChange={(e) => setSelectedMemberId(e.target.value)}
                            title="Selecionar Membro da Família"
                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 text-[11px] font-black uppercase outline-none focus:border-blue-500 dark:text-white appearance-none"
                        >
                            <option value="all">TODOS OS MEMBROS</option>
                            {familyMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Categoria */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                            <ListDashes size={14} /> Categoria
                        </label>
                        <select
                            value={selectedCategoryId}
                            onChange={(e) => setSelectedCategoryId(e.target.value)}
                            title="Selecionar Categoria"
                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 text-[11px] font-black uppercase outline-none focus:border-blue-500 dark:text-white appearance-none"
                        >
                            <option value="all">TODAS AS CATEGORIAS</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-center">
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{dateLabel}</span>
                    </div>
                </div>
            </div>

            {/* GRID DE RELATÓRIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 animate-slideUp">
                <ReportCard
                    title="Despesas Detalhadas"
                    desc="Lista completa de cada gasto com data, categoria, membro e descrição."
                    icon={<ArrowDownRight size={24} className="text-rose-500" />}
                    onExport={generateAllExpenses}
                />
                <ReportCard
                    title="Distribuição por Categoria"
                    desc="Resumo consolidado de gastos agrupados por categoria (Gastos totais)."
                    icon={<ChartBar size={24} className="text-indigo-500" />}
                    onExport={generateExpensesByCategory}
                />
                <ReportCard
                    title="Resumo por Membro"
                    desc="Comparativo de entradas, saídas e saldo para cada membro da família."
                    icon={<Users size={24} className="text-emerald-500" />}
                    onExport={generateMemberSummary}
                />
                <ReportCard
                    title="Balanço Consolidado"
                    desc="Visão geral financeira completa: Receitas vs Despesas vs Reservas."
                    icon={<Wallet size={24} className="text-blue-500" />}
                    onExport={generateConsolidatedFinance}
                />
            </div>
        </div>
    );
};

const ReportCard = ({ title, desc, icon, onExport }: { title: string, desc: string, icon: React.ReactNode, onExport: (format: 'a4' | 'mobile') => void }) => (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm hover:border-blue-200 dark:hover:border-blue-900 transition-all flex flex-col justify-between group">
        <div>
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-lg font-black uppercase dark:text-white leading-tight mb-3">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{desc}</p>
        </div>

        <div className="mt-8 pt-8 border-t dark:border-slate-800 flex gap-3">
            <button
                onClick={() => onExport('a4')}
                title="Exportar para formato A4"
                className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
                <Printer size={16} weight="bold" /> Formato A4
            </button>
            <button
                onClick={() => onExport('mobile')}
                title="Exportar para formato Mobile"
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
            >
                <DeviceMobile size={16} weight="bold" /> Mobile
            </button>
        </div>
    </div>
);
