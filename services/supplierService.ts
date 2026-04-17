// services/supplierService.ts
import { db, getScopedCollection, getScopedDoc } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { Supplier } from '../types';
import { cleanFirestoreData } from '../lib/utils';

const fromRow = (id: string, s: any): Supplier => ({
    id: id,
    name: s.name,
    contact: s.contact,
    balance: s.balance ?? 0,
    type: s.type,
    phone: s.phone,
    email: s.email,
});

export const supplierService = {
    getSuppliers: async (): Promise<Supplier[]> => {
        const q = query(getScopedCollection('suppliers'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => fromRow(d.id, d.data()));
    },

    createSupplier: async (supplier: Supplier): Promise<Supplier> => {
        const data = {
            name: supplier.name,
            contact: supplier.contact,
            balance: supplier.balance ?? 0,
            type: supplier.type,
            phone: supplier.phone,
            email: supplier.email,
        };

        if (supplier.id && supplier.id.trim()) {
            await setDoc(getScopedDoc('suppliers', supplier.id), cleanFirestoreData(data));
            return { ...supplier };
        } else {
            const docRef = await addDoc(getScopedCollection('suppliers'), cleanFirestoreData(data));
            return fromRow(docRef.id, data);
        }
    },

    updateSupplier: async (supplier: Supplier): Promise<void> => {
        await updateDoc(getScopedDoc('suppliers', supplier.id), cleanFirestoreData(supplier));
    },

    deleteSupplier: async (id: string): Promise<void> => {
        await deleteDoc(getScopedDoc('suppliers', id));
    },
};
