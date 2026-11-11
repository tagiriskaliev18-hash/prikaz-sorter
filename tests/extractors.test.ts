import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  detectExtension,
  extractTextFromDocxBuffer,
  extractTextFromOdtBuffer,
  extractTextFromRtfBytes,
  extractTextFromTxtBytes,
} from '../src/core/extractors';
import { parseOrderText } from '../src/core/orderParser';

describe('extractors', () => {
  describe('detectExtension', () => {
    it('detects all supported document and image extensions regardless of case', () => {
      expect(detectExtension('order.docx')).toBe('docx');
      expect(detectExtension('ORDER.DOCX')).toBe('docx');
      expect(detectExtension('prikaz.pdf')).toBe('pdf');
      expect(detectExtension('SCAN.PDF')).toBe('pdf');
      expect(detectExtension('document.odt')).toBe('odt');
      expect(detectExtension('contract.rtf')).toBe('rtf');
      expect(detectExtension('note.txt')).toBe('txt');
      expect(detectExtension('legacy.doc')).toBe('doc');
      expect(detectExtension('photo.jpg')).toBe('jpg');
      expect(detectExtension('photo.jpeg')).toBe('jpeg');
      expect(detectExtension('IMAGE.PNG')).toBe('png');
      expect(detectExtension('scan.webp')).toBe('webp');
    });

    it('handles filenames with multiple dots or tricky paths', () => {
      expect(detectExtension('приказ.№12.01.2026.docx')).toBe('docx');
      expect(detectExtension('path/to/archive.copy.pdf')).toBe('pdf');
    });

    it('returns "unknown" for unsupported formats or missing extensions', () => {
      expect(detectExtension('archive.zip')).toBe('unknown');
      expect(detectExtension('script.exe')).toBe('unknown');
      expect(detectExtension('README')).toBe('unknown');
      expect(detectExtension('')).toBe('unknown');
    });
  });

  describe('extractTextFromDocxBuffer - In-memory real .docx ZIP with JSZip', () => {
    it('extracts text from word/document.xml and word/header1.xml including tables and paragraphs', async () => {
      const zip = new JSZip();

      // [Content_Types].xml
      zip.file(
        '[Content_Types].xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
</Types>`
      );

      // _rels/.rels
      zip.file(
        '_rels/.rels',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
      );

      // word/header1.xml
      zip.file(
        'word/header1.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t>ТОО «КазСтройИнжиниринг»</w:t></w:r></w:p>
</w:hdr>`
      );

      // word/document.xml
      zip.file(
        'word/document.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>ПРИКАЗ № 99-к</w:t></w:r></w:p>
    <w:p><w:r><w:t>от 10.03.2026 г.</w:t></w:r></w:p>
    <w:p><w:r><w:t>О приеме на работу</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:p><w:r><w:t>1. Принять на работу Сидорова Алексея Викторовича на должность главного инженера.</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    <w:p><w:r><w:t>Директор предприятия: Иванов И.И.</w:t></w:r></w:p>
  </w:body>
</w:document>`
      );

      const buffer = await zip.generateAsync({ type: 'arraybuffer' });
      const extractedText = await extractTextFromDocxBuffer(buffer);

      // Verify paragraphs and table text extracted
      expect(extractedText).toContain('99-к');
      expect(extractedText).toContain('10.03.2026');
      expect(extractedText).toContain('Сидорова Алексея Викторовича');
      expect(extractedText).toContain('Иванов И.И.');

      // Integration test with parseOrderText
      const parsed = parseOrderText(extractedText);
      expect(parsed.orderNumber).toBe('99-к');
      expect(parsed.fioNominative).toBe('Сидоров Алексей Викторович');
    });
  });

  describe('extractTextFromOdtBuffer - In-memory real .odt ZIP with JSZip', () => {
    it('extracts text from content.xml inside ODT package', async () => {
      const zip = new JSZip();

      zip.file('mimetype', 'application/vnd.oasis.opendocument.text');
      zip.file(
        'content.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                         xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:text>
      <text:p>ТОО «КазМунайСервис»</text:p>
      <text:p>БҰЙРЫҚ № 77-ж/қ</text:p>
      <text:p>от 18.04.2026 г.</text:p>
      <text:p>Тағайындалсын Ахметова Серика Нұрланұлы</text:p>
      <text:p>Басқарма Төрағасы: Мусинов Б.К.</text:p>
    </office:text>
  </office:body>
</office:document-content>`
      );

      const buffer = await zip.generateAsync({ type: 'arraybuffer' });
      const extractedText = await extractTextFromOdtBuffer(buffer);

      expect(extractedText).toContain('БҰЙРЫҚ № 77-ж/қ');
      expect(extractedText).toContain('Ахметова Серика Нұрланұлы');

      // Integration check
      const parsed = parseOrderText(extractedText);
      expect(parsed.orderNumber).toBe('77-ж/қ');
      expect(parsed.fioNominative).toBe('Ахметов Серик Нұрланұлы');
    });
  });

  describe('extractTextFromTxtBytes', () => {
    it('decodes standard UTF-8 text containing Cyrillic and Kazakh characters', () => {
      const original = 'БҰЙРЫҚ № 15-лс от 01.03.2026\nҚызметкер: Нұрлан Әлішер Серікұлы';
      const bytes = new TextEncoder().encode(original);

      const decoded = extractTextFromTxtBytes(bytes);
      expect(decoded).toBe(original);
    });

    it('strips UTF-8 BOM if present', () => {
      const text = 'ПРИКАЗ № 123-к от 15.01.2026';
      const bom = [0xef, 0xbb, 0xbf];
      const encoded = Array.from(new TextEncoder().encode(text));
      const bytes = new Uint8Array([...bom, ...encoded]);

      const decoded = extractTextFromTxtBytes(bytes);
      expect(decoded).toBe(text);
      expect(decoded.charCodeAt(0)).not.toBe(0xfeff);
    });

    it('decodes Windows-1251 (CP1251) byte stream', () => {
      // "ПРИКАЗ № 42" in Windows-1251:
      // П = 0xCF, Р = 0xD0, И = 0xC8, К = 0xCA, А = 0xC0, З = 0xC7
      // ' ' = 0x20, № = 0xB9, ' ' = 0x20, 4 = 0x34, 2 = 0x32
      const cp1251Bytes = new Uint8Array([
        0xcf, 0xd0, 0xc8, 0xca, 0xc0, 0xc7, 0x20, 0xb9, 0x20, 0x34, 0x32,
      ]);

      const decoded = extractTextFromTxtBytes(cp1251Bytes);
      expect(decoded).toContain('ПРИКАЗ');
      expect(decoded).toContain('42');
    });
  });

  describe('extractTextFromRtfBytes', () => {
    it("decodes Russian RTF with Windows-1251 hex escapes (\\'xx)", () => {
      // RTF fragment:
      // \'cf\'f0\'e8\'ea\'e0\'e7 = "приказ"
      // \'b9 = "№"
      // \'d3\'e2\'ee\'eb\'e8\'f2\'fc = "Уволить"
      // \'c8\'e2\'e0\'ed\'ee\'e2\'e0 = "Иванова"
      const rtf = `{\\rtf1\\ansi\\ansicpg1251\\deff0 {\\fonttbl{\\f0\\fswiss Arial;}}\\f0\\fs24
\\b \\'cf\\'f0\\'e8\\'ea\\'e0\\'e7 \\'b9 15\\b0\\par
\\'d3\\'e2\\'ee\\'eb\\'e8\\'f2\\'fc \\'c8\\'e2\\'e0\\'ed\\'ee\\'e2\\'e0 \\'c8\\'e2\\'e0\\'ed\\'e0 \\'c8\\'e2\\'e0\\'ed\\'ee\\'e2\\'e8\\'f7\\'e0\\par
}`;
      const bytes = new TextEncoder().encode(rtf);
      const text = extractTextFromRtfBytes(bytes);

      expect(text.toLowerCase()).toContain('приказ');
      expect(text).toContain('15');
      expect(text).toContain('Иванова');
      expect(text).not.toContain('\\rtf1');
      expect(text).not.toContain('\\par');
    });

    it('decodes RTF with Unicode escapes (\\uN?)', () => {
      // \\u1055? \\u1088? \\u1080? \\u1082? \\u1072? \\u1079? = "Приказ"
      // \\u8470? = "№"
      const rtf = `{\\rtf1\\ansi\\deff0
\\u1055?\\u1088?\\u1080?\\u1082?\\u1072?\\u1079? \\u8470? 99 от 20.02.2026\\par
\\u1055?\\u1088?\\u1080?\\u1085?\\u1087?\\u1090?\\u1100? \\u1057?\\u1080?\\u1076?\\u1086?\\u1088?\\u1086?\\u1074?\\u1072?\\par
}`;
      const bytes = new TextEncoder().encode(rtf);
      const text = extractTextFromRtfBytes(bytes);

      expect(text).toContain('Приказ');
      expect(text).toContain('99');
      expect(text).toContain('20.02.2026');
      expect(text).toContain('Сидорова');
      expect(text).not.toContain('\\u1055');
    });

    it('cleans up RTF control groups and formatting commands', () => {
      const rtf = `{\\rtf1\\ansi\\ansicpg1251 {\\colortbl;\\red0\\green0\\blue0;}
{\\info{\\title Test Document}}
\\pard\\plain\\fs20
{\\b Важное сообщение:}\\par
Приказ № 5
}`;
      const bytes = new TextEncoder().encode(rtf);
      const text = extractTextFromRtfBytes(bytes);

      expect(text).toContain('Приказ № 5');
      expect(text).not.toMatch(/\\(pard|plain|fs20|colortbl|fonttbl)/);
    });
  });
});
