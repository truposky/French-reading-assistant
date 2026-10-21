import { openDB, type DBSchema } from 'idb';

export type StoredBook = {
  id: string;
  name: string;
  data: ArrayBuffer;
  pages: number;
  importedAt: number;
};

export type Note = {
  id: string;
  bookId: string;
  page: number;
  quote: string;
  translation: string;
  comment: string;
  createdAt: number;
};

interface ReaderDB extends DBSchema {
  books: { key: string; value: StoredBook };
  notes: { key: string; value: Note; indexes: { 'by-book': string } };
  settings: { key: string; value: { key: string; page: number } };
}

const database = openDB<ReaderDB>('margen-reading', 1, {
  upgrade(db) {
    db.createObjectStore('books', { keyPath: 'id' });
    const notes = db.createObjectStore('notes', { keyPath: 'id' });
    notes.createIndex('by-book', 'bookId');
    db.createObjectStore('settings', { keyPath: 'key' });
  },
});

export const listBooks = async () => (await database).getAll('books');
export const loadBook = async (id: string) => (await database).get('books', id);
export const saveBook = async (book: StoredBook) => (await database).put('books', book);
export const deleteBook = async (id: string) => {
  const db = await database;
  const notes = await db.getAllFromIndex('notes', 'by-book', id);
  const tx = db.transaction(['books', 'notes', 'settings'], 'readwrite');
  await Promise.all([
    tx.objectStore('books').delete(id),
    tx.objectStore('settings').delete(`progress:${id}`),
    ...notes.map(note => tx.objectStore('notes').delete(note.id)),
  ]);
  await tx.done;
};
export const listNotes = async (bookId: string) => (await database).getAllFromIndex('notes', 'by-book', bookId);
export const saveNote = async (note: Note) => (await database).put('notes', note);
export const deleteNote = async (id: string) => (await database).delete('notes', id);
export const getProgress = async (id: string) => (await database).get('settings', `progress:${id}`);
export const saveProgress = async (id: string, page: number) => (await database).put('settings', { key: `progress:${id}`, page });
