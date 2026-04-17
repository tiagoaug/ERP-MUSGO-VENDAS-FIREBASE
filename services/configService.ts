// services/configService.ts
// Gerencia tabelas de configuração: cores, unidades e grades através do Firebase Firestore
import { db, getScopedCollection, getScopedDoc } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, where, writeBatch } from 'firebase/firestore';
import { AppColor, AppUnit, AppGrid, ExpenseCategory } from '../types';
import { cleanFirestoreData } from '../lib/utils';

export const configService = {
    // --- CORES ---
    getColors: async (): Promise<AppColor[]> => {
        const q = query(getScopedCollection('colors'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, name: d.data().name } as AppColor));
    },
    addColor: async (color: Partial<AppColor>): Promise<AppColor> => {
        const docRef = await addDoc(getScopedCollection('colors'), cleanFirestoreData({ name: color.name }));
        return { id: docRef.id, name: color.name } as AppColor;
    },
    updateColor: async (color: AppColor): Promise<void> => {
        await updateDoc(getScopedDoc('colors', color.id), cleanFirestoreData({ name: color.name }));
    },
    deleteColor: async (id: string): Promise<void> => {
        const batch = writeBatch(db);
        
        const variationsQuery = query(getScopedCollection('variations'), where('color_id', '==', id));
        const variationsSnapshot = await getDocs(variationsQuery);
        variationsSnapshot.forEach(d => batch.delete(d.ref));

        const wholesaleQuery = query(getScopedCollection('wholesale_stock_items'), where('color_id', '==', id));
        const wholesaleSnapshot = await getDocs(wholesaleQuery);
        wholesaleSnapshot.forEach(d => batch.delete(d.ref));

        batch.delete(getScopedDoc('colors', id));
        await batch.commit();
    },

    // --- UNIDADES ---
    getUnits: async (): Promise<AppUnit[]> => {
        const q = query(getScopedCollection('units'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, name: d.data().name } as AppUnit));
    },
    addUnit: async (unit: Partial<AppUnit>): Promise<AppUnit> => {
        const docRef = await addDoc(getScopedCollection('units'), cleanFirestoreData({ name: unit.name }));
        return { id: docRef.id, name: unit.name } as AppUnit;
    },
    updateUnit: async (unit: AppUnit): Promise<void> => {
        await updateDoc(getScopedDoc('units', unit.id), cleanFirestoreData({ name: unit.name }));
    },
    deleteUnit: async (id: string): Promise<void> => {
        await deleteDoc(getScopedDoc('units', id));
    },

    // --- GRADES ---
    getGrids: async (): Promise<AppGrid[]> => {
        const gridsSnapshot = await getDocs(query(getScopedCollection('grids'), orderBy('name')));
        const distsSnapshot = await getDocs(getScopedCollection('grid_distributions'));
        
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
    addGrid: async (grid: Partial<AppGrid>): Promise<AppGrid> => {
        const docRef = await addDoc(getScopedCollection('grids'), cleanFirestoreData({ name: grid.name, sizes: grid.sizes }));
        const gridId = docRef.id;
        
        if (grid.distributions?.length) {
            const batch = writeBatch(db);
            grid.distributions.forEach(d => {
                const dRef = d.id ? getScopedDoc('grid_distributions', d.id) : doc(getScopedCollection('grid_distributions'));
                batch.set(dRef, cleanFirestoreData({ grid_id: gridId, name: d.name, quantities: d.quantities }));
            });
            await batch.commit();
        }
        return { ...grid, id: gridId } as AppGrid;
    },
    updateGrid: async (grid: AppGrid): Promise<void> => {
        const batch = writeBatch(db);
        batch.update(getScopedDoc('grids', grid.id), cleanFirestoreData({ name: grid.name, sizes: grid.sizes }));

        const distsQuery = query(getScopedCollection('grid_distributions'), where('grid_id', '==', grid.id));
        const currentDistsSnap = await getDocs(distsQuery);
        
        const existingIds = currentDistsSnap.docs.map(d => d.id);
        const incomingIds = grid.distributions.map(d => d.id).filter(id => !!id);
        const toDelete = existingIds.filter(id => !incomingIds.includes(id));

        toDelete.forEach(id => batch.delete(getScopedDoc('grid_distributions', id)));

        grid.distributions.forEach(d => {
            const dRef = d.id ? getScopedDoc('grid_distributions', d.id) : doc(getScopedCollection('grid_distributions'));
            batch.set(dRef, cleanFirestoreData({ ...d, grid_id: grid.id }));
        });
        await batch.commit();
    },
    deleteGrid: async (id: string): Promise<void> => {
        const batch = writeBatch(db);
        const distsQuery = query(getScopedCollection('grid_distributions'), where('grid_id', '==', id));
        const distsSnap = await getDocs(distsQuery);
        distsSnap.forEach(d => batch.delete(d.ref));
        batch.delete(getScopedDoc('grids', id));
        
        await batch.commit();
    },

    // --- CATEGORIAS DE DESPESAS ---
    getExpenseCategories: async (): Promise<ExpenseCategory[]> => {
        const q = query(getScopedCollection('expense_categories'), orderBy('name'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ExpenseCategory[];
    },
    addExpenseCategory: async (category: Partial<ExpenseCategory>): Promise<ExpenseCategory> => {
        const docRef = await addDoc(getScopedCollection('expense_categories'), cleanFirestoreData({ name: category.name }));
        return { id: docRef.id, name: category.name } as ExpenseCategory;
    },
    updateExpenseCategory: async (category: ExpenseCategory): Promise<void> => {
        await updateDoc(getScopedDoc('expense_categories', category.id), cleanFirestoreData({ name: category.name }));
    },
    deleteExpenseCategory: async (id: string): Promise<void> => {
        await deleteDoc(getScopedDoc('expense_categories', id));
    },
};
