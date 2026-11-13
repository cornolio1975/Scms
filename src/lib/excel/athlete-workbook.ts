import {
  EXCEL_LIMITS,
  ParsedCell,
  WorkbookSecurityError,
  colIndexToLetter,
  createZipBuffer,
  encodeXmlEntities,
  excelSerialToIsoDate,
  isoDateToExcelSerial,
  parseXlsxWorkbook,
} from './xlsx-engine';

export const ATHLETE_BASE_COLUMNS = [
  'athlete_id',
  'club_id',
  'club_name',
  'branch_id',
  'branch_name',
  'full_name',
  'id_type',
  'id_number',
  'date_of_birth',
  'gender',
  'nationality',
  'phone',
  'email',
  'address_line_1',
  'address_line_2',
  'postcode',
  'city',
  'state',
  'country',
  'guardian_name',
  'guardian_phone',
  'emergency_contact_name',
  'emergency_contact_phone',
  'belt_rank',
  'weight_kg',
  'height_cm',
  'status',
  'notes',
] as const;

export const ATHLETE_ALL_COLUMNS = [...ATHLETE_BASE_COLUMNS, 'updated_at'] as const;

export type AthleteColumnName = (typeof ATHLETE_ALL_COLUMNS)[number];

export const ALLOWED_ID_TYPES = ['MyKad', 'MyKid', 'Passport', 'Other'] as const;
export type AllowedIdType = (typeof ALLOWED_ID_TYPES)[number];

export const ALLOWED_GENDERS = ['Male', 'Female', 'Not specified'] as const;
export type AllowedGender = (typeof ALLOWED_GENDERS)[number];

export const ALLOWED_STATUSES = ['Active', 'Inactive'] as const;
export type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export interface ClubScopeInfo {
  id: string;
  name: string;
  shortName?: string | null;
  displayName?: string | null;
}

export interface BranchScopeInfo {
  id: string;
  clubId: string;
  name: string;
  displayName?: string | null;
}

export interface AthleteWorkbookRowData {
  athlete_id: string;
  club_id: string;
  club_name: string;
  branch_id: string;
  branch_name: string;
  full_name: string;
  id_type: string;
  id_number: string;
  date_of_birth: string;
  gender: string;
  nationality: string;
  phone: string;
  email: string;
  address_line_1: string;
  address_line_2: string;
  postcode: string;
  city: string;
  state: string;
  country: string;
  guardian_name: string;
  guardian_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  belt_rank: string;
  weight_kg: number | null;
  height_cm: number | null;
  status: string;
  notes: string;
  updated_at: string;
}

export interface ExistingDbMemberRecord {
  id: string;
  member_no: string;
  club_id: string;
  branch_id: string | null;
  profile_id?: string | null;
  full_name: string;
  gender: string | null;
  date_of_birth: string | null;
  id_type?: string | null;
  ic_passport: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postcode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  status: string;
  notes?: string | null;
  medical_notes?: string | null;
  sport_data: Record<string, unknown> | null;
  emergency_contact: Record<string, unknown> | null;
  updated_at: string;
}

export interface RowValidationError {
  rowNumber: number; // 1-based Excel row number (0 for workbook-level errors)
  field: string;
  code: string;
  message: string;
}

export type ValidatedRowAction = 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'ERROR';

export interface ValidatedAthleteRow {
  rowNumber: number;
  action: ValidatedRowAction;
  data: AthleteWorkbookRowData;
  existingMemberId?: string;
  changedFields?: string[];
  errors: RowValidationError[];
}

export interface WorkbookValidationResult {
  valid: boolean;
  destination: {
    clubId: string;
    clubName: string;
    branchId: string | null;
    branchName: string | null;
  };
  totalRows: number;
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  errorCount: number;
  workbookErrors: RowValidationError[];
  rowErrors: RowValidationError[];
  rows: ValidatedAthleteRow[];
}

export interface GenerateWorkbookOptions {
  mode: 'template' | 'export';
  club?: ClubScopeInfo | null;
  selectedBranch?: BranchScopeInfo | null;
  authorizedBranches?: BranchScopeInfo[];
  athletes?: AthleteWorkbookRowData[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEXT_COLUMNS = new Set<AthleteColumnName>([
  'athlete_id',
  'club_id',
  'branch_id',
  'id_number',
  'phone',
  'postcode',
  'guardian_phone',
  'emergency_contact_phone',
  'updated_at',
]);

const NUMERIC_COLUMNS = new Set<AthleteColumnName>(['weight_kg', 'height_cm']);

const ATHLETE_SPECIFIC_COLUMNS: AthleteColumnName[] = [
  'athlete_id',
  'full_name',
  'id_type',
  'id_number',
  'date_of_birth',
  'gender',
  'nationality',
  'phone',
  'email',
  'address_line_1',
  'address_line_2',
  'postcode',
  'city',
  'state',
  'country',
  'guardian_name',
  'guardian_phone',
  'emergency_contact_name',
  'emergency_contact_phone',
  'belt_rank',
  'weight_kg',
  'height_cm',
  'status',
  'notes',
];

export function normalizeIdNumber(idNumber: string): string {
  return idNumber.trim().replace(/[\s-]+/g, '').toUpperCase();
}

/**
 * Prevents spreadsheet formula injection when exporting user-entered text.
 * Any value starting with =, +, -, @, \t, \r is prefixed with a single quote ('),
 * except safe international phone numbers like +60123456789 when allowPhonePlus is true.
 */
export function sanitizeSpreadsheetText(
  val: string | null | undefined,
  options?: { allowPhonePlus?: boolean }
): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.length === 0) return '';
  const first = str[0];
  if (first === '+' && options?.allowPhonePlus && /^\+[0-9][0-9 ()-]{2,25}$/.test(str)) {
    return str;
  }
  if (
    first === '=' ||
    first === '+' ||
    first === '-' ||
    first === '@' ||
    first === '\t' ||
    first === '\r'
  ) {
    return `'${str}`;
  }
  return str;
}

/**
 * Maps an authoritative database member row to an AthleteWorkbookRowData object for export or comparison.
 */
export function mapDbMemberToWorkbookRow(
  member: ExistingDbMemberRecord,
  clubMap: Map<string, ClubScopeInfo>,
  branchMap: Map<string, BranchScopeInfo>
): AthleteWorkbookRowData {
  const club = clubMap.get(member.club_id);
  const branch = member.branch_id ? branchMap.get(member.branch_id) : undefined;
  const sport = (member.sport_data || {}) as Record<string, unknown>;
  const emergency = (member.emergency_contact || {}) as Record<string, unknown>;

  const rawBeltRank =
    (typeof sport.beltRank === 'string' && sport.beltRank) ||
    (typeof sport.rankName === 'string' && sport.rankName) ||
    (typeof sport.kyu === 'string' && sport.kyu) ||
    '';

  const rawWeight =
    typeof sport.weightKg === 'number'
      ? sport.weightKg
      : typeof sport.weightKg === 'string' && sport.weightKg.trim() !== ''
      ? Number(sport.weightKg)
      : null;

  const rawHeight =
    typeof sport.heightCm === 'number'
      ? sport.heightCm
      : typeof sport.heightCm === 'string' && sport.heightCm.trim() !== ''
      ? Number(sport.heightCm)
      : null;

  const normalizedStatus =
    member.status && member.status.toUpperCase() === 'INACTIVE' ? 'Inactive' : 'Active';

  let normalizedGender = member.gender || '';
  if (normalizedGender.toLowerCase() === 'male') normalizedGender = 'Male';
  else if (normalizedGender.toLowerCase() === 'female') normalizedGender = 'Female';
  else if (normalizedGender) normalizedGender = 'Not specified';

  let idType = member.id_type || '';
  if (!idType && member.ic_passport) {
    idType = /^[0-9]{6}-?[0-9]{2}-?[0-9]{4}$/.test(member.ic_passport.trim())
      ? 'MyKad'
      : 'Passport';
  }

  const dobStr = member.date_of_birth ? String(member.date_of_birth).slice(0, 10) : '';

  return {
    athlete_id: member.id,
    club_id: member.club_id,
    club_name: club?.name || '',
    branch_id: member.branch_id || '',
    branch_name: branch?.name || '',
    full_name: member.full_name || '',
    id_type: idType,
    id_number: member.ic_passport || '',
    date_of_birth: dobStr,
    gender: normalizedGender,
    nationality: member.nationality || '',
    phone: member.phone || '',
    email: member.email || '',
    address_line_1: member.address_line_1 || '',
    address_line_2: member.address_line_2 || '',
    postcode: member.postcode || '',
    city: member.city || '',
    state: member.state || '',
    country: member.country || '',
    guardian_name: member.guardian_name || '',
    guardian_phone: member.guardian_phone || '',
    emergency_contact_name:
      typeof emergency.name === 'string' ? emergency.name : '',
    emergency_contact_phone:
      typeof emergency.phone === 'string' ? emergency.phone : '',
    belt_rank: rawBeltRank,
    weight_kg: rawWeight !== null && Number.isFinite(rawWeight) ? rawWeight : null,
    height_cm: rawHeight !== null && Number.isFinite(rawHeight) ? rawHeight : null,
    status: normalizedStatus,
    notes: member.notes ?? member.medical_notes ?? '',
    updated_at: member.updated_at ? new Date(member.updated_at).toISOString() : '',
  };
}

/**
 * Generates a complete OpenXML .xlsx workbook buffer with "Athletes" and "Guide" sheets.
 */
export function generateAthleteWorkbook(options: GenerateWorkbookOptions): Buffer {
  const { mode, club, selectedBranch, authorizedBranches = [], athletes = [] } = options;

  // Shared strings collector
  const sstIndexMap = new Map<string, number>();
  const sstList: string[] = [];
  let sstTotalCount = 0;

  const addSharedString = (str: string): number => {
    sstTotalCount++;
    const existing = sstIndexMap.get(str);
    if (existing !== undefined) return existing;
    const idx = sstList.length;
    sstList.push(str);
    sstIndexMap.set(str, idx);
    return idx;
  };

  // Column widths for the 29 columns on Athletes sheet
  const colWidths = [
    36, // A: athlete_id
    36, // B: club_id
    30, // C: club_name
    36, // D: branch_id
    28, // E: branch_name
    28, // F: full_name
    16, // G: id_type
    22, // H: id_number
    16, // I: date_of_birth
    16, // J: gender
    18, // K: nationality
    18, // L: phone
    28, // M: email
    28, // N: address_line_1
    24, // O: address_line_2
    12, // P: postcode
    18, // Q: city
    18, // R: state
    18, // S: country
    24, // T: guardian_name
    18, // U: guardian_phone
    24, // V: emergency_contact_name
    18, // W: emergency_contact_phone
    20, // X: belt_rank
    14, // Y: weight_kg
    14, // Z: height_cm
    14, // AA: status
    32, // AB: notes
    28, // AC: updated_at
  ];

  const colsXml = colWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1" />`)
    .join('');

  // Build Row 1 (headers)
  const headerCellsXml = ATHLETE_ALL_COLUMNS.map((colName, idx) => {
    const colLetter = colIndexToLetter(idx);
    const sstIdx = addSharedString(colName);
    return `<c r="${colLetter}1" t="s" s="1"><v>${sstIdx}</v></c>`;
  }).join('');

  const dataRowCount =
    mode === 'template'
      ? Math.max(EXCEL_LIMITS.TEMPLATE_BLANK_ROWS, athletes.length)
      : Math.max(1, athletes.length);

  const lastRowNumber = dataRowCount + 1; // +1 for header row
  const lastColLetter = colIndexToLetter(ATHLETE_ALL_COLUMNS.length - 1); // 'AC'

  const rowsXmlParts: string[] = [
    `<row r="1" ht="24" customHeight="1">${headerCellsXml}</row>`,
  ];

  for (let i = 0; i < dataRowCount; i++) {
    const rowNum = i + 2;
    const record: Partial<AthleteWorkbookRowData> | undefined =
      athletes[i] ??
      (mode === 'template' && club
        ? {
            club_id: club.id,
            club_name: club.name,
            branch_id: selectedBranch ? selectedBranch.id : '',
            branch_name: selectedBranch ? selectedBranch.name : '',
          }
        : undefined);

    const cellXmlParts: string[] = [];

    for (let colIdx = 0; colIdx < ATHLETE_ALL_COLUMNS.length; colIdx++) {
      const colName = ATHLETE_ALL_COLUMNS[colIdx];
      const colLetter = colIndexToLetter(colIdx);
      const cellRef = `${colLetter}${rowNum}`;

      // Style mapping matching reference workbook:
      // s="5" -> Text (@)
      // s="6" -> Date (yyyy-mm-dd)
      // s="7" -> Numeric (0.0)
      // s="4" -> General bordered
      let styleId = 4;
      if (TEXT_COLUMNS.has(colName)) styleId = 5;
      else if (colName === 'date_of_birth') styleId = 6;
      else if (NUMERIC_COLUMNS.has(colName)) styleId = 7;

      const rawVal = record ? record[colName] : undefined;

      if (rawVal === undefined || rawVal === null || rawVal === '') {
        cellXmlParts.push(`<c r="${cellRef}" s="${styleId}" />`);
        continue;
      }

      if (colName === 'date_of_birth' && typeof rawVal === 'string') {
        const serial = isoDateToExcelSerial(rawVal);
        if (serial !== null) {
          cellXmlParts.push(`<c r="${cellRef}" s="6"><v>${serial}</v></c>`);
        } else {
          const safeStr = sanitizeSpreadsheetText(rawVal);
          const sstIdx = addSharedString(safeStr);
          cellXmlParts.push(`<c r="${cellRef}" t="s" s="6"><v>${sstIdx}</v></c>`);
        }
      } else if (NUMERIC_COLUMNS.has(colName) && typeof rawVal === 'number' && Number.isFinite(rawVal)) {
        cellXmlParts.push(`<c r="${cellRef}" s="7"><v>${rawVal}</v></c>`);
      } else {
        const isPhoneCol =
          colName === 'phone' ||
          colName === 'guardian_phone' ||
          colName === 'emergency_contact_phone';
        const safeStr =
          mode === 'export'
            ? sanitizeSpreadsheetText(String(rawVal), { allowPhonePlus: isPhoneCol })
            : String(rawVal);
        const sstIdx = addSharedString(safeStr);
        cellXmlParts.push(`<c r="${cellRef}" t="s" s="${styleId}"><v>${sstIdx}</v></c>`);
      }
    }

    rowsXmlParts.push(`<row r="${rowNum}" ht="20" customHeight="1">${cellXmlParts.join('')}</row>`);
  }

  const validationMaxRow = Math.max(501, lastRowNumber);

  const sheet1Xml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastColLetter}${lastRowNumber}" />
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen" />
      <selection pane="bottomLeft" activeCell="A2" sqref="A2" />
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20" />
  <cols>${colsXml}</cols>
  <sheetData>${rowsXmlParts.join('')}</sheetData>
  <dataValidations count="3">
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="G2:G${validationMaxRow}">
      <formula1>"MyKad,MyKid,Passport,Other"</formula1>
    </dataValidation>
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="J2:J${validationMaxRow}">
      <formula1>"Male,Female,Not specified"</formula1>
    </dataValidation>
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="AA2:AA${validationMaxRow}">
      <formula1>"Active,Inactive"</formula1>
    </dataValidation>
  </dataValidations>
  <tableParts count="1">
    <tablePart r:id="rId1" />
  </tableParts>
</worksheet>`;

  // Build Guide sheet (sheet2.xml)
  const guideRows: Array<{ cells: Array<{ col: string; text: string; style: number }>; height?: number }> = [];

  const pushGuideRow = (
    cells: Array<{ col: string; text: string; style: number }>,
    height = 20
  ) => {
    guideRows.push({ cells, height });
  };

  pushGuideRow(
    [
      {
        col: 'A',
        text: 'SCMS Athlete Bulk Import & Export Template - Guide',
        style: 2,
      },
    ],
    28
  );
  pushGuideRow([
    {
      col: 'A',
      text: 'Use the Athletes sheet to add new athletes or update exported athletes by Club or Branch. Do not rename or reorder column headers.',
      style: 0,
    },
  ]);
  pushGuideRow([]);

  // Authorized Scope & Branch Reference Section
  pushGuideRow([{ col: 'A', text: 'Authorized Club & Branch Reference IDs', style: 3 }], 22);
  if (club) {
    pushGuideRow([
      { col: 'A', text: 'Selected Club ID', style: 1 },
      { col: 'B', text: 'Selected Club Name', style: 1 },
      { col: 'C', text: 'Selected Scope', style: 1 },
      { col: 'D', text: 'Notes', style: 1 },
    ]);
    pushGuideRow([
      { col: 'A', text: club.id, style: 5 },
      { col: 'B', text: club.name, style: 4 },
      {
        col: 'C',
        text: selectedBranch ? `Branch: ${selectedBranch.name}` : 'Entire Club / All Authorized Branches',
        style: 4,
      },
      {
        col: 'D',
        text: selectedBranch
          ? 'Rows are prefilled for this branch.'
          : 'Leave branch_id & branch_name blank for club-level athletes, or copy a Branch ID below.',
        style: 4,
      },
    ]);

    if (authorizedBranches.length > 0) {
      pushGuideRow([]);
      pushGuideRow([
        { col: 'A', text: 'Authorized Branch ID (branch_id)', style: 1 },
        { col: 'B', text: 'Authorized Branch Name (branch_name)', style: 1 },
        { col: 'C', text: 'Club ID (club_id)', style: 1 },
        { col: 'D', text: 'Usage', style: 1 },
      ]);
      for (const b of authorizedBranches) {
        pushGuideRow([
          { col: 'A', text: b.id, style: 5 },
          { col: 'B', text: b.name, style: 4 },
          { col: 'C', text: b.clubId, style: 5 },
          {
            col: 'D',
            text:
              selectedBranch && selectedBranch.id === b.id
                ? 'Selected default branch for this download'
                : 'Authorized branch for this club',
            style: 4,
          },
        ]);
      }
    }
  } else {
    pushGuideRow([
      {
        col: 'A',
        text: 'Download this template after selecting a Club/Branch in Data Management to prefill exact Club and Branch UUIDs.',
        style: 4,
      },
    ]);
  }

  pushGuideRow([]);
  pushGuideRow([{ col: 'A', text: 'Usage Rules & Safety Limits', style: 3 }], 22);
  const rules = [
    '1. One row represents one athlete record in the Athletes sheet.',
    '2. New athletes: leave athlete_id and updated_at blank. Existing athletes: keep athlete_id and updated_at unchanged from your export.',
    '3. Club-level imports require club_id and club_name. Branch-level imports also require branch_id and branch_name belonging to that club.',
    '4. Athletes cannot be transferred between clubs or branches via spreadsheet edit. Use the SCMS transfer workflow to move athletes.',
    '5. Keep identification numbers, phone numbers, postcodes, and UUIDs formatted as Text so leading zeros are preserved.',
    '6. Enter date_of_birth in YYYY-MM-DD format (e.g. 2012-05-19). Birth dates cannot be in the future.',
    '7. Multiple siblings may share the same parent/guardian email and phone number. Athlete identity is never inferred from name or email alone.',
    '8. Supported file limits: .xlsx format only, max 5 MB file size, max 2,000 athlete rows per import. Formulas, macros, and external links are rejected.',
  ];
  for (const rule of rules) {
    pushGuideRow([{ col: 'A', text: rule, style: 0 }]);
  }

  pushGuideRow([]);
  pushGuideRow([{ col: 'A', text: 'Field Dictionary & Database Mapping', style: 3 }], 22);
  pushGuideRow(
    [
      { col: 'A', text: 'Column Name', style: 1 },
      { col: 'B', text: 'Required?', style: 1 },
      { col: 'C', text: 'Format / Allowed Values', style: 1 },
      { col: 'D', text: 'Description & Database Mapping', style: 1 },
    ],
    24
  );

  const fieldGuide: Array<[string, string, string, string]> = [
    [
      'athlete_id',
      'Blank for new; Required for update',
      'UUID (Text)',
      'System athlete ID (members.id). Leave blank when creating new athletes; preserve exact ID when updating exported records.',
    ],
    [
      'club_id',
      'Required',
      'UUID (Text)',
      'Authorized SCMS Club ID (members.club_id). Must match your selected destination club.',
    ],
    [
      'club_name',
      'Required',
      'Text',
      'Official SCMS Club name (clubs.name). Verified against club_id.',
    ],
    [
      'branch_id',
      'Required for branch import',
      'UUID (Text)',
      'Authorized Branch ID belonging to the club (members.branch_id). Leave blank only for club-level athletes.',
    ],
    [
      'branch_name',
      'Required for branch import',
      'Text',
      'Official Branch name (club_branches.name). Must match branch_id when branch_id is provided.',
    ],
    [
      'full_name',
      'Required',
      'Text (max 150 chars)',
      'Athlete full legal name as on IC/Passport (members.full_name).',
    ],
    [
      'id_type',
      'Required',
      'MyKad, MyKid, Passport, Other',
      'Identification document type (members.id_type). Use dropdown.',
    ],
    [
      'id_number',
      'Required',
      'Text (preserves leading zeros)',
      'IC, MyKid, or Passport number (members.ic_passport). Must be unique within the same club.',
    ],
    [
      'date_of_birth',
      'Required',
      'Date (YYYY-MM-DD)',
      'Athlete date of birth (members.date_of_birth). Must be a valid past date.',
    ],
    [
      'gender',
      'Required',
      'Male, Female, Not specified',
      'Athlete gender (members.gender). Use dropdown.',
    ],
    [
      'nationality',
      'Optional',
      'Text',
      'Athlete nationality, e.g. Malaysian (members.nationality).',
    ],
    [
      'phone',
      'Optional',
      'Text (preserves leading zeros)',
      'Athlete contact phone number (members.phone).',
    ],
    [
      'email',
      'Optional',
      'Valid email address',
      'Athlete or shared parent contact email (members.email). Does not create a login account.',
    ],
    [
      'address_line_1',
      'Optional',
      'Text',
      'Residential street address line 1 (members.address_line_1).',
    ],
    [
      'address_line_2',
      'Optional',
      'Text',
      'Residential street address line 2 (members.address_line_2).',
    ],
    [
      'postcode',
      'Optional',
      'Text (preserves leading zeros)',
      'Postal / ZIP code (members.postcode).',
    ],
    ['city', 'Optional', 'Text', 'City / town (members.city).'],
    ['state', 'Optional', 'Text', 'State / province (members.state).'],
    ['country', 'Optional', 'Text', 'Country (members.country).'],
    [
      'guardian_name',
      'Recommended for U18',
      'Text',
      'Parent or legal guardian full name (members.guardian_name).',
    ],
    [
      'guardian_phone',
      'Recommended for U18',
      'Text (preserves leading zeros)',
      'Parent or legal guardian phone number (members.guardian_phone).',
    ],
    [
      'emergency_contact_name',
      'Optional',
      'Text',
      'Emergency contact person name (members.emergency_contact.name).',
    ],
    [
      'emergency_contact_phone',
      'Optional',
      'Text (preserves leading zeros)',
      'Emergency contact phone number (members.emergency_contact.phone).',
    ],
    [
      'belt_rank',
      'Optional',
      'Text',
      'Current belt / kyu / dan rank (members.sport_data.beltRank). Existing extra sport_data keys are preserved.',
    ],
    [
      'weight_kg',
      'Optional',
      'Positive number (0.0)',
      'Athlete weight in kilograms, e.g. 54.5 (members.sport_data.weightKg).',
    ],
    [
      'height_cm',
      'Optional',
      'Positive number (0.0)',
      'Athlete height in centimeters, e.g. 165.0 (members.sport_data.heightCm).',
    ],
    [
      'status',
      'Required',
      'Active, Inactive',
      'Membership status (members.status). Use dropdown.',
    ],
    [
      'notes',
      'Optional',
      'Text',
      'Medical, coaching, or administrative notes (members.notes).',
    ],
    [
      'updated_at',
      'System Concurrency Token',
      'ISO-8601 Timestamp (Text)',
      'Exported record timestamp (members.updated_at). Used to detect stale updates if the athlete was edited in SCMS after export. Leave blank for new rows.',
    ],
  ];

  for (const [col, req, fmt, desc] of fieldGuide) {
    pushGuideRow(
      [
        { col: 'A', text: col, style: 4 },
        { col: 'B', text: req, style: 4 },
        { col: 'C', text: fmt, style: 4 },
        { col: 'D', text: desc, style: 4 },
      ],
      28
    );
  }

  const guideXmlRows = guideRows
    .map((r, idx) => {
      const rowNum = idx + 1;
      if (r.cells.length === 0) {
        return `<row r="${rowNum}" />`;
      }
      const cellsXml = r.cells
        .map((c) => {
          const sstIdx = addSharedString(c.text);
          return `<c r="${c.col}${rowNum}" t="s" s="${c.style}"><v>${sstIdx}</v></c>`;
        })
        .join('');
      return `<row r="${rowNum}" ht="${r.height || 20}" customHeight="1">${cellsXml}</row>`;
    })
    .join('');

  const sheet2Xml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:D${guideRows.length}" />
  <sheetViews>
    <sheetView workbookViewId="0" />
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20" />
  <cols>
    <col min="1" max="1" width="38" customWidth="1" />
    <col min="2" max="2" width="32" customWidth="1" />
    <col min="3" max="3" width="36" customWidth="1" />
    <col min="4" max="4" width="75" customWidth="1" />
  </cols>
  <sheetData>${guideXmlRows}</sheetData>
</worksheet>`;

  const tableColumnsXml = ATHLETE_ALL_COLUMNS.map(
    (name, idx) => `<tableColumn id="${idx + 1}" name="${encodeXmlEntities(name)}" />`
  ).join('');

  const table1Xml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="AthleteEntries" displayName="AthleteEntries" ref="A1:${lastColLetter}${lastRowNumber}" totalsRowShown="0">
  <autoFilter ref="A1:${lastColLetter}${lastRowNumber}" />
  <tableColumns count="${ATHLETE_ALL_COLUMNS.length}">${tableColumnsXml}</tableColumns>
  <tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0" />
</table>`;

  const sharedStringsXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sstTotalCount}" uniqueCount="${sstList.length}">${sstList
    .map((s) => `<si><t xml:space="preserve">${encodeXmlEntities(s)}</t></si>`)
    .join('')}</sst>`;

  const stylesXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="200" formatCode="@" />
    <numFmt numFmtId="201" formatCode="yyyy-mm-dd" />
    <numFmt numFmtId="202" formatCode="0.0" />
  </numFmts>
  <fonts count="5">
    <font><sz val="11" /><color rgb="FF111827" /><name val="Calibri" /><family val="2" /></font>
    <font><b /><sz val="11" /><color rgb="FFFFFFFF" /><name val="Calibri" /><family val="2" /></font>
    <font><b /><sz val="15" /><color rgb="FF111827" /><name val="Calibri" /><family val="2" /></font>
    <font><b /><sz val="11" /><color rgb="FF1F2937" /><name val="Calibri" /><family val="2" /></font>
    <font><sz val="10" /><color rgb="FF374151" /><name val="Calibri" /><family val="2" /></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none" /></fill>
    <fill><patternFill patternType="gray125" /></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F2937" /><bgColor indexed="64" /></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB" /><bgColor indexed="64" /></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left /><right /><top /><bottom /><diagonal /></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB" /></left>
      <right style="thin"><color rgb="FFD1D5DB" /></right>
      <top style="thin"><color rgb="FFD1D5DB" /></top>
      <bottom style="thin"><color rgb="FFD1D5DB" /></bottom>
      <diagonal />
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" />
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" />
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" wrapText="1" />
    </xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" />
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" />
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="top" wrapText="1" />
    </xf>
    <xf numFmtId="200" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" />
    <xf numFmtId="201" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" />
    <xf numFmtId="202" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" />
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0" />
  </cellStyles>
</styleSheet>`;

  const workbookXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Athletes" sheetId="1" r:id="rId1" />
    <sheet name="Guide" sheetId="2" r:id="rId2" />
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" />
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml" />
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml" />
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml" />
</Relationships>`;

  const sheet1RelsXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml" />
</Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml" />
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" />
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml" />
  <Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml" />
</Types>`;

  return createZipBuffer([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
    { name: 'xl/styles.xml', data: stylesXml },
    { name: 'xl/sharedStrings.xml', data: sharedStringsXml },
    { name: 'xl/worksheets/sheet1.xml', data: sheet1Xml },
    { name: 'xl/worksheets/_rels/sheet1.xml.rels', data: sheet1RelsXml },
    { name: 'xl/tables/table1.xml', data: table1Xml },
    { name: 'xl/worksheets/sheet2.xml', data: sheet2Xml },
  ]);
}

export interface ValidateWorkbookContext {
  targetClub: ClubScopeInfo;
  targetBranch: BranchScopeInfo | null; // non-null when importing into a specific branch or as BRANCH_MANAGER
  requireBranchScope: boolean; // true for BRANCH_MANAGER or when a specific branch scope is selected
  authorizedClubs: Map<string, ClubScopeInfo>;
  clubBranches: Map<string, BranchScopeInfo>; // all branches for targetClub
  allBranchesById?: Map<string, { id: string; clubId: string; name: string }>; // to detect branch belonging to another club
  existingClubMembers: ExistingDbMemberRecord[]; // all members in targetClub
  existingMembersByIdGlobal?: Map<string, { id: string; club_id: string; branch_id: string | null }>; // to detect athlete_id belonging to another club
  referenceDate?: Date; // optional override for deterministic tests
}

function cellToString(cell: ParsedCell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  const str = String(cell.value).trim();
  // If a cell was exported with a leading single quote to escape +60..., strip the leading quote on phone/text fields unless it escapes '='
  if (str.startsWith("'") && str.length > 1 && str[1] !== '=') {
    return str.slice(1).trim();
  }
  return str;
}

function isSuspiciousFormulaString(raw: string, isPhoneField = false): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('=') || trimmed.startsWith("'=")) return true;
  if (trimmed.startsWith('@') || trimmed.startsWith("'@")) return true;
  if (
    (trimmed.startsWith('+') || trimmed.startsWith('-')) &&
    !(isPhoneField && /^[+-][0-9][0-9 ()-]{2,25}$/.test(trimmed)) &&
    /^[+-]\s*[A-Za-z_]+[\s(]/.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function parseAndValidateDateOfBirth(
  cell: ParsedCell | undefined,
  referenceDate: Date
): { isoDate: string | null; error?: string } {
  if (!cell || cell.value === null || cell.value === undefined || String(cell.value).trim() === '') {
    return { isoDate: null, error: 'date_of_birth is required.' };
  }

  let isoStr: string | null = null;

  if (typeof cell.value === 'number') {
    isoStr = excelSerialToIsoDate(cell.value);
    if (!isoStr) {
      return { isoDate: null, error: `Invalid Excel serial date value (${cell.value}).` };
    }
  } else {
    const rawStr = String(cell.value).trim();
    if (/^\d{5}(\.\d+)?$/.test(rawStr)) {
      isoStr = excelSerialToIsoDate(Number(rawStr));
    } else {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawStr);
      if (!match) {
        return {
          isoDate: null,
          error: `Invalid date format "${rawStr}". Expected YYYY-MM-DD (e.g. 2010-05-14).`,
        };
      }
      const y = Number(match[1]);
      const m = Number(match[2]);
      const d = Number(match[3]);
      const utc = new Date(Date.UTC(y, m - 1, d));
      if (
        utc.getUTCFullYear() !== y ||
        utc.getUTCMonth() + 1 !== m ||
        utc.getUTCDate() !== d
      ) {
        return {
          isoDate: null,
          error: `Invalid calendar date "${rawStr}".`,
        };
      }
      isoStr = rawStr;
    }
  }

  if (!isoStr) {
    return { isoDate: null, error: 'Invalid date_of_birth value.' };
  }

  const year = Number(isoStr.slice(0, 4));
  if (year < 1900) {
    return { isoDate: null, error: `date_of_birth (${isoStr}) cannot be earlier than 1900.` };
  }

  // Compare against referenceDate (today in YYYY-MM-DD)
  const refIso = referenceDate.toISOString().slice(0, 10);
  if (isoStr > refIso) {
    return {
      isoDate: null,
      error: `date_of_birth (${isoStr}) cannot be in the future.`,
    };
  }

  return { isoDate: isoStr };
}

/**
 * Parses and validates an uploaded .xlsx buffer against all SCMS business, security,
 * ownership, duplicate, and concurrency rules. Performs zero database writes.
 */
export function validateAthleteWorkbook(
  buffer: Buffer,
  context: ValidateWorkbookContext
): WorkbookValidationResult {
  const {
    targetClub,
    targetBranch,
    requireBranchScope,
    authorizedClubs,
    clubBranches,
    allBranchesById,
    existingClubMembers,
    existingMembersByIdGlobal,
    referenceDate = new Date(),
  } = context;

  const destination = {
    clubId: targetClub.id,
    clubName: targetClub.name,
    branchId: targetBranch ? targetBranch.id : null,
    branchName: targetBranch ? targetBranch.name : null,
  };

  let workbook;
  try {
    workbook = parseXlsxWorkbook(buffer);
  } catch (err) {
    const code = err instanceof WorkbookSecurityError ? err.code : 'INVALID_WORKBOOK';
    const message =
      err instanceof Error ? err.message : 'Failed to parse .xlsx workbook.';
    const wbErr: RowValidationError = {
      rowNumber: 0,
      field: 'workbook',
      code,
      message,
    };
    return {
      valid: false,
      destination,
      totalRows: 0,
      newCount: 0,
      updateCount: 0,
      unchangedCount: 0,
      errorCount: 1,
      workbookErrors: [wbErr],
      rowErrors: [],
      rows: [],
    };
  }

  const athletesSheet = workbook.sheets.get('Athletes');
  if (!athletesSheet) {
    const wbErr: RowValidationError = {
      rowNumber: 0,
      field: 'workbook',
      code: 'MISSING_ATHLETES_SHEET',
      message: 'Workbook must contain an "Athletes" worksheet.',
    };
    return {
      valid: false,
      destination,
      totalRows: 0,
      newCount: 0,
      updateCount: 0,
      unchangedCount: 0,
      errorCount: 1,
      workbookErrors: [wbErr],
      rowErrors: [],
      rows: [],
    };
  }

  const headerRow = athletesSheet.rows.find((r) => r.rowNumber === 1) || athletesSheet.rows[0];
  if (!headerRow || headerRow.cells.size === 0) {
    const wbErr: RowValidationError = {
      rowNumber: 1,
      field: 'headers',
      code: 'EMPTY_HEADERS',
      message: 'The Athletes worksheet is missing header row 1.',
    };
    return {
      valid: false,
      destination,
      totalRows: 0,
      newCount: 0,
      updateCount: 0,
      unchangedCount: 0,
      errorCount: 1,
      workbookErrors: [wbErr],
      rowErrors: [],
      rows: [],
    };
  }

  // Validate headers
  const workbookErrors: RowValidationError[] = [];
  const headerIndexToName = new Map<number, AthleteColumnName>();
  const headerNameToIndex = new Map<AthleteColumnName, number>();
  const seenHeaders = new Set<string>();
  const allowedHeaderSet = new Set<string>(ATHLETE_ALL_COLUMNS);

  for (const [colIdx, cell] of headerRow.cells.entries()) {
    const rawHeader = cellToString(cell).toLowerCase();
    if (!rawHeader) continue;

    if (seenHeaders.has(rawHeader)) {
      workbookErrors.push({
        rowNumber: headerRow.rowNumber,
        field: rawHeader,
        code: 'DUPLICATE_HEADER',
        message: `Duplicate column header "${rawHeader}" in column ${cell.colLetter}.`,
      });
      continue;
    }
    seenHeaders.add(rawHeader);

    if (!allowedHeaderSet.has(rawHeader)) {
      workbookErrors.push({
        rowNumber: headerRow.rowNumber,
        field: rawHeader,
        code: 'UNSUPPORTED_HEADER',
        message: `Unsupported column header "${rawHeader}" in column ${cell.colLetter}. Do not add custom columns that cannot be stored.`,
      });
      continue;
    }

    const typedHeader = rawHeader as AthleteColumnName;
    headerIndexToName.set(colIdx, typedHeader);
    headerNameToIndex.set(typedHeader, colIdx);
  }

  for (const reqHeader of ATHLETE_BASE_COLUMNS) {
    if (!headerNameToIndex.has(reqHeader)) {
      workbookErrors.push({
        rowNumber: headerRow.rowNumber,
        field: reqHeader,
        code: 'MISSING_REQUIRED_HEADER',
        message: `Missing required column header "${reqHeader}".`,
      });
    }
  }

  if (workbookErrors.length > 0) {
    return {
      valid: false,
      destination,
      totalRows: 0,
      newCount: 0,
      updateCount: 0,
      unchangedCount: 0,
      errorCount: workbookErrors.length,
      workbookErrors,
      rowErrors: [],
      rows: [],
    };
  }

  // Build lookups for existing members in targetClub
  const existingById = new Map<string, ExistingDbMemberRecord>();
  const existingByNormalizedIc = new Map<string, ExistingDbMemberRecord>();
  for (const m of existingClubMembers) {
    existingById.set(m.id.toLowerCase(), m);
    if (m.ic_passport && m.ic_passport.trim() !== '' && m.ic_passport.trim().toUpperCase() !== 'PENDING') {
      existingByNormalizedIc.set(normalizeIdNumber(m.ic_passport), m);
    }
  }

  // Map branches by lowercase name as well for validation
  const branchById = new Map<string, BranchScopeInfo>();
  for (const b of clubBranches.values()) {
    branchById.set(b.id.toLowerCase(), b);
  }

  const candidateRows = athletesSheet.rows.filter((r) => r.rowNumber !== headerRow.rowNumber);

  // Filter out completely blank rows AND untouched prefilled template rows
  const activeRows = candidateRows.filter((row) => {
    // If any cell has a formula, keep the row so we report the formula error
    for (const cell of row.cells.values()) {
      if (cell.hasFormula) return true;
    }

    // Check if any column outside headerIndexToName has a non-empty value
    for (const [colIdx, cell] of row.cells.entries()) {
      if (!headerIndexToName.has(colIdx) && cellToString(cell) !== '') {
        return true;
      }
    }

    // Check if any athlete-specific column (excluding prefilled club_id, club_name, branch_id, branch_name) is non-empty
    for (const colName of ATHLETE_SPECIFIC_COLUMNS) {
      const colIdx = headerNameToIndex.get(colName);
      if (colIdx !== undefined) {
        const cell = row.cells.get(colIdx);
        if (cellToString(cell) !== '') {
          return true;
        }
      }
    }

    return false;
  });

  if (activeRows.length === 0) {
    const emptyErr: RowValidationError = {
      rowNumber: 0,
      field: 'workbook',
      code: 'NO_ATHLETE_ROWS',
      message: 'No athlete records found in the workbook. Please enter at least one athlete row.',
    };
    return {
      valid: false,
      destination,
      totalRows: 0,
      newCount: 0,
      updateCount: 0,
      unchangedCount: 0,
      errorCount: 1,
      workbookErrors: [emptyErr],
      rowErrors: [],
      rows: [],
    };
  }

  if (activeRows.length > EXCEL_LIMITS.MAX_DATA_ROWS) {
    const limitErr: RowValidationError = {
      rowNumber: 0,
      field: 'workbook',
      code: 'TOO_MANY_ROWS',
      message: `Workbook contains ${activeRows.length} athlete rows, exceeding the maximum limit of ${EXCEL_LIMITS.MAX_DATA_ROWS} rows per import.`,
    };
    return {
      valid: false,
      destination,
      totalRows: activeRows.length,
      newCount: 0,
      updateCount: 0,
      unchangedCount: 0,
      errorCount: 1,
      workbookErrors: [limitErr],
      rowErrors: [],
      rows: [],
    };
  }

  const seenAthleteIdsInFile = new Map<string, number>(); // lower(athlete_id) -> first rowNumber
  const seenClubIdNumbersInFile = new Map<string, number>(); // `${lower(club_id)}::${normId}` -> first rowNumber

  const validatedRows: ValidatedAthleteRow[] = [];
  const allRowErrors: RowValidationError[] = [];

  let newCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  let errorRowCount = 0;

  for (const row of activeRows) {
    const rowNumber = row.rowNumber;
    const errors: RowValidationError[] = [];

    const getCell = (colName: AthleteColumnName): ParsedCell | undefined => {
      const idx = headerNameToIndex.get(colName);
      return idx !== undefined ? row.cells.get(idx) : undefined;
    };

    // 1. Check all cells in this row for formulas or unmapped populated columns
    for (const [colIdx, cell] of row.cells.entries()) {
      const mappedCol = headerIndexToName.get(colIdx);
      const strVal = cellToString(cell);
      const isPhone =
        mappedCol === 'phone' ||
        mappedCol === 'guardian_phone' ||
        mappedCol === 'emergency_contact_phone';

      if (cell.hasFormula || isSuspiciousFormulaString(strVal, isPhone)) {
        errors.push({
          rowNumber,
          field: mappedCol || cell.colLetter,
          code: 'FORMULA_NOT_ALLOWED',
          message: `Cell ${cell.ref} contains a formula, which is not permitted for security reasons.`,
        });
      } else if (!mappedCol && strVal !== '') {
        errors.push({
          rowNumber,
          field: cell.colLetter,
          code: 'UNMAPPED_CELL_VALUE',
          message: `Cell ${cell.ref} contains data outside the supported template columns.`,
        });
      }
    }

    const rawAthleteId = cellToString(getCell('athlete_id'));
    let rawClubId = cellToString(getCell('club_id'));
    let rawClubName = cellToString(getCell('club_name'));
    let rawBranchId = cellToString(getCell('branch_id'));
    let rawBranchName = cellToString(getCell('branch_name'));

    // Normalize legacy mock IDs if present in older templates
    if (rawClubId.toLowerCase() === 'scms-club-000001') {
      rawClubId = '11111111-1111-1111-1111-111111111111';
    }
    if (rawBranchId.toLowerCase() === 'scms-club-000001-b001') {
      rawBranchId = '22222222-2222-2222-2222-222222222222';
    } else if (rawBranchId.toLowerCase() === 'scms-club-000001-b002') {
      rawBranchId = '44444444-4444-4444-4444-444444444444';
    } else if (rawBranchId.toLowerCase() === 'scms-club-000001-b003') {
      rawBranchId = '33333333-3333-3333-3333-333333333333';
    }

    // If the user uploaded an un-prefilled template after selecting the target Club in the UI,
    // default blank club_id / club_name to the selected destination club when unambiguous.
    if (!rawClubId && !rawClubName) {
      rawClubId = targetClub.id;
      rawClubName = targetClub.name;
    } else if (!rawClubId && rawClubName) {
      const lowerName = rawClubName.toLowerCase();
      if (
        lowerName === targetClub.name.toLowerCase() ||
        (targetClub.shortName && lowerName === targetClub.shortName.toLowerCase()) ||
        (targetClub.displayName && lowerName === targetClub.displayName.toLowerCase())
      ) {
        rawClubId = targetClub.id;
      }
    } else if (rawClubId && !rawClubName && rawClubId.toLowerCase() === targetClub.id.toLowerCase()) {
      rawClubName = targetClub.name;
    }

    // If a specific targetBranch is selected in the UI and the row is for a new athlete (or existing athlete in targetBranch)
    // with blank branch columns in an un-prefilled template, populate from targetBranch.
    if (requireBranchScope && targetBranch && !rawBranchId && !rawBranchName) {
      const existingCheck = rawAthleteId ? existingById.get(rawAthleteId.toLowerCase()) : undefined;
      if (!existingCheck || (existingCheck.branch_id && existingCheck.branch_id.toLowerCase() === targetBranch.id.toLowerCase())) {
        rawBranchId = targetBranch.id;
        rawBranchName = targetBranch.name;
      }
    } else if (!rawBranchId && rawBranchName) {
      // Allow matching a branch within targetClub by exact branch_name / displayName if branch_id was omitted
      const lowerBranchName = rawBranchName.toLowerCase();
      const matchedByName = Array.from(clubBranches.values()).find(
        (b) =>
          b.name.toLowerCase() === lowerBranchName ||
          (b.displayName && b.displayName.toLowerCase() === lowerBranchName)
      );
      if (matchedByName) {
        rawBranchId = matchedByName.id;
      }
    } else if (rawBranchId && !rawBranchName) {
      const matchedById = branchById.get(rawBranchId.toLowerCase());
      if (matchedById) {
        rawBranchName = matchedById.name;
      }
    }
    const rawFullName = cellToString(getCell('full_name'));
    const rawIdType = cellToString(getCell('id_type'));
    const rawIdNumber = cellToString(getCell('id_number'));
    const dobCell = getCell('date_of_birth');
    const rawGender = cellToString(getCell('gender'));
    const rawNationality = cellToString(getCell('nationality'));
    const rawPhone = cellToString(getCell('phone'));
    const rawEmail = cellToString(getCell('email'));
    const rawAddress1 = cellToString(getCell('address_line_1'));
    const rawAddress2 = cellToString(getCell('address_line_2'));
    const rawPostcode = cellToString(getCell('postcode'));
    const rawCity = cellToString(getCell('city'));
    const rawState = cellToString(getCell('state'));
    const rawCountry = cellToString(getCell('country'));
    const rawGuardianName = cellToString(getCell('guardian_name'));
    const rawGuardianPhone = cellToString(getCell('guardian_phone'));
    const rawEmergencyName = cellToString(getCell('emergency_contact_name'));
    const rawEmergencyPhone = cellToString(getCell('emergency_contact_phone'));
    const rawBeltRank = cellToString(getCell('belt_rank'));
    const rawWeight = cellToString(getCell('weight_kg'));
    const rawHeight = cellToString(getCell('height_cm'));
    const rawStatus = cellToString(getCell('status'));
    const rawNotes = cellToString(getCell('notes'));
    const rawUpdatedAt = cellToString(getCell('updated_at'));

    // 2. Validate Club ownership & scope
    if (!rawClubId) {
      errors.push({
        rowNumber,
        field: 'club_id',
        code: 'REQUIRED_FIELD',
        message: 'club_id is required.',
      });
    } else if (!UUID_REGEX.test(rawClubId)) {
      errors.push({
        rowNumber,
        field: 'club_id',
        code: 'INVALID_UUID',
        message: `club_id "${rawClubId}" is not a valid UUID.`,
      });
    } else if (rawClubId.toLowerCase() !== targetClub.id.toLowerCase()) {
      const isAuthorizedOtherClub = authorizedClubs.has(rawClubId.toLowerCase());
      errors.push({
        rowNumber,
        field: 'club_id',
        code: isAuthorizedOtherClub ? 'CLUB_SCOPE_MISMATCH' : 'UNAUTHORIZED_CLUB',
        message: isAuthorizedOtherClub
          ? `Row club_id (${rawClubId}) does not match the selected import destination club (${targetClub.name}).`
          : `You are not authorized to import athletes into club_id "${rawClubId}".`,
      });
    }

    if (!rawClubName) {
      errors.push({
        rowNumber,
        field: 'club_name',
        code: 'REQUIRED_FIELD',
        message: 'club_name is required.',
      });
    } else if (
      rawClubId.toLowerCase() === targetClub.id.toLowerCase() &&
      rawClubName.toLowerCase() !== targetClub.name.toLowerCase() &&
      (!targetClub.shortName || rawClubName.toLowerCase() !== targetClub.shortName.toLowerCase()) &&
      (!targetClub.displayName || rawClubName.toLowerCase() !== targetClub.displayName.toLowerCase())
    ) {
      errors.push({
        rowNumber,
        field: 'club_name',
        code: 'CLUB_NAME_MISMATCH',
        message: `club_name "${rawClubName}" does not match club "${targetClub.name}".`,
      });
    }

    // 3. Validate Branch ownership & scope
    let resolvedBranch: BranchScopeInfo | null = null;
    if (requireBranchScope && !rawBranchId) {
      errors.push({
        rowNumber,
        field: 'branch_id',
        code: 'BRANCH_REQUIRED',
        message: 'branch_id is required when importing into a branch scope.',
      });
    }
    if (requireBranchScope && !rawBranchName) {
      errors.push({
        rowNumber,
        field: 'branch_name',
        code: 'BRANCH_NAME_REQUIRED',
        message: 'branch_name is required when importing into a branch scope.',
      });
    }

    if (!rawBranchId && rawBranchName) {
      errors.push({
        rowNumber,
        field: 'branch_id',
        code: 'BRANCH_ID_REQUIRED_WITH_NAME',
        message: 'branch_id is required when branch_name is provided.',
      });
    }

    if (rawBranchId) {
      if (!UUID_REGEX.test(rawBranchId)) {
        errors.push({
          rowNumber,
          field: 'branch_id',
          code: 'INVALID_UUID',
          message: `branch_id "${rawBranchId}" is not a valid UUID.`,
        });
      } else {
        const matchedBranch = branchById.get(rawBranchId.toLowerCase());
        if (!matchedBranch) {
          const otherClubBranch = allBranchesById?.get(rawBranchId.toLowerCase());
          errors.push({
            rowNumber,
            field: 'branch_id',
            code: otherClubBranch ? 'BRANCH_BELONGS_TO_OTHER_CLUB' : 'INVALID_BRANCH_ID',
            message: otherClubBranch
              ? `branch_id "${rawBranchId}" belongs to another club and cannot be used here.`
              : `branch_id "${rawBranchId}" does not exist in club "${targetClub.name}".`,
          });
        } else {
          resolvedBranch = matchedBranch;
          if (targetBranch && matchedBranch.id.toLowerCase() !== targetBranch.id.toLowerCase()) {
            errors.push({
              rowNumber,
              field: 'branch_id',
              code: 'UNAUTHORIZED_BRANCH_SCOPE',
              message: `Row branch_id (${matchedBranch.name}) does not match the selected branch destination (${targetBranch.name}).`,
            });
          }
          if (!rawBranchName) {
            errors.push({
              rowNumber,
              field: 'branch_name',
              code: 'BRANCH_NAME_REQUIRED',
              message: 'branch_name is required when branch_id is specified.',
            });
          } else if (
            rawBranchName.toLowerCase() !== matchedBranch.name.toLowerCase() &&
            (!matchedBranch.displayName ||
              rawBranchName.toLowerCase() !== matchedBranch.displayName.toLowerCase())
          ) {
            errors.push({
              rowNumber,
              field: 'branch_name',
              code: 'BRANCH_NAME_MISMATCH',
              message: `branch_name "${rawBranchName}" does not match branch "${matchedBranch.name}".`,
            });
          }
        }
      }
    }

    // 4. Required athlete fields & dropdowns
    if (!rawFullName) {
      errors.push({
        rowNumber,
        field: 'full_name',
        code: 'REQUIRED_FIELD',
        message: 'full_name is required.',
      });
    } else if (rawFullName.length > 150) {
      errors.push({
        rowNumber,
        field: 'full_name',
        code: 'MAX_LENGTH_EXCEEDED',
        message: 'full_name cannot exceed 150 characters.',
      });
    }

    let canonicalIdType: AllowedIdType = 'MyKad';
    if (!rawIdType) {
      errors.push({
        rowNumber,
        field: 'id_type',
        code: 'REQUIRED_FIELD',
        message: 'id_type is required.',
      });
    } else {
      const matchedType = ALLOWED_ID_TYPES.find(
        (t) => t.toLowerCase() === rawIdType.toLowerCase()
      );
      if (!matchedType) {
        errors.push({
          rowNumber,
          field: 'id_type',
          code: 'INVALID_DROPDOWN_VALUE',
          message: `Invalid id_type "${rawIdType}". Allowed values: ${ALLOWED_ID_TYPES.join(', ')}.`,
        });
      } else {
        canonicalIdType = matchedType;
      }
    }

    if (!rawIdNumber) {
      errors.push({
        rowNumber,
        field: 'id_number',
        code: 'REQUIRED_FIELD',
        message: 'id_number is required.',
      });
    } else if (rawIdNumber.length > 50) {
      errors.push({
        rowNumber,
        field: 'id_number',
        code: 'MAX_LENGTH_EXCEEDED',
        message: 'id_number cannot exceed 50 characters.',
      });
    }

    const dobValidation = parseAndValidateDateOfBirth(dobCell, referenceDate);
    if (dobValidation.error || !dobValidation.isoDate) {
      errors.push({
        rowNumber,
        field: 'date_of_birth',
        code: 'INVALID_DATE_OF_BIRTH',
        message: dobValidation.error || 'Invalid date_of_birth.',
      });
    }

    let canonicalGender: AllowedGender = 'Not specified';
    if (!rawGender) {
      errors.push({
        rowNumber,
        field: 'gender',
        code: 'REQUIRED_FIELD',
        message: 'gender is required.',
      });
    } else {
      const matchedGender = ALLOWED_GENDERS.find(
        (g) => g.toLowerCase() === rawGender.toLowerCase()
      );
      if (!matchedGender) {
        errors.push({
          rowNumber,
          field: 'gender',
          code: 'INVALID_DROPDOWN_VALUE',
          message: `Invalid gender "${rawGender}". Allowed values: ${ALLOWED_GENDERS.join(', ')}.`,
        });
      } else {
        canonicalGender = matchedGender;
      }
    }

    let canonicalStatus: AllowedStatus = 'Active';
    if (!rawStatus) {
      errors.push({
        rowNumber,
        field: 'status',
        code: 'REQUIRED_FIELD',
        message: 'status is required.',
      });
    } else {
      const matchedStatus = ALLOWED_STATUSES.find(
        (s) => s.toLowerCase() === rawStatus.toLowerCase()
      );
      if (!matchedStatus) {
        errors.push({
          rowNumber,
          field: 'status',
          code: 'INVALID_DROPDOWN_VALUE',
          message: `Invalid status "${rawStatus}". Allowed values: ${ALLOWED_STATUSES.join(', ')}.`,
        });
      } else {
        canonicalStatus = matchedStatus;
      }
    }

    // 5. Optional numeric, email, and field length checks
    let parsedWeight: number | null = null;
    if (rawWeight !== '') {
      const num = Number(rawWeight);
      if (!Number.isFinite(num) || num <= 0 || num > 500) {
        errors.push({
          rowNumber,
          field: 'weight_kg',
          code: 'INVALID_NUMERIC_VALUE',
          message: `weight_kg "${rawWeight}" must be a positive number between 0.1 and 500.`,
        });
      } else {
        parsedWeight = Math.round(num * 100) / 100;
      }
    }

    let parsedHeight: number | null = null;
    if (rawHeight !== '') {
      const num = Number(rawHeight);
      if (!Number.isFinite(num) || num <= 0 || num > 300) {
        errors.push({
          rowNumber,
          field: 'height_cm',
          code: 'INVALID_NUMERIC_VALUE',
          message: `height_cm "${rawHeight}" must be a positive number between 1 and 300.`,
        });
      } else {
        parsedHeight = Math.round(num * 100) / 100;
      }
    }

    if (rawEmail !== '') {
      if (rawEmail.length > 254 || !EMAIL_REGEX.test(rawEmail)) {
        errors.push({
          rowNumber,
          field: 'email',
          code: 'INVALID_EMAIL',
          message: `Invalid email address format "${rawEmail}".`,
        });
      }
    }

    const lengthLimits: Array<[AthleteColumnName, string, number]> = [
      ['nationality', rawNationality, 80],
      ['phone', rawPhone, 40],
      ['address_line_1', rawAddress1, 200],
      ['address_line_2', rawAddress2, 200],
      ['postcode', rawPostcode, 20],
      ['city', rawCity, 100],
      ['state', rawState, 100],
      ['country', rawCountry, 100],
      ['guardian_name', rawGuardianName, 150],
      ['guardian_phone', rawGuardianPhone, 40],
      ['emergency_contact_name', rawEmergencyName, 150],
      ['emergency_contact_phone', rawEmergencyPhone, 40],
      ['belt_rank', rawBeltRank, 80],
      ['notes', rawNotes, 1000],
    ];

    for (const [fieldName, val, maxLen] of lengthLimits) {
      if (val.length > maxLen) {
        errors.push({
          rowNumber,
          field: fieldName,
          code: 'MAX_LENGTH_EXCEEDED',
          message: `${fieldName} cannot exceed ${maxLen} characters.`,
        });
      }
    }

    // 6. Duplicate detection within the workbook
    if (rawAthleteId) {
      if (!UUID_REGEX.test(rawAthleteId)) {
        errors.push({
          rowNumber,
          field: 'athlete_id',
          code: 'INVALID_UUID',
          message: `athlete_id "${rawAthleteId}" is not a valid UUID.`,
        });
      } else {
        const lowerId = rawAthleteId.toLowerCase();
        const prevRow = seenAthleteIdsInFile.get(lowerId);
        if (prevRow !== undefined) {
          errors.push({
            rowNumber,
            field: 'athlete_id',
            code: 'DUPLICATE_ATHLETE_ID_IN_FILE',
            message: `Duplicate athlete_id "${rawAthleteId}" in workbook (already appears on row ${prevRow}).`,
          });
        } else {
          seenAthleteIdsInFile.set(lowerId, rowNumber);
        }
      }
    }

    const normIdNum = rawIdNumber ? normalizeIdNumber(rawIdNumber) : '';
    if (normIdNum && rawClubId) {
      const key = `${rawClubId.toLowerCase()}::${normIdNum}`;
      const prevRow = seenClubIdNumbersInFile.get(key);
      if (prevRow !== undefined) {
        errors.push({
          rowNumber,
          field: 'id_number',
          code: 'DUPLICATE_ID_NUMBER_IN_FILE',
          message: `Duplicate id_number "${rawIdNumber}" within the workbook (already appears on row ${prevRow}).`,
        });
      } else {
        seenClubIdNumbersInFile.set(key, rowNumber);
      }
    }

    const rowData: AthleteWorkbookRowData = {
      athlete_id: rawAthleteId,
      club_id: rawClubId,
      club_name: rawClubName,
      branch_id: resolvedBranch ? resolvedBranch.id : rawBranchId,
      branch_name: resolvedBranch ? resolvedBranch.name : rawBranchName,
      full_name: rawFullName,
      id_type: canonicalIdType,
      id_number: rawIdNumber,
      date_of_birth: dobValidation.isoDate || '',
      gender: canonicalGender,
      nationality: rawNationality,
      phone: rawPhone,
      email: rawEmail,
      address_line_1: rawAddress1,
      address_line_2: rawAddress2,
      postcode: rawPostcode,
      city: rawCity,
      state: rawState,
      country: rawCountry,
      guardian_name: rawGuardianName,
      guardian_phone: rawGuardianPhone,
      emergency_contact_name: rawEmergencyName,
      emergency_contact_phone: rawEmergencyPhone,
      belt_rank: rawBeltRank,
      weight_kg: parsedWeight,
      height_cm: parsedHeight,
      status: canonicalStatus,
      notes: rawNotes,
      updated_at: rawUpdatedAt,
    };

    // 7. Database reconciliation (Existing athlete lookup, cross-club/branch checks, concurrency, DB duplicates)
    let action: ValidatedRowAction = 'CREATE';
    let existingMemberId: string | undefined;
    let changedFields: string[] | undefined;

    if (rawAthleteId && UUID_REGEX.test(rawAthleteId)) {
      const lowerAthleteId = rawAthleteId.toLowerCase();
      const existingInClub = existingById.get(lowerAthleteId);

      if (!existingInClub) {
        const globalMatch = existingMembersByIdGlobal?.get(lowerAthleteId);
        if (globalMatch && globalMatch.club_id.toLowerCase() !== targetClub.id.toLowerCase()) {
          errors.push({
            rowNumber,
            field: 'athlete_id',
            code: 'ATHLETE_BELONGS_TO_OTHER_CLUB',
            message: `athlete_id "${rawAthleteId}" belongs to another club. Cross-club access or transfer is forbidden.`,
          });
        } else {
          errors.push({
            rowNumber,
            field: 'athlete_id',
            code: 'ATHLETE_NOT_FOUND',
            message: `athlete_id "${rawAthleteId}" does not exist in club "${targetClub.name}".`,
          });
        }
      } else {
        existingMemberId = existingInClub.id;

        // Check branch authorization and prevent branch transfers via spreadsheet
        const existingBranchId = existingInClub.branch_id
          ? existingInClub.branch_id.toLowerCase()
          : '';
        const requestedBranchId = rawBranchId ? rawBranchId.toLowerCase() : '';

        if (targetBranch && existingBranchId !== targetBranch.id.toLowerCase()) {
          errors.push({
            rowNumber,
            field: 'athlete_id',
            code: 'UNAUTHORIZED_ATHLETE_BRANCH',
            message: `Athlete "${existingInClub.full_name}" belongs to a different branch and cannot be accessed or updated under the current branch scope.`,
          });
        } else if (existingBranchId !== requestedBranchId) {
          errors.push({
            rowNumber,
            field: 'branch_id',
            code: 'TRANSFER_NOT_ALLOWED',
            message:
              'Moving an athlete between branches or club-level via spreadsheet update is not allowed. Please use the authorized transfer workflow.',
          });
        }

        // Check if updated id_number collides with a DIFFERENT existing athlete in the same club
        if (normIdNum) {
          const existingWithSameIc = existingByNormalizedIc.get(normIdNum);
          if (
            existingWithSameIc &&
            existingWithSameIc.id.toLowerCase() !== existingInClub.id.toLowerCase()
          ) {
            errors.push({
              rowNumber,
              field: 'id_number',
              code: 'DUPLICATE_ID_NUMBER_IN_DB',
              message: `Another athlete in this club already has identification number "${rawIdNumber}".`,
            });
          }
        }

        // Optimistic concurrency check via updated_at (if provided)
        if (rawUpdatedAt) {
          const parsedRowTs = Date.parse(rawUpdatedAt);
          const parsedDbTs = Date.parse(existingInClub.updated_at);
          if (Number.isNaN(parsedRowTs)) {
            errors.push({
              rowNumber,
              field: 'updated_at',
              code: 'INVALID_UPDATED_AT',
              message: `Invalid updated_at timestamp "${rawUpdatedAt}".`,
            });
          } else if (!Number.isNaN(parsedDbTs) && Math.abs(parsedRowTs - parsedDbTs) > 1000) {
            errors.push({
              rowNumber,
              field: 'updated_at',
              code: 'STALE_UPDATE_CONFLICT',
              message: `Stale record conflict: athlete "${existingInClub.full_name}" was modified in SCMS after this file was exported. Please export the latest roster before updating.`,
            });
          }
        }

        // Compare fields to determine UPDATE vs UNCHANGED
        const clubMap = new Map([[targetClub.id, targetClub]]);
        const currentMapped = mapDbMemberToWorkbookRow(
          existingInClub,
          clubMap,
          clubBranches
        );

        const diffs: string[] = [];
        const compareFields: Array<keyof AthleteWorkbookRowData> = [
          'full_name',
          'id_type',
          'id_number',
          'date_of_birth',
          'gender',
          'nationality',
          'phone',
          'email',
          'address_line_1',
          'address_line_2',
          'postcode',
          'city',
          'state',
          'country',
          'guardian_name',
          'guardian_phone',
          'emergency_contact_name',
          'emergency_contact_phone',
          'belt_rank',
          'weight_kg',
          'height_cm',
          'status',
          'notes',
        ];

        for (const f of compareFields) {
          const newV = rowData[f];
          const oldV = currentMapped[f];
          if (newV !== oldV) {
            diffs.push(f);
          }
        }

        changedFields = diffs;
        action = diffs.length > 0 ? 'UPDATE' : 'UNCHANGED';
      }
    } else {
      // New athlete creation: check if id_number already exists in DB for this club
      if (normIdNum) {
        const dupInDb = existingByNormalizedIc.get(normIdNum);
        if (dupInDb) {
          errors.push({
            rowNumber,
            field: 'id_number',
            code: 'DUPLICATE_ID_NUMBER_IN_DB',
            message: `An athlete with identification number "${rawIdNumber}" already exists in this club (${dupInDb.full_name}). Include their athlete_id to update the existing record.`,
          });
        }
      }
      action = 'CREATE';
    }

    if (errors.length > 0) {
      action = 'ERROR';
      errorRowCount++;
      allRowErrors.push(...errors);
    } else if (action === 'CREATE') {
      newCount++;
    } else if (action === 'UPDATE') {
      updateCount++;
    } else if (action === 'UNCHANGED') {
      unchangedCount++;
    }

    validatedRows.push({
      rowNumber,
      action,
      data: rowData,
      existingMemberId,
      changedFields,
      errors,
    });
  }

  return {
    valid: workbookErrors.length === 0 && allRowErrors.length === 0,
    destination,
    totalRows: validatedRows.length,
    newCount,
    updateCount,
    unchangedCount,
    errorCount: workbookErrors.length + errorRowCount,
    workbookErrors,
    rowErrors: allRowErrors,
    rows: validatedRows,
  };
}

