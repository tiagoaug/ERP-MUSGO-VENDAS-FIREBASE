
import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Customer, SaleStatus, PaymentRecord, Product, SaleItem, AppGrid } from '../types';
import { formatMoney, formatDate, sanitizeNum, generateId, formatSaleToText, formatSaleToSeparationText, formatSaleToSimpleListText, formatSaleToProductListText } from '../lib/utils'; // Refreshing module resolution
import { IconButton } from '../components/ui/IconButton';
import { exportSaleByNumberPDF, exportSeparationListPDF } from '../lib/pdfGenerator';
import { GearSix, X, Package, Truck, CheckCircle, CreditCard, Prohibit, Calendar, CurrencyDollar, Wallet, ArrowRight, User, FileText, Plus, ShoppingBag, Storefront, Cube, PencilSimple, Trash, Minus, Clock, Check, XCircle, DownloadSimple, Receipt, Warning, ArrowCircleDown, Lightning, Sparkle, Funnel, ArrowClockwise, ChartBar, ListChecks, MagnifyingGlass, CaretDown, SquaresFour, Note, Copy, ShareNetwork, Printer } from '@phosphor-icons/react';

// Lucide compat aliases
const Settings = GearSix;
const Store = Storefront;
const Boxes = Cube;
const Pencil = PencilSimple;
const Trash2 = Trash;
const Download = DownloadSimple;
const AlertTriangle = Warning;
const ArrowDownCircle = ArrowCircleDown;
const Zap = Lightning;
const PackageCheck = Package;
const PackageOpen = Package;
const Sparkles = Sparkle;
const Filter = Funnel;
const RefreshCw = ArrowClockwise;
const BarChart2 = ChartBar;
const Search = MagnifyingGlass;
const ChevronDown = CaretDown;
const CheckCircle2 = CheckCircle;
const LayoutGrid = SquaresFour;
const DollarSign = CurrencyDollar;
const Ban = Prohibit;

interface VendasHistoryViewProps {
    sales: Sale[];
    customers: Customer[];
    products: Product[];
    grids: AppGrid[];
    colors: any[];
    showMiniatures: boolean;
    onDelete: (id: string) => void;
    onUpdate: (sale: Sale) => void;
}

const getColorName = (colorId: string | undefined, colors: any[]) => {
    if (!colorId) return 'Padrão';
    const cleanId = String(colorId).trim().toLowerCase();
    const found = (colors || []).find(c =>
        String(c.id).trim().toLowerCase() === cleanId ||
        String(c.name).trim().toLowerCase() === cleanId
    );
    return found ? found.name : colorId;
};

export const VendasHistoryView = ({ sales, customers, products, grids, colors, showMiniatures, onDelete, onUpdate }: VendasHistoryViewProps) => {
    const [editingSale, setEditingSale] = React.useState<Sale | null>(null);
    const [suggestionMode, setSuggestionMode] = useState(false);
    const [suggestionStrategy, setSuggestionStrategy] = useState<'volume' | 'count' | 'value'>('volume');

    // Filtros e Ordenação
    const [searchTerm, setSearchTerm] = useState('');
    const [hiddenStatuses, setHiddenStatuses] = useState<SaleStatus[]>([]);
    const [showStatusFilters, setShowStatusFilters] = useState(false);
    const [sortField, setSortField] = useState<'date' | 'saleNumber'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [quickStatusSale, setQuickStatusSale] = useState<Sale | null>(null);
    const [separationSale, setSeparationSale] = useState<Sale | null>(null);
    const [exportPanelSaleId, setExportPanelSaleId] = useState<string | null>(null);
    const [exportObservation, setExportObservation] = useState('');

    const statuses: SaleStatus[] = ['Pendente', 'Em produção', 'Entregue', 'Cancelada', 'Aguardando Estoque', 'Aguardando Aprovação'];

    const checkStock = (sale: Sale) => {
        let isAvailable = true;
        for (const item of sale.items) {
            const product = products.find(p => p.id === item.productId);
            if (!product) { isAvailable = false; break; }
            let currentStock = 0;
            if (item.isWholesale) {
                const itemCName = getColorName(item.colorId, colors);
                currentStock = (product.wholesaleStock || [])
                    .filter(w => w.distributionId === item.distributionId && getColorName(w.colorId, colors) === itemCName)
                    .reduce((acc, curr) => acc + sanitizeNum(curr.boxes), 0);
            } else {
                const targetVar = product.variations.find(va => va.id === item.variationId);
                if (targetVar) {
                    const targetColorName = getColorName(targetVar.colorId, colors);
                    currentStock = (product.variations || [])
                        .filter(v => v.size === targetVar.size && getColorName(v.colorId, colors) === targetColorName)
                        .reduce((acc, curr) => acc + sanitizeNum(curr.stock), 0);
                }
            }
            if (currentStock < item.quantity) {
                isAvailable = false;
                break;
            }
        }
        return isAvailable;
    };

    // Helper para contar total de itens numa venda
    const getSaleTotalItems = (s: Sale) => s.items.reduce((acc, i) => acc + i.quantity, 0);

    // Lógica Avançada de Sugestão Inteligente (Best Fit com Seleção de Estratégia)
    const suggestedData = useMemo(() => {
        if (!suggestionMode) return { ids: [], totalValue: 0, count: 0, totalItemsMoved: 0 };

        // 1. Snapshot do Estoque Inicial
        const initialStockRetail: Record<string, number> = {};
        const initialStockWholesale: Record<string, number> = {};

        products.forEach(p => {
            p.variations.forEach(v => { initialStockRetail[v.id] = v.stock; });
            p.wholesaleStock.forEach(ws => { initialStockWholesale[`${ws.distributionId}-${ws.colorId}`] = ws.boxes; });
        });

        const pendingSales = sales.filter(s => s.status === 'Aguardando Estoque' || s.status === 'Aguardando Aprovação');

        // Função de Simulação
        const runSimulation = (sortedSales: Sale[]) => {
            const tempStockR = { ...initialStockRetail };
            const tempStockW = { ...initialStockWholesale };

            const resultIds: string[] = [];
            let resultValue = 0;
            let resultItems = 0;

            for (const sale of sortedSales) {
                let canFulfill = true;

                for (const item of sale.items) {
                    if (item.isWholesale) {
                        const key = `${item.distributionId}-${item.colorId}`;
                        if ((tempStockW[key] || 0) < item.quantity) { canFulfill = false; break; }
                    } else {
                        const key = item.variationId || '';
                        if ((tempStockR[key] || 0) < item.quantity) { canFulfill = false; break; }
                    }
                }

                if (canFulfill) {
                    resultIds.push(sale.id);
                    resultValue += sale.totalValue;
                    resultItems += getSaleTotalItems(sale);

                    // Baixa no estoque temporário
                    for (const item of sale.items) {
                        if (item.isWholesale) {
                            tempStockW[`${item.distributionId}-${item.colorId}`] -= item.quantity;
                        } else {
                            tempStockR[item.variationId || ''] -= item.quantity;
                        }
                    }
                }
            }
            return { ids: resultIds, totalValue: resultValue, count: resultIds.length, totalItemsMoved: resultItems };
        };

        // 2. Ordenação Baseada na Escolha do Operador
        let salesToSort = [...pendingSales];

        if (suggestionStrategy === 'volume') {
            // Maior Volume: Prioriza pedidos grandes primeiro para mover mais caixas
            salesToSort.sort((a, b) => getSaleTotalItems(b) - getSaleTotalItems(a));
        } else if (suggestionStrategy === 'count') {
            // Maior Nº Pedidos: Prioriza pedidos pequenos (encaixa mais gente)
            salesToSort.sort((a, b) => getSaleTotalItems(a) - getSaleTotalItems(b));
        } else {
            // Maior Valor: Prioriza financeiro
            salesToSort.sort((a, b) => b.totalValue - a.totalValue);
        }

        // 3. Executa a simulação baseada na ordenação escolhida
        return runSimulation(salesToSort);

    }, [suggestionMode, sales, products, suggestionStrategy]);

    const displayedSales = useMemo(() => {
        let list: Sale[];
        if (suggestionMode) {
            const suggested = sales.filter(s => suggestedData.ids.includes(s.id));
            const others = sales.filter(s => !suggestedData.ids.includes(s.id));
            suggested.sort((a, b) => b.totalValue - a.totalValue);
            list = [...suggested, ...others];
        } else {
            list = [...sales];
        }

        // Filtro por Ocultação de Status
        if (hiddenStatuses.length > 0) {
            list = list.filter(s => !hiddenStatuses.some(h => h.trim() === s.status.trim()));
        }

        // Filtro Unificado (Número ou Cliente)
        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            list = list.filter(s => {
                const cust = customers.find(c => c.id === s.customerId);
                return (s.saleNumber?.toLowerCase().includes(q)) || (cust?.name.toLowerCase().includes(q));
            });
        }

        // Ordenação
        if (!suggestionMode) {
            list.sort((a, b) => {
                let valA: string | number;
                let valB: string | number;
                if (sortField === 'date') {
                    valA = a.date || '';
                    valB = b.date || '';
                } else {
                    valA = a.saleNumber || '';
                    valB = b.saleNumber || '';
                }
                if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return list;
    }, [sales, suggestionMode, suggestedData, searchTerm, hiddenStatuses, sortField, sortOrder]);


    return (
        <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn px-2 pb-20">
            {editingSale && (
                <SaleEditModal
                    isOpen={!!editingSale}
                    sale={editingSale}
                    products={products}
                    grids={grids}
                    colors={colors}
                    showMiniatures={showMiniatures}
                    customer={customers.find(c => c.id === editingSale.customerId)}
                    onClose={() => setEditingSale(null)}
                    onSave={(updated: Sale) => { onUpdate(updated); setEditingSale(null); }}
                    onDelete={() => { if (confirm("EXCLUIR permanentemente?")) { onDelete(editingSale.id); setEditingSale(null); } }}
                />
            )}

            {/* MODAL DE TROCA RÁPIDA DE STATUS */}
            {quickStatusSale && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-[320px] rounded-[2.5rem] shadow-2xl border-2 dark:border-slate-800 overflow-hidden flex flex-col animate-slideUp">
                        <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Alterar Status</span>
                            <button onClick={() => setQuickStatusSale(null)} title="Fechar" aria-label="Fechar" className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><X size={18} /></button>
                        </div>
                        <div className="p-3 grid grid-cols-1 gap-1.5 overflow-y-auto max-h-[60vh] custom-scrollbar">
                            {statuses
                                .filter(st => {
                                    // Se já estiver pago/aprovado, remove opções de aguardando
                                    if (quickStatusSale.isPaid || quickStatusSale.amountPaid > 0) {
                                        return !['Aguardando Estoque', 'Aguardando Aprovação'].includes(st);
                                    }
                                    return true;
                                })
                                .map(st => (
                                    <button
                                        key={st}
                                        onClick={() => {
                                            onUpdate({ ...quickStatusSale, status: st });
                                            setQuickStatusSale(null);
                                        }}
                                        className={`text-left px-4 py-3.5 rounded-2xl text-[10px] font-black uppercase transition-all ${quickStatusSale.status === st ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    >
                                        {st}
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black uppercase dark:text-white tracking-tight">Registro de Vendas</h2>
                    <div className="h-1.5 w-16 bg-blue-600 rounded-full mt-2 shadow-lg shadow-blue-600/20"></div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.open('https://keep.google.com', '_blank')}
                        title="Abrir Google Keep" aria-label="Abrir Google Keep"
                        className="flex items-center gap-2 px-5 py-3 rounded-[1.5rem] text-[10px] font-black uppercase transition-all shadow-lg bg-amber-400 text-slate-900 hover:bg-amber-500 dark:bg-amber-500/20 dark:text-amber-400 dark:border dark:border-amber-500/30 dark:hover:bg-amber-500/30"
                    >
                        <Note size={16} weight="fill" />
                        <span className="hidden sm:inline">Google Keep</span>
                    </button>
                    <button
                        onClick={() => setSuggestionMode(!suggestionMode)}
                        title={suggestionMode ? 'Desativar Modo Sugestão' : 'Ativar Modo Sugestão'} aria-label={suggestionMode ? 'Desativar Modo Sugestão' : 'Ativar Modo Sugestão'}
                        className={`flex items-center gap-2 px-5 py-3 rounded-[1.5rem] text-[10px] font-black uppercase transition-all shadow-lg ${suggestionMode ? 'bg-indigo-600 text-white shadow-indigo-600/30 scale-105 ring-2 ring-indigo-200 dark:ring-indigo-900' : 'bg-white dark:bg-slate-800 text-slate-500 border dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        {suggestionMode ? <Sparkles size={16} className="animate-pulse text-yellow-300" /> : <Sparkles size={16} />}
                        {suggestionMode ? 'Modo Sugestão Ativo' : 'Sugestão Inteligente'}
                    </button>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            {!suggestionMode && (
                <div className="space-y-3 mb-4">
                    <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[1.5rem] shadow-sm animate-fadeIn">
                        <div className="relative flex-1 min-w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Buscar por Nº pedido ou Nome do cliente..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                title="Buscar vendas"
                                aria-label="Buscar vendas"
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-[10px] font-black uppercase outline-none focus:border-blue-500 transition-colors dark:text-white"
                            />
                        </div>
                    </div>

                    {/* OCULTAÇÃO DE STATUS (ACORDEÃO) */}
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl overflow-hidden animate-fadeIn">
                        <button
                            onClick={() => setShowStatusFilters(!showStatusFilters)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Filter size={16} className={hiddenStatuses.length > 0 ? 'text-rose-500' : 'text-slate-400'} />
                                <span className="text-[10px] font-black uppercase text-slate-500">Ocultar pedidos por status</span>
                                {hiddenStatuses.length > 0 && (
                                    <span className="bg-rose-100 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded-md">
                                        {hiddenStatuses.length}
                                    </span>
                                )}
                            </div>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${showStatusFilters ? 'rotate-180' : ''}`} />
                        </button>

                        <div className={`transition-all duration-300 ease-in-out ${showStatusFilters ? 'max-h-48 opacity-100 p-4 pt-0' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                            <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 custom-scrollbar border-t dark:border-slate-800 pt-4">
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
                                            className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase transition-all border whitespace-nowrap ${isHidden ? 'bg-rose-50 text-rose-500 border-rose-200 shadow-sm shadow-rose-100' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700 hover:border-blue-300'}`}
                                        >
                                            {st}
                                        </button>
                                    );
                                })}
                                {hiddenStatuses.length > 0 && (
                                    <button
                                        onClick={() => setHiddenStatuses([])}
                                        className="text-[8px] font-black uppercase text-blue-500 hover:underline px-2 ml-auto"
                                    >
                                        Limpar todos
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {suggestionMode && (
                <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/40 dark:to-slate-900 border-2 border-indigo-100 dark:border-indigo-800 p-5 rounded-[2.5rem] flex flex-col gap-4 animate-slideUp shadow-xl shadow-indigo-100 dark:shadow-none mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                    <div className="flex items-center justify-between gap-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20">
                                <Zap size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-black uppercase text-indigo-800 dark:text-indigo-300 tracking-tight">Otimização de Estoque</h4>
                                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-0.5 truncate">
                                    {suggestedData.count} pedidos selecionados.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Potencial Real</p>
                            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">R$ {formatMoney(suggestedData.totalValue)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 bg-white/50 dark:bg-slate-800/50 p-1 rounded-[1.2rem] border border-indigo-100 dark:border-slate-700">
                        <button
                            onClick={() => setSuggestionStrategy('volume')}
                            title="Filtrar por Máximo Volume" aria-label="Filtrar por Máximo Volume"
                            className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all ${suggestionStrategy === 'volume' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
                        >
                            <PackageOpen size={14} className="mb-0.5" />
                            <span className="text-[7px] font-black uppercase">Max. Volume</span>
                        </button>
                        <button
                            onClick={() => setSuggestionStrategy('count')}
                            title="Filtrar por Máximo de Pedidos" aria-label="Filtrar por Máximo de Pedidos"
                            className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all ${suggestionStrategy === 'count' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
                        >
                            <ListChecks size={14} className="mb-0.5" />
                            <span className="text-[7px] font-black uppercase">Max. Pedidos</span>
                        </button>
                        <button
                            onClick={() => setSuggestionStrategy('value')}
                            title="Filtrar por Faturamento" aria-label="Filtrar por Faturamento"
                            className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all ${suggestionStrategy === 'value' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}
                        >
                            <DollarSign size={14} className="mb-0.5" />
                            <span className="text-[7px] font-black uppercase">Faturamento</span>
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {displayedSales.map(s => {
                    const customer = customers.find(c => c.id === s.customerId);
                    const remaining = s.totalValue - (s.amountPaid || 0);

                    const isStockReady = checkStock(s);
                    const isWaiting = s.status === 'Aguardando Aprovação' || s.status === 'Aguardando Estoque';
                    const canReleaseNow = isWaiting && isStockReady;

                    const isSuggested = suggestionMode && suggestedData.ids.includes(s.id);
                    const isDimmed = suggestionMode && !isSuggested;

                    let statusColor = 'bg-blue-600 text-white';
                    if (s.status === 'Aguardando Aprovação') statusColor = 'bg-amber-100 text-amber-600';
                    else if (s.status === 'Aguardando Estoque') statusColor = 'bg-orange-100 text-orange-600';
                    else if (s.status === 'Pendente' || s.status === 'Em produção') statusColor = 'bg-orange-500 text-white';
                    else if (s.status === 'Entregue') statusColor = 'bg-emerald-500 text-white';
                    else if (s.status === 'Cancelada') statusColor = 'bg-rose-500 text-white';

                    return (
                        <div key={s.id} onClick={() => setEditingSale(s)} className={`bg-white dark:bg-slate-900 rounded-[2rem] border-2 transition-all cursor-pointer group shadow-sm relative overflow-hidden duration-500 ${isSuggested ? 'border-indigo-500 shadow-2xl shadow-indigo-200 dark:shadow-indigo-900/30 scale-[1.02] z-10 my-4' : (isDimmed ? 'opacity-40 grayscale border-slate-100 dark:border-slate-800 scale-95' : (canReleaseNow ? 'border-emerald-400 shadow-emerald-100 dark:shadow-none bg-emerald-50/10' : (isWaiting ? 'border-amber-400 bg-amber-50/20' : (s.status === 'Cancelada' ? 'opacity-50 grayscale border-slate-100' : 'dark:border-slate-800 hover:border-blue-500 hover:shadow-lg'))))}`}>

                            {/* FAIXA DE STATUS (PAGAMENTO / CANCELADO) */}
                            {s.status === 'Cancelada' ? (
                                <div className="bg-rose-600 text-white text-[10px] font-black uppercase text-center py-1.5 tracking-widest flex items-center justify-center gap-2">
                                    <Prohibit size={12} weight="bold" /> PEDIDO CANCELADO
                                </div>
                            ) : (
                                <div className={`text-white text-[10px] font-black uppercase text-center py-1.5 tracking-widest flex items-center justify-center gap-2 ${s.isPaid || s.amountPaid >= s.totalValue ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                                    {s.isPaid || s.amountPaid >= s.totalValue ? (
                                        <><CheckCircle size={12} weight="bold" /> QUITADO</>
                                    ) : (
                                        <><Clock size={12} weight="bold" /> PENDENTE DE PAGAMENTO</>
                                    )}
                                </div>
                            )}

                            {isSuggested && (
                                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest flex items-center gap-1.5 shadow-lg z-20">
                                    <Sparkles size={12} className="animate-pulse text-yellow-300" /> Sugerido
                                </div>
                            )}

                            <div className="p-5 flex justify-between items-center gap-4">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center font-black text-sm shrink-0 shadow-md transition-transform group-hover:scale-110 ${isSuggested ? 'bg-indigo-600 text-white' : (canReleaseNow ? 'bg-emerald-100 text-emerald-600' : statusColor)}`}>
                                        {isSuggested ? <Zap size={24} /> : (canReleaseNow ? <PackageCheck size={24} /> : customer?.name.charAt(0))}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-black dark:text-white uppercase leading-tight line-clamp-2 mb-1">
                                            {customer?.name || 'Cliente Geral'}
                                        </p>

                                        <div className="flex flex-col gap-1.5 mt-1.5">
                                            {isSuggested && <div className="self-start bg-indigo-100 text-indigo-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">Prioridade</div>}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[10px] text-blue-500 font-black uppercase">{s.saleNumber}</span>
                                                <span className="text-[10px] text-slate-400 font-bold">• {formatDate(s.date)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    {isWaiting ? (
                                        <div className="flex flex-col items-end">
                                            <p className="text-sm font-black text-amber-600 leading-none">R$ {formatMoney(s.totalValue)}</p>
                                            {s.discount && s.discount > 0 && (
                                                <p className="text-[8px] font-black text-amber-500 uppercase mt-0.5">DESC: R$ {formatMoney(s.discount)}</p>
                                            )}
                                        </div>
                                    ) : s.isPaid ? (
                                        <div className="flex flex-col items-end">
                                            <p className="text-sm font-black text-emerald-600 leading-none">R$ {formatMoney(s.totalValue)}</p>
                                            {s.discount && s.discount > 0 && (
                                                <p className="text-[8px] font-black text-emerald-500 uppercase mt-0.5">DESC: R$ {formatMoney(s.discount)}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end">
                                            <p className={`text-sm font-black leading-none ${s.status === 'Cancelada' ? 'text-slate-400 line-through' : 'text-rose-600'}`}>R$ {formatMoney(remaining)}</p>
                                            {s.discount && s.discount > 0 && (
                                                <p className="text-[8px] font-black text-rose-500 uppercase mt-0.5">DESC: R$ {formatMoney(s.discount)}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className={`mt-2.5 px-3 py-1 rounded-full text-[8px] font-black uppercase inline-flex items-center gap-1.5 shadow-sm max-w-full justify-end ${isSuggested ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' : (canReleaseNow ? 'bg-emerald-500 text-white' : statusColor)}`}>
                                        {isSuggested ? (
                                            <>Combinável no Estoque</>
                                        ) : canReleaseNow ? (
                                            <>Estoque Disponível</>
                                        ) : (
                                            <>
                                                {isWaiting && <Clock size={10} className="shrink-0" />}
                                                <span className="truncate">{s.status}</span>
                                            </>
                                        )}
                                    </div>

                                    {/* BOTÕES DE AÇÃO LATERAIS */}
                                    <div className="mt-2 flex flex-col items-end gap-1.5">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (exportPanelSaleId !== s.id) setExportObservation('');
                                                setExportPanelSaleId(exportPanelSaleId === s.id ? null : s.id);
                                            }}
                                            className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase border border-indigo-100 dark:border-indigo-800 shadow-sm w-full max-w-[140px]"
                                            title="Opções de Exportação"
                                            aria-label="Opções de Exportação"
                                        >
                                            <ShareNetwork size={14} /> Exportar
                                        </button>

                                        {s.status !== 'Cancelada' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setQuickStatusSale(s);
                                                }}
                                                className="p-2.5 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-slate-700 transition-all flex items-center gap-2 text-[9px] font-black uppercase ml-auto border border-blue-100 dark:border-slate-700 shadow-sm"
                                            >
                                                <Settings size={14} /> Alterar Status
                                            </button>
                                        )}

                                        {(() => {
                                            const isBlocked = (s.status === 'Entregue' && s.isPaid) || s.status === 'Cancelada';
                                            return (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isBlocked) return;
                                                        if (confirm(`DESEJA CANCELAR O PEDIDO ${s.saleNumber}?\n\nISSO IRÁ ESTORNAR O ESTOQUE.`)) {
                                                            onUpdate({ ...s, status: 'Cancelada' });
                                                        }
                                                    }}
                                                    className={`p-2.5 rounded-xl transition-all flex items-center gap-2 text-[9px] font-black uppercase ml-auto border shadow-sm mt-1.5 ${isBlocked
                                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                                        : 'bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/20'
                                                        }`}
                                                    title={s.status === 'Cancelada' ? "PEDIDO JÁ CANCELADO" : isBlocked ? "CANCELAMENTO BLOQUEADO" : "CANCELAR PEDIDO"}
                                                    aria-label="Cancelar Pedido"
                                                    disabled={isBlocked}
                                                >
                                                    <Prohibit size={14} /> {s.status === 'Cancelada' ? 'Cancelado' : 'Cancelar'}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* PAINEL DE EXPORTAÇÃO */}
                            <div
                                className={`overflow-hidden transition-all duration-300 ease-in-out ${exportPanelSaleId === s.id ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                            >
                                <div className="px-5 pb-5 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                        <ShareNetwork size={12} /> Opções de Exportação e Compartilhamento
                                    </p>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); exportSaleByNumberPDF(s, customer, products, colors, exportObservation); setExportPanelSaleId(null); setExportObservation(''); }}
                                            className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-[1.2rem] border-2 border-slate-100 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 hover:shadow-lg hover:shadow-rose-100 dark:hover:shadow-rose-900/20 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-all group"
                                            title="Exportar Comprovante em PDF"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <FileText size={20} weight="fill" />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-wide text-center leading-tight">Exportar PDF</span>
                                        </button>

                                        <div className="flex flex-col items-center justify-center p-2 bg-white dark:bg-slate-900 rounded-[1.2rem] border-2 border-slate-100 dark:border-slate-800 focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:shadow-lg focus-within:shadow-blue-100 dark:focus-within:shadow-blue-900/20 transition-all">
                                            <textarea
                                                value={exportObservation}
                                                onChange={e => setExportObservation(e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                placeholder="Observação (PDF)"
                                                className="w-full h-full min-h-[60px] p-2 text-[8px] font-bold text-center text-slate-600 dark:text-slate-300 bg-transparent resize-none outline-none placeholder:text-slate-400 uppercase custom-scrollbar"
                                            />
                                        </div>

                                        <button
                                            onClick={(e) => { e.stopPropagation(); window.open(`https://keep.google.com/u/0/#createNote?text=${encodeURIComponent(formatSaleToText(s, customer, products, colors))}`, '_blank'); setExportPanelSaleId(null); }}
                                            className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-[1.2rem] border-2 border-slate-100 dark:border-slate-800 hover:border-yellow-400 dark:hover:border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 hover:shadow-lg hover:shadow-yellow-100 dark:hover:shadow-yellow-900/20 text-slate-600 dark:text-slate-300 hover:text-yellow-600 transition-all group"
                                            title="Exportar para Google Keep"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <Note size={20} weight="fill" />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-wide text-center leading-tight">Google Keep</span>
                                        </button>

                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSeparationSale(s); setExportPanelSaleId(null); }}
                                            className="flex flex-col items-center justify-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-[1.2rem] border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:shadow-lg hover:shadow-emerald-100 dark:hover:shadow-emerald-900/20 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-all group"
                                            title="Lista de Separação"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <ListChecks size={20} weight="fill" />
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-wide text-center leading-tight">Separação</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
                {sales.length === 0 && (
                    <div className="py-20 text-center opacity-30 flex flex-col items-center">
                        <ShoppingBag size={64} className="text-slate-400 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Nenhuma venda registrada</p>
                    </div>
                )}
            </div>

            {/* MODAL DE SEPARAÇÃO */}
            {separationSale && (
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
                                        const colorName = getColorName(item.colorId, colors);
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
            )}
        </div>
    );
};

const SaleEditModal = ({ isOpen, sale, customer, products, grids, colors, showMiniatures, onClose, onSave, onDelete }: any) => {
    const [activeTab, setActiveTab] = useState<'items' | 'status' | 'approve' | 'stock'>(
        (sale.status === 'Aguardando Aprovação' ? 'approve' : (sale.status === 'Aguardando Estoque' ? 'stock' : 'items'))
    );
    const [editableSale, setEditableSale] = React.useState<Sale>(sale);
    const [approveType, setApproveType] = useState<'cash' | 'credit'>('cash');
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);

    // Verificação de Estoque Local para o Modal - Baseado no editableSale para atualizar em tempo real
    const missingItems = editableSale.items.map((item: any) => {
        let currentStock = 0;
        const product = products.find((p: any) => p.id === item.productId);
        if (product) {
            if (item.isWholesale) {
                const itemCName = getColorName(item.colorId, colors);
                currentStock = (product.wholesaleStock || [])
                    .filter((w: any) => w.distributionId === item.distributionId && getColorName(w.colorId, colors) === itemCName)
                    .reduce((acc: number, curr: any) => acc + sanitizeNum(curr.boxes), 0);
            } else {
                const targetVar = product.variations.find((va: any) => va.id === item.variationId);
                if (targetVar) {
                    const targetColorName = getColorName(targetVar.colorId, colors);
                    currentStock = (product.variations || [])
                        .filter((v: any) => v.size === targetVar.size && getColorName(v.colorId, colors) === targetColorName)
                        .reduce((acc: number, curr: any) => acc + sanitizeNum(curr.stock), 0);
                }
            }
        }
        return { ...item, currentStock, missing: Math.max(0, item.quantity - currentStock) };
    }).filter((i: any) => i.missing > 0);

    const canRelease = missingItems.length === 0;

    if (!isOpen) return null;

    const updateItemQuantity = (index: number, delta: number) => {
        const newItems = [...editableSale.items];
        const item = newItems[index];
        const product = products.find((p: any) => p.id === item.productId);

        let physicalStock = 0;
        if (product) {
            if (item.isWholesale) {
                const itemCName = getColorName(item.colorId, colors);
                physicalStock = (product.wholesaleStock || [])
                    .filter((w: any) => w.distributionId === item.distributionId && getColorName(w.colorId, colors) === itemCName)
                    .reduce((acc: number, curr: any) => acc + sanitizeNum(curr.boxes), 0);
            } else {
                const targetVar = product.variations.find((va: any) => va.id === item.variationId);
                if (targetVar) {
                    const targetColorName = getColorName(targetVar.colorId, colors);
                    physicalStock = (product.variations || [])
                        .filter((v: any) => v.size === targetVar.size && getColorName(v.colorId, colors) === targetColorName)
                        .reduce((acc: number, curr: any) => acc + sanitizeNum(curr.stock), 0);
                }
            }
        }

        // Se a venda já consumiu estoque (Status Ativo), o estoque físico já foi subtraído.
        // Então o estoque total disponível para este item é (QtdAtual + EstoqueRestante)
        const consumesStock = !['Cancelada', 'Aguardando Estoque', 'Aguardando Aprovação'].includes(editableSale.status);
        const effectiveMax = consumesStock ? (item.quantity + physicalStock) : 999999;

        const newQty = item.quantity + delta;

        if (newQty < 1) return; // Não permite zero aqui, usa o botão remover

        // Limitador: Só aplica se estiver consumindo estoque. 
        // Se for "Aguardando", permite subir infinitamente pois vamos comprar/produzir.
        if (consumesStock && newQty > effectiveMax) {
            alert(`Estoque insuficiente! Máximo disponível: ${physicalStock} unidades adicionais.`);
            return;
        }

        item.quantity = newQty;

        // Recalcular total
        const newTotal = newItems.reduce((acc, i) => acc + (i.priceAtSale * i.quantity), 0);
        setEditableSale({ ...editableSale, items: newItems, totalValue: newTotal });
    };

    const confirmRemoveItem = () => {
        if (itemToDelete === null) return;

        const newItems = [...editableSale.items];
        newItems.splice(itemToDelete, 1);
        // Recalcular total
        const newTotal = newItems.reduce((acc, i) => acc + (i.priceAtSale * i.quantity), 0);
        setEditableSale({ ...editableSale, items: newItems, totalValue: newTotal });
        setItemToDelete(null);
    };

    const handleUpdateFromCatalog = (newItems: SaleItem[]) => {
        // Recalcular total
        const newTotal = newItems.reduce((acc, i) => acc + (i.priceAtSale * i.quantity), 0);
        setEditableSale({ ...editableSale, items: newItems, totalValue: newTotal });
        setIsCatalogOpen(false);
    };

    const handleApprove = () => {
        const updated = {
            ...editableSale,
            status: 'Pendente' as SaleStatus,
            paymentType: approveType,
            isPaid: approveType === 'cash',
            amountPaid: approveType === 'cash' ? editableSale.totalValue : 0,
            paymentHistory: approveType === 'cash' ? [{ id: generateId(), date: new Date().toISOString().slice(0, 10), amount: editableSale.totalValue, note: 'Pagamento Integral' }] : []
        };
        onSave(updated);
    };

    const handleReleaseStock = () => {
        if (!confirm("Tem certeza? Isso irá descontar os itens do estoque agora.")) return;

        const nextStatus = editableSale.requiresApproval ? 'Aguardando Aprovação' : 'Pendente';

        const updated = {
            ...editableSale,
            status: nextStatus as SaleStatus,
        };
        onSave(updated);
    };

    const handleCancel = () => {
        if (confirm("Deseja realmente CANCELAR este pedido?")) {
            onSave({ ...editableSale, status: 'Cancelada' as SaleStatus });
        }
    };

    const handleExportPDF = () => {
        exportSaleByNumberPDF(sale, customer, products, colors);
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 bg-slate-950/80 backdrop-blur-md">

            {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE ITEM */}
            {itemToDelete !== null && (
                <div className="absolute inset-0 z-[160] flex items-center justify-center p-6 animate-fadeIn bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-[280px] p-6 rounded-[2rem] shadow-2xl border-2 border-rose-100 dark:border-rose-900/30 flex flex-col items-center animate-slideUp" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <Trash2 size={24} />
                        </div>
                        <h4 className="text-sm font-black uppercase text-slate-800 dark:text-white mb-2">Excluir Item?</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase text-center mb-6 leading-relaxed">
                            O item será removido e o estoque recalculado ao salvar.
                        </p>
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={(e) => { e.stopPropagation(); setItemToDelete(null); }}
                                title="Cancelar Remoção" aria-label="Cancelar Remoção"
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); confirmRemoveItem(); }}
                                title="Confirmar Remoção" aria-label="Confirmar Remoção"
                                className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCatalogOpen && (
                <ProductCatalogModal
                    products={products}
                    grids={grids}
                    colors={colors}
                    showMiniatures={true}
                    initialItems={editableSale.items}
                    onClose={() => setIsCatalogOpen(false)}
                    onSave={handleUpdateFromCatalog}
                />
            )}

            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl animate-slideUp overflow-hidden flex flex-col max-h-[95vh] border dark:border-slate-800">

                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 text-white rounded-lg shadow-md">
                            <Receipt size={16} />
                        </div>
                        <div>
                            <h3 className="text-[11px] font-black uppercase dark:text-white leading-none tracking-tight">{sale.saleNumber}</h3>
                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Detalhes do Pedido</p>
                        </div>
                    </div>
                    <button onClick={onClose} title="Fechar modal" aria-label="Fechar modal" className="p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-400 rounded-full hover:scale-110 active:scale-90 transition-all shadow-sm"><X size={16} /></button>
                </div>

                <div className="flex p-2 bg-white dark:bg-slate-900 border-b dark:border-slate-800 overflow-x-auto gap-1">
                    {sale.status === 'Aguardando Aprovação' && (
                        <button onClick={() => setActiveTab('approve')} title="Aprovar" aria-label="Aprovar" className={`flex-1 min-w-[85px] py-3 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'approve' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:bg-slate-50'}`}><Clock size={16} /> Aprovar</button>
                    )}
                    {sale.status === 'Aguardando Estoque' && (
                        <button onClick={() => setActiveTab('stock')} title="Estoque" aria-label="Estoque" className={`flex-1 min-w-[85px] py-3 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'stock' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-slate-50'}`}><AlertTriangle size={16} /> Estoque</button>
                    )}
                    <button onClick={() => setActiveTab('items')} title="Itens" aria-label="Itens" className={`flex-1 min-w-[85px] py-3 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'items' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-50'}`}><ShoppingBag size={16} /> Itens</button>
                    <button onClick={() => setActiveTab('status')} title="Status" aria-label="Status" className={`flex-1 min-w-[85px] py-3 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'status' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-50'}`}><Settings size={16} /> Status</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                    {activeTab === 'approve' && (
                        <div className="space-y-5 animate-fadeIn text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 border-4 shadow-inner animate-pulse ${canRelease ? 'bg-emerald-100 text-emerald-600 border-emerald-50' : 'bg-amber-100 text-amber-600 border-amber-50'}`}>
                                {canRelease ? <PackageCheck size={32} /> : <Clock size={32} />}
                            </div>
                            <div>
                                <h4 className="text-sm font-black uppercase dark:text-white leading-tight tracking-tight">Liberar Venda</h4>
                                {canRelease ? (
                                    <p className="text-[9px] text-emerald-600 font-black uppercase mt-1.5 leading-relaxed px-3 bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                                        ESTOQUE DISPONÍVEL! Você pode liberar este pedido agora.
                                    </p>
                                ) : (
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1.5 leading-relaxed px-3">
                                        Este pedido está reservado. Escolha a forma de pagamento para ativar.
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setApproveType('cash')} title="À Vista" aria-label="À Vista" className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 shadow-sm ${approveType === 'cash' ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}>
                                    <CheckCircle2 size={24} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">À VISTA / OK</span>
                                </button>
                                <button onClick={() => setApproveType('credit')} title="A Prazo" aria-label="A Prazo" className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 shadow-sm ${approveType === 'credit' ? 'bg-rose-600 border-rose-600 text-white shadow-xl scale-[1.02]' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}>
                                    <CreditCard size={24} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">A PRAZO</span>
                                </button>
                            </div>

                            <div className="pt-4 space-y-3">
                                <button onClick={handleApprove} title="Confirmar e Ativar" aria-label="Confirmar e Ativar" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <Check size={18} /> CONFIRMAR E ATIVAR
                                </button>
                                <button onClick={handleCancel} title="Descartar Pedido" aria-label="Descartar Pedido" className="w-full py-3 bg-rose-50 text-rose-500 rounded-2xl font-black uppercase text-[8px] hover:bg-rose-100 transition-colors">DESCARTAR PEDIDO (ESTORNO)</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'stock' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className={`p-6 rounded-[2.5rem] text-center border-2 ${canRelease ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800'}`}>
                                <h4 className={`text-sm font-black uppercase mb-2 ${canRelease ? 'text-emerald-600' : 'text-orange-600'}`}>
                                    {canRelease ? 'Pronto para Liberar' : 'Aguardando Estoque'}
                                </h4>
                                <p className="text-[9px] font-bold text-slate-500 uppercase">
                                    {canRelease ? 'O estoque físico atual cobre este pedido.' : 'Compre os itens abaixo para liberar.'}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h5 className="text-[9px] font-black uppercase text-slate-400 pl-2">Status do Estoque</h5>
                                {missingItems.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 border-2 border-orange-100 dark:border-orange-900/30 rounded-2xl shadow-sm">
                                        <div>
                                            <p className="text-[10px] font-black uppercase dark:text-white">{products.find((p: any) => p.id === item.productId)?.reference}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">{item.isWholesale ? 'CX' : 'UN'} • {colors.find((c: any) => c.id === item.colorId)?.name || item.colorId}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Faltam</span>
                                            <span className="text-lg font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-lg">{item.missing}</span>
                                        </div>
                                    </div>
                                ))}
                                {canRelease && (
                                    <div className="p-6 text-center bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border-2 border-emerald-100 dark:border-emerald-800">
                                        <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                                        <p className="text-[10px] font-black uppercase text-emerald-600">Todo o estoque chegou!</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleReleaseStock}
                                disabled={!canRelease}
                                className="w-full py-5 bg-emerald-600 text-white rounded-[2.5rem] font-black uppercase text-[11px] shadow-2xl shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                <ArrowDownCircle size={20} />
                                {sale.requiresApproval ? 'LIBERAR P/ APROVAÇÃO' : 'LIBERAR E BAIXAR ESTOQUE'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'items' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="space-y-4">
                                {editableSale.items.map((item: any, idx: number) => {
                                    const uniqueKey = `${item.productId}-${item.variationId || item.distributionId}-${item.colorId}`;
                                    const product = products.find((p: any) => p.id === item.productId);

                                    return (
                                        <div key={uniqueKey} className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center gap-4 relative overflow-hidden group">
                                            <div className="flex items-center gap-4 w-full">
                                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-slate-50 dark:border-slate-700 shadow-sm shrink-0">
                                                    {showMiniatures && product?.image ? <img src={product.image} alt={product?.reference || 'Produto'} className="w-full h-full object-cover rounded-xl" /> : <Package size={28} className="text-slate-300" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[13px] font-black uppercase dark:text-white truncate">
                                                        {product?.reference || 'REF'}
                                                    </p>
                                                    <p className="text-[12px] font-bold text-slate-400 uppercase mt-0.5 mb-1">
                                                        {getColorName(item.colorId, colors)} {item.isWholesale ? '• ATACADO' : ''}
                                                    </p>
                                                    <p className="text-[11px] font-black text-emerald-600">
                                                        R$ {formatMoney(item.priceAtSale)} unit
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between w-full border-t border-slate-100 dark:border-slate-800 pt-4">
                                                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                                                    {editableSale.status !== 'Cancelada' && (
                                                        <button title="Diminuir quantidade" onClick={() => updateItemQuantity(idx, -1)} className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-700 rounded-xl text-slate-400 hover:text-slate-600 active:scale-90 transition-transform shadow-sm"><Minus size={16} /></button>
                                                    )}
                                                    <span className="text-[12px] font-black w-10 text-center">{item.quantity}</span>
                                                    {editableSale.status !== 'Cancelada' && (
                                                        <button title="Aumentar quantidade" onClick={() => updateItemQuantity(idx, 1)} className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-700 rounded-xl text-slate-400 hover:text-slate-600 active:scale-90 transition-transform shadow-sm"><Plus size={16} /></button>
                                                    )}
                                                </div>

                                                {editableSale.status !== 'Cancelada' && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setItemToDelete(idx); }}
                                                        className="text-[9px] font-black text-rose-500 uppercase flex items-center gap-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-3 py-2 rounded-xl transition-colors"
                                                    >
                                                        <Trash2 size={14} /> REMOVER
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {editableSale.status !== 'Cancelada' && (
                                <button
                                    onClick={() => setIsCatalogOpen(true)}
                                    className="w-full py-4 border-2 border-dashed border-blue-200 dark:border-blue-900/30 text-blue-500 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                                >
                                    <LayoutGrid size={16} /> ABRIR CATÁLOGO DE PRODUTOS
                                </button>
                            )}

                            <div className="pt-4">
                                <button onClick={handleExportPDF} className="w-full py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all">
                                    <Download size={16} /> GERAR COMPROVANTE PDF
                                </button>

                                <button
                                    onClick={() => window.open(`https://keep.google.com/u/0/#createNote?text=${encodeURIComponent(formatSaleToText(editableSale, customer, products, colors))}`, '_blank')}
                                    className="w-full py-4 bg-yellow-500 text-white rounded-[2rem] font-black uppercase text-[10px] shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    <Note size={24} weight="fill" /> EXPORTAR P/ GOOGLE KEEP
                                </button>
                            </div>

                            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-[2rem] border-2 border-blue-100 dark:border-blue-800 flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Valor do Pedido</span>
                                <span className="text-2xl font-black text-blue-700 dark:text-blue-400">R$ {formatMoney(editableSale.totalValue)}</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'status' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="space-y-2.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-3">Estágio de Logística</label>
                                <select title="Estágio de Logística" value={editableSale.status} onChange={e => setEditableSale({ ...editableSale, status: e.target.value as SaleStatus })} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl p-4.5 text-[11px] font-black uppercase outline-none focus:border-blue-500 shadow-sm transition-all dark:text-white">
                                    {['Pendente', 'Em produção', 'Entregue', 'Cancelada', 'Aguardando Estoque', 'Aguardando Aprovação'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>

                            </div>
                            {editableSale.status !== 'Cancelada' && (
                                <div className="pt-16">
                                    <button onClick={onDelete} className="w-full py-4.5 bg-rose-50 text-rose-600 rounded-[2.5rem] text-[10px] font-black uppercase flex items-center justify-center gap-3 hover:bg-rose-100 transition-colors border-2 border-rose-100">
                                        <Trash2 size={18} /> EXCLUIR REGISTRO DEFINITIVAMENTE
                                    </button>
                                </div>
                            )}
                            {editableSale.status === 'Cancelada' && (
                                <div className="pt-16">
                                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
                                        <Prohibit size={32} className="text-slate-300 mx-auto mb-2" />
                                        <p className="text-[10px] font-black uppercase text-slate-400">Pedido Cancelado</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Registros de cancelamento não podem ser excluídos.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-5 pb-12 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex gap-4">
                    {editableSale.status !== 'Cancelada' ? (
                        <button onClick={() => onSave(editableSale)} className="w-full py-4 bg-emerald-600 text-white rounded-[2rem] text-[12px] font-black uppercase shadow-2xl shadow-emerald-600/30 flex items-center justify-center gap-3 active:scale-95 transition-all">
                            <Check size={20} /> GRAVAR ALTERAÇÕES
                        </button>
                    ) : (
                        <div className="w-full py-4 bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-[2rem] text-[10px] font-black uppercase flex items-center justify-center gap-3 cursor-not-allowed">
                            <Prohibit size={20} /> SOMENTE LEITURA (CANCELADO)
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Modal de Catálogo Visual para Edição (Estilo VenderView)
const ProductCatalogModal = ({ products, grids, colors, showMiniatures, initialItems, onClose, onSave }: { products: Product[], grids: AppGrid[], colors: any[], showMiniatures: boolean, initialItems: SaleItem[], onClose: () => void, onSave: (items: SaleItem[]) => void }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [tempItems, setTempItems] = useState<SaleItem[]>(initialItems);
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [tempQtys, setTempQtys] = useState<Record<string, string>>({});

    useEffect(() => {
        // Inicializar quantidades temporárias para inputs
        const initialQtys: Record<string, string> = {};
        initialItems.forEach(item => {
            const key = `${item.productId}-${item.isWholesale ? item.distributionId : item.variationId}-${item.colorId || ''}`;
            initialQtys[key] = String(item.quantity);
        });
        setTempQtys(initialQtys);
    }, [initialItems]);

    const filteredProducts = products.filter(p => p.status === 'active' && p.reference.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleQtyChange = (key: string, val: string) => {
        const sanitized = val.replace(/\D/g, '');
        setTempQtys(prev => ({ ...prev, [key]: sanitized }));
    };

    const adjustQty = (key: string, delta: number, currentQty: number) => {
        const currentVal = tempQtys[key] !== undefined ? parseInt(tempQtys[key] || '0') : currentQty;
        const next = Math.max(0, currentVal + delta);
        setTempQtys(prev => ({ ...prev, [key]: String(next) }));
        return next; // Return next value to use immediately if needed
    };

    const updateCart = (p: Product, varOrDistId: string, isWholesale: boolean, colorName?: string, delta: number = 0, manualQty?: number) => {
        const key = `${p.id}-${varOrDistId}-${colorName || ''}`;

        // Determine new quantity
        let newQty = 0;
        if (manualQty !== undefined) {
            newQty = manualQty;
        } else {
            const currentItem = tempItems.find(i => isWholesale ? (i.distributionId === varOrDistId && i.colorId === colorName) : (i.variationId === varOrDistId));
            const currentQty = currentItem ? currentItem.quantity : 0;
            newQty = Math.max(0, currentQty + delta);
            // Sync temp input
            setTempQtys(prev => ({ ...prev, [key]: String(newQty) }));
        }

        if (newQty === 0) {
            setTempItems(prev => prev.filter(i =>
                isWholesale ? !(i.productId === p.id && i.distributionId === varOrDistId && i.colorId === colorName)
                    : !(i.productId === p.id && i.variationId === varOrDistId)
            ));
            return;
        }

        let price = 0;
        if (isWholesale) {
            const grid = grids.find(g => g.distributions?.some(d => d.id === varOrDistId));
            const dist = grid?.distributions?.find(d => d.id === varOrDistId);
            const pairsCount = dist ? (Object.values(dist.quantities) as number[]).reduce((a: number, b: number) => a + b, 0) : 0;
            const colorVar = p.variations.find(v => v.colorId === colorName);
            const basePrice = colorVar?.salePrice || p.variations[0]?.salePrice || 0;
            price = basePrice * pairsCount;
        } else {
            const v = p.variations.find(v => v.id === varOrDistId);
            price = v?.salePrice || 0;
        }

        setTempItems(prev => {
            const idx = prev.findIndex(i =>
                isWholesale ? (i.productId === p.id && i.distributionId === varOrDistId && i.colorId === colorName)
                    : (i.productId === p.id && i.variationId === varOrDistId)
            );

            const newItem: SaleItem = {
                productId: p.id,
                variationId: !isWholesale ? varOrDistId : undefined,
                distributionId: isWholesale ? varOrDistId : undefined,
                isWholesale,
                colorId: colorName,
                quantity: newQty,
                priceAtSale: price
            };

            if (idx > -1) {
                const updated = [...prev];
                updated[idx] = newItem;
                return updated;
            }
            return [...prev, newItem];
        });
    };

    return (
        <div className="fixed inset-0 z-[1100] bg-slate-100 dark:bg-slate-950 flex flex-col animate-slideUp">
            <div className="p-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
                <button title="Fechar catálogo" onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:scale-110 transition-all"><ArrowDownCircle size={20} className="text-slate-500" /></button>
                <div className="flex-1">
                    <h3 className="text-sm font-black uppercase dark:text-white">Catálogo de Produtos</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Selecione os itens para o pedido</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                    <p className="text-[10px] font-black text-blue-600 uppercase">{tempItems.length} Itens</p>
                </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-xs font-black uppercase outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 pb-32">
                {filteredProducts.map(p => {
                    const isExpanded = expandedProductId === p.id;
                    const itemsInCart = tempItems.filter(i => i.productId === p.id);
                    const hasItems = itemsInCart.length > 0;

                    return (
                        <div key={p.id} className={`bg-white dark:bg-slate-900 border-2 transition-all duration-300 rounded-[2rem] overflow-hidden shadow-sm ${hasItems ? 'border-emerald-500 shadow-emerald-50 dark:shadow-none' : 'dark:border-slate-800'}`}>
                            <button onClick={() => setExpandedProductId(isExpanded ? null : p.id)} title={isExpanded ? "Recolher Produto" : "Expandir Produto"} aria-label={isExpanded ? "Recolher Produto" : "Expandir Produto"} className={`w-full p-4 flex items-center gap-4 transition-colors ${hasItems ? 'bg-emerald-50/30 dark:bg-emerald-900/5' : 'hover:bg-slate-50'}`}>
                                <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border-2 dark:border-slate-700 flex items-center justify-center shrink-0">
                                    {showMiniatures && p.image ? <img src={p.image} className="w-full h-full object-cover" alt={`Miniatura do produto ${p.reference}`} /> : <Package size={24} className="text-slate-300" />}
                                </div>
                                <div className="text-left flex-1 min-w-0">
                                    <h4 className="text-[12px] font-black uppercase dark:text-white truncate">{p.reference}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${hasItems ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            {hasItems ? `${itemsInCart.length} SELECIONADOS` : 'ADICIONAR'}
                                        </span>
                                    </div>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 border-2 ${isExpanded ? 'bg-amber-500 border-amber-500 text-white rotate-180' : 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-700'}`}>
                                    <ChevronDown size={16} />
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="p-4 pt-0 space-y-4 animate-fadeIn border-t dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20">
                                    {/* VAREJO */}
                                    {p.hasRetail && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 px-2 pt-3">
                                                <Store size={12} className="text-blue-600" />
                                                <span className="text-[8px] font-black uppercase text-slate-500">Varejo</span>
                                            </div>
                                            {(() => {
                                                const mergedRetail = p.variations.reduce((acc: any[], curr: any) => {
                                                    const cName = getColorName(curr.colorId, colors);
                                                    const existing = acc.find(a => a.size === curr.size && getColorName(a.colorId, colors) === cName);
                                                    if (existing) {
                                                        existing.stock = (existing.stock || 0) + (curr.stock || 0);
                                                    } else {
                                                        acc.push({ ...curr });
                                                    }
                                                    return acc;
                                                }, []);

                                                return mergedRetail.map(v => {
                                                    const key = `${p.id}-${v.id}-`;
                                                    const inCart = tempItems.find(i => i.variationId === v.id);
                                                    const qtyVal = tempQtys[key] !== undefined ? tempQtys[key] : (inCart ? String(inCart.quantity) : '0');

                                                    return (
                                                        <div key={v.id} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${inCart ? 'bg-white border-emerald-500 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                                            <div className="flex flex-col min-w-0 pr-2">
                                                                <span className="text-[9px] font-black uppercase dark:text-white">TAM {v.size} • {getColorName(v.colorId, colors)}</span>
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase">Estoque: {v.stock}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => updateCart(p, v.id, false, v.colorId, -1)} title="Diminuir" aria-label="Diminuir" className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-500 hover:bg-slate-200"><Minus size={14} /></button>
                                                                <input
                                                                    title="Quantidade" aria-label="Quantidade"
                                                                    type="text" inputMode="numeric"
                                                                    value={qtyVal}
                                                                    onChange={e => {
                                                                        handleQtyChange(key, e.target.value);
                                                                        updateCart(p, v.id, false, v.colorId, 0, parseInt(e.target.value || '0'));
                                                                    }}
                                                                    className="w-8 text-center text-xs font-black bg-transparent outline-none dark:text-white"
                                                                />
                                                                <button onClick={() => updateCart(p, v.id, false, v.colorId, 1)} title="Aumentar" aria-label="Aumentar" className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-xl shadow-md active:scale-95"><Plus size={14} /></button>
                                                            </div>
                                                        </div>
                                                    )
                                                });
                                            })()}
                                        </div>
                                    )}

                                    {/* ATACADO */}
                                    {p.hasWholesale && p.wholesaleStock.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 px-2 pt-3">
                                                <Boxes size={12} className="text-indigo-600" />
                                                <span className="text-[8px] font-black uppercase text-slate-500">Atacado (Caixas)</span>
                                            </div>
                                            {(() => {
                                                const mergedWS = p.wholesaleStock.reduce((acc: any[], curr: any) => {
                                                    const cName = getColorName(curr.colorId, colors);
                                                    const existing = acc.find(a => a.distributionId === curr.distributionId && getColorName(a.colorId, colors) === cName);
                                                    if (existing) {
                                                        existing.boxes = (existing.boxes || 0) + (curr.boxes || 0);
                                                    } else {
                                                        acc.push({ ...curr });
                                                    }
                                                    return acc;
                                                }, []);

                                                return mergedWS.map(ws => {
                                                    const key = `${p.id}-${ws.distributionId}-${ws.colorId}`;
                                                    const inCart = tempItems.find(i => i.distributionId === ws.distributionId && i.colorId === ws.colorId);
                                                    const qtyVal = tempQtys[key] !== undefined ? tempQtys[key] : (inCart ? String(inCart.quantity) : '0');

                                                    return (
                                                        <div key={ws.id} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${inCart ? 'bg-white border-indigo-500 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                                            <div className="flex flex-col min-w-0 pr-2">
                                                                <span className="text-[9px] font-black uppercase dark:text-white">CX • {getColorName(ws.colorId, colors)}</span>
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase">Estoque: {ws.boxes} CX</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => updateCart(p, ws.distributionId, true, ws.colorId, -1)} title="Diminuir" aria-label="Diminuir" className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl text-slate-500 hover:bg-slate-200"><Minus size={14} /></button>
                                                                <input
                                                                    title="Quantidade" aria-label="Quantidade"
                                                                    type="text" inputMode="numeric"
                                                                    value={qtyVal}
                                                                    onChange={e => {
                                                                        handleQtyChange(key, e.target.value);
                                                                        updateCart(p, ws.distributionId, true, ws.colorId, 0, parseInt(e.target.value || '0'));
                                                                    }}
                                                                    className="w-8 text-center text-xs font-black bg-transparent outline-none dark:text-white"
                                                                />
                                                                <button onClick={() => updateCart(p, ws.distributionId, true, ws.colorId, 1)} title="Aumentar" aria-label="Aumentar" className="w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-xl shadow-md active:scale-95"><Plus size={14} /></button>
                                                            </div>
                                                        </div>
                                                    )
                                                });
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800 shadow-2xl">
                <button onClick={() => onSave(tempItems)} title="Confirmar Seleção" aria-label="Confirmar Seleção" className="w-full py-4 bg-emerald-600 text-white rounded-[2rem] text-[12px] font-black uppercase shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                    <Check size={20} /> Confirmar {tempItems.length} Itens
                </button>
            </div>
        </div>
    );
};
