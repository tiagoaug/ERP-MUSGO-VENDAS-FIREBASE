// services/personalFinanceService.ts
import { db } from './api';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { FamilyMember, PersonalCategory, PersonalBudget, PersonalTransaction } from '../types';

export const personalFinanceService = {
    // --- Family Members ---
    getFamilyMembers: async (): Promise<FamilyMember[]> => {
        const q = query(collection(db, 'family_members'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FamilyMember));
    },

    createFamilyMember: async (member: Omit<FamilyMember, 'id'>): Promise<FamilyMember> => {
        const docRef = await addDoc(collection(db, 'family_members'), member);
        return { id: docRef.id, ...member } as FamilyMember;
    },

    updateFamilyMember: async (member: FamilyMember): Promise<FamilyMember> => {
        const { id, ...data } = member;
        await updateDoc(doc(db, 'family_members', id), data);
        return member;
    },

    deleteFamilyMember: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'family_members', id));
    },

    // --- Personal Categories ---
    getCategories: async (): Promise<PersonalCategory[]> => {
        const q = query(collection(db, 'personal_categories'), orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data.name,
                type: data.type,
                parentId: data.parent_id
            };
        });
    },

    createCategory: async (category: Omit<PersonalCategory, 'id'>): Promise<PersonalCategory> => {
        const data = {
            name: category.name,
            type: category.type,
            parent_id: category.parentId || null
        };
        const docRef = await addDoc(collection(db, 'personal_categories'), data);
        return {
            id: docRef.id,
            name: data.name,
            type: data.type,
            parentId: data.parent_id
        };
    },

    updateCategory: async (category: PersonalCategory): Promise<PersonalCategory> => {
        const data = {
            name: category.name,
            type: category.type,
            parent_id: category.parentId || null
        };
        await updateDoc(doc(db, 'personal_categories', category.id), data);
        return {
            id: category.id,
            name: data.name,
            type: data.type,
            parentId: data.parent_id
        };
    },

    deleteCategory: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'personal_categories', id));
    },

    // --- Personal Budgets ---
    getBudgets: async (): Promise<PersonalBudget[]> => {
        const snapshot = await getDocs(collection(db, 'personal_budgets'));
        return snapshot.docs.map(d => {
            const b = d.data();
            return {
                id: d.id,
                categoryId: b.category_id,
                memberId: b.member_id,
                amount: b.amount,
                month: b.month
            };
        });
    },

    createBudget: async (budget: Omit<PersonalBudget, 'id'>): Promise<PersonalBudget> => {
        const data = {
            category_id: budget.categoryId,
            member_id: budget.memberId || null,
            amount: budget.amount,
            month: budget.month
        };
        const docRef = await addDoc(collection(db, 'personal_budgets'), data);
        return {
            id: docRef.id,
            categoryId: data.category_id,
            memberId: data.member_id,
            amount: data.amount,
            month: data.month
        };
    },

    updateBudget: async (budget: PersonalBudget): Promise<PersonalBudget> => {
        const data = {
            category_id: budget.categoryId,
            member_id: budget.memberId || null,
            amount: budget.amount,
            month: budget.month
        };
        await updateDoc(doc(db, 'personal_budgets', budget.id), data);
        return {
            id: budget.id,
            categoryId: data.category_id,
            memberId: data.member_id,
            amount: data.amount,
            month: data.month
        };
    },

    deleteBudget: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'personal_budgets', id));
    },

    // --- Transactions ---
    getTransactions: async (): Promise<PersonalTransaction[]> => {
        const q = query(collection(db, 'personal_transactions'), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const t = d.data();
            return {
                id: d.id,
                date: t.date,
                type: t.type,
                amount: t.amount,
                description: t.description,
                categoryId: t.category_id,
                memberId: t.member_id,
                isPaid: t.is_paid,
                businessTransactionId: t.business_transaction_id,
                paymentMethod: t.payment_method,
                bank_account_id: t.bank_account_id
            };
        });
    },

    createTransaction: async (t: Omit<PersonalTransaction, 'id'>): Promise<PersonalTransaction> => {
        const data = {
            date: t.date,
            type: t.type,
            amount: t.amount,
            description: t.description,
            category_id: t.categoryId || null,
            member_id: t.memberId || null,
            is_paid: t.isPaid,
            business_transaction_id: t.businessTransactionId || null,
            payment_method: t.paymentMethod || null,
            bank_account_id: t.bank_account_id || null
        };
        const docRef = await addDoc(collection(db, 'personal_transactions'), data);
        return {
            id: docRef.id,
            date: data.date,
            type: data.type,
            amount: data.amount,
            description: data.description,
            categoryId: data.category_id,
            memberId: data.member_id,
            isPaid: data.is_paid,
            businessTransactionId: data.business_transaction_id,
            paymentMethod: data.payment_method,
            bank_account_id: data.bank_account_id
        };
    },

    updateTransaction: async (t: PersonalTransaction): Promise<PersonalTransaction> => {
        const data = {
            date: t.date,
            type: t.type,
            amount: t.amount,
            description: t.description,
            category_id: t.categoryId || null,
            member_id: t.memberId || null,
            is_paid: t.isPaid,
            business_transaction_id: t.businessTransactionId || null,
            payment_method: t.paymentMethod || null,
            bank_account_id: t.bank_account_id || null
        };
        await updateDoc(doc(db, 'personal_transactions', t.id), data);
        return {
            id: t.id,
            date: data.date,
            type: data.type,
            amount: data.amount,
            description: data.description,
            categoryId: data.category_id,
            memberId: data.member_id,
            isPaid: data.is_paid,
            businessTransactionId: data.business_transaction_id,
            paymentMethod: data.payment_method,
            bank_account_id: data.bank_account_id
        };
    },

    deleteTransaction: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, 'personal_transactions', id));
    }
};
