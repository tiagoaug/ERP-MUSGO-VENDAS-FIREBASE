
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Supplier, Variation, AppGrid, AppColor, WholesaleStockItem, GridDistribution } from '../types';
import { Field } from '../components/ui/Field';
import {
    Plus, PencilSimple, Trash, X, Cube, Calculator, CheckCircle,
    XCircle, UploadSimple, Storefront, Image,
    CaretRight, FloppyDisk, SquaresFour,
    CaretDown, CaretUp, Camera, Sparkle, Warning,
    SlidersHorizontal, ArrowCounterClockwise, Eye, EyeSlash, UserCheck, Power, Prohibit, Funnel, ShoppingBag, Check
} from '@phosphor-icons/react';

// Lucide compat aliases
const Edit2 = PencilSimple;
const Trash2 = Trash;
const Box = Cube;
const Upload = UploadSimple;
const Store = Storefront;
const Boxes = Cube;
const ImageIcon = Image;
const ChevronRight = CaretRight;
const Save = FloppyDisk;
const LayoutGrid = SquaresFour;
const ToggleLeft = Eye; // approximate
const ToggleRight = Eye;
const ChevronDown = CaretDown;
const ChevronUp = CaretUp;
const AlertTriangle = Warning;
const Zap = Sparkle;
const Settings2 = SlidersHorizontal;
const RefreshCcw = ArrowCounterClockwise;
const CheckCircle2 = CheckCircle;
const Layout = SquaresFour;
const Ban = Prohibit;
const Filter = Funnel;
const Pencil = PencilSimple;
import { CalculatorModal } from '../components/CalculatorModal';
import { SearchableSelect } from '../components/SearchableSelect';
import { formatMoney, sanitizeNum, generateId } from '../lib/utils';
import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useProducts';

interface ProdutosViewProps {
    suppliers: Supplier[];
    grids?: AppGrid[];
    colors?: AppColor[];
    showMiniatures: boolean;
    onToggleMiniatures: (val: boolean) => void;
    onRequestPurchase?: (supplierId: string) => void;
}

export const ProdutosView = ({ suppliers, grids = [], colors = [], showMiniatures, onToggleMiniatures, onRequestPurchase }: ProdutosViewProps) => {
    const { data: products = [], isLoading } = useProducts();
    const addMutation = useAddProduct();
    const updateMutation = useUpdateProduct();
    const deleteMutation = useDeleteProduct();


    const onDelete = (id: string) => deleteMutation.mutate(id);

    const [isSaving, setIsSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [step, setStep] = useState(1);
    const [supplierFilter, setSupplierFilter] = useState('');

    const [formData, setFormData] = useState<Product | Omit<Product, 'id'>>({
        id: '', reference: '', supplierId: '', status: 'active', gridIds: [], variations: [], wholesaleStock: [], image: '',
        hasRetail: true, hasWholesale: true
    });

    // Alterado para string para permitir campo vazio durante a digitação
    const [defaultPrices, setDefaultPrices] = useState({ cost: '', sale: '' });
    const [currentColorId, setCurrentColorId] = useState('');
    const [currentVarImage, setCurrentVarImage] = useState('');

    const [isCalcOpen, setIsCalcOpen] = useState(false);
    const [calcTarget, setCalcTarget] = useState<'cost' | 'sale'>('cost');

    // Estado para controlar qual cor está sendo editada detalhadamente
    const [editingColor, setEditingColor] = useState<string | null>(null);

    const filteredProducts = useMemo(() => {
        if (!supplierFilter) return products;
        return products.filter(p => p.supplierId === supplierFilter);
    }, [products, supplierFilter]);

    const handleSaveProduct = () => {
        if (!formData.reference) return alert("Referência é obrigatória.");
        if (!formData.supplierId) return alert("Selecione um fornecedor.");
        if (formData.variations.length === 0 && (formData.hasRetail || formData.hasWholesale)) {
            return alert("Gere pelo menos uma cor/variação antes de salvar.");
        }

        const options = {
            onSuccess: () => {
                setIsSaving(false);
                alert("✅ Produto salvo com sucesso!");
                setIsAdding(false);
                setStep(1);
                setFormData({
                    id: '', reference: '', supplierId: '', status: 'active', gridIds: [], variations: [], wholesaleStock: [], image: '',
                    hasRetail: true, hasWholesale: true
                });
                setDefaultPrices({ cost: '', sale: '' });
            },
            onError: (err: any) => {
                setIsSaving(false);
                console.error("Erro no Mutation:", err);
                alert("❌ Erro ao salvar: " + (err.message || "Verifique sua conexão ou permissões."));
            }
        };

        setIsSaving(true);
        if ('id' in formData && formData.id) {
            updateMutation.mutate(formData as Product, options);
        } else {
            addMutation.mutate(formData as Product, options);
        }
    };

    const handleGenerateUniversal = () => {
        const colorObj = colors.find(c => c.id === currentColorId);
        if (!colorObj) return alert("Selecione uma cor.");
        const colorName = colorObj.name;
        const activeGridIds = formData.gridIds || [];

        if (activeGridIds.length === 0) return alert("Selecione pelo menos uma GRADE no passo 1.");

        const costNum = sanitizeNum(defaultPrices.cost);
        const saleNum = sanitizeNum(defaultPrices.sale);

        let newVars: Variation[] = [];
        let newWholesale: WholesaleStockItem[] = [];

        activeGridIds.forEach(gId => {
            const gridDef = grids.find(g => g.id === gId);
            if (!gridDef) return;

            // Varejo
            gridDef.sizes.forEach(size => {
                newVars.push({
                    id: generateId(), colorId: currentColorId, size, stock: 0, minStock: 2,
                    costPrice: costNum, salePrice: saleNum, unit: 'PAR',
                    image: currentVarImage || formData.image, gridId: gId
                });
            });

            // Atacado
            gridDef.distributions?.forEach(dist => {
                const pairs = (Object.values(dist.quantities) as number[]).reduce((a, b) => a + b, 0);
                newWholesale.push({
                    id: generateId(), colorId: currentColorId, gridId: gId, distributionId: dist.id,
                    boxes: 0, costPricePerBox: costNum * pairs, salePricePerBox: saleNum * pairs,
                    image: currentVarImage || formData.image
                });
            });
        });

        setFormData(prev => {
            // Filtrar para evitar duplicidade de Varejo (Cor + Tamanho + Grade)
            const filteredNewVars = newVars.filter(nv =>
                !prev.variations.some(v => v.colorId === nv.colorId && v.size === nv.size && v.gridId === nv.gridId)
            );

            // Filtrar para evitar duplicidade de Atacado (Cor + Distribuição + Grade)
            const filteredNewWholesale = newWholesale.filter(nw =>
                !prev.wholesaleStock.some(ws => ws.colorId === nw.colorId && ws.distributionId === nw.distributionId && ws.gridId === nw.gridId)
            );

            return {
                ...prev,
                variations: [...prev.variations, ...filteredNewVars],
                wholesaleStock: [...prev.wholesaleStock, ...filteredNewWholesale]
            };
        });
        setCurrentColorId('');
        setCurrentVarImage('');
    };

    const toggleGridId = (id: string) => {
        setFormData(prev => {
            const currentIds = prev.gridIds || [];
            const newIds = currentIds.includes(id) ? currentIds.filter(gid => gid !== id) : [...currentIds, id];
            return { ...prev, gridIds: newIds };
        });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-40 lg:pb-24">
            <CalculatorModal isOpen={isCalcOpen} initialValue={sanitizeNum(defaultPrices[calcTarget])} onApply={(val) => setDefaultPrices(p => ({ ...p, [calcTarget]: String(val) }))} onClose={() => setIsCalcOpen(false)} />

            {editingColor && (
                <VariantDetailModal
                    colorId={editingColor}
                    product={formData}
                    onChange={(updated) => setFormData(updated)}
                    onClose={() => setEditingColor(null)}
                    grids={grids}
                    colors={colors}
                />
            )}

            {/* ... (Previous code for Header and Product List remains unchanged) ... */}
            <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-4 rounded-[2rem] shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 mx-2">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${showMiniatures ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <ImageIcon size={20} />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black uppercase dark:text-white leading-none">Visualização do Catálogo</h3>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Habilite para ver fotos das variantes</p>
                    </div>
                </div>
                <button
                    onClick={() => onToggleMiniatures(!showMiniatures)}
                    title={showMiniatures ? "Ocultar miniaturas" : "Mostrar miniaturas"}
                    aria-label={showMiniatures ? "Ocultar miniaturas" : "Mostrar miniaturas"}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase transition-all ${showMiniatures ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-slate-200 text-slate-500'}`}
                >
                    {showMiniatures ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    {showMiniatures ? 'Miniaturas Ativas' : 'Miniaturas Ocultas'}
                </button>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-end gap-4 px-2">
                <div className="w-full md:w-auto">
                    <h2 className="text-xl font-black uppercase dark:text-white leading-none mb-4 md:mb-0">Gerenciar Modelos</h2>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex-1 md:w-64 bg-white dark:bg-slate-900 border-2 dark:border-slate-800 rounded-2xl px-3 py-2.5 flex items-center gap-2 shadow-sm">
                        <Filter size={16} className="text-slate-400" />
                        <select
                            value={supplierFilter}
                            onChange={e => setSupplierFilter(e.target.value)}
                            title="Filtrar por Fornecedor"
                            aria-label="Filtrar por Fornecedor"
                            className="w-full bg-transparent text-[10px] font-black uppercase outline-none dark:text-white"
                        >
                            <option value="">Todos os Fornecedores</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        {supplierFilter && <button onClick={() => setSupplierFilter('')} title="Limpar Filtro" aria-label="Limpar Filtro"><X size={14} className="text-rose-500" /></button>}
                    </div>

                    <button onClick={() => { setFormData({ id: '', reference: '', supplierId: '', status: 'active', gridIds: [], variations: [], wholesaleStock: [], image: '', hasRetail: true, hasWholesale: true }); setIsAdding(true); setStep(1); }} title="Novo Modelo" aria-label="Novo Modelo" className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:scale-105 transition-all flex items-center gap-2 shrink-0">
                        <Plus size={16} /> Novo Modelo
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <RefreshCcw size={40} className="animate-spin mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Carregando Produtos do Backend...</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 px-2">
                    {filteredProducts.map(p => (
                        <div key={p.id} className={`bg-white dark:bg-slate-900 border-2 ${p.status === 'active' ? 'dark:border-slate-800' : 'border-rose-100 dark:border-rose-900/30'} p-2 rounded-[2rem] shadow-sm group hover:border-blue-500 transition-all flex flex-col relative overflow-hidden`}>
                            {p.status !== 'active' && (
                                <div className="absolute top-0 right-0 bg-rose-500 text-white text-[7px] font-black px-3 py-1 rounded-bl-xl z-20 shadow-lg">
                                    FORA DE LINHA
                                </div>
                            )}
                            <div className="aspect-square bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] overflow-hidden border dark:border-slate-800 flex items-center justify-center mb-3 relative">
                                {showMiniatures && p.image ? <img src={p.image} alt={`Foto do modelo ${p.reference}`} className={`w-full h-full object-cover ${p.status !== 'active' ? 'grayscale' : ''}`} /> : <Box size={32} className="text-slate-300" />}

                                {/* Botão Teleporte de Compra */}
                                {p.status === 'active' && onRequestPurchase && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRequestPurchase(p.supplierId); }}
                                        className="absolute bottom-2 right-2 p-2 bg-white/90 dark:bg-slate-900/90 text-emerald-600 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 z-10"
                                        title="Fazer Pedido deste Fornecedor"
                                    >
                                        <ShoppingBag size={16} />
                                    </button>
                                )}
                            </div>
                            <div className="px-2 pb-2">
                                <h4 className="text-[11px] font-black uppercase truncate dark:text-white mb-1">{p.reference}</h4>
                                <div className="flex gap-1.5">
                                    {p.hasRetail && <div className="p-1 bg-blue-500 text-white rounded shadow-sm"><Store size={10} /></div>}
                                    {p.hasWholesale && <div className="p-1 bg-indigo-500 text-white rounded shadow-sm"><Boxes size={10} /></div>}
                                </div>
                            </div>
                            <div className="mt-auto flex gap-1 p-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                                <button onClick={() => { setFormData(p); setIsAdding(true); setStep(1); }} title="Editar Modelo" aria-label="Editar Modelo" className="flex-1 py-2 flex justify-center text-amber-500 hover:bg-white rounded-xl transition-all"><Edit2 size={14} /></button>
                                <button onClick={() => confirm("Excluir permanentemente?") && onDelete(p.id)} title="Excluir Modelo" aria-label="Excluir Modelo" className="flex-1 py-2 flex justify-center text-rose-500 hover:bg-white rounded-xl transition-all"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isAdding && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[95vh] animate-slideUp">
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black">{step}</div>
                                <h4 className="text-xs font-black uppercase dark:text-white">{step === 1 ? 'Configuração do Modelo' : 'Geração de Variantes'}</h4>
                            </div>
                            <button onClick={() => setIsAdding(false)} title="Fechar Modal" aria-label="Fechar Modal" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20} /></button>
                        </div>

                        <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar flex-1 pb-32 lg:pb-10">
                            {step === 1 ? (
                                <div className="space-y-8">
                                    {/* ... (Step 1 form content stays the same) ... */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Status de Produção</label>
                                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                                    <button
                                                        onClick={() => setFormData({ ...formData, status: 'active' })}
                                                        title="Marcar como Em Linha" aria-label="Marcar como Em Linha"
                                                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${formData.status === 'active' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400'}`}
                                                    >
                                                        <Power size={12} /> Em Linha
                                                    </button>
                                                    <button
                                                        onClick={() => setFormData({ ...formData, status: 'inactive' })}
                                                        title="Marcar como Fora de Linha" aria-label="Marcar como Fora de Linha"
                                                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${formData.status !== 'active' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400'}`}
                                                    >
                                                        <Ban size={12} /> Fora de Linha
                                                    </button>
                                                </div>
                                                {formData.status !== 'active' && <p className="text-[8px] font-bold text-rose-500 pl-1 pt-1">* Produtos fora de linha não podem ser vendidos ou comprados.</p>}
                                            </div>

                                            <Field label="Referência / Modelo" value={formData.reference} onChange={v => setFormData({ ...formData, reference: v.toUpperCase() })} placeholder="Ex: TÊNIS NIKE" />

                                            <SearchableSelect
                                                label="Fornecedor Principal"
                                                options={suppliers}
                                                value={formData.supplierId}
                                                onChange={id => setFormData({ ...formData, supplierId: id })}
                                                placeholder="Quem fabrica?"
                                            />

                                            <div className="space-y-3 pt-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Modalidades de Venda</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => setFormData({ ...formData, hasRetail: !formData.hasRetail })}
                                                        title={formData.hasRetail ? "Desativar modalidade Varejo" : "Ativar modalidade Varejo"} aria-label={formData.hasRetail ? "Desativar modalidade Varejo" : "Ativar modalidade Varejo"}
                                                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${formData.hasRetail ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}
                                                    >
                                                        <Store size={20} />
                                                        <span className="text-[10px] font-black uppercase">Varejo</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setFormData({ ...formData, hasWholesale: !formData.hasWholesale })}
                                                        title={formData.hasWholesale ? "Desativar modalidade Atacado" : "Ativar modalidade Atacado"} aria-label={formData.hasWholesale ? "Desativar modalidade Atacado" : "Ativar modalidade Atacado"}
                                                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${formData.hasWholesale ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}
                                                    >
                                                        <Boxes size={20} />
                                                        <span className="text-[10px] font-black uppercase">Atacado</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Foto Principal</label>
                                            <div className="aspect-square md:aspect-video bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden hover:bg-slate-100 transition-colors group">
                                                {formData.image ? (
                                                    <>
                                                        <img src={formData.image} alt="Pré-visualização da foto do produto" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            <RefreshCcw size={24} className="text-white" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ImageIcon size={40} className="text-slate-300 mb-2" />
                                                        <p className="text-[9px] font-black text-slate-400 uppercase">Clique para subir foto</p>
                                                    </>
                                                )}
                                                <input type="file" accept="image/*" title="Fazer upload de foto principal" aria-label="Fazer upload de foto principal" onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const r = new FileReader();
                                                        r.onload = () => setFormData({ ...formData, image: r.result as string });
                                                        r.readAsDataURL(file);
                                                    }
                                                }} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Escolher Grades (Tamanhos)</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {grids.map(g => (
                                                        <button
                                                            key={g.id}
                                                            onClick={() => toggleGridId(g.id)}
                                                            title={`Selecionar grade ${g.name}`}
                                                            aria-label={`Selecionar grade ${g.name}`}
                                                            className={`px-4 py-2.5 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${formData.gridIds?.includes(g.id) ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}
                                                        >
                                                            {g.name}
                                                        </button>
                                                    ))}
                                                    {grids.length === 0 && <p className="text-[9px] text-rose-500 font-bold uppercase">* Nenhuma grade cadastrada.</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setStep(2)}
                                        className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                                    >
                                        Prosseguir para Variantes <ChevronRight size={20} />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* ... (Step 2 content remains largely same) ... */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border-2 border-blue-100 dark:border-blue-900/20">
                                        <div className="flex flex-col md:flex-row items-center gap-6">
                                            <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-blue-300 flex items-center justify-center relative overflow-hidden shrink-0 group">
                                                {currentVarImage ? (
                                                    <img src={currentVarImage} alt="Pré-visualização da variante" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Camera size={30} className="text-blue-200 group-hover:scale-110 transition-transform" />
                                                )}
                                                <input type="file" accept="image/*" title="Foto para a cor selecionada" aria-label="Foto para a cor selecionada" onChange={e => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const r = new FileReader();
                                                        r.onload = () => setCurrentVarImage(r.result as string);
                                                        r.readAsDataURL(file);
                                                    }
                                                }} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            </div>

                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                                                <div className="md:col-span-1">
                                                    <select
                                                        value={currentColorId}
                                                        onChange={e => setCurrentColorId(e.target.value)}
                                                        title="Selecione a Cor"
                                                        aria-label="Selecione a Cor"
                                                        className="w-full h-12 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 text-[11px] font-black uppercase outline-none focus:border-blue-500"
                                                    >
                                                        <option value="">Escolher Cor...</option>
                                                        {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex gap-2 h-12">
                                                    <div className="flex-1 relative">
                                                        <input type="number" title="Preço de Custo" aria-label="Preço de Custo" value={defaultPrices.cost} onChange={e => setDefaultPrices({ ...defaultPrices, cost: e.target.value })} className="w-full h-full pl-9 pr-2 bg-white dark:bg-slate-900 border-2 rounded-xl text-xs font-black" placeholder="Custo" />
                                                        <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <input type="number" title="Preço de Venda" aria-label="Preço de Venda" value={defaultPrices.sale} onChange={e => setDefaultPrices({ ...defaultPrices, sale: e.target.value })} className="w-full h-full pl-9 pr-2 bg-white dark:bg-slate-900 border-2 rounded-xl text-xs font-black" placeholder="Venda" />
                                                        <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleGenerateUniversal}
                                                    title="Gerar Cor" aria-label="Gerar Cor"
                                                    className="h-12 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Zap size={16} /> Gerar Cor
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Array.from(new Set([
                                            ...formData.variations.map(v => v.colorId),
                                            ...(formData.wholesaleStock || []).map(ws => ws.colorId)
                                        ])).map(colorId => {
                                            const varsOfColor = formData.variations.filter(v => v.colorId === colorId);
                                            const wholesaleOfColor = (formData.wholesaleStock || []).filter(ws => ws.colorId === colorId);
                                            const img = varsOfColor[0]?.image || wholesaleOfColor[0]?.image;
                                            const cName = colors.find(c => c.id === colorId)?.name || colorId;
                                            return (
                                                <div key={colorId} className="p-4 bg-white dark:bg-slate-800 border-2 dark:border-slate-700 rounded-[2rem] flex flex-col gap-3 shadow-sm hover:border-blue-400 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 overflow-hidden border dark:border-slate-700 flex items-center justify-center shadow-inner shrink-0">
                                                                {img ? <img src={img} alt={`Foto da cor ${cName}`} className="w-full h-full object-cover" /> : <Box size={20} className="text-slate-300" />}
                                                            </div>
                                                            <div>
                                                                <h5 className="text-[11px] font-black uppercase dark:text-white leading-none">{cName}</h5>
                                                                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                                                                    {varsOfColor.length > 0 && `${varsOfColor.length} Varejo`}
                                                                    {varsOfColor.length > 0 && wholesaleOfColor.length > 0 && ' • '}
                                                                    {wholesaleOfColor.length > 0 && `${wholesaleOfColor.length} Atacado`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => setEditingColor(colorId)}
                                                                title={`Editar cor ${cName}`} aria-label={`Editar cor ${cName}`}
                                                                className="p-2 text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 rounded-lg transition-colors"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => setFormData({ ...formData, variations: formData.variations.filter(v => v.colorId !== colorId), wholesaleStock: formData.wholesaleStock.filter(ws => ws.colorId !== colorId) })}
                                                                title={`Excluir cor ${cName}`} aria-label={`Excluir cor ${cName}`}
                                                                className="p-2 text-rose-500 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {formData.variations.length === 0 && (
                                            <div className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] opacity-30">
                                                <AlertTriangle size={40} className="mb-2" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma cor gerada ainda</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-4 pt-6 border-t dark:border-slate-800">
                                        <button onClick={() => setStep(1)} title="Voltar para as Configurações" aria-label="Voltar para as Configurações" className="flex-1 py-5 border-2 border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 rounded-[2rem] hover:bg-slate-50 transition-colors">Voltar Configurações</button>
                                        <button
                                            disabled={isSaving}
                                            onClick={handleSaveProduct}
                                            title="Finalizar e Salvar Produto"
                                            aria-label="Finalizar e Salvar Produto"
                                            className={`flex-[2] py-5 rounded-[2rem] font-black uppercase text-[11px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white shadow-emerald-600/20'}`}
                                        >
                                            {isSaving ? <RefreshCcw className="animate-spin" size={16} /> : null}
                                            {isSaving ? 'Salvando...' : 'Finalizar & Salvar Produto'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const VariantDetailModal = ({ colorId, product, onChange, onClose, grids, colors }: { colorId: string, product: any, onChange: (p: any) => void, onClose: () => void, grids: AppGrid[], colors: AppColor[] }) => {
    const [retailItems, setRetailItems] = useState<Variation[]>(product.variations.filter((v: any) => v.colorId === colorId));
    const [wholesaleItems, setWholesaleItems] = useState<WholesaleStockItem[]>(product.wholesaleStock.filter((ws: any) => ws.colorId === colorId));
    const [tab, setTab] = useState<'retail' | 'wholesale'>('retail');

    // Estados para novo tamanho manual
    const [newSize, setNewSize] = useState('');
    const [newCost, setNewCost] = useState('');
    const [newSale, setNewSale] = useState('');

    const handleSave = () => {
        // Remove os itens antigos dessa cor e adiciona os novos editados
        const otherVariations = product.variations.filter((v: any) => v.colorId !== colorId);
        const otherWholesale = product.wholesaleStock.filter((ws: any) => ws.colorId !== colorId);

        onChange({
            ...product,
            variations: [...otherVariations, ...retailItems],
            wholesaleStock: [...otherWholesale, ...wholesaleItems]
        });
        onClose();
    };

    const handleUpdateRetail = (id: string, field: keyof Variation, val: any) => {
        setRetailItems(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
    };

    const handleUpdateWholesale = (id: string, field: keyof WholesaleStockItem, val: any) => {
        setWholesaleItems(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
    };

    const handleAddRetailSize = () => {
        if (!newSize || !newCost || !newSale) return alert("Preencha todos os campos");
        if (retailItems.some(v => v.size === newSize)) {
            return alert("Este tamanho já existe para esta cor.");
        }
        const newItem: Variation = {
            id: generateId(),
            colorId: colorId,
            size: newSize,
            stock: 0,
            minStock: 2,
            costPrice: sanitizeNum(newCost),
            salePrice: sanitizeNum(newSale),
            unit: 'PAR',
            image: retailItems[0]?.image, // Herda a imagem dos outros
            gridId: retailItems[0]?.gridId
        };
        setRetailItems([...retailItems, newItem]);
        setNewSize('');
    };

    const handleImageUpload = (id: string, file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            handleUpdateRetail(id, 'image', result);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] animate-slideUp overflow-hidden">
                <div className="p-6 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <div>
                        <h4 className="text-sm font-black uppercase dark:text-white">Editando: {colors.find(c => c.id === colorId)?.name || colorId}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Detalhes de Estoque e Preços</p>
                    </div>
                    <button onClick={onClose} title="Fechar Modal" aria-label="Fechar Modal" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="flex p-2 bg-slate-100 dark:bg-slate-950 border-b dark:border-slate-800">
                    <button onClick={() => setTab('retail')} title="Aba Varejo" aria-label="Aba Varejo" className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${tab === 'retail' ? 'bg-white dark:bg-slate-800 shadow-md text-blue-600' : 'text-slate-400'}`}>Varejo (Peças)</button>
                    <button onClick={() => setTab('wholesale')} title="Aba Atacado" aria-label="Aba Atacado" className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${tab === 'wholesale' ? 'bg-white dark:bg-slate-800 shadow-md text-indigo-600' : 'text-slate-400'}`}>Atacado (Caixas)</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 pb-32 lg:pb-10">
                    {tab === 'retail' && (
                        <>
                            <div className="space-y-3">
                                {retailItems.map((item, idx) => (
                                    <div key={item.id} className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl">
                                        <div className="relative group/img cursor-pointer shrink-0">
                                            <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-xl overflow-hidden border dark:border-slate-600 shadow-sm">
                                                {item.image ? <img src={item.image} alt={`Foto do item ${item.size}`} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-300 m-auto h-full" />}
                                            </div>
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center rounded-xl transition-all">
                                                <Camera size={16} className="text-white" />
                                            </div>
                                            <input type="file" accept="image/*" title={`Alterar foto do item ${item.size}`} aria-label={`Alterar foto do item ${item.size}`} className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files?.[0] && handleImageUpload(item.id, e.target.files[0])} />
                                        </div>

                                        <div className="flex items-center gap-3 w-full sm:w-auto">
                                            <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center font-black text-xs shadow-sm shrink-0">{item.size}</div>
                                            <div className="sm:hidden text-[10px] font-bold text-slate-400">Tam. {item.size}</div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2 flex-1 w-full">
                                            <div className="space-y-1">
                                                <label className="text-[7px] font-black uppercase text-slate-400 pl-1">Estoque</label>
                                                <input type="number" title="Estoque Atual" aria-label="Estoque Atual" value={item.stock === 0 ? '' : item.stock} onChange={e => handleUpdateRetail(item.id, 'stock', e.target.value === '' ? 0 : sanitizeNum(e.target.value))} className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-xs font-bold text-center outline-none focus:border-blue-500" />
                                            </div>

                                            {/* CAMPO DE MÍNIMO COM CORREÇÃO DE ZERO */}
                                            <div className="space-y-1">
                                                <label className="text-[7px] font-black uppercase text-rose-400 pl-1">Mínimo</label>
                                                <input
                                                    type="number"
                                                    title="Estoque Mínimo" aria-label="Estoque Mínimo"
                                                    value={item.minStock === 0 ? '' : item.minStock}
                                                    onChange={e => handleUpdateRetail(item.id, 'minStock', e.target.value === '' ? 0 : sanitizeNum(e.target.value))}
                                                    className="w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-lg px-2 py-1.5 text-xs font-bold text-center outline-none focus:border-rose-500 text-rose-600"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[7px] font-black uppercase text-slate-400 pl-1">Custo</label>
                                                <input
                                                    type="number"
                                                    title="Preço de Custo" aria-label="Preço de Custo"
                                                    value={item.costPrice === 0 ? '' : item.costPrice}
                                                    onChange={e => handleUpdateRetail(item.id, 'costPrice', e.target.value === '' ? 0 : sanitizeNum(e.target.value))}
                                                    className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-xs font-bold text-center outline-none focus:border-blue-500"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[7px] font-black uppercase text-slate-400 pl-1">Venda</label>
                                                <input
                                                    type="number"
                                                    title="Preço de Venda" aria-label="Preço de Venda"
                                                    value={item.salePrice === 0 ? '' : item.salePrice}
                                                    onChange={e => handleUpdateRetail(item.id, 'salePrice', e.target.value === '' ? 0 : sanitizeNum(e.target.value))}
                                                    className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-xs font-bold text-center outline-none focus:border-blue-500"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <button onClick={() => setRetailItems(prev => prev.filter(i => i.id !== item.id))} title="Excluir Tamanho" aria-label="Excluir Tamanho" className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800">
                                <h5 className="text-[9px] font-black uppercase text-blue-600 mb-3">Adicionar Novo Tamanho Manualmente</h5>
                                <div className="grid grid-cols-4 gap-2 items-end">
                                    <Field label="Tam" placeholder="Ex: 46" value={newSize} onChange={setNewSize} />
                                    <Field label="Custo" placeholder="0.00" value={newCost} onChange={setNewCost} type="number" />
                                    <Field label="Venda" placeholder="0.00" value={newSale} onChange={setNewSale} type="number" />
                                    <button onClick={handleAddRetailSize} title="Adicionar Tamanho" aria-label="Adicionar Tamanho" className="h-[42px] bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg"><Plus size={18} /></button>
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 'wholesale' && (
                        <div className="space-y-3">
                            {wholesaleItems.map((item, idx) => {
                                const grid = grids.find(g => g.id === item.gridId);
                                const distName = grid?.distributions?.find(d => d.id === item.distributionId)?.name || 'Padrão';

                                return (
                                    <div key={item.id} className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg">{distName}</span>
                                            <button onClick={() => setWholesaleItems(prev => prev.filter(i => i.id !== item.id))} title="Excluir Item Atacado" aria-label="Excluir Item Atacado" className="text-rose-500"><Trash2 size={16} /></button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[7px] font-black uppercase text-slate-400 pl-1">Qtd Caixas</label>
                                                <input type="number" title="Quantidade de Caixas" aria-label="Quantidade de Caixas" value={item.boxes === 0 ? '' : item.boxes} onChange={e => handleUpdateWholesale(item.id, 'boxes', e.target.value === '' ? 0 : sanitizeNum(e.target.value))} className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-2 text-xs font-bold text-center outline-none focus:border-indigo-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[7px] font-black uppercase text-slate-400 pl-1">Custo Cx</label>
                                                <input type="number" title="Custo por Caixa" aria-label="Custo por Caixa" value={item.costPricePerBox === 0 ? '' : item.costPricePerBox} onChange={e => handleUpdateWholesale(item.id, 'costPricePerBox', e.target.value === '' ? 0 : sanitizeNum(e.target.value))} className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-2 text-xs font-bold text-center outline-none focus:border-indigo-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[7px] font-black uppercase text-slate-400 pl-1">Venda Cx</label>
                                                <input type="number" title="Venda por Caixa" aria-label="Venda por Caixa" value={item.salePricePerBox === 0 ? '' : item.salePricePerBox} onChange={e => handleUpdateWholesale(item.id, 'salePricePerBox', e.target.value === '' ? 0 : sanitizeNum(e.target.value))} className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-2 text-xs font-bold text-center outline-none focus:border-indigo-500" />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {wholesaleItems.length === 0 && <p className="text-center text-[10px] uppercase text-slate-400 py-10">Nenhum item de atacado para esta cor.</p>}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-3">
                    <button onClick={onClose} title="Cancelar e Fechar" aria-label="Cancelar e Fechar" className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                    <button onClick={handleSave} title="Salvar Alterações" aria-label="Salvar Alterações" className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"><Check size={16} /> Salvar Alterações</button>
                </div>
            </div>
        </div>
    );
};
