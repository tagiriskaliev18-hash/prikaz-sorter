import { describe, it, expect } from 'vitest';
import {
  normalizeFioToNominative,
  formatFioShort,
  extractSurname,
} from '../src/core/fioDeclension';

describe('fioDeclension', () => {
  describe('normalizeFioToNominative - Male full FIO in oblique cases', () => {
    it('normalizes Genitive case (Родительный падеж)', () => {
      expect(normalizeFioToNominative('Иванова Ивана Ивановича')).toBe('Иванов Иван Иванович');
      expect(normalizeFioToNominative('Смирнова Алексея Петровича')).toBe('Смирнов Алексей Петрович');
      expect(normalizeFioToNominative('Кузнецова Сергея Николаевича')).toBe('Кузнецов Сергей Николаевич');
      expect(normalizeFioToNominative('Морозова Михаила Александровича')).toBe('Морозов Михаил Александрович');
    });

    it('normalizes Dative case (Дательный падеж)', () => {
      expect(normalizeFioToNominative('Иванову Ивану Ивановичу')).toBe('Иванов Иван Иванович');
      expect(normalizeFioToNominative('Никитину Дмитрию Олеговичу')).toBe('Никитин Дмитрий Олегович');
      expect(normalizeFioToNominative('Васильеву Андрею Егоровичу')).toBe('Васильев Андрей Егорович');
      expect(normalizeFioToNominative('Соколову Артему Денисовичу')).toBe('Соколов Артем Денисович');
    });

    it('normalizes Accusative case (Винительный падеж)', () => {
      expect(normalizeFioToNominative('Иванова Ивана Ивановича')).toBe('Иванов Иван Иванович');
      expect(normalizeFioToNominative('Козлова Максима Петровича')).toBe('Козлов Максим Петрович');
    });

    it('normalizes Instrumental case (Творительный падеж)', () => {
      expect(normalizeFioToNominative('Сидоровым Алексеем Викторовичем')).toBe('Сидоров Алексей Викторович');
      expect(normalizeFioToNominative('Ивановым Иваном Ивановичем')).toBe('Иванов Иван Иванович');
      expect(normalizeFioToNominative('Поповым Валерием Романовичем')).toBe('Попов Валерий Романович');
    });
  });

  describe('normalizeFioToNominative - Female full FIO in oblique cases', () => {
    it('normalizes Genitive case (Родительный падеж)', () => {
      expect(normalizeFioToNominative('Петровой Анны Сергеевны')).toBe('Петрова Анна Сергеевна');
      expect(normalizeFioToNominative('Сидоровой Елены Михайловны')).toBe('Сидорова Елена Михайловна');
      expect(normalizeFioToNominative('Кузнецовой Ольги Владимировны')).toBe('Кузнецова Ольга Владимировна');
    });

    it('normalizes Dative case (Дательный падеж)', () => {
      expect(normalizeFioToNominative('Петровой Анне Сергеевне')).toBe('Петрова Анна Сергеевна');
      expect(normalizeFioToNominative('Сидоровой Елене Михайловне')).toBe('Сидорова Елена Михайловна');
      expect(normalizeFioToNominative('Федоровой Наталье Игоревне')).toBe('Федорова Наталья Игоревна');
    });

    it('normalizes Accusative case (Винительный падеж)', () => {
      expect(normalizeFioToNominative('Петрову Анну Сергеевну')).toBe('Петрова Анна Сергеевна');
      expect(normalizeFioToNominative('Сидорову Елену Васильевну')).toBe('Сидорова Елена Васильевна');
      expect(normalizeFioToNominative('Ковалеву Татьяну Павловну')).toBe('Ковалева Татьяна Павловна');
    });

    it('normalizes Instrumental case (Творительный падеж)', () => {
      expect(normalizeFioToNominative('Петровой Анной Сергеевной')).toBe('Петрова Анна Сергеевна');
      expect(normalizeFioToNominative('Ивановой Марией Алексеевной')).toBe('Иванова Мария Алексеевна');
    });
  });

  describe('normalizeFioToNominative - Initials before & after surname', () => {
    it('normalizes oblique initials after surname to Nominative with format "Фамилия И.О."', () => {
      expect(normalizeFioToNominative('Петровой А.С.')).toBe('Петрова А.С.');
      expect(normalizeFioToNominative('Иванова И.И.', { caseHint: 'gen_acc' })).toBe('Иванов И.И.');
      expect(normalizeFioToNominative('Иванову И.И.')).toBe('Иванов И.И.');
      expect(normalizeFioToNominative('Сидоровым А.В.')).toBe('Сидоров А.В.');
      expect(normalizeFioToNominative('Петрову А.С.', { caseHint: 'gen_acc' })).toBe('Петрова А.С.');
    });

    it('normalizes initials placed BEFORE surname to "Фамилия И.О."', () => {
      expect(normalizeFioToNominative('И.И. Иванова', { caseHint: 'gen_acc' })).toBe('Иванов И.И.');
      expect(normalizeFioToNominative('А.С. Петровой')).toBe('Петрова А.С.');
      expect(normalizeFioToNominative('И.И. Иванову')).toBe('Иванов И.И.');
      expect(normalizeFioToNominative('А.В. Сидоровым')).toBe('Сидоров А.В.');
    });

    it('preserves already nominative surname with initials', () => {
      expect(normalizeFioToNominative('Иванов И.И.')).toBe('Иванов И.И.');
      expect(normalizeFioToNominative('Петрова А.С.')).toBe('Петрова А.С.');
      expect(normalizeFioToNominative('И.И. Иванов')).toBe('Иванов И.И.');
    });
  });

  describe('normalizeFioToNominative - Indeclinable surnames NOT corrupted', () => {
    it('preserves Ukrainian surnames ending in -ко', () => {
      expect(normalizeFioToNominative('Коваленко Дмитрия Сергеевича')).toBe('Коваленко Дмитрий Сергеевич');
      expect(normalizeFioToNominative('Шевченко Тарасу Григорьевичу')).toBe('Шевченко Тарас Григорьевич');
      expect(normalizeFioToNominative('Бондаренко Елене Викторовне')).toBe('Бондаренко Елена Викторовна');
      expect(normalizeFioToNominative('Коваленко А.В.')).toBe('Коваленко А.В.');
    });

    it('preserves surnames ending in -ых / -их', () => {
      expect(normalizeFioToNominative('Черных Сергея Петровича')).toBe('Черных Сергей Петрович');
      expect(normalizeFioToNominative('Долгих Елене Николаевне')).toBe('Долгих Елена Николаевна');
      expect(normalizeFioToNominative('Седых Александра Викторовича')).toBe('Седых Александр Викторович');
    });

    it('preserves monosyllabic / foreign surnames (Ким, Пак)', () => {
      expect(normalizeFioToNominative('Ким Андрея Викторовича')).toBe('Ким Андрей Викторович');
      expect(normalizeFioToNominative('Ким Светлане Анатольевне')).toBe('Ким Светлана Анатольевна');
      expect(normalizeFioToNominative('Пак Дмитрию Олеговичу')).toBe('Пак Дмитрий Олегович');
    });

    it('preserves archaic surnames ending in -о / -аго (Дурново, Живаго)', () => {
      const durnovo = normalizeFioToNominative('Дурново Петра Николаевича');
      expect(durnovo).toMatch(/^Дурново П[её]тр Николаевич$/);
      expect(normalizeFioToNominative('Живаго Юрия Андреевича')).toBe('Живаго Юрий Андреевич');
    });
  });

  describe('normalizeFioToNominative - Kazakh patronymics and names', () => {
    it('handles Kazakh patronymics ending with -ұлы / -кызы / -қызы / -улы', () => {
      expect(normalizeFioToNominative('Ахметова Серика Нұрланұлы')).toBe('Ахметов Серик Нұрланұлы');
      expect(normalizeFioToNominative('Ахметову Серику Нұрланұлы')).toBe('Ахметов Серик Нұрланұлы');
      expect(normalizeFioToNominative('Сулейменовой Айгуль Маратқызы')).toBe('Сулейменова Айгуль Маратқызы');
      expect(normalizeFioToNominative('Сулейменову Айгуль Маратқызы')).toBe('Сулейменова Айгуль Маратқызы');
    });

    it('handles Kazakh names without patronymic', () => {
      expect(normalizeFioToNominative('Талғатова Даурена')).toBe('Талғатов Даурен');
      expect(normalizeFioToNominative('Талғатову Даурену')).toBe('Талғатов Даурен');
    });

    it('handles Kazakh specific Cyrillic letters (ә, ғ, қ, ң, ө, ұ, ү, һ, і)', () => {
      expect(normalizeFioToNominative('Қасымова Бауыржана Серікұлы')).toBe('Қасымов Бауыржан Серікұлы');
    });
  });

  describe('normalizeFioToNominative - Fleeting vowels (беглые гласные)', () => {
    it('restores fleeting vowel "е" in Павел (Павла -> Павел)', () => {
      expect(normalizeFioToNominative('Иванова Павла Сергеевича')).toBe('Иванов Павел Сергеевич');
      expect(normalizeFioToNominative('Иванову Павлу Сергеевичу')).toBe('Иванов Павел Сергеевич');
    });

    it('restores fleeting vowel "е" in Лев (Льва -> Лев)', () => {
      expect(normalizeFioToNominative('Толстого Льва Николаевича')).toBe('Толстой Лев Николаевич');
      expect(normalizeFioToNominative('Толстому Льву Николаевичу')).toBe('Толстой Лев Николаевич');
    });

    it('restores fleeting vowel in Петр (Петра -> Петр / Пётр)', () => {
      const petr = normalizeFioToNominative('Козлова Петра Алексеевича');
      expect(petr).toMatch(/^Козлов П[её]тр Алексеевич$/);
    });
  });

  describe('normalizeFioToNominative - General robustness', () => {
    it('preserves already nominative full FIO', () => {
      expect(normalizeFioToNominative('Иванов Иван Иванович')).toBe('Иванов Иван Иванович');
      expect(normalizeFioToNominative('Петрова Анна Сергеевна')).toBe('Петрова Анна Сергеевна');
    });

    it('trims leading/trailing whitespace and normalizes internal spaces', () => {
      expect(normalizeFioToNominative('   Петровой   Анне   Сергеевне   ')).toBe('Петрова Анна Сергеевна');
    });

    it('handles empty or blank input gracefully', () => {
      expect(normalizeFioToNominative('')).toBe('');
      expect(normalizeFioToNominative('   ')).toBe('');
    });
  });

  describe('formatFioShort', () => {
    it('converts full nominative FIO to "Фамилия И.О."', () => {
      expect(formatFioShort('Иванов Иван Иванович')).toBe('Иванов И.И.');
      expect(formatFioShort('Петрова Анна Сергеевна')).toBe('Петрова А.С.');
      expect(formatFioShort('Сидоров Алексей Викторович')).toBe('Сидоров А.В.');
    });

    it('handles two-part names (Фамилия Имя)', () => {
      expect(formatFioShort('Иванов Иван')).toBe('Иванов И.');
      expect(formatFioShort('Талғатов Даурен')).toBe('Талғатов Д.');
    });

    it('preserves already short FIO', () => {
      expect(formatFioShort('Иванов И.И.')).toBe('Иванов И.И.');
      expect(formatFioShort('Петрова А.С.')).toBe('Петрова А.С.');
    });

    it('handles single surname', () => {
      expect(formatFioShort('Иванов')).toBe('Иванов');
      expect(formatFioShort('Коваленко')).toBe('Коваленко');
    });

    it('handles Kazakh full names with -ұлы / -қызы patronymics', () => {
      const shortFio = formatFioShort('Ахметов Серик Нұрланұлы');
      expect(shortFio).toMatch(/^Ахметов С\./);
    });
  });

  describe('extractSurname', () => {
    it('extracts surname from three-part full nominative FIO', () => {
      expect(extractSurname('Иванов Иван Иванович')).toBe('Иванов');
      expect(extractSurname('Петрова Анна Сергеевна')).toBe('Петрова');
      expect(extractSurname('Коваленко Дмитрий Сергеевич')).toBe('Коваленко');
      expect(extractSurname('Ахметов Серик Нұрланұлы')).toBe('Ахметов');
    });

    it('extracts surname from short FIO with initials', () => {
      expect(extractSurname('Иванов И.И.')).toBe('Иванов');
      expect(extractSurname('Петрова А.С.')).toBe('Петрова');
      expect(extractSurname('И.И. Иванов')).toBe('Иванов');
    });

    it('extracts surname from single word or two-part FIO', () => {
      expect(extractSurname('Иванов')).toBe('Иванов');
      expect(extractSurname('Черных')).toBe('Черных');
      expect(extractSurname('Сидоров Алексей')).toBe('Сидоров');
    });

    it('handles extra whitespace cleanly', () => {
      expect(extractSurname('   Сидорова   Елена   ')).toBe('Сидорова');
    });
  });
});
