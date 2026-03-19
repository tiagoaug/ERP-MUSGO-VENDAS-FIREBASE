
import React, { useState, useMemo } from 'react';
import { Sale, Customer, Product, Supplier, Purchase, Transaction } from '../types';
import { generateReportPDF } from '../lib/pdfGenerator';
import { BackupView } from './BackupView';
import { FileText, DownloadSimple, TrendUp, Users, Calendar, Funnel, Package, ShoppingBag, Truck, ChartBar, Printer, DeviceMobile, Cube, Warning, Wallet, ShieldCheck, Database, ClipboardText } from '@phosphor-icons/react';

// Lucide compat aliases
const Download = DownloadSimple;
const TrendingUp = TrendUp;
const Filter = Funnel;
const BarChart3 = ChartBar;
const Smartphone = DeviceMobile;
const Boxes = Cube;
const AlertCircle = Warning;
const ClipboardList = ClipboardText;
import { formatMoney, formatDate } from '../lib/utils';

interface RelatoriosViewProps {
    sales: Sale[];
    customers: Customer[];
    products: Product[];
    suppliers?: Supplier[];
    purchases?: Purchase[];
    transactions: Transaction[];
    colors: any[];
    // Backup Props
    onExport: () => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    getRawData: () => any;
    restoreData: (data: any) => void;
    onReset?: () => Promise<void>;
    onSync: () => Promise<void>;
    onTestConnection: () => Promise<{ success: boolean; message?: string }>;
}

type PeriodType = 'month' | 'quarter' | 'semester' | 'year' | 'all' | 'custom';
type CategoryType = 'clients' | 'products' | 'suppliers' | 'general' | 'backup';

export const RelatoriosView = ({
    sales = [], customers = [], products = [], suppliers = [], purchases = [], transactions = [], colors = [],
    onExport, onImport, getRawData, restoreData, onReset, onSync, onTestConnection
}: RelatoriosViewProps) => {
    const [activeCategory, setActiveCategory] = useState<CategoryType>('general');
    const [period, setPeriod] = useState<PeriodType>('month');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10)
    });
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');

    // --- LÓGICA DE FILTRO DE DATA ---
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
            start = new Date(2020, 0, 1);
            end = now;
        }

        setDateRange({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
    };

    const filteredSales = useMemo(() => {
        return sales.filter(s =>
            s.status !== 'Cancelada' &&
            (s.date || '').substring(0, 10) >= dateRange.start &&
            (s.date || '').substring(0, 10) <= dateRange.end &&
            (selectedCustomerId === 'all' || s.customerId === selectedCustomerId)
        );
    }, [sales, dateRange, selectedCustomerId]);

    const filteredPurchases = useMemo(() => {
        return purchases.filter(p =>
            (p.accounted ?? true) &&
            (p.date || '').substring(0, 10) >= dateRange.start &&
            (p.date || '').substring(0, 10) <= dateRange.end &&
            (selectedSupplierId === 'all' || p.supplierId === selectedSupplierId)
        );
    }, [purchases, dateRange, selectedSupplierId]);

    const dateLabel = useMemo(() => {
        if (period === 'all') return 'Todo o Período';
        return `${formatDate(dateRange.start)} à ${formatDate(dateRange.end)}`;
    }, [period, dateRange]);

    // --- GERADORES DE RELATÓRIOS ---

    const generateSalesByPeriod = (format: 'a4' | 'mobile') => {
        const data = filteredSales.map(s => [
            formatDate(s.date),
            s.saleNumber,
            customers.find(c => c.id === s.customerId)?.name || 'Consumidor',
            formatMoney(s.totalValue)
        ]);
        const total = filteredSales.reduce((acc, s) => acc + s.totalValue, 0);
        generateReportPDF(
            "Relatório de Vendas",
            ['DATA', 'PEDIDO', 'CLIENTE', 'VALOR'],
            data,
            [{ label: 'TOTAL VENDIDO', value: `R$ ${formatMoney(total)}` }],
            format,
            dateLabel
        );
    };

    const generateDetailedInventoryReport = (format: 'a4' | 'mobile') => {
        const rows: string[][] = [];
        let totalRetail = 0;
        let totalWholesale = 0;

        // Ordenar produtos alfabeticamente
        const sortedProducts = [...products].sort((a, b) => a.reference.localeCompare(b.reference));

        sortedProducts.forEach(p => {
            // Processar Varejo
            if (p.hasRetail) {
                p.variations.forEach(v => {
                    rows.push([
                        p.reference,
                        colors.find(c => c.id === v.colorId)?.name || v.colorId,
                        `Tam ${v.size}`,
                        v.stock.toString(),
                        'VAREJO'
                    ]);
                    totalRetail += v.stock;
                });
            }

            // Processar Atacado
            if (p.hasWholesale) {
                p.wholesaleStock.forEach(ws => {
                    rows.push([
                        p.reference,
                        colors.find(c => c.id === ws.colorId)?.name || ws.colorId,
                        'Cx Fechada',
                        ws.boxes.toString(),
                        'ATACADO'
                    ]);
                    totalWholesale += ws.boxes;
                });
            }
        });

        generateReportPDF(
            "Estoque Detalhado (Cor/Ref)",
            ['REF', 'COR', 'DETALHE', 'QTD', 'TIPO'],
            rows,
            [
                { label: 'TOTAL PEÇAS (VAREJO)', value: totalRetail.toString() },
                { label: 'TOTAL CAIXAS (ATACADO)', value: totalWholesale.toString() }
            ],
            format,
            "Posição Atual Completa"
        );
    };

    const generateTopProducts = (format: 'a4' | 'mobile') => {
        const productStats: Record<string, { name: string, qty: number, total: number }> = {};

        filteredSales.forEach(s => {
            s.items.forEach(i => {
                const p = products.find(prod => prod.id === i.productId);
                const colorLabel = colors.find(c => c.id === i.colorId)?.name || i.colorId || '';
                const name = p ? `${p.reference} ${colorLabel}` : 'Item Removido';
                if (!productStats[name]) productStats[name] = { name, qty: 0, total: 0 };
                productStats[name].qty += i.quantity;
                productStats[name].total += (i.quantity * i.priceAtSale);
            });
        });

        const sorted = Object.values(productStats).sort((a, b) => b.qty - a.qty);
        const data = sorted.map(i => [i.name, i.qty.toString(), formatMoney(i.total)]);

        generateReportPDF(
            "Produtos Mais Vendidos",
            ['PRODUTO', 'QTD', 'TOTAL'],
            data,
            [{ label: 'ITENS VENDIDOS', value: sorted.reduce((a, b) => a + b.qty, 0).toString() }],
            format,
            dateLabel
        );
    };

    const generateTopCustomers = (format: 'a4' | 'mobile') => {
        const custStats: Record<string, { name: string, count: number, total: number }> = {};

        filteredSales.forEach(s => {
            const cName = customers.find(c => c.id === s.customerId)?.name || 'Consumidor Final';
            if (!custStats[cName]) custStats[cName] = { name: cName, count: 0, total: 0 };
            custStats[cName].count += 1;
            custStats[cName].total += s.totalValue;
        });

        const sorted = Object.values(custStats).sort((a, b) => b.total - a.total);
        const data = sorted.map(c => [c.name, c.count.toString(), formatMoney(c.total)]);

        generateReportPDF(
            "Melhores Clientes (Ranking)",
            ['CLIENTE', 'PEDIDOS', 'TOTAL GASTO'],
            data,
            [{ label: 'TOP 1', value: sorted[0]?.name || '-' }],
            format,
            dateLabel
        );
    };

    const generateCustomerDebts = (format: 'a4' | 'mobile') => {
        // Clientes com saldo devedor GERAL (não depende de filtro de data, é estado atual)
        const debtors = customers
            .map(c => {
                const debt = sales
                    .filter(s => s.customerId === c.id && !s.isPaid && s.status !== 'Cancelada')
                    .reduce((acc, s) => acc + (s.totalValue - s.amountPaid), 0);
                return { name: c.name, phone: c.phone, debt };
            })
            .filter(c => c.debt > 0)
            .sort((a, b) => b.debt - a.debt);

        const data = debtors.map(d => {
            const customer = customers.find(c => c.name === d.name);
            return [d.name, d.phone || '-', formatMoney(customer?.balance || 0), formatMoney(d.debt)];
        });
        const totalDebt = debtors.reduce((acc, d) => acc + d.debt, 0);

        generateReportPDF(
            "Relatório de Inadimplência",
            ['CLIENTE', 'CONTATO', 'HAVER', 'DÍVIDA'],
            data,
            [{ label: 'TOTAL A RECEBER', value: `R$ ${formatMoney(totalDebt)}` }],
            format,
            "Posição Atual (Acumulado)"
        );
    };

    const generateCustomerCredits = (format: 'a4' | 'mobile') => {
        // Clientes com haver (crédito)
        const creditors = customers
            .filter(c => c.balance > 0 && (selectedCustomerId === 'all' || c.id === selectedCustomerId))
            .sort((a, b) => b.balance - a.balance);

        const data = creditors.map(c => [c.name, c.phone || '-', formatMoney(c.balance)]);
        const totalCredit = creditors.reduce((acc, c) => acc + c.balance, 0);

        generateReportPDF(
            "Relatório de Haveres (Créditos)",
            ['CLIENTE', 'CONTATO', 'VALOR EM HAVER'],
            data,
            [{ label: 'TOTAL EM HAVER', value: `R$ ${formatMoney(totalCredit)}` }],
            format,
            selectedCustomerId !== 'all' ? `Cliente: ${customers.find(c => c.id === selectedCustomerId)?.name}` : "Posição Atual"
        );
    };

    const generateStockReport = (format: 'a4' | 'mobile') => {
        const stockData = products.map(p => {
            const retailStock = p.variations.reduce((acc, v) => acc + v.stock, 0);
            const wholesaleStock = p.wholesaleStock.reduce((acc, ws) => acc + ws.boxes, 0);
            const totalValue = p.variations.reduce((acc, v) => acc + (v.stock * v.costPrice), 0) +
                p.wholesaleStock.reduce((acc, ws) => acc + (ws.boxes * ws.costPricePerBox), 0);
            return { ref: p.reference, retail: retailStock, wholesale: wholesaleStock, value: totalValue };
        });

        const data = stockData.map(s => [s.ref, s.retail.toString(), s.wholesale.toString(), formatMoney(s.value)]);
        const grandTotal = stockData.reduce((acc, s) => acc + s.value, 0);

        generateReportPDF(
            "Posição de Estoque Valorizado",
            ['PRODUTO', 'VAREJO', 'ATACADO', 'CUSTO TOTAL'],
            data,
            [{ label: 'PATRIMÔNIO EM ESTOQUE', value: `R$ ${formatMoney(grandTotal)}` }],
            format,
            "Posição Atual"
        );
    };

    const generateSupplierDebt = (format: 'a4' | 'mobile') => {
        // Dívidas são cumulativas, ignoramos o filtro de data mas respeitamos o de fornecedor
        const debts = purchases.filter(p =>
            (p.accounted ?? true) &&
            !p.isPaid &&
            (selectedSupplierId === 'all' || p.supplierId === selectedSupplierId)
        ).map(p => {
            const supplier = suppliers.find(s => s.id === p.supplierId);
            const remaining = p.totalValue - (p.amountPaid || 0);
            return {
                supplier: supplier?.name || 'Desc.',
                doc: p.purchaseNumber,
                due: formatDate(p.dueDate || p.date),
                value: remaining
            };
        }).sort((a, b) => b.value - a.value);

        const data = debts.map(d => [d.supplier, d.doc, d.due, formatMoney(d.value)]);
        const total = debts.reduce((acc, d) => acc + d.value, 0);

        generateReportPDF(
            "Contas a Pagar (Fornecedores)",
            ['FORNECEDOR', 'DOC', 'VENC.', 'VALOR'],
            data,
            [{ label: 'DÍVIDA TOTAL', value: `R$ ${formatMoney(total)}` }],
            format,
            "Posição Atual"
        );
    };

    const generateConsolidatedBalance = (format: 'a4' | 'mobile') => {
        // 1. A Receber (Vendas não pagas)
        const toReceive = sales
            .filter(s => s.status !== 'Cancelada' && !s.isPaid)
            .reduce((acc, s) => acc + (s.totalValue - s.amountPaid), 0);

        // 2. A Pagar (Compras não pagas)
        const toPay = purchases
            .filter(p => (p.accounted ?? true) && !p.isPaid)
            .reduce((acc, p) => acc + (p.totalValue - (p.amountPaid || 0)), 0);

        // 3. Valor em Estoque (Patrimônio)
        const stockValue = products.reduce((acc, p) => {
            const retailV = p.variations.reduce((sum, v) => sum + (v.stock * v.costPrice), 0);
            const wholesaleV = p.wholesaleStock.reduce((sum, ws) => sum + (ws.boxes * ws.costPricePerBox), 0);
            return acc + retailV + wholesaleV;
        }, 0);

        // 4. Saldo em Caixa (Transações Manuais / Caixa interno)
        // O sistema registra entradas/saídas baseadas no tipo da transação.
        const incomeTypes = ['sale', 'payment', 'adjustment'];
        const cashBalance = transactions.reduce((acc: number, t: Transaction) => {
            return incomeTypes.includes(t.type) ? acc + t.amount : acc - t.amount;
        }, 0);

        const result = (toReceive + cashBalance + stockValue) - toPay;

        const data = [
            ['CONTAS A RECEBER (CLIENTES)', `R$ ${formatMoney(toReceive)}`],
            ['SALDO EM CAIXA (MANUAL)', `R$ ${formatMoney(cashBalance)}`],
            ['VALOR EM ESTOQUE (CUSTO)', `R$ ${formatMoney(stockValue)}`],
            ['CONTAS A PAGAR (FORNECEDORES)', `R$ ${formatMoney(toPay)}`],
            ['RESULTADO LÍQUIDO PROJETADO', `R$ ${formatMoney(result)}`]
        ];

        generateReportPDF(
            "Balanço Consolidado Financeiro",
            ['ITEM DO BALANÇO', 'VALOR'],
            data,
            [
                { label: 'PATRIMÔNIO ATIVO', value: `R$ ${formatMoney(toReceive + cashBalance + stockValue)}` },
                { label: 'PASSIVO (DÍVIDAS)', value: `R$ ${formatMoney(toPay)}` },
                { label: 'SALDO FINAL', value: `R$ ${formatMoney(result)}` }
            ],
            format,
            "Resumo Geral de Receitas x Despesas"
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-24 px-2">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center md:items-start text-center md:text-left gap-4">
                <div>
                    <h2 className="text-2xl font-black uppercase dark:text-white tracking-tight">Relatórios & Backup</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Central de Inteligência e Segurança</p>
                </div>
            </div>

            {/* SELETOR DE PERÍODO GLOBAL (Some se estiver na aba backup) */}
            {activeCategory !== 'backup' && (
                <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border dark:border-slate-800 shadow-sm flex flex-col lg:flex-row gap-4 items-center">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Calendar size={20} />
                        <span className="text-xs font-black uppercase">Período de Análise:</span>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto max-w-full custom-scrollbar">
                        {['month', 'quarter', 'semester', 'year', 'all', 'custom'].map((p) => {
                            const labelStr = { month: 'Mês Atual', quarter: 'Trimestre', semester: 'Semestre', year: 'Este Ano', all: 'Tudo', custom: 'Personalizado' }[p as PeriodType];
                            return (
                                <button
                                    key={p}
                                    onClick={() => handlePeriodChange(p as PeriodType)}
                                    title={`Filtrar por ${labelStr}`} aria-label={`Filtrar por ${labelStr}`}
                                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${period === p ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {labelStr}
                                </button>
                            );
                        })}
                    </div>

                    {period === 'custom' && (
                        <div className="flex flex-wrap justify-center items-center gap-2">
                            <input title="Data Inicial" aria-label="Data Inicial" type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} className="bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-xs font-bold dark:text-white" />
                            <span className="text-slate-400 text-xs">até</span>
                            <input title="Data Final" aria-label="Data Final" type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} className="bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 text-xs font-bold dark:text-white" />
                        </div>
                    )}

                    <div className="lg:ml-auto text-[9px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg">
                        {dateLabel}
                    </div>
                </div>
            )}

            {/* SELETORES DE ENTIDADE (Cliente/Fornecedor) */}
            {(activeCategory === 'clients' || activeCategory === 'general' || activeCategory === 'products') && (
                <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Users size={20} />
                        <span className="text-xs font-black uppercase">Filtrar por Cliente:</span>
                    </div>
                    <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        title="Selecionar Cliente" aria-label="Selecionar Cliente"
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-[11px] font-black uppercase outline-none focus:border-blue-500 dark:text-white"
                    >
                        <option value="all">TODOS OS CLIENTES</option>
                        {customers.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {activeCategory === 'suppliers' && (
                <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Truck size={20} />
                        <span className="text-xs font-black uppercase">Filtrar por Fornecedor:</span>
                    </div>
                    <div className="flex-1 flex gap-2 w-full">
                        <select
                            value={selectedSupplierId}
                            onChange={(e) => setSelectedSupplierId(e.target.value)}
                            title="Selecionar Fornecedor" aria-label="Selecionar Fornecedor"
                            className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-[11px] font-black uppercase outline-none focus:border-blue-500 dark:text-white"
                        >
                            <option value="all">TODOS OS FORNECEDORES</option>
                            {suppliers.sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        {selectedSupplierId !== 'all' && (
                            <button
                                onClick={() => {
                                    // Feedback visual de confirmação
                                    const btn = document.getElementById('btn-confirm-supplier');
                                    if (btn) {
                                        btn.classList.add('bg-emerald-600', 'text-white');
                                        setTimeout(() => btn.classList.remove('bg-emerald-600', 'text-white'), 1000);
                                    }
                                }}
                                id="btn-confirm-supplier"
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 hover:border-emerald-500"
                            >
                                <ShieldCheck size={16} /> Confirmar
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* NAVEGAÇÃO DE CATEGORIAS */}
            <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar no-scrollbar">
                <CategoryBtn active={activeCategory === 'general'} onClick={() => setActiveCategory('general')} icon={<BarChart3 size={16} />} label="Geral" />
                <CategoryBtn active={activeCategory === 'clients'} onClick={() => setActiveCategory('clients')} icon={<Users size={16} />} label="Clientes" />
                <CategoryBtn active={activeCategory === 'products'} onClick={() => setActiveCategory('products')} icon={<Package size={16} />} label="Produtos" />
                <CategoryBtn active={activeCategory === 'suppliers'} onClick={() => setActiveCategory('suppliers')} icon={<Truck size={16} />} label="Fornecedores" />
                <div className="w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
                <CategoryBtn active={activeCategory === 'backup'} onClick={() => setActiveCategory('backup')} icon={<ShieldCheck size={16} />} label="Sistema & Backup" />
            </div>

            {/* RENDERIZAÇÃO CONDICIONAL */}
            {activeCategory === 'backup' ? (
                <div className="animate-slideUp">
                    <BackupView
                        onExport={onExport}
                        onImport={onImport}
                        getRawData={getRawData}
                        restoreData={restoreData}
                        onBack={() => setActiveCategory('general')}
                        onReset={onReset}
                        onSync={onSync}
                        onTestConnection={onTestConnection}
                    />
                </div>
            ) : (
                /* GRID DE RELATÓRIOS */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slideUp">

                    {/* GERAL */}
                    {activeCategory === 'general' && (
                        <>
                            <ReportCard
                                title="Vendas Totais do Período"
                                desc="Relatório completo de todas as vendas, detalhando data, cliente e valor."
                                icon={<ShoppingBag size={24} className="text-blue-500" />}
                                onExport={(fmt) => generateSalesByPeriod(fmt)}
                            />
                            <ReportCard
                                title="Posição de Estoque (Atual)"
                                desc="Inventário completo valorizado (Custo Total). Quantidades de Varejo e Atacado."
                                icon={<Boxes size={24} className="text-indigo-500" />}
                                onExport={(fmt) => generateStockReport(fmt)}
                            />
                            <ReportCard
                                title="Balanço Receitas x Dívidas"
                                desc="Visão geral financeira: Contas a Receber, Pagar, Valor de Estoque e Saldo Final."
                                icon={<ChartBar size={24} className="text-rose-600" />}
                                onExport={(fmt) => generateConsolidatedBalance(fmt)}
                            />
                            <ReportCard
                                title="Estoque Detalhado (Cor/Ref)"
                                desc="Lista detalhada de cada produto com Referência, Cor, Tamanho e Quantidade."
                                icon={<ClipboardList size={24} className="text-emerald-600" />}
                                onExport={(fmt) => generateDetailedInventoryReport(fmt)}
                            />
                        </>
                    )}

                    {/* CLIENTES */}
                    {activeCategory === 'clients' && (
                        <>
                            <ReportCard
                                title="Melhores Clientes (Ranking)"
                                desc="Quem comprou mais no período selecionado. Ordenado por valor total."
                                icon={<TrendingUp size={24} className="text-emerald-500" />}
                                onExport={(fmt) => generateTopCustomers(fmt)}
                            />
                            <ReportCard
                                title="Clientes Inadimplentes"
                                desc="Relatório de débitos em aberto (Vencidos e A Vencer). Baseado no saldo atual."
                                icon={<AlertCircle size={24} className="text-rose-500" />}
                                onExport={(fmt) => generateCustomerDebts(fmt)}
                            />
                            <ReportCard
                                title="Créditos em Haver"
                                desc="Clientes com saldo positivo na loja. Valores que podem ser abatidos."
                                icon={<Wallet size={24} className="text-blue-500" />}
                                onExport={(fmt) => generateCustomerCredits(fmt)}
                            />
                        </>
                    )}

                    {/* PRODUTOS */}
                    {activeCategory === 'products' && (
                        <>
                            <ReportCard
                                title="Produtos Mais Vendidos"
                                desc="Ranking de volume de saída por produto no período selecionado."
                                icon={<Package size={24} className="text-orange-500" />}
                                onExport={(fmt) => generateTopProducts(fmt)}
                            />
                        </>
                    )}

                    {/* FORNECEDORES */}
                    {activeCategory === 'suppliers' && (
                        <>
                            <ReportCard
                                title="Dívidas com Fornecedores"
                                desc="Contas a pagar referentes a compras de estoque ou despesas gerais."
                                icon={<Truck size={24} className="text-slate-500" />}
                                onExport={(fmt) => generateSupplierDebt(fmt)}
                            />
                        </>
                    )}

                </div>
            )}
        </div>
    );
};

const CategoryBtn = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        title={`Categoria ${label}`} aria-label={`Categoria ${label}`}
        className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase transition-all border-2 whitespace-nowrap ${active ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-300'}`}
    >
        {icon} {label}
    </button>
);

const ReportCard = ({ title, desc, icon, onExport }: { title: string, desc: string, icon: React.ReactNode, onExport: (format: 'a4' | 'mobile') => void }) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-sm hover:border-blue-200 dark:hover:border-blue-900 transition-all flex flex-col justify-between group">
        <div>
            <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-sm font-black uppercase dark:text-white leading-tight mb-2">{title}</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{desc}</p>
        </div>

        <div className="mt-6 pt-6 border-t dark:border-slate-800 flex gap-2">
            <button
                onClick={() => onExport('a4')}
                title={`Exportar ${title} para A4`} aria-label={`Exportar ${title} para A4`}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
            >
                <Printer size={14} /> A4
            </button>
            <button
                onClick={() => onExport('mobile')}
                title={`Exportar ${title} para Mobile`} aria-label={`Exportar ${title} para Mobile`}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
            >
                <Smartphone size={14} /> Mobile
            </button>
        </div>
    </div>
);
