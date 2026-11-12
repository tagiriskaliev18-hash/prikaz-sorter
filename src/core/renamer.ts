import type { NamingSettings } from './types';
import {
  extractSurname,
  formatFioInitial,
  formatFioShort,
  normalizeFioToNominative,
} from './fioDeclension';

export const DEFAULT_NAMING_SETTINGS: NamingSettings = {
  template: '{number} {fio}',
  normalizeFioCase: true,
  fioFormat: 'initial',
  slashReplacement: ' ',
  missingNumberLabel: 'БН',
  missingFioLabel: 'Без ФИО',
};

export const TEMPLATE_PRESETS: Array<{ id: string; label: string; template: string }> = [
  { id: 'standard', label: '650 ПР Искалиев Т.', template: '{number} {fio}' },
  { id: 'with_word', label: 'Приказ 650 ПР Искалиев Т.', template: 'Приказ {number} {fio}' },
  { id: 'with_date', label: '12.02.2026 650 ПР Искалиев Т.', template: '{date} {number} {fio}' },
  { id: 'fio_first', label: 'Искалиев Т. 650 ПР', template: '{fio} {number}' },
];

const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

/**
 * Sanitizes a filename or filename segment for Windows, macOS, Linux, and ЭХД/ECM systems.
 * Allows only letters, digits, spaces, and dots (.) — strips underscores, hyphens, №, and all other punctuation.
 */
export function sanitizeFileNamePart(
  value: string,
  slashReplacement: ' ' | '' = ' ',
): string {
  // Replace slashes cleanly per setting and turn hyphens/underscores/dashes into spaces
  let clean = value
    .replace(/[\\/]+/g, slashReplacement)
    .replace(/[-–—_]+/g, ' ');
  // Keep only letters, digits, whitespace, and dots (.)
  clean = clean
    .replace(/[^\p{L}\p{N}.\s]/gu, '')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  // Trim trailing dots/spaces (invalid on Windows)
  clean = clean.replace(/[. ]+$/, '');

  if (WINDOWS_RESERVED_NAMES.has(clean.toUpperCase())) {
    clean = `Файл ${clean}`;
  }

  return clean;
}

/**
 * Applies user FIO normalization and brevity settings (full, short "Иванов И.И.", initial "Искалиев Т.", surname).
 */
export function formatFioBySettings(
  rawFio: string,
  nominativeFio: string,
  settings: Pick<NamingSettings, 'normalizeFioCase' | 'fioFormat'>,
): string {
  const source = (settings.normalizeFioCase ? nominativeFio || normalizeFioToNominative(rawFio) : rawFio).trim();
  if (!source) return '';

  if (settings.fioFormat === 'initial') {
    return formatFioInitial(source);
  }
  if (settings.fioFormat === 'short') {
    return formatFioShort(source);
  }
  if (settings.fioFormat === 'surname') {
    return extractSurname(source);
  }
  return source;
}

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

/**
 * Builds the sanitized base filename (without extension) from template and order metadata.
 */
export function buildBaseFileName(params: {
  orderNumber: string;
  fio: string;
  orderDate?: string | null;
  originalName: string;
  settings: NamingSettings;
}): string {
  const { orderNumber, fio, orderDate, originalName, settings } = params;

  const numVal = sanitizeFileNamePart(orderNumber, settings.slashReplacement) || settings.missingNumberLabel;
  let fioVal = sanitizeFileNamePart(fio, settings.slashReplacement) || settings.missingFioLabel;
  if (/(?:^|[\s.])[А-ЯЁӘІҢҒҮҰҚӨҺA-Z]\.$/.test(fio.trim()) && fioVal && !fioVal.endsWith('.')) {
    fioVal = `${fioVal}.`;
  }
  const dateVal = sanitizeFileNamePart(orderDate ?? '', settings.slashReplacement);
  const origVal = sanitizeFileNamePart(stripExtension(originalName), settings.slashReplacement);

  let rendered = settings.template
    .replace(/\{number\}/g, numVal)
    .replace(/\{fio\}/g, fioVal)
    .replace(/\{date\}/g, dateVal)
    .replace(/\{orig\}/g, origVal);

  // Clean up redundant whitespace when optional variables like {date} are empty
  rendered = rendered.replace(/\s+/g, ' ').trim();

  const endsWithInitialDot = /(?:^|[\s._-])[А-ЯЁӘІҢҒҮҰҚӨҺA-Z]\.$/.test(rendered);
  let sanitized = sanitizeFileNamePart(rendered, settings.slashReplacement);
  if (endsWithInitialDot && !sanitized.endsWith('.')) {
    sanitized = `${sanitized}.`;
  }
  if (!sanitized) {
    sanitized = sanitizeFileNamePart(`${numVal} ${fioVal}`, settings.slashReplacement) || origVal || 'Приказ';
  }

  if (sanitized.length > 180) {
    sanitized = sanitized.slice(0, 180).trim().replace(/[. ]+$/, '');
  }

  return sanitized;
}

/**
 * Resolves final filenames across a batch of documents, appending " (2)", " (3)"
 * case-insensitively whenever collisions occur.
 */
export function resolveBatchFileNames<
  T extends {
    originalName: string;
    extension: string;
    editedNumber: string;
    editedFio: string;
    parsed: { orderDate: string | null };
  },
>(
  items: T[],
  settings: NamingSettings,
): Array<{ finalFileName: string; hasCollisionSuffix: boolean }> {
  const usedNames = new Map<string, number>();

  return items.map((item) => {
    const ext = item.extension && item.extension !== 'unknown' ? `.${item.extension}` : '';
    const base = buildBaseFileName({
      orderNumber: item.editedNumber,
      fio: item.editedFio,
      orderDate: item.parsed.orderDate,
      originalName: item.originalName,
      settings,
    });

    const candidateLower = `${base}${ext}`.toLowerCase();
    const seenCount = usedNames.get(candidateLower) ?? 0;

    if (seenCount === 0) {
      usedNames.set(candidateLower, 1);
      return {
        finalFileName: `${base}${ext}`,
        hasCollisionSuffix: false,
      };
    }

    let suffixNum = seenCount + 1;
    let uniqueName = `${base} ${suffixNum}${ext}`;
    while (usedNames.has(uniqueName.toLowerCase())) {
      suffixNum++;
      uniqueName = `${base} ${suffixNum}${ext}`;
    }

    usedNames.set(candidateLower, suffixNum);
    usedNames.set(uniqueName.toLowerCase(), 1);
    return {
      finalFileName: uniqueName,
      hasCollisionSuffix: true,
    };
  });
}
