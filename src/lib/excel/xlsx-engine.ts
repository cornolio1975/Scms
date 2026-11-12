import zlib from 'zlib';

export const EXCEL_LIMITS = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_UNCOMPRESSED_BYTES: 25 * 1024 * 1024, // 25 MB
  MAX_ZIP_ENTRIES: 64,
  MAX_COMPRESSION_RATIO: 100,
  MAX_DATA_ROWS: 2000,
  TEMPLATE_BLANK_ROWS: 500,
} as const;

export class WorkbookSecurityError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'WorkbookSecurityError';
    this.code = code;
  }
}

export interface ParsedCell {
  ref: string; // e.g. "A2"
  colIndex: number; // 0-based
  colLetter: string; // e.g. "A"
  rowNumber: number; // 1-based Excel row number
  rawType: string; // 's' | 'str' | 'inlineStr' | 'n' | 'b' | 'e' | ''
  styleIndex: number;
  rawValue: string;
  value: string | number | boolean | null;
  hasFormula: boolean;
  formulaText?: string;
}

export interface ParsedRow {
  rowNumber: number; // 1-based Excel row number
  cells: Map<number, ParsedCell>; // keyed by 0-based colIndex
}

export interface ParsedSheet {
  name: string;
  rows: ParsedRow[];
}

export interface ParsedWorkbook {
  sheets: Map<string, ParsedSheet>;
  sheetNames: string[];
}

// Precomputed CRC32 table for ZIP generation
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Safely extracts a ZIP buffer into a map of filename -> Buffer,
 * enforcing size, entry count, and zip-bomb ratio limits.
 */
export function unzipBufferSafe(buffer: Buffer): Map<string, Buffer> {
  if (!buffer || buffer.length === 0) {
    throw new WorkbookSecurityError('EMPTY_FILE', 'Uploaded file is empty.');
  }
  if (buffer.length > EXCEL_LIMITS.MAX_FILE_SIZE_BYTES) {
    throw new WorkbookSecurityError(
      'FILE_TOO_LARGE',
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB limit.`
    );
  }

  // Verify PKZIP magic header (PK\x03\x04)
  if (
    buffer.length < 22 ||
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4b ||
    buffer[2] !== 0x03 ||
    buffer[3] !== 0x04
  ) {
    throw new WorkbookSecurityError(
      'INVALID_FILE_FORMAT',
      'Invalid file format. Please upload a valid Excel (.xlsx) workbook.'
    );
  }

  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  const minSearchOffset = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minSearchOffset; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new WorkbookSecurityError(
      'CORRUPT_ARCHIVE',
      'Corrupted .xlsx archive (missing central directory).'
    );
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  if (totalEntries > EXCEL_LIMITS.MAX_ZIP_ENTRIES) {
    throw new WorkbookSecurityError(
      'TOO_MANY_ARCHIVE_ENTRIES',
      `Workbook archive contains too many entries (${totalEntries} > ${EXCEL_LIMITS.MAX_ZIP_ENTRIES}).`
    );
  }

  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (cdOffset + cdSize > buffer.length) {
    throw new WorkbookSecurityError('CORRUPT_ARCHIVE', 'Invalid central directory bounds.');
  }

  const files = new Map<string, Buffer>();
  let ptr = cdOffset;
  let totalUncompressedBytes = 0;

  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > buffer.length || buffer.readUInt32LE(ptr) !== 0x02014b50) {
      throw new WorkbookSecurityError('CORRUPT_ARCHIVE', 'Invalid central directory file header.');
    }

    const compressionMethod = buffer.readUInt16LE(ptr + 10);
    const compressedSize = buffer.readUInt32LE(ptr + 20);
    const uncompressedSize = buffer.readUInt32LE(ptr + 24);
    const fileNameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = buffer.readUInt32LE(ptr + 42);

    const fileName = buffer
      .subarray(ptr + 46, ptr + 46 + fileNameLen)
      .toString('utf8')
      .replace(/\\/g, '/');

    ptr += 46 + fileNameLen + extraLen + commentLen;

    // Security check: reject path traversal
    if (fileName.includes('..') || fileName.startsWith('/')) {
      throw new WorkbookSecurityError('UNSAFE_ARCHIVE_PATH', 'Archive contains unsafe file paths.');
    }

    // Security check: reject VBA macros and external links
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('vbaproject.bin') || lowerName.endsWith('.bin')) {
      throw new WorkbookSecurityError(
        'MACROS_NOT_ALLOWED',
        'Workbooks containing macros (VBA) are not permitted.'
      );
    }
    if (lowerName.includes('externallinks')) {
      throw new WorkbookSecurityError(
        'EXTERNAL_LINKS_NOT_ALLOWED',
        'Workbooks containing external links are not permitted.'
      );
    }

    if (fileName.endsWith('/')) {
      continue;
    }

    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > EXCEL_LIMITS.MAX_UNCOMPRESSED_BYTES) {
      throw new WorkbookSecurityError(
        'DECOMPRESSION_LIMIT_EXCEEDED',
        'Uncompressed workbook size exceeds the maximum safety limit (25 MB).'
      );
    }

    if (
      compressedSize > 0 &&
      uncompressedSize / compressedSize > EXCEL_LIMITS.MAX_COMPRESSION_RATIO &&
      uncompressedSize > 1024 * 1024
    ) {
      throw new WorkbookSecurityError(
        'SUSPICIOUS_COMPRESSION_RATIO',
        'Workbook archive exceeds maximum allowed compression ratio.'
      );
    }

    if (
      localHeaderOffset + 30 > buffer.length ||
      buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50
    ) {
      throw new WorkbookSecurityError('CORRUPT_ARCHIVE', 'Invalid local file header in archive.');
    }

    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > buffer.length) {
      throw new WorkbookSecurityError('CORRUPT_ARCHIVE', 'Truncated compressed data in archive.');
    }

    const rawSlice = buffer.subarray(dataStart, dataEnd);
    let content: Buffer;
    if (compressionMethod === 0) {
      content = Buffer.from(rawSlice);
    } else if (compressionMethod === 8) {
      try {
        content = zlib.inflateRawSync(rawSlice, {
          maxOutputLength: EXCEL_LIMITS.MAX_UNCOMPRESSED_BYTES,
        });
      } catch {
        throw new WorkbookSecurityError(
          'DECOMPRESSION_ERROR',
          `Failed to decompress entry ${fileName}.`
        );
      }
    } else {
      throw new WorkbookSecurityError(
        'UNSUPPORTED_COMPRESSION',
        `Unsupported ZIP compression method (${compressionMethod}).`
      );
    }

    files.set(fileName, content);
  }

  return files;
}

/**
 * Creates a valid PKZIP buffer from a list of file entries.
 */
export function createZipBuffer(entries: Array<{ name: string; data: Buffer | string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const uncompressed =
      typeof entry.data === 'string' ? Buffer.from(entry.data, 'utf8') : entry.data;
    const compressed = zlib.deflateRawSync(uncompressed, { level: 6 });
    const crc = crc32(uncompressed);

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed (2.0)
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression method: deflate
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0x5421, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra len

    localParts.push(localHeader, nameBuf, compressed);

    // Central directory header (46 bytes + name)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(8, 10); // compression method: deflate
    centralHeader.writeUInt16LE(0, 12); // mod time
    centralHeader.writeUInt16LE(0x5421, 14); // mod date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra len
    centralHeader.writeUInt16LE(0, 32); // comment len
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(centralHeader, nameBuf);
    offset += 30 + nameBuf.length + compressed.length;
  }

  const cdBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, cdBuffer, eocd]);
}

export function decodeXmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function encodeXmlEntities(str: string): string {
  if (!str) return '';
  // Strip control characters that are invalid in XML 1.0 (except \t, \n, \r)
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function colLetterToIndex(colLetter: string): number {
  let index = 0;
  const upper = colLetter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function colIndexToLetter(colIndex: number): string {
  let n = colIndex + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

/**
 * Converts an Excel serial date number (1900 date system) to 'YYYY-MM-DD'.
 */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) {
    return null;
  }
  const wholeDays = Math.floor(serial);
  // Excel's 1900 leap-year bug treats 1900-02-29 (serial 60) as valid
  const adjustedDays = wholeDays > 60 ? wholeDays - 1 : wholeDays;
  // Serial 1 is 1900-01-01
  const baseUtcMs = Date.UTC(1899, 11, 31);
  const dateUtc = new Date(baseUtcMs + adjustedDays * 86400000);
  if (Number.isNaN(dateUtc.getTime())) {
    return null;
  }
  const y = dateUtc.getUTCFullYear();
  const m = String(dateUtc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateUtc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converts a validated 'YYYY-MM-DD' date string to an Excel serial date number.
 */
export function isoDateToExcelSerial(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const utcMs = Date.UTC(y, m - 1, d);
  const check = new Date(utcMs);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() + 1 !== m ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  const baseUtcMs = Date.UTC(1899, 11, 31);
  const diffDays = Math.round((utcMs - baseUtcMs) / 86400000);
  return diffDays >= 60 ? diffDays + 1 : diffDays;
}

function getAttr(tagAttrs: string, attrName: string): string | null {
  const regex = new RegExp(`(?:^|\\s)${attrName}="([^"]*)"`, 'i');
  const match = regex.exec(tagAttrs);
  return match ? decodeXmlEntities(match[1]) : null;
}

function parseSharedStrings(xml: string): string[] {
  const result: string[] = [];
  const siRegex = /<(?:[a-zA-Z0-9_]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?si>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(xml)) !== null) {
    const inner = siMatch[1];
    const tRegex = /<(?:[a-zA-Z0-9_]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?t>/g;
    let tMatch: RegExpExecArray | null;
    let combined = '';
    while ((tMatch = tRegex.exec(inner)) !== null) {
      combined += decodeXmlEntities(tMatch[1]);
    }
    result.push(combined);
  }
  return result;
}

function parseDateStyleIndices(stylesXml: string): Set<number> {
  const dateStyleIndices = new Set<number>();
  if (!stylesXml) return dateStyleIndices;

  const customDateNumFmts = new Set<number>();
  const numFmtRegex = /<(?:[a-zA-Z0-9_]+:)?numFmt\b([^>]*)\/?>/g;
  let nfMatch: RegExpExecArray | null;
  while ((nfMatch = numFmtRegex.exec(stylesXml)) !== null) {
    const idStr = getAttr(nfMatch[1], 'numFmtId');
    const code = getAttr(nfMatch[1], 'formatCode') || '';
    if (idStr) {
      const id = Number(idStr);
      // Detect date/time format codes (containing y, m, d outside brackets and not general/numeric)
      const cleaned = code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '');
      if (/[ymdYMD]/.test(cleaned) && !/[#0]\.[0#]/.test(cleaned)) {
        customDateNumFmts.add(id);
      }
    }
  }

  // Standard built-in Excel date numFmtIds: 14-22, 27-36, 45-47, 50-58
  const isDateNumFmt = (id: number) =>
    customDateNumFmts.has(id) ||
    (id >= 14 && id <= 22) ||
    (id >= 27 && id <= 36) ||
    (id >= 45 && id <= 47) ||
    (id >= 50 && id <= 58);

  const cellXfsMatch =
    /<(?:[a-zA-Z0-9_]+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?cellXfs>/.exec(
      stylesXml
    );
  if (cellXfsMatch) {
    const xfRegex = /<(?:[a-zA-Z0-9_]+:)?xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:[a-zA-Z0-9_]+:)?xf>)/g;
    let xfMatch: RegExpExecArray | null;
    let idx = 0;
    while ((xfMatch = xfRegex.exec(cellXfsMatch[1])) !== null) {
      const numFmtIdStr = getAttr(xfMatch[1], 'numFmtId');
      if (numFmtIdStr && isDateNumFmt(Number(numFmtIdStr))) {
        dateStyleIndices.add(idx);
      }
      idx++;
    }
  }

  return dateStyleIndices;
}

/**
 * Parses an OpenXML .xlsx buffer into sheets and rows with full metadata.
 */
export function parseXlsxWorkbook(buffer: Buffer): ParsedWorkbook {
  const files = unzipBufferSafe(buffer);

  const workbookXmlBuf = files.get('xl/workbook.xml');
  if (!workbookXmlBuf) {
    throw new WorkbookSecurityError(
      'INVALID_WORKBOOK_STRUCTURE',
      'Missing xl/workbook.xml. Please upload a valid .xlsx file.'
    );
  }

  const workbookXml = workbookXmlBuf.toString('utf8');

  // Parse workbook relationships
  const relsXmlBuf = files.get('xl/_rels/workbook.xml.rels');
  const relsMap = new Map<string, string>();
  if (relsXmlBuf) {
    const relsXml = relsXmlBuf.toString('utf8');
    const relRegex = /<(?:[a-zA-Z0-9_]+:)?Relationship\b([^>]*)\/?>/g;
    let relMatch: RegExpExecArray | null;
    while ((relMatch = relRegex.exec(relsXml)) !== null) {
      const id = getAttr(relMatch[1], 'Id');
      const target = getAttr(relMatch[1], 'Target');
      const type = getAttr(relMatch[1], 'Type') || '';
      if (type.toLowerCase().includes('externallink')) {
        throw new WorkbookSecurityError(
          'EXTERNAL_LINKS_NOT_ALLOWED',
          'Workbooks containing external links are not permitted.'
        );
      }
      if (id && target) {
        const normalizedTarget = target.startsWith('/')
          ? target.slice(1)
          : target.startsWith('xl/')
          ? target
          : `xl/${target}`;
        relsMap.set(id, normalizedTarget);
      }
    }
  }

  // Parse sharedStrings if present
  const sharedStringsBuf = files.get('xl/sharedStrings.xml');
  const sharedStrings = sharedStringsBuf
    ? parseSharedStrings(sharedStringsBuf.toString('utf8'))
    : [];

  // Parse styles to identify date-formatted cells
  const stylesBuf = files.get('xl/styles.xml');
  const dateStyleIndices = stylesBuf
    ? parseDateStyleIndices(stylesBuf.toString('utf8'))
    : new Set<number>();

  // Parse sheet declarations
  const sheetDefs: Array<{ name: string; path: string }> = [];
  const sheetRegex = /<(?:[a-zA-Z0-9_]+:)?sheet\b([^>]*)\/?>/g;
  let sheetMatch: RegExpExecArray | null;
  let fallbackIndex = 1;
  while ((sheetMatch = sheetRegex.exec(workbookXml)) !== null) {
    const attrs = sheetMatch[1];
    const name = getAttr(attrs, 'name') || `Sheet${fallbackIndex}`;
    const rId =
      getAttr(attrs, 'r:id') ||
      getAttr(attrs, 'id') ||
      `rId${fallbackIndex}`;
    const targetPath = relsMap.get(rId) || `xl/worksheets/sheet${fallbackIndex}.xml`;
    sheetDefs.push({ name, path: targetPath });
    fallbackIndex++;
  }

  const sheets = new Map<string, ParsedSheet>();
  const sheetNames: string[] = [];

  for (const def of sheetDefs) {
    const sheetBuf = files.get(def.path);
    if (!sheetBuf) continue;
    const sheetXml = sheetBuf.toString('utf8');
    const rows: ParsedRow[] = [];

    const rowRegex =
      /<(?:[a-zA-Z0-9_]+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?row>)/g;
    let rowMatch: RegExpExecArray | null;
    let sequentialRowNum = 0;

    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
      sequentialRowNum++;
      const rowAttrs = rowMatch[1];
      const rowInner = rowMatch[2] || '';
      const rAttr = getAttr(rowAttrs, 'r');
      const rowNumber = rAttr ? parseInt(rAttr, 10) : sequentialRowNum;

      const cells = new Map<number, ParsedCell>();
      const cellRegex =
        /<(?:[a-zA-Z0-9_]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?c>)/g;
      let cellMatch: RegExpExecArray | null;
      let sequentialColIdx = 0;

      while ((cellMatch = cellRegex.exec(rowInner)) !== null) {
        const cellAttrs = cellMatch[1];
        const cellInner = cellMatch[2] || '';
        const refAttr = getAttr(cellAttrs, 'r');
        let colIndex = sequentialColIdx;
        let colLetter = colIndexToLetter(colIndex);

        if (refAttr) {
          const refMatch = /^([A-Za-z]+)(\d+)$/.exec(refAttr);
          if (refMatch) {
            colLetter = refMatch[1].toUpperCase();
            colIndex = colLetterToIndex(colLetter);
          }
        }
        sequentialColIdx = colIndex + 1;

        const rawType = getAttr(cellAttrs, 't') || '';
        const styleAttr = getAttr(cellAttrs, 's');
        const styleIndex = styleAttr ? parseInt(styleAttr, 10) : 0;

        // Check for formula tag <f> or <x:f>
        const fMatch =
          /<(?:[a-zA-Z0-9_]+:)?f\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?f>|<(?:[a-zA-Z0-9_]+:)?f\b[^>]*\/>/.exec(
            cellInner
          );
        const hasFormula = Boolean(fMatch);
        const formulaText = fMatch && fMatch[1] ? decodeXmlEntities(fMatch[1]) : undefined;

        let rawValue = '';
        let value: string | number | boolean | null = null;

        if (rawType === 'inlineStr') {
          const tRegex = /<(?:[a-zA-Z0-9_]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?t>/g;
          let tMatch: RegExpExecArray | null;
          let text = '';
          while ((tMatch = tRegex.exec(cellInner)) !== null) {
            text += decodeXmlEntities(tMatch[1]);
          }
          rawValue = text;
          value = text;
        } else {
          const vMatch = /<(?:[a-zA-Z0-9_]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?v>/.exec(
            cellInner
          );
          rawValue = vMatch ? decodeXmlEntities(vMatch[1]) : '';

          if (rawValue === '') {
            value = null;
          } else if (rawType === 's') {
            const sstIdx = parseInt(rawValue, 10);
            value =
              Number.isInteger(sstIdx) && sstIdx >= 0 && sstIdx < sharedStrings.length
                ? sharedStrings[sstIdx]
                : '';
          } else if (rawType === 'str' || rawType === 'e') {
            value = rawValue;
          } else if (rawType === 'b') {
            value = rawValue === '1' || rawValue.toLowerCase() === 'true';
          } else {
            // Numeric or Date serial
            const num = Number(rawValue);
            if (!Number.isNaN(num)) {
              if (dateStyleIndices.has(styleIndex)) {
                const iso = excelSerialToIsoDate(num);
                value = iso ?? num;
              } else {
                value = num;
              }
            } else {
              value = rawValue;
            }
          }
        }

        cells.set(colIndex, {
          ref: refAttr || `${colLetter}${rowNumber}`,
          colIndex,
          colLetter,
          rowNumber,
          rawType,
          styleIndex,
          rawValue,
          value,
          hasFormula,
          formulaText,
        });
      }

      rows.push({ rowNumber, cells });
    }

    sheets.set(def.name, { name: def.name, rows });
    sheetNames.push(def.name);
  }

  return { sheets, sheetNames };
}

