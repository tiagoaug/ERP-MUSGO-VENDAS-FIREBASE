import React, { useState, useEffect, useRef } from 'react';
import { Customer, Supplier, Sale, Purchase, AppColor, AppUnit, AppGrid, GridDistribution, Transaction, Category, PersonalTransaction, PersonalCategory } from '../types';
// ClientesView e FornecedoresView removidos pois agora são top-level
import {
    Users, Basket, Palette, Plus, Trash, SquaresFour,
    FloppyDisk, X, SlidersHorizontal, Cube, PencilSimple, CheckCircle,
    ArrowRight, CaretRight, GearSix, CursorClick, Check,
    Bank, ArrowClockwise, Tag
} from '@phosphor-icons/react';

// Lucide compat aliases
const ShoppingBasket = Basket;
const Trash2 = Trash;
const LayoutGrid = SquaresFour;
const Save = FloppyDisk;
const Settings2 = SlidersHorizontal;
const Box = Cube;
const Boxes = Cube;
const Pencil = PencilSimple;
const CheckCircle2 = CheckCircle;
const ChevronRight = CaretRight;
const Settings = GearSix;
const MousePointerClick = CursorClick;
const Landmark = Bank;
const RefreshCw = ArrowClockwise;
import { IconButton } from '../components/ui/IconButton';
import { Field } from '../components/ui/Field';
import { sanitizeNum, generateId, formatMoney, formatDate } from '../lib/utils';

interface CadastrosViewProps {
    customers: Customer[];
    suppliers: Supplier[];
    colors: AppColor[];
    units: AppUnit[];
    grids: AppGrid[];
    categories: Category[]; // Changed from ExpenseCategory
    personalCategories: PersonalCategory[]; // Added
    sales: Sale[];
    purchases: Purchase[];
    transactions: Transaction[];
    actions: {
        addCustomer: (c: any) => void;
        updateCustomer: (c: any) => void;
        deleteCustomer: (id: string) => void;
        addSupplier: (s: any) => void;
        deleteSupplier: (id: string) => void;
        addColor: (c: any) => void;
        updateColor: (c: AppColor) => void;
        deleteColor: (id: string) => void;
        addUnit: (u: any) => void;
        updateUnit: (u: AppUnit) => void;
        deleteUnit: (id: string) => void;
        addGrid: (s: any) => void;
        updateGrid: (s: AppGrid) => void;
        deleteGrid: (id: string) => void;
        addTransaction: (t: Omit<Transaction, 'id'>) => void;
        deleteTransaction: (id: string) => void;
        clearManualTransactions: () => void;
        addExpenseCategory: (c: any) => void;
        updateExpenseCategory: (c: Category) => void; // Changed from ExpenseCategory
        deleteExpenseCategory: (id: string) => void;
        addPersonalTransaction: (t: Omit<PersonalTransaction, 'id'>) => Promise<void>; // Changed type
    };
    personalBalance: number;
}

export const CadastrosView = ({ customers, suppliers, colors, units, grids, categories, personalCategories, sales, purchases, transactions, actions, personalBalance }: CadastrosViewProps) => {
    const [activeTab, setActiveTab] = useState<'capital' | 'cores' | 'grades' | 'categorias'>('capital');

    return (
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 animate-fadeIn pb-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4 px-2">
                <div>
                    <h2 className="text-xl md:text-2xl font-black uppercase text-slate-800 dark:text-white tracking-tight text-center md:text-left">Central de Cadastros</h2>
                    <p className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400 tracking-widest text-center md:text-left">Configurações Base do Sistema</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5 md:gap-2 bg-white dark:bg-slate-900 p-1.5 md:p-2 rounded-3xl md:rounded-[2rem] shadow-sm border dark:border-slate-800 mx-2">
                <TabButton
                    active={activeTab === 'capital'}
                    onClick={() => setActiveTab('capital')}
                    icon={<Landmark size={14} />}
                    label="Capital"
                    labelFull="Capital Inicial"
                    color="bg-indigo-600 text-white"
                />
                <TabButton
                    active={activeTab === 'grades'}
                    onClick={() => setActiveTab('grades')}
                    icon={<LayoutGrid size={14} />}
                    label="Grades"
                    labelFull="Grades & Padrões"
                    color="bg-orange-600 text-white"
                />
                <TabButton
                    active={activeTab === 'cores'}
                    onClick={() => setActiveTab('cores')}
                    icon={<Palette size={14} />}
                    label="Cores"
                    color="bg-purple-600 text-white"
                />
                <TabButton
                    active={activeTab === 'categorias'}
                    onClick={() => setActiveTab('categorias')}
                    icon={<Tag size={14} />}
                    label="Categorias"
                    color="bg-rose-500 text-white"
                />
            </div>

            <div className="min-h-[500px] px-2">
                {activeTab === 'capital' && (
                    <CapitalManager
                        transactions={transactions}
                        onAdd={actions.addTransaction}
                        onDelete={actions.deleteTransaction}
                        onClearAll={actions.clearManualTransactions}
                        personalBalance={personalBalance}
                        onAddPersonal={actions.addPersonalTransaction}
                        personalCategories={personalCategories} // Passed personalCategories
                    />
                )}
                {activeTab === 'cores' && (
                    <SimpleDbView
                        title="Cores do Sistema"
                        subtitle="Padronização de Variações"
                        items={colors}
                        onAdd={actions.addColor}
                        onUpdate={actions.updateColor}
                        onDelete={actions.deleteColor}
                        placeholder="Ex: Branco Neve"
                        type="color"
                    />
                )}
                {activeTab === 'grades' && (
                    <GradesManager
                        grids={grids}
                        onAdd={actions.addGrid}
                        onUpdate={actions.updateGrid}
                        onDelete={actions.deleteGrid}
                    />
                )}
                {activeTab === 'categorias' && (
                    <SimpleDbView
                        title="Categorias de Despesas"
                        subtitle="Controle de Gastos Gerais"
                        items={categories}
                        onAdd={actions.addExpenseCategory}
                        onUpdate={actions.updateExpenseCategory}
                        onDelete={actions.deleteExpenseCategory}
                        placeholder="Ex: Aluguel, Frete, Energia..."
                        type="category"
                        icon={<Tag size={14} className="md:size-18 text-rose-500" />}
                    />
                )}
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label, labelFull, color }: any) => (
    <button
        onClick={onClick}
        className={`flex-1 min-w-[70px] md:min-w-[140px] flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2.5 md:py-4 rounded-xl md:rounded-2xl transition-all font-black text-[8px] md:text-[10px] uppercase ${active ? color + ' shadow-lg scale-[1.02]' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
    >
        {icon} <span className="hidden md:inline">{labelFull || label}</span>
        <span className="md:hidden">{label}</span>
    </button>
);

const CapitalManager = ({ transactions, onAdd, onDelete, onClearAll, personalBalance, onAddPersonal, personalCategories }: { transactions: Transaction[], onAdd: (t: Omit<Transaction, 'id'>) => void, onDelete: (id: string) => void, onClearAll: () => void, personalBalance: number, onAddPersonal: (t: any) => Promise<void>, personalCategories: PersonalCategory[] }) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [desc, setDesc] = useState('Capital Inicial');
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'all', id?: string } | null>(null);

    // Filtra transações manuais (sem relatedId e com descrição relevante ou tipo ajuste/pagamento manual)
    const capitalTransactions = transactions.filter(t => !t.relatedId);

    const handleAdd = () => {
        const val = sanitizeNum(amount);
        if (val <= 0) return alert("Valor inválido");
        if (!desc.trim()) return alert("Descrição obrigatória");

        onAdd({
            date,
            amount: val,
            description: desc,
            type: 'adjustment' // Tipo ajuste para capital inicial/aportes
        });
        setAmount('');
        setDesc('Aporte de Capital');
    };

    const handleProLaboreTransfer = async () => {
        const debt = Math.abs(Math.min(0, personalBalance));
        if (debt === 0) return alert("Não há dívida pessoal negativa para abater.");

        const incomeCategory = personalCategories.find(c => c.type === 'income' && (c.name.toLowerCase().includes('pro-labore') || c.name.toLowerCase().includes('prolabore') || c.name.toLowerCase().includes('receita')));

        if (confirm(`Deseja transferir R$ ${formatMoney(debt)} para abater a dívida nas finanças pessoais?`)) {
            // 1. Registrar Saída no Financeiro da Empresa (Ajuste ou Retirada)
            onAdd({
                date: new Date().toISOString().slice(0, 10),
                amount: -debt, // Saída
                description: 'Transferência Pro-Labore (Abatimento Dívida)',
                type: 'adjustment'
            });

            // 2. Registrar Entrada nas Finanças Pessoais (Receita)
            await onAddPersonal({
                type: 'income',
                amount: debt,
                date: new Date().toISOString().slice(0, 10),
                description: 'Pro-Labore (Recebido da Empresa)',
                isPaid: true,
                categoryId: incomeCategory?.id
            });

            alert("Transferência realizada com sucesso!");
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn"
                    onClick={() => setDeleteTarget(null)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 w-full max-w-sm p-6 rounded-[2rem] shadow-2xl border-2 border-rose-100 dark:border-rose-900/30 flex flex-col items-center text-center animate-slideUp"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <Trash2 size={28} />
                        </div>
                        <h4 className="text-sm font-black uppercase text-slate-800 dark:text-white mb-2">
                            {deleteTarget.type === 'all' ? 'Limpar Todo o Histórico?' : 'Excluir Aporte?'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-6 leading-relaxed max-w-[250px]">
                            {deleteTarget.type === 'all'
                                ? 'Essa ação removerá permanentemente todos os registros manuais de capital. Não pode ser desfeita.'
                                : 'Esse registro será removido permanentemente do saldo.'}
                        </p>

                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (deleteTarget.type === 'all') onClearAll();
                                    else if (deleteTarget.id) onDelete(deleteTarget.id);
                                    setDeleteTarget(null);
                                }}
                                className="flex-1 py-3.5 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all"
                            >
                                Confirmar Exclusão
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] shadow-sm border-2 border-indigo-50 dark:border-indigo-900/20 text-center">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Landmark size={32} />
                </div>
                <h3 className="text-xl font-black uppercase text-slate-800 dark:text-white leading-none mb-2">Capital Inicial & Aportes</h3>
                <p className="text-[10px] font-bold uppercase text-slate-400 max-w-md mx-auto leading-relaxed">
                    Defina o valor inicial em caixa para iniciar a operação ou registre novos aportes de investimento.
                </p>

                <div className="mt-8 max-w-md mx-auto space-y-4 text-left bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border dark:border-slate-800">
                    <Field label="Valor do Aporte (R$)" value={amount} onChange={setAmount} placeholder="0.00" type="number" />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Data" value={date} onChange={setDate} type="date" />
                        <Field label="Descrição" value={desc} onChange={setDesc} placeholder="Ex: Capital Inicial" />
                    </div>
                    <button onClick={handleAdd} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">
                        Registrar Aporte
                    </button>
                </div>

                {personalBalance < 0 && (
                    <div className="mt-6 p-6 bg-rose-50 dark:bg-rose-900/10 border-2 border-rose-100 dark:border-rose-900/30 rounded-3xl animate-pulse">
                        <div className="flex items-center gap-3 mb-2">
                            <ArrowRight size={20} className="text-rose-600 rotate-90" />
                            <h4 className="text-xs font-black uppercase text-rose-800 dark:text-rose-200">Abatimento de Dívida Pessoal</h4>
                        </div>
                        <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase leading-relaxed mb-4">
                            Existe um saldo negativo de <span className="font-black text-rose-700 dark:text-rose-300">R$ {formatMoney(Math.abs(personalBalance))}</span> em suas finanças pessoais.
                        </p>
                        <button
                            onClick={handleProLaboreTransfer}
                            className="w-full py-3 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all"
                        >
                            Abater Dívida via Pro-Labore
                        </button>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center px-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Histórico de Aportes</h4>
                    {capitalTransactions.length > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'all' }); }}
                            className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
                        >
                            <Trash2 size={12} /> Limpar Tudo
                        </button>
                    )}
                </div>
                {capitalTransactions.length === 0 ? (
                    <div className="text-center py-10 opacity-40">
                        <p className="text-[9px] font-black uppercase tracking-widest">Nenhum capital registrado.</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {capitalTransactions.map(t => (
                            <div key={t.id} className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                        <Landmark size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase dark:text-white">{t.description}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">{formatDate(t.date)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <p className="text-sm font-black text-emerald-600">+ R$ {formatMoney(t.amount)}</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'single', id: t.id }); }}
                                        className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"
                                        title="Exclusão Permanente"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const EditGridModal = ({ grid, onClose, onUpdate }: { grid: AppGrid, onClose: () => void, onUpdate: (g: AppGrid) => void }) => {
    const [name, setName] = useState(grid.name);
    const [sizes, setSizes] = useState<string[]>(grid.sizes);
    const [newSize, setNewSize] = useState('');

    const handleAddSize = () => {
        if (newSize.trim()) {
            setSizes([...sizes, newSize.trim()]);
            setNewSize('');
        }
    };

    const handleSave = () => {
        onUpdate({ ...grid, name, sizes });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl p-6 border-2 border-slate-100 dark:border-slate-800 animate-slideUp">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white">Editar Grade</h3>
                    <button onClick={onClose} aria-label="Fechar" title="Fechar"><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
                </div>

                <div className="space-y-4">
                    <Field label="Nome da Grade" value={name} onChange={setName} />

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Gerenciar Tamanhos</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {sizes.map((s, i) => (
                                <div key={i} className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 dark:text-white">
                                    {s}
                                    <button onClick={() => setSizes(sizes.filter((_, idx) => idx !== i))} aria-label="Remover tamanho" title="Remover" className="text-rose-500"><X size={12} /></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newSize}
                                onChange={e => setNewSize(e.target.value)}
                                placeholder="Novo tam..."
                                className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-black uppercase outline-none focus:border-blue-500 dark:text-white"
                            />
                            <button onClick={handleAddSize} aria-label="Adicionar tamanho" title="Adicionar" className="px-4 bg-emerald-500 text-white rounded-xl"><Plus size={16} /></button>
                        </div>
                    </div>

                    <button onClick={handleSave} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all">
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

const PatternForm = ({ grid, onSave }: { grid: AppGrid, onSave: (dist: GridDistribution) => void }) => {
    const [name, setName] = useState('');
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    useEffect(() => {
        // Initialize quantities with 0 for all sizes
        const init: Record<string, number> = {};
        grid.sizes.forEach(s => init[s] = 0);
        setQuantities(init);
    }, [grid]);

    const handleChange = (size: string, val: string) => {
        const num = parseInt(val.replace(/\D/g, '') || '0');
        setQuantities(prev => ({ ...prev, [size]: num }));
    };

    const handleSave = () => {
        if (!name.trim()) return alert("Nome do padrão é obrigatório");
        if (Object.values(quantities).every(q => q === 0)) return alert("Defina pelo menos uma quantidade.");

        onSave({
            id: generateId(),
            name,
            quantities
        });
        setName('');
        const init: Record<string, number> = {};
        grid.sizes.forEach(s => init[s] = 0);
        setQuantities(init);
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 rounded-[2rem] border-2 border-indigo-100 dark:border-indigo-900/30 space-y-4">
            <Field label="Nome do Padrão (Ex: 12 Pares)" value={name} onChange={setName} placeholder="Nome do padrão..." />

            <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Distribuição por Tamanho</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {grid.sizes.map(size => (
                        <div key={size} className="bg-white dark:bg-slate-800 p-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 text-center">
                            <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">{size}</span>
                            <input
                                type="text" inputMode="numeric"
                                value={quantities[size] || 0}
                                onChange={e => handleChange(size, e.target.value)}
                                aria-label={`Quantidade para tamanho ${size}`}
                                title={`Quantity for size ${size}`}
                                className="w-full text-center font-black text-sm bg-transparent outline-none text-indigo-600 dark:text-indigo-400"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <button onClick={handleSave} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Plus size={14} /> Adicionar Padrão
            </button>
        </div>
    );
};

const GradesManager = ({ grids, onAdd, onUpdate, onDelete }: { grids: AppGrid[], onAdd: (g: any) => void, onUpdate: (g: AppGrid) => void, onDelete: (id: string) => void }) => {
    const [name, setName] = useState('');
    const [tempSize, setTempSize] = useState('');
    const [sizes, setSizes] = useState<string[]>([]);
    const [selectedGridId, setSelectedGridId] = useState<string | null>(null);
    const [gridToEdit, setGridToEdit] = useState<AppGrid | null>(null);

    const workspaceRef = useRef<HTMLDivElement>(null);

    const activeGrid = grids.find(g => g.id === selectedGridId);

    const handleAddSize = () => {
        if (!tempSize.trim()) return;
        setSizes([...sizes, tempSize.trim()]);
        setTempSize('');
    };

    const handleSaveGrid = () => {
        if (!name.trim()) return alert("Dê um nome para a grade!");
        if (sizes.length === 0) return alert("Adicione pelo menos uma numeração.");
        onAdd({ name, sizes, distributions: [] });
        setName(''); setSizes([]); setTempSize('');
    };

    const handleSelectGrid = (id: string) => {
        setSelectedGridId(id);
        setTimeout(() => {
            workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            {gridToEdit && (
                <EditGridModal
                    grid={gridToEdit}
                    onClose={() => setGridToEdit(null)}
                    onUpdate={onUpdate}
                />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* COLUNA 1: DEFINIÇÃO DE GRADES */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border-2 border-orange-100 dark:border-orange-900/20 space-y-4 md:space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 md:p-3 bg-orange-600 text-white rounded-xl md:rounded-2xl shadow-lg shadow-orange-600/20">
                                <LayoutGrid size={20} />
                            </div>
                            <div>
                                <h3 className="text-xs md:text-sm font-black uppercase text-slate-800 dark:text-white leading-tight">Estrutura de Grades</h3>
                                <p className="text-[8px] md:text-[9px] font-bold uppercase text-slate-400">Tamanhos base</p>
                            </div>
                        </div>

                        <div className="space-y-3 md:space-y-4">
                            <Field label="Nome da Nova Grade" value={name} onChange={setName} placeholder="Ex: Masculino Adulto" />
                            <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest pl-1">Inserir Numerações</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text" value={tempSize} onChange={e => setTempSize(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddSize()}
                                        placeholder="Ex: 38"
                                        aria-label="Novo tamanho"
                                        title="Novo tamanho"
                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-black uppercase outline-none focus:border-orange-500 transition-all dark:text-white"
                                    />
                                    <button onClick={handleAddSize} aria-label="Adicionar tamanho" title="Adicionar" className="px-4 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl font-black hover:bg-orange-200 transition-colors">
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>

                            {sizes.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 p-3 bg-orange-50/50 dark:bg-orange-900/10 rounded-2xl border-2 border-dashed border-orange-200 dark:border-orange-800">
                                    {sizes.map((s, i) => (
                                        <div key={i} className="bg-white dark:bg-slate-800 border-2 border-orange-100 dark:border-orange-800 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 shadow-sm dark:text-white">
                                            {s}
                                            <button onClick={() => setSizes(sizes.filter((_, idx) => idx !== i))} aria-label="Remover tamanho" title="Remover" className="text-rose-500 hover:scale-125 transition-transform"><X size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button onClick={handleSaveGrid} className="w-full py-3.5 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-orange-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                                <Save size={14} /> Criar Grade
                            </button>
                        </div>
                    </div>

                    {/* LISTA DE GRADES */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <MousePointerClick size={12} className="text-orange-500" />
                            <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Toque para configurar padrões</h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                            {grids.map(grid => (
                                <div
                                    key={grid.id}
                                    onClick={() => handleSelectGrid(grid.id)}
                                    className={`p-4 md:p-5 rounded-[2rem] md:rounded-[2.5rem] border-2 transition-all cursor-pointer group relative overflow-hidden ${selectedGridId === grid.id ? 'bg-orange-600 border-orange-600 shadow-xl shadow-orange-600/30 text-white scale-[1.02]' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-orange-300'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl transition-colors ${selectedGridId === grid.id ? 'bg-white/20' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'}`}>
                                                <LayoutGrid size={18} />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black uppercase leading-tight">{grid.name}</h4>
                                                <p className={`text-[8px] font-bold uppercase mt-0.5 ${selectedGridId === grid.id ? 'text-white/70' : 'text-slate-400'}`}>
                                                    {grid.sizes?.length || 0} Numerações
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); setGridToEdit(grid); }} aria-label="Editar grade" title="Editar" className={`p-2 rounded-xl transition-all ${selectedGridId === grid.id ? 'hover:bg-white/20 text-white' : 'hover:bg-amber-50 text-amber-500'}`}><Pencil size={12} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); confirm("Excluir?") && onDelete(grid.id); }} aria-label="Excluir grade" title="Excluir" className={`p-2 rounded-xl transition-all ${selectedGridId === grid.id ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-50 text-rose-500'}`}><Trash2 size={12} /></button>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-1">
                                        {grid.sizes?.map((s, i) => (
                                            <span key={i} className={`px-2 py-0.5 rounded-lg text-[8px] md:text-[9px] font-black ${selectedGridId === grid.id ? 'bg-white/20 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{s}</span>
                                        ))}
                                    </div>

                                    <div className={`mt-4 py-2 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all ${selectedGridId === grid.id ? 'bg-white text-orange-600 border-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 group-hover:border-orange-400 group-hover:text-orange-500'}`}>
                                        <Settings size={12} />
                                        <span className="text-[9px] font-black uppercase">Padrões ({grid.distributions?.length || 0})</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COLUNA 2: WORKSPACE DE PADRÕES */}
                <div className="lg:col-span-7" ref={workspaceRef}>
                    {activeGrid ? (
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] md:rounded-[3rem] shadow-2xl border-2 border-indigo-50 dark:border-indigo-900/20 overflow-hidden animate-slideUp">
                            <div className="p-6 md:p-8 bg-indigo-600 text-white flex justify-between items-center">
                                <div className="flex items-center gap-3 md:gap-5">
                                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white/20 rounded-2xl md:rounded-[2rem] flex items-center justify-center backdrop-blur-xl shadow-inner">
                                        <Boxes size={24} className="md:size-32" />
                                    </div>
                                    <div>
                                        <h3 className="text-base md:text-xl font-black uppercase leading-tight tracking-tight">Distribuição</h3>
                                        <p className="text-[8px] md:text-[10px] font-black uppercase opacity-70 mt-0.5 tracking-widest flex items-center gap-1.5">
                                            <LayoutGrid size={10} /> Grade: {activeGrid.name}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedGridId(null)} aria-label="Fechar workspace" title="Fechar" className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-5 md:p-8 space-y-8 md:space-y-12">
                                <div className="space-y-4 md:space-y-6">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                        <h4 className="text-[10px] md:text-[12px] font-black uppercase text-indigo-600 tracking-widest">Novo Modelo de Caixa</h4>
                                    </div>

                                    <PatternForm grid={activeGrid} onSave={(dist) => {
                                        const updatedGrid = { ...activeGrid, distributions: [...(activeGrid.distributions || []), dist] };
                                        onUpdate(updatedGrid);
                                    }} />
                                </div>

                                <div className="space-y-4 md:space-y-6">
                                    <div className="flex justify-between items-center border-b-2 border-slate-50 dark:border-slate-800 pb-3 md:pb-4">
                                        <h4 className="text-[9px] md:text-[11px] font-black uppercase text-slate-400 tracking-widest">Salvos</h4>
                                        <span className="bg-indigo-600 text-white text-[8px] md:text-[10px] font-black px-3 py-1 rounded-full uppercase">
                                            {activeGrid.distributions?.length || 0} Padrões
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                                        {activeGrid.distributions?.map(dist => (
                                            <div key={dist.id} className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 p-5 rounded-[2rem] md:rounded-[2.5rem] hover:border-indigo-400 transition-all shadow-sm group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h5 className="text-[11px] md:text-[13px] font-black uppercase text-slate-800 dark:text-white leading-tight">{dist.name}</h5>
                                                        <p className="text-[9px] font-black text-indigo-600 uppercase mt-1">Total: {Object.values(dist.quantities).reduce((a: any, b: any) => a + b, 0)} Pares</p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm("Excluir este padrão?")) {
                                                                onUpdate({ ...activeGrid, distributions: activeGrid.distributions?.filter(d => d.id !== dist.id) });
                                                            }
                                                        }}
                                                        aria-label="Excluir padrão"
                                                        title="Excluir padrão"
                                                        className="p-2 text-rose-500 bg-rose-50 dark:bg-rose-900/10 hover:bg-rose-100 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-4 gap-1.5">
                                                    {Object.entries(dist.quantities).map(([size, qty]) => (
                                                        qty > 0 && (
                                                            <div key={size} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 p-1.5 rounded-lg text-center shadow-inner">
                                                                <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">{size}</p>
                                                                <p className="text-[10px] font-black text-slate-700 dark:text-slate-200">{qty}</p>
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {(!activeGrid.distributions || activeGrid.distributions.length === 0) && (
                                        <div className="py-12 md:py-20 text-center bg-slate-50 dark:bg-slate-800/20 rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-700">
                                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                                <Boxes size={24} className="text-slate-300" />
                                            </div>
                                            <p className="text-[9px] md:text-[11px] font-black uppercase text-slate-400 tracking-widest px-4">
                                                Nenhum padrão configurado nesta grade.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 md:p-12 bg-white dark:bg-slate-900 rounded-[2rem] md:rounded-[4rem] border-2 border-dashed border-slate-200 dark:border-slate-800 opacity-60">
                            <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-50 dark:bg-slate-800 rounded-3xl md:rounded-[2.5rem] flex items-center justify-center mb-6 md:mb-8">
                                <ArrowRight size={32} className="md:size-40 text-slate-300" />
                            </div>
                            <h3 className="text-sm md:text-lg font-black uppercase text-slate-400 tracking-[0.2em] md:tracking-[0.3em]">Selecione uma Grade</h3>
                            <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase mt-2 md:mt-3 max-w-xs leading-relaxed">
                                Clique em uma grade para gerenciar padrões de atacado.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SimpleDbView = ({ title, subtitle, items, onAdd, onUpdate, onDelete, placeholder, type, icon }: any) => {
    const [input, setInput] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const handleAdd = () => {
        if (!input.trim()) return;

        // Anti-duplicidade
        const exists = items.some((i: any) => i.name.toLowerCase() === input.trim().toLowerCase());
        if (exists) return alert("Este registro já existe.");

        onAdd({ name: input });
        setInput('');
    }

    const startEditing = (item: any) => {
        setEditingId(item.id);
        setEditValue(item.name);
    }

    const handleSaveEdit = (id: string) => {
        if (!editValue.trim()) return;

        // Anti-duplicidade
        const exists = items.some((i: any) => i.id !== id && i.name.toLowerCase() === editValue.trim().toLowerCase());
        if (exists) return alert("Este nome já está em uso.");

        onUpdate({ id, name: editValue });
        setEditingId(null);
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 md:space-y-10 animate-fadeIn">
            <div className="text-center">
                <h3 className="text-xl md:text-2xl font-black uppercase text-slate-800 dark:text-white leading-none">{title}</h3>
                <p className="text-[10px] md:text-[11px] font-bold uppercase text-slate-400 tracking-[0.2em] md:tracking-[0.4em] mt-2 md:mt-3">{subtitle}</p>
            </div>

            <div className="flex gap-2 md:gap-3 bg-white dark:bg-slate-900 p-2 md:p-3.5 rounded-2xl md:rounded-[2.5rem] shadow-xl border-2 border-slate-100 dark:border-slate-800 group focus-within:border-blue-500 transition-all">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent px-4 md:px-8 text-xs md:text-sm font-black uppercase outline-none dark:text-white placeholder:text-slate-300"
                />
                <button onClick={handleAdd} className="bg-slate-900 dark:bg-blue-600 text-white px-6 md:px-12 py-3 md:py-4 rounded-xl md:rounded-[1.8rem] text-[9px] md:text-[11px] font-black uppercase shadow-2xl transition-all hover:scale-[1.03] active:scale-95 flex items-center gap-2 md:gap-3 shrink-0">
                    <Plus size={16} className="md:size-20" /> <span className="hidden xs:inline">Adicionar</span>
                </button>
            </div>

            <div className="space-y-2">
                {items && items.map((item: any) => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-3 md:p-4 rounded-2xl flex justify-between items-center group shadow-sm hover:border-blue-400 transition-all">
                        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-inner">
                                {icon || <Palette size={14} className="md:size-18 text-purple-600" />}
                            </div>

                            {editingId === item.id ? (
                                <div className="flex gap-2 flex-1">
                                    <input
                                        type="text"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit(item.id)}
                                        autoFocus
                                        aria-label={`Editar ${item.name}`}
                                        title={`Editar ${item.name}`}
                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-blue-500 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase outline-none"
                                    />
                                    <button onClick={() => handleSaveEdit(item.id)} aria-label="Salvar" title="Salvar" className="p-2 bg-emerald-500 text-white rounded-lg"><Check size={14} /></button>
                                    <button onClick={() => setEditingId(null)} aria-label="Cancelar" title="Cancelar" className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-lg"><X size={14} /></button>
                                </div>
                            ) : (
                                <span className="text-[11px] md:text-sm font-black uppercase dark:text-white truncate">{item.name}</span>
                            )}
                        </div>

                        {editingId !== item.id && (
                            <div className="flex gap-1 shrink-0">
                                <button
                                    onClick={() => startEditing(item)}
                                    aria-label="Editar item"
                                    title="Editar"
                                    className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={() => confirm("Excluir item?") && onDelete(item.id)}
                                    aria-label="Excluir item"
                                    title="Excluir"
                                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {(!items || items.length === 0) && (
                    <div className="py-16 md:py-24 text-center opacity-30 bg-slate-50 dark:bg-slate-800/20 rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <Box size={32} className="md:size-48 mx-auto mb-3 md:mb-5 text-slate-300" />
                        <p className="text-[10px] md:text-[12px] font-black uppercase tracking-widest text-slate-400">Nenhum registro encontrado</p>
                    </div>
                )}
            </div>
        </div>
    )
}
