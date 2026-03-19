
import React, { useState, useMemo } from 'react';
import { Product, Variation, WholesaleStockItem } from '../types';
import { formatMoney, sanitizeNum } from '../lib/utils';
import { MagnifyingGlass, CaretDown, CaretUp, Cube, Storefront, Funnel, ClipboardText, FloppyDisk, X, ArrowCounterClockwise, Package, Warning, ArrowRight, Stack, EyeSlash, Image, Prohibit, CheckCircle } from '@phosphor-icons/react';

// Lucide compat aliases
const Search = MagnifyingGlass;
const ChevronDown = CaretDown;
const ChevronUp = CaretUp;
const Box = Cube;
const Boxes = Cube;
const Store = Storefront;
const Filter = Funnel;
const ClipboardCheck = ClipboardText;
const Save = FloppyDisk;
const RefreshCcw = ArrowCounterClockwise;
const AlertTriangle = Warning;
const Layers = Stack;
const EyeOff = EyeSlash;
const ImageIcon = Image;
const Ban = Prohibit;

interface EstoqueViewProps {
    products: Product[];
    colors: any[];
    showMiniatures: boolean;
    onUpdateProduct: (product: Product) => void;
    onRecalculate?: () => void;
    setView: (v: any) => void;
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

export const EstoqueView = ({ products, colors, showMiniatures, onUpdateProduct, onRecalculate, setView }: EstoqueViewProps) => {
    const [filter, setFilter] = useState('');
    const [onlyLowStock, setOnlyLowStock] = useState(false);
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [isInventoryMode, setIsInventoryMode] = useState(false);

    const [editedStocks, setEditedStocks] = useState<Record<string, {
        variations: Record<string, number | ''>,
        wholesale: Record<string, number | ''>
    }>>({});

    const filteredProducts = useMemo(() => {
        let result = products.filter(p => p.reference.toLowerCase().includes(filter.toLowerCase()));

        if (onlyLowStock) {
            result = result.filter(p => {
                const hasLowRetail = p.variations.some(v => v.stock <= v.minStock);
                // Para atacado, assumimos alerta se boxes <= 2 (hardcoded por enquanto ou precisa de campo específico)
                const hasLowWholesale = p.wholesaleStock.some(ws => ws.boxes <= 2);
                return hasLowRetail || hasLowWholesale;
            });
        }
        return result;
    }, [products, filter, onlyLowStock]);

    const toggleProduct = (id: string) => setExpandedProductId(prev => prev === id ? null : id);
    const toggleSection = (id: string, section: 'retail' | 'wholesale') => {
        const key = `${id}-${section}`;
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleStartBalanço = () => {
        setIsInventoryMode(true);
        const initial: typeof editedStocks = {};
        products.forEach(p => {
            initial[p.id] = { variations: {}, wholesale: {} };
            p.variations.forEach(v => initial[p.id].variations[v.id] = v.stock);
            (p.wholesaleStock || []).forEach(ws => initial[p.id].wholesale[ws.id] = ws.boxes);
        });
        setEditedStocks(initial);
    };

    const handleUpdateLocalStock = (prodId: string, type: 'retail' | 'wholesale', itemId: string, val: number | '') => {
        const key = type === 'retail' ? 'variations' : 'wholesale';
        setEditedStocks(prev => ({
            ...prev,
            [prodId]: {
                ...prev[prodId],
                [key]: {
                    ...prev[prodId][key],
                    [itemId]: val
                }
            }
        }));
    };

    const handleSaveBalanço = (prodId: string) => {
        const product = products.find(p => p.id === prodId);
        if (!product) return;
        const edits = editedStocks[prodId];
        const updatedProduct: Product = {
            ...product,
            variations: product.variations.map(v => ({ ...v, stock: edits.variations[v.id] === '' ? 0 : (edits.variations[v.id] ?? v.stock) as number })),
            wholesaleStock: (product.wholesaleStock || []).map(ws => ({ ...ws, boxes: edits.wholesale[ws.id] === '' ? 0 : (edits.wholesale[ws.id] ?? ws.boxes) as number }))
        };
        onUpdateProduct(updatedProduct);
        alert(`Salvo: ${product.reference}`);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-32 px-2">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight dark:text-white leading-none">Estoques</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">Gestão de Peças e Caixas</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={isInventoryMode ? () => setIsInventoryMode(false) : handleStartBalanço} className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg flex items-center justify-center gap-2 transition-all ${isInventoryMode ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'}`}>
                        {isInventoryMode ? <X size={16} /> : <ClipboardCheck size={16} />}
                        {isInventoryMode ? 'Sair' : 'Balanço'}
                    </button>
                    <button onClick={() => setView('produtos')} className="flex-1 sm:flex-none bg-blue-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase">+ Novo</button>
                </div>
            </div>

            <div className="flex gap-2 mx-2">
                <div className="relative group flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="PESQUISAR MODELO..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full bg-white dark:bg-slate-900 border-2 dark:border-slate-800 border-slate-100 pl-14 pr-6 py-4 rounded-[2rem] text-xs font-black uppercase outline-none focus:border-blue-500 shadow-sm" />
                </div>
                <button
                    onClick={() => setOnlyLowStock(!onlyLowStock)}
                    className={`px-4 rounded-[2rem] border-2 flex items-center gap-2 transition-all ${onlyLowStock ? 'bg-rose-500 border-rose-500 text-white shadow-lg' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}
                    title="Filtrar estoque baixo"
                >
                    <AlertTriangle size={18} />
                    <span className="hidden sm:inline text-[9px] font-black uppercase">Alerta Estoque</span>
                </button>
                {onRecalculate && (
                    <button
                        onClick={() => {
                            if (window.confirm('Deseja recalcular o estoque global com base no histórico de compras e vendas? Isso sincronizará os saldos reais.')) {
                                onRecalculate();
                            }
                        }}
                        className="px-4 rounded-[2rem] border-2 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center gap-2 transition-all hover:bg-indigo-100"
                        title="Recalcular Estoque Global"
                    >
                        <RefreshCcw size={18} />
                        <span className="hidden sm:inline text-[9px] font-black uppercase">Sincronizar</span>
                    </button>
                )}
            </div>

            {isInventoryMode && (
                <div className="mx-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-100 dark:border-emerald-800 rounded-[2rem] flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center text-emerald-600">
                        <ClipboardCheck size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 leading-tight">Modo Balanço Ativo</p>
                        <p className="text-[9px] text-emerald-600/70 font-bold uppercase tracking-wider">Altere os valores e clique no botão verde abaixo de cada modelo para salvar</p>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {filteredProducts.map(p => {
                    const isProductExpanded = expandedProductId === p.id;
                    const retailTotal = isInventoryMode ? Object.values(editedStocks[p.id]?.variations || {}).reduce((a: any, b: any) => a + b, 0) : p.variations.reduce((a, b) => a + sanitizeNum(b.stock), 0);
                    const wholesaleTotal = isInventoryMode ? Object.values(editedStocks[p.id]?.wholesale || {}).reduce((a: any, b: any) => a + b, 0) : p.wholesaleStock.reduce((a, b) => a + sanitizeNum(b.boxes), 0);
                    const isRetailOpen = expandedSections[`${p.id}-retail`];
                    const isWholesaleOpen = expandedSections[`${p.id}-wholesale`];

                    // Verifica se há estoque baixo
                    const hasLowStock = p.variations.some(v => v.stock <= v.minStock) || p.wholesaleStock.some(ws => ws.boxes <= 2);

                    return (
                        <div key={p.id} className={`bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 shadow-sm overflow-hidden transition-all ${p.status === 'active' ? (hasLowStock ? 'border-rose-300 dark:border-rose-900/50 shadow-rose-100' : 'border-slate-100 dark:border-slate-800') : 'border-slate-100 opacity-60'}`}>
                            <button onClick={() => toggleProduct(p.id)} className={`w-full p-3 flex items-center gap-5 ${hasLowStock ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''} ${isProductExpanded ? 'bg-slate-50 dark:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border-2 dark:border-slate-700 flex items-center justify-center shrink-0 relative">
                                    {showMiniatures && p.image ? <img src={p.image} alt={`Imagem do produto ${p.reference}`} className={`w-full h-full object-cover ${p.status !== 'active' ? 'grayscale' : ''}`} /> : <Package size={24} className="text-slate-300" />}
                                    {hasLowStock && (
                                        <div className="absolute top-0 right-0 bg-rose-500 text-white p-1 rounded-bl-lg shadow-sm">
                                            <AlertTriangle size={10} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <h3 className="text-sm font-black uppercase dark:text-white leading-none mb-1 flex items-center gap-2 truncate">
                                        {p.reference}
                                        {p.status !== 'active' && <span className="text-[7px] bg-slate-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0"><Ban size={8} /> FORA DE LINHA</span>}
                                    </h3>
                                    <div className="flex flex-wrap gap-3">
                                        {p.hasRetail && (
                                            <span className="text-[10px] font-black uppercase text-slate-400">Varejo: {retailTotal}</span>
                                        )}
                                        {p.hasWholesale && (
                                            <span className="text-[10px] font-black uppercase text-slate-400">Atacado: {wholesaleTotal} CX</span>
                                        )}
                                        {isInventoryMode && <span className="text-[10px] font-black uppercase text-emerald-500 animate-pulse">Editando...</span>}
                                    </div>
                                </div>
                                <div className="pr-2 flex items-center gap-3 shrink-0">
                                    <div className="flex gap-1">
                                        {p.hasRetail && <div className="p-1 bg-blue-500 text-white rounded"><Store size={10} /></div>}
                                        {p.hasWholesale && <div className="p-1 bg-indigo-500 text-white rounded"><Boxes size={10} /></div>}
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 border-2 ${isProductExpanded ? 'bg-amber-500 border-amber-500 text-white rotate-180 shadow-lg shadow-amber-500/30' : 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400'}`}>
                                        <ChevronDown size={20} />
                                    </div>
                                </div>
                            </button>

                            {isProductExpanded && (
                                <div className="p-4 space-y-4 animate-fadeIn bg-zinc-900/60 border-t dark:border-slate-800">
                                    {p.hasRetail && (
                                        <div className="rounded-[2rem] border-2 bg-white dark:bg-slate-900 overflow-hidden">
                                            <button onClick={() => toggleSection(p.id, 'retail')} className="w-full p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3"><Store size={18} className="text-blue-500" /><span className="text-[10px] font-black uppercase">Varejo por Tamanho</span></div>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isRetailOpen ? 'bg-blue-100 text-blue-600 rotate-180' : 'bg-slate-100 text-slate-400'}`}>
                                                    <ChevronDown size={14} />
                                                </div>
                                            </button>
                                            <div className="p-4 pt-0 space-y-4">
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

                                                    // Agrupar por cor para a UI
                                                    const byColor: Record<string, any[]> = {};
                                                    mergedRetail.forEach(v => {
                                                        const cName = getColorName(v.colorId, colors);
                                                        if (!byColor[cName]) byColor[cName] = [];
                                                        byColor[cName].push(v);
                                                    });

                                                    return Object.entries(byColor).map(([colorName, vars]) => (
                                                        <div key={colorName} className="space-y-2 mb-4 last:mb-0 p-3 bg-white dark:bg-slate-900/40 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm">
                                                            <div className="px-2 pb-1 border-b dark:border-slate-800 mb-2">
                                                                <span className="text-[12px] font-black uppercase text-blue-600 tracking-widest">{colorName}</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                                {vars.map(v => {
                                                                    const currentVal = isInventoryMode ? (editedStocks[p.id]?.variations[v.id] ?? v.stock) : v.stock;
                                                                    const isLow = currentVal <= v.minStock;
                                                                    return (
                                                                        <div key={v.id} className={`p-3 rounded-2xl flex flex-col items-center border transition-all ${isLow ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800' : 'bg-slate-50 dark:bg-slate-800 dark:border-slate-700'}`}>
                                                                            <div className="flex items-center justify-center w-full mb-2">
                                                                                <span className="text-[9px] font-black">T: {v.size}</span>
                                                                            </div>
                                                                            {showMiniatures && v.image && <img src={v.image} alt={`Imagem da variação ${v.size}`} className="w-8 h-8 object-cover rounded-md mb-2 shadow-sm" />}
                                                                            {isInventoryMode ? (
                                                                                <input type="number" aria-label={`Estoque varejo tamanho ${v.size}`} title={`Estoque varejo tamanho ${v.size}`} value={currentVal} onChange={e => handleUpdateLocalStock(p.id, 'retail', v.id, e.target.value === '' ? '' : Number(e.target.value))} className="w-full text-center font-black text-xs bg-white dark:bg-slate-900 border rounded-lg py-1" />
                                                                            ) : (
                                                                                <span className={`text-sm font-black ${isLow ? 'text-rose-600 animate-pulse' : 'text-blue-600'}`}>{v.stock}</span>
                                                                            )}
                                                                            {isLow && !isInventoryMode && <span className="text-[10px] font-bold text-rose-500 uppercase mt-1">Baixo ({v.minStock})</span>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    {p.hasWholesale && (
                                        <div className="rounded-[2rem] border-2 bg-white dark:bg-slate-900 overflow-hidden">
                                            <button onClick={() => toggleSection(p.id, 'wholesale')} className="w-full p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-3"><Boxes size={18} className="text-indigo-500" /><span className="text-[10px] font-black uppercase">Atacado por Grade</span></div>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isWholesaleOpen ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-slate-100 text-slate-400'}`}>
                                                    <ChevronDown size={14} />
                                                </div>
                                            </button>
                                            {isWholesaleOpen && (
                                                <div className="p-4 pt-0 space-y-4">
                                                    {(() => {
                                                        const groupedWS: Record<string, WholesaleStockItem & { totalBoxes: number, originalIds: string[] }> = {};
                                                        (p.wholesaleStock || []).forEach(item => {
                                                            const cName = getColorName(item.colorId, colors);
                                                            const key = `${cName}-${item.distributionId}`;
                                                            if (!groupedWS[key]) {
                                                                groupedWS[key] = { ...item, totalBoxes: sanitizeNum(item.boxes), originalIds: [item.id] };
                                                            } else {
                                                                groupedWS[key].totalBoxes += sanitizeNum(item.boxes);
                                                                groupedWS[key].originalIds.push(item.id);
                                                            }
                                                        });

                                                        // Agrupar por cor para a UI
                                                        const byColor: Record<string, (WholesaleStockItem & { totalBoxes: number })[]> = {};
                                                        Object.values(groupedWS).forEach(ws => {
                                                            const cName = getColorName(ws.colorId, colors);
                                                            if (!byColor[cName]) byColor[cName] = [];
                                                            byColor[cName].push(ws);
                                                        });

                                                        return Object.entries(byColor).map(([colorName, items]) => (
                                                            <div key={colorName} className="space-y-2 mb-4 p-3 bg-white dark:bg-slate-900/40 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm">
                                                                <div className="px-2 pb-1 border-b dark:border-slate-800 mb-2">
                                                                    <span className="text-[12px] font-black uppercase text-indigo-600 tracking-widest">{colorName}</span>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {items.map(ws => (
                                                                        <div key={ws.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl flex justify-between items-center border dark:border-slate-700">
                                                                            <div className="flex items-center gap-3">
                                                                                {showMiniatures && ws.image && <img src={ws.image} alt={`Imagem atacado`} className="w-10 h-10 object-cover rounded-xl shadow-sm" />}
                                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase ${ws.totalBoxes <= 2 ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                                                        Estoque: {ws.totalBoxes}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            {isInventoryMode ? (
                                                                                <div className="flex items-center gap-2">
                                                                                    <input
                                                                                        type="number"
                                                                                        aria-label="Estoque atacado (caixas)"
                                                                                        title="Estoque atacado (caixas)"
                                                                                        value={editedStocks[p.id]?.wholesale[ws.id] ?? ws.boxes}
                                                                                        onChange={e => handleUpdateLocalStock(p.id, 'wholesale', ws.id, e.target.value === '' ? '' : Number(e.target.value))}
                                                                                        className="w-16 text-center font-black bg-white dark:bg-slate-900 border rounded-lg p-2 text-xs"
                                                                                    />
                                                                                    <span className="text-[8px] font-black text-slate-400">CX</span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-lg font-black text-indigo-600">{ws.totalBoxes} CX</span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {isInventoryMode && (
                                        <button
                                            onClick={() => handleSaveBalanço(p.id)}
                                            className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black uppercase text-[11px] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                                        >
                                            <CheckCircle size={20} weight="fill" />
                                            SALVAR BALANÇO DESTE MODELO
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
