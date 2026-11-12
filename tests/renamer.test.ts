import { describe, it, expect } from 'vitest';
import {
  sanitizeFileNamePart,
  formatFioBySettings,
  buildBaseFileName,
  resolveBatchFileNames,
  DEFAULT_NAMING_SETTINGS,
  TEMPLATE_PRESETS,
} from '../src/core/renamer';
import type { NamingSettings, OrderDocumentItem, ParsedOrder } from '../src/core/types';

function createMockItem(partial: Partial<OrderDocumentItem>): OrderDocumentItem {
  const dummyParsed: ParsedOrder = {
    orderNumber: partial.editedNumber ?? '10',
    orderNumberConfidence: 'high',
    orderDate: '15.01.2026',
    fioRaw: partial.editedFio ?? 'Иванов Иван Иванович',
    fioNominative: partial.editedFio ?? 'Иванов Иван Иванович',
    fioConfidence: 'high',
    fioCandidates: [],
    warnings: [],
  };

  return {
    id: partial.id ?? Math.random().toString(36).substring(2, 9),
    file: new File([], partial.originalName ?? 'test.docx'),
    originalName: partial.originalName ?? 'test.docx',
    extension: partial.extension ?? 'docx',
    size: 1024,
    status: 'ready',
    extractedText: 'sample text',
    usedOcr: false,
    parsed: partial.parsed ?? dummyParsed,
    editedNumber: partial.editedNumber ?? '10',
    editedFio: partial.editedFio ?? 'Иванов Иван Иванович',
    fioManuallyEdited: partial.fioManuallyEdited ?? false,
    finalFileName: '',
    hasCollisionSuffix: false,
    ...partial,
  };
}

describe('renamer', () => {
  describe('DEFAULT_NAMING_SETTINGS and TEMPLATE_PRESETS', () => {
    it('defines valid DEFAULT_NAMING_SETTINGS matching ЭХД-safe standard "650 ПР Искалиев Т."', () => {
      expect(DEFAULT_NAMING_SETTINGS).toBeDefined();
      expect(DEFAULT_NAMING_SETTINGS.template).toBe('{number} {fio}');
      expect(DEFAULT_NAMING_SETTINGS.normalizeFioCase).toBeTypeOf('boolean');
      expect(['full', 'short', 'initial', 'surname']).toContain(DEFAULT_NAMING_SETTINGS.fioFormat);
      expect(DEFAULT_NAMING_SETTINGS.fioFormat).toBe('initial');
      expect([' ', '']).toContain(DEFAULT_NAMING_SETTINGS.slashReplacement);
      expect(DEFAULT_NAMING_SETTINGS.missingNumberLabel).toBeTypeOf('string');
      expect(DEFAULT_NAMING_SETTINGS.missingFioLabel).toBe('Без ФИО');
    });

    it('defines TEMPLATE_PRESETS with standard preset first and only letters, digits, spaces, and dots', () => {
      expect(TEMPLATE_PRESETS).toBeDefined();
      expect(TEMPLATE_PRESETS.length).toBeGreaterThan(0);
      expect(TEMPLATE_PRESETS[0].id).toBe('standard');
      expect(TEMPLATE_PRESETS[0].label).toBe('650 ПР Искалиев Т.');
      expect(TEMPLATE_PRESETS[0].template).toBe('{number} {fio}');
      for (const preset of TEMPLATE_PRESETS) {
        expect(preset.label).toMatch(/^[\p{L}\p{N}.\s]+$/u);
        expect(preset.template).not.toMatch(/[_№-]/);
      }
    });
  });

  describe('sanitizeFileNamePart', () => {
    it('allows only letters, digits, spaces, and dots (.)', () => {
      const forbidden = 'Doc<1>:Name"With/Slash\\Backslash|Pipe?Question*Star_Under-Hyphen(Paren)';
      const sanitized = sanitizeFileNamePart(forbidden);

      expect(sanitized).toMatch(/^[\p{L}\p{N}.\s]+$/u);
      expect(sanitized).not.toMatch(/[_<>:"/\\|?*№()-]/);
      expect(sanitized.length).toBeGreaterThan(0);
    });

    it('respects slashReplacement option for order number slashes', () => {
      expect(sanitizeFileNamePart('124/к', ' ')).toBe('124 к');
      expect(sanitizeFileNamePart('650/ПР', ' ')).toBe('650 ПР');
      expect(sanitizeFileNamePart('124/к', '')).toBe('124к');
    });

    it('strips underscores, hyphens, №, parentheses, and all punctuation except dot', () => {
      expect(sanitizeFileNamePart('Приказ № 650-ПР «Искалиев_Т.» #1 & % (копия)')).toBe(
        'Приказ 650 ПР Искалиев Т. 1 копия'
      );
      expect(sanitizeFileNamePart('№650_ПР')).toBe('650 ПР');
      expect(sanitizeFileNamePart('124–к')).toBe('124 к');
      expect(sanitizeFileNamePart('12.02.2026')).toBe('12.02.2026');
    });

    it('handles Windows reserved device names (CON, PRN, AUX, NUL, COM1..COM9, LPT1..LPT9)', () => {
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1', 'con', 'aux', 'nul'];
      for (const resName of reservedNames) {
        const sanitized = sanitizeFileNamePart(resName);
        // It must NOT be identical to the bare reserved name (case-insensitive)
        expect(sanitized.toLowerCase()).not.toBe(resName.toLowerCase());
      }
    });

    it('strips trailing dots and whitespace forbidden in Windows filenames', () => {
      expect(sanitizeFileNamePart('file.name...   ')).toBe('file.name');
      expect(sanitizeFileNamePart('  order   ')).toBe('order');
      expect(sanitizeFileNamePart('test.')).toBe('test');
    });

    it('collapses multiple whitespace characters into a single space', () => {
      expect(sanitizeFileNamePart('Приказ    12')).toBe('Приказ 12');
    });
  });

  describe('formatFioBySettings', () => {
    it('returns full nominative FIO when normalizeFioCase is true and fioFormat is full', () => {
      const result = formatFioBySettings(
        'Иванова Ивана Ивановича',
        'Иванов Иван Иванович',
        { normalizeFioCase: true, fioFormat: 'full' }
      );
      expect(result).toBe('Иванов Иван Иванович');
    });

    it('returns raw FIO when normalizeFioCase is false and fioFormat is full', () => {
      const result = formatFioBySettings(
        'Иванова Ивана Ивановича',
        'Иванов Иван Иванович',
        { normalizeFioCase: false, fioFormat: 'full' }
      );
      expect(result).toBe('Иванова Ивана Ивановича');
    });

    it('returns single-initial FIO ("Искалиев Т.") when fioFormat is initial', () => {
      const result = formatFioBySettings(
        'Искалиеву Талгату Бекболатовичу',
        'Искалиев Талгат Бекболатович',
        { normalizeFioCase: true, fioFormat: 'initial' }
      );
      expect(result).toBe('Искалиев Т.');
    });

    it('returns short FIO ("Иванов И.И.") when fioFormat is short', () => {
      const result = formatFioBySettings(
        'Иванова Ивана Ивановича',
        'Иванов Иван Иванович',
        { normalizeFioCase: true, fioFormat: 'short' }
      );
      expect(result).toBe('Иванов И.И.');
    });

    it('returns surname only ("Иванов") when fioFormat is surname', () => {
      const result = formatFioBySettings(
        'Иванова Ивана Ивановича',
        'Иванов Иван Иванович',
        { normalizeFioCase: true, fioFormat: 'surname' }
      );
      expect(result).toBe('Иванов');
    });

    it('handles raw surname when normalizeFioCase is false and fioFormat is surname', () => {
      const result = formatFioBySettings(
        'Петровой А.С.',
        'Петрова А.С.',
        { normalizeFioCase: false, fioFormat: 'surname' }
      );
      expect(result).toBe('Петровой');
    });
  });

  describe('buildBaseFileName', () => {
    const settings: NamingSettings = {
      template: '{number} {fio}',
      normalizeFioCase: true,
      fioFormat: 'full',
      slashReplacement: ' ',
      missingNumberLabel: 'БН',
      missingFioLabel: 'Без ФИО',
    };

    it('produces exact default format "650 ПР Искалиев Т." using DEFAULT_NAMING_SETTINGS', () => {
      const fio = formatFioBySettings(
        'Искалиева Талгата Маратовича',
        'Искалиев Талгат Маратович',
        DEFAULT_NAMING_SETTINGS
      );
      const name = buildBaseFileName({
        orderNumber: '№ 650-ПР',
        fio,
        originalName: 'Приказ №650 «ПР»_черновик.docx',
        settings: DEFAULT_NAMING_SETTINGS,
      });
      expect(name).toBe('650 ПР Искалиев Т.');
      expect(name).toMatch(/^[\p{L}\p{N}.\s]+$/u);
    });

    it('builds filename using {number} {fio} template without underscores or hyphens', () => {
      const name = buildBaseFileName({
        orderNumber: '124-к',
        fio: 'Иванов Иван Иванович',
        originalName: 'scan.docx',
        settings,
      });
      expect(name).toBe('124 к Иванов Иван Иванович');
    });

    it('builds filename with {date} {number} {fio}', () => {
      const customSettings = {
        ...settings,
        template: '{date} {number} {fio}',
      };
      const name = buildBaseFileName({
        orderNumber: '88',
        fio: 'Петров П.П.',
        orderDate: '12.02.2026',
        originalName: 'doc.pdf',
        settings: customSettings,
      });
      expect(name).toBe('12.02.2026 88 Петров П.П.');
    });

    it('builds filename using original name placeholder {orig}', () => {
      const customSettings = {
        ...settings,
        template: '{orig} {number}',
      };
      const name = buildBaseFileName({
        orderNumber: '42',
        fio: 'Иванов И.И.',
        originalName: 'My_Order-Draft.pdf',
        settings: customSettings,
      });
      // {orig} should refer to base name without .pdf extension and without _ or -
      expect(name).toBe('My Order Draft 42');
    });

    it('uses fallbacks when number or FIO is missing or empty', () => {
      const nameNoNumber = buildBaseFileName({
        orderNumber: '',
        fio: 'Иванов Иван Иванович',
        originalName: 'scan.docx',
        settings,
      });
      expect(nameNoNumber).toBe('БН Иванов Иван Иванович');

      const nameNoFio = buildBaseFileName({
        orderNumber: '15',
        fio: '',
        originalName: 'scan.docx',
        settings,
      });
      expect(nameNoFio).toBe('15 Без ФИО');
    });

    it('handles missing date cleanly without leaving dangling double spaces', () => {
      const customSettings = {
        ...settings,
        template: '{date} {number} {fio}',
      };
      const name = buildBaseFileName({
        orderNumber: '15',
        fio: 'Иванов',
        orderDate: null,
        originalName: 'scan.docx',
        settings: customSettings,
      });
      expect(name).toBe('15 Иванов');
    });
  });

  describe('resolveBatchFileNames', () => {
    const settings: NamingSettings = {
      template: '{number} {fio}',
      normalizeFioCase: true,
      fioFormat: 'initial',
      slashReplacement: ' ',
      missingNumberLabel: 'БН',
      missingFioLabel: 'Без ФИО',
    };

    it('assigns finalFileName preserving file extensions without underscores or extra symbols', () => {
      const items: OrderDocumentItem[] = [
        createMockItem({ originalName: 'doc1.docx', extension: 'docx', editedNumber: '650 ПР', editedFio: 'Искалиев Т.' }),
        createMockItem({ originalName: 'doc2.pdf', extension: 'pdf', editedNumber: '11', editedFio: 'Петров П.' }),
      ];

      const resolved = resolveBatchFileNames(items, settings);

      expect(resolved[0].finalFileName).toBe('650 ПР Искалиев Т..docx');
      expect(resolved[0].hasCollisionSuffix).toBe(false);

      expect(resolved[1].finalFileName).toBe('11 Петров П..pdf');
      expect(resolved[1].hasCollisionSuffix).toBe(false);
    });

    it('deduplicates collisions with numeric suffixes without parentheses', () => {
      const items: OrderDocumentItem[] = [
        createMockItem({ originalName: 'a.docx', extension: 'docx', editedNumber: '12', editedFio: 'Сидоров' }),
        createMockItem({ originalName: 'b.docx', extension: 'docx', editedNumber: '12', editedFio: 'Сидоров' }),
        createMockItem({ originalName: 'c.docx', extension: 'docx', editedNumber: '12', editedFio: 'Сидоров' }),
      ];

      const resolved = resolveBatchFileNames(items, settings);

      expect(resolved[0].finalFileName).toBe('12 Сидоров.docx');
      expect(resolved[0].hasCollisionSuffix).toBe(false);

      expect(resolved[1].finalFileName).toBe('12 Сидоров 2.docx');
      expect(resolved[1].hasCollisionSuffix).toBe(true);

      expect(resolved[2].finalFileName).toBe('12 Сидоров 3.docx');
      expect(resolved[2].hasCollisionSuffix).toBe(true);
    });

    it('detects collisions in case-insensitive manner (Windows compatibility)', () => {
      const items: OrderDocumentItem[] = [
        createMockItem({ originalName: 'lower.docx', extension: 'docx', editedNumber: '15', editedFio: 'иванов' }),
        createMockItem({ originalName: 'upper.docx', extension: 'docx', editedNumber: '15', editedFio: 'ИВАНОВ' }),
      ];

      const resolved = resolveBatchFileNames(items, { ...settings, normalizeFioCase: false });

      expect(resolved[0].hasCollisionSuffix).toBe(false);
      expect(resolved[1].hasCollisionSuffix).toBe(true);
      expect(resolved[1].finalFileName).toMatch(/ 2\.docx$/i);
    });
  });
});
