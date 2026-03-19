// services/financeService.ts
import { db } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, where, writeBatch } from 'firebase/firestore';
import { Transaction, AccountEntry, AgendaTask, AppNote } from '../types';
import { bankAccountService } from './bankAccountService';
import { cleanFirestoreData } from '../lib/utils';

export const financeService = {
    // --- TRANSAÇÕES (CAIXA) ---
    getTransactions: async (): Promise<Transaction[]> => {
        const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(t => {
            const data = t.data();
            return {
                id: t.id, 
                date: data.date, 
                type: data.type,
                amount: data.amount, 
                description: data.description, 
                relatedId: data.related_id,
                bankAccountId: data.bank_account_id,
            };
        });
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
        const docRef = await addDoc(collection(db, 'transactions'), cleanFirestoreData(data));
        
        // Sync Balance
        if (t.bankAccountId) {
            await bankAccountService.syncBalance(t.bankAccountId, t.amount);
        }

        return { ...t, id: docRef.id };
    },
    updateTransaction: async (t: Transaction): Promise<Transaction> => {
        // Fetch old transaction to reverse balance
        const oldDoc = await getDoc(doc(db, 'transactions', t.id));
        const oldT = oldDoc.data();

        const data = {
            date: t.date, 
            type: t.type, 
            amount: t.amount, 
            description: t.description,
            related_id: t.relatedId || null, 
            bank_account_id: t.bankAccountId || null
        };
        await updateDoc(doc(db, 'transactions', t.id), cleanFirestoreData(data));

        // Sync Balances
        if (oldT && oldT.bank_account_id) {
            await bankAccountService.syncBalance(oldT.bank_account_id, -oldT.amount);
        }
        if (t.bankAccountId) {
            await bankAccountService.syncBalance(t.bankAccountId, t.amount);
        }

        return t;
    },
    deleteTransaction: async (id: string): Promise<void> => {
        // Fetch before delete to reverse balance
        const oldDoc = await getDoc(doc(db, 'transactions', id));
        const t = oldDoc.data();

        await deleteDoc(doc(db, 'transactions', id));

        // Sync Balance
        if (t && t.bank_account_id) {
            await bankAccountService.syncBalance(t.bank_account_id, -t.amount);
        }
    },
    clearManualTransactions: async (): Promise<void> => {
        // Remove transações sem related_id (manuais)
        const q = query(collection(db, 'transactions'), where('related_id', '==', null));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach(d => batch.delete(d.ref));
        await batch.commit();
    },

    // --- ACCOUNT ENTRIES ---
    getFinancials: async (): Promise<AccountEntry[]> => {
        const q = query(collection(db, 'account_entries'), orderBy('due_date'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(aDoc => {
            const a = aDoc.data();
            return {
                id: aDoc.id, 
                type: a.type, 
                description: a.description,
                value: a.value, 
                dueDate: a.due_date, 
                isPaid: a.is_paid, 
                relatedId: a.related_id,
            };
        });
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
        const docRef = await addDoc(collection(db, 'account_entries'), cleanFirestoreData(data));
        return { ...entry, id: docRef.id };
    },
    deleteAccountEntry: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'account_entries', id));
    },

    // --- AGENDA ---
    getTasks: async (): Promise<AgendaTask[]> => {
        const q = query(collection(db, 'agenda_tasks'), orderBy('date'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(tDoc => {
            const t = tDoc.data();
            return {
                id: tDoc.id, 
                date: t.date, 
                hour: t.hour, 
                title: t.title, 
                completed: t.completed,
            };
        });
    },
    addTask: async (task: Omit<AgendaTask, 'id'>): Promise<AgendaTask> => {
        const docRef = await addDoc(collection(db, 'agenda_tasks'), cleanFirestoreData(task));
        return { ...task, id: docRef.id };
    },
    updateTask: async (task: AgendaTask): Promise<AgendaTask> => {
        const { id, ...data } = task;
        await updateDoc(doc(db, 'agenda_tasks', id), cleanFirestoreData(data));
        return task;
    },
    deleteTask: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'agenda_tasks', id));
    },

    // --- NOTAS ---
    getNotes: async (): Promise<AppNote[]> => {
        const q = query(collection(db, 'app_notes'), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(nDoc => {
            const n = nDoc.data();
            return {
                id: nDoc.id, 
                title: n.title, 
                content: n.content, 
                color: n.color, 
                date: n.date,
            };
        });
    },
    addNote: async (note: Omit<AppNote, 'id'>): Promise<AppNote> => {
        const docRef = await addDoc(collection(db, 'app_notes'), cleanFirestoreData(note));
        return { ...note, id: docRef.id };
    },
    updateNote: async (note: AppNote): Promise<AppNote> => {
        const { id, ...data } = note;
        await updateDoc(doc(db, 'app_notes', id), cleanFirestoreData(data));
        return note;
    },
    deleteNote: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'app_notes', id));
    },
};
