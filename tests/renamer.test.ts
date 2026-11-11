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
    it('defines valid DEFAULT_NAMING_SETTINGS with all required keys', () => {
      expect(DEFAULT_NAMING_SETTINGS).toBeDefined();
      expect(DEFAULT_NAMING_SETTINGS.template).toBeTypeOf('string');
      expect(DEFAULT_NAMING_SETTINGS.template.length).toBeGreaterThan(0);
      expect(DEFAULT_NAMING_SETTINGS.normalizeFioCase).toBeTypeOf('boolean');
      expect(['full', 'short', 'surname']).toContain(DEFAULT_NAMING_SETTINGS.fioFormat);
      expect(['-', '_', '']).toContain(DEFAULT_NAMING_SETTINGS.slashReplacement);
      expect(DEFAULT_NAMING_SETTINGS.missingNumberLabel).toBeTypeOf('string');
      expect(DEFAULT_NAMING_SETTINGS.missingFioLabel).toBeTypeOf('string');
    });

    it('defines TEMPLATE_PRESETS with available presets', () => {
      expect(TEMPLATE_PRESETS).toBeDefined();
      expect(Object.keys(TEMPLATE_PRESETS).length).toBeGreaterThan(0);
    });
  });

  describe('sanitizeFileNamePart', () => {
    it('replaces or removes forbidden Windows characters (< > : " / \\ | ? *)', () => {
      const forbidden = 'Doc<1>:Name"With/Slash\\Backslash|Pipe?Question*Star';
      const sanitized = sanitizeFileNamePart(forbidden);

      expect(sanitized).not.toMatch(/[<>:"/\\|?*]/);
      expect(sanitized.length).toBeGreaterThan(0);
    });

    it('respects slashReplacement option for order number slashes', () => {
      expect(sanitizeFileNamePart('124/к', '-')).toBe('124-к');
      expect(sanitizeFileNamePart('124/к', '_')).toBe('124_к');
      expect(sanitizeFileNamePart('124/к', '')).toBe('124к');
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
      expect(sanitizeFileNamePart('Приказ    №   12')).toBe('Приказ № 12');
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
      slashReplacement: '-',
      missingNumberLabel: 'БН',
      missingFioLabel: 'Без_ФИО',
    };

    it('builds filename using {number} {fio} template', () => {
      const name = buildBaseFileName({
        orderNumber: '124-к',
        fio: 'Иванов Иван Иванович',
        originalName: 'scan.docx',
        settings,
      });
      expect(name).toBe('124-к Иванов Иван Иванович');
    });

    it('builds filename with {date}_{number}_{fio}', () => {
      const customSettings = {
        ...settings,
        template: '{date}_{number}_{fio}',
      };
      const name = buildBaseFileName({
        orderNumber: '88',
        fio: 'Петров П.П.',
        orderDate: '12.02.2026',
        originalName: 'doc.pdf',
        settings: customSettings,
      });
      expect(name).toContain('12.02.2026');
      expect(name).toContain('88');
      expect(name).toContain('Петров П.П.');
    });

    it('builds filename using original name placeholder {orig}', () => {
      const customSettings = {
        ...settings,
        template: '{orig} - {number}',
      };
      const name = buildBaseFileName({
        orderNumber: '42',
        fio: 'Иванов И.И.',
        originalName: 'MyOrderDraft.pdf',
        settings: customSettings,
      });
      // {orig} should refer to base name without .pdf extension
      expect(name).toBe('MyOrderDraft - 42');
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
      expect(nameNoFio).toBe('15 Без_ФИО');
    });

    it('handles missing date cleanly without leaving dangling double delimiters', () => {
      const customSettings = {
        ...settings,
        template: '{date}_{number}_{fio}',
      };
      const name = buildBaseFileName({
        orderNumber: '15',
        fio: 'Иванов',
        orderDate: null,
        originalName: 'scan.docx',
        settings: customSettings,
      });
      // Should not start with an orphaned leading underscore or contain double underscores
      expect(name).not.toMatch(/^_+/);
      expect(name).not.toContain('__');
      expect(name).toContain('15');
      expect(name).toContain('Иванов');
    });
  });

  describe('resolveBatchFileNames', () => {
    const settings: NamingSettings = {
      template: '{number}_{fio}',
      normalizeFioCase: true,
      fioFormat: 'full',
      slashReplacement: '-',
      missingNumberLabel: 'БН',
      missingFioLabel: 'Без_ФИО',
    };

    it('assigns finalFileName preserving file extensions', () => {
      const items: OrderDocumentItem[] = [
        createMockItem({ originalName: 'doc1.docx', extension: 'docx', editedNumber: '10', editedFio: 'Иванов' }),
        createMockItem({ originalName: 'doc2.pdf', extension: 'pdf', editedNumber: '11', editedFio: 'Петров' }),
      ];

      const resolved = resolveBatchFileNames(items, settings);

      expect(resolved[0].finalFileName).toBe('10_Иванов.docx');
      expect(resolved[0].hasCollisionSuffix).toBe(false);

      expect(resolved[1].finalFileName).toBe('11_Петров.pdf');
      expect(resolved[1].hasCollisionSuffix).toBe(false);
    });

    it('deduplicates collisions with sequential (2), (3) suffixes', () => {
      const items: OrderDocumentItem[] = [
        createMockItem({ originalName: 'a.docx', extension: 'docx', editedNumber: '12', editedFio: 'Сидоров' }),
        createMockItem({ originalName: 'b.docx', extension: 'docx', editedNumber: '12', editedFio: 'Сидоров' }),
        createMockItem({ originalName: 'c.docx', extension: 'docx', editedNumber: '12', editedFio: 'Сидоров' }),
      ];

      const resolved = resolveBatchFileNames(items, settings);

      expect(resolved[0].finalFileName).toBe('12_Сидоров.docx');
      expect(resolved[0].hasCollisionSuffix).toBe(false);

      expect(resolved[1].finalFileName).toBe('12_Сидоров (2).docx');
      expect(resolved[1].hasCollisionSuffix).toBe(true);

      expect(resolved[2].finalFileName).toBe('12_Сидоров (3).docx');
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
      expect(resolved[1].finalFileName).toMatch(/\(2\)\.docx$/i);
    });
  });
});
