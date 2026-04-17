// services/saleService.ts
import { db, getScopedCollection, getScopedDoc } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, where, writeBatch, increment } from 'firebase/firestore';
import { Sale, SaleItem, PaymentRecord } from '../types';
import { generateId, sanitizeBankAccountId, cleanFirestoreData } from '../lib/utils';
import { bankAccountService } from './bankAccountService';

const buildSale = (row: any, id: string, items: any[], paymentHistory: any[]): Sale => ({
    id: id,
    saleNumber: row.sale_number,
    date: row.date,
    dueDate: row.due_date,
    customerId: row.customer_id,
    totalValue: row.total_value,
    amountPaid: row.amount_paid,
    isPaid: row.is_paid,
    paymentType: row.payment_type,
    status: row.status,
    discount: row.discount,
    deliveryMethod: row.delivery_method,
    deliveryAddress: row.delivery_address,
    comments: row.comments,
    privateNotes: row.private_notes,
    requiresApproval: row.requires_approval,
    bankAccountId: row.bank_account_id,
    releaseHistory: [],
    items: items.filter(i => i.sale_id === id).map(i => ({
        productId: i.product_id,
        variationId: i.variation_id,
        distributionId: i.distribution_id,
        isWholesale: i.is_wholesale,
        colorId: i.color_id,
        quantity: i.quantity,
        priceAtSale: i.price_at_sale,
    } as SaleItem)),
    paymentHistory: paymentHistory.filter(p => p.sale_id === id).map(p => ({
        id: p.id,
        date: p.date,
        amount: p.amount,
        note: p.note,
    } as PaymentRecord)),
});

export const saleService = {
    getSales: async (): Promise<Sale[]> => {
        const [salesSnap, itemsSnap, paymentsSnap] = await Promise.all([
            getDocs(query(getScopedCollection('sales'), orderBy('date', 'desc'))),
            getDocs(getScopedCollection('sale_items')),
            getDocs(getScopedCollection('payment_records')),
        ]);

        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const payments = paymentsSnap.docs.filter(d => d.data().sale_id).map(d => ({ id: d.id, ...d.data() }));

        return salesSnap.docs.map(sDoc => buildSale(sDoc.data(), sDoc.id, items, payments));
    },

    createSale: async (sale: Sale): Promise<Sale> => {
        const batch = writeBatch(db);
        const saleRef = doc(getScopedCollection('sales'));
        const saleId = saleRef.id;
        
        let finalAmountPaid = sale.amountPaid || 0;
        let finalIsPaid = sale.isPaid;
        const paymentRecordsToAdd: any[] = [];

        // 1. Lógica de uso de saldo (Haver)
        if (sale.usedBalance && sale.usedBalance > 0) {
            const customerRef = getScopedDoc('customers', sale.customerId);
            batch.update(customerRef, { balance: increment(-sale.usedBalance) });

            finalAmountPaid += sale.usedBalance;
            finalIsPaid = finalAmountPaid >= sale.totalValue;
            
            paymentRecordsToAdd.push({
                sale_id: saleId,
                date: sale.date,
                amount: sale.usedBalance,
                note: 'Uso de Saldo (Haver)'
            });
        }

        // 2. Insere a venda
        batch.set(saleRef, cleanFirestoreData({
            sale_number: sale.saleNumber || '',
            date: sale.date || new Date().toISOString(),
            due_date: sale.dueDate || sale.date || new Date().toISOString(),
            customer_id: sale.customerId || null,
            total_value: sale.totalValue || 0,
            amount_paid: finalAmountPaid || 0,
            is_paid: !!finalIsPaid,
            payment_type: sale.paymentType || 'cash',
            status: sale.status || 'Pendente',
            discount: sale.discount || 0,
            delivery_method: sale.deliveryMethod || null,
            delivery_address: sale.deliveryAddress || null,
            comments: sale.comments || null,
            private_notes: sale.privateNotes || null,
            requires_approval: !!sale.requiresApproval,
            bank_account_id: sanitizeBankAccountId(sale.bankAccountId) || null,
        }));

        // 3. Insere os itens
        if (sale.items?.length) {
            sale.items.forEach(item => {
                const iRef = doc(getScopedCollection('sale_items'));
                batch.set(iRef, cleanFirestoreData({
                    sale_id: saleId,
                    product_id: item.productId || null,
                    variation_id: item.variationId || null,
                    distribution_id: item.distributionId || null,
                    is_wholesale: !!item.isWholesale,
                    color_id: item.colorId || null,
                    quantity: item.quantity || 0,
                    price_at_sale: item.priceAtSale || 0,
                }));
            });
        }

        // 4. Insere histórico de pagamento
        if (sale.paymentHistory?.length) {
            sale.paymentHistory.forEach(p => paymentRecordsToAdd.push({
                sale_id: saleId,
                date: p.date,
                amount: p.amount,
                note: p.note
            }));
        }

        paymentRecordsToAdd.forEach(pr => {
            const prRef = doc(getScopedCollection('payment_records'));
            batch.set(prRef, cleanFirestoreData(pr));
        });

        // 5. Registra transação financeira e ajuste de troco/haver
        const realMoneyPaid = (sale.amountPaid || 0);
        const needed = sale.totalValue - (sale.usedBalance || 0);
        
        if (realMoneyPaid > needed) {
            const excess = realMoneyPaid - needed;
            const customerRef = getScopedDoc('customers', sale.customerId);
            batch.update(customerRef, { balance: increment(excess) });
        }

        if (sale.status !== 'Aguardando Aprovação' && sale.status !== 'Aguardando Estoque' && realMoneyPaid > 0) {
            const tRef = doc(getScopedCollection('transactions'));
            batch.set(tRef, cleanFirestoreData({
                date: sale.date || new Date().toISOString(), 
                type: 'payment',
                amount: realMoneyPaid || 0, 
                description: `Venda ${sale.saleNumber || ''}`,
                related_id: saleId,
                bank_account_id: sanitizeBankAccountId(sale.bankAccountId) || null
            }));
        }

        // 6. Baixa o estoque
        if (sale.status !== 'Aguardando Estoque' && sale.status !== 'Aguardando Aprovação' && sale.status !== 'Cancelada') {
            for (const item of sale.items) {
                if (item.isWholesale && item.distributionId) {
                    const wsQuery = query(getScopedCollection('wholesale_stock_items'), 
                        where('distribution_id', '==', item.distributionId), 
                        where('color_id', '==', item.colorId || ''));
                    const wsSnap = await getDocs(wsQuery);
                    if (!wsSnap.empty) {
                        await updateDoc(wsSnap.docs[0].ref, { boxes: increment(-item.quantity) });
                    }
                } else if (item.variationId) {
                    await updateDoc(getScopedDoc('variations', item.variationId), { stock: increment(-item.quantity) });
                }
            }
        }

        await batch.commit();

        // Stock and Balance Sync (Non-batched parts)
        if (sale.status !== 'Aguardando Aprovação' && sale.status !== 'Aguardando Estoque' && realMoneyPaid > 0) {
            if (sale.bankAccountId) {
                await bankAccountService.syncBalance(sale.bankAccountId, realMoneyPaid);
            }
        }

        return { ...sale, id: saleId } as Sale;
    },

    updateSale: async (sale: Sale): Promise<Sale> => {
        const batch = writeBatch(db);
        const saleRef = getScopedDoc('sales', sale.id);
        
        const oldSaleSnap = await getDoc(saleRef);
        const oldRow = oldSaleSnap.data() as any;

        const consumesStock = (status: string) => !['Cancelada', 'Aguardando Estoque', 'Aguardando Aprovação'].includes(status);
        const wasConsumed = consumesStock(oldRow.status);
        const isConsumed = consumesStock(sale.status);

        const oldItemsSnap = await getDocs(query(getScopedCollection('sale_items'), where('sale_id', '==', sale.id)));
        const oldItems = oldItemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Restore Stock
        if (wasConsumed && oldItems.length) {
            for (const item of oldItems as any[]) {
                if (item.is_wholesale && item.distribution_id) {
                    const wsQuery = query(getScopedCollection('wholesale_stock_items'), 
                        where('distribution_id', '==', item.distribution_id), 
                        where('color_id', '==', item.color_id || ''));
                    const wsSnap = await getDocs(wsQuery);
                    if (!wsSnap.empty) await updateDoc(wsSnap.docs[0].ref, { boxes: increment(item.quantity) });
                } else if (item.variation_id) {
                    await updateDoc(getScopedDoc('variations', item.variation_id), { stock: increment(item.quantity) });
                }
            }
        }

        // Apply new stock depletion
        if (isConsumed && sale.items?.length) {
            for (const item of sale.items) {
                if (item.isWholesale && item.distributionId) {
                    const wsQuery = query(getScopedCollection('wholesale_stock_items'), 
                        where('distribution_id', '==', item.distributionId), 
                        where('color_id', '==', item.colorId || ''));
                    const wsSnap = await getDocs(wsQuery);
                    if (!wsSnap.empty) await updateDoc(wsSnap.docs[0].ref, { boxes: increment(-item.quantity) });
                } else if (item.variationId) {
                    await updateDoc(getScopedDoc('variations', item.variationId), { stock: increment(-item.quantity) });
                }
            }
        }

        // Update Sale
        batch.update(saleRef, cleanFirestoreData({
            sale_number: sale.saleNumber || '',
            date: sale.date || new Date().toISOString(),
            due_date: sale.dueDate || sale.date || new Date().toISOString(),
            customer_id: sale.customerId || null,
            total_value: sale.totalValue || 0,
            amount_paid: sale.amountPaid || 0,
            is_paid: !!sale.isPaid,
            payment_type: sale.paymentType || 'cash',
            status: sale.status || 'Pendente',
            discount: sale.discount || 0,
            delivery_method: sale.deliveryMethod || null,
            delivery_address: sale.deliveryAddress || null,
            comments: sale.comments || null,
            private_notes: sale.privateNotes || null,
            requires_approval: !!sale.requiresApproval,
            bank_account_id: sanitizeBankAccountId(sale.bankAccountId) || null,
        }));

        // Delete and Re-insert items
        oldItemsSnap.forEach(d => batch.delete(d.ref));
        if (sale.items?.length) {
            sale.items.forEach(i => {
                const iRef = doc(getScopedCollection('sale_items'));
                batch.set(iRef, cleanFirestoreData({
                    sale_id: sale.id,
                    product_id: i.productId || null,
                    variation_id: i.variationId || null,
                    distribution_id: i.distributionId || null,
                    is_wholesale: !!i.isWholesale,
                    color_id: i.colorId || null,
                    quantity: i.quantity || 0,
                    price_at_sale: i.priceAtSale || 0,
                }));
            });
        }

        // Delete and Re-insert payments
        const oldPaymentsSnap = await getDocs(query(getScopedCollection('payment_records'), where('sale_id', '==', sale.id)));
        oldPaymentsSnap.forEach(d => batch.delete(d.ref));
        if (sale.paymentHistory?.length) {
            sale.paymentHistory.forEach(p => {
                const pRef = doc(getScopedCollection('payment_records'));
                batch.set(pRef, cleanFirestoreData({
                    sale_id: sale.id,
                    date: p.date,
                    amount: p.amount,
                    note: p.note
                }));
            });
        }

        await batch.commit();
        return sale;
    },

    deleteSale: async (id: string): Promise<void> => {
        const batch = writeBatch(db);
        const saleRef = getScopedDoc('sales', id);
        const saleDoc = await getDoc(saleRef);
        if (!saleDoc.exists()) throw new Error('Sale not found');
        const sale = saleDoc.data();

        const itemsSnap = await getDocs(query(getScopedCollection('sale_items'), where('sale_id', '==', id)));
        const statusQueBaixaEstoque = ['Pendente', 'Em produção', 'Entregue', 'A caminho', 'Pronto para retirada', 'Coletado'];
        const wasConsumed = statusQueBaixaEstoque.includes(sale.status);

        if (wasConsumed) {
            for (const itemDoc of itemsSnap.docs) {
                const item = itemDoc.data();
                if (item.is_wholesale && item.distribution_id) {
                    const wsQuery = query(getScopedCollection('wholesale_stock_items'), 
                        where('distribution_id', '==', item.distribution_id), 
                        where('color_id', '==', item.color_id || ''));
                    const wsSnap = await getDocs(wsQuery);
                    if (!wsSnap.empty) await updateDoc(wsSnap.docs[0].ref, { boxes: increment(item.quantity) });
                } else if (item.variation_id) {
                    await updateDoc(getScopedDoc('variations', item.variation_id), { stock: increment(item.quantity) });
                }
            }
        }

        itemsSnap.forEach(d => batch.delete(d.ref));
        
        const paySnap = await getDocs(query(getScopedCollection('payment_records'), where('sale_id', '==', id)));
        paySnap.forEach(d => batch.delete(d.ref));

        const transSnap = await getDocs(query(getScopedCollection('transactions'), where('related_id', '==', id)));
        transSnap.forEach(d => batch.delete(d.ref));

        batch.delete(saleRef);
        await batch.commit();
    },

    addPaymentToSale: async (saleId: string, amount: number, date: string, bankAccountId?: string): Promise<void> => {
        const saleRef = getScopedDoc('sales', saleId);
        const saleSnap = await getDoc(saleRef);
        if (!saleSnap.exists()) throw new Error('Sale not found');
        const sale = saleSnap.data();

        const accounted = true;
        const finalBankAccountId = sanitizeBankAccountId(bankAccountId) || sale.bank_account_id;

        const remaining = sale.total_value - (sale.amount_paid || 0);
        let amountToApply = amount;
        let excess = 0;

        if (amount > remaining) {
            amountToApply = remaining;
            excess = amount - remaining;
        }

        const newAmountPaid = (sale.amount_paid || 0) + amountToApply;
        const isPaid = newAmountPaid >= sale.total_value;

        const batch = writeBatch(db);
        batch.update(saleRef, { amount_paid: newAmountPaid, is_paid: isPaid });

        const payRef = doc(getScopedCollection('payment_records'));
        batch.set(payRef, cleanFirestoreData({
            sale_id: saleId,
            date,
            amount: amountToApply,
            note: excess > 0 ? `Recebimento (Excesso de R$ ${excess} p/ Haver)` : 'Recebimento'
        }));

        if (accounted) {
            const tRef = doc(getScopedCollection('transactions'));
            batch.set(tRef, cleanFirestoreData({
                date,
                type: 'payment',
                amount: amount,
                description: `Recebimento Venda ${sale.sale_number}`,
                related_id: saleId,
                bank_account_id: sanitizeBankAccountId(finalBankAccountId) || null
            }));
        }

        if (excess > 0) {
            const customerRef = getScopedDoc('customers', sale.customer_id);
            batch.update(customerRef, { balance: increment(excess) });
        }

        await batch.commit();

        if (accounted && finalBankAccountId) {
            await bankAccountService.syncBalance(finalBankAccountId, amount);
        }
    },

    deletePaymentFromSale: async (saleId: string, paymentId: string): Promise<void> => {
        const paySnap = await getDoc(getScopedDoc('payment_records', paymentId));
        if (!paySnap.exists()) throw new Error('Payment not found');
        const payment = paySnap.data() as any;

        const saleRef = getScopedDoc('sales', saleId);
        const saleSnap = await getDoc(saleRef);
        const sale = saleSnap.data() as any;

        const newAmountPaid = (sale.amount_paid || 0) - payment.amount;
        const isPaid = newAmountPaid >= sale.total_value;

        const batch = writeBatch(db);
        batch.update(saleRef, { amount_paid: newAmountPaid, is_paid: isPaid });
        batch.delete(paySnap.ref);

        const transQuery = query(getScopedCollection('transactions'), 
            where('related_id', '==', saleId), 
            where('amount', '==', payment.amount), 
            where('date', '==', payment.date));
        const transSnap = await getDocs(transQuery);
        transSnap.forEach(d => batch.delete(d.ref));

        await batch.commit();
        
        if (sale.bank_account_id) {
            await bankAccountService.syncBalance(sale.bank_account_id, -payment.amount);
        }
    },

    updatePaymentInSale: async (saleId: string, paymentId: string, newAmount: number, newDate: string, bankAccountId?: string): Promise<void> => {
        const paySnap = await getDoc(getScopedDoc('payment_records', paymentId));
        const payment = paySnap.data() as any;

        const saleRef = getScopedDoc('sales', saleId);
        const saleSnap = await getDoc(saleRef);
        const sale = saleSnap.data() as any;

        const finalBankAccountId = sanitizeBankAccountId(bankAccountId) || sale.bank_account_id;
        const diff = newAmount - payment.amount;
        const newAmountPaid = (sale.amount_paid || 0) + diff;
        const isPaid = newAmountPaid >= sale.total_value;

        const batch = writeBatch(db);
        batch.update(saleRef, { amount_paid: newAmountPaid, is_paid: isPaid });
        batch.update(paySnap.ref, { amount: newAmount, date: newDate });

        const transQuery = query(getScopedCollection('transactions'), 
            where('related_id', '==', saleId), 
            where('amount', '==', payment.amount), 
            where('date', '==', payment.date));
        const transSnap = await getDocs(transQuery);

        if (!transSnap.empty) {
            batch.update(transSnap.docs[0].ref, {
                amount: newAmount,
                date: newDate,
                bank_account_id: sanitizeBankAccountId(finalBankAccountId) || null
            });
        } else {
            const tRef = doc(getScopedCollection('transactions'));
            batch.set(tRef, cleanFirestoreData({
                date: newDate,
                type: 'payment',
                amount: newAmount,
                description: `Recebimento Venda ${sale.sale_number || 'Editada'}`,
                related_id: saleId,
                bank_account_id: sanitizeBankAccountId(finalBankAccountId) || null
            }));
        }

        await batch.commit();
        
        if (finalBankAccountId) {
            await bankAccountService.syncBalance(finalBankAccountId, diff);
        }
    },

    estorno: async (saleId: string, itemIds?: string[], partialQuantities?: Record<string, number>): Promise<void> => {
        console.log(`Estorno solicitado para venda ${saleId}`);
    }
};
