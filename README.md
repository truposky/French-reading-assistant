# Margen — French Reading Assistant

A mobile-friendly French reading app: import a PDF, tap a word or select a phrase to see the Spanish translation, listen in French, and save your own notes and vocabulary **without leaving the book**.

## Stack

- React 19, TypeScript, Vite
- PDF.js for local PDF text extraction
- IndexedDB (`idb`) to retain imported PDFs, reading progress and notes on the device
- MyMemory for online French → Spanish translation, plus an offline glossary
- Browser `speechSynthesis` for French pronunciation

## Quick start

```bash
npm install
npm run dev
```

Open the development URL printed by Vite (normally http://localhost:5173).

Production build:

```bash
npm run build
npm run preview
```

## Features (MVP)

1. Import PDF files (up to 50 MB) from your device.
2. Read selectable, reflowed text one PDF page at a time.
3. Tap a French word or select a phrase for an integrated translation.
4. Listen to a word/phrase using French text-to-speech (if available in the browser).
5. Save highlighted passages with an optional translation and personal note.
6. Export notes and vocabulary as CSV.
7. Resume at the last page. Books, notes and reading progress are stored in IndexedDB on your browser.

## Privacy and copyright

**Do not commit copyrighted books or private reading data.** The app does not bundle the uploaded book; import your own PDF in the browser. Books and notes remain on the device in IndexedDB. Selected text **may be sent to MyMemory** to request a translation; no full PDF is sent. Public translation endpoints have quotas and require an internet connection. The small integrated glossary works offline. There is no login or server-side storage.

Clearing site data or changing browsers can remove your library and notes. Export your vocabulary regularly. No cloud sync or AI grammar service is included in this MVP.

## Limitations

- PDFs must contain selectable text; scanned image PDFs need OCR (not included).
- Reflowed text prioritizes language learning, not preservation of the PDF's original page design or illustrations.
- Public translation quality and availability are outside this app's control. Text longer than 450 characters must be selected in smaller fragments.
- Install the application through the browser **Add to Home Screen** option after hosting it; the service worker caches the app shell and same-origin assets for offline use after the first successful load. Offline translation works only for the built-in glossary.
- PDF imports remain local to each browser and device.

## Development roadmap

- Dedicated sentence-level grammar explanations with a user-selected AI provider
- Better paragraph extraction and selectable PDF facsimile view
- Bookmarks and spaced-repetition flashcards
- Export/import of personal reading data for backups
- Automated tests and larger offline dictionaries

## License

The source code is available under the MIT License; this license does **not** apply to books imported by users.
