import JSZip from 'jszip';
import type { ExtractionResult, SupportedExtension } from './types';

let pdfjsConfigured = false;
async function getPdfJs() {
  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsConfigured && typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
    pdfjsConfigured = true;
  }
  return pdfjsLib;
}

const SUPPORTED_EXT_SET = new Set<SupportedExtension>([
  'docx',
  'pdf',
  'txt',
  'rtf',
  'odt',
  'doc',
  'png',
  'jpg',
  'jpeg',
  'webp',
]);

export function detectExtension(fileName: string): SupportedExtension {
  const dotIdx = fileName.lastIndexOf('.');
  if (dotIdx < 0) return 'unknown';
  const ext = fileName.slice(dotIdx + 1).toLowerCase() as SupportedExtension;
  return SUPPORTED_EXT_SET.has(ext) ? ext : 'unknown';
}

function getElementsText(node: Element): string {
  const parts: string[] = [];
  const walk = (el: Node) => {
    if (el.nodeType === 3) {
      parts.push(el.nodeValue ?? '');
      return;
    }
    if (el.nodeType !== 1) return;
    const elem = el as Element;
    const localName = elem.localName || elem.nodeName.replace(/^.*:/, '');
    if (localName === 'tab') {
      parts.push(' ');
      return;
    }
    if (localName === 'br' || localName === 'cr') {
      parts.push('\n');
      return;
    }
    for (let i = 0; i < elem.childNodes.length; i++) {
      walk(elem.childNodes[i]);
    }
  };
  walk(node);
  return parts.join('').replace(/[ \t]+/g, ' ').trim();
}

function extractXmlDocumentText(xmlText: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const body = doc.getElementsByTagNameNS('*', 'body')[0] ?? doc.documentElement;
  if (!body) return '';

  const lines: string[] = [];
  const visitBlock = (node: Element) => {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const name = child.localName || child.nodeName.replace(/^.*:/, '');
      if (name === 'p') {
        const text = getElementsText(child);
        if (text) lines.push(text);
      } else if (name === 'tbl') {
        const rows = child.getElementsByTagNameNS('*', 'tr');
        for (let r = 0; r < rows.length; r++) {
          const cells = rows[r].getElementsByTagNameNS('*', 'tc');
          const cellTexts: string[] = [];
          for (let c = 0; c < cells.length; c++) {
            const cellParagraphs = cells[c].getElementsByTagNameNS('*', 'p');
            const pLines: string[] = [];
            for (let p = 0; p < cellParagraphs.length; p++) {
              const t = getElementsText(cellParagraphs[p]);
              if (t) pLines.push(t);
            }
            if (pLines.length > 0) cellTexts.push(pLines.join(' '));
          }
          if (cellTexts.length > 0) {
            lines.push(cellTexts.join(' | '));
          }
        }
      } else {
        visitBlock(child);
      }
    }
  };

  visitBlock(body);
  return lines.join('\n');
}

/**
 * Extracts text from a .docx ArrayBuffer including headers and tables.
 */
export async function extractTextFromDocxBuffer(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const sections: string[] = [];

  const headerFiles = Object.keys(zip.files)
    .filter((name) => /^word\/header\d*\.xml$/i.test(name))
    .sort();

  for (const headerPath of headerFiles) {
    const headerXml = await zip.files[headerPath].async('string');
    const headerText = extractXmlDocumentText(headerXml);
    if (headerText) sections.push(headerText);
  }

  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('Не найден word/document.xml внутри DOCX файла.');
  }
  const docXml = await docFile.async('string');
  const docText = extractXmlDocumentText(docXml);
  if (docText) sections.push(docText);

  return sections.join('\n');
}

/**
 * Extracts text from an .odt (OpenDocument Text) ArrayBuffer.
 */
export async function extractTextFromOdtBuffer(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file('content.xml');
  if (!contentFile) {
    throw new Error('Не найден content.xml внутри ODT файла.');
  }
  const xml = await contentFile.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const lines: string[] = [];

  const allNodes = doc.getElementsByTagName('*');
  for (let i = 0; i < allNodes.length; i++) {
    const el = allNodes[i];
    const local = el.localName || el.nodeName.replace(/^.*:/, '');
    if (local === 'p' || local === 'h') {
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
    }
  }

  return lines.join('\n');
}

/**
 * Decodes TXT bytes trying UTF-8 (strict) first, falling back to Windows-1251.
 */
export function extractTextFromTxtBytes(bytes: Uint8Array): string {
  // Strip UTF-8 BOM if present
  let slice = bytes;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    slice = bytes.subarray(3);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(slice);
  } catch {
    return new TextDecoder('windows-1251').decode(slice);
  }
}

const RTF_SKIP_GROUPS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'object',
  'header',
  'footer',
  'fldinst',
  'themedata',
  'colorschememapping',
  'latentstyles',
  'datastore',
  'xmlopen',
]);

/**
 * Decodes RTF bytes preserving Windows-1251 (\'xx) and Unicode (\uN) Cyrillic text.
 */
export function extractTextFromRtfBytes(bytes: Uint8Array): string {
  let rtf: string;
  try {
    rtf = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    rtf = new TextDecoder('latin1').decode(bytes);
  }
  const cp1251Decoder = new TextDecoder('windows-1251');

  const out: string[] = [];
  const groupStack: Array<{ uc: number; skip: boolean }> = [{ uc: 1, skip: false }];
  let hexBuffer: number[] = [];

  const flushHex = () => {
    if (hexBuffer.length > 0) {
      out.push(cp1251Decoder.decode(new Uint8Array(hexBuffer)));
      hexBuffer = [];
    }
  };

  let i = 0;
  while (i < rtf.length) {
    const ch = rtf[i];
    const current = groupStack[groupStack.length - 1];

    if (ch === '{') {
      flushHex();
      groupStack.push({ uc: current.uc, skip: current.skip });
      i++;
      continue;
    }

    if (ch === '}') {
      flushHex();
      if (groupStack.length > 1) groupStack.pop();
      i++;
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      i++;
      continue;
    }

    if (ch === '\\') {
      i++;
      if (i >= rtf.length) break;
      const next = rtf[i];

      if (next === '\\' || next === '{' || next === '}') {
        flushHex();
        if (!current.skip) out.push(next);
        i++;
        continue;
      }

      if (next === '*') {
        // Ignorable destination group {\*\...}
        current.skip = true;
        i++;
        continue;
      }

      if (next === "'") {
        // Hex escape \'xx
        const hex = rtf.slice(i + 1, i + 3);
        const byteVal = parseInt(hex, 16);
        if (!Number.isNaN(byteVal) && !current.skip) {
          hexBuffer.push(byteVal);
        }
        i += 3;
        continue;
      }

      flushHex();

      if (next === '~') {
        if (!current.skip) out.push(' ');
        i++;
        continue;
      }

      if (next === '-' || next === '_') {
        if (!current.skip) out.push('-');
        i++;
        continue;
      }

      // Parse control word
      const wordMatch = rtf.slice(i).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (wordMatch) {
        const word = wordMatch[1];
        const param = wordMatch[2] !== undefined ? parseInt(wordMatch[2], 10) : undefined;
        i += wordMatch[0].length;

        if (RTF_SKIP_GROUPS.has(word)) {
          current.skip = true;
          continue;
        }

        if (word === 'uc' && param !== undefined) {
          current.uc = Math.max(0, param);
          continue;
        }

        if (word === 'u' && param !== undefined) {
          if (!current.skip) {
            const codeUnit = param < 0 ? param + 65536 : param;
            out.push(String.fromCharCode(codeUnit));
          }
          // Skip uc replacement characters
          let skipped = 0;
          while (skipped < current.uc && i < rtf.length) {
            if (rtf[i] === '\\' && rtf[i + 1] === "'") {
              i += 4;
            } else if (rtf[i] === '{' || rtf[i] === '}') {
              break;
            } else {
              i++;
            }
            skipped++;
          }
          continue;
        }

        if (!current.skip) {
          if (word === 'par' || word === 'line' || word === 'row') {
            out.push('\n');
          } else if (word === 'tab' || word === 'cell') {
            out.push(' ');
          }
        }
        continue;
      }

      i++;
      continue;
    }

    flushHex();
    if (!current.skip) {
      out.push(ch);
    }
    i++;
  }

  flushHex();
  return out
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Best-effort binary extractor for legacy Word .doc files (UTF-16LE + CP1251 runs).
 */
export function extractTextFromLegacyDocBytes(bytes: Uint8Array): string {
  const chunks: string[] = [];
  // Scan for UTF-16LE runs containing ASCII/Cyrillic
  let current: string[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    const isPrintable =
      (code >= 0x0020 && code <= 0x007e) ||
      (code >= 0x0400 && code <= 0x04ff) ||
      code === 0x000d ||
      code === 0x000a ||
      code === 0x00ab ||
      code === 0x00bb ||
      code === 0x2116;

    if (isPrintable) {
      current.push(code === 0x000d ? '\n' : String.fromCharCode(code));
    } else {
      if (current.length >= 12) {
        const str = current.join('').trim();
        if (/[А-Яа-яЁё]{3,}/.test(str)) chunks.push(str);
      }
      current = [];
    }
  }
  if (current.length >= 12) {
    const str = current.join('').trim();
    if (/[А-Яа-яЁё]{3,}/.test(str)) chunks.push(str);
  }
  return chunks.join('\n').trim();
}

async function runOcrOnImageSource(
  source: Blob | HTMLCanvasElement,
  onProgress?: (status: string) => void,
): Promise<string> {
  onProgress?.('Загрузка OCR-модуля…');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('rus+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(`Распознавание скана (OCR): ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  try {
    const {
      data: { text },
    } = await worker.recognize(source);
    return text.trim();
  } finally {
    await worker.terminate();
  }
}

async function extractTextFromPdfBuffer(
  buffer: ArrayBuffer,
  onProgress?: (status: string) => void,
): Promise<{ text: string; usedOcr: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  const pdfjsLib = await getPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(`Чтение PDF (стр. ${pageNum} из ${pdf.numPages})…`);
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Cluster text items by Y coordinate to reconstruct visual lines accurately
    const lineBuckets = new Map<number, Array<{ x: number; str: string }>>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const transform = item.transform as number[];
      const x = transform[4] ?? 0;
      const y = Math.round((transform[5] ?? 0) / 4) * 4;
      const bucket = lineBuckets.get(y) ?? [];
      bucket.push({ x, str: item.str });
      lineBuckets.set(y, bucket);
    }

    const sortedYs = Array.from(lineBuckets.keys()).sort((a, b) => b - a);
    const lines = sortedYs
      .map((y) => {
        const items = lineBuckets.get(y) ?? [];
        items.sort((a, b) => a.x - b.x);
        return items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean);

    if (lines.length > 0) {
      pageTexts.push(lines.join('\n'));
    }
  }

  const combined = pageTexts.join('\n\n').trim();
  if (combined.replace(/\s+/g, '').length >= 25) {
    return { text: combined, usedOcr: false, warnings };
  }

  // Fallback to OCR for scanned PDFs when running in browser with Canvas support
  if (typeof document !== 'undefined') {
    try {
      const ocrPages: string[] = [];
      const maxOcrPages = Math.min(pdf.numPages, 2);
      for (let p = 1; p <= maxOcrPages; p++) {
        onProgress?.(`Подготовка скана к OCR (стр. ${p})…`);
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const pageOcr = await runOcrOnImageSource(canvas, onProgress);
        if (pageOcr) ocrPages.push(pageOcr);
      }
      const ocrText = ocrPages.join('\n').trim();
      if (ocrText) {
        return { text: ocrText, usedOcr: true, warnings };
      }
    } catch {
      warnings.push('Не удалось выполнить OCR сканированного PDF.');
    }
  }

  warnings.push('В PDF не обнаружен текстовый слой.');
  return { text: combined, usedOcr: false, warnings };
}

/**
 * Extracts plain text from an uploaded File in the browser without leaving the client device.
 */
export async function extractTextFromFile(
  file: File,
  onProgress?: (status: string) => void,
): Promise<ExtractionResult> {
  const extension = detectExtension(file.name);
  const warnings: string[] = [];

  if (extension === 'docx') {
    onProgress?.('Чтение DOCX…');
    const buffer = await file.arrayBuffer();
    const text = await extractTextFromDocxBuffer(buffer);
    return { text, extension, usedOcr: false, warnings };
  }

  if (extension === 'odt') {
    onProgress?.('Чтение ODT…');
    const buffer = await file.arrayBuffer();
    const text = await extractTextFromOdtBuffer(buffer);
    return { text, extension, usedOcr: false, warnings };
  }

  if (extension === 'rtf') {
    onProgress?.('Декодирование RTF…');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = extractTextFromRtfBytes(bytes);
    return { text, extension, usedOcr: false, warnings };
  }

  if (extension === 'txt') {
    onProgress?.('Чтение TXT…');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = extractTextFromTxtBytes(bytes);
    return { text, extension, usedOcr: false, warnings };
  }

  if (extension === 'doc') {
    onProgress?.('Извлечение текста из DOC…');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = extractTextFromLegacyDocBytes(bytes);
    if (!text) {
      warnings.push('Устаревший бинарный .doc не содержит читаемого Unicode-текста. Сохраните как .docx или .pdf.');
    } else {
      warnings.push('Формат .doc прочитан в упрощённом режиме — проверьте реквизиты.');
    }
    return { text, extension, usedOcr: false, warnings };
  }

  if (extension === 'pdf') {
    const buffer = await file.arrayBuffer();
    const pdfRes = await extractTextFromPdfBuffer(buffer, onProgress);
    return {
      text: pdfRes.text,
      extension,
      usedOcr: pdfRes.usedOcr,
      warnings: pdfRes.warnings,
    };
  }

  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp') {
    const text = await runOcrOnImageSource(file, onProgress);
    return { text, extension, usedOcr: true, warnings };
  }

  throw new Error(`Неподдерживаемый формат файла: .${file.name.split('.').pop() || 'unknown'}`);
}
