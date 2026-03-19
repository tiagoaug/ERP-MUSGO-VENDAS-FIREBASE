
import React, { useState, useMemo } from 'react';
import { Product, Customer, Sale, Variation, CartItem, AppGrid, GridDistribution, PaymentRecord, SaleStatus, WholesaleStockItem } from '../types';
import { formatMoney, sanitizeNum, generateId, formatSaleToText, formatSaleToSeparationText } from '../lib/utils';
import { SearchableSelect } from '../components/SearchableSelect';
import { exportBudgetPDF } from '../lib/pdfGenerator';
import {
    Trash, X, MagnifyingGlass, ShoppingBag, Cube, Storefront, Check, Plus, Minus, CaretRight, ShoppingCart,
    ArrowLeft, ArrowRight, Hash, Calendar, DeviceMobile, NotePencil, CheckCircle, CaretDown, CaretUp,
    ArrowSquareOut, CreditCard, Wallet, Receipt, EyeSlash, User, Package, Image, Info, Sparkle, Warning, UserPlus, Archive, FileText, Clock, ReceiptX, DownloadSimple, ChartLine, Coins, GearSix, Note, ListChecks, Copy
} from '@phosphor-icons/react';

// Lucide compat aliases
const Trash2 = Trash;
const Settings = GearSix;
const Search = MagnifyingGlass;
const Store = Storefront;
const Boxes = Cube;
const Box = Cube;
const ChevronRight = CaretRight;
const Smartphone = DeviceMobile;
const FileEdit = NotePencil;
const CheckCircle2 = CheckCircle;
const ChevronDown = CaretDown;
const ChevronUp = CaretUp;
const ExternalLink = ArrowSquareOut;
const EyeOff = EyeSlash;
const ImageIcon = Image;
const Sparkles = Sparkle;
const AlertTriangle = Warning;
const ReceiptText = Receipt;
const Download = DownloadSimple;
const Activity = ChartLine;
const ArchiveIcon = Archive;

interface VenderViewProps {
    products: Product[];
    customers: Customer[];
    grids: AppGrid[];
    sales: Sale[];
    colors: any[];
    showMiniatures: boolean;
    onSale: (sale: Omit<Sale, 'id'>, usedBalance?: number) => void;
    onBack: () => void;
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

export const VenderView = ({ products, customers, grids, sales, colors, showMiniatures, onSale, onBack }: VenderViewProps) => {
    const [step, setStep] = useState<'selection' | 'payment'>('selection');
    const [orderMode, setOrderMode] = useState<'auto' | 'manual'>('auto');
    const [manualOrderNum, setManualOrderNum] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));

    const [isHeaderExpanded, setIsHeaderExpanded] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
    const [tempQtys, setTempQtys] = useState<Record<string, string>>({});

    const [awaitApproval, setAwaitApproval] = useState(false);
    const [amountPaidNow, setAmountPaidNow] = useState('');
    const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash');
    const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
    const [useStoreCredit, setUseStoreCredit] = useState(false);
    const [overriddenStatus, setOverriddenStatus] = useState<SaleStatus | null>(null);
    const [discount, setDiscount] = useState('');

    const cartTotal = useMemo(() => cart.reduce((acc, i) => acc + (i.price * i.quantity), 0), [cart]);
    const discountValue = useMemo(() => sanitizeNum(discount), [discount]);
    const finalTotal = useMemo(() => Math.max(0, cartTotal - discountValue), [cartTotal, discountValue]);

    const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);

    // Cálculos Financeiros do Cliente (Pendências e Haver)
    const customerFinancialStatus = useMemo(() => {
        if (!selectedCustomer) return { debt: 0, credit: 0 };

        const debt = sales
            .filter(s => s.customerId === selectedCustomer.id && !s.isPaid && s.status !== 'Cancelada' && s.status !== 'Aguardando Aprovação')
            .reduce((acc, s) => acc + (s.totalValue - s.amountPaid), 0);

        return {
            debt,
            credit: selectedCustomer.balance || 0
        };
    }, [selectedCustomer, sales]);

    // Verifica se há itens faltando no estoque (para definir status do pedido atual)
    const stockDeficit = useMemo(() => {
        let missingItemsCount = 0;
        cart.forEach(item => {
            let currentStock = 0;
            const product = products.find(p => p.id === item.productId);
            if (product) {
                if (item.isWholesale) {
                    // Soma todo o estoque disponível para aquela COR (normalizada) e GRADE
                    const itemCName = getColorName(item.colorId, colors);
                    currentStock = product.wholesaleStock
                        .filter(w => w.distributionId === item.distributionId && getColorName(w.colorId, colors) === itemCName)
                        .reduce((acc, w) => acc + sanitizeNum(w.boxes), 0);
                } else {
                    const targetVar = product.variations.find(va => va.id === item.variationId);
                    if (targetVar) {
                        const targetColorName = getColorName(targetVar.colorId, colors);
                        currentStock = product.variations
                            .filter(v => v.size === targetVar.size && getColorName(v.colorId, colors) === targetColorName)
                            .reduce((acc, v) => acc + sanitizeNum(v.stock), 0);
                    }
                }
            }
            if (item.quantity > currentStock) {
                missingItemsCount++;
            }
        });
        return missingItemsCount;
    }, [cart, products, colors]);

    const handleGoToPayment = () => {
        if (!customerId) {
            setIsHeaderExpanded(true);
            return alert("Selecione um cliente antes de prosseguir.");
        }
        if (cart.length === 0) return alert("O carrinho está vazio.");
        setStep('payment');
    };

    const handleFinalize = () => {
        const saleNumber = orderMode === 'auto'
            ? `PED-${Date.now().toString().slice(-6)}`
            : (manualOrderNum || `PED-${Date.now().toString().slice(-6)}`);

        let finalStatus = overriddenStatus || 'Pendente';
        if (!overriddenStatus) {
            if (stockDeficit > 0) {
                finalStatus = 'Aguardando Estoque';
            } else if (awaitApproval) {
                finalStatus = 'Aguardando Aprovação';
            }
        }

        // Bloqueio de segurança: Se for um status que baixa estoque e há déficit, exige confirmação
        const statusQueBaixaEstoque = ['Pendente', 'Em produção', 'Entregue', 'Coletado'];

        if (stockDeficit > 0 && statusQueBaixaEstoque.includes(finalStatus)) {
            const confirmOverride = window.confirm(
                `Atenção: Existem ${stockDeficit} itens com estoque insuficiente para este pedido.\n\n` +
                `O status selecionado (${finalStatus}) IRÁ DEDUZIR o estoque e pode deixá-lo negativo.\n\n` +
                `Deseja prosseguir assim mesmo? (Cancele para manter como 'Aguardando Estoque')`
            );
            if (!confirmOverride) {
                finalStatus = 'Aguardando Estoque';
                setOverriddenStatus(null);
            }
        }

        // Cálculo do valor pago
        let amountPaid = 0;
        let usedBalance = 0;

        // Se estiver usando crédito
        if (useStoreCredit && customerFinancialStatus.credit > 0 && finalStatus !== 'Aguardando Estoque' && !awaitApproval) {
            usedBalance = Math.min(finalTotal, customerFinancialStatus.credit);
        }

        if (finalStatus !== 'Aguardando Estoque' && !awaitApproval) {
            if (paymentType === 'cash') {
                amountPaid = finalTotal - usedBalance; // O resto paga em dinheiro
            } else {
                amountPaid = 0; // Se for crédito, só abate o haver (que é processado separadamente), o resto fica pendente
            }
        }

        // Se usou crédito suficiente para pagar tudo, marca como pago mesmo se tava marcado "A Prazo"
        const totalCovered = amountPaid + usedBalance;
        const isPaid = (finalStatus !== 'Aguardando Estoque' && !awaitApproval && totalCovered >= finalTotal);

        // Se for à vista, o vencimento é hoje. Se for a prazo, usa o dueDate selecionado.
        const finalDueDate = paymentType === 'cash' ? saleDate : dueDate;

        const saleData: Omit<Sale, 'id'> = {
            saleNumber,
            date: saleDate,
            dueDate: finalDueDate,
            customerId,
            items: cart.map(i => ({
                productId: i.productId,
                variationId: i.variationId,
                distributionId: i.distributionId,
                isWholesale: i.isWholesale,
                colorId: i.colorId,
                quantity: i.quantity,
                priceAtSale: i.price
            })),
            totalValue: finalTotal,
            amountPaid: amountPaid, // Apenas o valor monetário real pago agora
            isPaid,
            paymentType,
            status: finalStatus,
            discount: discountValue,
            requiresApproval: awaitApproval,
            paymentHistory: isPaid && amountPaid > 0 ? [{ id: generateId(), date: saleDate, amount: amountPaid, note: 'Pagamento Integral' }] : [],
            bankAccountId: paymentType === 'cash' ? undefined : undefined // VenderView não seleciona banco ainda, então vai pro caixa padrão (undefined)
        };

        onSale(saleData, usedBalance);
    };

    const toggleProduct = (id: string) => setExpandedProductId(prev => prev === id ? null : id);

    const handleQtyChange = (key: string, val: string) => {
        const sanitized = val.replace(/\D/g, '');
        setTempQtys(prev => ({ ...prev, [key]: sanitized }));
    };

    const adjustQty = (key: string, delta: number, currentInCart: number) => {
        const currentVal = tempQtys[key] !== undefined ? parseInt(tempQtys[key] || '0') : currentInCart;
        const next = Math.max(0, currentVal + delta);
        setTempQtys(prev => ({ ...prev, [key]: String(next) }));
    };

    const addItem = (p: Product, varOrDistId: string, isWholesale: boolean, colorId?: string) => {
        const cName = isWholesale ? getColorName(colorId, colors) : getColorName(colorId || p.variations.find(v => v.id === varOrDistId)?.colorId, colors);
        const key = `${p.id}-${varOrDistId}-${cName}`;
        const qtyStr = tempQtys[key];
        const qty = qtyStr === undefined ? 0 : parseInt(qtyStr || '0');

        if (qty < 0) return alert("Quantidade inválida.");

        if (qty === 0) {
            setCart(prev => prev.filter(i =>
                isWholesale ? !(i.productId === p.id && i.distributionId === varOrDistId && i.colorId === colorId)
                    : !(i.productId === p.id && i.variationId === varOrDistId)
            ));
            return;
        }

        let availableStock = 0;
        let price = 0;
        let varName = "";
        let itemImage = p.image;

        if (isWholesale) {
            // Busca o estoque total somando todas as entradas da mesma cor (normalizada)
            const targetColorName = getColorName(colorId, colors);
            const stockItems = p.wholesaleStock.filter(ws =>
                ws.distributionId === varOrDistId &&
                getColorName(ws.colorId, colors) === targetColorName
            );
            availableStock = stockItems.reduce((acc, si) => acc + sanitizeNum(si.boxes), 0);

            const grid = grids.find(g => g.distributions?.some(d => d.id === varOrDistId));
            const dist = grid?.distributions?.find(d => d.id === varOrDistId);
            const pairsCount = dist ? (Object.values(dist.quantities) as number[]).reduce((a: number, b: number) => a + b, 0) : 0;

            const colorVar = p.variations.find(v => v.colorId === colorId);
            const basePrice = colorVar?.salePrice || p.variations[0]?.salePrice || 0;

            price = basePrice * pairsCount;
            varName = `CX ${dist?.name}`;
            itemImage = colorVar?.image || p.image;
        } else {
            const v = p.variations.find(v => v.id === varOrDistId);
            if (v) {
                const targetColorName = getColorName(v.colorId, colors);
                availableStock = p.variations
                    .filter(va => va.size === v.size && getColorName(va.colorId, colors) === targetColorName)
                    .reduce((acc, va) => acc + sanitizeNum(va.stock), 0);
            }
            price = v?.salePrice || 0;
            varName = `Tam ${v?.size}`; // Ditto for variation name.
            itemImage = v?.image || p.image;
        }

        setCart(prev => {
            const addItemColorName = getColorName(colorId || (p.variations.find(v => v.id === varOrDistId)?.colorId), colors);
            const existingIdx = prev.findIndex(i =>
                isWholesale
                    ? (i.productId === p.id && i.distributionId === varOrDistId && getColorName(i.colorId, colors) === addItemColorName)
                    : (i.productId === p.id && i.variationId === varOrDistId && getColorName(i.colorId, colors) === addItemColorName)
            );

            const newItem = {
                productId: p.id,
                variationId: !isWholesale ? varOrDistId : undefined,
                distributionId: isWholesale ? varOrDistId : undefined,
                isWholesale,
                colorId: colorId || p.variations.find(v => v.id === varOrDistId)?.colorId,
                quantity: qty,
                priceAtSale: price,
                name: p.reference,
                variationName: varName,
                price,
                image: itemImage
            };

            if (existingIdx > -1) {
                const updated = [...prev];
                updated[existingIdx] = newItem;
                return updated;
            }
            return [...prev, newItem];
        });
    };

    const filteredProducts = useMemo(() => {
        return products.filter(p => p.status === 'active' && p.reference.toLowerCase().includes(productSearch.toLowerCase()));
    }, [products, productSearch]);

    return (
        <div className="max-w-5xl mx-auto h-full flex flex-col gap-3 animate-fadeIn px-2">
            <div className={`bg-white dark:bg-slate-900 rounded-[2rem] border-2 transition-all ${!customerId && step === 'selection' ? 'border-amber-400 shadow-amber-50' : 'dark:border-slate-800'} overflow-hidden p-2.5 shadow-sm`}>
                <div onClick={() => setIsHeaderExpanded(!isHeaderExpanded)} className="flex justify-between items-center cursor-pointer p-1">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 ${!customerId ? 'bg-amber-500' : 'bg-blue-600'} text-white rounded-2xl shadow-lg`}>
                            {!customerId ? <UserPlus size={18} /> : <User size={18} />}
                        </div>
                        <div>
                            <h2 className="text-[10px] font-black uppercase dark:text-white leading-none tracking-widest">Dados do Pedido</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                {selectedCustomer ? `Cliente: ${selectedCustomer.name}` : 'Toque para selecionar cliente'}
                            </p>
                        </div>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 shrink-0 ${isHeaderExpanded ? 'bg-amber-500 border-amber-500 text-white rotate-180 shadow-lg shadow-amber-500/30' : 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400'}`}>
                        <ChevronDown size={18} />
                    </div>
                </div>
                {isHeaderExpanded && (
                    <div className="mt-4 p-2 space-y-4 animate-fadeIn max-h-[40vh] md:max-h-none overflow-y-auto md:overflow-visible custom-scrollbar">
                        <SearchableSelect label="Selecione o Cliente" options={customers} value={customerId} onChange={setCustomerId} placeholder="Quem está comprando?" />
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400 pl-1">Data</label>
                                <input title="Data da Venda" aria-label="Data da Venda" type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-black dark:text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400 pl-1">Modo do Número</label>
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                    <button onClick={() => { setOrderMode('auto'); setManualOrderNum(''); }} className={`flex-1 py-1.5 text-[8px] font-black rounded-lg transition-all ${orderMode === 'auto' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-400'}`}>AUTO</button>
                                    <button onClick={() => setOrderMode('manual')} className={`flex-1 py-1.5 text-[8px] font-black rounded-lg transition-all ${orderMode === 'manual' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-400'}`}>FIXO</button>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-400 pl-1">Número do Pedido</label>
                            <input
                                title="Número do Pedido"
                                aria-label="Número do Pedido"
                                type="text"
                                value={orderMode === 'auto' ? 'GERADO AO FINALIZAR' : manualOrderNum}
                                onChange={e => setManualOrderNum(e.target.value.toUpperCase())}
                                disabled={orderMode === 'auto'}
                                placeholder="DIGITE O NÚMERO"
                                className={`w-full bg-slate-50 dark:bg-slate-800 border-2 rounded-xl px-3 py-2.5 text-xs font-black outline-none transition-all ${orderMode === 'auto' ? 'border-transparent text-slate-400 cursor-not-allowed' : 'border-amber-400 shadow-amber-50 dark:border-amber-500/50 dark:text-white focus:border-blue-500'}`}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ALERTAS FINANCEIROS DO CLIENTE */}
            {selectedCustomer && step === 'selection' && (
                <div className="grid grid-cols-2 gap-3 animate-fadeIn px-1">
                    {customerFinancialStatus.debt > 0 ? (
                        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 p-3 rounded-2xl flex items-center gap-3">
                            <div className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 p-2 rounded-xl">
                                <AlertTriangle size={16} />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase">Dívidas Anteriores</p>
                                <p className="text-xs font-black text-rose-600">R$ {formatMoney(customerFinancialStatus.debt)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl flex items-center gap-3 border border-slate-100 dark:border-slate-700 opacity-60">
                            <div className="bg-slate-200 dark:bg-slate-700 text-slate-400 p-2 rounded-xl"><CheckCircle2 size={16} /></div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">Sem pendências</p>
                        </div>
                    )}

                    {customerFinancialStatus.credit > 0 ? (
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-3 rounded-2xl flex items-center gap-3">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 p-2 rounded-xl">
                                <Coins size={16} />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase">Haver Disponível</p>
                                <p className="text-xs font-black text-emerald-600">R$ {formatMoney(customerFinancialStatus.credit)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl flex items-center gap-3 border border-slate-100 dark:border-slate-700 opacity-60">
                            <div className="bg-slate-200 dark:bg-slate-700 text-slate-400 p-2 rounded-xl"><Wallet size={16} /></div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">Sem Crédito</p>
                        </div>
                    )}
                </div>
            )}

            {step === 'selection' ? (
                <div className="flex-1 flex flex-col gap-3 min-h-0">
                    <div className="relative mx-1">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input title="Buscar no catálogo" aria-label="Buscar no catálogo" type="text" placeholder="BUSCAR NO CATÁLOGO..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="w-full bg-white dark:bg-slate-900 border-2 dark:border-slate-800 rounded-[1.5rem] pl-14 pr-4 py-4.5 text-[10px] font-black uppercase outline-none shadow-sm focus:border-blue-500 transition-all" />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-4 pb-44 lg:pb-12">
                        {filteredProducts.map(p => {
                            const isExpanded = expandedProductId === p.id;
                            const inCartForThisProduct = cart.filter(i => i.productId === p.id);
                            const hasItems = inCartForThisProduct.length > 0;

                            // Calcula estoque total para exibição
                            const totalRetailStock = p.variations.reduce((acc, v) => acc + v.stock, 0);
                            const totalWholesaleStock = p.wholesaleStock.reduce((acc, ws) => acc + ws.boxes, 0);

                            // Detecta distribuições únicas para exibir no cabeçalho
                            const wholesaleDistributions = Array.from(new Set(p.wholesaleStock.map(ws => ws.distributionId)));
                            const primaryDistId = wholesaleDistributions[0];
                            const primaryDist = grids.flatMap(g => g.distributions || []).find(d => d.id === primaryDistId);
                            const primaryPairs = primaryDist ? (Object.values(primaryDist.quantities) as number[]).reduce((a: number, b: number) => a + b, 0) : 0;
                            const showHeaderDistInfo = wholesaleDistributions.length === 1 && primaryDist;

                            return (
                                <div key={p.id} className={`bg-white dark:bg-slate-900 border-2 transition-all duration-300 rounded-[2.2rem] overflow-hidden shadow-sm ${hasItems ? 'border-emerald-500 shadow-emerald-50 dark:shadow-none' : 'dark:border-slate-800'}`}>
                                    <button onClick={() => toggleProduct(p.id)} className={`w-full p-4 flex items-center gap-4 transition-colors ${hasItems ? 'bg-emerald-50/30 dark:bg-emerald-900/5' : 'hover:bg-slate-50'}`}>
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl overflow-hidden border-2 dark:border-slate-700 flex items-center justify-center shrink-0">
                                            {showMiniatures && p.image ? <img src={p.image} className="w-full h-full object-cover" alt={`Miniatura do produto ${p.reference}`} /> : <Box size={28} className="text-slate-300" />}
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <h4 className="text-[13px] font-black uppercase dark:text-white truncate">{p.reference}</h4>

                                            {/* ESTOQUE REAL ABAIXO DO PRODUTO */}
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {p.hasRetail && (
                                                    <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                        Varejo: {totalRetailStock} Unid
                                                    </span>
                                                )}
                                                {p.hasWholesale && (
                                                    <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                        Atacado: {totalWholesaleStock} Cxs
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${hasItems ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    {hasItems ? `${inCartForThisProduct.length} VARIAÇÕES` : 'NENHUM ITEM'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 border-2 ${isExpanded ? 'bg-amber-500 border-amber-500 text-white rotate-180 shadow-amber-500/30' : 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400'}`}>
                                            <ChevronDown size={20} />
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="p-5 pt-0 space-y-4 animate-fadeIn border-t dark:border-slate-800 bg-zinc-900/60 dark:bg-slate-800/40">

                                            {p.hasRetail && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 px-2 pt-4">
                                                        <Store size={14} className="text-blue-400" />
                                                        <span className="text-[9px] font-black uppercase text-zinc-400">Unidades Disponíveis (Varejo)</span>
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

                                                        // Agrupar por cor para a nova UI
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
                                                                <div className="space-y-2">
                                                                    {vars.map(v => {
                                                                        const cNameKey = getColorName(v.colorId, colors);
                                                                        const key = `${p.id}-${v.id}-${cNameKey}`;
                                                                        const inCart = cart.find(i => i.productId === p.id && i.variationId === v.id && getColorName(i.colorId, colors) === cNameKey);
                                                                        const currentQtyVal = tempQtys[key] !== undefined ? tempQtys[key] : (inCart ? String(inCart.quantity) : '0');
                                                                        const qtyNum = parseInt(currentQtyVal || '0');
                                                                        const missing = Math.max(0, qtyNum - v.stock);
                                                                        const isDeficit = missing > 0;

                                                                        const reserved = sales.filter(s => s.status === 'Aguardando Aprovação').reduce((acc, sale) => {
                                                                            const item = sale.items.find(i => i.variationId === v.id);
                                                                            return acc + (item ? item.quantity : 0);
                                                                        }, 0);

                                                                        const backlog = sales.filter(s => s.status === 'Aguardando Estoque').reduce((acc, sale) => {
                                                                            const item = sale.items.find(i => i.variationId === v.id);
                                                                            return acc + (item ? item.quantity : 0);
                                                                        }, 0);

                                                                        // FEEDBACK VISUAL ESTOQUE (Verde/Amarelo)
                                                                        const isLowStock = v.stock <= (v.minStock || 0);
                                                                        const stockColorClass = v.stock > (v.minStock || 0) ? 'text-emerald-400' : 'text-amber-400';

                                                                        return (
                                                                            <div key={v.id} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${inCart ? (isDeficit ? 'border-amber-400 bg-amber-50/10' : 'border-emerald-400 bg-emerald-50/10') : 'border-transparent bg-slate-50/50 dark:bg-slate-800/30'}`}>
                                                                                <div className="flex flex-col flex-1 min-w-0 pr-2">
                                                                                    <span className={`text-[10px] font-black uppercase ${inCart ? (isDeficit ? 'text-amber-600' : 'text-emerald-600') : 'dark:text-white'}`}>
                                                                                        TAM {v.size}
                                                                                    </span>
                                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                                        <span className={`text-[10px] font-black ${stockColorClass} bg-white dark:bg-slate-800 px-1.5 rounded border dark:border-slate-700 uppercase`}>Físico: {v.stock}</span>
                                                                                        {reserved > 0 && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 rounded capitalize border dark:border-slate-700">Análise: {reserved}</span>}
                                                                                        {backlog > 0 && <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 rounded capitalize border dark:border-slate-700">Espera: {backlog}</span>}
                                                                                    </div>
                                                                                    <span className="text-[8px] font-bold text-slate-400 mt-1">R$ {formatMoney(v.salePrice)}</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="flex items-center rounded-xl p-1 gap-1 bg-white dark:bg-slate-900 border dark:border-slate-800 shadow-inner">
                                                                                        <button onClick={() => adjustQty(key, -1, inCart?.quantity || 0)} title="Diminuir quantidade" className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors"><Minus size={12} /></button>
                                                                                        <input type="text" inputMode="numeric" value={currentQtyVal} onChange={e => handleQtyChange(key, e.target.value)} title="Quantidade" placeholder="0" className="w-8 text-center text-[10px] font-black bg-transparent outline-none dark:text-white" />
                                                                                        <button onClick={() => adjustQty(key, 1, inCart?.quantity || 0)} title="Aumentar quantidade" className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors"><Plus size={12} /></button>
                                                                                    </div>
                                                                                    <button onClick={() => addItem(p, v.id, false, v.colorId)} title={inCart ? "Item no carrinho" : "Adicionar ao carrinho"} className={`w-9 h-9 flex items-center justify-center rounded-xl text-white shadow-md active:scale-90 transition-all ${inCart ? (isDeficit ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-blue-600'}`}>
                                                                                        {inCart ? (isDeficit ? <AlertTriangle size={16} /> : <Check size={16} />) : <Plus size={16} />}
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}

                                            {p.hasWholesale && p.wholesaleStock.length > 0 && (
                                                <div className="space-y-3 pt-2">
                                                    <div className="flex items-center gap-2 px-2">
                                                        <Boxes size={14} className="text-indigo-400" />
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            <span className="text-[9px] font-black uppercase text-zinc-400">Caixas em Estoque (Atacado)</span>
                                                            {showHeaderDistInfo && (
                                                                <span className="text-[8px] font-bold text-indigo-400 bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-900/30">
                                                                    {primaryDist.name} ({primaryPairs} prs)
                                                                </span>
                                                            )}
                                                        </div>
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

                                                        // Agrupar por cor para a UI
                                                        const byColor: Record<string, any[]> = {};
                                                        mergedWS.forEach(w => {
                                                            const cName = getColorName(w.colorId, colors);
                                                            if (!byColor[cName]) byColor[cName] = [];
                                                            byColor[cName].push(w);
                                                        });

                                                        const colorIds = Object.keys(byColor); // Get color names to map over

                                                        return colorIds.map(colorName => (
                                                            <div key={colorName} className="p-3 bg-white dark:bg-slate-900/40 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm">
                                                                <div className="px-2 pb-1 border-b dark:border-slate-800 mb-2">
                                                                    <span className="text-[12px] font-black uppercase text-indigo-600 tracking-widest">{colorName}</span>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {(() => {
                                                                        const collapsedByDist: Record<string, { ws: WholesaleStockItem, totalBoxes: number }> = {};
                                                                        byColor[colorName].forEach(ws => {
                                                                            if (!collapsedByDist[ws.distributionId]) {
                                                                                collapsedByDist[ws.distributionId] = { ws, totalBoxes: 0 };
                                                                            }
                                                                            collapsedByDist[ws.distributionId].totalBoxes += sanitizeNum(ws.boxes);
                                                                        });

                                                                        return Object.values(collapsedByDist).map(({ ws, totalBoxes }) => {
                                                                            const cNameKey = getColorName(ws.colorId, colors);
                                                                            const key = `${p.id}-${ws.distributionId}-${cNameKey}`;

                                                                            const inCart = cart.find(i =>
                                                                                i.productId === p.id &&
                                                                                i.distributionId === ws.distributionId &&
                                                                                getColorName(i.colorId, colors) === cNameKey
                                                                            );

                                                                            const currentQtyVal = tempQtys[key] !== undefined ? tempQtys[key] : (inCart ? String(inCart.quantity) : '0');
                                                                            const dist = grids.flatMap(g => g.distributions || []).find(d => d.id === ws.distributionId);
                                                                            const pairs = dist ? (Object.values(dist.quantities) as number[]).reduce((a: any, b: any) => a + b, 0) : 0;
                                                                            const qtyNum = parseInt(currentQtyVal || '0');
                                                                            const isDeficit = inCart && (qtyNum > totalBoxes);

                                                                            const reserved = sales.filter(s => s.status === 'Aguardando Aprovação').reduce((acc, sale) => {
                                                                                const item = sale.items.find(i => i.distributionId === ws.distributionId && getColorName(i.colorId, colors) === cNameKey);
                                                                                return acc + (item ? item.quantity : 0);
                                                                            }, 0);

                                                                            const backlog = sales.filter(s => s.status === 'Aguardando Estoque').reduce((acc, sale) => {
                                                                                const item = sale.items.find(i => i.distributionId === ws.distributionId && getColorName(i.colorId, colors) === cNameKey);
                                                                                return acc + (item ? item.quantity : 0);
                                                                            }, 0);

                                                                            // FEEDBACK VISUAL ESTOQUE ATACADO (Verde/Amarelo - Referência: 2 caixas)
                                                                            const stockColorClass = totalBoxes > 2 ? 'text-emerald-400' : 'text-amber-400';

                                                                            return (
                                                                                <div key={ws.id} className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${inCart ? (isDeficit ? 'border-amber-400 bg-amber-50/10' : 'border-emerald-400 bg-emerald-50/10') : 'border-transparent bg-slate-50/50 dark:bg-slate-800/30'}`}>
                                                                                    <div className="flex flex-col flex-1 min-w-0 pr-2">
                                                                                        <span className={`text-[10px] font-black uppercase ${inCart ? (isDeficit ? 'text-amber-600' : 'text-emerald-600') : 'dark:text-white'}`}>
                                                                                            CX {!showHeaderDistInfo && <span className="text-slate-400 font-bold ml-1">({pairs} prs)</span>}
                                                                                        </span>
                                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                                            <span className={`text-[10px] font-black ${stockColorClass} bg-white dark:bg-slate-800 px-1.5 rounded border dark:border-slate-700 uppercase`}>Físico: {totalBoxes} cxs</span>
                                                                                            {reserved > 0 && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 rounded capitalize">Análise: {reserved}</span>}
                                                                                            {backlog > 0 && <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 rounded capitalize">Espera: {backlog}</span>}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="flex items-center rounded-xl p-1 gap-1 bg-white dark:bg-slate-900 border dark:border-slate-800 shadow-inner">
                                                                                            <button onClick={() => adjustQty(key, -1, inCart?.quantity || 0)} title="Diminuir caixas" className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors"><Minus size={12} /></button>
                                                                                            <input type="text" inputMode="numeric" value={currentQtyVal} onChange={e => handleQtyChange(key, e.target.value)} title="Quantidade de caixas" placeholder="0" className="w-8 text-center text-[10px] font-black bg-transparent outline-none dark:text-white" />
                                                                                            <button onClick={() => adjustQty(key, 1, inCart?.quantity || 0)} title="Aumentar caixas" className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-colors"><Plus size={12} /></button>
                                                                                        </div>
                                                                                        <button onClick={() => addItem(p, ws.distributionId, true, ws.colorId)} title={inCart ? "Caixas no carrinho" : "Adicionar caixas ao carrinho"} className={`w-9 h-9 flex items-center justify-center rounded-xl text-white shadow-md active:scale-90 transition-all ${inCart ? (isDeficit ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-indigo-600'}`}>
                                                                                            {inCart ? (isDeficit ? <AlertTriangle size={16} /> : <Check size={16} />) : <Plus size={16} />}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <div className="fixed bottom-[80px] lg:bottom-0 left-0 right-0 p-3 bg-white/95 dark:bg-slate-900/95 border-t z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] backdrop-blur-xl border-slate-100 dark:border-slate-800">
                        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 pr-24">
                            <div className="flex flex-col">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Subtotal Pedido</p>
                                <p className="text-xl font-black dark:text-white leading-none">R$ {formatMoney(cartTotal)}</p>
                            </div>
                            <button disabled={cart.length === 0} onClick={handleGoToPayment} className={`flex-1 max-w-sm px-6 py-3.5 text-white rounded-[2rem] text-[11px] font-black uppercase shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${stockDeficit > 0 ? 'bg-amber-500 shadow-amber-600/30' : 'bg-blue-600 shadow-blue-600/30'}`}>
                                {stockDeficit > 0 ? (
                                    <>
                                        <AlertTriangle size={18} /> VERIFICAR ({stockDeficit})
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={18} /> REVISAR E FINALIZAR
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col animate-slideUp">
                    <div className="p-5 border-b dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shadow-sm">
                        <button onClick={() => setStep('selection')} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors"><ArrowLeft size={18} /> Voltar</button>
                        <h3 className="text-xs font-black uppercase dark:text-white leading-none">Conferência Final</h3>
                        <div className="w-20"></div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar pb-72 lg:pb-44">
                        <div className="max-w-md mx-auto space-y-8">
                            {stockDeficit > 0 && (
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-[2rem] flex items-center gap-4 shadow-sm animate-pulse">
                                    <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl shrink-0"><AlertTriangle size={24} /></div>
                                    <div>
                                        <h4 className="text-[11px] font-black uppercase text-amber-700 dark:text-amber-400">Itens em Falta</h4>
                                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1">Este pedido será criado como "Aguardando Estoque". Compre os itens faltantes para liberar.</p>
                                    </div>
                                </div>
                            )}

                            {/* CARD DE SEPARAÇÃO (NOVO DESTAQUE) */}
                            <div className="p-6 bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 dark:to-slate-800 rounded-[2.5rem] border-2 border-blue-200 dark:border-slate-700 shadow-xl shadow-blue-600/5 relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                <div className="flex items-center gap-5 relative z-10">
                                    <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-600/20 group-hover:rotate-3 transition-transform">
                                        <ListChecks size={32} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[14px] font-black uppercase text-blue-700 dark:text-blue-400 tracking-tight">Lista de Separação</h4>
                                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-1 leading-tight">Gere e visualize os itens agora para agilizar a logística</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-5 relative z-10">
                                    <button
                                        onClick={() => {
                                            // @ts-ignore
                                            import('../lib/pdfGenerator').then(m => m.exportSeparationListPDF({
                                                customer: selectedCustomer || { name: 'Cliente Geral' } as any,
                                                items: cart,
                                                date: saleDate
                                            }))
                                        }}
                                        className="py-3 bg-white dark:bg-slate-800 rounded-xl border-2 border-blue-100 dark:border-slate-700 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
                                    >
                                        <FileText size={16} /> PDF P/ IMPRESSÃO
                                    </button>
                                    <button
                                        onClick={() => {
                                            const text = formatSaleToSeparationText(
                                                { saleNumber: 'SEPAR', date: saleDate, items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, priceAtSale: i.price, variationId: i.variationId, distributionId: i.distributionId, colorId: i.colorId })), totalValue: finalTotal, amountPaid: 0, isPaid: false, paymentType: 'cash', status: 'Pendente', customerId: customerId || '' },
                                                selectedCustomer || { name: 'Cliente Geral' } as any,
                                                products,
                                                colors
                                            );
                                            navigator.clipboard.writeText(text);
                                            alert('Lista de separação copiada!');
                                        }}
                                        className="py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                                    >
                                        <Copy size={16} /> COPIAR TEXTO
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 dark:border-slate-800 overflow-hidden shadow-2xl">
                                <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"><ShoppingCart size={14} /> Carrinho</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => exportBudgetPDF({ customer: selectedCustomer, items: cart, totalValue: finalTotal, date: saleDate })} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase shadow-sm active:scale-95 transition-all">
                                            <Download size={14} /> PDF
                                        </button>
                                        <button
                                            onClick={() => {
                                                const text = formatSaleToText(
                                                    { saleNumber: 'ORÇAM', date: saleDate, items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, priceAtSale: i.price, variationId: i.variationId, distributionId: i.distributionId, colorId: i.colorId })), totalValue: finalTotal, amountPaid: 0, isPaid: false, paymentType: 'cash', status: 'Pendente', customerId: customerId || '' },
                                                    selectedCustomer,
                                                    products,
                                                    colors
                                                );
                                                window.open(`https://keep.google.com/u/0/#createNote?text=${encodeURIComponent(text)}`, '_blank');
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-600 rounded-full text-[9px] font-black uppercase shadow-sm active:scale-95 transition-all"
                                        >
                                            <Note size={14} weight="fill" /> Keep
                                        </button>
                                        <button
                                            onClick={() => {
                                                // @ts-ignore
                                                import('../lib/pdfGenerator').then(m => m.exportSeparationListPDF({
                                                    customer: selectedCustomer,
                                                    items: cart,
                                                    date: saleDate
                                                }))
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-[9px] font-black uppercase shadow-sm active:scale-95 transition-all"
                                        >
                                            <Archive size={14} /> Separação
                                        </button>
                                    </div>
                                </div>
                                <div className="divide-y dark:divide-slate-800">
                                    {cart.map((item, idx) => {
                                        // Verifica estoque individual
                                        let currentStock = 0;
                                        const product = products.find(p => p.id === item.productId);
                                        if (product) {
                                            if (item.isWholesale) {
                                                const itemCName = getColorName(item.colorId, colors);
                                                currentStock = product.wholesaleStock
                                                    .filter(w => w.distributionId === item.distributionId && getColorName(w.colorId, colors) === itemCName)
                                                    .reduce((acc, w) => acc + sanitizeNum(w.boxes), 0);
                                            } else {
                                                const targetVar = product.variations.find(va => va.id === item.variationId);
                                                if (targetVar) {
                                                    const targetColorName = getColorName(targetVar.colorId, colors);
                                                    currentStock = product.variations
                                                        .filter(v => v.size === targetVar.size && getColorName(v.colorId, colors) === targetColorName)
                                                        .reduce((acc, v) => acc + sanitizeNum(v.stock), 0);
                                                }
                                            }
                                        }
                                        const missing = Math.max(0, item.quantity - currentStock);
                                        const isMissing = missing > 0;

                                        return (
                                            <div key={idx} className={`p-5 flex items-center justify-between group ${isMissing ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-white dark:bg-slate-900'}`}>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-black uppercase dark:text-white truncate">{item.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{item.variationName}</p>

                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg">
                                                            {item.quantity} {item.isWholesale ? 'CX' : 'UN'} x R$ {formatMoney(item.price)}
                                                        </span>
                                                        {isMissing && (
                                                            <span className="text-[8px] font-black text-amber-600 bg-amber-100 px-2 py-1 rounded-lg uppercase flex items-center gap-1">
                                                                <AlertTriangle size={10} /> Falta comprar: {missing}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-5">
                                                    <p className="text-[13px] font-black text-emerald-600">R$ {formatMoney(item.quantity * item.price)}</p>
                                                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} title="Remover item do carrinho" aria-label="Remover item do carrinho" className="p-2.5 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={20} /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="p-8 bg-slate-900 text-white flex justify-between items-end">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex justify-between items-center opacity-40">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Subtotal</p>
                                            <span className="text-sm font-bold">R$ {formatMoney(cartTotal)}</span>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black uppercase text-indigo-400 pl-1">Desconto (R$)</label>
                                            <input
                                                title="Valor do Desconto"
                                                aria-label="Valor do Desconto"
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="0,00"
                                                value={discount}
                                                onChange={e => setDiscount(e.target.value.replace(/[^\d.,]/g, ''))}
                                                className="w-full bg-white/10 border-2 border-white/10 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-indigo-500 transition-all placeholder:text-white/20"
                                            />
                                        </div>

                                        <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                                            <div>
                                                <p className="text-[10px] font-black uppercase opacity-40 tracking-[0.3em] mb-1">Total Pedido</p>
                                                <span className="text-3xl font-black">R$ {formatMoney(finalTotal)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* BOTAO APROVACAO - AGORA SEMPRE VISIVEL (mesmo sem estoque) */}
                                <div className={`p-6 rounded-[2.5rem] border-2 transition-all shadow-sm flex items-center justify-between ${awaitApproval ? 'bg-amber-50 border-amber-400 dark:bg-amber-900/10' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-[1.2rem] shadow-xl transition-colors ${awaitApproval ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <Clock size={26} />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black uppercase dark:text-white leading-none">
                                                Aprovação Necessária?
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1.5">
                                                {stockDeficit > 0 ? 'Ficará "Em Análise" após chegada do estoque.' : 'Reserva estoque s/ movimentar caixa'}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => setAwaitApproval(!awaitApproval)} title="Alternar Necessidade de Aprovação" aria-label="Alternar Necessidade de Aprovação" className={`w-15 h-8 rounded-full p-1.5 transition-all shadow-inner ${awaitApproval ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-all ${awaitApproval ? 'translate-x-7' : ''}`}></div>
                                    </button>
                                </div>


                                {stockDeficit === 0 && !awaitApproval && (
                                    <div className="space-y-4">
                                        {/* USO DE CRÉDITO / HAVER */}
                                        {customerFinancialStatus.credit > 0 && (
                                            <div className={`p-6 rounded-[2.5rem] border-2 transition-all shadow-sm flex items-center justify-between ${useStoreCredit ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-900/10' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-[1.2rem] shadow-xl transition-colors ${useStoreCredit ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                        <Coins size={26} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-black uppercase dark:text-white leading-none">
                                                            Usar Haver (Crédito)
                                                        </p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1.5">
                                                            Saldo disponível: <span className="text-emerald-500">R$ {formatMoney(customerFinancialStatus.credit)}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <button onClick={() => setUseStoreCredit(!useStoreCredit)} title="Alternar Uso de Haver" aria-label="Alternar Uso de Haver" className={`w-15 h-8 rounded-full p-1.5 transition-all shadow-inner ${useStoreCredit ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-all ${useStoreCredit ? 'translate-x-7' : ''}`}></div>
                                                </button>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                                            <button onClick={() => setPaymentType('cash')} className={`p-7 rounded-[2.2rem] border-2 transition-all flex flex-col items-center gap-3 shadow-sm ${paymentType === 'cash' ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl -translate-y-1' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                                                <CheckCircle2 size={36} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">À VISTA</span>
                                            </button>
                                            <button onClick={() => setPaymentType('credit')} className={`p-7 rounded-[2.2rem] border-2 transition-all flex flex-col items-center gap-3 shadow-sm ${paymentType === 'credit' ? 'bg-blue-600 border-blue-600 text-white shadow-xl -translate-y-1' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                                                <Wallet size={36} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">PRAZO</span>
                                            </button>
                                        </div>

                                        {paymentType === 'credit' && (
                                            <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] border-2 border-blue-100 dark:border-blue-800 animate-fadeIn">
                                                <label className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-300 block mb-2 px-1">
                                                    Data de Vencimento do Pedido
                                                </label>
                                                <input
                                                    title="Data de Vencimento do Pedido" aria-label="Data de Vencimento do Pedido"
                                                    type="date"
                                                    value={dueDate}
                                                    onChange={e => setDueDate(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-700 rounded-2xl px-4 py-3.5 text-xs font-black outline-none text-slate-700 dark:text-white focus:border-blue-500 transition-colors shadow-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* SELEÇÃO MANUAL DE STATUS */}
                                <div className="p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                                    <div className="flex items-center gap-3 px-1">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                            <Settings size={16} />
                                        </div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Definir Status Manual</label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Pendente', 'Em produção', 'Entregue'].map((st) => (
                                            <button
                                                key={st}
                                                onClick={() => setOverriddenStatus(overriddenStatus === st ? null : st as SaleStatus)}
                                                className={`py-2.5 px-3 rounded-xl text-[9px] font-black uppercase transition-all border-2 ${overriddenStatus === st ? (st === 'Entregue' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-orange-500 border-orange-500 text-white shadow-md') : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400 hover:border-slate-200'}`}
                                            >
                                                {st}
                                            </button>
                                        ))}
                                    </div>
                                    {overriddenStatus && (
                                        <button onClick={() => setOverriddenStatus(null)} className="w-full py-2 text-[8px] font-black uppercase text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                            Limpar Seleção Manual
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="fixed bottom-[80px] lg:bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t z-50 shadow-2xl border-slate-100 dark:border-slate-800">
                        <div className="max-w-md mx-auto">
                            {useStoreCredit && customerFinancialStatus.credit > 0 && stockDeficit === 0 && !awaitApproval && (
                                <div className="mb-3 flex justify-between items-center px-2 text-[9px] font-black uppercase text-slate-500">
                                    <span>Abatendo do Haver:</span>
                                    <span className="text-emerald-600">- R$ {formatMoney(Math.min(finalTotal, customerFinancialStatus.credit))}</span>
                                </div>
                            )}
                            <button onClick={handleFinalize} className={`w-full py-4 rounded-[2rem] text-[12px] font-black uppercase shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${awaitApproval || stockDeficit > 0 ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-blue-600 text-white shadow-blue-600/30'}`}>
                                {stockDeficit > 0 ? (
                                    <>
                                        <AlertTriangle size={20} /> CRIAR PEDIDO AGUARDANDO ESTOQUE {awaitApproval ? '(+ APROV)' : ''}
                                    </>
                                ) : (
                                    <>
                                        {awaitApproval ? <ReceiptText size={20} /> : <CheckCircle2 size={20} />}
                                        {awaitApproval ? 'ENVIAR PARA APROVAÇÃO' : 'FINALIZAR VENDA'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
};
