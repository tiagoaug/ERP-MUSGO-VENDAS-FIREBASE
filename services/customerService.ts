// services/customerService.ts
import { db, getScopedCollection, getScopedDoc } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { Customer } from '../types';
import { cleanFirestoreData } from '../lib/utils';

const fromRow = (id: string, c: any): Customer => ({
    id: id,
    name: c.name,
    phone: c.phone,
    balance: c.balance ?? 0,
    address: c.address,
});

export const customerService = {
    getCustomers: async (): Promise<Customer[]> => {
        const q = query(getScopedCollection('customers'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => fromRow(d.id, d.data()));
    },

    createCustomer: async (customer: Customer): Promise<Customer> => {
        const data = {
            name: customer.name,
            phone: customer.phone,
            balance: customer.balance ?? 0,
            address: customer.address,
        };

        if (customer.id && customer.id.trim()) {
            await setDoc(getScopedDoc('customers', customer.id), cleanFirestoreData(data));
            return { ...customer };
        } else {
            const docRef = await addDoc(getScopedCollection('customers'), cleanFirestoreData(data));
            return fromRow(docRef.id, data);
        }
    },

    updateCustomer: async (customer: Customer): Promise<void> => {
        await updateDoc(getScopedDoc('customers', customer.id), cleanFirestoreData(customer));
    },

    deleteCustomer: async (id: string): Promise<void> => {
        await deleteDoc(getScopedDoc('customers', id));
    },
};
