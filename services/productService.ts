// services/productService.ts
import { db } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, where, writeBatch, limit } from 'firebase/firestore';
import { Product, Variation, WholesaleStockItem } from '../types';
import { generateId } from '../lib/utils';

// Helper: monta um produto completo buscando variações e estoque atacado
const buildProduct = (rawProduct: any, rawProductId: string, variations: any[], wholesaleStock: any[]): Product => ({
    id: rawProductId,
    reference: rawProduct.reference,
    name: rawProduct.name,
    supplierId: rawProduct.supplier_id,
    gridId: rawProduct.grid_id,
    gridIds: rawProduct.grid_ids || [],
    status: rawProduct.status,
    image: rawProduct.image,
    hasRetail: rawProduct.has_retail,
    hasWholesale: rawProduct.has_wholesale,
    variations: variations
        .filter(v => v.product_id === rawProductId)
        .map(v => ({
            id: v.id,
            colorId: v.color_id,
            size: v.size,
            stock: v.stock,
            minStock: v.min_stock,
            costPrice: v.cost_price,
            sale_price: v.sale_price, // Note: original used sale_price in buildProduct but salePrice in type? wait.
            // Let's check types.ts if possible, but original code had sale_price in the map.
            // Actually original code line 27: salePrice: v.sale_price
            salePrice: v.sale_price,
            unit: v.unit,
            image: v.image,
            gridId: v.grid_id,
        } as Variation)),
    wholesaleStock: wholesaleStock
        .filter(ws => ws.product_id === rawProductId)
        .map(ws => ({
            id: ws.id,
            colorId: ws.color_id,
            gridId: ws.grid_id,
            distributionId: ws.distribution_id,
            boxes: ws.boxes,
            costPricePerBox: ws.cost_price_per_box,
            salePricePerBox: ws.sale_price_per_box,
            image: ws.image,
        } as WholesaleStockItem)),
});

export const productService = {
    getProducts: async (): Promise<Product[]> => {
        const [productsSnap, variationsSnap, wholesaleSnap] = await Promise.all([
            getDocs(query(collection(db, 'products'), orderBy('reference'))),
            getDocs(collection(db, 'variations')),
            getDocs(collection(db, 'wholesale_stock_items'))
        ]);

        const variations = variationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const wholesaleStock = wholesaleSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return productsSnap.docs.map(pDoc => buildProduct(pDoc.data(), pDoc.id, variations, wholesaleStock));
    },

    getProductById: async (id: string): Promise<Product | undefined> => {
        const productDoc = await getDoc(doc(db, 'products', id));
        if (!productDoc.exists()) return undefined;

        const [variationsSnap, wholesaleSnap] = await Promise.all([
            getDocs(query(collection(db, 'variations'), where('product_id', '==', id))),
            getDocs(query(collection(db, 'wholesale_stock_items'), where('product_id', '==', id)))
        ]);

        const variations = variationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const wholesaleStock = wholesaleSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return buildProduct(productDoc.data(), productDoc.id, variations, wholesaleStock);
    },

    createProduct: async (product: Product): Promise<Product> => {
        const productToInsert: any = {
            reference: product.reference,
            name: product.name,
            supplier_id: product.supplierId,
            grid_id: product.gridId || null,
            grid_ids: product.gridIds || [],
            status: product.status,
            image: product.image || null,
            has_retail: product.hasRetail,
            has_wholesale: product.hasWholesale,
        };

        const batch = writeBatch(db);
        let productId = product.id;
        let productRef;

        if (productId && productId.trim()) {
            productRef = doc(db, 'products', productId);
            batch.set(productRef, productToInsert);
        } else {
            productRef = doc(collection(db, 'products'));
            productId = productRef.id;
            batch.set(productRef, productToInsert);
        }

        if (product.variations?.length) {
            product.variations.forEach(v => {
                const vRef = v.id ? doc(db, 'variations', v.id) : doc(collection(db, 'variations'));
                batch.set(vRef, {
                    product_id: productId,
                    color_id: v.colorId,
                    size: v.size,
                    stock: v.stock,
                    min_stock: v.minStock,
                    cost_price: v.costPrice,
                    sale_price: v.salePrice,
                    unit: v.unit,
                    image: v.image || null,
                    grid_id: v.gridId || null,
                });
            });
        }

        if (product.wholesaleStock?.length) {
            product.wholesaleStock.forEach(ws => {
                const wsRef = ws.id ? doc(db, 'wholesale_stock_items', ws.id) : doc(collection(db, 'wholesale_stock_items'));
                batch.set(wsRef, {
                    product_id: productId,
                    color_id: ws.colorId,
                    grid_id: ws.gridId,
                    distribution_id: ws.distributionId,
                    boxes: ws.boxes,
                    cost_price_per_box: ws.costPricePerBox,
                    sale_price_per_box: ws.salePricePerBox,
                    image: ws.image || null,
                });
            });
        }

        await batch.commit();
        return { ...product, id: productId };
    },

    updateProduct: async (product: Product): Promise<Product> => {
        console.log("💾 Iniciando salvamento do produto:", product.reference, product.id);

        const batch = writeBatch(db);
        const productRef = doc(db, 'products', product.id);
        
        batch.update(productRef, {
            reference: product.reference,
            name: product.name,
            supplier_id: product.supplierId,
            grid_id: product.gridId || null,
            grid_ids: product.gridIds || [],
            status: product.status,
            image: product.image || null,
            has_retail: product.hasRetail,
            has_wholesale: product.hasWholesale,
        });

        // 1. Variações Varejo
        try {
            const variationsSnap = await getDocs(query(collection(db, 'variations'), where('product_id', '==', product.id)));
            const dbVariationIds = variationsSnap.docs.map(d => d.id);
            const currentVariationIds = product.variations.map(v => v.id).filter(id => !!id);
            const idsToDelete = dbVariationIds.filter(id => !currentVariationIds.includes(id));

            idsToDelete.forEach(id => batch.delete(doc(db, 'variations', id)));

            if (product.variations.length > 0) {
                product.variations.forEach(v => {
                    const id = v.id || generateId();
                    const vRef = doc(db, 'variations', id);
                    batch.set(vRef, {
                        product_id: product.id,
                        color_id: v.colorId,
                        size: v.size,
                        stock: v.stock,
                        min_stock: v.minStock,
                        cost_price: v.costPrice,
                        sale_price: v.salePrice,
                        unit: v.unit,
                        image: v.image || null,
                        grid_id: v.gridId || null
                    });
                });
            }
        } catch (err: any) {
            console.error("Falha no varejo:", err);
            throw err;
        }

        // 2. Estoque Atacado
        try {
            const wholesaleSnap = await getDocs(query(collection(db, 'wholesale_stock_items'), where('product_id', '==', product.id)));
            const dbWholesaleIds = wholesaleSnap.docs.map(d => d.id);
            const currentWholesaleIds = product.wholesaleStock.map(ws => ws.id).filter(id => !!id);
            const wsIdsToDelete = dbWholesaleIds.filter(id => !currentWholesaleIds.includes(id));

            wsIdsToDelete.forEach(id => batch.delete(doc(db, 'wholesale_stock_items', id)));

            // Sincronização de preço Atacado -> Varejo
            const gridsSnap = await getDocs(collection(db, 'grids'));
            const distsSnap = await getDocs(collection(db, 'grid_distributions'));
            
            const allGrids = gridsSnap.docs.map(gDoc => ({
                id: gDoc.id,
                distributions: distsSnap.docs
                    .filter(d => d.data().grid_id === gDoc.id)
                    .map(d => ({ id: d.id, ...d.data() }))
            }));

            if (product.wholesaleStock?.length) {
                product.wholesaleStock.forEach(ws => {
                    const id = ws.id || generateId();
                    const wsRef = doc(db, 'wholesale_stock_items', id);
                    
                    const wsData = {
                        product_id: product.id,
                        color_id: ws.colorId,
                        grid_id: ws.gridId,
                        distribution_id: ws.distributionId,
                        boxes: ws.boxes,
                        cost_price_per_box: ws.costPricePerBox,
                        sale_price_per_box: ws.salePricePerBox,
                        image: ws.image || null,
                    };

                    batch.set(wsRef, wsData);

                    // Lógica de Sincronização de Preço
                    if (ws.costPricePerBox > 0 || ws.salePricePerBox > 0) {
                        const grid = allGrids.find(g => g.id === ws.gridId);
                        const dist: any = grid?.distributions.find(d => d.id === ws.distributionId);
                        if (dist) {
                            const pairsCount = Object.values(dist.quantities || {}).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
                            if (pairsCount > 0) {
                                const unitCost = ws.costPricePerBox / pairsCount;
                                const unitSale = ws.salePricePerBox / pairsCount;
                                product.variations.forEach(v => {
                                    if (v.colorId === ws.colorId) {
                                        if (ws.costPricePerBox > 0) v.costPrice = unitCost;
                                        if (ws.salePricePerBox > 0) v.salePrice = unitSale;
                                        // Update in batch as well
                                        const vId = v.id || generateId();
                                        batch.set(doc(db, 'variations', vId), {
                                            product_id: product.id,
                                            color_id: v.colorId,
                                            size: v.size,
                                            stock: v.stock,
                                            min_stock: v.minStock,
                                            cost_price: v.costPrice,
                                            sale_price: v.salePrice,
                                            unit: v.unit,
                                            image: v.image || null,
                                            grid_id: v.gridId || null
                                        });
                                    }
                                });
                            }
                        }
                    }
                });
            }
        } catch (err: any) {
            console.error("Falha no atacado:", err);
            throw err;
        }

        await batch.commit();
        return product;
    },

    deleteProduct: async (id: string): Promise<void> => {
        const batch = writeBatch(db);
        
        // Remove referências
        const saleItemsSnap = await getDocs(query(collection(db, 'sale_items'), where('product_id', '==', id)));
        saleItemsSnap.forEach(d => batch.delete(d.ref));

        const purchaseItemsSnap = await getDocs(query(collection(db, 'purchase_items'), where('product_id', '==', id)));
        purchaseItemsSnap.forEach(d => batch.delete(d.ref));

        const variationsSnap = await getDocs(query(collection(db, 'variations'), where('product_id', '==', id)));
        variationsSnap.forEach(d => batch.delete(d.ref));

        const wholesaleSnap = await getDocs(query(collection(db, 'wholesale_stock_items'), where('product_id', '==', id)));
        wholesaleSnap.forEach(d => batch.delete(d.ref));

        batch.delete(doc(db, 'products', id));

        await batch.commit();
    },

    syncStockWithHistory: async (): Promise<void> => {
        const [purchasesSnap, purItemsSnap, salesSnap, saleItemsSnap, variationsSnap, wholesaleSnap, colorsSnap] = await Promise.all([
            getDocs(query(collection(db, 'purchases'), where('type', '==', 'inventory'))),
            getDocs(collection(db, 'purchase_items')),
            getDocs(collection(db, 'sales')),
            getDocs(collection(db, 'sale_items')),
            getDocs(collection(db, 'variations')),
            getDocs(collection(db, 'wholesale_stock_items')),
            getDocs(collection(db, 'colors'))
        ]);

        const purchaseItems = purItemsSnap.docs.map(d => d.data());
        const saleItems = saleItemsSnap.docs.map(d => d.data());
        const variations = variationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const wholesaleItems = wholesaleSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const colors = colorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const activePurchaseIds = new Set(purchasesSnap.docs.map(d => d.id));
        const statusQueBaixaEstoque = ['Pendente', 'Em produção', 'Entregue', 'A caminho', 'Pronto para retirada', 'Coletado'];
        const activeSaleIds = new Set(salesSnap.docs.filter(d => statusQueBaixaEstoque.includes(d.data().status)).map(d => d.id));

        const finalVarStocks: Record<string, number> = {};
        variations.forEach(v => finalVarStocks[v.id] = 0);

        purchaseItems.forEach((i: any) => {
            if (!i.is_wholesale && i.variation_id && activePurchaseIds.has(i.purchase_id)) {
                if (finalVarStocks.hasOwnProperty(i.variation_id)) {
                    finalVarStocks[i.variation_id] += Number(i.quantity || 0);
                }
            }
        });
        saleItems.forEach((i: any) => {
            if (!i.is_wholesale && i.variation_id && activeSaleIds.has(i.sale_id)) {
                if (finalVarStocks.hasOwnProperty(i.variation_id)) {
                    finalVarStocks[i.variation_id] -= Number(i.quantity || 0);
                }
            }
        });

        const normalizeColor = (cid: string | null) => {
            if (!cid) return '';
            const trimmed = cid.trim().toLowerCase();
            const found: any = colors.find(c => (c as any).name.toLowerCase().trim() === trimmed || c.id === cid);
            return found ? found.id : trimmed;
        };

        const groupToIds = new Map<string, string[]>();
        wholesaleItems.forEach((w: any) => {
            const normalizedColor = normalizeColor(w.color_id);
            const key = `${w.product_id}_${w.distribution_id}_${normalizedColor}`;
            if (!groupToIds.has(key)) groupToIds.set(key, []);
            groupToIds.get(key)!.push(w.id);
        });

        const groupStocks: Record<string, number> = {};
        purchaseItems.forEach((i: any) => {
            if (i.is_wholesale && i.product_id && i.distribution_id && activePurchaseIds.has(i.purchase_id)) {
                const normalizedColor = normalizeColor(i.color_id);
                const key = `${i.product_id}_${i.distribution_id}_${normalizedColor}`;
                groupStocks[key] = (groupStocks[key] || 0) + Number(i.quantity || 0);
            }
        });
        saleItems.forEach((i: any) => {
            if (i.is_wholesale && i.product_id && i.distribution_id && activeSaleIds.has(i.sale_id)) {
                const normalizedColor = normalizeColor(i.color_id);
                const key = `${i.product_id}_${i.distribution_id}_${normalizedColor}`;
                groupStocks[key] = (groupStocks[key] || 0) - Number(i.quantity || 0);
            }
        });

        const batch = writeBatch(db);
        Object.entries(finalVarStocks).forEach(([id, stock]) => {
            batch.update(doc(db, 'variations', id), { stock });
        });

        groupToIds.forEach((ids, key) => {
            const totalForGroup = groupStocks[key] || 0;
            ids.forEach((id, index) => {
                const finalBoxes = (index === 0) ? totalForGroup : 0;
                batch.update(doc(db, 'wholesale_stock_items', id), { boxes: finalBoxes });
            });
        });

        await batch.commit();
    },
};
