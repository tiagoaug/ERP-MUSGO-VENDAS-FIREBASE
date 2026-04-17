// services/financeService.ts
import { db, getScopedCollection, getScopedDoc } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, where, writeBatch } from 'firebase/firestore';
import { Transaction, AccountEntry, AgendaTask, AppNote } from '../types';
import { bankAccountService } from './bankAccountService';
import { cleanFirestoreData } from '../lib/utils';

export const financeService = {
    // --- TRANSAÇÕES (CAIXA) ---
    getTransactions: async (): Promise<Transaction[]> => {
        const q = query(getScopedCollection('transactions'), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(t => ({ id: t.id, ...t.data() } as Transaction));
    },
    addTransaction: async (t: Omit<Transaction, 'id'>): Promise<Transaction> => {
        const data = {
            date: t.date, 
            type: t.type, 
            amount: t.amount, 
            description: t.description,
            related_id: t.relatedId || null, 
            bank_account_id: t.bankAccountId || null
        };
        const docRef = await addDoc(getScopedCollection('transactions'), cleanFirestoreData(data));
        
        // Sync Balance
        if (t.bankAccountId) {
            await bankAccountService.syncBalance(t.bankAccountId, t.amount);
        }

        return { ...t, id: docRef.id };
    },
    updateTransaction: async (t: Transaction): Promise<Transaction> => {
        // Fetch old transaction to reverse balance
        const tRef = getScopedDoc('transactions', t.id);
        const oldDoc = await getDoc(tRef);
        const oldT = oldDoc.data();

        const data = {
            date: t.date, 
            type: t.type, 
            amount: t.amount, 
            description: t.description,
            related_id: t.relatedId || null, 
            bank_account_id: t.bankAccountId || null
        };
        await updateDoc(tRef, cleanFirestoreData(data));

        // Sync Balances
        if (oldT && oldT.bank_account_id) {
            await bankAccountService.syncBalance(oldT.bank_account_id, -oldT.amount);
        }
        if (t.bankAccountId) {
            await bankAccountService.syncBalance(t.bankAccountId, t.amount);
        }

        return t;
    },
    clearManualTransactions: async (): Promise<void> => {
        // Remove transações sem related_id (manuais)
        const q = query(getScopedCollection('transactions'), where('related_id', '==', null));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach(d => batch.delete(d.ref));
        await batch.commit();
    },

    // --- ACCOUNT ENTRIES ---
    getFinancials: async (): Promise<AccountEntry[]> => {
        const q = query(getScopedCollection('account_entries'), orderBy('dueDate', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AccountEntry));
    },
    addAccountEntry: async (entry: Omit<AccountEntry, 'id'>): Promise<AccountEntry> => {
        const data = {
            type: entry.type, 
            description: entry.description,
            value: entry.value, 
            due_date: entry.dueDate, 
            is_paid: entry.isPaid, 
            related_id: entry.relatedId || null,
        };
        const docRef = await addDoc(getScopedCollection('account_entries'), cleanFirestoreData(data));
        return { ...entry, id: docRef.id };
    },
    deleteAccountEntry: async (id: string): Promise<void> => {
        await deleteDoc(getScopedDoc('account_entries', id));
    },

    // --- AGENDA ---
    getTasks: async (): Promise<AgendaTask[]> => {
        const q = query(getScopedCollection('agenda_tasks'), orderBy('date'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(tDoc => ({ id: tDoc.id, ...tDoc.data() } as AgendaTask));
    },
    addTask: async (task: Partial<AgendaTask>): Promise<AgendaTask> => {
        const docRef = await addDoc(getScopedCollection('agenda_tasks'), cleanFirestoreData(task));
        return { id: docRef.id, ...task } as AgendaTask;
    },
    updateTask: async (task: AgendaTask): Promise<AgendaTask> => {
        const { id, ...data } = task;
        await updateDoc(getScopedDoc('agenda_tasks', id), cleanFirestoreData(data));
        return task;
    },
    deleteTransaction: async (id: string): Promise<void> => {
        await deleteDoc(getScopedDoc('transactions', id));
    },

    // --- NOTAS ---
    getNotes: async (): Promise<AppNote[]> => {
        const q = query(getScopedCollection('app_notes'), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(nDoc => ({ id: nDoc.id, ...nDoc.data() } as AppNote));
    },
    addNote: async (note: Partial<AppNote>): Promise<AppNote> => {
        const docRef = await addDoc(getScopedCollection('app_notes'), cleanFirestoreData(note));
        return { id: docRef.id, ...note } as AppNote;
    },
    updateNote: async (note: AppNote): Promise<AppNote> => {
        const { id, ...data } = note;
        await updateDoc(getScopedDoc('app_notes', id), cleanFirestoreData(data));
        return note;
    },
    deleteNote: async (id: string): Promise<void> => {
        await deleteDoc(getScopedDoc('app_notes', id));
    },
};
