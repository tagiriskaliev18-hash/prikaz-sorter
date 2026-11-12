export type SupportedExtension =
  | 'docx'
  | 'pdf'
  | 'txt'
  | 'rtf'
  | 'odt'
  | 'doc'
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'webp'
  | 'unknown';

export interface ExtractionResult {
  text: string;
  extension: SupportedExtension;
  usedOcr: boolean;
  warnings: string[];
}

export interface FioCandidate {
  /** Raw FIO string as found in the document */
  raw: string;
  /** FIO normalized to Nominative case */
  nominative: string;
  /** Short form: "Фамилия И.О." */
  shortNominative: string;
  /** Heuristic confidence score (0..100+) */
  score: number;
  /** Context reason for debugging/display */
  reason: string;
  /** Zone of the document where candidate was found */
  zone: 'header' | 'body' | 'signature';
}

export interface ParsedOrder {
  orderNumber: string | null;
  orderNumberConfidence: 'high' | 'medium' | 'none';
  orderDate: string | null;
  /** Best selected FIO candidate */
  fioRaw: string | null;
  fioNominative: string | null;
  fioConfidence: 'high' | 'medium' | 'low' | 'none';
  fioCandidates: FioCandidate[];
  warnings: string[];
}

export type FioFormatMode = 'full' | 'short' | 'initial' | 'surname';

export interface NamingSettings {
  /** Template string supporting {number}, {fio}, {date}, {orig} */
  template: string;
  /** Convert FIO from oblique cases (Иванова И.И.) to Nominative (Иванов И.И.) */
  normalizeFioCase: boolean;
  /** How to format FIO in the final filename */
  fioFormat: FioFormatMode;
  /** Replacement for '/' inside order numbers (e.g. '650/ПР' -> '650 ПР') */
  slashReplacement: ' ' | '';
  /** Fallback text when order number is missing */
  missingNumberLabel: string;
  /** Fallback text when FIO is missing */
  missingFioLabel: string;
}

export type DocumentItemStatus = 'processing' | 'ready' | 'needs_review' | 'error';

export interface OrderDocumentItem {
  id: string;
  file: File;
  originalName: string;
  extension: string;
  size: number;
  status: DocumentItemStatus;
  progressText?: string;
  extractedText: string;
  usedOcr: boolean;
  parsed: ParsedOrder;
  /** User-editable order number (initialized from parsed.orderNumber) */
  editedNumber: string;
  /** User-editable FIO (initialized according to settings or manually edited) */
  editedFio: string;
  /** Flag indicating user manually edited FIO so auto-normalization toggle won't overwrite it */
  fioManuallyEdited: boolean;
  /** Computed sanitized final filename (including extension, collision-resolved) */
  finalFileName: string;
  /** True if collision suffix like (2) was added */
  hasCollisionSuffix: boolean;
  errorMessage?: string;
}
