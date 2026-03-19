// services/bankAccountService.ts
import { db } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, increment, writeBatch } from 'firebase/firestore';
import { BankAccount, AccountTransfer } from '../types';

export const bankAccountService = {
    async getAccounts(): Promise<BankAccount[]> {
        const q = query(collection(db, 'bank_accounts'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount));
    },

    async createAccount(name: string, initialBalance: number = 0): Promise<BankAccount> {
        const docRef = await addDoc(collection(db, 'bank_accounts'), { name, balance: initialBalance });
        return { id: docRef.id, name, balance: initialBalance };
    },

    async updateAccount(id: string, updates: Partial<BankAccount>): Promise<BankAccount> {
        await updateDoc(doc(db, 'bank_accounts', id), updates);
        const updatedDoc = await getDoc(doc(db, 'bank_accounts', id));
        return { id: updatedDoc.id, ...updatedDoc.data() } as BankAccount;
    },

    async deleteAccount(id: string): Promise<void> {
        await deleteDoc(doc(db, 'bank_accounts', id));
    },

    async transfer(transfer: Omit<AccountTransfer, 'id' | 'created_at'>): Promise<AccountTransfer> {
        const batch = writeBatch(db);
        
        // 1. Create transfer record
        const transferRef = doc(collection(db, 'account_transfers'));
        const transferData = {
            date: transfer.date,
            from_account_id: transfer.fromAccountId || null,
            to_account_id: transfer.toAccountId || null,
            amount: transfer.amount,
            description: transfer.description,
            created_at: new Date().toISOString()
        };
        batch.set(transferRef, transferData);

        // 2. Update 'from' account balance
        if (transfer.fromAccountId) {
            const fromRef = doc(db, 'bank_accounts', transfer.fromAccountId);
            batch.update(fromRef, { balance: increment(-transfer.amount) });
        }

        // 3. Update 'to' account balance
        if (transfer.toAccountId) {
            const toRef = doc(db, 'bank_accounts', transfer.toAccountId);
            batch.update(toRef, { balance: increment(transfer.amount) });
        }

        await batch.commit();

        return {
            id: transferRef.id,
            date: transferData.date,
            fromAccountId: transferData.from_account_id,
            toAccountId: transferData.to_account_id,
            amount: transferData.amount,
            description: transferData.description,
            created_at: transferData.created_at
        };
    },

    async adjustBalance(accountId: string, newBalance: number): Promise<BankAccount> {
        await updateDoc(doc(db, 'bank_accounts', accountId), { balance: newBalance });
        const updatedDoc = await getDoc(doc(db, 'bank_accounts', accountId));
        return { id: updatedDoc.id, ...updatedDoc.data() } as BankAccount;
    },

    async syncBalance(accountId: string | null, delta: number): Promise<void> {
        if (!accountId || delta === 0) return;
        try {
            const ref = doc(db, 'bank_accounts', accountId);
            await updateDoc(ref, { balance: increment(delta) });
        } catch (err) {
            console.error('CRITICAL: Failed to sync bank account balance:', err);
            throw new Error('Falha ao atualizar o saldo bancário. Por favor, verifique sua conexão ou permissões do banco de dados.');
        }
    }
};
