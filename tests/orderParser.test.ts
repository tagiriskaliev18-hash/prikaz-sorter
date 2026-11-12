import { describe, it, expect } from 'vitest';
import {
  parseOrderText,
  extractOrderNumber,
  extractOrderDate,
  extractEmployeeFio,
} from '../src/core/orderParser';

describe('orderParser', () => {
  describe('parseOrderText - Realistic HR orders', () => {
    it('1) Приказ о приеме на работу (№ 124-к): picks employee from body, NOT director from signature', () => {
      const orderText = `
ТОО «ТехноПромСервис»
ПРИКАЗ № 124-к
от 15.01.2026 г.
г. Алматы

О приеме на работу

ПРИКАЗЫВАЮ:
1. Принять Иванова Ивана Ивановича на должность ведущего инженера-программиста с 16 января 2026 года с должностным окладом согласно штатному расписанию.
2. Установить испытательный срок продолжительностью 3 (три) месяца.

Основание: заявление Иванова И.И., трудовой договор № 42/26 от 15.01.2026 г.

Генеральный директор ТОО «ТехноПромСервис»: _________________ Аманбаев К.Б.
С приказом ознакомлен: ________________ Иванов И.И.
`;

      const parsed = parseOrderText(orderText);

      expect(parsed.orderNumber).toBe('124-к');
      expect(parsed.orderNumberConfidence).toMatch(/^(high|medium)$/);
      expect(parsed.orderDate).toMatch(/15\.01\.2026/);
      expect(parsed.fioNominative).toBe('Иванов Иван Иванович');
      expect(parsed.fioRaw).toContain('Иванов');
      expect(parsed.fioConfidence).toMatch(/^(high|medium)$/);

      // Director must NOT be selected as best candidate
      expect(parsed.fioNominative).not.toContain('Аманбаев');
    });

    it('2) Приказ об отпуске (№ 45/л): picks vacation employee, NOT executor or director at bottom', () => {
      const orderText = `
ТОО «Алатау Логистикс»
ПРИКАЗ № 45/л
от 10.06.2026 г.
г. Астана

О предоставлении оплачиваемого ежегодного трудового отпуска

ПРИКАЗЫВАЮ:
1. Предоставить оплачиваемый ежегодный трудовой отпуск Сидоровой Елене Михайловне, главному бухгалтеру, продолжительностью 24 календарных дня с 01.07.2026 по 24.07.2026 года.
2. Главному специалисту по кадрам начислить отпускные выплаты.

Основание: график отпусков, заявление Сидоровой Е.М.

Исполнитель: инспектор отдела кадров Касымова А.М.
Директор филиала: _________________ Садыков Р.Т.
`;

      const parsed = parseOrderText(orderText);

      expect(parsed.orderNumber).toBe('45/л');
      expect(parsed.orderDate).toMatch(/10\.06\.2026/);
      expect(parsed.fioNominative).toBe('Сидорова Елена Михайловна');
      expect(parsed.fioNominative).not.toContain('Касымова');
      expect(parsed.fioNominative).not.toContain('Садыков');
    });

    it('3) Bilingual Kazakhstan order ("БҰЙРЫҚ / ПРИКАЗ", № 88-ж/қ): ignores 12-digit БИН/ИИН', () => {
      const orderText = `
«ҚАЗАҚСТАН ТЕМІР ЖОЛЫ» ҰЛТТЫҚ КОМПАНИЯСЫ» АҚ
АКЦИОНЕРНОЕ ОБЩЕСТВО «НАЦИОНАЛЬНАЯ КОМПАНИЯ «ҚАЗАҚСТАН ТЕМІР ЖОЛЫ»

БҰЙРЫҚ / ПРИКАЗ

№ 88-ж/қ

«12» ақпан 2026 ж. / 12 февраля 2026 г.
Астана қ. / г. Астана

БИН 980140001234, ИИН 850315301245, БИК KZKOKZ22

Жұмысқа қабылдау туралы / О приеме на работу

Тағайындалсын / Назначить Ахметова Серика Нұрланұлы на должность главного специалиста департамента логистики с 15 февраля 2026 года.
Негіздеме / Основание: өтініш, еңбек шарты № 88/ТД.

Басқарма Төрағасы / Председатель Правления: _________________ Нурпеисов Б.С.
`;

      const parsed = parseOrderText(orderText);

      expect(parsed.orderNumber).toBe('88-ж/қ');
      // Must NOT extract 12-digit БИН or ИИН
      expect(parsed.orderNumber).not.toBe('980140001234');
      expect(parsed.orderNumber).not.toBe('850315301245');

      expect(parsed.fioNominative).toBe('Ахметов Серик Нұрланұлы');
      expect(parsed.fioNominative).not.toContain('Нурпеисов');
    });

    it('4) Order with contract/tab number: picks order number 17-лс, NOT contract or tab number', () => {
      const orderText = `
ТОО «СтройГарант»
Трудовой договор № 999, таб. № 00412
ПРИКАЗ № 17-лс от 05.03.2026
г. Караганда

О прекращении трудового договора

ПРИКАЗЫВАЮ:
1. Расторгнуть трудовой договор № 999 от 10.05.2023 и уволить Козлова Максима Петровича, монтажника 5 разряда, по соглашению сторон 05.03.2026 года.
2. Бухгалтерии произвести окончательный расчет.

Основание: соглашение о расторжении договора № 999 от 01.03.2026 г.

Директор предприятия: _________________ Баранов С.В.
`;

      const parsed = parseOrderText(orderText);

      expect(parsed.orderNumber).toBe('17-лс');
      expect(parsed.orderNumber).not.toBe('999');
      expect(parsed.orderNumber).not.toBe('00412');
      expect(parsed.orderDate).toMatch(/05\.03\.2026/);
      const petrovich = parsed.fioNominative;
      expect(petrovich).toMatch(/^Козлов Максим П[её]трович$/);
      expect(parsed.fioNominative).not.toContain('Баранов');
    });

    it('5) Order with initials in body/title ("О командировании Иванова И.И.", № 301)', () => {
      const orderText = `
ТОО «ТрансАвто»
ПРИКАЗ № 301
от 20.04.2026 г.
г. Шымкент

О командировании Иванова И.И.

ПРИКАЗЫВАЮ:
1. Командировать Иванова И.И., водителя-экспедитора, в город Туркестан сроком на 3 дня с 21.04.2026 по 23.04.2026 г.

Генеральный директор: _________________ Мусин А.К.
`;

      const parsed = parseOrderText(orderText);

      expect(parsed.orderNumber).toBe('301');
      expect(parsed.fioNominative).toBe('Иванов И.И.');
      expect(parsed.fioNominative).not.toContain('Мусин');
    });

    it('6) Order with multiple employees in body: candidates list contains all of them', () => {
      const orderText = `
ТОО «Инновационные Решения»
ПРИКАЗ № 55-од
от 14.05.2026 г.
г. Алматы

О премировании работников по итогам месяца

ПРИКАЗЫВАЮ:
1. Премировать следующих работников:
- Петровой Анне Сергеевне, старшему бухгалтеру;
- Сидорову Алексею Викторовичу, ведущему разработчику;
- Васильеву Дмитрию Павловичу, системному аналитику.

Директор: _________________ Смирнов В.П.
`;

      const parsed = parseOrderText(orderText);

      expect(parsed.orderNumber).toBe('55-од');
      expect(parsed.fioCandidates.length).toBeGreaterThanOrEqual(3);

      const candidateNames = parsed.fioCandidates.map((c) => c.nominative);
      expect(candidateNames.some((n) => n.includes('Петрова'))).toBe(true);
      expect(candidateNames.some((n) => n.includes('Сидоров'))).toBe(true);
      expect(candidateNames.some((n) => n.includes('Васильев'))).toBe(true);
    });

    it('7) Template order with blank "№ ____": returns null orderNumber', () => {
      const orderText = `
ТОО «Стандарт-Шаблон»
ПРИКАЗ № _____
от «___» _________ 2026 г.
г. Алматы

О переводе работника

ПРИКАЗЫВАЮ:
1. Перевести Смирнова Артема Олеговича на должность начальника отдела с 01.06.2026 г.

Директор: _________________ Кузнецов И.В.
`;

      const parsed = parseOrderText(orderText);

      expect(parsed.orderNumber).toBeNull();
      expect(parsed.orderNumberConfidence).toBe('none');
    });
  });

  describe('extractOrderNumber', () => {
    it('extracts standard order numbers with Cyrillic suffixes and slashes', () => {
      expect(extractOrderNumber('ПРИКАЗ № 124-к от 15.01.2026').number).toBe('124-к');
      expect(extractOrderNumber('БҰЙРЫҚ № 45/жқ').number).toBe('45/жқ');
      expect(extractOrderNumber('ПРИКАЗ № 17-лс').number).toBe('17-лс');
      expect(extractOrderNumber('Приказ No 88/2').number).toBe('88/2');
    });

    it('extracts space-separated order series like "650 ПР" without capturing street abbreviations', () => {
      expect(extractOrderNumber('ПРИКАЗ № 650 ПР от 12.11.2026').number).toBe('650 ПР');
      expect(extractOrderNumber('БҰЙРЫҚ № 650 ПР').number).toBe('650 ПР');
      expect(extractOrderNumber('ПРИКАЗ № 301 пр. Абая').number).toBe('301');
    });

    it('extracts order number placed on newline after keyword', () => {
      const text = `
ПРИКАЗ
№ 402-од
от 10 марта 2026 года
`;
      const res = extractOrderNumber(text);
      expect(res.number).toBe('402-од');
      expect(res.confidence).toMatch(/^(high|medium)$/);
    });

    it('rejects blank placeholder patterns', () => {
      expect(extractOrderNumber('ПРИКАЗ № _____').number).toBeNull();
      expect(extractOrderNumber('ПРИКАЗ № --').number).toBeNull();
      expect(extractOrderNumber('БҰЙРЫҚ № ').number).toBeNull();
    });

    it('ignores 12-digit БИН/ИИН or financial identifiers', () => {
      const text = 'БИН 010240001234, ИИН 900101300200, расчетный счет KZ123456789012345678';
      const res = extractOrderNumber(text);
      expect(res.number).toBeNull();
      expect(res.confidence).toBe('none');
    });
  });

  describe('extractOrderDate', () => {
    it('extracts standard DD.MM.YYYY dates', () => {
      expect(extractOrderDate('ПРИКАЗ № 124-к от 15.01.2026 г.')).toMatch(/15\.01\.2026/);
      expect(extractOrderDate('БҰЙРЫҚ № 10\n05.03.2026 ж.')).toMatch(/05\.03\.2026/);
    });

    it('extracts dates with Russian month words', () => {
      const date = extractOrderDate('«12» февраля 2026 г.');
      expect(date).toMatch(/12\.02\.2026/);
    });

    it('extracts dates with Kazakh month words', () => {
      const date = extractOrderDate('«12» ақпан 2026 ж.');
      expect(date).toMatch(/12\.02\.2026/);
    });

    it('returns null for blank placeholder dates', () => {
      expect(extractOrderDate('от «___» _________ 2026 г.')).toBeNull();
      expect(extractOrderDate('Текст без каких-либо дат')).toBeNull();
    });
  });

  describe('extractEmployeeFio', () => {
    it('assigns high score to employee associated with employment action verbs in body', () => {
      const text = `
ПРИКАЗ № 10
ПРИКАЗЫВАЮ:
1. Принять Иванова Ивана Ивановича на должность инженера.
Директор: Сидоров А.В.
`;
      const result = extractEmployeeFio(text);
      expect(result.best).not.toBeNull();
      expect(result.best?.nominative).toBe('Иванов Иван Иванович');
      expect(result.best?.zone).toBe('body');
      expect(result.confidence).toMatch(/^(high|medium)$/);
    });

    it('distinguishes employee from director signature', () => {
      const text = `
ПРИКАЗ № 20
Командировать Петрову Анну Сергеевну в филиал.
Генеральный директор ТОО: Мусин К.А.
`;
      const result = extractEmployeeFio(text);
      expect(result.best?.nominative).toBe('Петрова Анна Сергеевна');
      expect(result.candidates.some((c) => c.nominative.includes('Мусин'))).toBe(true);
    });

    it('returns empty result when no FIO is found', () => {
      const text = 'Инструкция по технике безопасности при проведении сварочных работ.';
      const result = extractEmployeeFio(text);
      expect(result.best).toBeNull();
      expect(result.confidence).toBe('none');
    });
  });
});
