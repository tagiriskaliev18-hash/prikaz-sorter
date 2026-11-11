import JSZip from 'jszip';

function createDocxBlob(lines: string[]): Promise<Blob> {
  const zip = new JSZip();

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const escapeXml = (unsafe: string) =>
    unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const paragraphsXml = lines
    .map(line => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`)
    .join('\n');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${paragraphsXml}
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', documentXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function encodeTextToRtf(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const char = text[i];
    if (char === '\n') {
      result += '\\par\n';
    } else if (char === '\\') {
      result += '\\\\';
    } else if (char === '{') {
      result += '\\{';
    } else if (char === '}') {
      result += '\\}';
    } else if (code < 128) {
      result += char;
    } else {
      let win1251Hex = '3f';
      if (code >= 0x0410 && code <= 0x042f) {
        win1251Hex = (code - 0x0410 + 0xc0).toString(16).toLowerCase();
      } else if (code >= 0x0430 && code <= 0x044f) {
        win1251Hex = (code - 0x0430 + 0xe0).toString(16).toLowerCase();
      } else if (code === 0x0401) {
        win1251Hex = 'a8';
      } else if (code === 0x0451) {
        win1251Hex = 'b8';
      } else if (code === 0x2116) {
        win1251Hex = 'b9';
      }
      result += `\\u${code}\\'${win1251Hex}`;
    }
  }
  return result;
}

export async function createDemoOrderFiles(): Promise<File[]> {
  // Demo 1: scan_001_draft.docx
  // Приказ о приеме на работу № 142-к от 14.09.2026 (employee: Смирнова Алексея Дмитриевича, signer: А.К. Нурпеисов)
  const docxLines1 = [
    'ТОО "Батыс Тех"',
    'БИН 190440012345, г. Алматы, ул. Абая, 150',
    '',
    'ПРИКАЗ № 142-к',
    'г. Алматы                                     14.09.2026 г.',
    '',
    'О приеме на работу',
    '',
    'В соответствии с Трудовым кодексом Республики Казахстан:',
    '1. ПРИНЯТЬ Смирнова Алексея Дмитриевича (ИИН 920514300456) на должность ведущего инженера-программиста с 15 сентября 2026 года с окладом согласно штатному расписанию.',
    '2. Установить испытательный срок продолжительностью 3 (три) месяца.',
    '',
    'Основание: трудовой договор № 45 от 14.09.2026 г., личное заявление Смирнова А.Д.',
    '',
    'Генеральный директор ТОО "Батыс Тех"                 А.К. Нурпеисов',
  ];
  const blob1 = await createDocxBlob(docxLines1);
  const file1 = new File([blob1], 'scan_001_draft.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  // Demo 2: документ_отпуск.docx
  // БҰЙРЫҚ / ПРИКАЗ № 87-ж/қ от 18.09.2026 (employee: Сулейменовой Айгуль Маратовне, signer: Р.Т. Касымов)
  const docxLines2 = [
    'ТОО "КазМетроСтрой"',
    'БҰЙРЫҚ / ПРИКАЗ № 87-ж/қ',
    'г. Астана                                     18.09.2026 г.',
    '',
    'О предоставлении ежегодного оплачиваемого трудового отпуска',
    '',
    'В соответствии со статьей 92 Трудового кодекса Республики Казахстан:',
    '1. ПРЕДОСТАВИТЬ Сулейменовой Айгуль Маратовне, главному бухгалтеру, ежегодный оплачиваемый трудовой отпуск продолжительностью 24 календарных дня за рабочий период с 01.10.2025 по 30.09.2026 года с 21 сентября 2026 года по 14 октября 2026 года.',
    '2. Контроль за исполнением настоящего приказа оставляю за собой.',
    '',
    'Основание: график отпусков на 2026 год, заявление Сулейменовой А.М.',
    '',
    'Директор                                            Р.Т. Касымов',
  ];
  const blob2 = await createDocxBlob(docxLines2);
  const file2 = new File([blob2], 'документ_отпуск.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  // Demo 3: doc_3.rtf
  // Приказ о переводе № 205/лс от 22.09.2026 (employee: Коваленко Ольге Викторовне, signer: В.С. Мельников)
  const rtfTextContent = `ТОО "ИнтерЛогистик"
г. Алматы

ПРИКАЗ № 205/лс
от 22.09.2026 г.

О переводе на другую должность

В связи с производственной необходимостью и изменением структуры департамента логистики:
1. ПЕРЕВЕСТИ Коваленко Ольгу Викторовну, ведущего специалиста отдела снабжения, на должность начальника отдела логистики с 01 октября 2026 года.
2. Установить должностной оклад согласно штатному расписанию.

Основание: представление директора по логистике, дополнительное соглашение к трудовому договору № 112 от 22.09.2026 г.

Генеральный директор                                В.С. Мельников`;

  const rtfBody = encodeTextToRtf(rtfTextContent);
  const rtfFull = `{\\rtf1\\ansi\\ansicpg1251\\deff0\\deflang1049\n{\\fonttbl{\\f0\\fnil\\fcharset204 Times New Roman;}}\n\\viewkind4\\uc1\\pard\\f0\\fs24\n${rtfBody}\n\\par\n}`;

  const rtfBlob = new Blob([rtfFull], { type: 'application/rtf' });
  const file3 = new File([rtfBlob], 'doc_3.rtf', { type: 'application/rtf' });

  return [file1, file2, file3];
}
