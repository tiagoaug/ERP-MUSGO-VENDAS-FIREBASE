// services/receiptService.ts
import { db, getScopedCollection, getScopedDoc } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, where, writeBatch, increment } from 'firebase/firestore';
import { Receipt, ReceiptItem, ExpenseItem, PaymentRecord } from '../types';
import { generateId, sanitizeBankAccountId, cleanFirestoreData } from '../lib/utils';
import { bankAccountService } from './bankAccountService';

const buildReceipt = (row: any, id: string, items: any[], expenseItems: any[], paymentHistory: any[]): Receipt => ({
    id: id,
    receiptNumber: row.receipt_number,
    type: row.type,
    isWholesale: row.is_wholesale,
    customerId: row.customer_id,
    date: row.date,
    dueDate: row.due_date,
    totalValue: row.total_value,
    amountPaid: row.amount_paid,
    isPaid: row.is_paid,
    itemDescription: row.item_description,
    notes: row.notes,
    status: row.status || 'Pendente',
    accounted: row.accounted ?? true,
    bankAccountId: row.bank_account_id,
    items: items.filter(i => i.receipt_id === id).map(i => ({
        productId: i.product_id,
        variationId: i.variation_id,
        distributionId: i.distribution_id,
        isWholesale: i.is_wholesale,
        colorId: i.color_id,
        quantity: i.quantity,
        costPrice: i.cost_price,
        notes: i.notes,
    } as ReceiptItem)),
    expenseItems: expenseItems.filter(e => e.receipt_id === id).map(e => ({
        id: e.id, description: e.description, value: e.value, notes: e.notes,
    } as ExpenseItem)),
    paymentHistory: paymentHistory.filter(p => p.receipt_id === id).map(p => ({
        id: p.id, date: p.date, amount: p.amount, note: p.note,
    } as PaymentRecord)),
});

export const receiptService = {
    getReceipts: async (): Promise<Receipt[]> => {
        const [receiptsSnap, itemsSnap, expItemsSnap, paymentsSnap] = await Promise.all([
            getDocs(query(getScopedCollection('receipts'), orderBy('date', 'desc'))),
            getDocs(getScopedCollection('receipt_items')),
            getDocs(getScopedCollection('receipt_expense_items')),
            getDocs(getScopedCollection('payment_records')),
        ]);

        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const expItems = expItemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const payments = paymentsSnap.docs.filter(d => d.data().receipt_id).map(d => ({ id: d.id, ...d.data() }));

        return receiptsSnap.docs.map(rDoc => buildReceipt(rDoc.data(), rDoc.id, items, expItems, payments));
    },

    createReceipt: async (receipt: Receipt): Promise<Receipt> => {
        const batch = writeBatch(db);
        const receiptRef = doc(getScopedCollection('receipts'));
        const receiptId = receiptRef.id;

        batch.set(receiptRef, cleanFirestoreData({
            receipt_number: receipt.receiptNumber || '',
            type: receipt.type || 'general',
            is_wholesale: !!receipt.isWholesale,
            customer_id: receipt.customerId || null,
            date: receipt.date || new Date().toISOString(),
            due_date: receipt.dueDate || receipt.date || new Date().toISOString(),
            total_value: receipt.totalValue || 0,
            amount_paid: receipt.isPaid ? (receipt.totalValue || 0) : 0,
            is_paid: !!receipt.isPaid,
            item_description: receipt.itemDescription || null,
            notes: receipt.notes || null,
            status: receipt.status || 'Pendente',
            accounted: receipt.accounted ?? true,
            bank_account_id: sanitizeBankAccountId(receipt.bankAccountId) || null,
        }));

        if (receipt.items?.length) {
            receipt.items.forEach(i => {
                const iRef = doc(getScopedCollection('receipt_items'));
                batch.set(iRef, cleanFirestoreData({
                    receipt_id: receiptId,
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

        if (receipt.expenseItems?.length) {
            receipt.expenseItems.forEach(e => {
                const eRef = doc(getScopedCollection('receipt_expense_items'));
                batch.set(eRef, cleanFirestoreData({
                    receipt_id: receiptId,
                    description: e.description || '',
                    value: e.value || 0,
                    notes: e.notes || null,
                }));
            });
        }

        if (receipt.isPaid && (receipt.accounted ?? true)) {
            const tRef = doc(getScopedCollection('transactions'));
            batch.set(tRef, cleanFirestoreData({
                date: receipt.date || new Date().toISOString(),
                type: 'payment',
                amount: receipt.totalValue || 0,
                description: `Recebimento ${receipt.receiptNumber || ''}`,
                related_id: receiptId,
                bank_account_id: sanitizeBankAccountId(receipt.bankAccountId) || null
            }));
        }

        await batch.commit();

        if (receipt.isPaid && (receipt.accounted ?? true) && receipt.bankAccountId) {
            await bankAccountService.syncBalance(receipt.bankAccountId, receipt.totalValue);
        }

        return { ...receipt, id: receiptId };
    },

    updateReceipt: async (receipt: Receipt): Promise<Receipt> => {
        const batch = writeBatch(db);
        const receiptRef = getScopedDoc('receipts', receipt.id);
        
        batch.update(receiptRef, cleanFirestoreData({
            receipt_number: receipt.receiptNumber || '',
            type: receipt.type || 'general',
            is_wholesale: !!receipt.isWholesale,
            customer_id: receipt.customerId || null,
            date: receipt.date || new Date().toISOString(),
            due_date: receipt.dueDate || receipt.date || new Date().toISOString(),
            total_value: receipt.totalValue || 0,
            amount_paid: receipt.amountPaid || 0,
            is_paid: !!receipt.isPaid,
            item_description: receipt.itemDescription || null,
            notes: receipt.notes || null,
            status: receipt.status || 'Pendente',
            accounted: receipt.accounted ?? true,
            bank_account_id: sanitizeBankAccountId(receipt.bankAccountId) || null,
        }));

        await batch.commit();
        return receipt;
    },

    deleteReceipt: async (id: string): Promise<void> => {
        const receiptRef = getScopedDoc('receipts', id);
        const receiptSnap = await getDoc(receiptRef);
        if (!receiptSnap.exists()) return;
        const receipt = receiptSnap.data();

        const batch = writeBatch(db);
        
        const itemsSnap = await getDocs(query(getScopedCollection('receipt_items'), where('receipt_id', '==', id)));
        itemsSnap.forEach(d => batch.delete(d.ref));

        const expSnap = await getDocs(query(getScopedCollection('receipt_expense_items'), where('receipt_id', '==', id)));
        expSnap.forEach(d => batch.delete(d.ref));

        const paySnap = await getDocs(query(getScopedCollection('payment_records'), where('receipt_id', '==', id)));
        paySnap.forEach(d => batch.delete(d.ref));

        const transSnap = await getDocs(query(getScopedCollection('transactions'), where('related_id', '==', id)));
        transSnap.forEach(d => batch.delete(d.ref));

        batch.delete(receiptRef);
        await batch.commit();
        
        if (receipt.is_paid && (receipt.accounted ?? true) && receipt.bank_account_id) {
            await bankAccountService.syncBalance(receipt.bank_account_id, -receipt.total_value);
        }
    },

    addPayment: async (receiptId: string, amount: number, date: string, note: string, bankAccountId?: string): Promise<void> => {
        const batch = writeBatch(db);
        const payRef = doc(getScopedCollection('payment_records'));
        const receiptRef = getScopedDoc('receipts', receiptId);
        const receiptSnap = await getDoc(receiptRef);
        if (!receiptSnap.exists()) throw new Error('Receipt not found');
        const receipt = receiptSnap.data();

        const accounted = receipt.accounted ?? true;
        const finalBankAccountId = sanitizeBankAccountId(bankAccountId) || receipt.bank_account_id;

        batch.update(receiptRef, { 
            amount_paid: increment(amount),
            is_paid: (receipt.amount_paid + amount) >= receipt.total_value 
        });

        batch.set(payRef, cleanFirestoreData({
            receipt_id: receiptId,
            date: date || new Date().toISOString(),
            amount: amount || 0,
            note: note || 'Recebimento Parcial'
        }));

        if (accounted) {
            const tRef = doc(getScopedCollection('transactions'));
            batch.set(tRef, cleanFirestoreData({
                date: date || new Date().toISOString(),
                type: 'payment',
                amount: amount || 0,
                description: `Recebimento ${receipt.receipt_number || ''}`,
                related_id: receiptId,
                bank_account_id: finalBankAccountId || null
            }));
        }

        await batch.commit();

        if (accounted && finalBankAccountId) {
            await bankAccountService.syncBalance(finalBankAccountId, amount);
        }
    },

    removePayment: async (paymentId: string, amount: number, receiptId: string, bankAccountId?: string): Promise<void> => {
        const batch = writeBatch(db);
        batch.delete(getScopedDoc('payment_records', paymentId));

        const receiptRef = getScopedDoc('receipts', receiptId);
        const receiptSnap = await getDoc(receiptRef);
        const receipt = receiptSnap.data() as any;

        batch.update(receiptRef, { 
            amount_paid: increment(-amount),
            is_paid: false
        });

        if (receipt.accounted ?? true) {
            const transQuery = query(getScopedCollection('transactions'), 
                where('related_id', '==', receiptId),
                where('type', '==', 'payment'),
                where('amount', '==', amount)
            );
            const transSnap = await getDocs(transQuery);
            transSnap.forEach(d => batch.delete(d.ref));
        }

        await batch.commit();

        if ((receipt.accounted ?? true) && (sanitizeBankAccountId(bankAccountId) || receipt.bank_account_id)) {
            await bankAccountService.syncBalance(sanitizeBankAccountId(bankAccountId) || receipt.bank_account_id, -amount);
        }
    },

    updatePaymentInReceipt: async (receiptId: string, paymentId: string, amount: number, date: string, bankAccountId?: string): Promise<void> => {
        const payRef = getScopedDoc('payment_records', paymentId);
        const paySnap = await getDoc(payRef);
        const oldPayment = paySnap.data() as any;

        const receiptRef = getScopedDoc('receipts', receiptId);
        const receiptSnap = await getDoc(receiptRef);
        const receipt = receiptSnap.data() as any;

        const accounted = receipt.accounted ?? true;
        const finalBankAccountId = sanitizeBankAccountId(bankAccountId) || receipt.bank_account_id;

        const diff = amount - oldPayment.amount;
        const newPaid = (receipt.amount_paid || 0) + diff;

        const batch = writeBatch(db);
        batch.update(receiptRef, cleanFirestoreData({ amount_paid: newPaid, is_paid: newPaid >= receipt.total_value }));
        batch.update(payRef, cleanFirestoreData({ amount, date }));

        if (accounted) {
            const transQuery = query(getScopedCollection('transactions'), 
                where('related_id', '==', receiptId), 
                where('amount', '==', oldPayment.amount), 
                where('date', '==', oldPayment.date));
            const transSnap = await getDocs(transQuery);

            if (!transSnap.empty) {
                batch.update(transSnap.docs[0].ref, cleanFirestoreData({
                    amount,
                    date,
                    bank_account_id: sanitizeBankAccountId(finalBankAccountId) || null
                }));
            } else {
                const tRef = doc(getScopedCollection('transactions'));
                batch.set(tRef, cleanFirestoreData({
                    date: date || new Date().toISOString(),
                    type: 'payment',
                    amount: amount || 0,
                    description: `Recebimento ${receipt.receipt_number || 'Editado'}`,
                    related_id: receiptId,
                    bank_account_id: sanitizeBankAccountId(finalBankAccountId) || null
                }));
            }
        }

        await batch.commit();

        if (accounted && finalBankAccountId) {
            await bankAccountService.syncBalance(finalBankAccountId, diff);
        }
    },
};
