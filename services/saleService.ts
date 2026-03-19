// services/saleService.ts
import { db } from './api';
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
            getDocs(query(collection(db, 'sales'), orderBy('date', 'desc'))),
            getDocs(collection(db, 'sale_items')),
            getDocs(collection(db, 'payment_records')),
        ]);

        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const payments = paymentsSnap.docs.filter(d => d.data().sale_id).map(d => ({ id: d.id, ...d.data() }));

        return salesSnap.docs.map(sDoc => buildSale(sDoc.data(), sDoc.id, items, payments));
    },

    createSale: async (sale: Omit<Sale, 'id'>, usedBalance: number = 0): Promise<Sale> => {
        const batch = writeBatch(db);
        const saleRef = doc(collection(db, 'sales'));
        const saleId = saleRef.id;
        
        let finalAmountPaid = sale.amountPaid || 0;
        let finalIsPaid = sale.isPaid;
        const paymentRecordsToAdd: any[] = [];

        // 1. Lógica de uso de saldo (Haver)
        if (usedBalance > 0) {
            const customerRef = doc(db, 'customers', sale.customerId);
            batch.update(customerRef, { balance: increment(-usedBalance) });

            finalAmountPaid += usedBalance;
            finalIsPaid = finalAmountPaid >= sale.totalValue;
            
            paymentRecordsToAdd.push({
                sale_id: saleId,
                date: sale.date,
                amount: usedBalance,
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
            sale.items.forEach(i => {
                const iRef = doc(collection(db, 'sale_items'));
                batch.set(iRef, cleanFirestoreData({
                    sale_id: saleId,
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
            const prRef = doc(collection(db, 'payment_records'));
            batch.set(prRef, cleanFirestoreData(pr));
        });

        // 5. Registra transação financeira e ajuste de troco/haver
        const realMoneyPaid = (sale.amountPaid || 0);
        const needed = sale.totalValue - (usedBalance || 0);
        
        if (realMoneyPaid > needed) {
            const excess = realMoneyPaid - needed;
            const customerRef = doc(db, 'customers', sale.customerId);
            batch.update(customerRef, { balance: increment(excess) });
        }

        if (sale.status !== 'Aguardando Aprovação' && sale.status !== 'Aguardando Estoque' && realMoneyPaid > 0) {
            const tRef = doc(collection(db, 'transactions'));
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
                    const wsQuery = query(collection(db, 'wholesale_stock_items'), 
                        where('distribution_id', '==', item.distributionId), 
                        where('color_id', '==', item.colorId || ''));
                    // Batches don't support queries, we'd need IDs. 
                    // To stay within batch, we might need a separate step or fetch IDs first. 
                    // Given the constraint, we'll do stock updates outside batch for now or pre-fetch.
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

        if (sale.status !== 'Aguardando Estoque' && sale.status !== 'Aguardando Aprovação' && sale.status !== 'Cancelada') {
            for (const item of sale.items) {
                if (item.isWholesale && item.distributionId) {
                    const wsQuery = query(collection(db, 'wholesale_stock_items'), 
                        where('distribution_id', '==', item.distributionId), 
                        where('color_id', '==', item.colorId || ''));
                    const wsSnap = await getDocs(wsQuery);
                    if (!wsSnap.empty) {
                        await updateDoc(wsSnap.docs[0].ref, { boxes: increment(-item.quantity) });
                    }
                } else if (item.variationId) {
                    await updateDoc(doc(db, 'variations', item.variationId), { stock: increment(-item.quantity) });
                }
            }
        }

        return { ...sale, id: saleId } as Sale;
    },

    updateSale: async (updatedSale: Sale): Promise<Sale> => {
        const batch = writeBatch(db);
        const saleRef = doc(db, 'sales', updatedSale.id);
        
        // Fetch old sale to restore stock
        const oldSaleSnap = await getDoc(saleRef);
        const oldRow = oldSaleSnap.data() as any;

        const consumesStock = (status: string) => !['Cancelada', 'Aguardando Estoque', 'Aguardando Aprovação'].includes(status);
        const wasConsumed = consumesStock(oldRow.status);
        const isConsumed = consumesStock(updatedSale.status);

        const oldItemsSnap = await getDocs(query(collection(db, 'sale_items'), where('sale_id', '==', updatedSale.id)));
        const oldItems = oldItemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Restore Stock
        if (wasConsumed && oldItems.length) {
            for (const item of oldItems as any[]) {
                if (item.is_wholesale && item.distribution_id) {
                    const wsQuery = query(collection(db, 'wholesale_stock_items'), 
                        where('distribution_id', '==', item.distribution_id), 
                        where('color_id', '==', item.color_id || ''));
                    const wsSnap = await getDocs(wsQuery);
                    if (!wsSnap.empty) await updateDoc(wsSnap.docs[0].ref, { boxes: increment(item.quantity) });
                } else if (item.variation_id) {
                    await updateDoc(doc(db, 'variations', item.variation_id), { stock: increment(item.quantity) });
                }
            }
        }

        // Apply new stock depletion
        if (isConsumed && updatedSale.items?.length) {
            for (const item of updatedSale.items) {
                if (item.isWholesale && item.distributionId) {
                    const wsQuery = query(collection(db, 'wholesale_stock_items'), 
                        where('distribution_id', '==', item.distributionId), 
                        where('color_id', '==', item.colorId || ''));
                    const wsSnap = await getDocs(wsQuery);
                    if (!wsSnap.empty) await updateDoc(wsSnap.docs[0].ref, { boxes: increment(-item.quantity) });
                } else if (item.variationId) {
                    await updateDoc(doc(db, 'variations', item.variationId), { stock: increment(-item.quantity) });
                }
            }
        }

        // Update Sale
        batch.update(saleRef, cleanFirestoreData({
            sale_number: updatedSale.saleNumber || '',
            date: updatedSale.date || new Date().toISOString(),
            due_date: updatedSale.dueDate || updatedSale.date || new Date().toISOString(),
            customer_id: updatedSale.customerId || null,
            total_value: updatedSale.totalValue || 0,
            amount_paid: updatedSale.amountPaid || 0,
            is_paid: !!updatedSale.isPaid,
            payment_type: updatedSale.paymentType || 'cash',
            status: updatedSale.status || 'Pendente',
            discount: updatedSale.discount || 0,
            delivery_method: updatedSale.deliveryMethod || null,
            delivery_address: updatedSale.deliveryAddress || null,
            comments: updatedSale.comments || null,
            private_notes: updatedSale.privateNotes || null,
            requires_approval: !!updatedSale.requiresApproval,
            bank_account_id: sanitizeBankAccountId(updatedSale.bankAccountId) || null,
        }));

        // Delete and Re-insert items
        oldItemsSnap.forEach(d => batch.delete(d.ref));
        if (updatedSale.items?.length) {
            updatedSale.items.forEach(i => {
                const iRef = doc(collection(db, 'sale_items'));
                batch.set(iRef, cleanFirestoreData({
                    sale_id: updatedSale.id,
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
        const oldPaymentsSnap = await getDocs(query(collection(db, 'payment_records'), where('sale_id', '==', updatedSale.id)));
        oldPaymentsSnap.forEach(d => batch.delete(d.ref));
        if (updatedSale.paymentHistory?.length) {
            updatedSale.paymentHistory.forEach(p => {
                const pRef = doc(collection(db, 'payment_records'));
                batch.set(pRef, cleanFirestoreData({
                    sale_id: updatedSale.id,
                    date: p.date,
                    amount: p.amount,
                    note: p.note
                }));
            });
        }

        await batch.commit();
        return updatedSale;
    },

    deleteSale: async (id: string): Promise<void> => {
        const saleRef = doc(db, 'sales', id);
        const saleDoc = await getDoc(saleRef);
        if (!saleDoc.exists()) throw new Error('Sale not found');
        const sale = saleDoc.data();

        const itemsSnap = await getDocs(query(collection(db, 'sale_items'), where('sale_id', '==', id)));
        const statusQueBaixaEstoque = ['Pendente', 'Em produção', 'Entregue', 'A caminho', 'Pronto para retirada', 'Coletado'];
        const wasConsumed = statusQueBaixaEstoque.includes(sale.status);

        if (wasConsumed) {
            for (const itemDoc of itemsSnap.docs) {
                const item = itemDoc.data();
                if (item.is_wholesale && item.distribution_id) {
                    const wsQuery = query(collection(db, 'wholesale_stock_items'), 
                        where('distribution_id', '==', item.distribution_id), 
                        where('color_id', '==', item.color_id || ''));
                    const wsSnap = await getDocs(wsQuery);
                    if (!wsSnap.empty) await updateDoc(wsSnap.docs[0].ref, { boxes: increment(item.quantity) });
                } else if (item.variation_id) {
                    await updateDoc(doc(db, 'variations', item.variation_id), { stock: increment(item.quantity) });
                }
            }
        }

        const batch = writeBatch(db);
        itemsSnap.forEach(d => batch.delete(d.ref));
        
        const paySnap = await getDocs(query(collection(db, 'payment_records'), where('sale_id', '==', id)));
        paySnap.forEach(d => batch.delete(d.ref));

        const transSnap = await getDocs(query(collection(db, 'transactions'), where('related_id', '==', id)));
        transSnap.forEach(d => batch.delete(d.ref));

        batch.delete(saleRef);
        await batch.commit();
    },

    addPaymentToSale: async (saleId: string, amount: number, date: string, bankAccountId?: string): Promise<void> => {
        const saleRef = doc(db, 'sales', saleId);
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

        const payRef = doc(collection(db, 'payment_records'));
        batch.set(payRef, cleanFirestoreData({
            sale_id: saleId,
            date,
            amount: amountToApply,
            note: excess > 0 ? `Recebimento (Excesso de R$ ${excess} p/ Haver)` : 'Recebimento'
        }));

        if (accounted) {
            const tRef = doc(collection(db, 'transactions'));
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
            const customerRef = doc(db, 'customers', sale.customer_id);
            batch.update(customerRef, { balance: increment(excess) });
        }

        await batch.commit();

        if (accounted && finalBankAccountId) {
            await bankAccountService.syncBalance(finalBankAccountId, amount);
        }
    },

    deletePaymentFromSale: async (saleId: string, paymentId: string): Promise<void> => {
        const paySnap = await getDoc(doc(db, 'payment_records', paymentId));
        if (!paySnap.exists()) throw new Error('Payment not found');
        const payment = paySnap.data() as any;

        const saleRef = doc(db, 'sales', saleId);
        const saleSnap = await getDoc(saleRef);
        const sale = saleSnap.data() as any;

        const newAmountPaid = (sale.amount_paid || 0) - payment.amount;
        const isPaid = newAmountPaid >= sale.total_value;

        const batch = writeBatch(db);
        batch.update(saleRef, { amount_paid: newAmountPaid, is_paid: isPaid });
        batch.delete(paySnap.ref);

        const transQuery = query(collection(db, 'transactions'), 
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
        const paySnap = await getDoc(doc(db, 'payment_records', paymentId));
        const payment = paySnap.data() as any;

        const saleRef = doc(db, 'sales', saleId);
        const saleSnap = await getDoc(saleRef);
        const sale = saleSnap.data() as any;

        const finalBankAccountId = sanitizeBankAccountId(bankAccountId) || sale.bank_account_id;
        const diff = newAmount - payment.amount;
        const newAmountPaid = (sale.amount_paid || 0) + diff;
        const isPaid = newAmountPaid >= sale.total_value;

        const batch = writeBatch(db);
        batch.update(saleRef, { amount_paid: newAmountPaid, is_paid: isPaid });
        batch.update(paySnap.ref, { amount: newAmount, date: newDate });

        const transQuery = query(collection(db, 'transactions'), 
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
            const tRef = doc(collection(db, 'transactions'));
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
