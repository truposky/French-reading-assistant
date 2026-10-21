import type { Note } from './storage';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportNotes(notes: Note[], bookTitle: string) {
  const columns = ['Página', 'Texto francés', 'Traducción', 'Anotación', 'Fecha'];
  const escape = (text: string) => `"${text.replace(/"/g, '""')}"`;
  const rows = notes.map(n => [String(n.page), n.quote, n.translation, n.comment, new Date(n.createdAt).toISOString()].map(escape).join(','));
  const csv = '\uFEFF' + [columns.map(escape).join(','), ...rows].join('\r\n');
  const safeName = bookTitle.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeName}-vocabulario.csv`);
}
