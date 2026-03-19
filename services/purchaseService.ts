// services/purchaseService.ts
import { db } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, where, writeBatch, increment } from 'firebase/firestore';
import { Purchase, PurchaseItem, ExpenseItem, PaymentRecord, Cheque } from '../types';
import { generateId, sanitizeBankAccountId, cleanFirestoreData } from '../lib/utils';
import { bankAccountService } from './bankAccountService';

const buildPurchase = (row: any, id: string, items: any[], expenseItems: any[], paymentHistory: any[], cheques: any[]): Purchase => ({
    id: id,
    purchaseNumber: row.purchase_number,
    type: row.type,
    isWholesale: row.is_wholesale,
    supplierId: row.supplier_id,
    date: row.date,
    dueDate: row.due_date,
    totalValue: row.total_value,
    amountPaid: row.amount_paid,
    isPaid: row.is_paid,
    notes: row.notes,
    categoryId: row.category_id,
    accounted: row.accounted ?? true,
    bankAccountId: row.bank_account_id,
    items: items.filter(i => i.purchase_id === id).map(i => ({
        productId: i.product_id,
        variationId: i.variation_id,
        distributionId: i.distribution_id,
        isWholesale: i.is_wholesale,
        colorId: i.color_id,
        quantity: i.quantity,
        costPrice: i.cost_price,
        notes: i.notes,
    } as PurchaseItem)),
    expenseItems: expenseItems.filter(e => e.purchase_id === id).map(e => ({
        id: e.id, description: e.description, value: e.value, notes: e.notes,
    } as ExpenseItem)),
    paymentHistory: paymentHistory.filter(p => p.purchase_id === id).map(p => ({
        id: p.id, date: p.date, amount: p.amount, note: p.note,
    } as PaymentRecord)),
    cheques: cheques.filter(c => c.purchase_id === id).map(c => ({
        id: c.id,
        number: c.number,
        purchaseId: c.purchase_id,
        supplierId: c.supplier_id,
        amount: c.amount,
        dueDate: c.due_date,
        isPaid: c.is_paid,
        created_at: c.created_at
    } as Cheque)),
});

export const purchaseService = {
    getPurchases: async (): Promise<Purchase[]> => {
        const [purchasesSnap, itemsSnap, expItemsSnap, paymentsSnap, chequesSnap] = await Promise.all([
            getDocs(query(collection(db, 'purchases'), orderBy('date', 'desc'))),
            getDocs(collection(db, 'purchase_items')),
            getDocs(collection(db, 'expense_items')),
            getDocs(collection(db, 'payment_records')),
            getDocs(collection(db, 'cheques')),
        ]);

        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const expItems = expItemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const payments = paymentsSnap.docs.filter(d => d.data().purchase_id).map(d => ({ id: d.id, ...d.data() }));
        const cheques = chequesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return purchasesSnap.docs.map(pDoc => buildPurchase(pDoc.data(), pDoc.id, items, expItems, payments, cheques));
    },

    createPurchase: async (purchase: Purchase): Promise<Purchase> => {
        const batch = writeBatch(db);
        const purchaseRef = doc(collection(db, 'purchases'));
        const purchaseId = purchaseRef.id;

        batch.set(purchaseRef, cleanFirestoreData({
            purchase_number: purchase.purchaseNumber || '',
            type: purchase.type || 'general',
            is_wholesale: !!purchase.isWholesale,
            supplier_id: purchase.supplierId || null,
            date: purchase.date || new Date().toISOString(),
            due_date: purchase.dueDate || purchase.date || new Date().toISOString(),
            total_value: purchase.totalValue || 0,
            amount_paid: purchase.isPaid ? (purchase.totalValue || 0) : 0,
            is_paid: !!purchase.isPaid,
            notes: purchase.notes || null,
            category_id: purchase.categoryId || null,
            accounted: purchase.accounted ?? true,
            bank_account_id: sanitizeBankAccountId(purchase.bankAccountId) || null
        }));

        if (purchase.items?.length) {
            purchase.items.forEach(i => {
                const iRef = doc(collection(db, 'purchase_items'));
                batch.set(iRef, cleanFirestoreData({
                    purchase_id: purchaseId,
                    product_id: i.productId || null,
                    variation_id: i.variationId || null,
                    distribution_id: i.distributionId || null,
                    is_wholesale: !!i.isWholesale,
                    color_id: i.colorId || null,
                    quantity: i.quantity || 0,
                    cost_price: i.costPrice || 0,
                    notes: i.notes || null,
                }));
            });
        }

        if (purchase.expenseItems?.length) {
            purchase.expenseItems.forEach(e => {
                const eRef = doc(collection(db, 'expense_items'));
                batch.set(eRef, cleanFirestoreData({
                    purchase_id: purchaseId,
                    description: e.description || '',
                    value: e.value || 0,
                    notes: e.notes || null
                }));
            });
        }

        if (purchase.cheques?.length) {
            purchase.cheques.forEach(c => {
                const cRef = doc(collection(db, 'cheques'));
                batch.set(cRef, cleanFirestoreData({
                    purchase_id: purchaseId,
                    supplier_id: purchase.supplierId || null,
                    number: c.number || '',
                    amount: c.amount || 0,
                    due_date: c.dueDate || new Date().toISOString(),
                    is_paid: !!c.isPaid,
                    created_at: c.created_at || new Date().toISOString()
                }));
            });
        }

        if (purchase.isPaid && (purchase.accounted ?? true)) {
            const tRef = doc(collection(db, 'transactions'));
            batch.set(tRef, cleanFirestoreData({
                date: purchase.date || new Date().toISOString(), 
                type: 'expense_payment',
                amount: -(purchase.totalValue || 0), 
                description: `Pagamento Despesa ${purchase.purchaseNumber || ''}`,
                related_id: purchaseId,
                bank_account_id: sanitizeBankAccountId(purchase.bankAccountId) || null
            }));

            // Note: Balance sync is done via separate bankAccountService.syncBalance call because FieldValue.increment is needed
        }

        await batch.commit();

        if (purchase.isPaid && (purchase.accounted ?? true)) {
            const finalBankId = sanitizeBankAccountId(purchase.bankAccountId);
            if (finalBankId) {
                await bankAccountService.syncBalance(finalBankId, -purchase.totalValue);
            }
        }

        // --- Entrada de estoque (Síncrona por simplicidade, embora pudesse ser em lote) ---
        if (purchase.type === 'inventory' && purchase.items?.length) {
            for (const item of purchase.items) {
                if (item.isWholesale && item.distributionId) {
                    const wsQuery = query(collection(db, 'wholesale_stock_items'), 
                        where('distribution_id', '==', item.distributionId), 
                        where('color_id', '==', item.colorId || null));
                    const wsSnap = await getDocs(wsQuery);
                    
                    if (!wsSnap.empty) {
                        const wsDoc = wsSnap.docs[0];
                        await updateDoc(wsDoc.ref, {
                            boxes: increment(item.quantity),
                            cost_price_per_box: item.costPrice
                        });
                    } else {
                        const distDoc = await getDoc(doc(db, 'grid_distributions', item.distributionId));
                        const gridIdFromDist = distDoc.exists() ? distDoc.data().grid_id : null;

                        await addDoc(collection(db, 'wholesale_stock_items'), cleanFirestoreData({
                            product_id: item.productId,
                            color_id: item.colorId || null,
                            grid_id: gridIdFromDist,
                            distribution_id: item.distributionId, 
                            boxes: item.quantity,
                            cost_price_per_box: item.costPrice,
                            sale_price_per_box: item.costPrice * 2,
                        }));
                    }

                    // Preço unitário sync
                    const distSnap = await getDoc(doc(db, 'grid_distributions', item.distributionId));
                    if (distSnap.exists()) {
                        const gridDist = distSnap.data();
                        const pairsCount = Object.values(gridDist.quantities || {}).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
                        if (pairsCount > 0) {
                            const unitPrice = item.costPrice / pairsCount;
                            const varsQuery = query(collection(db, 'variations'), 
                                where('product_id', '==', item.productId), 
                                where('color_id', '==', item.colorId || null));
                            const varsSnap = await getDocs(varsQuery);
                            const syncBatch = writeBatch(db);
                            varsSnap.forEach(vDoc => syncBatch.update(vDoc.ref, { cost_price: unitPrice }));
                            await syncBatch.commit();
                        }
                    }
                } else if (item.variationId) {
                    await updateDoc(doc(db, 'variations', item.variationId), {
                        stock: increment(item.quantity),
                        cost_price: item.costPrice
                    });
                }
            }
        }

        return { ...purchase, id: purchaseId };
    },

    updatePurchase: async (purchase: Purchase): Promise<Purchase> => {
        await updateDoc(doc(db, 'purchases', purchase.id), cleanFirestoreData({
            purchase_number: purchase.purchaseNumber,
            type: purchase.type,
            is_wholesale: purchase.isWholesale,
            supplier_id: purchase.supplierId,
            date: purchase.date,
            due_date: purchase.dueDate || purchase.date,
            total_value: purchase.totalValue,
            amount_paid: purchase.amountPaid,
            is_paid: purchase.isPaid,
            notes: purchase.notes,
            category_id: purchase.categoryId || null
        }));

        if (purchase.type === 'general') {
            const expSnap = await getDocs(query(collection(db, 'expense_items'), where('purchase_id', '==', purchase.id)));
            const batch = writeBatch(db);
            expSnap.forEach(d => batch.delete(d.ref));
            
            if (purchase.expenseItems?.length) {
                purchase.expenseItems.forEach(e => {
                    const eRef = doc(collection(db, 'expense_items'));
                    batch.set(eRef, cleanFirestoreData({
                        purchase_id: purchase.id,
                        description: e.description || '',
                        value: e.value || 0,
                    }));
                });
            }
            await batch.commit();
        }

        return purchase;
    },

    deletePurchase: async (id: string): Promise<void> => {
        const pSnap = await getDoc(doc(db, 'purchases', id));
        const pData = pSnap.data();
        
        const batch = writeBatch(db);
        
        const expSnap = await getDocs(query(collection(db, 'expense_items'), where('purchase_id', '==', id)));
        expSnap.forEach(d => batch.delete(d.ref));

        const itemSnap = await getDocs(query(collection(db, 'purchase_items'), where('purchase_id', '==', id)));
        itemSnap.forEach(d => batch.delete(d.ref));

        const paySnap = await getDocs(query(collection(db, 'payment_records'), where('purchase_id', '==', id)));
        paySnap.forEach(d => batch.delete(d.ref));

        const transSnap = await getDocs(query(collection(db, 'transactions'), where('related_id', '==', id)));
        transSnap.forEach(d => batch.delete(d.ref));

        // Note: No native 'ILike' in Firestore, assuming search by number or ID is enough
        // If needed, we'd have to search and filter in memory or use a search index.
        
        batch.delete(doc(db, 'purchases', id));
        await batch.commit();
    },

    addPaymentToPurchase: async (purchaseId: string, amount: number, date: string, bankAccountId?: string): Promise<void> => {
        const pDoc = await getDoc(doc(db, 'purchases', purchaseId));
        if (!pDoc.exists()) throw new Error('Purchase not found');
        const purchase = pDoc.data();

        const accounted = purchase.accounted ?? true;
        const finalBankAccountId = sanitizeBankAccountId(bankAccountId) || purchase.bank_account_id;
        const newPaid = (purchase.amount_paid || 0) + amount;
        const isPaid = newPaid >= purchase.total_value;

        await updateDoc(doc(db, 'purchases', purchaseId), cleanFirestoreData({ amount_paid: newPaid, is_paid: isPaid }));

        await addDoc(collection(db, 'payment_records'), cleanFirestoreData({
            purchase_id: purchaseId,
            date,
            amount,
            note: 'Pagamento Parcial'
        }));

        if (accounted) {
            await addDoc(collection(db, 'transactions'), cleanFirestoreData({
                date,
                type: 'expense_payment',
                amount: -amount,
                description: `Pagamento Compra ${purchase.purchase_number}`,
                related_id: purchaseId,
                bank_account_id: sanitizeBankAccountId(finalBankAccountId) || null
            }));

            if (finalBankAccountId) {
                await bankAccountService.syncBalance(finalBankAccountId, -amount);
            }
        }
    },

    deletePaymentFromPurchase: async (purchaseId: string, paymentId: string): Promise<void> => {
        const paySnap = await getDoc(doc(db, 'payment_records', paymentId));
        if (!paySnap.exists()) throw new Error('Payment not found');
        const payment = paySnap.data();

        const pDoc = await getDoc(doc(db, 'purchases', purchaseId));
        if (!pDoc.exists()) throw new Error('Purchase not found');
        const purchase = pDoc.data();

        const newAmountPaid = (purchase.amount_paid || 0) - payment.amount;
        const isPaid = newAmountPaid >= purchase.total_value;

        await updateDoc(doc(db, 'purchases', purchaseId), { amount_paid: newAmountPaid, is_paid: isPaid });
        await deleteDoc(paySnap.ref);

        if (purchase.accounted ?? true) {
            const transQuery = query(collection(db, 'transactions'), 
                where('related_id', '==', purchaseId), 
                where('amount', '==', -payment.amount), 
                where('date', '==', payment.date));
            const transSnap = await getDocs(transQuery);
            const batch = writeBatch(db);
            transSnap.forEach(d => batch.delete(d.ref));
            await batch.commit();
            
            // Note: Should we sync balance back? Original code didn't explicitly call syncBalance in deletePaymentFromSale/Purchase, 
            // but for completeness we might want it. Keeping original logic for now.
        }
    },

    updatePaymentInPurchase: async (purchaseId: string, paymentId: string, newAmount: number, newDate: string, bankAccountId?: string): Promise<void> => {
        const paySnap = await getDoc(doc(db, 'payment_records', paymentId));
        if (!paySnap.exists()) throw new Error('Payment not found');
        const payment = paySnap.data();

        const pDoc = await getDoc(doc(db, 'purchases', purchaseId));
        if (!pDoc.exists()) throw new Error('Purchase not found');
        const purchase = pDoc.data();

        const accounted = purchase.accounted ?? true;
        const finalBankAccountId = sanitizeBankAccountId(bankAccountId) || purchase.bank_account_id;
        const diff = newAmount - payment.amount;
        const newAmountPaid = (purchase.amount_paid || 0) + diff;
        const isPaid = newAmountPaid >= purchase.total_value;

        await updateDoc(doc(db, 'purchases', purchaseId), cleanFirestoreData({ amount_paid: newAmountPaid, is_paid: isPaid }));
        await updateDoc(doc(db, 'payment_records', paymentId), cleanFirestoreData({ amount: newAmount, date: newDate }));

        if (accounted) {
            const transQuery = query(collection(db, 'transactions'), 
                where('related_id', '==', purchaseId), 
                where('amount', '==', -payment.amount), 
                where('date', '==', payment.date));
            const transSnap = await getDocs(transQuery);

            if (!transSnap.empty) {
                await updateDoc(transSnap.docs[0].ref, cleanFirestoreData({
                    amount: -newAmount,
                    date: newDate,
                    bank_account_id: sanitizeBankAccountId(finalBankAccountId) || null
                }));
            } else {
                await addDoc(collection(db, 'transactions'), cleanFirestoreData({
                    date: newDate,
                    type: 'expense_payment',
                    amount: -newAmount,
                    description: `Pagamento Compra ${purchase.purchase_number || 'Editada'}`,
                    related_id: purchaseId,
                    bank_account_id: sanitizeBankAccountId(finalBankAccountId) || null
                }));
            }
        }
    },
};
