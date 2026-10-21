import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type CSSProperties } from 'react';
import {
  AlignLeft, ArrowLeft, ArrowRight, BookMarked, BookOpen, BookmarkPlus,
  Check, ChevronDown, Download, FileText, Globe2, Headphones, Highlighter,
  Info, Languages, LoaderCircle, Menu, MessageSquareText, Plus,
  Trash2, UploadCloud, Volume2, X,
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getReadablePage, openPdf } from './pdf';
import {
  deleteBook, deleteNote, getProgress, listBooks, listNotes, loadBook, saveBook,
  saveNote, saveProgress, type Note, type StoredBook,
} from './storage';
import { exportNotes } from './export';
import { localDefinition, translateFrench } from './translate';

type Translation = { state: 'idle' | 'loading' | 'success' | 'error'; text: string; source: string };
const idleTranslation: Translation = { state: 'idle', text: '', source: '' };
const chunks = /([\p{L}\p{M}]+(?:[’'-][\p{L}\p{M}]+)*|\s+|[^\p{L}\p{M}\s]+)/gu;
const MAX_QUOTE = 450;

function WordParagraph({ paragraph, onWord }: { paragraph: string; onWord: (text: string) => void }) {
  const tokens = useMemo(() => paragraph.match(chunks) ?? [paragraph], [paragraph]);
  return <p>{tokens.map((token, i) => (/^[\p{L}\p{M}]/u.test(token)
    ? <span className="word" key={i} onClick={() => {
      // Don't overwrite a selected phrase when the pointer click follows text selection.
      if (!window.getSelection()?.toString().trim()) onWord(token);
    }}>{token}</span>
    : <span key={i}>{token}</span>))}</p>;
}

export default function App() {
  const [books, setBooks] = useState<StoredBook[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [quote, setQuote] = useState('');
  const [translation, setTranslation] = useState<Translation>(idleTranslation);
  const [retryTranslation, setRetryTranslation] = useState(0);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [loadingBook, setLoadingBook] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fontSize, setFontSize] = useState(19);
  const [compactMode, setCompactMode] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const pageRequest = useRef(0);
  const translationRequest = useRef(0);
  const selectedRef = useRef('');
  const book = books.find(b => b.id === activeId);

  const refreshBooks = useCallback(async () => setBooks((await listBooks()).sort((a, b) => b.importedAt - a.importedAt)), []);
  const refreshNotes = useCallback(async (id: string) => setNotes((await listNotes(id)).sort((a, b) => b.createdAt - a.createdAt)), []);

  useEffect(() => {
    let live = true;
    listBooks().then(found => {
      if (!live) return;
      setBooks(found.sort((a, b) => b.importedAt - a.importedAt));
      const remembered = localStorage.getItem('margen-active-book');
      const preferred = found.find(b => b.id === remembered) ?? found[0];
      if (preferred) setActiveId(preferred.id);
    }).catch(() => setStatus('No se ha podido abrir el almacenamiento del navegador.'));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const previous = documentRef.current;
    documentRef.current = null;
    if (previous) void previous.destroy().catch(() => {});
    if (!activeId) {
      setParagraphs([]);
      setTotalPages(0);
      setNotes([]);
      return;
    }
    setLoadingBook(true);
    setStatus('');
    localStorage.setItem('margen-active-book', activeId);
    (async () => {
      const stored = await loadBook(activeId);
      if (!stored) throw new Error('No se encuentra el libro guardado.');
      const opened = await openPdf(stored.data);
      if (cancelled) { await opened.destroy(); return; }
      documentRef.current = opened;
      setTotalPages(opened.numPages);
      await refreshNotes(activeId);
      const progress = await getProgress(activeId);
      setPage(Math.min(opened.numPages, Math.max(1, progress?.page ?? 1)));
      setParagraphs([]);
      setQuote('');
      setComment('');
      setTranslation(idleTranslation);
    })().catch(err => { if (!cancelled) setStatus(`No se pudo abrir el PDF: ${String(err)}`); })
      .finally(() => { if (!cancelled) setLoadingBook(false); });
    return () => { cancelled = true; };
  }, [activeId, refreshNotes]);

  useEffect(() => {
    const doc = documentRef.current;
    if (!doc || !activeId || page < 1 || page > doc.numPages) return;
    const currentRequest = ++pageRequest.current;
    setLoadingPage(true);
    getReadablePage(doc, page).then(text => {
      if (currentRequest === pageRequest.current) {
        setParagraphs(text);
        setLoadingPage(false);
      }
    }).catch(() => {
      if (currentRequest === pageRequest.current) {
        setStatus('No se pudo extraer el texto de esta página.');
        setParagraphs([]);
        setLoadingPage(false);
      }
    });
    void saveProgress(activeId, page);
    setQuote('');
    setTranslation(idleTranslation);
  }, [activeId, totalPages, page]);

  useEffect(() => {
    const currentRequest = ++translationRequest.current;
    selectedRef.current = quote;
    if (!quote) { setTranslation(idleTranslation); return; }
    if (quote.length > MAX_QUOTE) {
      setTranslation({ state: 'error', text: `Selecciona un máximo de ${MAX_QUOTE} caracteres.`, source: '' });
      return;
    }
    setTranslation({ state: 'loading', text: '', source: '' });
    translateFrench(quote).then(result => {
      if (currentRequest === translationRequest.current) setTranslation({ state: 'success', text: result.translated, source: result.source });
    }).catch(err => {
      if (currentRequest === translationRequest.current) setTranslation({ state: 'error', text: err instanceof Error ? err.message : 'Error de traducción.', source: '' });
    });
  }, [quote, retryTranslation]);

  const importFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { setStatus('Selecciona un archivo PDF.'); return; }
    if (file.size > 50 * 1024 * 1024) { setStatus('La primera versión admite PDF de hasta 50 MB.'); return; }
    setLoadingBook(true);
    setStatus('Comprobando PDF y guardándolo en este dispositivo…');
    try {
      const data = await file.arrayBuffer();
      const pdf = await openPdf(data);
      const pages = pdf.numPages;
      await pdf.destroy();
      const id = `${file.name}:${file.size}:${file.lastModified}`;
      await saveBook({ id, name: file.name, data, pages, importedAt: Date.now() });
      await refreshBooks();
      setStatus('');
      setActiveId(id);
      setSidebarOpen(false);
    } catch (error) { setStatus(`No se pudo importar el libro: ${String(error)}`); }
    finally { setLoadingBook(false); if (fileInput.current) fileInput.current.value = ''; }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => void importFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void importFile(event.dataTransfer.files[0]);
  };

  const chooseText = useCallback((value: string) => {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (clean && clean !== selectedRef.current) {
      selectedRef.current = clean;
      setQuote(clean);
      setComment('');
      setNotesOpen(false);
    }
  }, []);
  const captureSelection = () => {
    // Mobile selection handles become available after the pointer-up event.
    window.setTimeout(() => {
      const selected = window.getSelection()?.toString();
      if (selected?.trim()) chooseText(selected);
    }, 90);
  };

  const saveCurrentNote = async () => {
    if (!book || !quote) return;
    const newNote: Note = {
      id: crypto.randomUUID(), bookId: book.id, page, quote,
      translation: translation.state === 'success' ? translation.text : '',
      comment: comment.trim(), createdAt: Date.now(),
    };
    await saveNote(newNote);
    await refreshNotes(book.id);
    setComment('');
    setStatus('Fragmento guardado en tus notas.');
  };

  const removeNote = async (id: string) => {
    if (!book) return;
    await deleteNote(id);
    await refreshNotes(book.id);
  };

  const removeBook = async (id: string) => {
    if (!window.confirm('¿Eliminar este libro y todas sus notas guardadas en este navegador?')) return;
    await deleteBook(id);
    await refreshBooks();
    if (activeId === id) {
      setActiveId('');
      localStorage.removeItem('margen-active-book');
    }
  };

  const sayFrench = (text: string) => {
    if (!('speechSynthesis' in window)) { setStatus('La síntesis de voz no está disponible en este navegador.'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 450));
    utterance.lang = 'fr-FR';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  const definition = useMemo(() => localDefinition(quote), [quote]);
  const progressPercent = totalPages ? Math.round(page * 100 / totalPages) : 0;
  const noteCountOnPage = notes.filter(n => n.page === page).length;

  return (
    <div className="app-shell" onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }} onDrop={onDrop}>
      <input className="visually-hidden" ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={onInputChange} />
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Biblioteca">
        <div className="brand"><div className="brand-mark"><BookOpen size={21} strokeWidth={2.1} /></div><div><strong>margen<span>.</span></strong><small>LEE · DESCUBRE · APRENDE</small></div><button aria-label="Cerrar menú" className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={20} /></button></div>
        <div className="sidebar-label">TU BIBLIOTECA</div>
        <button className="import-sidebar" onClick={() => fileInput.current?.click()}><Plus size={17} /> Añadir un libro</button>
        <div className="book-list">
          {books.length === 0 && <p className="empty-library">Tus libros aparecerán aquí cuando importes un PDF.</p>}
          {books.map(item => <div className={`library-item ${activeId === item.id ? 'is-active' : ''}`} key={item.id}>
            <button onClick={() => { setActiveId(item.id); setSidebarOpen(false); }} title={item.name} className="library-book"><span className="book-icon"><BookOpen size={18} /></span><span className="book-details"><strong>{item.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').slice(0, 56)}</strong><small>{item.pages} páginas · Francés</small></span></button>
            <button className="delete-book" aria-label={`Eliminar ${item.name}`} title="Eliminar libro y notas" onClick={() => void removeBook(item.id)}><Trash2 size={15}/></button>
          </div>)}
        </div>
        <div className="side-bottom"><div className="tip-icon"><Globe2 size={17} /></div><div><strong>Aprende a tu ritmo</strong><p>Toca una palabra o selecciona una frase para entenderla sin dejar de leer.</p></div></div>
      </aside>
      {sidebarOpen && <button className="scrim" aria-label="Cerrar biblioteca" onClick={() => setSidebarOpen(false)} />}
      {isDragging && <div className="drop-overlay"><UploadCloud size={38} /><strong>Suelta el PDF para añadirlo</strong></div>}

      <div className="workspace">
        <header className="topbar">
          <div className="top-left"><button className="icon-button show-mobile" onClick={() => setSidebarOpen(true)} aria-label="Abrir biblioteca"><Menu size={21}/></button><span className="breadcrumb">Biblioteca</span><span className="breadcrumb-separator">/</span><span className="current-book">{book ? book.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ') : 'Tu espacio de lectura'}</span></div>
          <div className="top-actions"><span className="language-pill"><span className="flag">FR</span><ArrowRight size={13}/><span>ES</span></span><button className={`top-notes ${notesOpen ? 'active' : ''}`} onClick={() => { setNotesOpen(prev => !prev); setQuote(''); }}><BookMarked size={17}/><span>Mis notas</span>{notes.length > 0 && <span className="note-counter">{notes.length}</span>}</button></div>
        </header>
        {status && <div className="status-message" role="status"><Info size={16} />{status}<button onClick={() => setStatus('')} aria-label="Cerrar mensaje"><X size={14}/></button></div>}
        {!book ? (
          <main className="welcome"><div className="welcome-ornament">✦&nbsp; LECTURA INTELIGENTE &nbsp;✦</div><div className="welcome-book"><BookOpen size={66} strokeWidth={1.1}/></div><h1>Un libro. Dos idiomas.<br/><em>Infinitas posibilidades.</em></h1><p>Lee tus historias favoritas en francés. Descubre el significado de cada palabra, escucha su pronunciación y guarda lo que aprendas.</p><button className="primary-btn" onClick={() => fileInput.current?.click()} disabled={loadingBook}>{loadingBook ? <LoaderCircle className="spin" size={19}/> : <UploadCloud size={19}/>} Importar mi primer PDF</button><div className="welcome-foot"><span><Highlighter size={16}/> Selecciona</span><span><Languages size={16}/> Traduce</span><span><MessageSquareText size={16}/> Anota</span></div></main>
        ) : (
          <main className={`reading-layout ${quote || notesOpen ? 'has-aside' : ''}`}>
            <div className="reading-pane"><div className="reading-heading"><div className="eyebrow"><span className="tiny-line"/> UN MOMENTO PARA LEER</div><h1>{book.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/z lib org/ig, '').slice(0, 80)}</h1><div className="reader-meta"><span><BookOpen size={15}/> Página {page} de {totalPages}</span><span className="meta-dot">·</span><span><Highlighter size={15}/> Selecciona para traducir</span></div></div>
              <div className="reading-controls"><div className="control-left"><button className="small-icon" title="Reducir tamaño" aria-label="Reducir tamaño" onClick={() => setFontSize(v => Math.max(15, v - 1))}>A−</button><span className="font-value">{fontSize}px</span><button className="small-icon" title="Ampliar tamaño" aria-label="Ampliar tamaño" onClick={() => setFontSize(v => Math.min(29, v + 1))}>A+</button><span className="control-divider"/><button className="control-toggle" onClick={() => setCompactMode(v => !v)} title="Alternar espaciado"><AlignLeft size={16}/>{compactMode ? 'Compacto' : 'Cómodo'}<ChevronDown size={13}/></button></div><div className="control-right"><span className="sync-dot"/> Solo en tu dispositivo</div></div>
              <article className={`paper ${compactMode ? 'paper-compact' : ''}`} style={{ '--reader-font': `${fontSize}px` } as CSSProperties} onPointerUp={captureSelection} onKeyUp={captureSelection}>
                {loadingPage || loadingBook ? <div className="page-loading"><LoaderCircle className="spin"/><p>Abriendo la lectura…</p></div> : paragraphs.length ? paragraphs.map((p, index) => <WordParagraph key={`${page}-${index}`} paragraph={p} onWord={chooseText} />) : <div className="page-loading"><FileText/><p>No hay texto extraíble en esta página.</p></div>}
              </article>
              <div className="page-navigation"><button className="page-button" disabled={page <= 1 || loadingPage} onClick={() => setPage(p => p - 1)}><ArrowLeft size={17}/> Anterior</button><div className="page-middle"><div className="progress-track"><span style={{ width: `${progressPercent}%` }}/></div><div className="page-count">{progressPercent}% leído{noteCountOnPage > 0 ? ` · ${noteCountOnPage} notas aquí` : ''}</div></div><button className="page-button primary-page" disabled={page >= totalPages || loadingPage} onClick={() => setPage(p => p + 1)}>Siguiente <ArrowRight size={17}/></button></div>
              <div className="reading-help"><Info size={16}/><p>Un toque traduce una palabra. Para traducir una frase, mantenla pulsada y selecciónala. También puedes escuchar cómo se pronuncia.</p></div>
            </div>
            {(quote || notesOpen) && <aside className="study-pane"><div className="study-header"><div className="study-header-title"><div className="study-icon">{notesOpen ? <BookMarked size={20}/> : <Languages size={20}/>}</div><div><strong>{notesOpen ? 'Tu cuaderno' : 'Asistente de lectura'}</strong><small>{notesOpen ? `${notes.length} fragmentos guardados` : 'FRANCÉS → ESPAÑOL'}</small></div></div><button className="close-assist" aria-label="Cerrar panel" onClick={() => { setQuote(''); setNotesOpen(false); }}><X size={19}/></button></div>
              {notesOpen ? <div className="notes-area"><div className="notes-heading"><h2>Palabras que te acompañan</h2><p>Todo lo que has guardado durante tu lectura.</p></div>{notes.length === 0 ? <div className="empty-notes"><BookmarkPlus size={31}/><p>Todavía no tienes notas. Selecciona una palabra o frase y guárdala.</p></div> : <><button className="export-btn" onClick={() => exportNotes(notes, book.name)}><Download size={16}/> Exportar vocabulario (CSV)</button><div className="notes-list">{notes.map(note => <div className="note-card" key={note.id}><div className="note-top"><button onClick={() => { setPage(note.page); setNotesOpen(false); chooseText(note.quote); }}><BookOpen size={13}/> Página {note.page}</button><button className="note-delete" aria-label="Eliminar nota" onClick={() => void removeNote(note.id)}><Trash2 size={15}/></button></div><strong>{note.quote}</strong>{note.translation && <p className="note-translation">{note.translation}</p>}{note.comment && <p className="note-comment">{note.comment}</p>}</div>)}</div></>}</div>
                : <div className="translation-area"><div className="selection-label"><span>HAS SELECCIONADO</span><button aria-label="Escuchar en francés" title="Escuchar pronunciación" onClick={() => sayFrench(quote)}><Volume2 size={17}/></button></div><div className="selected-quote">{quote}</div><div className="translation-divider"/><div className="selection-label">TRADUCCIÓN</div>{translation.state === 'loading' ? <div className="translating"><LoaderCircle className="spin" size={18}/> Traduciendo…</div> : translation.state === 'success' ? <><div className="translation-result">{translation.text}</div><p className="source-line">{translation.source}</p></> : translation.state === 'error' ? <div className="translation-error">{translation.text} <button onClick={() => setRetryTranslation(n => n + 1)}>Reintentar</button></div> : null}{definition && <div className="language-tip"><div><Headphones size={16}/> CONTEXTO Y USO</div><p>{definition.tip}</p></div>}<div className="note-editor"><label htmlFor="note-comment"><MessageSquareText size={16}/> AÑADIR UNA NOTA</label><textarea id="note-comment" placeholder="Una regla gramatical, un ejemplo, una idea…" rows={3} value={comment} onChange={e => setComment(e.target.value)}/><button className="save-btn" onClick={() => void saveCurrentNote()}><BookmarkPlus size={17}/> Guardar fragmento</button></div><p className="privacy-detail"><Info size={14}/> Solo el fragmento seleccionado se envía a MyMemory si no existe en el glosario local.</p></div>}
            </aside>}
          </main>
        )}
        <footer className="footer"><span>margen<span className="footer-dot">.</span> · Tu rincón de lectura</span><span><Check size={14}/> Libros y notas guardados localmente</span></footer>
      </div>
    </div>
  );
}
