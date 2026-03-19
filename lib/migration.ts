import { db } from './firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { AppColor, AppUnit, AppGrid, Supplier, Customer, Product, Sale, Purchase, Transaction, AccountEntry, AgendaTask, AppNote } from '../types';

export const migrateLocalDataToFirebase = async (
    rawData: any,
    onProgress: (msg: string) => void
) => {
    try {
        onProgress("Iniciando migração para o Firebase...");

        // Mapas de ID (Old -> New UUID)
        const idMap = new Map<string, string>();
        const getUuid = (oldId: string | undefined): string | null => {
            if (!oldId) return null;
            if (!idMap.has(oldId)) {
                idMap.set(oldId, crypto.randomUUID());
            }
            return idMap.get(oldId) || null;
        };

        // Extrai dados
        const { colors, units, grids, suppliers, customers, products, sales, purchases, transactions, financials, tasks, notes } = rawData;

        const sanitize = (val: any) => (val === undefined || val === null) ? null : val;

        const executeBatch = async (items: any[], collectionName: string, transform: (item: any) => any) => {
            if (!items || items.length === 0) return;
            
            for (let i = 0; i < items.length; i += 500) {
                const batch = writeBatch(db);
                const chunk = items.slice(i, i + 500);
                
                chunk.forEach(item => {
                    const data = transform(item);
                    if (data && data.id) {
                        // Limpeza profunda para remover undefined
                        const cleanData: any = {};
                        Object.entries(data).forEach(([k, v]) => {
                            if (v !== undefined) cleanData[k] = v;
                            else cleanData[k] = null;
                        });

                        const ref = doc(db, collectionName, data.id);
                        batch.set(ref, cleanData);
                    }
                });
                
                await batch.commit();
            }
        };

        // --- CORES ---
        onProgress(`Migrando Cores (${colors?.length || 0})...`);
        await executeBatch(colors, 'colors', (c: AppColor) => ({
            id: getUuid(c.id),
            name: c.name
        }));

        // MAP (Opcional - caso colorId nos produtos esteja usando o 'name' ao inves de 'id')
        const colorNameToId = new Map<string, string>();
        (colors || []).forEach((c: AppColor) => colorNameToId.set(c.name, getUuid(c.id)!));
        const resolveColorId = (rawColorId: string) => {
            if (idMap.has(rawColorId)) return idMap.get(rawColorId);
            if (colorNameToId.has(rawColorId)) return colorNameToId.get(rawColorId);
            return getUuid(rawColorId); // Fallback
        };

        // --- UNIDADES ---
        onProgress(`Migrando Unidades (${units?.length || 0})...`);
        await executeBatch(units, 'units', (u: AppUnit) => ({
            id: getUuid(u.id),
            name: u.name
        }));

        // --- GRADES ---
        onProgress(`Migrando Grades (${grids?.length || 0})...`);
        await executeBatch(grids, 'grids', (g: AppGrid) => ({
            id: getUuid(g.id),
            name: g.name,
            sizes: g.sizes
        }));

        // --- DISTRIBUIÇÕES ---
        const allDistributions = (grids || []).flatMap((g: AppGrid) => 
            (g.distributions || []).map(d => ({ ...d, gridId: getUuid(g.id) }))
        );
        onProgress(`Migrando Distribuições de Grade (${allDistributions.length})...`);
        await executeBatch(allDistributions, 'grid_distributions', (d: any) => ({
            id: getUuid(d.id),
            gridId: d.gridId,
            name: d.name,
            quantities: d.quantities
        }));

        // --- FORNECEDORES ---
        onProgress(`Migrando Fornecedores (${suppliers?.length || 0})...`);
        await executeBatch(suppliers, 'suppliers', (s: Supplier) => ({
            id: getUuid(s.id),
            name: s.name,
            contact: s.contact,
            balance: s.balance,
            type: s.type,
            phone: s.phone,
            email: s.email
        }));

        // --- CLIENTES ---
        onProgress(`Migrando Clientes (${customers?.length || 0})...`);
        await executeBatch(customers, 'customers', (c: Customer) => ({
            id: getUuid(c.id),
            name: c.name,
            phone: c.phone,
            balance: c.balance,
            address: c.address
        }));

        // --- PRODUTOS ---
        onProgress(`Migrando Produtos (${products?.length || 0})...`);
        await executeBatch(products, 'products', (p: Product) => ({
            id: getUuid(p.id),
            reference: p.reference,
            name: p.name,
            supplierId: getUuid(p.supplierId),
            gridId: getUuid(p.gridId),
            gridIds: (p.gridIds || []).map((gid: string) => getUuid(gid)),
            status: p.status,
            image: p.image,
            hasRetail: p.hasRetail,
            hasWholesale: p.hasWholesale
        }));

        // --- VARIAÇÕES ---
        const allVariations = (products || []).flatMap((p: Product) => 
            (p.variations || []).map(v => ({ ...v, productId: getUuid(p.id) }))
        );
        onProgress(`Migrando Variações (${allVariations.length})...`);
        await executeBatch(allVariations, 'variations', (v: any) => ({
            id: getUuid(v.id),
            productId: v.productId,
            colorId: resolveColorId(v.colorId),
            size: v.size,
            stock: v.stock,
            minStock: v.minStock,
            costPrice: v.costPrice,
            salePrice: v.salePrice,
            unit: v.unit,
            image: v.image,
            gridId: getUuid(v.gridId)
        }));

        // --- ESTOQUE ATACADO ---
        const allWholesale = (products || []).flatMap((p: Product) => 
            (p.wholesaleStock || []).map(ws => ({ ...ws, productId: getUuid(p.id) }))
        );
        onProgress(`Migrando Estoque Atacado (${allWholesale.length})...`);
        await executeBatch(allWholesale, 'wholesale_stock_items', (ws: any) => ({
            id: getUuid(ws.id),
            productId: ws.productId,
            colorId: resolveColorId(ws.colorId),
            gridId: getUuid(ws.gridId),
            distributionId: getUuid(ws.distributionId),
            boxes: ws.boxes,
            costPricePerBox: ws.costPricePerBox,
            salePricePerBox: ws.salePricePerBox,
            image: ws.image
        }));

        // --- VENDAS ---
        onProgress(`Migrando Vendas (${sales?.length || 0})...`);
        await executeBatch(sales, 'sales', (s: Sale) => ({
            id: getUuid(s.id),
            saleNumber: s.saleNumber,
            date: s.date,
            dueDate: s.dueDate || s.date,
            customerId: getUuid(s.customerId),
            totalValue: s.totalValue,
            amountPaid: s.amountPaid,
            isPaid: s.isPaid,
            paymentType: s.paymentType,
            status: s.status,
            discount: s.discount,
            deliveryMethod: s.deliveryMethod,
            deliveryAddress: s.deliveryAddress,
            comments: s.comments,
            privateNotes: s.privateNotes,
            requiresApproval: s.requiresApproval
        }));

        // --- ITENS DE VENDA ---
        const allSaleItems = (sales || []).flatMap((s: Sale) => 
            (s.items || []).map(i => ({ ...i, saleId: getUuid(s.id) }))
        );
        onProgress(`Migrando Itens de Venda (${allSaleItems.length})...`);
        await executeBatch(allSaleItems, 'sale_items', (i: any) => ({
            id: crypto.randomUUID(),
            saleId: i.saleId,
            productId: getUuid(i.productId),
            variationId: getUuid(i.variationId),
            distributionId: getUuid(i.distributionId),
            isWholesale: i.isWholesale,
            colorId: resolveColorId(i.colorId || ''),
            quantity: i.quantity,
            priceAtSale: i.priceAtSale
        }));

        // --- HISTÓRICO DE PAGAMENTOS (VENDAS) ---
        const allSalePayments = (sales || []).flatMap((s: Sale) => 
            (s.paymentHistory || []).map(ph => ({ ...ph, saleId: getUuid(s.id) }))
        );
        onProgress(`Migrando Pagamentos de Vendas (${allSalePayments.length})...`);
        await executeBatch(allSalePayments, 'payment_history', (ph: any) => ({
            id: getUuid(ph.id),
            saleId: ph.saleId,
            date: ph.date,
            amount: ph.amount,
            note: ph.note
        }));

        // --- COMPRAS ---
        onProgress(`Migrando Compras (${purchases?.length || 0})...`);
        await executeBatch(purchases, 'purchases', (p: Purchase) => ({
            id: getUuid(p.id),
            purchaseNumber: p.purchaseNumber,
            type: p.type,
            isWholesale: p.isWholesale,
            supplierId: getUuid(p.supplierId),
            date: p.date,
            dueDate: p.dueDate || p.date,
            totalValue: p.totalValue,
            amountPaid: p.amountPaid,
            isPaid: p.isPaid,
            itemDescription: p.itemDescription,
            notes: p.notes
        }));

        // --- ITENS DE COMPRA ---
        const allPurchaseItems = (purchases || []).flatMap((p: Purchase) => 
            (p.items || []).map(i => ({ ...i, purchaseId: getUuid(p.id) }))
        );
        onProgress(`Migrando Itens de Compra (${allPurchaseItems.length})...`);
        await executeBatch(allPurchaseItems, 'purchase_items', (i: any) => ({
            id: crypto.randomUUID(),
            purchaseId: i.purchaseId,
            productId: getUuid(i.productId),
            variationId: getUuid(i.variationId),
            distributionId: getUuid(i.distributionId),
            isWholesale: i.isWholesale,
            colorId: resolveColorId(i.colorId || ''),
            quantity: i.quantity,
            costPrice: i.costPrice
        }));

        // --- ITENS DE DESPESA (COMPRAS) ---
        const allExpenseItems = (purchases || []).flatMap((p: Purchase) => 
            (p.expenseItems || []).map(ei => ({ ...ei, purchaseId: getUuid(p.id) }))
        );
        onProgress(`Migrando Itens de Despesa (${allExpenseItems.length})...`);
        await executeBatch(allExpenseItems, 'expense_items', (ei: any) => ({
            id: getUuid(ei.id),
            purchaseId: ei.purchaseId,
            description: ei.description,
            value: ei.value
        }));

        // --- HISTÓRICO DE PAGAMENTOS (COMPRAS) ---
        const allPurchasePayments = (purchases || []).flatMap((p: Purchase) => 
            (p.paymentHistory || []).map(ph => ({ ...ph, purchaseId: getUuid(p.id) }))
        );
        onProgress(`Migrando Pagamentos de Compras (${allPurchasePayments.length})...`);
        await executeBatch(allPurchasePayments, 'payment_records', (ph: any) => ({
            id: getUuid(ph.id),
            purchaseId: ph.purchaseId,
            date: ph.date,
            amount: ph.amount,
            note: ph.note
        }));

        // --- TRANSAÇÕES (CAIXA) ---
        onProgress(`Migrando Transações (${transactions?.length || 0})...`);
        await executeBatch(transactions, 'transactions', (t: Transaction) => ({
            id: getUuid(t.id),
            date: t.date,
            type: t.type,
            amount: t.amount,
            description: t.description,
            relatedId: getUuid(t.relatedId) || t.relatedId
        }));

        // --- ACCOUNT ENTRIES (FINANCEIRAS EXTRAS) ---
        onProgress(`Migrando Entradas Contábeis (${financials?.length || 0})...`);
        await executeBatch(financials, 'account_entries', (a: AccountEntry) => ({
            id: getUuid(a.id),
            type: a.type,
            description: a.description,
            value: a.value,
            dueDate: a.dueDate,
            isPaid: a.isPaid,
            relatedId: getUuid(a.relatedId) || a.relatedId
        }));

        // --- AGENDA ---
        onProgress(`Migrando Agenda (${tasks?.length || 0})...`);
        await executeBatch(tasks, 'agenda_tasks', (t: AgendaTask) => ({
            id: getUuid(t.id),
            date: t.date,
            hour: t.hour,
            title: t.title,
            completed: t.completed
        }));

        // --- NOTAS ---
        onProgress(`Migrando Notas (${notes?.length || 0})...`);
        await executeBatch(notes, 'app_notes', (n: AppNote) => ({
            id: getUuid(n.id),
            title: n.title,
            content: n.content,
            color: n.color,
            date: n.date
        }));

        onProgress("Migração concluída com sucesso!");

    } catch (error: any) {
        console.error("Erro na migração:", error);
        throw new Error(`Falha na migração: ${error.message || error}`);
    }
};
