// services/receiptService.ts
import { db } from './api';
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
            getDocs(query(collection(db, 'receipts'), orderBy('date', 'desc'))),
            getDocs(collection(db, 'receipt_items')),
            getDocs(collection(db, 'receipt_expense_items')),
            getDocs(collection(db, 'payment_records')),
        ]);

        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const expItems = expItemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const payments = paymentsSnap.docs.filter(d => d.data().receipt_id).map(d => ({ id: d.id, ...d.data() }));

        return receiptsSnap.docs.map(rDoc => buildReceipt(rDoc.data(), rDoc.id, items, expItems, payments));
    },

    createReceipt: async (receipt: Receipt): Promise<Receipt> => {
        const batch = writeBatch(db);
        const receiptRef = doc(collection(db, 'receipts'));
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
                const iRef = doc(collection(db, 'receipt_items'));
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
                const eRef = doc(collection(db, 'receipt_expense_items'));
                batch.set(eRef, cleanFirestoreData({
                    receipt_id: receiptId,
                    description: e.description || '',
                    value: e.value || 0,
                    notes: e.notes || null,
                }));
            });
        }

        if (receipt.isPaid && (receipt.accounted ?? true)) {
            const tRef = doc(collection(db, 'transactions'));
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
        await updateDoc(doc(db, 'receipts', receipt.id), cleanFirestoreData({
            receipt_number: receipt.receiptNumber,
            type: receipt.type,
            is_wholesale: receipt.isWholesale,
            customer_id: receipt.customerId,
            date: receipt.date,
            due_date: receipt.dueDate || receipt.date,
            total_value: receipt.totalValue,
            amount_paid: receipt.amountPaid,
            is_paid: receipt.isPaid,
            item_description: receipt.itemDescription,
            notes: receipt.notes,
            status: receipt.status || 'Pendente',
            accounted: receipt.accounted ?? true,
            bank_account_id: sanitizeBankAccountId(receipt.bankAccountId) || null,
        }));
        return receipt;
    },

    deleteReceipt: async (id: string): Promise<void> => {
        const receiptRef = doc(db, 'receipts', id);
        const receiptSnap = await getDoc(receiptRef);
        if (!receiptSnap.exists()) return;
        const receipt = receiptSnap.data();

        const batch = writeBatch(db);
        
        const itemsSnap = await getDocs(query(collection(db, 'receipt_items'), where('receipt_id', '==', id)));
        itemsSnap.forEach(d => batch.delete(d.ref));

        const expSnap = await getDocs(query(collection(db, 'receipt_expense_items'), where('receipt_id', '==', id)));
        expSnap.forEach(d => batch.delete(d.ref));

        const paySnap = await getDocs(query(collection(db, 'payment_records'), where('receipt_id', '==', id)));
        paySnap.forEach(d => batch.delete(d.ref));

        const transSnap = await getDocs(query(collection(db, 'transactions'), where('related_id', '==', id)));
        transSnap.forEach(d => batch.delete(d.ref));

        if (receipt.receipt_number) {
            // Firestore doesn't support ilike naturally, we rely on related_id mostly.
        }

        batch.delete(receiptRef);
        await batch.commit();
        
        // Reverse balance if was paid and accounted
        if (receipt.is_paid && (receipt.accounted ?? true) && receipt.bank_account_id) {
            await bankAccountService.syncBalance(receipt.bank_account_id, -receipt.total_value);
        }
    },

    addPaymentToReceipt: async (receiptId: string, amount: number, date: string, note?: string, bankAccountId?: string): Promise<void> => {
        const receiptRef = doc(db, 'receipts', receiptId);
        const receiptSnap = await getDoc(receiptRef);
        if (!receiptSnap.exists()) throw new Error('Receipt not found');
        const receipt = receiptSnap.data();

        const accounted = receipt.accounted ?? true;
        const finalBankAccountId = sanitizeBankAccountId(bankAccountId) || receipt.bank_account_id;

        const newPaid = (receipt.amount_paid || 0) + amount;
        const isPaid = newPaid >= receipt.total_value;

        const batch = writeBatch(db);
        batch.update(receiptRef, { amount_paid: newPaid, is_paid: isPaid });

        const payRef = doc(collection(db, 'payment_records'));
        batch.set(payRef, cleanFirestoreData({
            receipt_id: receiptId,
            date: date || new Date().toISOString(),
            amount: amount || 0,
            note: note || 'Recebimento Parcial'
        }));

        if (accounted) {
            const tRef = doc(collection(db, 'transactions'));
            batch.set(tRef, cleanFirestoreData({
                date: date || new Date().toISOString(),
                type: 'payment',
                amount: amount || 0,
                description: `Recebimento ${receipt.receipt_number || ''}`,
                related_id: receiptId,
                bank_account_id: sanitizeBankAccountId(finalBankAccountId) || null
            }));
        }

        await batch.commit();

        if (accounted && finalBankAccountId) {
            await bankAccountService.syncBalance(finalBankAccountId, amount);
        }
    },

    deletePaymentFromReceipt: async (receiptId: string, paymentId: string): Promise<void> => {
        const payRef = doc(db, 'payment_records', paymentId);
        const paySnap = await getDoc(payRef);
        if (!paySnap.exists()) return;
        const payment = paySnap.data() as any;

        const receiptRef = doc(db, 'receipts', receiptId);
        const receiptSnap = await getDoc(receiptRef);
        const receipt = receiptSnap.data() as any;

        const newPaid = (receipt.amount_paid || 0) - payment.amount;
        const isPaid = newPaid >= receipt.total_value;

        const batch = writeBatch(db);
        batch.update(receiptRef, { amount_paid: newPaid, is_paid: isPaid });
        batch.delete(payRef);

        if (receipt.accounted ?? true) {
            const transQuery = query(collection(db, 'transactions'), 
                where('related_id', '==', receiptId), 
                where('amount', '==', payment.amount), 
                where('date', '==', payment.date));
            const transSnap = await getDocs(transQuery);
            transSnap.forEach(d => batch.delete(d.ref));
        }

        await batch.commit();
        
        if ((receipt.accounted ?? true) && receipt.bank_account_id) {
            await bankAccountService.syncBalance(receipt.bank_account_id, -payment.amount);
        }
    },

    updatePaymentInReceipt: async (receiptId: string, paymentId: string, amount: number, date: string, bankAccountId?: string): Promise<void> => {
        const payRef = doc(db, 'payment_records', paymentId);
        const paySnap = await getDoc(payRef);
        const oldPayment = paySnap.data() as any;

        const receiptRef = doc(db, 'receipts', receiptId);
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
            const transQuery = query(collection(db, 'transactions'), 
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
                const tRef = doc(collection(db, 'transactions'));
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
