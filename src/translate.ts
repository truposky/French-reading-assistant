export const glossary: Record<string, { es: string; tip: string }> = {
  'chouette': { es: 'genial, estupendo', tip: 'En francés familiar, «chouette» es un adjetivo de valoración positiva; también significa «lechuza» como sustantivo.' },
  'drôlement': { es: 'muchísimo, muy', tip: 'En el lenguaje coloquial intensifica un adjetivo: «drôlement gentil» = «muy simpático».' },
  'copain': { es: 'amigo, compañero', tip: '«Copain» es informal; en femenino, «copine».' },
  'copains': { es: 'amigos, compañeros', tip: 'Plural de «copain».' },
  'maîtresse': { es: 'maestra, profesora', tip: 'En el contexto escolar de la novela es la profesora de primaria.' },
  'récréation': { es: 'recreo', tip: 'Se abrevia muy a menudo como «récré».' },
  'bouillon': { es: 'caldo', tip: 'También es el apodo de un vigilante en «Le Petit Nicolas».' },
  'bêtise': { es: 'tontería, travesura', tip: '«Faire des bêtises» significa hacer travesuras.' },
  'bêtises': { es: 'tonterías, travesuras', tip: 'Expresión útil: «faire des bêtises» = hacer travesuras.' },
  'rigoler': { es: 'reírse, pasarlo bien', tip: 'Verbo coloquial. «On a bien rigolé» significa «Nos lo pasamos muy bien».' },
  'gronder': { es: 'regañar', tip: '«Se faire gronder» significa recibir una regañina.' },
  'carnet': { es: 'cuaderno, boletín', tip: 'En la escuela del libro, «carnet» puede referirse al boletín de notas.' },
  'goûter': { es: 'merendar; merienda', tip: 'Como verbo «goûter» es probar o merendar; como sustantivo, «le goûter» es la merienda.' },
  'cour': { es: 'patio', tip: '«La cour de récréation» es el patio del recreo.' },
  'quand': { es: 'cuando', tip: 'Conjunción o adverbio interrogativo. «Quand est-ce que…?» = «¿Cuándo…?»' },
  'parce': { es: 'porque (con «que»)', tip: 'Se usa como «parce que»; ante vocal se convierte en «parce qu’».' },
  'tellement': { es: 'tan, tanto', tip: 'Intensificador habitual: «tellement content» = «tan contento».' },
  'surveillant': { es: 'vigilante, supervisor', tip: 'En un colegio se refiere a quien supervisa a los alumnos.' },
};

function keyOf(text: string) {
  return text.toLocaleLowerCase('fr').normalize('NFC').replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

export function localDefinition(text: string) {
  return glossary[keyOf(text)];
}

export async function translateFrench(text: string): Promise<{ translated: string; source: string }> {
  const normalized = text.trim();
  const local = localDefinition(normalized);
  if (local) return { translated: local.es, source: 'Glosario integrado' };
  if (!normalized || normalized.length > 450) throw new Error('Selecciona un fragmento de hasta 450 caracteres.');

  const endpoint = new URL('https://api.mymemory.translated.net/get');
  endpoint.searchParams.set('q', normalized);
  endpoint.searchParams.set('langpair', 'fr|es');
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Servicio de traducción no disponible (${response.status}).`);
  const data: {
    responseStatus?: number;
    responseData?: { translatedText?: string };
  } = await response.json();
  if (data.responseStatus !== 200 || !data.responseData?.translatedText)
    throw new Error('El traductor no pudo resolver este fragmento.');
  return { translated: data.responseData.translatedText, source: 'MyMemory · traducción automática' };
}
