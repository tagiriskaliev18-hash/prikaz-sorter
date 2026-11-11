import type { FioCandidate, ParsedOrder } from './types';
import { formatFioShort, normalizeFioToNominative } from './fioDeclension';

const CYR_UPPER = 'А-ЯЁӘІҢҒҮҰҚӨҺ';
const CYR_LOWER = 'а-яёәіңғүұқөһ';
const CYR_WORD = `(?:[${CYR_UPPER}][${CYR_LOWER}-]{1,32}|[${CYR_UPPER}]{2,32})`;

// Forbidden words/phrases that look capitalized like names in headers/bodies
const FIO_STOPWORDS = new Set([
  'приказ',
  'бұйрық',
  'приказываю',
  'приказываем',
  'принять',
  'назначить',
  'перевести',
  'уволить',
  'командировать',
  'направить',
  'предоставить',
  'премировать',
  'выплатить',
  'поощрить',
  'объявить',
  'освободить',
  'возложить',
  'отстранить',
  'зачислить',
  'отчислить',
  'установить',
  'расторгнуть',
  'прекратить',
  'тағайындалсын',
  'қабылдансын',
  'босатылсын',
  'ауыстырылсын',
  'гражданин',
  'гражданина',
  'гражданке',
  'гражданку',
  'товарищ',
  'работник',
  'работника',
  'работнику',
  'сотрудник',
  'сотрудника',
  'сотруднику',
  'қызметкер',
  'инженер',
  'инженера',
  'менеджер',
  'менеджера',
  'специалист',
  'специалиста',
  'республика',
  'казахстан',
  'российская',
  'федерация',
  'министерство',
  'департамент',
  'комитет',
  'товарищество',
  'акционерное',
  'общество',
  'государственное',
  'учреждение',
  'предприятие',
  'директор',
  'директора',
  'директору',
  'генеральный',
  'генерального',
  'руководитель',
  'руководителя',
  'председатель',
  'начальник',
  'начальника',
  'бухгалтер',
  'бухгалтера',
  'главный',
  'главного',
  'отдел',
  'отдела',
  'кадров',
  'управление',
  'управления',
  'трудовой',
  'трудового',
  'трудовому',
  'договор',
  'договора',
  'кодекс',
  'кодекса',
  'заявление',
  'заявления',
  'личный',
  'личного',
  'состав',
  'состава',
  'основная',
  'деятельность',
  'город',
  'астана',
  'алматы',
  'шымкент',
  'караганда',
  'актобе',
  'атырау',
  'москва',
  'санкт',
  'петербург',
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
  'исполнитель',
  'согласовано',
  'ознакомлен',
  'ознакомлена',
  'должность',
  'должности',
  'штатное',
  'расписание',
  'оплата',
  'оклад',
  'отпуск',
  'отпуска',
  'командировка',
  'основание',
  'негіздеме',
  'приложение',
  'справка',
  'бухгалтерия',
  'бухгалтерии',
  'принятия',
  'увольнения',
  'назначения',
  'перевода',
  'выписка',
  'индивидуальный',
  'предприниматель',
  'ограниченной',
  'ответственностью',
  'казахстана',
  'россии',
  'об',
  'от',
  'по',
  'на',
  'за',
  'для',
  'в',
  'с',
  'о',
  'и',
]);

// Forbidden number prefixes (do NOT mistake ИИН, БИН, contracts, tab numbers for order number)
const FORBIDDEN_NUMBER_CONTEXT_RE =
  /(?:иин|бин|инн|кпп|огрн|бик|рнн|окпо|иик|счет|счёт|р\/с|к\/с|тел\.?|телефон|факс|договор[а-яё]*|контракт[а-яё]*|соглашени[яе]|тд|заявлени[яе]|таб\.?|табельн[а-яё]*|справк[аи]|паспорт[а-яё]*|удостоверени[яе]|пункт[а-яё]*|п\.|ст\.|стать[яи]|акт[а-яё]*|приложени[яе]|лицензи[яи]|сертификат[а-яё]*|кз|kz|№\s*б\/с)\s*$/i;

const ORDER_NUMBER_TOKEN = `[0-9A-Za-z${CYR_UPPER}${CYR_LOWER}][0-9A-Za-z${CYR_UPPER}${CYR_LOWER}\\/\\-–_.]{0,24}`;

const SIGNER_LINE_RE =
  /^(?:генеральный\s+директор|директор|и\.?\s*о\.?\s*(?:генерального\s+)?директора|руководитель|врио\s+директора|председатель|президент|ректор|управляющий|начальник\s+управления|главный\s+врач|бас\s+директор|директоры|басшы|исполнитель|исп\.?|приказ\s+составил|согласовано|с\s+приказом\s+ознакомлен|м\.?\s*п\.?|таныстым|орындаушы)\b/i;

const STRONG_HR_TRIGGER_RE =
  /(?:принять(?:\s+на\s+работу)?|назначить(?:\s+на\s+должность)?|перевести|уволить|расторгнуть\s+(?:трудовой\s+)?договор\s+с|прекратить\s+(?:трудовой\s+)?договор\s+с|предоставить(?:\s+[а-яё]+){0,3}\s+отпуск|предоставить(?=\s+[А-ЯЁӘІҢҒҮҰҚӨҺ])|командировать|направить\s+в(?:\s+служебную)?\s+командировку|премировать|выплатить(?:\s+[а-яё]+){0,2}\s+(?:премию|материальную\s+помощь)|поощрить|объявить\s+(?:выговор|замечание|благодарность)|освободить\s+от(?:\s+занимаемой)?\s+должности|возложить\s+(?:исполнение\s+)?обязанност(?:и|ей)(?:\s+на)?|отстранить|зачислить|отчислить|установить\s+(?:доплату|надбавку|оклад)|о\s+при[её]ме(?:\s+на\s+работу)?|об\s+увольнении|о\s+назначении|о\s+переводе|о\s+предоставлении(?:\s+[а-яё]+){0,2}\s+отпуска|о\s+командировании|о\s+премировании|в\s+отношении|работник\s*:|сотрудник\s*:|ф\.?\s*и\.?\s*о\.?\s*:|қызметкер\s*:|қабылдау|қабылдансын|тағайындау|тағайындалсын|ауыстыру|ауыстырылсын|босату|босатылсын|демалыс\s+беру|демалыс\s+берілсін|іссапарға\s+жіберу)/i;

const ORDER_HEADING_RE = /(?:^|\s|\|)(?:п\s*р\s*и\s*к\s*а\s*з|б\s*ұ\s*й\s*р\s*ы\s*қ)(?:\s|$|\||\/)/i;

function cleanExtractedOrderNumber(raw: string): string | null {
  let num = raw.trim().replace(/[.,;:]+$/, '');
  if (!num) return null;
  // Reject blanks like ___ or ----
  if (/^[_\-–—.\/\\]+$/.test(num)) return null;
  // Reject long pure numbers (likely IIN/BIN/phone/account >= 8 digits)
  if (/^\d{8,}$/.test(num)) return null;
  // Reject pure dates DD.MM.YYYY or DD/MM/YYYY
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(num)) return null;
  // Normalize internal spaces around slash/dash if any
  num = num.replace(/\s+/g, '');
  // Must contain at least one digit or be explicit "б/н"
  if (!/\d/.test(num) && !/^б\/н$/i.test(num)) return null;
  return num;
}

function isForbiddenNumberContext(line: string, matchIndex: number): boolean {
  const before = line.slice(Math.max(0, matchIndex - 32), matchIndex);
  return FORBIDDEN_NUMBER_CONTEXT_RE.test(before);
}

/**
 * Extracts the order number (e.g. "124-к", "87-ж/қ", "45/л") from document text.
 */
export function extractOrderNumber(text: string): {
  number: string | null;
  confidence: 'high' | 'medium' | 'none';
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Direct pattern: ПРИКАЗ / БҰЙРЫҚ followed closely by № <num> (same or next 3 lines)
  const flatTop = lines.slice(0, 45).join('\n');
  const directPatterns = [
    new RegExp(
      `(?:п\\s*р\\s*и\\s*к\\s*а\\s*з|б\\s*ұ\\s*й\\s*р\\s*ы\\s*қ)(?:[^\\n]{0,40}|(?:\\n[^\\n]{0,45}){0,3})?[№N]\\s*(${ORDER_NUMBER_TOKEN})`,
      'i',
    ),
    new RegExp(
      `(?:приказ(?:ом)?|бұйрық)\\s+(?:от\\s+[^\\n№]{3,35}\\s+)?[№N]\\s*(${ORDER_NUMBER_TOKEN})`,
      'i',
    ),
    new RegExp(
      `[№N]\\s*(${ORDER_NUMBER_TOKEN})\\s*(?:от\\s+\\d{1,2}|\\n.{0,25}(?:приказ|бұйрық))`,
      'i',
    ),
  ];

  for (const re of directPatterns) {
    const m = flatTop.match(re);
    if (m && m[1]) {
      const idx = m.index ?? 0;
      const snippetBefore = flatTop.slice(Math.max(0, idx - 30), idx + m[0].indexOf(m[1]));
      if (!FORBIDDEN_NUMBER_CONTEXT_RE.test(snippetBefore)) {
        const cleaned = cleanExtractedOrderNumber(m[1]);
        if (cleaned) {
          return { number: cleaned, confidence: 'high' };
        }
      }
    }
  }

  // 2. Scan lines near ORDER_HEADING_RE (±6 lines) for standalone № / No / N
  const headingIdx = lines.findIndex((l) => ORDER_HEADING_RE.test(l));
  const candidateLines: Array<{ line: string; distance: number }> = [];

  if (headingIdx >= 0) {
    const start = Math.max(0, headingIdx - 6);
    const end = Math.min(lines.length, headingIdx + 7);
    for (let i = start; i < end; i++) {
      candidateLines.push({ line: lines[i], distance: Math.abs(i - headingIdx) });
    }
    candidateLines.sort((a, b) => a.distance - b.distance);
  } else {
    // Fallback: inspect first 25 lines
    for (let i = 0; i < Math.min(25, lines.length); i++) {
      candidateLines.push({ line: lines[i], distance: i });
    }
  }

  const lineNumberRe = new RegExp(`(?:№|No\\.?|N(?=\\s*\\d))\\s*(${ORDER_NUMBER_TOKEN})`, 'gi');
  for (const { line } of candidateLines) {
    let m: RegExpExecArray | null;
    lineNumberRe.lastIndex = 0;
    while ((m = lineNumberRe.exec(line)) !== null) {
      if (isForbiddenNumberContext(line, m.index)) continue;
      const cleaned = cleanExtractedOrderNumber(m[1]);
      if (cleaned) {
        return { number: cleaned, confidence: headingIdx >= 0 ? 'high' : 'medium' };
      }
    }
  }

  // 3. Explicit "б/н" (без номера) near header
  const bnMatch = flatTop.match(/(?:приказ|бұйрық)[^\n]{0,40}\b(б\/н)\b/i);
  if (bnMatch) {
    return { number: 'б/н', confidence: 'medium' };
  }

  return { number: null, confidence: 'none' };
}

/**
 * Extracts the order date if present near the top or alongside "от ...".
 */
export function extractOrderDate(text: string): string | null {
  const top = text.split(/\r?\n/).slice(0, 45).join('\n');

  const numeric = top.match(/(?:от\s+|приказ[^\n]{0,30}|бұйрық[^\n]{0,30})?(\d{2}\.\d{2}\.\d{4})/i);
  if (numeric) return numeric[1];

  const quotedMonth = top.match(
    /[«"]?(\d{1,2})[»"]?\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|қаңтар|ақпан|наурыз|сәуір|мамыр|маусым|шілде|тамыз|қыркүйек|қазан|қараша|желтоқсан)\s+(\d{4})/i,
  );
  if (quotedMonth) {
    const months: Record<string, string> = {
      января: '01',
      февраля: '02',
      марта: '03',
      апреля: '04',
      мая: '05',
      июня: '06',
      июля: '07',
      августа: '08',
      сентября: '09',
      октября: '10',
      ноября: '11',
      декабря: '12',
      қаңтар: '01',
      ақпан: '02',
      наурыз: '03',
      сәуір: '04',
      мамыр: '05',
      маусым: '06',
      шілде: '07',
      тамыз: '08',
      қыркүйек: '09',
      қазан: '10',
      қараша: '11',
      желтоқсан: '12',
    };
    const day = quotedMonth[1].padStart(2, '0');
    const month = months[quotedMonth[2].toLowerCase()];
    if (month) return `${day}.${month}.${quotedMonth[3]}`;
  }

  return null;
}

function isStopwordPhrase(tokens: string[]): boolean {
  return tokens.some((tok) => FIO_STOPWORDS.has(tok.toLowerCase().replace(/\.$/, '')));
}

function isLikelyPatronymic(token: string): boolean {
  return /(?:ович|евич|ич|овна|евна|ична|инична|овича|евича|ича|овичу|евичу|ичу|овичем|евичем|ичем|овны|евны|ичны|овне|евне|ичне|овну|евну|ичну|овной|евной|ичной|улы|ұлы|кызы|қызы|оглы|оғлы)$/i.test(
    token,
  );
}

interface ZoneAnnotatedLine {
  text: string;
  zone: 'header' | 'body' | 'signature';
}

function segmentLines(text: string): ZoneAnnotatedLine[] {
  const rawLines = text.split(/\r?\n/);
  const total = rawLines.length;
  let seenOrderBodyStart = false;
  let inSignature = false;

  return rawLines.map((line, idx) => {
    const trimmed = line.trim();
    if (!seenOrderBodyStart && (ORDER_HEADING_RE.test(trimmed) || /приказываю|бұйрық\s+етемін/i.test(trimmed))) {
      seenOrderBodyStart = true;
    }

    // Enter signature zone only in bottom half of document AND not inside an HR command sentence
    const inBottomHalf = idx >= Math.floor(total * 0.48);
    if (
      inBottomHalf &&
      !STRONG_HR_TRIGGER_RE.test(trimmed) &&
      SIGNER_LINE_RE.test(trimmed)
    ) {
      inSignature = true;
    }

    const zone: 'header' | 'body' | 'signature' = inSignature
      ? 'signature'
      : seenOrderBodyStart
        ? 'body'
        : 'header';

    return { text: line, zone };
  });
}

/**
 * Extracts and ranks FIO candidates from the order text, prioritizing the employee subject
 * in the order body and penalizing the signing director at the bottom.
 */
const GEN_ACC_TRIGGER_RE =
  /(?:принять(?:\s+на\s+работу)?|назначить(?:\s+на\s+должность)?|перевести|уволить|расторгнуть\s+(?:трудовой\s+)?договор\s+с|прекратить\s+(?:трудовой\s+)?договор\s+с|командировать|направить\s+в(?:\s+служебную)?\s+командировку|премировать|поощрить|освободить\s+от(?:\s+занимаемой)?\s+должности|возложить\s+(?:исполнение\s+)?обязанност(?:и|ей)\s+на|отстранить|зачислить|отчислить|о\s+при[её]ме(?:\s+на\s+работу)?|об\s+увольнении|о\s+назначении|о\s+переводе|о\s+командировании|о\s+премировании|в\s+отношении|заявление)\s*$/i;

const DAT_TRIGGER_RE =
  /(?:предоставить(?:\s+[а-яё]+){0,3}\s+отпуск|выплатить(?:\s+[а-яё]+){0,3}|объявить(?:\s+[а-яё]+){0,2}|установить(?:\s+[а-яё]+){0,2})\s*$/i;

interface LineToken {
  text: string;
  start: number;
  end: number;
  isInitials: boolean;
  isWord: boolean;
}

function tokenizeLineCapitalized(line: string): LineToken[] {
  const tokens: LineToken[] = [];
  const tokenRe = new RegExp(
    `([${CYR_UPPER}]\\.\\s*[${CYR_UPPER}]\\.|[${CYR_UPPER}]\\.|${CYR_WORD})`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(line)) !== null) {
    const val = m[0];
    const isInitials = new RegExp(`^[${CYR_UPPER}]\\.`).test(val);
    tokens.push({
      text: val,
      start: m.index,
      end: m.index + val.length,
      isInitials,
      isWord: !isInitials,
    });
  }
  return tokens;
}

function areSpaceAdjacent(line: string, prev: LineToken, next: LineToken): boolean {
  const between = line.slice(prev.end, next.start);
  return /^[ \t]+$/.test(between);
}

/**
 * Extracts and ranks FIO candidates from the order text, prioritizing the employee subject
 * in the order body and penalizing the signing director at the bottom.
 */
export function extractEmployeeFio(text: string): {
  best: FioCandidate | null;
  candidates: FioCandidate[];
  confidence: 'high' | 'medium' | 'low' | 'none';
} {
  const annotatedLines = segmentLines(text);
  const candidateMap = new Map<string, FioCandidate>();

  const upsertCandidate = (
    raw: string,
    score: number,
    reason: string,
    zone: 'header' | 'body' | 'signature',
    caseHint?: 'gen_acc' | 'dat' | 'nom',
  ) => {
    const cleanRaw = raw.trim().replace(/\s+/g, ' ');
    const nominative = normalizeFioToNominative(cleanRaw, { caseHint });
    const shortNominative = formatFioShort(nominative);
    const key = nominative.toLowerCase();

    const existing = candidateMap.get(key);
    if (!existing || score > existing.score) {
      candidateMap.set(key, {
        raw: cleanRaw,
        nominative,
        shortNominative,
        score,
        reason,
        zone,
      });
    }
  };

  for (let i = 0; i < annotatedLines.length; i++) {
    const { text: line, zone } = annotatedLines[i];
    if (!line.trim()) continue;

    const prevLine = i > 0 ? annotatedLines[i - 1].text : '';

    const evaluateMatch = (
      matchStr: string,
      matchIndex: number,
      baseScore: number,
      label: string,
    ) => {
      const beforeInLine = line.slice(Math.max(0, matchIndex - 105), matchIndex);
      const contextWindow = matchIndex < 40 ? `${prevLine} ${beforeInLine}` : beforeInLine;

      let score = baseScore;
      const reasons: string[] = [label];

      if (zone === 'body') {
        score += 20;
      } else if (zone === 'header') {
        score += 5;
      } else {
        score -= 85;
        reasons.push('зона подписи');
      }

      if (STRONG_HR_TRIGGER_RE.test(contextWindow)) {
        score += 65;
        reasons.push('после кадрового действия');
      }

      if (
        /(?:директор|руководитель|начальник\s+отдела|исп\.?|исполнитель|подпись|м\.?\s*п\.?)\s*[:_-]*\s*$/i.test(
          beforeInLine,
        )
      ) {
        if (!/(?:должност[ьи]|назначить|принять|перевести)\s+/i.test(contextWindow)) {
          score -= 70;
          reasons.push('должность подписанта');
        }
      }

      const firstWord = matchStr.split(' ')[0];
      if (firstWord && firstWord === firstWord.toUpperCase() && firstWord.length > 2) {
        score += 10;
      }

      let caseHint: 'gen_acc' | 'dat' | 'nom' | undefined;
      if (GEN_ACC_TRIGGER_RE.test(contextWindow)) {
        caseHint = 'gen_acc';
      } else if (DAT_TRIGGER_RE.test(contextWindow)) {
        caseHint = 'dat';
      }

      upsertCandidate(matchStr, score, reasons.join(', '), zone, caseHint);
    };

    // Token-stream matcher avoids greedy regexes eating verbs like "Принять" before FIO
    const tokens = tokenizeLineCapitalized(line);
    let idx = 0;
    while (idx < tokens.length) {
      const t0 = tokens[idx];

      // 1. Initials + Surname: "И.И. Иванов" or "И. И. Иванов"
      if (t0.isInitials) {
        const t1 = tokens[idx + 1];
        const t2 = tokens[idx + 2];
        // Handle split initials "И. И. Иванов"
        if (
          t1 &&
          t1.isInitials &&
          t0.text.length <= 2 &&
          t1.text.length <= 2 &&
          areSpaceAdjacent(line, t0, t1) &&
          t2 &&
          t2.isWord &&
          areSpaceAdjacent(line, t1, t2) &&
          !isStopwordPhrase([t2.text])
        ) {
          const span = line.slice(t0.start, t2.end);
          evaluateMatch(span, t0.start, 18, 'инициалы + фамилия');
          idx += 3;
          continue;
        }
        if (
          t1 &&
          t1.isWord &&
          areSpaceAdjacent(line, t0, t1) &&
          !isStopwordPhrase([t1.text])
        ) {
          const span = line.slice(t0.start, t1.end);
          evaluateMatch(span, t0.start, 18, 'инициалы + фамилия');
          idx += 2;
          continue;
        }
        idx++;
        continue;
      }

      if (isStopwordPhrase([t0.text])) {
        idx++;
        continue;
      }

      const t1 = tokens[idx + 1];
      const t2 = tokens[idx + 2];

      // 2. Full 3-word FIO: Фамилия Имя Отчество
      if (
        t1 &&
        t2 &&
        t1.isWord &&
        t2.isWord &&
        areSpaceAdjacent(line, t0, t1) &&
        areSpaceAdjacent(line, t1, t2) &&
        !isStopwordPhrase([t1.text, t2.text])
      ) {
        const hasPatronymic = isLikelyPatronymic(t2.text);
        const before = line.slice(Math.max(0, t0.start - 95), t0.start);
        const hasTrigger = STRONG_HR_TRIGGER_RE.test(
          t0.start < 40 ? `${prevLine} ${before}` : before,
        );
        if (hasPatronymic || hasTrigger) {
          const span = line.slice(t0.start, t2.end);
          evaluateMatch(span, t0.start, hasPatronymic ? 45 : 28, 'полное ФИО');
          idx += 3;
          continue;
        }
      }

      // 3. Surname + Initials: "Иванов И.И." or "Иванов И. И." or "Иванов И."
      if (t1 && t1.isInitials && areSpaceAdjacent(line, t0, t1)) {
        if (!/^(?:г|т|п|с|о|и|у|в|к)$/i.test(t0.text)) {
          if (
            t2 &&
            t2.isInitials &&
            t1.text.length <= 2 &&
            t2.text.length <= 2 &&
            areSpaceAdjacent(line, t1, t2)
          ) {
            const span = line.slice(t0.start, t2.end);
            evaluateMatch(span, t0.start, 25, 'фамилия + инициалы');
            idx += 3;
            continue;
          }
          const span = line.slice(t0.start, t1.end);
          evaluateMatch(span, t0.start, 25, 'фамилия + инициалы');
          idx += 2;
          continue;
        }
      }

      // 4. Two-word FIO: Фамилия Имя (only if preceded by strong HR trigger)
      if (
        t1 &&
        t1.isWord &&
        areSpaceAdjacent(line, t0, t1) &&
        !isStopwordPhrase([t1.text])
      ) {
        const beforeInLine = line.slice(Math.max(0, t0.start - 95), t0.start);
        const contextWindow = t0.start < 40 ? `${prevLine} ${beforeInLine}` : beforeInLine;
        if (STRONG_HR_TRIGGER_RE.test(contextWindow)) {
          const span = line.slice(t0.start, t1.end);
          evaluateMatch(span, t0.start, 30, 'ФИО (2 слова)');
          idx += 2;
          continue;
        }
      }

      idx++;
    }
  }

  const candidates = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
  const best = candidates[0] ?? null;

  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
  if (best) {
    if (best.score >= 90) confidence = 'high';
    else if (best.score >= 45) confidence = 'medium';
    else confidence = 'low';
  }

  return { best, candidates, confidence };
}

/**
 * Full parser entrypoint combining order number, date, and employee FIO extraction.
 */
export function parseOrderText(text: string): ParsedOrder {
  const warnings: string[] = [];
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      orderNumber: null,
      orderNumberConfidence: 'none',
      orderDate: null,
      fioRaw: null,
      fioNominative: null,
      fioConfidence: 'none',
      fioCandidates: [],
      warnings: ['Текст документа пуст — проверьте формат или качество скана.'],
    };
  }

  const numRes = extractOrderNumber(trimmed);
  const orderDate = extractOrderDate(trimmed);
  const fioRes = extractEmployeeFio(trimmed);

  if (!numRes.number) {
    warnings.push('Не удалось автоматически определить номер приказа.');
  }
  if (!fioRes.best) {
    warnings.push('Не удалось автоматически определить ФИО сотрудника.');
  } else if (fioRes.best.zone === 'signature') {
    warnings.push('ФИО найдено только в зоне подписи — проверьте вручную.');
  }

  return {
    orderNumber: numRes.number,
    orderNumberConfidence: numRes.confidence,
    orderDate,
    fioRaw: fioRes.best?.raw ?? null,
    fioNominative: fioRes.best?.nominative ?? null,
    fioConfidence: fioRes.confidence,
    fioCandidates: fioRes.candidates,
    warnings,
  };
}
