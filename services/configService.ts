// services/configService.ts
// Gerencia tabelas de configuração: cores, unidades e grades através do Firebase Firestore
import { db } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, where, writeBatch } from 'firebase/firestore';
import { AppColor, AppUnit, AppGrid, ExpenseCategory } from '../types';

export const configService = {
    // --- CORES ---
    getColors: async (): Promise<AppColor[]> => {
        const q = query(collection(db, 'colors'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, name: d.data().name } as AppColor));
    },
    createColor: async (color: AppColor): Promise<AppColor> => {
        if (color.id && color.id.trim()) {
            await setDoc(doc(db, 'colors', color.id), { name: color.name });
            return color;
        } else {
            const docRef = await addDoc(collection(db, 'colors'), { name: color.name });
            return { id: docRef.id, name: color.name };
        }
    },
    updateColor: async (color: AppColor): Promise<AppColor> => {
        await updateDoc(doc(db, 'colors', color.id), { name: color.name });
        return color;
    },
    deleteColor: async (id: string): Promise<void> => {
        // Firestore não tem FK constraints nativas como o Postgres, 
        // mas vamos manter a lógica de limpeza manual para consistência.
        const batch = writeBatch(db);
        
        // Variações
        const variationsQuery = query(collection(db, 'variations'), where('color_id', '==', id));
        const variationsSnapshot = await getDocs(variationsQuery);
        variationsSnapshot.forEach(d => batch.delete(d.ref));

        // Estoque Atacado
        const wholesaleQuery = query(collection(db, 'wholesale_stock_items'), where('color_id', '==', id));
        const wholesaleSnapshot = await getDocs(wholesaleQuery);
        wholesaleSnapshot.forEach(d => batch.delete(d.ref));

        await batch.commit();
        await deleteDoc(doc(db, 'colors', id));
    },

    // --- UNIDADES ---
    getUnits: async (): Promise<AppUnit[]> => {
        const q = query(collection(db, 'units'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, name: d.data().name } as AppUnit));
    },
    createUnit: async (unit: AppUnit): Promise<AppUnit> => {
        if (unit.id && unit.id.trim()) {
            await setDoc(doc(db, 'units', unit.id), { name: unit.name });
            return unit;
        } else {
            const docRef = await addDoc(collection(db, 'units'), { name: unit.name });
            return { id: docRef.id, name: unit.name };
        }
    },
    updateUnit: async (unit: AppUnit): Promise<AppUnit> => {
        await updateDoc(doc(db, 'units', unit.id), { name: unit.name });
        return unit;
    },
    deleteUnit: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'units', id));
    },

    // --- GRADES ---
    getGrids: async (): Promise<AppGrid[]> => {
        const gridsSnapshot = await getDocs(query(collection(db, 'grids'), orderBy('name')));
        const distsSnapshot = await getDocs(collection(db, 'grid_distributions'));
        
        const dists = distsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        return gridsSnapshot.docs.map(gDoc => {
            const g = gDoc.data();
            return {
                id: gDoc.id,
                name: g.name,
                sizes: g.sizes || [],
                distributions: dists
                    .filter((d: any) => d.grid_id === gDoc.id)
                    .map((d: any) => ({ id: d.id, name: d.name, quantities: d.quantities || {} })),
            } as AppGrid;
        });
    },
    createGrid: async (grid: AppGrid): Promise<AppGrid> => {
        let gridId = grid.id;
        if (gridId && gridId.trim()) {
            await setDoc(doc(db, 'grids', gridId), { name: grid.name, sizes: grid.sizes });
        } else {
            const docRef = await addDoc(collection(db, 'grids'), { name: grid.name, sizes: grid.sizes });
            gridId = docRef.id;
        }

        if (grid.distributions?.length) {
            const batch = writeBatch(db);
            grid.distributions.forEach(d => {
                const dRef = d.id ? doc(db, 'grid_distributions', d.id) : doc(collection(db, 'grid_distributions'));
                batch.set(dRef, { grid_id: gridId, name: d.name, quantities: d.quantities });
            });
            await batch.commit();
        }
        return { ...grid, id: gridId };
    },
    updateGrid: async (grid: AppGrid): Promise<AppGrid> => {
        await updateDoc(doc(db, 'grids', grid.id), { name: grid.name, sizes: grid.sizes });
        
        // Delete e re-insert distribuições (simulando a lógica original)
        const batch = writeBatch(db);
        const distsQuery = query(collection(db, 'grid_distributions'), where('grid_id', '==', grid.id));
        const distsSnapshot = await getDocs(distsQuery);
        distsSnapshot.forEach(d => batch.delete(d.ref));
        await batch.commit();

        if (grid.distributions?.length) {
            const insertBatch = writeBatch(db);
            grid.distributions.forEach(d => {
                const dRef = d.id ? doc(db, 'grid_distributions', d.id) : doc(collection(db, 'grid_distributions'));
                insertBatch.set(dRef, { grid_id: grid.id, name: d.name, quantities: d.quantities });
            });
            await insertBatch.commit();
        }
        return grid;
    },
    deleteGrid: async (id: string): Promise<void> => {
        const batch = writeBatch(db);
        const distsQuery = query(collection(db, 'grid_distributions'), where('grid_id', '==', id));
        const distsSnapshot = await getDocs(distsQuery);
        distsSnapshot.forEach(d => batch.delete(d.ref));
        await batch.commit();
        
        await deleteDoc(doc(db, 'grids', id));
    },

    // --- CATEGORIAS DE DESPESAS ---
    getExpenseCategories: async (): Promise<ExpenseCategory[]> => {
        const q = query(collection(db, 'expense_categories'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, name: d.data().name } as ExpenseCategory));
    },
    createExpenseCategory: async (category: Omit<ExpenseCategory, 'id'>): Promise<ExpenseCategory> => {
        const docRef = await addDoc(collection(db, 'expense_categories'), { name: category.name });
        return { id: docRef.id, name: category.name };
    },
    updateExpenseCategory: async (category: ExpenseCategory): Promise<ExpenseCategory> => {
        await updateDoc(doc(db, 'expense_categories', category.id), { name: category.name });
        return category;
    },
    deleteExpenseCategory: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'expense_categories', id));
    },
};
