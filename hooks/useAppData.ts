// hooks/useAppData.ts
import { useState, useEffect, useCallback } from 'react';
import { Product, Customer, Supplier, Sale, AccountEntry, Transaction, Purchase, Receipt, AgendaTask, AppNote, AppColor, AppUnit, AppGrid, ExpenseCategory, FamilyMember, PersonalCategory, PersonalBudget, PersonalTransaction, BankAccount, AccountTransfer, Cheque } from '../types';
import { generateId, sanitizeBankAccountId } from '../lib/utils';
import { bankAccountService } from '../services/bankAccountService';
import { db } from '../services/api';
import { collection, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { productService } from '../services/productService';
import { customerService } from '../services/customerService';
import { supplierService } from '../services/supplierService';
import { saleService } from '../services/saleService';
import { purchaseService } from '../services/purchaseService';
import { financeService } from '../services/financeService';
import { configService } from '../services/configService';
import { receiptService } from '../services/receiptService';
import { personalFinanceService } from '../services/personalFinanceService';

export const useAppData = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [colors, setColors] = useState<AppColor[]>([]);
    const [units, setUnits] = useState<AppUnit[]>([]);
    const [grids, setGrids] = useState<AppGrid[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [financials, setFinancials] = useState<AccountEntry[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [tasks, setTasks] = useState<AgendaTask[]>([]);
    const [notes, setNotes] = useState<AppNote[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

    // Personal Finance
    const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
    const [personalCategories, setPersonalCategories] = useState<PersonalCategory[]>([]);
    const [personalBudgets, setPersonalBudgets] = useState<PersonalBudget[]>([]);
    const [personalTransactions, setPersonalTransactions] = useState<PersonalTransaction[]>([]);

    const [showMiniatures, setShowMiniatures] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [cheques, setCheques] = useState<Cheque[]>([]);

    const syncData = useCallback(async () => {
        setIsLoading(true);
        try {
            const safeFetch = async (fn: () => Promise<any>, label: string) => {
                try {
                    return await fn();
                } catch (err) {
                    console.error(`Erro ao carregar ${label}:`, err);
                    return [];
                }
            };

            const [p, c, s, col, u, g, cat, sa, f, t, pur, rece, tsk, n, pFam, pCat, pBud, pTrans, ba, chq] = await Promise.all([
                safeFetch(() => productService.getProducts(), 'produtos'),
                safeFetch(() => customerService.getCustomers(), 'clientes'),
                safeFetch(() => supplierService.getSuppliers(), 'fornecedores'),
                safeFetch(() => configService.getColors(), 'cores'),
                safeFetch(() => configService.getUnits(), 'unidades'),
                safeFetch(() => configService.getGrids(), 'grades'),
                safeFetch(() => configService.getExpenseCategories(), 'categorias'),
                safeFetch(() => saleService.getSales(), 'vendas'),
                safeFetch(() => financeService.getFinancials(), 'financeiro'),
                safeFetch(() => financeService.getTransactions(), 'transações'),
                safeFetch(() => purchaseService.getPurchases(), 'compras'),
                safeFetch(() => receiptService.getReceipts(), 'recebimentos'),
                safeFetch(() => financeService.getTasks(), 'tarefas'),
                safeFetch(() => financeService.getNotes(), 'notas'),
                safeFetch(() => personalFinanceService.getFamilyMembers(), 'family_members'),
                safeFetch(() => personalFinanceService.getCategories(), 'personal_categories'),
                safeFetch(() => personalFinanceService.getBudgets(), 'personal_budgets'),
                safeFetch(() => personalFinanceService.getTransactions(), 'personal_transactions'),
                safeFetch(() => bankAccountService.getAccounts(), 'bank_accounts'),
                safeFetch(async () => {
                   const snap = await getDocs(collection(db, 'cheques'));
                   return snap.docs.map(d => {
                       const data = d.data();
                       return { 
                           id: d.id, 
                           ...data,
                           isPaid: data.is_paid ?? data.isPaid 
                       } as Cheque;
                   });
                }, 'cheques'),
            ]);

            setProducts(p);
            setCustomers(c);
            setSuppliers(s);
            setColors(col);
            setUnits(u);
            setGrids(g);
            setCategories(cat);
            setSales(sa);
            setFinancials(f);
            setTransactions(t);
            setPurchases(pur);
            setReceipts(rece);
            setTasks(tsk);
            setNotes(n);
            setFamilyMembers(pFam);
            setPersonalCategories(pCat);
            setPersonalBudgets(pBud);
            setPersonalTransactions(pTrans);
            setBankAccounts(ba);
            setCheques(chq);

            console.log('✅ Dados carregados com sucesso (Firebase).');
        } catch (err) {
            console.error('Erro fatal ao carregar dados do Firebase:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        syncData();
    }, [syncData]);

    const testConnection = async () => {
        try {
            // Test Firestore by trying to get one product (doesn't matter if it exists)
            await getDocs(collection(db, 'products'));
            return { success: true };
        } catch (error: any) {
            console.error('Erro no teste de conexão Firebase:', error);
            return { success: false, message: error.message };
        }
    };

    const withSaving = useCallback(async (fn: () => Promise<void>) => {
        setIsSaving(true);
        try {
            await fn();
        } catch (error: any) {
            console.error("❌ ERRO NO SALVAMENTO:", error);
            alert(`Erro ao salvar dados: ${error.message || 'Erro desconhecido'}.`);
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, []);

    const STORAGE_KEY = 'gestao_pro_v30_wholesale_retail';
    const getRawData = () => ({ products, customers, suppliers, colors, units, grids, sales, financials, transactions, purchases, receipts, tasks, notes, showMiniatures, familyMembers, personalCategories, personalBudgets, personalTransactions, bankAccounts });
    const restoreData = (d: any) => {
        setProducts(d.products || []);
        setCustomers(d.customers || []);
        setSuppliers(d.suppliers || []);
        setColors(d.colors || []);
        setUnits(d.units || []);
        setGrids(d.grids || []);
        setSales(d.sales || []);
        setFinancials(d.financials || []);
        setTransactions(d.transactions || []);
        setPurchases(d.purchases || []);
        setReceipts(d.receipts || []);
        setTasks(d.tasks || []);
        setNotes(d.notes || []);
        setFamilyMembers(d.familyMembers || []);
        setPersonalCategories(d.personalCategories || []);
        setPersonalBudgets(d.personalBudgets || []);
        setPersonalTransactions(d.personalTransactions || []);
        setBankAccounts(d.bankAccounts?.filter((a: any) => a.id !== 'estoque-virtual') || []);
        setShowMiniatures(d.showMiniatures !== undefined ? d.showMiniatures : true);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    };

    const calculateStockValue = useCallback(() => {
        const retailValue = products.reduce((total, p) => {
            return total + (p.variations?.reduce((sum, v) => sum + (v.stock * (v.costPrice || 0)), 0) || 0);
        }, 0);

        const wholesaleValue = products.reduce((total, p) => {
            return total + (p.wholesaleStock?.reduce((sum, ws) => sum + (ws.boxes * (ws.costPricePerBox || 0)), 0) || 0);
        }, 0);

        return retailValue + wholesaleValue;
    }, [products]);

    const accountsWithVirtualStock: BankAccount[] = [
        ...bankAccounts,
        {
            id: 'estoque-virtual',
            name: '📦 Estoque (Valor de Custo)',
            balance: calculateStockValue(),
        }
    ];

    return {
        isSaving, isLoading,
        products, customers, suppliers, colors, units, grids, categories, sales, financials, transactions, purchases, receipts, tasks, notes, showMiniatures,
        familyMembers, personalCategories, personalBudgets, personalTransactions,
        bankAccounts: accountsWithVirtualStock,
        realBankAccounts: bankAccounts,
        actions: {
            setShowMiniatures,

            addProduct: async (p: any) => withSaving(async () => {
                const product = { ...p, id: p.id || generateId(), wholesaleStock: p.wholesaleStock || [] };
                const exists = products.find(x => x.id === product.id);
                if (exists) {
                    const updated = await productService.updateProduct(product);
                    setProducts(prev => prev.map(x => x.id === updated.id ? updated : x));
                } else {
                    const created = await productService.createProduct(product);
                    setProducts(prev => [...prev, created]);
                }
            }),
            deleteProduct: async (id: string) => withSaving(async () => {
                await productService.deleteProduct(id);
                setProducts(prev => prev.filter(p => p.id !== id));
            }),
            recalculateStock: async () => withSaving(async () => {
                await productService.syncStockWithHistory();
                const updProds = await productService.getProducts();
                setProducts(updProds);
            }),

            syncData,
            testConnection,

            addSale: async (sale: Omit<Sale, 'id'>, usedBalance: number = 0) => withSaving(async () => {
                const finalSale = await saleService.createSale(sale, usedBalance);
                setSales(prev => [...prev, finalSale]);
                if (usedBalance > 0) {
                    setCustomers(prev => prev.map(c =>
                        c.id === sale.customerId ? { ...c, balance: Math.max(0, c.balance - usedBalance) } : c
                    ));
                }
                const [updTrans, updAccs, updProds] = await Promise.all([
                    financeService.getTransactions(),
                    bankAccountService.getAccounts(),
                    productService.getProducts()
                ]);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
                setProducts(updProds);
            }),
            addPaymentToSale: async (saleId: string, amount: number, date: string, bankAccountId?: string) => withSaving(async () => {
                await saleService.addPaymentToSale(saleId, amount, date, sanitizeBankAccountId(bankAccountId) || undefined);
                const [updSales, updTrans, updAccs] = await Promise.all([
                    saleService.getSales(),
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setSales(updSales);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),
            deleteSale: async (id: string) => withSaving(async () => {
                await saleService.deleteSale(id);
                setSales(prev => prev.filter(s => s.id !== id));
                const [updTrans, updAccs, updProds] = await Promise.all([
                    financeService.getTransactions(),
                    bankAccountService.getAccounts(),
                    productService.getProducts()
                ]);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
                setProducts(updProds);
            }),
            updateSale: async (updatedSale: Sale) => withSaving(async () => {
                await saleService.updateSale(updatedSale);
                setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
                const [updTrans, updAccs, updProds] = await Promise.all([
                    financeService.getTransactions(),
                    bankAccountService.getAccounts(),
                    productService.getProducts()
                ]);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
                setProducts(updProds);
            }),

            addCustomer: async (c: any) => withSaving(async () => {
                const customer = await customerService.createCustomer({ ...c, id: generateId(), balance: 0 });
                setCustomers(prev => [...prev, customer]);
            }),
            updateCustomer: async (c: any) => withSaving(async () => {
                const updated = await customerService.updateCustomer(c);
                setCustomers(prev => prev.map(x => x.id === updated.id ? updated : x));
            }),
            deleteCustomer: async (id: string) => withSaving(async () => {
                await customerService.deleteCustomer(id);
                setCustomers(prev => prev.filter(c => c.id !== id));
            }),

            addSupplier: async (s: any) => withSaving(async () => {
                if (s.id) {
                    const updated = await supplierService.updateSupplier(s);
                    setSuppliers(prev => prev.map(x => x.id === updated.id ? updated : x));
                } else {
                    const supplier = await supplierService.createSupplier({ ...s, id: generateId(), balance: 0 });
                    setSuppliers(prev => [...prev, supplier]);
                }
            }),
            deleteSupplier: async (id: string) => withSaving(async () => {
                await supplierService.deleteSupplier(id);
                setSuppliers(prev => prev.filter(s => s.id !== id));
            }),

            addPurchase: async (p: Purchase) => withSaving(async () => {
                const purchase = await purchaseService.createPurchase(p);
                setPurchases(prev => [...prev, purchase]);
                const updProds = await productService.getProducts();
                setProducts(updProds);
                if (purchase.accounted !== false) {
                    const [updTrans, updAccs] = await Promise.all([
                        financeService.getTransactions(),
                        bankAccountService.getAccounts()
                    ]);
                    setTransactions(updTrans);
                    setBankAccounts(updAccs);
                }
            }),
            updatePurchase: async (p: Purchase) => withSaving(async () => {
                await purchaseService.updatePurchase(p);
                setPurchases(prev => prev.map(x => x.id === p.id ? { ...p } : x));
                const updAccs = await bankAccountService.getAccounts();
                setBankAccounts(updAccs);
            }),
            deletePurchase: async (id: string) => withSaving(async () => {
                await purchaseService.deletePurchase(id);
                setPurchases(prev => prev.filter(p => p.id !== id));
                const [updTrans, updAccs, updProds] = await Promise.all([
                    financeService.getTransactions(),
                    bankAccountService.getAccounts(),
                    productService.getProducts()
                ]);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
                setProducts(updProds);
            }),
            addPaymentToPurchase: async (purchaseId: string, amount: number, date: string, bankAccountId?: string) => withSaving(async () => {
                await purchaseService.addPaymentToPurchase(purchaseId, amount, date, sanitizeBankAccountId(bankAccountId) || undefined);
                const [updPurs, updTrans, updAccs] = await Promise.all([
                    purchaseService.getPurchases(),
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setPurchases(updPurs);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),

            addReceipt: async (r: Receipt) => withSaving(async () => {
                const receipt = await receiptService.createReceipt(r);
                setReceipts(prev => [...prev, receipt]);
                if (receipt.accounted !== false) {
                    const [updTrans, updAccs] = await Promise.all([
                        financeService.getTransactions(),
                        bankAccountService.getAccounts()
                    ]);
                    setTransactions(updTrans);
                    setBankAccounts(updAccs);
                }
            }),
            updateReceipt: async (r: Receipt) => withSaving(async () => {
                await receiptService.updateReceipt(r);
                setReceipts(prev => prev.map(x => x.id === r.id ? { ...r } : x));
                const updAccs = await bankAccountService.getAccounts();
                setBankAccounts(updAccs);
            }),
            deleteReceipt: async (id: string) => withSaving(async () => {
                await receiptService.deleteReceipt(id);
                setReceipts(prev => prev.filter(r => r.id !== id));
                const [updTrans, updAccs] = await Promise.all([
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),
            addPaymentToReceipt: async (receiptId: string, amount: number, date: string, note?: string, bankAccountId?: string) => withSaving(async () => {
                await receiptService.addPaymentToReceipt(receiptId, amount, date, note, sanitizeBankAccountId(bankAccountId) || undefined);
                const [updRece, updTrans, updAccs] = await Promise.all([
                    receiptService.getReceipts(),
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setReceipts(updRece);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),

            deletePaymentFromReceipt: async (receiptId: string, paymentId: string) => withSaving(async () => {
                await receiptService.deletePaymentFromReceipt(receiptId, paymentId);
                const [updRece, updTrans, updAccs] = await Promise.all([
                    receiptService.getReceipts(),
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setReceipts(updRece);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),
            updatePaymentInReceipt: async (receiptId: string, paymentId: string, amount: number, date: string, bankAccountId?: string) => withSaving(async () => {
                await receiptService.updatePaymentInReceipt(receiptId, paymentId, amount, date, bankAccountId);
                const [updRece, updTrans, updAccs] = await Promise.all([
                    receiptService.getReceipts(),
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setReceipts(updRece);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),

            deletePaymentFromSale: async (saleId: string, paymentId: string) => withSaving(async () => {
                await saleService.deletePaymentFromSale(saleId, paymentId);
                const [updSales, updTrans, updAccs] = await Promise.all([
                    saleService.getSales(),
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setSales(updSales);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),
            updatePaymentInSale: async (saleId: string, paymentId: string, amount: number, date: string, bankAccountId?: string) => withSaving(async () => {
                await saleService.updatePaymentInSale(saleId, paymentId, amount, date, bankAccountId);
                const [updSales, updTrans, updAccs] = await Promise.all([
                    saleService.getSales(),
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setSales(updSales);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),
            deletePaymentFromPurchase: async (purchaseId: string, paymentId: string) => withSaving(async () => {
                await purchaseService.deletePaymentFromPurchase(purchaseId, paymentId);
                const [updPurs, updTrans, updAccs] = await Promise.all([
                    purchaseService.getPurchases(),
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setPurchases(updPurs);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),
            updatePaymentInPurchase: async (purchaseId: string, paymentId: string, amount: number, date: string, bankAccountId?: string) => withSaving(async () => {
                await purchaseService.updatePaymentInPurchase(purchaseId, paymentId, amount, date, bankAccountId);
                const [updPurs, updTrans, updAccs] = await Promise.all([
                    purchaseService.getPurchases(),
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setPurchases(updPurs);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),

            addTransaction: async (t: Omit<Transaction, 'id'>) => withSaving(async () => {
                const tx = await financeService.addTransaction(t);
                setTransactions(prev => [tx, ...prev]);
                const updatedAccounts = await bankAccountService.getAccounts();
                setBankAccounts(updatedAccounts);

                if (t.type === 'expense_payment' && (t.description.toLowerCase().includes('pró-labore') || t.description.toLowerCase().includes('pro-labore'))) {
                    try {
                        const personalIncome = await personalFinanceService.createTransaction({
                            date: t.date,
                            type: 'income',
                            amount: Math.abs(t.amount),
                            description: `Receita Pró-Labore: ${t.description}`,
                            isPaid: true,
                            businessTransactionId: tx.id,
                            bank_account_id: t.bankAccountId
                        });
                        setPersonalTransactions(prev => [personalIncome, ...prev]);
                    } catch (e) {
                        console.error("Falha ao injetar Pró-labore no Financeiro Pessoal:", e);
                    }
                }
            }),
            deleteTransaction: async (id: string) => withSaving(async () => {
                const pt = personalTransactions.find(x => x.businessTransactionId === id);
                if (pt) {
                    try {
                        await personalFinanceService.deleteTransaction(pt.id);
                        setPersonalTransactions(prev => prev.filter(x => x.id !== pt.id));
                    } catch (e) {
                        console.error("Failed to delete linked personal transaction:", e);
                    }
                }

                await financeService.deleteTransaction(id);
                setTransactions(prev => prev.filter(t => t.id !== id));
                const updAccs = await bankAccountService.getAccounts();
                setBankAccounts(updAccs);
            }),
            clearManualTransactions: async () => withSaving(async () => {
                await financeService.clearManualTransactions();
                const [updTrans, updAccs] = await Promise.all([
                    financeService.getTransactions(),
                    bankAccountService.getAccounts()
                ]);
                setTransactions(updTrans);
                setBankAccounts(updAccs);
            }),

            addFamilyMember: async (m: any) => withSaving(async () => {
                const member = await personalFinanceService.createFamilyMember(m);
                setFamilyMembers(prev => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)));
            }),
            updateFamilyMember: async (m: FamilyMember) => withSaving(async () => {
                const member = await personalFinanceService.updateFamilyMember(m);
                setFamilyMembers(prev => prev.map(x => x.id === member.id ? member : x).sort((a, b) => a.name.localeCompare(b.name)));
            }),
            deleteFamilyMember: async (id: string) => withSaving(async () => {
                await personalFinanceService.deleteFamilyMember(id);
                setFamilyMembers(prev => prev.filter(m => m.id !== id));
            }),

            addPersonalCategory: async (c: any) => withSaving(async () => {
                const cat = await personalFinanceService.createCategory(c);
                setPersonalCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
            }),
            updatePersonalCategory: async (c: PersonalCategory) => withSaving(async () => {
                const cat = await personalFinanceService.updateCategory(c);
                setPersonalCategories(prev => prev.map(x => x.id === cat.id ? cat : x).sort((a, b) => a.name.localeCompare(b.name)));
            }),
            deletePersonalCategory: async (id: string) => withSaving(async () => {
                await personalFinanceService.deleteCategory(id);
                setPersonalCategories(prev => prev.filter(c => c.id !== id));
            }),

            addPersonalBudget: async (b: any) => withSaving(async () => {
                const bud = await personalFinanceService.createBudget(b);
                setPersonalBudgets(prev => [...prev, bud]);
            }),
            updatePersonalBudget: async (b: PersonalBudget) => withSaving(async () => {
                const bud = await personalFinanceService.updateBudget(b);
                setPersonalBudgets(prev => prev.map(x => x.id === bud.id ? bud : x));
            }),
            deletePersonalBudget: async (id: string) => withSaving(async () => {
                await personalFinanceService.deleteBudget(id);
                setPersonalBudgets(prev => prev.filter(b => b.id !== id));
            }),

            addPersonalTransaction: async (t: any) => withSaving(async () => {
                let businessTxId = t.businessTransactionId;
                if (t.type === 'income' && t.isPaid) {
                    if (!t.bank_account_id) {
                        throw new Error('Para registrar um Aporte que retira valor do caixa da empresa, você DEVE selecionar uma "Conta de Destino" no formulário.');
                    }
                    const businessTx = await financeService.addTransaction({
                        date: t.date,
                        type: 'adjustment',
                        amount: -Math.abs(t.amount),
                        description: `Aporte Finanças Pessoais: ${t.description}`,
                        bankAccountId: t.bank_account_id
                    } as any);
                    businessTxId = businessTx.id;

                    const [updTrans, updAccs] = await Promise.all([
                        financeService.getTransactions(),
                        bankAccountService.getAccounts()
                    ]);
                    setTransactions(updTrans);
                    setBankAccounts(updAccs);
                }

                const trans = await personalFinanceService.createTransaction({
                    ...t,
                    businessTransactionId: businessTxId
                });
                setPersonalTransactions(prev => [trans, ...prev]);
            }),
            updatePersonalTransaction: async (t: PersonalTransaction) => withSaving(async () => {
                let businessTxId = t.businessTransactionId;
                const requiresBizTx = t.type === 'income' && t.bank_account_id && t.isPaid;

                if (requiresBizTx) {
                    if (businessTxId) {
                        const updatedBizTx = await financeService.updateTransaction({
                            id: businessTxId,
                            date: t.date,
                            type: 'adjustment',
                            amount: -Math.abs(t.amount),
                            description: `Aporte Finanças Pessoais: ${t.description}`,
                            bankAccountId: t.bank_account_id
                        } as any);
                        setTransactions(prev => prev.map(x => x.id === businessTxId ? updatedBizTx : x));
                    } else {
                        const businessTx = await financeService.addTransaction({
                            date: t.date,
                            type: 'adjustment',
                            amount: -Math.abs(t.amount),
                            description: `Aporte Finanças Pessoais: ${t.description}`,
                            bankAccountId: t.bank_account_id
                        } as any);
                        businessTxId = businessTx.id;
                        setTransactions(prev => [businessTx, ...prev]);
                    }
                    const updAccs = await bankAccountService.getAccounts();
                    setBankAccounts(updAccs);
                } else if (businessTxId) {
                    await financeService.deleteTransaction(businessTxId);
                    setTransactions(prev => prev.filter(x => x.id !== businessTxId));
                    businessTxId = undefined;
                    const updAccs = await bankAccountService.getAccounts();
                    setBankAccounts(updAccs);
                }

                const trans = await personalFinanceService.updateTransaction({
                    ...t,
                    businessTransactionId: businessTxId
                });
                setPersonalTransactions(prev => prev.map(x => x.id === trans.id ? trans : x));
            }),
            deletePersonalTransaction: async (id: string) => withSaving(async () => {
                const pt = personalTransactions.find(x => x.id === id);

                if (pt?.businessTransactionId) {
                    try {
                        await financeService.deleteTransaction(pt.businessTransactionId);
                        setTransactions(prevBiz => prevBiz.filter(t => t.id !== pt.businessTransactionId));
                        const updAccs = await bankAccountService.getAccounts();
                        setBankAccounts(updAccs);
                    } catch (e) {
                        console.error("Failed to delete linked business transaction:", e);
                    }
                }

                await personalFinanceService.deleteTransaction(id);
                setPersonalTransactions(prevPersonal => prevPersonal.filter(t => t.id !== id));
            }),

            addColor: async (c: any) => withSaving(async () => {
                const color = await configService.createColor({ ...c, id: generateId() });
                setColors(prev => [...prev, color]);
            }),
            updateColor: async (c: AppColor) => withSaving(async () => {
                const updated = await configService.updateColor(c);
                setColors(prev => prev.map(x => x.id === updated.id ? updated : x));
            }),
            deleteColor: async (id: string) => withSaving(async () => {
                await configService.deleteColor(id);
                setColors(prev => prev.filter(c => c.id !== id));
            }),

            addUnit: async (u: any) => withSaving(async () => {
                const unit = await configService.createUnit({ ...u, id: generateId() });
                setUnits(prev => [...prev, unit]);
            }),
            updateUnit: async (u: AppUnit) => withSaving(async () => {
                const updated = await configService.updateUnit(u);
                setUnits(prev => prev.map(x => x.id === updated.id ? updated : x));
            }),
            deleteUnit: async (id: string) => withSaving(async () => {
                await configService.deleteUnit(id);
                setUnits(prev => prev.filter(u => u.id !== id));
            }),

            addGrid: async (g: any) => withSaving(async () => {
                const grid = await configService.createGrid({ ...g, id: generateId(), distributions: [] });
                setGrids(prev => [...prev, grid]);
            }),
            updateGrid: async (g: AppGrid) => withSaving(async () => {
                await configService.updateGrid(g);
                setGrids(prev => prev.map(x => x.id === g.id ? g : x));
            }),
            deleteGrid: async (id: string) => withSaving(async () => {
                await configService.deleteGrid(id);
                setGrids(prev => prev.filter(g => g.id !== id));
            }),

            addTask: async (t: any) => withSaving(async () => {
                const task = await financeService.addTask(t);
                setTasks(prev => [...prev, task]);
            }),
            updateTask: async (t: AgendaTask) => withSaving(async () => {
                await financeService.updateTask(t);
                setTasks(prev => prev.map(x => x.id === t.id ? t : x));
            }),
            deleteTask: async (id: string) => withSaving(async () => {
                await financeService.deleteTask(id);
                setTasks(prev => prev.filter(t => t.id !== id));
            }),

            addNote: async (n: any) => withSaving(async () => {
                const note = await financeService.addNote(n);
                setNotes(prev => [...prev, note]);
            }),
            updateNote: async (n: AppNote) => withSaving(async () => {
                await financeService.updateNote(n);
                setNotes(prev => prev.map(x => x.id === n.id ? n : x));
            }),
            deleteNote: async (id: string) => withSaving(async () => {
                await financeService.deleteNote(id);
                setNotes(prev => prev.filter(n => n.id !== id));
            }),

            addExpenseCategory: async (c: any) => withSaving(async () => {
                const category = await configService.createExpenseCategory(c);
                setCategories(prev => [...prev, category]);
            }),
            updateExpenseCategory: async (c: ExpenseCategory) => withSaving(async () => {
                const updated = await configService.updateExpenseCategory(c);
                setCategories(prev => prev.map(x => x.id === updated.id ? updated : x));
            }),
            deleteExpenseCategory: async (id: string) => withSaving(async () => {
                await configService.deleteExpenseCategory(id);
                setCategories(prev => prev.filter(c => c.id !== id));
            }),

            addBankAccount: async (name: string, balance: number) => withSaving(async () => {
                const account = await bankAccountService.createAccount(name, balance);
                setBankAccounts(prev => [...prev, account]);
            }),
            updateBankAccount: async (id: string, updates: Partial<BankAccount>) => withSaving(async () => {
                const updated = await bankAccountService.updateAccount(id, updates);
                setBankAccounts(prev => prev.map(a => a.id === id ? updated : a));
            }),
            deleteBankAccount: async (id: string) => withSaving(async () => {
                if (id === 'estoque-virtual') {
                    alert('A conta de estoque é virtual e não pode ser deletada.');
                    return;
                }
                await bankAccountService.deleteAccount(id);
                setBankAccounts(prev => prev.filter(a => a.id !== id));
            }),
            transferBetweenAccounts: async (transfer: Omit<AccountTransfer, 'id' | 'created_at'>) => withSaving(async () => {
                await bankAccountService.transfer(transfer);
                const [accs, trans] = await Promise.all([
                    bankAccountService.getAccounts(),
                    financeService.getTransactions()
                ]);
                setBankAccounts(accs);
                setTransactions(trans);
            }),
            adjustBankAccountBalance: async (accountId: string, newBalance: number) => withSaving(async () => {
                const updated = await bankAccountService.adjustBalance(accountId, newBalance);
                setBankAccounts(prev => prev.map(a => a.id === accountId ? updated : a));
            }),

            getRawData,
            restoreData,
            importData: (file: File) => new Promise<void>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target?.result as string);
                        restoreData(data);
                        resolve();
                    } catch (err) { reject(err); }
                };
                reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
                reader.readAsText(file);
            }),

            updateSaleStatus: async (saleId: string, status: any) => withSaving(async () => {
                const sale = sales.find(s => s.id === saleId);
                if (!sale) return;
                await saleService.updateSale({ ...sale, status });
                const [updSales, updProds] = await Promise.all([
                    saleService.getSales(),
                    productService.getProducts()
                ]);
                setSales(updSales);
                setProducts(updProds);
            }),

            updateReceiptStatus: async (receiptId: string, status: any) => withSaving(async () => {
                await updateDoc(doc(db, 'receipts', receiptId), { status });
                const updReceipts = await receiptService.getReceipts();
                setReceipts(updReceipts);
            }),

            updateChequeStatus: async (chequeId: string, isPaid: boolean) => withSaving(async () => {
                await updateDoc(doc(db, 'cheques', chequeId), { is_paid: isPaid });
                const snap = await getDocs(collection(db, 'cheques'));
                const chqs = snap.docs.map(d => {
                    const data = d.data();
                    return { 
                        id: d.id, 
                        ...data,
                        isPaid: data.is_paid ?? data.isPaid 
                    } as Cheque;
                });
                setCheques(chqs);
                const updPurchases = await purchaseService.getPurchases();
                setPurchases(updPurchases);
            }),

            exportData: () => {
                const str = JSON.stringify(getRawData());
                const blob = new Blob([str], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const now = new Date();
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
                a.download = `backup_gestaopro_${dateStr}.json`;
                a.click();
                URL.revokeObjectURL(url);
            },
            resetFactory: async () => {
                setIsSaving(true);
                try {
                    const collections = [
                        'products', 'customers', 'suppliers', 'colors', 'units', 'grids', 'expense_categories', 
                        'sales', 'sale_items', 'payment_records', 'account_entries', 'transactions', 
                        'purchases', 'purchase_items', 'purchase_expenses', 'purchase_payments', 
                        'receipts', 'receipt_items', 'receipt_expense_items', 'agenda_tasks', 'app_notes', 
                        'bank_accounts', 'account_transfers', 'family_members', 'personal_categories', 
                        'personal_budgets', 'personal_transactions', 'variations', 'wholesale_stock_items'
                    ];

                    for (const colName of collections) {
                        const snap = await getDocs(collection(db, colName));
                        if (!snap.empty) {
                            const batch = writeBatch(db);
                            snap.docs.forEach(d => batch.delete(d.ref));
                            await batch.commit();
                        }
                    }
                    syncData();
                    alert('Sistema resetado com sucesso.');
                } catch (error: any) {
                    console.error("Erro no reset:", error);
                    alert("Falha ao resetar sistema.");
                } finally {
                    setIsSaving(false);
                }
            }
        }
    };
};
