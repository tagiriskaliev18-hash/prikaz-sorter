/**
 * Russian & Kazakh FIO morphological normalizer (oblique cases -> Nominative).
 * Designed to safely convert order-document phrases like
 * "Иванова Ивана Ивановича" or "Петровой Анне Сергеевне" back to Nominative
 * without corrupting indeclinable surnames (-ко, -о, -их/-ых, -улы/-қызы)
 * or indeclinable female names (Айгуль, Асель, Сауле, Меруерт).
 */

type Gender = 'male' | 'female' | 'unknown';

const CYR_TOKEN_RE = /^[А-ЯЁӘІҢҒҮҰҚӨҺа-яёәіңғүұқөһ-]+$/;
const INITIALS_RE = /^(?:[А-ЯЁӘІҢҒҮҰҚӨҺ]\.\s*){1,2}$/;

const INDECLINABLE_SURNAME_RE =
  /(?:ко|о|е|и|у|ю|их|ых|аго|яго|улы|ұлы|кызы|қызы|оглы|оғлы|швили|иа|уа|дзе)$/i;

const INDECLINABLE_PATRONYMIC_RE = /(?:улы|ұлы|кызы|қызы|оглы|оғлы)$/i;

const INDECLINABLE_FEMALE_NAMES = new Set([
  'айгуль',
  'айгүл',
  'асель',
  'әсел',
  'жанар',
  'гульнар',
  'гүлнар',
  'шолпан',
  'меруерт',
  'ботагоз',
  'ботагөз',
  'гаухар',
  'сауле',
  'сәуле',
  'зауре',
  'зәуре',
  'айнур',
  'айнұр',
  'балнур',
  'балнұр',
  'айжан',
  'арайлым',
  'айгерим',
  'әйгерім',
  'алтынай',
  'индира',
  'асем',
  'әсем',
  'томирис',
  'нелли',
  'элен',
  'карлыгаш',
  'қарлығаш',
  'майра',
]);

const MALE_EXCEPTIONS: Record<string, string> = {
  павла: 'Павел',
  павлу: 'Павел',
  павлом: 'Павел',
  павле: 'Павел',
  льва: 'Лев',
  льву: 'Лев',
  львом: 'Лев',
  льве: 'Лев',
  петра: 'Петр',
  петру: 'Петр',
  петром: 'Петр',
  петре: 'Петр',
  пётра: 'Пётр',
  пётру: 'Пётр',
  пётром: 'Пётр',
  пётре: 'Пётр',
  игоря: 'Игорь',
  игорю: 'Игорь',
  игорем: 'Игорь',
  игоре: 'Игорь',
  ильи: 'Илья',
  илье: 'Илья',
  илью: 'Илья',
  ильей: 'Илья',
  ильёй: 'Илья',
  никиты: 'Никита',
  никите: 'Никита',
  никиту: 'Никита',
  никитой: 'Никита',
  данилы: 'Данила',
  даниле: 'Данила',
  данилу: 'Данила',
  данилой: 'Данила',
  кузьмы: 'Кузьма',
  кузьме: 'Кузьма',
  кузьму: 'Кузьма',
  кузьмой: 'Кузьма',
  фомы: 'Фома',
  фоме: 'Фома',
  фому: 'Фома',
  фомой: 'Фома',
  саввы: 'Савва',
  савве: 'Савва',
  савву: 'Савва',
  саввой: 'Савва',
  луки: 'Лука',
  луке: 'Лука',
  луку: 'Лука',
  лукой: 'Лука',
  артёма: 'Артём',
  артёму: 'Артём',
  артёмом: 'Артём',
  артёме: 'Артём',
  фёдора: 'Фёдор',
  фёдору: 'Фёдор',
  фёдором: 'Фёдор',
  фёдоре: 'Фёдор',
  семёна: 'Семён',
  семёну: 'Семён',
  семёном: 'Семён',
  семёне: 'Семён',
};

const FEMALE_EXCEPTIONS: Record<string, string> = {
  любови: 'Любовь',
  любовь: 'Любовь',
  любовью: 'Любовь',
  любви: 'Любовь',
  любве: 'Любовь',
  марии: 'Мария',
  марию: 'Мария',
  марией: 'Мария',
  дарьи: 'Дарья',
  дарье: 'Дарья',
  дарью: 'Дарья',
  дарьей: 'Дарья',
  натальи: 'Наталья',
  наталье: 'Наталья',
  наталью: 'Наталья',
  натальей: 'Наталья',
  наталии: 'Наталия',
  наталию: 'Наталия',
  наталией: 'Наталия',
  софьи: 'Софья',
  софье: 'Софья',
  софью: 'Софья',
  софьей: 'Софья',
  софии: 'София',
  софию: 'София',
  софией: 'София',
  юлии: 'Юлия',
  юлию: 'Юлия',
  юлией: 'Юлия',
  анастасии: 'Анастасия',
  анастасию: 'Анастасия',
  анастасией: 'Анастасия',
  виктории: 'Виктория',
  викторию: 'Виктория',
  викторией: 'Виктория',
  евгении: 'Евгения',
  евгению: 'Евгения',
  евгенией: 'Евгения',
  валерии: 'Валерия',
  валерию: 'Валерия',
  валерией: 'Валерия',
  ксении: 'Ксения',
  ксению: 'Ксения',
  ксенией: 'Ксения',
  лидии: 'Лидия',
  лидию: 'Лидия',
  лидией: 'Лидия',
  алии: 'Алия',
  алие: 'Алия',
  алию: 'Алия',
  алией: 'Алия',
  галии: 'Галия',
  галие: 'Галия',
  галию: 'Галия',
  галией: 'Галия',
  зои: 'Зоя',
  зое: 'Зоя',
  зою: 'Зоя',
  зоей: 'Зоя',
  раи: 'Рая',
  рае: 'Рая',
  раю: 'Рая',
  раей: 'Рая',
  маи: 'Майя',
  майе: 'Майя',
  майю: 'Майя',
  майей: 'Майя',
  олеси: 'Олеся',
  олесе: 'Олеся',
  олесю: 'Олеся',
  олесей: 'Олеся',
};

const KNOWN_MALE_STEMS = new Set([
  'иван',
  'серге',
  'алексе',
  'дмитри',
  'андре',
  'максим',
  'артем',
  'артём',
  'александр',
  'михаил',
  'никола',
  'владимир',
  'виктор',
  'евгени',
  'роман',
  'денис',
  'олег',
  'кирилл',
  'антон',
  'борис',
  'вадим',
  'васили',
  'геннади',
  'георги',
  'григори',
  'даниил',
  'данил',
  'егор',
  'константин',
  'леонид',
  'руслан',
  'станислав',
  'степан',
  'тимур',
  'федор',
  'фёдор',
  'юри',
  'ярослав',
  'серик',
  'берик',
  'даурен',
  'нурлан',
  'нұрлан',
  'ерлан',
  'асхат',
  'марат',
  'талгат',
  'талғат',
  'бауыржан',
  'арман',
  'кайрат',
  'қайрат',
  'азамат',
  'алибек',
  'әлібек',
  'ермек',
  'рустем',
  'рүстем',
  'санжар',
  'олжас',
  'медет',
  'жандос',
  'витали',
  'валери',
  'аркади',
  'анатоли',
  'матве',
  'тимофе',
  'вячеслав',
  'владислав',
  'рустам',
  'эдуард',
  'артур',
  'альберт',
  'демян',
  'ильдар',
  'мурат',
  'мұрат',
]);

const KNOWN_FEMALE_NOMINATIVES = new Set([
  'анна',
  'елена',
  'светлана',
  'ольга',
  'ирина',
  'екатерина',
  'марина',
  'татьяна',
  'надежда',
  'оксана',
  'галина',
  'людмила',
  'лариса',
  'жанна',
  'динара',
  'мадина',
  'амина',
  'камила',
  'жанара',
  'айнура',
  'индира',
  'айдана',
  'сабина',
  'дана',
  'мария',
  'дарья',
  'наталья',
  'наталия',
  'софья',
  'софия',
  'юлия',
  'анастасия',
  'виктория',
  'евгения',
  'валерия',
  'ксения',
  'лидия',
  'алия',
  'галия',
  'олеся',
  'зоя',
  'любовь',
  'вера',
  'нино',
  'нина',
  'алла',
  'инна',
  'янина',
  'кристина',
  'полина',
  'алина',
  'диана',
  'карина',
  'гульнара',
  'айгуль',
  'асель',
  'жанар',
  'гульнар',
  'шолпан',
  'меруерт',
  'ботагоз',
  'гаухар',
  'сауле',
  'зауре',
  'айжан',
  'арайлым',
  'айгерим',
  'алтынай',
  'асем',
]);

function matchCapitalization(original: string, target: string): string {
  if (!original) return target;
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return target.toUpperCase();
  }
  return target
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join('-');
}

function normalizeInitialsToken(token: string): string {
  const letters = token.replace(/[^А-ЯЁӘІҢҒҮҰҚӨҺа-яёәіңғүұқөһ]/g, '').toUpperCase();
  return letters
    .split('')
    .map((ch) => `${ch}.`)
    .join('');
}

function normalizePatronymic(word: string): {
  value: string;
  gender: Gender;
  wasDeclined: boolean;
} {
  const lower = word.toLowerCase();

  if (INDECLINABLE_PATRONYMIC_RE.test(lower)) {
    const isFemale = /(?:кызы|қызы)$/i.test(lower);
    return {
      value: word,
      gender: isFemale ? 'female' : 'male',
      wasDeclined: false,
    };
  }

  // Male patronymics
  if (/(?:ович|евич|ич)$/i.test(lower)) {
    return { value: word, gender: 'male', wasDeclined: false };
  }
  const maleMatch = lower.match(/^(.+?(?:ов|ев|ёв))ич(?:а|у|ем|е)$/) || lower.match(/^(.+?)ич(?:а|у|ем|е)$/);
  if (maleMatch) {
    const nom = lower.replace(/(ич)(?:а|у|ем|е)$/, '$1');
    return {
      value: matchCapitalization(word, nom),
      gender: 'male',
      wasDeclined: true,
    };
  }

  // Female patronymics
  if (/(?:овна|евна|ична|инична)$/i.test(lower)) {
    return { value: word, gender: 'female', wasDeclined: false };
  }
  if (/(?:овн|евн|ичн|иничн)(?:ы|е|у|ой|ою)$/i.test(lower)) {
    const nom = lower.replace(/(овн|евн|ичн|иничн)(?:ы|е|у|ой|ою)$/, '$1а');
    return {
      value: matchCapitalization(word, nom),
      gender: 'female',
      wasDeclined: true,
    };
  }

  return { value: word, gender: 'unknown', wasDeclined: false };
}

function detectFirstNameGender(word: string): { gender: Gender; wasDeclined: boolean } {
  const lower = word.toLowerCase();

  if (MALE_EXCEPTIONS[lower]) {
    const isNom = MALE_EXCEPTIONS[lower].toLowerCase() === lower;
    return { gender: 'male', wasDeclined: !isNom };
  }
  if (FEMALE_EXCEPTIONS[lower]) {
    const isNom = FEMALE_EXCEPTIONS[lower].toLowerCase() === lower;
    return { gender: 'female', wasDeclined: !isNom };
  }
  if (INDECLINABLE_FEMALE_NAMES.has(lower)) {
    return { gender: 'female', wasDeclined: false };
  }
  if (KNOWN_FEMALE_NOMINATIVES.has(lower)) {
    return { gender: 'female', wasDeclined: false };
  }
  if (KNOWN_MALE_STEMS.has(lower)) {
    return { gender: 'male', wasDeclined: false };
  }

  // Check stems of known male names with oblique endings
  const maleObliqueCandidate = lower.replace(/(?:а|у|ом|е|я|ю|ем|ия|ию|ием|ии)$/, '');
  if (
    KNOWN_MALE_STEMS.has(maleObliqueCandidate) ||
    KNOWN_MALE_STEMS.has(lower.replace(/(?:я|ю|ем|е)$/, '')) ||
    KNOWN_MALE_STEMS.has(lower.replace(/(?:а|у|ом|е)$/, ''))
  ) {
    return { gender: 'male', wasDeclined: true };
  }

  // Check stems of known female names (-а -> -ы/-и/-е/-у/-ой/-ою)
  const femFromA = lower.replace(/(?:ы|и|е|у|ой|ою)$/, 'а');
  if (KNOWN_FEMALE_NOMINATIVES.has(femFromA)) {
    return { gender: 'female', wasDeclined: true };
  }

  if (/(?:у|ой|ою|ей|ею)$/.test(lower)) {
    // Likely female 1st declension (unless male surname context)
    return { gender: 'female', wasDeclined: true };
  }

  return { gender: 'unknown', wasDeclined: false };
}

function normalizeFirstName(
  word: string,
  gender: Gender,
): { value: string; wasDeclined: boolean } {
  const lower = word.toLowerCase();

  if (INDECLINABLE_FEMALE_NAMES.has(lower)) {
    return { value: word, wasDeclined: false };
  }

  if (gender !== 'female' && MALE_EXCEPTIONS[lower]) {
    const norm = MALE_EXCEPTIONS[lower];
    return {
      value: matchCapitalization(word, norm),
      wasDeclined: norm.toLowerCase() !== lower,
    };
  }

  if (gender !== 'male' && FEMALE_EXCEPTIONS[lower]) {
    const norm = FEMALE_EXCEPTIONS[lower];
    return {
      value: matchCapitalization(word, norm),
      wasDeclined: norm.toLowerCase() !== lower,
    };
  }

  if (gender === 'male') {
    // Check if already nominative male name
    if (KNOWN_MALE_STEMS.has(lower)) {
      return { value: word, wasDeclined: false };
    }
    // Soft-sign male names like Наиля/Равиля/Шамиля/Эмиля/Адиля
    if (/^[а-яёәіңғүұқөһ]+л(?:я|ю|ем|е)$/.test(lower)) {
      const stem = lower.replace(/(?:я|ю|ем|е)$/, 'ь');
      return { value: matchCapitalization(word, stem), wasDeclined: true };
    }
    // -ия / -ию / -ием / -ии -> -ий (Дмитрия -> Дмитрий)
    if (/(?:ия|ию|ием|ии)$/.test(lower)) {
      const nom = lower.replace(/(?:ия|ию|ием|ии)$/, 'ий');
      return { value: matchCapitalization(word, nom), wasDeclined: true };
    }
    // Vowel + я/ю/ем/е -> Vowel + й (Сергея -> Сергей, Андрея -> Андрей, Николаю -> Николай)
    if (/[аеёиоуыэюя](?:я|ю|ем|е)$/.test(lower)) {
      const nom = lower.replace(/(?:я|ю|ем|е)$/, 'й');
      return { value: matchCapitalization(word, nom), wasDeclined: true };
    }
    // Consonant + а/у/ом/е -> Consonant (Ивана -> Иван, Серика -> Серик)
    if (/[бвгджзклмнпрстфхцчшщқғң](?:а|у|ом|е)$/.test(lower)) {
      const nom = lower.replace(/(?:а|у|ом|е)$/, '');
      return { value: matchCapitalization(word, nom), wasDeclined: true };
    }
    return { value: word, wasDeclined: false };
  }

  if (gender === 'female') {
    if (KNOWN_FEMALE_NOMINATIVES.has(lower)) {
      return { value: word, wasDeclined: false };
    }
    if (/(?:ии|ию|ией|иею)$/.test(lower)) {
      const nom = lower.replace(/(?:ии|ию|ией|иею)$/, 'ия');
      return { value: matchCapitalization(word, nom), wasDeclined: true };
    }
    if (/ь(?:и|е|ю|ей|ею)$/.test(lower)) {
      const nom = lower.replace(/ь(?:и|е|ю|ей|ею)$/, 'ья');
      return { value: matchCapitalization(word, nom), wasDeclined: true };
    }
    if (/(?:ю|ей|ею)$/.test(lower)) {
      const nom = lower.replace(/(?:ю|ей|ею)$/, 'я');
      return { value: matchCapitalization(word, nom), wasDeclined: true };
    }
    if (/(?:ы|и|е|у|ой|ою)$/.test(lower)) {
      const nom = lower.replace(/(?:ы|и|е|у|ой|ою)$/, 'а');
      return { value: matchCapitalization(word, nom), wasDeclined: true };
    }
    return { value: word, wasDeclined: false };
  }

  return { value: word, wasDeclined: false };
}

export interface NormalizeFioOptions {
  caseHint?: 'gen_acc' | 'dat' | 'nom';
}

function normalizeSingleSurnamePart(
  part: string,
  gender: Gender,
  phraseIsOblique: boolean,
  initialsOnly: boolean,
  caseHint?: 'gen_acc' | 'dat' | 'nom',
): string {
  const lower = part.toLowerCase();

  // Adjectival surnames (-ого/-ому/-ым/-ом) checked BEFORE indeclinable -о$!
  if (/(?:ск|цк)(?:ого|ому|им|ом)$/.test(lower)) {
    const nom = lower.replace(/(?:ого|ому|им|ом)$/, 'ий');
    return matchCapitalization(part, nom);
  }
  if (/(?:ск|цк)(?:ой|ою|ую)$/.test(lower)) {
    const nom = lower.replace(/(?:ой|ою|ую)$/, 'ая');
    return matchCapitalization(part, nom);
  }
  if (
    gender !== 'female' &&
    /(?:ого|ому|ым|ом)$/.test(lower) &&
    !/(?:аго|яго)$/.test(lower) &&
    !/(?:ов|ев|ёв|ин)(?:ым|ом)$/.test(lower)
  ) {
    if (/толст(?:ого|ому|ым|ом)$/.test(lower)) {
      return matchCapitalization(part, 'толстой');
    }
    const stem = lower.replace(/(?:ого|ому|ым|ом)$/, '');
    if (/[гкхжшчщ]$/.test(stem)) {
      return matchCapitalization(part, `${stem}ий`);
    }
    return matchCapitalization(part, `${stem}ый`);
  }
  if (gender === 'female' && /(?:ой|ою|ую|ей|ею|юю)$/.test(lower) && !/(?:ов|ев|ёв|ин)(?:ой|ою|ую)$/.test(lower)) {
    const nom = /(?:ей|ею|юю)$/.test(lower)
      ? lower.replace(/(?:ей|ею|юю)$/, 'яя')
      : lower.replace(/(?:ой|ою|ую)$/, 'ая');
    return matchCapitalization(part, nom);
  }

  // Never alter indeclinable surnames (-ко, -ово, -о, -е, -и, -их, -ых, -аго, -яго, -улы/-қызы, etc.)
  // Exception: -ову/-еву/-ёву/-ину are declined endings, NOT foreign -у surnames
  if (
    INDECLINABLE_SURNAME_RE.test(lower) &&
    !/(?:ов|ев|ёв|ин)у$/i.test(lower)
  ) {
    return part;
  }

  // Unambiguously female oblique suffixes: -овой, -евой, -ёвой, -иной, -овую, -евую, -ёвую, -иную
  if (/(?:ов|ев|ёв|ин)(?:ой|ою|ую)$/.test(lower)) {
    const nom = lower.replace(/(?:ой|ою|ую)$/, 'а');
    return matchCapitalization(part, nom);
  }

  // Female Accusative -ову/-еву/-ёву/-ину (when gender is female or context is Accusative)
  if (/(?:ов|ев|ёв|ин)у$/.test(lower)) {
    if (gender === 'female' || caseHint === 'gen_acc') {
      const nom = lower.replace(/у$/, 'а');
      return matchCapitalization(part, nom);
    }
    // Male Dative -ову/-еву/-ёву/-ину -> strip -у
    const nom = lower.slice(0, -1);
    return matchCapitalization(part, nom);
  }

  // Unambiguously male oblique suffixes: -овым, -евым, -ёвым, -иным, -ове, -еве, -ёве, -ине
  if (/(?:ов|ев|ёв|ин)(?:ым|ом|е)$/.test(lower)) {
    const nom = lower.replace(/(?:ым|ом|е)$/, '');
    return matchCapitalization(part, nom);
  }

  // Ambiguous -ова/-ева/-ёва/-ина:
  // If female -> keep -а (Иванова stays Иванова!)
  // If male OR gen_acc context with initials ("Принять Иванова И.И.") -> strip -а to -ов/-ев/-ёв/-ин
  if (/(?:ов|ев|ёв|ин)а$/.test(lower)) {
    if (gender === 'female') {
      return part;
    }
    if (gender === 'male' || (initialsOnly && caseHint === 'gen_acc')) {
      const nom = lower.slice(0, -1);
      return matchCapitalization(part, nom);
    }
    return part;
  }

  // Female surname in oblique -е / -ы / -и (only if female AND phraseIsOblique)
  if (gender === 'female' && phraseIsOblique) {
    if (/(?:ове|еве|ёве|ине|евой|овой)$/.test(lower)) {
      const nom = lower.replace(/(?:е|ой)$/, 'а');
      return matchCapitalization(part, nom);
    }
    if (
      /(?:ц|ш|щ|ж|ч|н|л|р|т|д|к|б|п|м|с|з)(?:е|у|ы|и|ой)$/.test(lower) &&
      !/(?:ич|ук|юк|ак|як|ек|ок)$/.test(lower)
    ) {
      const nom = lower.replace(/(?:е|у|ы|и|ой)$/, 'а');
      return matchCapitalization(part, nom);
    }
  }

  // Male consonant surnames in Gen/Dat/Ins/Prep when phrase is confirmed oblique
  if (gender === 'male' && phraseIsOblique) {
    if (/(?:а|у|ом|е)$/.test(lower) && /[бвгджзклмнпрстфхцчшщқғң](?:а|у|ом|е)$/.test(lower)) {
      const nom = lower.replace(/(?:а|у|ом|е)$/, '');
      return matchCapitalization(part, nom);
    }
    if (/(?:я|ю|ем|е)$/.test(lower) && /[рлн](?:я|ю|ем|е)$/.test(lower)) {
      const nom = lower.replace(/(?:я|ю|ем|е)$/, 'ь');
      return matchCapitalization(part, nom);
    }
  }

  return part;
}

function normalizeSurname(
  surname: string,
  gender: Gender,
  phraseIsOblique: boolean,
  initialsOnly: boolean,
  caseHint?: 'gen_acc' | 'dat' | 'nom',
): string {
  return surname
    .split('-')
    .map((p) => normalizeSingleSurnamePart(p, gender, phraseIsOblique, initialsOnly, caseHint))
    .join('-');
}

/**
 * Converts Russian/Kazakh FIO strings from oblique cases to Nominative case.
 * Also standardizes "И.И. Иванов" -> "Иванов И.И.".
 */
export function normalizeFioToNominative(
  rawFio: string,
  options?: NormalizeFioOptions,
): string {
  const cleaned = rawFio.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const caseHint = options?.caseHint;

  // Normalize "И. И. Иванова" or "И.И. Иванова" -> "Иванова И.И."
  const initialsFirst = cleaned.match(
    /^([А-ЯЁӘІҢҒҮҰҚӨҺ]\.\s*(?:[А-ЯЁӘІҢҒҮҰҚӨҺ]\.)?)\s+([А-ЯЁӘІҢҒҮҰҚӨҺ][а-яёәіңғүұқөһ-]+)$/,
  );
  if (initialsFirst) {
    const initials = normalizeInitialsToken(initialsFirst[1]);
    const surname = normalizeSurname(initialsFirst[2], 'unknown', true, true, caseHint);
    return `${surname} ${initials}`;
  }

  // Normalize "Иванова И. И." -> "Иванов И.И."
  const surnameInitials = cleaned.match(
    /^([А-ЯЁӘІҢҒҮҰҚӨҺ][а-яёәіңғүұқөһ-]+)\s+((?:[А-ЯЁӘІҢҒҮҰҚӨҺ]\.\s*){1,2})$/,
  );
  if (surnameInitials) {
    const surname = normalizeSurname(surnameInitials[1], 'unknown', true, true, caseHint);
    const initials = normalizeInitialsToken(surnameInitials[2]);
    return `${surname} ${initials}`;
  }

  const tokens = cleaned.split(' ').filter((t) => CYR_TOKEN_RE.test(t) || INITIALS_RE.test(t));

  if (tokens.length === 3) {
    const [rawSurname, rawFirst, rawPatronymic] = tokens;
    const pat = normalizePatronymic(rawPatronymic);
    let gender: Gender = pat.gender;
    const firstProbe = detectFirstNameGender(rawFirst);
    if (gender === 'unknown') {
      gender = firstProbe.gender;
    }
    const first = normalizeFirstName(rawFirst, gender);
    const phraseIsOblique = pat.wasDeclined || first.wasDeclined || firstProbe.wasDeclined;
    const surname = normalizeSurname(rawSurname, gender, phraseIsOblique, false, caseHint);
    return `${surname} ${first.value} ${pat.value}`;
  }

  if (tokens.length === 2) {
    const [rawSurname, rawSecond] = tokens;
    if (INITIALS_RE.test(rawSecond)) {
      const surname = normalizeSurname(rawSurname, 'unknown', true, true, caseHint);
      return `${surname} ${normalizeInitialsToken(rawSecond)}`;
    }
    const probe = detectFirstNameGender(rawSecond);
    const first = normalizeFirstName(rawSecond, probe.gender);
    const phraseIsOblique = probe.wasDeclined || first.wasDeclined;
    const surname = normalizeSurname(rawSurname, probe.gender, phraseIsOblique, false, caseHint);
    return `${surname} ${first.value}`;
  }

  return cleaned;
}

/**
 * Formats a full FIO ("Иванов Иван Иванович") into short form ("Иванов И.И.").
 */
export function formatFioShort(nominativeFio: string): string {
  const cleaned = nominativeFio.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  const parts = cleaned.split(' ');
  if (parts.length === 1) return parts[0];

  if (INITIALS_RE.test(parts[0]) && parts[1]) {
    return `${parts[1]} ${normalizeInitialsToken(parts[0])}`;
  }

  if (INITIALS_RE.test(parts[1])) {
    return `${parts[0]} ${normalizeInitialsToken(parts.slice(1).join(''))}`;
  }

  const initials = parts
    .slice(1, 3)
    .map((p) => {
      const ch = p.replace(/[^А-ЯЁӘІҢҒҮҰҚӨҺа-яёәіңғүұқөһ]/g, '')[0];
      return ch ? `${ch.toUpperCase()}.` : '';
    })
    .filter(Boolean)
    .join('');

  return initials ? `${parts[0]} ${initials}` : parts[0];
}

/**
 * Extracts only the surname ("Иванов Иван Иванович" -> "Иванов", "И.И. Иванов" -> "Иванов").
 */
export function extractSurname(nominativeFio: string): string {
  const cleaned = nominativeFio.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const parts = cleaned.split(' ');
  if (parts.length >= 2 && INITIALS_RE.test(parts[0])) {
    return parts[1];
  }
  return parts[0] ?? '';
}
