
import React, { useState, useEffect, useMemo } from 'react';
import {
  House, ShoppingCart, Package, Users, CurrencyDollar, ChartBar, Truck,
  List, X, ClockCounterClockwise, Stack, ShoppingBag, Moon, Sun, Lightning,
  ArrowLeft, Lightbulb, Handshake, ChartPie, Note, DeviceMobile,
  ChatCircle, SignOut, CalendarBlank, ArrowSquareOut, Gear, AddressBook
} from '@phosphor-icons/react';

import { ViewType, Product } from './types';
import { useAppData } from './hooks/useAppData';
import { NavItem } from './components/NavItem';
import { AIAssistant } from './components/AIAssistant';
import { FloatingShortcuts } from './components/FloatingShortcuts';
import { BottomNav } from './components/BottomNav';

// Importando as Views
import { DashboardView } from './views/DashboardView';
import { EstoqueView } from './views/EstoqueView';
import { ProdutosView } from './views/ProdutosView';
import { VenderView } from './views/VenderView';
import { VendasHistoryView } from './views/VendasHistoryView';
import { FinanceiroView } from './views/FinanceiroView';
import { BackupView } from './views/BackupView';
import { ComprasView } from './views/ComprasView';
import { RelatoriosView } from './views/RelatoriosView';
import { AgendaView } from './views/AgendaView';
import { CadastrosView } from './views/CadastrosView';
import { RelacionamentoVendasView } from './views/RelacionamentoVendasView';
import { RelacionamentoComprasView } from './views/RelacionamentoComprasView';
import { RecebimentosView } from './views/RecebimentosView';
import { ClientesView } from './views/ClientesView';
import { FornecedoresView } from './views/FornecedoresView';
import { FinanceiroPessoalView } from './views/FinanceiroPessoalView';
import { RelatoriosFinanceiroPessoalView } from './views/RelatoriosFinanceiroPessoalView';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const [targetSupplierId, setTargetSupplierId] = useState<string | undefined>(undefined);
  const [customerInitialData, setCustomerInitialData] = useState<{ name: string; phone: string; address: string } | undefined>(undefined);
  const [supplierInitialData, setSupplierInitialData] = useState<{ name: string; phone: string } | undefined>(undefined);

  // New deep link states for relationships
  const [targetRelationshipPurchaseId, setTargetRelationshipPurchaseId] = useState<{ supplierId: string, purchaseId: string } | undefined>(undefined);
  const [targetRelationshipSaleId, setTargetRelationshipSaleId] = useState<{ customerId: string, saleId: string, type: 'sale' | 'receipt' } | undefined>(undefined);

  const { isSaving, ...data } = useAppData();
  const { actions } = data;

  useEffect(() => {
    (window as any).setView = setView;
    return () => { delete (window as any).setView; };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const stats = useMemo(() => {
    // data.bankAccounts aqui já inclui o 'estoque-virtual' vindo do useAppData
    const cash = (data.bankAccounts || []).filter(a => a.id !== 'estoque-virtual').reduce((acc, a) => acc + (a.balance || 0), 0);
    const stockCost = (data.bankAccounts || []).find(a => a.id === 'estoque-virtual')?.balance || 0;

    const receivableSales = (data.sales || []).filter(s => !s.isPaid && s.status !== 'Cancelada').reduce((acc, s) => acc + (s.totalValue - s.amountPaid), 0);
    const receivableReceipts = (data.receipts || []).filter(r => !r.isPaid).reduce((acc, r) => acc + (r.totalValue - (r.amountPaid || 0)), 0);
    const receivable = receivableSales + receivableReceipts;
    const payable = (data.purchases || []).filter(p => !p.isPaid && (p.accounted ?? true)).reduce((acc, p) => acc + (p.totalValue - (p.amountPaid || 0)), 0);

    let stockQtyRetail = 0;
    let stockQtyWholesale = 0;
    let stockSaleRetail = 0;
    let stockSaleWholesale = 0;

    (data.products || []).forEach(p => {
      (p.variations || []).forEach(v => {
        stockQtyRetail += (v.stock || 0);
        stockSaleRetail += (v.stock || 0) * (v.salePrice || 0);
      });
      (p.wholesaleStock || []).forEach(ws => {
        const grid = (data.grids || []).find(g => g.id === ws.gridId);
        const dist = (grid?.distributions || []).find((d: any) => d.id === ws.distributionId);
        const pairsPerBox = dist ? Object.values(dist.quantities || {}).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number : 0;
        const totalBoxes = (ws.boxes || 0);

        stockQtyWholesale += (totalBoxes * pairsPerBox);
        // Aqui multiplicamos o valor de venda da CAIXA pela quantidade de caixas
        stockSaleWholesale += totalBoxes * (ws.salePricePerBox || 0);
      });
    });

    const stockQty = stockQtyRetail + stockQtyWholesale;
    const stockSale = stockSaleRetail + stockSaleWholesale;

    // Patrimônio estimado é a soma de TUDO (Contas + Estoque + Recebíveis - Pendentes)
    const netWorth = cash + stockCost + receivable - payable;

    return { cash, stockCost, stockSale, receivable, payable, stockQty, netWorth };
  }, [data.bankAccounts, data.products, data.sales, data.purchases, data.receipts]);

  const personalBalance = useMemo(() => {
    const pt = data.personalTransactions || [];
    const income = pt.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = pt.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const reserve = pt.filter(t => t.type === 'reserve').reduce((acc, t) => acc + t.amount, 0);
    const planning = pt.filter(t => t.type === 'planning').reduce((acc, t) => acc + t.amount, 0);
    return income - expense - reserve - planning;
  }, [data.personalTransactions]);

  const handleNavigation = (targetView: ViewType, isDeepLink = false) => {
    setView(targetView);
    setIsSidebarOpen(false);
    setIsShortcutsOpen(false);

    // Limpa deep links se não for uma navegação de deep link
    if (!isDeepLink) {
      if (targetView !== 'relacionamento') {
        setTargetRelationshipSaleId(undefined);
      }
      if (targetView !== 'relacionamento_fornecedores') {
        setTargetRelationshipPurchaseId(undefined);
      }
    }

    if (targetView !== 'compras') {
      setTargetSupplierId(undefined);
    }
  };

  const handlePurchaseFromSupplier = (supplierId: string) => {
    setTargetSupplierId(supplierId);
    handleNavigation('compras');
  };

  const handleLinkToSupplier = (data: { name: string; phone: string }) => {
    setSupplierInitialData(data);
    handleNavigation('fornecedores');
    setTimeout(() => setSupplierInitialData(undefined), 500);
  };

  const handleLinkToCustomer = (data: { name: string; phone: string }) => {
    setCustomerInitialData({ ...data, address: '' });
    handleNavigation('clientes');
    setTimeout(() => setCustomerInitialData(undefined), 500);
  };

  const renderContent = () => {
    switch (view) {
      case 'dashboard': return <DashboardView
        stats={stats}
        setView={handleNavigation}
        sales={data.sales}
        customers={data.customers}
        purchases={data.purchases}
        suppliers={data.suppliers}
        categories={data.categories}
        receipts={data.receipts}
        transactions={data.transactions}
        bankAccounts={data.bankAccounts}
        onNavigateToPurchase={(supplierId, purchaseId) => {
          setTargetRelationshipPurchaseId({ supplierId, purchaseId });
          handleNavigation('relacionamento_fornecedores', true);
        }}
        onNavigateToSaleOrReceipt={(customerId, saleId, type) => {
          setTargetRelationshipSaleId({ customerId, saleId, type });
          handleNavigation('relacionamento', true);
        }}
        products={data.products}
        grids={data.grids}
        colors={data.colors}
      />;
      case 'estoque': return <EstoqueView products={data.products} colors={data.colors} showMiniatures={data.showMiniatures} onUpdateProduct={actions.addProduct} onRecalculate={actions.recalculateStock} setView={handleNavigation} />;
      case 'produtos': return <ProdutosView suppliers={data.suppliers} grids={data.grids} colors={data.colors} showMiniatures={data.showMiniatures} onToggleMiniatures={actions.setShowMiniatures} onRequestPurchase={handlePurchaseFromSupplier} />;
      case 'vender': return <VenderView products={data.products} customers={data.customers} grids={data.grids} sales={data.sales} colors={data.colors} showMiniatures={data.showMiniatures} onSale={(sale, usedBalance) => { actions.addSale(sale, usedBalance); handleNavigation('vendas'); }} onBack={() => handleNavigation('dashboard')} />;
      case 'vendas': return <VendasHistoryView sales={data.sales} customers={data.customers} products={data.products} grids={data.grids} colors={data.colors} showMiniatures={data.showMiniatures} onDelete={actions.deleteSale} onUpdate={actions.updateSale} />;
      case 'relacionamento': return <RelacionamentoVendasView
        sales={data.sales} customers={data.customers} products={data.products} colors={data.colors} showMiniatures={data.showMiniatures}
        onUpdateSale={actions.updateSale} onAddPayment={actions.addPaymentToSale} onAddSale={actions.addSale} onUpdateCustomer={actions.updateCustomer}
        receipts={data.receipts} onAddReceiptPayment={actions.addPaymentToReceipt} onDeleteReceipt={actions.deleteReceipt} onDeleteReceiptPayment={actions.deletePaymentFromReceipt} onUpdateReceiptPayment={actions.updatePaymentInReceipt}
        deepLinkTarget={targetRelationshipSaleId}
        onClearDeepLink={() => setTargetRelationshipSaleId(undefined)}
      />;
      case 'relacionamento_fornecedores': return <RelacionamentoComprasView
        purchases={data.purchases} suppliers={data.suppliers} products={data.products} colors={data.colors} showMiniatures={data.showMiniatures} categories={data.categories}
        onUpdatePurchase={actions.updatePurchase} onAddPayment={actions.addPaymentToPurchase} onAddPurchase={actions.addPurchase} onDeletePurchase={actions.deletePurchase} onDeletePayment={actions.deletePaymentFromPurchase} onUpdatePayment={actions.updatePaymentInPurchase}
        bankAccounts={data.bankAccounts}
        deepLinkTarget={targetRelationshipPurchaseId}
        onClearDeepLink={() => setTargetRelationshipPurchaseId(undefined)}
      />;
      case 'compras': return <ComprasView initialSupplierId={targetSupplierId} sales={data.sales} products={data.products} suppliers={data.suppliers} grids={data.grids} colors={data.colors} showMiniatures={data.showMiniatures} categories={data.categories} purchases={data.purchases} bankAccounts={data.bankAccounts} onPurchase={(purchase) => { actions.addPurchase(purchase); }} onUpdatePurchase={actions.updatePurchase} onDeletePurchase={actions.deletePurchase} onAddPayment={actions.addPaymentToPurchase} />;
      case 'clientes': return <ClientesView
        customers={data.customers}
        sales={data.sales}
        purchases={data.purchases}
        suppliers={data.suppliers}
        onAdd={actions.addCustomer}
        onDelete={actions.deleteCustomer}
        onUpdate={actions.updateCustomer}
        onReceivePayment={(saleId) => actions.addPaymentToSale(saleId, 0, new Date().toISOString())}
        initialData={customerInitialData}
        onLinkToSupplier={handleLinkToSupplier}
      />;
      case 'fornecedores': return <FornecedoresView
        suppliers={data.suppliers}
        purchases={data.purchases}
        sales={data.sales}
        customers={data.customers}
        onAddOrUpdate={actions.addSupplier}
        onDelete={actions.deleteSupplier}
        onAddPayment={(purchaseId) => actions.addPaymentToPurchase(purchaseId, 0, new Date().toISOString())}
        initialData={supplierInitialData}
        onLinkToCustomer={handleLinkToCustomer}
      />;
      case 'cadastros': return <CadastrosView transactions={data.transactions} customers={data.customers} suppliers={data.suppliers} colors={data.colors} units={data.units} grids={data.grids} categories={data.categories} personalCategories={data.personalCategories} sales={data.sales} purchases={data.purchases} actions={actions} personalBalance={personalBalance} />;
      case 'financeiro': return <FinanceiroView
        transactions={data.transactions}
        sales={data.sales}
        purchases={data.purchases}
        customers={data.customers}
        suppliers={data.suppliers}
        onReceive={actions.addPaymentToSale}
        onPay={actions.addPaymentToPurchase}
        onDeletePaymentFromSale={actions.deletePaymentFromSale}
        onUpdatePaymentInSale={actions.updatePaymentInSale}
        onDeletePaymentFromPurchase={actions.deletePaymentFromPurchase}
        onUpdatePaymentInPurchase={actions.updatePaymentInPurchase}
        onUpdatePurchase={actions.updatePurchase}
        receipts={data.receipts}
        onReceiveReceipt={actions.addPaymentToReceipt}
        bankAccounts={data.bankAccounts}
        onAddAccount={actions.addBankAccount}
        onUpdateAccount={actions.updateBankAccount}
        onDeleteAccount={actions.deleteBankAccount}
        onTransfer={actions.transferBetweenAccounts}
        onAdjustBalance={actions.adjustBankAccountBalance}
        onReceiveSale={actions.addPaymentToSale}
        onPayPurchase={actions.addPaymentToPurchase}
        categories={data.categories}
        onDeletePurchase={actions.deletePurchase}
      />;
      case 'financeiro_pessoal_relatorios':
        return (
          <RelatoriosFinanceiroPessoalView
            familyMembers={data.familyMembers}
            categories={data.personalCategories}
            transactions={data.personalTransactions}
            onBack={() => setView('financeiro_pessoal')}
          />
        );
      case 'financeiro_pessoal':
        return (
          <FinanceiroPessoalView
            familyMembers={data.familyMembers}
            categories={data.personalCategories}
            budgets={data.personalBudgets}
            transactions={data.personalTransactions}
            businessTransactions={data.transactions}
            bankAccounts={data.bankAccounts}
            actions={{
              addFamilyMember: actions.addFamilyMember,
              updateFamilyMember: actions.updateFamilyMember,
              deleteFamilyMember: actions.deleteFamilyMember,
              addCategory: actions.addPersonalCategory,
              updateCategory: actions.updatePersonalCategory,
              deleteCategory: actions.deletePersonalCategory,
              addBudget: actions.addPersonalBudget,
              updateBudget: actions.updatePersonalBudget,
              deleteBudget: actions.deletePersonalBudget,
              addPersonalTransaction: actions.addPersonalTransaction,
              updatePersonalTransaction: actions.updatePersonalTransaction,
              deletePersonalTransaction: actions.deletePersonalTransaction,
            }}
          />
        );
      case 'recebimentos': return <RecebimentosView
        customers={data.customers}
        receipts={data.receipts}
        onReceipt={actions.addReceipt}
        onUpdateReceipt={actions.updateReceipt}
        onDeleteReceipt={actions.deleteReceipt}
        onAddPayment={actions.addPaymentToReceipt}
        bankAccounts={data.bankAccounts}
      />;
      case 'relatorios': return <RelatoriosView
        sales={data.sales}
        customers={data.customers}
        products={data.products}
        suppliers={data.suppliers}
        purchases={data.purchases}
        transactions={data.transactions}
        colors={data.colors}
        onExport={actions.exportData}
        onImport={(e) => { const file = e.target.files?.[0]; if (file) actions.importData(file).then(() => alert("Restaurado!")).catch(() => alert("Erro!")) }}
        getRawData={actions.getRawData}
        restoreData={actions.restoreData}
        onReset={actions.resetFactory}
        onSync={actions.syncData}
        onTestConnection={actions.testConnection}
      />;
      case 'agenda': return <AgendaView tasks={data.tasks} notes={data.notes} actions={{ addTask: actions.addTask, updateTask: actions.updateTask, deleteTask: actions.deleteTask, addNote: actions.addNote, updateNote: actions.updateNote, deleteNote: actions.deleteNote }} />;
      case 'backup': return <BackupView
        onExport={actions.exportData}
        onImport={(e) => { const file = e.target.files?.[0]; if (file) actions.importData(file).then(() => alert("Restaurado!")).catch(() => alert("Erro!")) }}
        getRawData={actions.getRawData}
        restoreData={actions.restoreData}
        onBack={() => handleNavigation('dashboard')}
        onReset={actions.resetFactory}
        onSync={actions.syncData}
        onTestConnection={actions.testConnection}
      />;
      default: return <DashboardView stats={stats} setView={handleNavigation} sales={data.sales} customers={data.customers} purchases={data.purchases} suppliers={data.suppliers} categories={data.categories} receipts={data.receipts} transactions={data.transactions} bankAccounts={data.bankAccounts} products={data.products} grids={data.grids} colors={data.colors} />;
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-slate-300 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 pt-[0.6cm]">

      {/* FAB de atalhos — apenas desktop */}
      <FloatingShortcuts setView={handleNavigation} isDesktopOnly />

      {/* Overlay menu mobile */}
      {isShortcutsOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[75] animate-fadeIn"
          onClick={() => setIsShortcutsOpen(false)}
        />
      )}

      {/* Menu Completo Mobile */}
      {isShortcutsOpen && (
        <div className="lg:hidden fixed bottom-20 left-4 right-4 z-[80] bg-slate-900/96 backdrop-blur-xl border border-slate-700/50 p-3 rounded-[2rem] shadow-2xl flex flex-col gap-1 animate-slideUp max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-700/30 mb-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Menu Completo</span>
            <button onClick={() => setIsShortcutsOpen(false)} className="p-1 text-slate-400 hover:text-white" aria-label="Fechar menu"><X size={16} weight="bold" /></button>
          </div>

          {[
            { view: 'dashboard' as ViewType, label: 'Início / Dashboard', color: 'bg-slate-700', icon: <House size={20} weight="duotone" /> },
            { view: 'vender' as ViewType, label: 'Nova Venda', color: 'bg-emerald-600', icon: <ShoppingCart size={20} weight="duotone" /> },
            { view: 'cadastros' as ViewType, label: 'Cadastros', color: 'bg-slate-600', icon: <Gear size={20} weight="duotone" /> },
            { view: 'produtos' as ViewType, label: 'Produtos', color: 'bg-orange-600', icon: <Stack size={20} weight="duotone" /> },
            { view: 'estoque' as ViewType, label: 'Estoque', color: 'bg-indigo-600', icon: <Package size={20} weight="duotone" /> },
            { view: 'compras' as ViewType, label: 'Compras', color: 'bg-pink-600', icon: <ShoppingBag size={20} weight="duotone" /> },
            { view: 'financeiro' as ViewType, label: 'Financeiro Emp.', color: 'bg-green-600', icon: <ChartBar size={20} weight="duotone" /> },
            { view: 'financeiro_pessoal' as ViewType, label: 'Fin. Pessoal', color: 'bg-blue-600', icon: <ChartPie size={20} weight="duotone" /> },
            { view: 'financeiro_pessoal_relatorios' as ViewType, label: 'Relatórios Fin. Pessoal', color: 'bg-purple-600', icon: <ChartPie size={20} weight="duotone" /> },
            { view: 'recebimentos' as ViewType, label: 'Entradas', color: 'bg-indigo-500', icon: <CurrencyDollar size={20} weight="duotone" /> },
            { view: 'clientes' as ViewType, label: 'B.CLIENTES', color: 'bg-red-600', icon: <AddressBook size={20} weight="duotone" /> },
            { view: 'fornecedores' as ViewType, label: 'B.FORN', color: 'bg-emerald-600', icon: <AddressBook size={20} weight="duotone" /> },
            { view: 'relacionamento' as ViewType, label: 'Histórico de Clientes', color: 'bg-rose-600', icon: <Handshake size={20} weight="duotone" /> },
            { view: 'relacionamento_fornecedores' as ViewType, label: 'Histórico de Compras', color: 'bg-emerald-700', icon: <Handshake size={20} weight="duotone" /> },
            { view: 'vendas' as ViewType, label: 'Histórico', color: 'bg-cyan-700', icon: <ClockCounterClockwise size={20} weight="duotone" /> },
            { view: 'relatorios' as ViewType, label: 'Relatórios e Backup', color: 'bg-cyan-600', icon: <ChartPie size={20} weight="duotone" /> },
            { view: 'agenda' as ViewType, label: 'Agenda', color: 'bg-violet-600', icon: <CalendarBlank size={20} weight="duotone" /> },
          ].map(item => (
            <button
              key={item.view}
              onClick={() => { handleNavigation(item.view); setIsShortcutsOpen(false); }}
              className="flex items-center gap-3 p-3 hover:bg-white/10 rounded-2xl transition-all w-full text-left"
            >
              <div className={`w-10 h-10 rounded-xl ${item.color} text-white flex items-center justify-center shadow-lg shrink-0`}>
                {item.icon}
              </div>
              <span className="text-[12px] font-black uppercase text-white tracking-wider">{item.label}</span>

            </button>
          ))}

          <div className="border-t border-slate-700/30 mt-2 pt-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-3 p-3 hover:bg-white/10 rounded-2xl transition-all w-full text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-600 text-white flex items-center justify-center shadow-lg shrink-0">
                {darkMode ? <Sun size={20} weight="duotone" /> : <Moon size={20} weight="duotone" />}
              </div>
              <span className="text-[12px] font-black uppercase text-white tracking-wider">
                {darkMode ? 'Modo Claro' : 'Modo Escuro'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Sidebar overlay mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar — Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 bg-white dark:bg-slate-900 border-r dark:border-slate-800 transition-transform lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8 pl-2 mt-2">
            <div className="flex items-center gap-2 font-black text-blue-600 text-[11px] uppercase tracking-tighter">
              <Lightning size={16} weight="fill" /> MUSGO ERP
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-slate-400" title="Fechar menu" aria-label="Fechar menu"><X size={16} weight="bold" /></button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
            <NavItem active={view === 'dashboard'} icon={<House size={16} weight="duotone" />} label="Início" onClick={() => handleNavigation('dashboard')} />
            <NavItem active={view === 'vender'} icon={<ShoppingCart size={16} weight="duotone" className="text-emerald-500" />} label="Nova Venda" onClick={() => handleNavigation('vender')} />
            <div className="py-2"><hr className="border-slate-100 dark:border-slate-800" /></div>
            <NavItem active={view === 'cadastros'} icon={<Gear size={16} weight="duotone" className="text-slate-500" />} label="Configurações" onClick={() => handleNavigation('cadastros')} />
            <NavItem active={view === 'produtos'} icon={<Stack size={16} weight="duotone" className="text-orange-500" />} label="Produtos" onClick={() => handleNavigation('produtos')} />
            <NavItem active={view === 'estoque'} icon={<Package size={16} weight="duotone" className="text-indigo-500" />} label="Estoque" onClick={() => handleNavigation('estoque')} />
            <div className="py-2"><hr className="border-slate-100 dark:border-slate-800" /></div>
            <NavItem active={view === 'compras'} icon={<ShoppingBag size={16} weight="duotone" className="text-pink-500" />} label="Compras" onClick={() => handleNavigation('compras')} />
            <NavItem active={view === 'financeiro'} icon={<ChartBar size={16} weight="duotone" className="text-green-500" />} label="Financeiro Emp." onClick={() => handleNavigation('financeiro')} />
            <NavItem active={view === 'financeiro_pessoal'} icon={<ChartPie size={16} weight="duotone" className="text-blue-500" />} label="Fin. Pessoal" onClick={() => handleNavigation('financeiro_pessoal')} />
            <NavItem active={view === 'recebimentos'} icon={<CurrencyDollar size={16} weight="duotone" className="text-indigo-400" />} label="Entradas" onClick={() => handleNavigation('recebimentos')} />
            <div className="py-2"><hr className="border-slate-100 dark:border-slate-800" /></div>
            <NavItem active={view === 'clientes'} icon={<AddressBook size={16} weight="duotone" className="text-red-500" />} label="B.CLIENTES" onClick={() => handleNavigation('clientes')} />
            <NavItem active={view === 'fornecedores'} icon={<AddressBook size={16} weight="duotone" className="text-emerald-500" />} label="B.FORN" onClick={() => handleNavigation('fornecedores')} />
            <NavItem active={view === 'relacionamento'} icon={<Handshake size={16} weight="duotone" className="text-rose-500" />} label="R.CLIENTES" onClick={() => handleNavigation('relacionamento')} />
            <NavItem active={view === 'relacionamento_fornecedores'} icon={<Handshake size={16} weight="duotone" className="text-emerald-600" />} label="R.FORNEC" onClick={() => handleNavigation('relacionamento_fornecedores')} />
            <div className="py-2"><hr className="border-slate-100 dark:border-slate-800" /></div>
            <NavItem active={view === 'vendas'} icon={<ClockCounterClockwise size={16} weight="duotone" />} label="Histórico" onClick={() => handleNavigation('vendas')} />
            <NavItem active={view === 'relatorios'} icon={<ChartPie size={16} weight="duotone" />} label="Relatórios e Backup" onClick={() => handleNavigation('relatorios')} />
          </nav>
          <div className="mt-auto pt-4 border-t dark:border-slate-800">
            <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 hover:bg-slate-50 transition-all">
              {darkMode ? <Sun size={14} weight="duotone" /> : <Moon size={14} weight="duotone" />}
              {darkMode ? 'Claro' : 'Escuro'}
            </button>
          </div>
        </div>
      </aside>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Header */}
        <header className="h-14 border-b bg-white dark:bg-slate-900 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 shrink-0 z-40 relative">

          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(true)} className="hidden lg:flex p-2 text-slate-500" title="Abrir menu" aria-label="Abrir menu">
              <List size={20} weight="bold" />
            </button>
            <button onClick={() => setIsShortcutsOpen(true)} className="lg:hidden p-2 text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Menu Principal" aria-label="Menu Principal">
              <List size={18} weight="bold" />
            </button>

            <div className="lg:hidden flex items-center gap-1.5 font-black text-blue-600 text-[13px] uppercase tracking-tighter ml-1">
              <Lightning size={14} weight="fill" /> GestãoPro
            </div>

            {view !== 'dashboard' && (
              <button
                onClick={() => setView('dashboard')}
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-blue-600/20 active:scale-95 transition-all ml-2"
              >
                <ArrowLeft size={14} weight="bold" /> Voltar
              </button>
            )}

            <div className="hidden md:flex items-center gap-1 ml-2 pl-2 border-l dark:border-slate-700">
              <button
                onClick={() => window.open('https://keep.google.com', '_blank')}
                className="p-1.5 hover:bg-yellow-50 text-slate-400 hover:text-yellow-600 rounded-lg transition-colors"
                title="Google Keep"
              >
                <Note size={16} weight="duotone" />
              </button>
              <button
                onClick={() => window.open('https://web.whatsapp.com', '_blank')}
                className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                title="WhatsApp Web"
              >
                <DeviceMobile size={16} weight="duotone" />
              </button>
              <button
                onClick={() => window.open('whatsapp://', '_blank')}
                className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                title="App WhatsApp"
              >
                <ChatCircle size={16} weight="duotone" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
              <span className="hidden sm:inline text-[9px] font-black text-slate-400 uppercase">{isSaving ? 'Salvando...' : 'Online'}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded-lg text-[8px] font-black uppercase transition-all"
              title="Atualizar programa"
            >
              <ClockCounterClockwise size={12} weight="bold" />
              <span className="hidden xs:inline">Atualizar</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-xl"
              title="Alternar tema"
              aria-label="Alternar tema"
            >
              {darkMode ? <Sun size={18} weight="duotone" /> : <Moon size={18} weight="duotone" />}
            </button>
            <button
              onClick={() => setIsAIOpen(!isAIOpen)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] font-black flex items-center gap-1.5 uppercase text-slate-500"
            >
              <Lightbulb size={12} weight="duotone" /> Lampy
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar relative pb-36 lg:pb-8">
          {renderContent()}
        </main>
      </div>

      <BottomNav
        currentView={view}
        onNavigate={handleNavigation}
        onOpenMenu={() => setIsShortcutsOpen(!isShortcutsOpen)}
      />

      <AIAssistant currentView={view} isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
    </div>
  );
};
export default App;
