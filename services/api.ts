import { db, auth } from '../lib/firebase';
import { collection, CollectionReference, DocumentData, doc, DocumentReference } from 'firebase/firestore';

export { db };

/**
 * Retorna o caminho da coleção prefixado pelo UID do usuário atual.
 * Se não houver usuário, retorna o caminho original (raiz).
 */
export const getUserPath = (collectionName: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return collectionName;
    return `users/${uid}/${collectionName}`;
};

/**
 * Atalho para obter uma referência de coleção escopada pelo usuário.
 */
export const getScopedCollection = (name: string): CollectionReference<DocumentData> => {
    return collection(db, getUserPath(name));
};

/**
 * Atalho para obter uma referência de documento escopada pelo usuário.
 */
export const getScopedDoc = (collectionName: string, docId: string): DocumentReference<DocumentData> => {
    return doc(db, getUserPath(collectionName), docId);
};
