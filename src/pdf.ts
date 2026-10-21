import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function openPdf(bytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  // PDF.js transfers its ArrayBuffer to a worker. Always clone the IndexedDB copy.
  return getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
}

export async function getReadablePage(document: PDFDocumentProxy, pageNumber: number): Promise<string[]> {
  const page = await document.getPage(pageNumber);
  const content = await page.getTextContent();
  const fragments = content.items.filter(item => 'str' in item);
  const lines: string[] = [];
  let line = '';
  for (const item of fragments) {
    // The embedded text of ebook PDFs often places every text line in a separate item.
    const str = item.str.replace(/\u0000/g, '').trim();
    if (!str) continue;
    const newLine = Boolean(item.hasEOL) || str.endsWith('.') || str.endsWith('!') || str.endsWith('?');
    if (line && /[-‐‑]$/.test(line)) {
      line = line.slice(0, -1) + str;
    } else {
      line += (line ? ' ' : '') + str;
    }
    if (newLine) {
      lines.push(line);
      line = '';
    }
  }
  if (line) lines.push(line);
  // Treat line endings from PDF.js as physical lines rather than paragraphs.
  // Group consecutive short lines to preserve readable prose.
  const paragraphs: string[] = [];
  let paragraph = '';
  for (const segment of lines) {
    if (!paragraph) paragraph = segment;
    else if (/[-‐‑]$/.test(paragraph)) paragraph = paragraph.slice(0, -1) + segment;
    else paragraph += ' ' + segment;
    if (/[.!?…][”»"']?$/.test(segment) && paragraph.length > 150) {
      paragraphs.push(paragraph);
      paragraph = '';
    }
  }
  if (paragraph) paragraphs.push(paragraph);
  return paragraphs.length ? paragraphs : ['Esta página no contiene texto extraíble.'];
}
