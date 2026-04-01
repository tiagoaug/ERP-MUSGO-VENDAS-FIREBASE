import React, { useMemo, useState } from 'react';
import { Sale, Customer, Purchase, Supplier, ExpenseCategory, Receipt, Product, AppGrid, AppColor, SaleStatus } from '../types';
import { StatBox } from '../components/StatBox';
import { formatMoney } from '../lib/utils';
import { CategoryBarChart } from '../components/CategoryBarChart';
import { db } from '../services/api';
import { collection, getDocs, limit, query, doc, updateDoc } from 'firebase/firestore';
import {
  CurrencyDollar, Package, ArrowSquareUpRight, ArrowSquareDownLeft,
  Lightning, ShoppingCart, ArrowsClockwise, Clock, WarningCircle, Truck, ChartPie, Calendar, CaretDown, Eye, EyeSlash, ChartBar, CheckCircle, CaretUp, MagnifyingGlass, FilePdf
} from '@phosphor-icons/react';
import { CategoryComparisonChart } from '../components/CategoryComparisonChart';
import { SupplierPaymentChart } from '../components/SupplierPaymentChart';
import { ProLaboreChart } from '../components/ProLaboreChart';
import { ChequeControlCard } from '../components/ChequeControlCard';
import { formatDate } from '../lib/utils';
import { Transaction } from '../types';
import { generateReportPDF } from '../lib/pdfGenerator';

interface DashboardViewProps {
  stats: any;
  setView: (view: any) => void;
  sales: Sale[];
  customers: Customer[];
  purchases: Purchase[];
  suppliers: Supplier[];
  categories: ExpenseCategory[];
  receipts: Receipt[];
  transactions: Transaction[];
  bankAccounts: any[]; // Incluindo bankAccounts
  onNavigateToPurchase?: (supplierId: string, purchaseId: string) => void;
  onNavigateToSaleOrReceipt?: (customerId: string, id: string, type: 'sale' | 'receipt') => void;
  onUpdateSaleStatus?: (id: string, status: SaleStatus) => Promise<void>;
  onUpdateReceiptStatus?: (id: string, status: string) => Promise<void>;
  onUpdateChequeStatus?: (id: string, isPaid: boolean) => Promise<void>;
  products?: Product[];
  grids?: AppGrid[];
  colors?: AppColor[];
}

export const DashboardView = ({
  stats, setView, sales, customers, purchases, suppliers, categories, receipts, transactions, bankAccounts,
  onNavigateToPurchase, onNavigateToSaleOrReceipt, products, grids, colors,
  onUpdateSaleStatus, onUpdateReceiptStatus, onUpdateChequeStatus
}: DashboardViewProps) => {
  const [connStatus, setConnStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);

  const handleStatusChange = async (id: string, type: string, newStatus: SaleStatus) => {
    try {
      if (type === 'venda' && onUpdateSaleStatus) {
        await onUpdateSaleStatus(id, newStatus);
      } else if (type === 'recibo' && onUpdateReceiptStatus) {
        await onUpdateReceiptStatus(id, newStatus);
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  // Filtros de Contas Bancárias
  const allRealAccountIds = useMemo(() => {
    return (bankAccounts || []).filter(a => a.id !== 'estoque-virtual').map(a => a.id);
  }, [bankAccounts]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(allRealAccountIds);
  const [isAccountFilterOpen, setIsAccountFilterOpen] = useState(false);

  // Recalcula o saldo e o patrimônio com base nas contas selecionadas
  const dynamicStats = useMemo(() => {
    const selectedCash = (bankAccounts || [])
      .filter(a => selectedAccounts.includes(a.id))
      .reduce((sum, a) => sum + (a.balance || 0), 0);

    // Patrimônio = selectedCash + estoque + recebimentos - pagamentos
    const selectedNetWorth = selectedCash + stats.stockCost + stats.receivable - stats.payable;

    return { ...stats, cash: selectedCash, netWorth: selectedNetWorth };
  }, [stats, bankAccounts, selectedAccounts]);

  // Sincroniza selectedAccounts inicial caso as contas mudem
  React.useEffect(() => {
    if (selectedAccounts.length === 0 && allRealAccountIds.length > 0) {
      setSelectedAccounts(allRealAccountIds);
    }
  }, [allRealAccountIds]);

  // Filtros de Período
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

  const [hiddenSections, setHiddenSections] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboard_hidden_sections');
    return saved ? JSON.parse(saved) : [];
  });
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboard_section_order');
    const defaultOrder = [
      'gastos_gerais', 'pagamentos_fornecedor', 'pro_labore', 'lembretes_pagamento', 'lembretes_recebimento', 'controle_cheques', 'balanco', 'estoque_consulta', 'atividades', 'patrimonio', 'historico_consolidado'
    ];
    if (saved) {
      const parsed = JSON.parse(saved);
      const missing = defaultOrder.filter(id => !parsed.includes(id));
      return [...parsed, ...missing];
    }
    return defaultOrder;
  });

  React.useEffect(() => {
    localStorage.setItem('dashboard_hidden_sections', JSON.stringify(hiddenSections));
  }, [hiddenSections]);

  React.useEffect(() => {
    localStorage.setItem('dashboard_section_order', JSON.stringify(sectionOrder));
  }, [sectionOrder]);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState('');

  // Reminders State
  const [hidePaymentReminders, setHidePaymentReminders] = useState(() => {
    const saved = localStorage.getItem('dashboard_hide_payment_reminders');
    return saved ? JSON.parse(saved) : false;
  });
  const [hideReceiptReminders, setHideReceiptReminders] = useState(() => {
    const saved = localStorage.getItem('dashboard_hide_receipt_reminders');
    return saved ? JSON.parse(saved) : false;
  });

  React.useEffect(() => {
    localStorage.setItem('dashboard_hide_payment_reminders', JSON.stringify(hidePaymentReminders));
  }, [hidePaymentReminders]);

  React.useEffect(() => {
    localStorage.setItem('dashboard_hide_receipt_reminders', JSON.stringify(hideReceiptReminders));
  }, [hideReceiptReminders]);

  const [paymentReminderDays, setPaymentReminderDays] = useState(7);
  const [receiptReminderDays, setReceiptReminderDays] = useState(7);

  const [isValuesBlurred, setIsValuesBlurred] = useState(false);
  const [isDashboardHidden, setIsDashboardHidden] = useState(false);

  // --- Estado Histórico Consolidado ---
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyTab, setHistoryTab] = useState<'all' | 'clients' | 'purchases'>('all');
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<string[]>([]);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isHistoryMinimized, setIsHistoryMinimized] = useState(() => {
    const saved = localStorage.getItem('dashboard_history_minimized');
    return saved ? JSON.parse(saved) : false;
  });

  React.useEffect(() => {
    localStorage.setItem('dashboard_history_minimized', JSON.stringify(isHistoryMinimized));
  }, [isHistoryMinimized]);

  const consolidatedHistory = useMemo(() => {
    const items: any[] = [];

    // Adicionar Vendas
    sales.forEach(s => {
      const customer = customers.find(c => c.id === s.customerId);
      items.push({
        id: s.id,
        date: s.date,
        type: 'venda',
        title: `Venda #${s.saleNumber}`,
        subtitle: customer?.name || 'Cliente Geral',
        value: s.totalValue,
        status: s.isPaid ? 'Quitado' : (s.amountPaid > 0 ? 'Parcial' : (s.status === 'Cancelada' ? 'Cancelada' : 'Pendente')),
        operationalStatus: s.status || 'Pendente',
        pendingValue: Math.max(0, s.totalValue - (s.amountPaid || 0)),
        description: [
          s.items.map(i => {
            const product = products?.find(p => p.id === i.productId);
            let detail = '';
            if (i.isWholesale) {
              const grid = grids?.find(g => g.id === (product as any)?.gridId || (product as any)?.gridIds?.[0]);
              detail = `${i.quantity} CX ${product?.name || 'Item'}${grid ? ` (Grade ${grid.name})` : ''}`;
            } else {
              const variation = product?.variations.find(v => v.id === i.variationId);
              const colorName = colors?.find(c => c.id === variation?.colorId || i.colorId)?.name || variation?.colorId || i.colorId || '';
              const size = variation?.size || '';
              detail = `${i.quantity} UN ${product?.name || 'Item'} (${colorName}${size ? ` ${size}` : ''})`;
            }
            return detail;
          }).join(', '),
          s.comments
        ].filter(Boolean).join(' | '),
        original: s,
        entityName: customer?.name || 'Cliente Geral'
      });
    });

    receipts.forEach(r => {
      const customer = customers.find(c => c.id === r.customerId);
      const amountPaid = r.amountPaid || 0;
      const totalValue = r.totalValue || 0;
      items.push({
        id: r.id,
        date: r.date,
        type: 'recibo',
        title: `Recibo #${r.receiptNumber}`,
        subtitle: customer?.name || 'Cliente Geral',
        value: r.totalValue || 0,
        description: [
          r.expenseItems?.map((i: any) => i.description).join(', '),
          r.itemDescription,
          r.notes
        ].filter(Boolean).join(' | ') || 'Recebimento de Título',
        status: r.isPaid || (totalValue - amountPaid) <= 0 ? 'Quitado' : (amountPaid > 0 ? 'Parcial' : 'Pendente'),
        operationalStatus: r.status || 'Pendente',
        pendingValue: Math.max(0, totalValue - amountPaid),
        original: r,
        entityName: customer?.name || 'Cliente Geral'
      });
    });

    // Adicionar Compras (Fornecedores)
    purchases.forEach(p => {
      const supplier = suppliers.find(s => s.id === p.supplierId);
      
      let description = '';
      if (p.type === 'general') {
        const parts = [
          p.expenseItems?.map((i: any) => i.description).join(', '),
          p.itemDescription,
          p.notes
        ].filter(Boolean);
        description = parts.join(' | ') || 'Despesa Geral';
      } else {
        description = p.items?.map(i => {
          const product = products?.find(prod => prod.id === i.productId);
          return `${i.quantity}x ${product?.name || 'Item'}`;
        }).join(', ') || 'Compra de Estoque';
        if (p.notes) description += ` | ${p.notes}`;
      }

      items.push({
        id: p.id,
        date: p.date,
        type: 'compra',
        title: p.purchaseNumber ? `Compra #${p.purchaseNumber}` : 'Compra/Despesa',
        subtitle: supplier?.name || 'Fornecedor Geral',
        value: p.totalValue,
        status: p.isPaid ? 'Quitado' : (p.amountPaid > 0 ? 'Parcial' : 'Pendente'),
        operationalStatus: p.status || 'Pendente',
        pendingValue: Math.max(0, p.totalValue - (p.amountPaid || 0)),
        description: description,
        original: p,
        entityName: supplier?.name || 'Fornecedor Geral'
      });
    });

    // Ordenar por data (mais recente primeiro)
    let filtered = items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filtro por Data do Dashboard (Opcional, mas geralmente o dashboard já reflete isso no props)
    // No entanto, as props sales/receipts/purchases passadas aqui já costumam ser as filtradas
    // Se não forem, poderíamos filtrar aqui por dateRange.start/end

    // Filtro por Tab
    if (historyTab === 'clients') {
      filtered = filtered.filter(i => i.type === 'venda' || i.type === 'recibo');
    } else if (historyTab === 'purchases') {
      filtered = filtered.filter(i => i.type === 'compra');
    }

    // Filtro por Busca
    if (historySearchQuery) {
      const q = historySearchQuery.toLowerCase();
      filtered = filtered.filter(i => 
        i.title.toLowerCase().includes(q) || 
        i.subtitle.toLowerCase().includes(q) || 
        i.description.toLowerCase().includes(q) ||
        i.entityName.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [sales, receipts, purchases, customers, suppliers, products, historyTab, historySearchQuery]);

  const handleExportConsolidatedPDF = async () => {
    if (selectedHistoryItems.length === 0) return;
    
    setIsExportingPDF(true);
    try {
      const selectedData = consolidatedHistory.filter(i => selectedHistoryItems.includes(i.id));
      
      const columns = ['TIPO', 'DATA', 'DESCRIÇÃO', 'ENTIDADE', 'VALOR', 'FINANCEIRO', 'LOGÍSTICA'];
      const data = selectedData.map(i => [
        i.type.toUpperCase(),
        formatDate(i.date),
        i.title + (i.description ? `\n${i.description}` : ''),
        i.entityName,
        `R$ ${formatMoney(i.value)}`,
        i.status,
        i.operationalStatus
      ]);

      const totalValue = selectedData.reduce((acc, i) => acc + i.value, 0);

      await generateReportPDF(
        "Histórico Consolidado Musgo ERP",
        columns,
        data,
        [{ label: 'TOTAL CONSOLIDADO', value: `R$ ${formatMoney(totalValue)}` }],
        'a4',
        `Período: ${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
      );
      
      setSelectedHistoryItems([]);
    } catch (err) {
      console.error("Erro ao gerar PDF consolidado:", err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const toggleHistorySelection = (id: string) => {
    setSelectedHistoryItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSection = (id: string) => {
    setHiddenSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    setSectionOrder(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;

      const newOrder = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;

      const temp = newOrder[idx];
      newOrder[idx] = newOrder[targetIdx];
      newOrder[targetIdx] = temp;

      return newOrder;
    });
  };

  const handlePeriodChange = (p: PeriodType, isComparison: boolean = false) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

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
        const sem = targetDate.getMonth() < 6 ? 0 : 6;
        s = new Date(targetDate.getFullYear(), sem, 1);
        e = new Date(targetDate.getFullYear(), sem + 6, 0);
      } else if (pType === 'year') {
        s = new Date(targetDate.getFullYear(), 0, 1);
        e = new Date(targetDate.getFullYear(), 11, 31);
      } else if (pType === 'all') {
        s = new Date(2020, 0, 1);
        e = now;
      }
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
    };

    if (isComparison) {
      setCompPeriod(p);
      if (p !== 'custom') {
        // Para comparação, geralmente pegamos o período anterior ao período principal selecionado
        // Mas para simplificar, vamos deixar o usuário escolher o período de base
        const dates = setDates(p, now);
        setCompDateRange(dates);
      }
    } else {
      setPeriod(p);
      if (p !== 'custom') {
        const dates = setDates(p, now);
        setDateRange(dates);
      }
    }
  };

  const testConnection = async () => {
    setConnStatus('checking');
    setLastError(null);
    try {
      // Tenta uma operação simples de leitura no Firebase
      const q = query(collection(db, 'colors'), limit(1));
      await getDocs(q);
      setConnStatus('ok');
    } catch (err: any) {
      console.error('Erro de diagnóstico:', err);
      setConnStatus('error');
      setLastError(err.message || String(err));
    }
  };

  const pendingApprovals = useMemo(() => {
    return sales.filter(s => s.status === 'Aguardando Aprovação');
  }, [sales]);

  const pendingTotal = useMemo(() => {
    return pendingApprovals.reduce((acc, s) => acc + s.totalValue, 0);
  }, [pendingApprovals]);

  const expenseChartData = useMemo(() => {
    const getChartData = (start: string, end: string) => {
      const expenseByCategory: Record<string, number> = {};

      const getCategoryName = (catIdOrName: string | undefined) => {
        if (!catIdOrName) return 'Geral';
        const found = categories.find(c => c.id === catIdOrName || c.name === catIdOrName);
        return found ? found.name : catIdOrName;
      };

      purchases.filter(p => p.accounted ?? true).forEach(p => {
        const pDate = p.date.split('T')[0];
        if (pDate >= start && pDate <= end) {
          if (p.type === 'general' && p.expenseItems && p.expenseItems.length > 0) {
            p.expenseItems.forEach((item: any) => {
              const categoryToUse = item.category || p.categoryId;
              const catName = getCategoryName(categoryToUse);
              expenseByCategory[catName] = (expenseByCategory[catName] || 0) + item.value;
            });
          } else {
            // Se for estoque ou despesa sem itens, usa o categoryId da compra ou fallback
            const catName = p.type === 'inventory' ? 'Estoque' : getCategoryName(p.categoryId);
            expenseByCategory[catName] = (expenseByCategory[catName] || 0) + (p.totalValue || 0);
          }
        }
      });
      return expenseByCategory;
    };

    const mainData = getChartData(dateRange.start, dateRange.end);
    const prevData = getChartData(compDateRange.start, compDateRange.end);

    const CATEGORY_COLORS: Record<string, string> = {
      'Alimentação': '#f43f5e',      // Rose 500
      'Aluguel': '#8b5cf6',           // Violet 500
      'Combustível': '#f59e0b',       // Amber 500
      'Transporte': '#f59e0b',
      'Comissões': '#10b981',         // Emerald 500
      'Educação': '#3b82f6',          // Blue 500
      'Energia Elétrica': '#fbbf24',  // Amber 400 (Vibrant Yellow)
      'Embalagens': '#6366f1',        // Indigo 500
      'Frete': '#06b6d4',             // Cyan 500
      'Impostos': '#ef4444',          // Red 500
      'Manutenção': '#ec4899',        // Pink 500
      'Marketing': '#d946ef',         // Fuchsia 500
      'Publicidade': '#d946ef',
      'Materiais': '#94a3b8',         // Slate 400
      'Água/Esgoto': '#0ea5e9',       // Sky 500
      'Saneamento': '#0ea5e9',
      'Salários': '#22c55e',          // Green 500
      'Encargos': '#22c55e',
      'Internet': '#a855f7',          // Purple 500
      'Telefone': '#a855f7',
      'Viagens': '#fb923c',           // Orange 400
      'Estoque': '#2563eb',           // Blue 600 (Solid Stock Color)
      'Geral': '#64748b',             // Slate 500
      'Outros': '#475569'             // Slate 600
    };

    const getPaletteColor = (name: string, index: number) => {
      if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
      const palette = [
        '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
        '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6',
        '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b',
        '#f97316', '#ef4444', '#78716c', '#71717a', '#64748b'
      ];
      return palette[index % palette.length];
    };


    const allCategories = Array.from(new Set([...Object.keys(mainData), ...Object.keys(prevData)]));

    return allCategories.map((cat, idx) => ({
      category: cat,
      value: mainData[cat] || 0,
      prevValue: prevData[cat] || 0,
      color: getPaletteColor(cat, idx)
    }));
  }, [purchases, dateRange, compDateRange]);

  const allCheques = useMemo(() => {
    return purchases
      .filter(p => (p.accounted ?? true) && p.cheques && p.cheques.length > 0)
      .flatMap(p => p.cheques || []);
  }, [purchases]);

  const supplierPaymentData = useMemo(() => {
    const data: Record<string, { paid: number; pending: number }> = {};
    const filteredPurchases = purchases.filter(p => {
      if (!(p.accounted ?? true)) return false;
      if (!p.date) return false;
      const dStr = p.date.includes('T') ? p.date.split('T')[0] : p.date;
      return dStr >= dateRange.start && dStr <= dateRange.end;
    });

    filteredPurchases.forEach(p => {
      const supplier = suppliers.find(s => s.id === p.supplierId);
      const name = supplier?.name || 'Desc.';
      if (!data[name]) data[name] = { paid: 0, pending: 0 };
      data[name].paid += p.amountPaid || 0;
      data[name].pending += (p.totalValue - (p.amountPaid || 0));
    });
    return Object.entries(data).map(([name, vals]) => ({ supplierName: name, ...vals }));
  }, [purchases, suppliers, dateRange]);

  const proLaboreData = useMemo(() => {
    const getWithdrawals = (start: string, end: string) => {
      let total = 0;
      const filtered = transactions.filter(t => {
        if (!t.date) return false;
        const dStr = t.date.includes('T') ? t.date.split('T')[0] : t.date;
        return dStr >= start && dStr <= end;
      });

      filtered.forEach(t => {
        if (t.type === 'expense_payment' && (t.description.toLowerCase().includes('pro-labore') || t.description.toLowerCase().includes('pró-labore'))) {
          total += t.amount;
        }
      });
      return total;
    };

    return {
      current: getWithdrawals(dateRange.start, dateRange.end),
      prev: getWithdrawals(compDateRange.start, compDateRange.end)
    };
  }, [transactions, dateRange, compDateRange]);

  const getYYYYMMDD = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const paymentReminders = useMemo(() => {
    const today = new Date();
    const targetDate = new Date(today.getTime() + paymentReminderDays * 86400000);
    const targetDateStr = getYYYYMMDD(targetDate);

    return purchases
      .filter(p => (p.accounted ?? true) && !p.isPaid && (p.totalValue - (p.amountPaid || 0)) > 0)
      .filter(p => {
        if (!p.dueDate) return false;
        const dueDateStr = p.dueDate.includes('T') ? p.dueDate.split('T')[0] : p.dueDate;
        return dueDateStr <= targetDateStr;
      })
      .sort((a, b) => {
        const dA = a.dueDate.includes('T') ? a.dueDate.split('T')[0] : a.dueDate;
        const dB = b.dueDate.includes('T') ? b.dueDate.split('T')[0] : b.dueDate;
        return dA.localeCompare(dB);
      });
  }, [purchases, paymentReminderDays]);

  const receiptReminders = useMemo(() => {
    const today = new Date();
    const targetDate = new Date(today.getTime() + receiptReminderDays * 86400000);
    const targetDateStr = getYYYYMMDD(targetDate);

    const formattedSales = sales
      .filter(s => s.status !== 'Cancelada' && !s.isPaid && (s.totalValue - s.amountPaid) > 0)
      .filter(s => {
        if (!s.dueDate) return false;
        const dueDateStr = s.dueDate.includes('T') ? s.dueDate.split('T')[0] : s.dueDate;
        return dueDateStr <= targetDateStr;
      })
      .map(s => ({
        id: s.id,
        type: 'sale' as const,
        customerId: s.customerId,
        dueDate: s.dueDate.includes('T') ? s.dueDate.split('T')[0] : s.dueDate,
        totalValue: s.totalValue,
        amountPaid: s.amountPaid
      }));

    const formattedReceipts = receipts
      .filter(r => !r.isPaid && (r.totalValue - (r.amountPaid || 0)) > 0)
      .filter(r => {
        if (!r.dueDate) return false;
        const dueDateStr = r.dueDate.includes('T') ? r.dueDate.split('T')[0] : r.dueDate;
        return dueDateStr <= targetDateStr;
      })
      .map(r => ({
        id: r.id,
        type: 'receipt' as const,
        customerId: r.customerId,
        dueDate: r.dueDate.includes('T') ? r.dueDate.split('T')[0] : r.dueDate,
        totalValue: r.totalValue,
        amountPaid: r.amountPaid || 0
      }));

    return [...formattedSales, ...formattedReceipts]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [sales, receipts, receiptReminderDays]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-10 animate-fadeIn px-2 pb-24">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
        <div className="text-left">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black uppercase dark:text-white tracking-tight leading-none">Painel de Controle</h2>
            <button
              onClick={() => setIsDashboardHidden(!isDashboardHidden)}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 bg-white dark:bg-slate-800 border-2 dark:border-slate-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              title={isDashboardHidden ? 'Mostrar Painel' : 'Ocultar Painel Inteiro'}
            >
              {isDashboardHidden ? <Eye size={20} weight="bold" /> : <EyeSlash size={20} weight="bold" />}
            </button>
            {hiddenSections.length > 0 && (
              <button
                onClick={() => setHiddenSections([])}
                className="p-1.5 sm:p-2 text-indigo-400 hover:text-indigo-600 bg-white dark:bg-slate-800 border-2 dark:border-slate-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                title="Restaurar Seções Ocultas"
              >
                <ArrowsClockwise size={20} weight="bold" />
                <span className="text-[10px] font-black uppercase pr-1 hidden sm:inline">Restaurar</span>
              </button>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest">Resumo Operacional</p>
        </div>
      </div>

      {!isDashboardHidden ? (
        <>
          {/* Filtros de Período (Acordeão) */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.2rem] border-2 dark:border-slate-800 overflow-hidden shadow-sm transition-all duration-300">
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-lg">
                  <Calendar size={18} weight="fill" />
                </div>
                <div className="text-left">
                  <h4 className="text-[11px] font-black uppercase dark:text-white leading-none tracking-widest">Filtros de Período</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                    {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
                    {compPeriod !== 'all' && (
                      <span className="text-emerald-500 ml-2">vs {formatDate(compDateRange.start)} - {formatDate(compDateRange.end)}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${isFiltersExpanded ? 'bg-blue-600 border-blue-600 text-white rotate-180 shadow-lg shadow-blue-500/30' : 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400'}`}>
                <CaretDown size={18} weight="bold" />
              </div>
            </button>

            {isFiltersExpanded && (
              <div className="p-5 pt-0 space-y-5 animate-fadeIn border-t dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                {/* Período Principal */}
                <div className="flex flex-col lg:flex-row gap-4 items-center pt-5">
                  <div className="flex items-center gap-2 text-slate-500 w-full lg:w-auto">
                    <Calendar size={18} weight="bold" />
                    <span className="text-[10px] font-black uppercase">Período Principal:</span>
                  </div>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto max-w-full no-scrollbar w-full lg:w-auto">
                    {['month', 'quarter', 'semester', 'year', 'all', 'custom'].map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePeriodChange(p as any)}
                        className={`flex-1 px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${period === p ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-slate-400 hover:text-slate-600 font-bold'}`}
                      >
                        {p === 'month' ? 'Mês' : p === 'quarter' ? 'Trimestre' : p === 'semester' ? 'Semestre' : p === 'year' ? 'Este Ano' : p === 'all' ? 'Tudo' : 'Data'}
                      </button>
                    ))}
                  </div>
                  {period === 'custom' && (
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                      <input title="Data Inicial" type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} className="flex-1 bg-white dark:bg-slate-800 border-2 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[10px] font-bold dark:text-white" />
                      <input title="Data Final" type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} className="flex-1 bg-white dark:bg-slate-800 border-2 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[10px] font-bold dark:text-white" />
                    </div>
                  )}
                </div>

                {/* Comparação */}
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                  <div className="flex items-center gap-2 text-slate-400 w-full lg:w-auto">
                    <ArrowsClockwise size={18} weight="bold" />
                    <span className="text-[10px] font-black uppercase">Filtro Comparativo:</span>
                  </div>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto max-w-full no-scrollbar w-full lg:w-auto">
                    {['month', 'quarter', 'semester', 'year', 'all', 'custom'].map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePeriodChange(p as any, true)}
                        className={`flex-1 px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${compPeriod === p ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-400 hover:text-slate-600 font-bold'}`}
                      >
                        {p === 'month' ? 'Mês Ant.' : p === 'quarter' ? 'Trim. Ant.' : p === 'semester' ? 'Sem. Ant.' : p === 'year' ? 'Ano Ant.' : p === 'all' ? 'Tudo' : 'Data'}
                      </button>
                    ))}
                  </div>
                  {compPeriod === 'custom' && (
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                      <input title="Data Inicial Comparação" type="date" value={compDateRange.start} onChange={e => setCompDateRange({ ...compDateRange, start: e.target.value })} className="flex-1 bg-white dark:bg-slate-800 border-2 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[10px] font-bold dark:text-white" />
                      <input title="Data Final Comparação" type="date" value={compDateRange.end} onChange={e => setCompDateRange({ ...compDateRange, end: e.target.value })} className="flex-1 bg-white dark:bg-slate-800 border-2 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[10px] font-bold dark:text-white" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Estatísticas 2x2 mobile / 4col desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <StatBox label="Caixa Atual" value={stats.cash} icon={<CurrencyDollar size={22} weight="duotone" />} color="blue" />
            <StatBox label="Estoque" value={stats.stockCost} icon={<Package size={22} weight="duotone" />} color="indigo" onClick={() => setView('estoque')} />
            <StatBox label="Total em Aberto (Vendas + Entradas)" value={stats.receivable} icon={<ArrowSquareUpRight size={22} weight="duotone" />} color="emerald" onClick={() => onNavigateToSaleOrReceipt ? onNavigateToSaleOrReceipt('', '', 'sale') : setView('relacionamento')} />
            <StatBox label="Histórico de Compras" value={stats.payable} icon={<ArrowSquareDownLeft size={22} weight="duotone" />} color="rose" onClick={() => onNavigateToPurchase ? onNavigateToPurchase('', '') : setView('relacionamento_fornecedores')} />
          </div>

          {/* Alerta de Pedidos Pendentes */}
          {pendingApprovals.length > 0 && (
            <div
              onClick={() => setView('relacionamento')}
              className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-800 p-4 sm:p-6 rounded-[2rem] flex items-center justify-between cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-amber-500/5"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 sm:w-14 sm:h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 animate-pulse shrink-0">
                  <Clock size={24} weight="duotone" />
                </div>
                <div>
                  <h4 className="text-[12px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-widest">Pendências</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{pendingApprovals.length} pedidos aguardando liberação</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Total</p>
                <p className={`text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400 transition-all duration-300 ${isValuesBlurred ? 'blur-md select-none opacity-50' : ''}`}>R$ {formatMoney(pendingTotal)}</p>
              </div>
            </div>
          )}

          {/* Seções Dinâmicas (Gráficos, Lembretes, Patrimônio e Atividades) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sectionOrder.map((sectionId, index) => {
              const isFirstInRow = index % 2 === 0;

              // Wrapper function to add reorder controls to any block
              const withControls = (children: React.ReactNode, id: string) => (
                <div className="relative group/section h-full">
                  {/* Controls overlaid on hover */}
                  <div className="absolute top-2 left-2 z-[30] opacity-0 group-hover/section:opacity-100 transition-opacity flex flex-col gap-1 bg-white/10 backdrop-blur-md dark:bg-slate-900/50 p-1.5 rounded-xl border border-slate-200/20 shadow-xl">
                    <button onClick={() => moveSection(id, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent" title="Mover para cima">
                      <CaretUp size={16} weight="bold" />
                    </button>
                    <button onClick={() => moveSection(id, 'down')} disabled={index === sectionOrder.length - 1} className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent" title="Mover para baixo">
                      <CaretDown size={16} weight="bold" />
                    </button>
                  </div>
                  {children}
                </div>
              );

              if (hiddenSections.includes(sectionId)) return null;

              switch (sectionId) {
                case 'gastos_gerais':
                  return withControls(
                    <CategoryComparisonChart
                      data={expenseChartData}
                      title="Gastos Gerais por Categoria"
                      onHide={() => toggleSection('gastos_gerais')}
                    />,
                    sectionId
                  );

                case 'pagamentos_fornecedor':
                  return withControls(
                    <SupplierPaymentChart
                      data={supplierPaymentData}
                      title="Pagamentos por Fornecedor"
                      onHide={() => toggleSection('pagamentos_fornecedor')}
                    />,
                    sectionId
                  );

                case 'pro_labore':
                  return withControls(
                    <ProLaboreChart
                      withdrawals={proLaboreData.current}
                      prevWithdrawals={proLaboreData.prev}
                      companyCash={stats.cash}
                      onHide={() => toggleSection('pro_labore')}
                      isBlurred={isValuesBlurred}
                    />,
                    sectionId
                  );

                case 'controle_cheques':
                  return withControls(
                    <ChequeControlCard
                      cheques={allCheques}
                      suppliers={suppliers}
                      purchases={purchases}
                      onHide={() => toggleSection('controle_cheques')}
                      onToggleStatus={onUpdateChequeStatus}
                    />,
                    sectionId
                  );

                case 'lembretes_pagamento':
                  return withControls(
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] p-5 sm:p-8 shadow-sm flex flex-col h-full overflow-hidden transition-all">
                      <div className="flex justify-between items-center mb-4 sm:mb-6">
                        <h3 className="text-xs font-black uppercase text-rose-500 tracking-widest flex items-center gap-2">
                          <WarningCircle size={18} weight="duotone" /> A Pagar ({paymentReminders.length})
                        </h3>
                        <div className="flex items-center gap-2">
                          <select
                            value={paymentReminderDays}
                            onChange={(e) => setPaymentReminderDays(Number(e.target.value))}
                            title="Dias Filtrados"
                            className="bg-slate-50 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 outline-none rounded-md relative z-20"
                          >
                            <option value={0}>Hoje</option>
                            <option value={3}>Até 3 dias</option>
                            <option value={7}>Até 7 dias</option>
                            <option value={15}>Até 15 dias</option>
                            <option value={30}>Até 30 dias</option>
                          </select>
                          <button title="Ocultar" onClick={() => toggleSection('lembretes_pagamento')} className="text-slate-400 hover:text-slate-600 transition-colors relative z-20">
                            <EyeSlash size={18} />
                          </button>
                        </div>
                      </div>
                      {!hidePaymentReminders ? (
                        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar max-h-[300px] pr-2">
                          {paymentReminders.length > 0 ? paymentReminders.map(p => {
                            const supplier = suppliers.find(s => s.id === p.supplierId);
                            const isOverdue = new Date(p.dueDate + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));
                            return (
                              <div
                                key={p.id}
                                onClick={() => onNavigateToPurchase ? onNavigateToPurchase(p.supplierId, p.id) : setView('relacionamento_fornecedores')}
                                className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all cursor-pointer hover:scale-[1.02] shadow-sm relative z-20 ${isOverdue ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700 hover:border-slate-300'}`}
                              >
                                <div>
                                  <span className="text-[11px] font-black uppercase dark:text-white truncate max-w-[150px] block">{supplier?.name || 'Geral'}</span>
                                  <span className={`text-[9px] font-bold uppercase mt-0.5 ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>
                                    {formatDate(p.dueDate)} {isOverdue ? '(VENCIDO)' : ''}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <p className={`text-[13px] font-black ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-rose-500'}`}>R$ {formatMoney(p.totalValue - (p.amountPaid || 0))}</p>
                                </div>
                              </div>
                            )
                          }) : (
                            <div className="flex flex-col items-center justify-center p-6 text-slate-400 opacity-60">
                              <CheckCircle size={32} className="mb-2 text-slate-300" />
                              <span className="text-[10px] uppercase font-black tracking-widest text-center">Nenhuma conta a pagar no período</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[10px] font-black uppercase text-rose-500 bg-rose-50 dark:bg-rose-900/10 rounded-2xl py-6 cursor-pointer relative z-20" onClick={() => setHidePaymentReminders(false)}>
                          Visualizar Lembretes de Pagamento
                        </div>
                      )}
                    </div>,
                    sectionId
                  );

                case 'lembretes_recebimento':
                  return withControls(
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] p-5 sm:p-8 shadow-sm flex flex-col h-full overflow-hidden transition-all">
                      <div className="flex justify-between items-center mb-4 sm:mb-6">
                        <h3 className="text-xs font-black uppercase text-emerald-500 tracking-widest flex items-center gap-2">
                          <Lightning size={18} weight="duotone" /> A Receber ({receiptReminders.length})
                        </h3>
                        <div className="flex items-center gap-2">
                          <select
                            value={receiptReminderDays}
                            onChange={(e) => setReceiptReminderDays(Number(e.target.value))}
                            title="Dias Filtrados"
                            className="bg-slate-50 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 outline-none rounded-md relative z-20"
                          >
                            <option value={0}>Hoje</option>
                            <option value={3}>Até 3 dias</option>
                            <option value={7}>Até 7 dias</option>
                            <option value={15}>Até 15 dias</option>
                            <option value={30}>Até 30 dias</option>
                          </select>
                          <button title="Ocultar" onClick={() => toggleSection('lembretes_recebimento')} className="text-slate-400 hover:text-slate-600 transition-colors relative z-20">
                            <EyeSlash size={18} />
                          </button>
                        </div>
                      </div>
                      {!hideReceiptReminders ? (
                        <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar max-h-[300px] pr-2">
                          {receiptReminders.length > 0 ? receiptReminders.map(s => {
                            const customer = customers.find(c => c.id === s.customerId);
                            const isOverdue = new Date(s.dueDate + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));

                            const type = (s as any).type || 'sale'; // Handle receipts vs sales

                            return (
                              <div
                                key={s.id}
                                onClick={() => onNavigateToSaleOrReceipt ? onNavigateToSaleOrReceipt(s.customerId, s.id, type) : setView('relacionamento')}
                                className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all cursor-pointer hover:scale-[1.02] shadow-sm relative z-20 ${isOverdue ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700 hover:border-slate-300'}`}
                              >
                                <div>
                                  <span className="text-[11px] font-black uppercase dark:text-white truncate max-w-[150px] block">{customer?.name || 'Cliente Geral'}</span>
                                  <span className={`text-[9px] font-bold uppercase mt-0.5 ${isOverdue ? 'text-amber-500' : 'text-slate-400'}`}>
                                    {formatDate(s.dueDate)} {isOverdue ? '(VENCIDO)' : ''}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <p className={`text-[13px] font-black ${isOverdue ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-500'}`}>R$ {formatMoney(s.totalValue - s.amountPaid)}</p>
                                </div>
                              </div>
                            )
                          }) : (
                            <div className="flex flex-col items-center justify-center p-6 text-slate-400 opacity-60">
                              <Clock size={32} className="mb-2 text-slate-300" />
                              <span className="text-[10px] uppercase font-black tracking-widest text-center">Nenhuma cobrança no período</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[10px] font-black uppercase text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl py-6 cursor-pointer relative z-20" onClick={() => setHideReceiptReminders(false)}>
                          Visualizar Lembretes de Recebimento
                        </div>
                      )}
                    </div>,
                    sectionId
                  );

                case 'balanco':
                  const totalProjection = stats.receivable + stats.payable || 1;
                  const receivablePerc = Math.round((stats.receivable / totalProjection) * 100);
                  const payablePerc = Math.round((stats.payable / totalProjection) * 100);

                  return withControls(
                    <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] shadow-sm border dark:border-slate-800 flex flex-col justify-center h-full">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                          <ArrowsClockwise size={18} weight="duotone" /> Projeção de Balanço
                        </h3>
                        <button title="Alternar Visibilidade do Balanço" onClick={() => toggleSection('balanco')} className="text-slate-400 hover:text-slate-600 relative z-20"><EyeSlash size={18} /></button>
                      </div>
                      <div className="space-y-4 relative z-20">
                        <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black uppercase text-slate-400">Distribuição Financeira</span>
                          <span className={`text-sm font-black dark:text-white transition-all duration-300 ${isValuesBlurred ? 'blur-md select-none opacity-50' : ''}`}>R$ {formatMoney(stats.receivable + stats.payable)}</span>
                        </div>
                        <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden">
                          <div
                            className="bg-blue-500 transition-all dynamic-width"
                            style={{
                              '--progress': `${receivablePerc}%`,
                              width: 'var(--progress)'
                            } as React.CSSProperties & { '--progress': string }}
                          ></div>
                          <div
                            className="bg-rose-500 transition-all dynamic-width"
                            style={{
                              '--progress': `${payablePerc}%`,
                              width: 'var(--progress)'
                            } as React.CSSProperties & { '--progress': string }}
                          ></div>
                        </div>
                        <div className="flex justify-between items-start pt-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-sm shrink-0"></div>
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black uppercase text-slate-400">Recebíveis ({receivablePerc}%)</span>
                              <span className={`text-[11px] font-black dark:text-white ${isValuesBlurred ? 'blur-sm select-none opacity-50' : ''}`}>R$ {formatMoney(stats.receivable)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] font-black uppercase text-slate-400">Pendentes ({payablePerc}%)</span>
                              <span className={`text-[11px] font-black dark:text-white ${isValuesBlurred ? 'blur-sm select-none opacity-50' : ''}`}>R$ {formatMoney(stats.payable)}</span>
                            </div>
                            <div className="w-3 h-3 bg-rose-500 rounded-sm shrink-0"></div>
                          </div>
                        </div>
                      </div>
                    </div>,
                    sectionId
                  );

                case 'estoque_consulta':
                  const filteredStock = (products || []).filter(p => !stockSearchQuery || (p.name || '').toLowerCase().includes(stockSearchQuery.toLowerCase()) || (p.reference || '').toLowerCase().includes(stockSearchQuery.toLowerCase())).slice(0, 10);
                  return withControls(
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] p-5 sm:p-8 shadow-sm flex flex-col h-full overflow-hidden transition-all">
                      <div className="flex justify-between items-center mb-4 sm:mb-6">
                        <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest flex items-center gap-2">
                          <Package size={18} weight="duotone" /> Consulta de Estoque
                        </h3>
                        <button title="Ocultar" onClick={() => toggleSection('estoque_consulta')} className="text-slate-400 hover:text-slate-600 transition-colors relative z-20">
                          <EyeSlash size={18} />
                        </button>
                      </div>
                      <div className="relative mb-4 z-20">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MagnifyingGlass size={16} className="text-slate-400" />
                        </div>
                        <input
                          type="text"
                          className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                          placeholder="Buscar por referência ou modelo..."
                          value={stockSearchQuery}
                          onChange={(e) => setStockSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar max-h-[250px] pr-2 relative z-20">
                        {filteredStock.length > 0 ? filteredStock.map(p => {
                          let retailQty = 0;
                          let retailSale = 0;
                          (p.variations || []).forEach(v => {
                            retailQty += (v.stock || 0);
                            retailSale += (v.stock || 0) * (v.salePrice || 0);
                          });

                          let wholesaleBoxes = 0;
                          let wholesaleQty = 0;
                          let wholesaleSale = 0;
                          (p.wholesaleStock || []).forEach(ws => {
                            const grid = (grids || []).find(g => g.id === ws.gridId);
                            const dist = (grid?.distributions || []).find((d: any) => d.id === ws.distributionId);
                            const pairsPerBox = dist ? Object.values(dist.quantities || {}).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number : 0;
                            wholesaleBoxes += ws.boxes || 0;
                            wholesaleQty += (ws.boxes || 0) * pairsPerBox;
                            wholesaleSale += (ws.boxes || 0) * (ws.salePricePerBox || 0);
                          });

                          if (retailQty === 0 && wholesaleBoxes === 0) return null;

                          return (
                            <div key={p.id} className="flex flex-col p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm transition-colors gap-2">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                <div className="mb-1 sm:mb-0">
                                  <span className="text-[11px] font-black uppercase text-indigo-600 block">{p.reference}</span>
                                  {p.name && <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{p.name}</span>}
                                </div>
                                <div className="flex gap-4">
                                  {p.hasRetail && (
                                    <div className="text-right">
                                      <p className="text-[9px] font-black uppercase text-emerald-500">Varejo</p>
                                      <p className="text-xs font-black dark:text-white">{retailQty} <span className="text-[9px] text-slate-400 font-bold uppercase">un</span></p>
                                      <p className={`text-[9px] font-bold text-slate-400 mt-0.5 ${isValuesBlurred ? 'blur-sm select-none opacity-50' : ''}`}>R$ {formatMoney(retailSale)}</p>
                                    </div>
                                  )}
                                  {p.hasWholesale && (
                                    <div className="text-right border-l border-slate-300 dark:border-slate-600 pl-4">
                                      <p className="text-[9px] font-black uppercase text-blue-500">Atacado</p>
                                      <p className="text-xs font-black dark:text-white">{wholesaleBoxes} <span className="text-[9px] text-slate-400 font-bold uppercase">cx</span></p>
                                      <p className={`text-[9px] font-bold text-slate-400 mt-0.5 ${isValuesBlurred ? 'blur-sm select-none opacity-50' : ''}`}>R$ {formatMoney(wholesaleSale)}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                                {p.hasRetail && (p.variations || []).filter(v => (v.stock || 0) > 0).map(v => (
                                  <span key={v.id} title={`Varejo: ${colors?.find(c => c.id === v.colorId)?.name || 'Cor'} - ${v.size} (${v.stock} un)`} className="px-2 py-1 bg-white dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 rounded-lg text-[9px] font-bold text-slate-700 dark:text-slate-200 shadow-sm">
                                    <span className="text-emerald-500 mr-1">V:</span>{colors?.find(c => c.id === v.colorId)?.name || 'Cor'} {v.size} <span className="opacity-60 ml-0.5">({v.stock})</span>
                                  </span>
                                ))}
                                {p.hasWholesale && (p.wholesaleStock || []).filter(ws => (ws.boxes || 0) > 0).map(ws => (
                                  <span key={ws.id} title={`Atacado: ${colors?.find(c => c.id === ws.colorId)?.name || 'Cor'} - Grade ${grids?.find(g => g.id === ws.gridId)?.name || ''} (${ws.boxes} cx)`} className="px-2 py-1 bg-white dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 rounded-lg text-[9px] font-bold text-slate-700 dark:text-slate-200 shadow-sm">
                                    <span className="text-blue-500 mr-1">A:</span>{colors?.find(c => c.id === ws.colorId)?.name || 'Cor'} {grids?.find(g => g.id === ws.gridId)?.name || ''} <span className="opacity-60 ml-0.5">({ws.boxes}cx)</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        }) : (
                          <div className="flex flex-col items-center justify-center p-6 text-slate-400 opacity-60">
                            <Package size={32} className="mb-2 text-slate-300" />
                            <span className="text-[10px] uppercase font-black tracking-widest text-center">Nenhum produto encontrado</span>
                          </div>
                        )}
                      </div>
                    </div>,
                    sectionId
                  );

                case 'historico_consolidado':
                  return withControls(
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] p-5 sm:p-8 shadow-sm flex flex-col h-full overflow-hidden transition-all col-span-1 lg:col-span-2">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xs font-black uppercase text-indigo-500 tracking-widest flex items-center gap-2">
                            <ArrowsClockwise size={18} weight="duotone" /> Histórico Consolidado
                          </h3>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <button
                              onClick={() => toggleSection('historico_consolidado')}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all active:scale-95"
                              title="Ocultar Seção"
                            >
                              <EyeSlash size={16} weight="bold" />
                            </button>
                            <button
                              onClick={() => setIsHistoryMinimized(!isHistoryMinimized)}
                              className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all active:scale-95"
                              title={isHistoryMinimized ? "Expandir" : "Minimizar"}
                            >
                              {isHistoryMinimized ? <CaretDown size={16} weight="bold" /> : <CaretUp size={16} weight="bold" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto relative z-20">
                          <div className="relative w-full sm:w-64">
                            <input
                              type="text"
                              placeholder="BUSCAR PESSOA/PEDIDO..."
                              value={historySearchQuery}
                              onChange={(e) => setHistorySearchQuery(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-[10px] font-black uppercase focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                            />
                            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          </div>

                          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                            <button 
                              onClick={() => setHistoryTab('all')}
                              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${historyTab === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
                            >
                              Tudo
                            </button>
                            <button 
                              onClick={() => setHistoryTab('clients')}
                              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${historyTab === 'clients' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
                            >
                              Clientes
                            </button>
                            <button 
                              onClick={() => setHistoryTab('purchases')}
                              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${historyTab === 'purchases' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
                            >
                              Compras
                            </button>
                          </div>

                          {selectedHistoryItems.length > 0 && (
                            <button
                              onClick={handleExportConsolidatedPDF}
                              disabled={isExportingPDF}
                              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                            >
                              {isExportingPDF ? <ArrowsClockwise size={14} className="animate-spin" /> : <FilePdf size={14} weight="bold" />}
                              Gerar PDF ({selectedHistoryItems.length})
                            </button>
                          )}
                        </div>
                      </div>

                      {!isHistoryMinimized ? (
                        <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[500px] pr-2 relative z-20">
                          <div className="space-y-2">
                            {consolidatedHistory.length === 0 ? (
                              <div className="flex flex-col items-center justify-center p-12 text-slate-400 opacity-50">
                                <Clock size={48} weight="duotone" className="mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-center">Nenhum registro encontrado</p>
                              </div>
                            ) : (
                              consolidatedHistory.map((item) => (
                                <div 
                                  key={item.id}
                                  className={`group flex items-center gap-3 p-3 rounded-2xl border-2 transition-all hover:scale-[1.01] ${selectedHistoryItems.includes(item.id) ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/30 shadow-md' : 'bg-slate-50 dark:bg-slate-800/40 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                                >
                                  <button 
                                    onClick={() => toggleHistorySelection(item.id)}
                                    className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedHistoryItems.includes(item.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}
                                  >
                                    {selectedHistoryItems.includes(item.id) && <CheckCircle size={12} weight="bold" />}
                                  </button>

                                  <div 
                                    className="flex-1 cursor-pointer"
                                    onClick={() => {
                                      if (item.type === 'compra') {
                                        onNavigateToPurchase ? onNavigateToPurchase(item.original.supplierId, item.id) : setView('relacionamento_fornecedores');
                                      } else {
                                        onNavigateToSaleOrReceipt ? onNavigateToSaleOrReceipt(item.original.customerId, item.id, item.type === 'venda' ? 'sale' : 'receipt') : setView('relacionamento');
                                      }
                                    }}
                                  >
                                    <div className="flex justify-between items-start mb-1">
                                      <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${item.type === 'venda' ? 'bg-blue-100 text-blue-600' : item.type === 'recibo' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                          {item.type === 'venda' ? <ShoppingCart size={12} weight="bold" /> : item.type === 'recibo' ? <ArrowSquareDownLeft size={12} weight="bold" /> : <ArrowSquareUpRight size={12} weight="bold" />}
                                        </div>
                                        <div>
                                          <h4 className="text-[11px] font-black uppercase dark:text-white leading-none">{item.title}</h4>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{item.subtitle}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className={`text-xs font-black sm:text-sm ${item.type === 'recibo' ? 'text-emerald-500' : item.type === 'venda' ? 'text-blue-600' : 'text-rose-500'}`}>
                                          {item.type === 'compra' ? '-' : ''} R$ {formatMoney(item.value)}
                                        </p>
                                        <p className="text-[8px] font-black text-slate-400 mt-0.5">{formatDate(item.date)}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center gap-4">
                                      <p className="text-[9px] text-slate-500 dark:text-slate-400 line-clamp-1 italic flex-1">
                                        {item.description}
                                      </p>
                                      {item.pendingValue > 0 && (
                                        <span className="text-[9px] font-black text-rose-500 whitespace-nowrap">
                                          Pendente: R$ {formatMoney(item.pendingValue)}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${item.status === 'Quitado' || item.status === 'Entregue' ? 'bg-emerald-100 text-emerald-600' : item.status === 'Cancelada' ? 'bg-rose-100 text-rose-600' : item.status === 'Parcial' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                                        FIN: {item.status}
                                      </span>
                                      
                                      {item.type !== 'compra' ? (
                                        <select
                                          title="Status Operacional"
                                          value={item.operationalStatus}
                                          onChange={(e) => handleStatusChange(item.id, item.type, e.target.value as SaleStatus)}
                                          onClick={(e) => e.stopPropagation()}
                                          className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase outline-none border-none cursor-pointer ${item.operationalStatus === 'Entregue' || item.operationalStatus === 'Coletado' ? 'bg-emerald-100 text-emerald-600' : item.operationalStatus === 'Cancelada' ? 'bg-rose-100 text-rose-600' : item.operationalStatus === 'Pendente' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}
                                        >
                                          <option value="Pendente">OP: Pendente</option>
                                          <option value="Aguardando Aprovação">OP: Aguardando Aprov.</option>
                                          <option value="Aguardando Estoque">OP: Aguardando Estoq.</option>
                                          <option value="Aguardando Rota">OP: Aguardando Rota</option>
                                          <option value="Em produção">OP: Em produção</option>
                                          <option value="Coletado">OP: Coletado</option>
                                          <option value="Entregue">OP: Entregue</option>
                                          <option value="Cancelada">OP: Cancelada</option>
                                        </select>
                                      ) : (
                                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${item.operationalStatus === 'Entregue' || item.operationalStatus === 'Coletado' ? 'bg-emerald-100 text-emerald-600' : item.operationalStatus === 'Cancelada' ? 'bg-rose-100 text-rose-600' : item.operationalStatus === 'Pendente' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                          OP: {item.operationalStatus}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setIsHistoryMinimized(false)}
                          className="flex-1 flex items-center justify-center text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl py-6 cursor-pointer relative z-20 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-all"
                        >
                          Visualizar Histórico Consolidado
                        </button>
                      )}
                    </div>,
                    sectionId
                  );

                case 'atividades':
                  return withControls(
                    <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] p-5 sm:p-8 shadow-sm overflow-hidden h-full">
                      <div className="flex justify-between items-center mb-5 sm:mb-8">
                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Últimas Atividades</span>
                        <button onClick={() => setView('vendas')} className="text-[10px] font-black text-blue-600 uppercase hover:underline relative z-20">Ver Todos</button>
                        <button title="Ocultar Visibilidade Desta Seção" onClick={() => toggleSection('atividades')} className="text-slate-400 hover:text-slate-600 relative z-20"><EyeSlash size={18} /></button>
                      </div>
                      <div className="space-y-3 relative z-20">
                        {sales.length > 0 ? sales.slice(-5).reverse().map((s: Sale) => (
                          <div key={s.id} className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border dark:border-slate-700 hover:border-blue-300 transition-colors">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-blue-600">{s.saleNumber}</span>
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase truncate max-w-[120px] sm:max-w-none">{customers.find(c => c.id === s.customerId)?.name || 'N/A'}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-emerald-600 leading-none">R$ {formatMoney(s.totalValue)}</p>
                              <span className={`text-[8px] font-black uppercase ${s.status === 'Aguardando Aprovação' ? 'text-amber-500' : 'text-slate-400'}`}>{s.status}</span>
                            </div>
                          </div>
                        )) : <p className="text-center py-10 text-slate-400 text-[10px] uppercase font-bold tracking-widest">Aguardando registros...</p>}
                      </div>
                    </div>,
                    sectionId
                  );

                case 'patrimonio':
                  return withControls(
                    <div className="bg-slate-950 rounded-[2rem] p-6 sm:p-8 text-white flex flex-col justify-center gap-4 relative overflow-hidden shadow-2xl h-full">
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-800/40 to-indigo-950/40"></div>
                      <Lightning className="absolute -right-10 -bottom-10 text-white/5 rotate-12" size={180} weight="fill" />

                      {/* Botão para ocultar patrimônio */}
                      <button onClick={() => toggleSection('patrimonio')} className="absolute top-4 right-4 z-20 text-white/40 hover:text-white/80 transition-colors" title="Ocultar Patrimônio">
                        <EyeSlash size={18} />
                      </button>

                      <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Patrimônio Estimado</p>
                        <h4 className="text-3xl sm:text-4xl font-black tracking-tight mb-6 sm:mb-8 transition-all duration-300">R$ {formatMoney(stats.netWorth)}</h4>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <div className="p-3 sm:p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-[8px] font-black text-white/40 uppercase mb-1">Peças</p>
                            <p className="text-lg font-black text-emerald-400">{stats.stockQty}</p>
                          </div>
                          <div className="p-3 sm:p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-[8px] font-black text-white/40 uppercase mb-1">Pedidos</p>
                            <p className="text-lg font-black text-blue-400">{sales.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>,
                    sectionId
                  );

                default:
                  return null;
              }
            })}

            {/* Restore hidden sections buttons area */}
            {hiddenSections.length > 0 && (
              <div className="col-span-1 lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                {hiddenSections.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleSection(s)}
                    className="flex items-center justify-center gap-2 p-4 bg-slate-50 dark:bg-slate-800/20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-all"
                  >
                    <Eye size={16} /> Mostrar {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Diagnóstico de Conexão */}
          < div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] p-6 shadow-sm" >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${connStatus === 'ok' ? 'bg-emerald-100 text-emerald-600' : connStatus === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                  <ArrowsClockwise size={24} weight="bold" />
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase dark:text-white tracking-widest">Status da Conexão</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    {connStatus === 'idle' ? 'Clique para testar conexão com banco de dados' :
                      connStatus === 'checking' ? 'Verificando...' :
                        connStatus === 'ok' ? 'Conectado ao Supabase' : 'Falha na Conexão'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {connStatus === 'error' && (
                  <div className="flex items-center gap-2 text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-4 py-2 rounded-xl border border-rose-100 dark:border-rose-800">
                    <WarningCircle size={14} weight="fill" />
                    <span className="text-[9px] font-black uppercase truncate max-w-[200px]">{lastError}</span>
                  </div>
                )}
                <button
                  onClick={testConnection}
                  disabled={connStatus === 'checking'}
                  title="Testar conexão com o banco de dados"
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${connStatus === 'checking' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700'}`}
                >
                  {connStatus === 'checking' ? <ArrowsClockwise size={14} className="animate-spin" /> : <Lightning size={14} />}
                  {connStatus === 'idle' ? 'Testar Agora' : 'Reverificar'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-800/40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem] text-slate-400 opacity-70 mt-4">
          <EyeSlash size={48} className="mb-4" weight="duotone" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 text-center">Painel Oculto</h3>
          <p className="text-[10px] font-bold mt-2 text-center max-w-xs">Os dados do painel foram ocultados para sua privacidade. Clique no botão de olho no topo para restaurar.</p>
        </div>
      )}
    </div>
  );
};
