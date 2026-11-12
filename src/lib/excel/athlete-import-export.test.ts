import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  EXCEL_LIMITS,
  createZipBuffer,
  excelSerialToIsoDate,
  isoDateToExcelSerial,
  parseXlsxWorkbook,
} from './xlsx-engine';
import {
  ATHLETE_ALL_COLUMNS,
  ATHLETE_BASE_COLUMNS,
  AthleteWorkbookRowData,
  BranchScopeInfo,
  ClubScopeInfo,
  ExistingDbMemberRecord,
  ValidateWorkbookContext,
  generateAthleteWorkbook,
  mapDbMemberToWorkbookRow,
  sanitizeSpreadsheetText,
  validateAthleteWorkbook,
} from './athlete-workbook';
import {
  ScopeAuthorizationError,
  fetchAllScopedMembers,
  processAthleteWorkbookImport,
  resolveAuthorizedScope,
} from '../server/athlete-data-scope';

const CLUB_A: ClubScopeInfo = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Senshi Goju-Ryu Karate-Do Academy',
  shortName: 'Senshi Goju-Ryu',
};

const CLUB_B: ClubScopeInfo = {
  id: '6a7fb5d7-163c-4f1f-81ee-d73ab7efbbba',
  name: 'SCMS Integration Test Karate Club',
  shortName: 'SCMS Test Club',
};

const BRANCH_A1: BranchScopeInfo = {
  id: '22222222-2222-2222-2222-222222222222',
  clubId: CLUB_A.id,
  name: 'Dojo Saujana Puchong (HQ)',
};

const BRANCH_A2: BranchScopeInfo = {
  id: '33333333-3333-3333-3333-333333333333',
  clubId: CLUB_A.id,
  name: 'Dojo Shihan Bala',
};

const BRANCH_B1: BranchScopeInfo = {
  id: 'f75212f1-2fda-4c4e-8ba5-1f0bc162fbed',
  clubId: CLUB_B.id,
  name: 'Main Honbu Dojo',
};

function makeBaseRow(overrides: Partial<AthleteWorkbookRowData> = {}): AthleteWorkbookRowData {
  return {
    athlete_id: '',
    club_id: CLUB_A.id,
    club_name: CLUB_A.name,
    branch_id: BRANCH_A1.id,
    branch_name: BRANCH_A1.name,
    full_name: 'Amirul Hakim Bin Razak',
    id_type: 'MyKad',
    id_number: '080519-10-0123',
    date_of_birth: '2008-05-19',
    gender: 'Male',
    nationality: 'Malaysian',
    phone: '012-3456789',
    email: 'parent.shared@example.com',
    address_line_1: '12 Jalan Puchong Utama',
    address_line_2: 'Taman Saujana',
    postcode: '01000',
    city: 'Puchong',
    state: 'Selangor',
    country: 'Malaysia',
    guardian_name: 'Razak Bin Ahmad',
    guardian_phone: '019-0011223',
    emergency_contact_name: 'Siti Aminah',
    emergency_contact_phone: '013-0099887',
    belt_rank: 'Green Belt (6th Kyu)',
    weight_kg: 54.5,
    height_cm: 165.0,
    status: 'Active',
    notes: 'No allergies',
    updated_at: '',
    ...overrides,
  };
}

function makeValidationContext(
  overrides: Partial<ValidateWorkbookContext> = {}
): ValidateWorkbookContext {
  const authorizedClubs = new Map<string, ClubScopeInfo>([
    [CLUB_A.id.toLowerCase(), CLUB_A],
  ]);
  const clubBranches = new Map<string, BranchScopeInfo>([
    [BRANCH_A1.id, BRANCH_A1],
    [BRANCH_A2.id, BRANCH_A2],
  ]);
  const allBranchesById = new Map<
    string,
    { id: string; clubId: string; name: string }
  >([
    [BRANCH_A1.id.toLowerCase(), { id: BRANCH_A1.id, clubId: CLUB_A.id, name: BRANCH_A1.name }],
    [BRANCH_A2.id.toLowerCase(), { id: BRANCH_A2.id, clubId: CLUB_A.id, name: BRANCH_A2.name }],
    [BRANCH_B1.id.toLowerCase(), { id: BRANCH_B1.id, clubId: CLUB_B.id, name: BRANCH_B1.name }],
  ]);

  return {
    targetClub: CLUB_A,
    targetBranch: null,
    requireBranchScope: false,
    authorizedClubs,
    clubBranches,
    allBranchesById,
    existingClubMembers: [],
    existingMembersByIdGlobal: new Map(),
    referenceDate: new Date('2026-11-12T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SCMS Athlete Excel Template, Bulk Import, and Export Suite', () => {
  it('1. generates a scoped .xlsx template with 500 blank rows, Athletes & Guide sheets, and authorized branch IDs', () => {
    const buffer = generateAthleteWorkbook({
      mode: 'template',
      club: CLUB_A,
      selectedBranch: BRANCH_A1,
      authorizedBranches: [BRANCH_A1, BRANCH_A2],
    });

    const parsed = parseXlsxWorkbook(buffer);
    expect(parsed.sheetNames).toEqual(['Athletes', 'Guide']);

    const athletesSheet = parsed.sheets.get('Athletes')!;
    // 1 header row + 500 blank entry rows = 501 rows
    expect(athletesSheet.rows.length).toBe(EXCEL_LIMITS.TEMPLATE_BLANK_ROWS + 1);

    // Verify all 29 headers in row 1
    const headerRow = athletesSheet.rows[0];
    const headers = Array.from(headerRow.cells.values()).map((c) => c.value);
    expect(headers).toEqual([...ATHLETE_ALL_COLUMNS]);

    // Verify prefilled club_id, club_name, branch_id, branch_name on row 2
    const row2 = athletesSheet.rows[1];
    expect(row2.cells.get(1)?.value).toBe(CLUB_A.id);
    expect(row2.cells.get(2)?.value).toBe(CLUB_A.name);
    expect(row2.cells.get(3)?.value).toBe(BRANCH_A1.id);
    expect(row2.cells.get(4)?.value).toBe(BRANCH_A1.name);

    // Verify Guide sheet lists both authorized branch IDs
    const guideSheet = parsed.sheets.get('Guide')!;
    const guideText = guideSheet.rows
      .flatMap((r) => Array.from(r.cells.values()).map((c) => String(c.value ?? '')))
      .join(' ');
    expect(guideText).toContain(BRANCH_A1.id);
    expect(guideText).toContain(BRANCH_A2.id);
    expect(guideText).toContain('updated_at');
  });

  it('2. validates a club-level athlete import (blank branch_id and branch_name)', () => {
    const clubLevelRow = makeBaseRow({
      branch_id: '',
      branch_name: '',
      id_number: '090101-10-0011',
    });

    const buf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [clubLevelRow],
    });

    const res = validateAthleteWorkbook(buf, makeValidationContext());
    expect(res.valid).toBe(true);
    expect(res.totalRows).toBe(1);
    expect(res.newCount).toBe(1);
    expect(res.errorCount).toBe(0);
    expect(res.rows[0].data.branch_id).toBe('');
    expect(res.rows[0].data.branch_name).toBe('');
  });

  it('3. validates a branch-level athlete import and enforces branch matching', () => {
    const branchRow = makeBaseRow({
      branch_id: BRANCH_A1.id,
      branch_name: BRANCH_A1.name,
    });

    const buf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      selectedBranch: BRANCH_A1,
      athletes: [branchRow],
    });

    const res = validateAthleteWorkbook(
      buf,
      makeValidationContext({
        targetBranch: BRANCH_A1,
        requireBranchScope: true,
      })
    );

    expect(res.valid).toBe(true);
    expect(res.newCount).toBe(1);
    expect(res.rows[0].data.branch_id).toBe(BRANCH_A1.id);
  });

  it('4. supports importing athletes across two different branches of the same club', () => {
    const rowBranch1 = makeBaseRow({
      full_name: 'Athlete Dojo 1',
      id_number: '080101-10-0111',
      branch_id: BRANCH_A1.id,
      branch_name: BRANCH_A1.name,
    });
    const rowBranch2 = makeBaseRow({
      full_name: 'Athlete Dojo 2',
      id_number: '080202-10-0222',
      branch_id: BRANCH_A2.id,
      branch_name: BRANCH_A2.name,
    });

    const buf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [rowBranch1, rowBranch2],
    });

    const res = validateAthleteWorkbook(buf, makeValidationContext());
    expect(res.valid).toBe(true);
    expect(res.totalRows).toBe(2);
    expect(res.newCount).toBe(2);
    expect(res.rows[0].data.branch_id).toBe(BRANCH_A1.id);
    expect(res.rows[1].data.branch_id).toBe(BRANCH_A2.id);
  });

  it('5. preserves leading zeros in identification numbers, phone numbers, postcodes, and system IDs', () => {
    const row = makeBaseRow({
      id_number: '000519-01-0042',
      phone: '011-00998877',
      postcode: '01000',
      guardian_phone: '012-0001112',
      emergency_contact_phone: '013-0002223',
    });

    const buf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [row],
    });

    const res = validateAthleteWorkbook(buf, makeValidationContext());
    expect(res.valid).toBe(true);
    const parsedData = res.rows[0].data;
    expect(parsedData.id_number).toBe('000519-01-0042');
    expect(parsedData.phone).toBe('011-00998877');
    expect(parsedData.postcode).toBe('01000');
    expect(parsedData.guardian_phone).toBe('012-0001112');
    expect(parsedData.emergency_contact_phone).toBe('013-0002223');
  });

  it('6. handles Excel serial dates and YYYY-MM-DD dates accurately', () => {
    const serial = isoDateToExcelSerial('2012-05-19');
    expect(serial).toBe(41048);
    expect(excelSerialToIsoDate(serial!)).toBe('2012-05-19');

    const row = makeBaseRow({
      date_of_birth: '2012-05-19',
    });
    const buf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [row],
    });

    const res = validateAthleteWorkbook(buf, makeValidationContext());
    expect(res.valid).toBe(true);
    expect(res.rows[0].data.date_of_birth).toBe('2012-05-19');
  });

  it('7. rejects empty and malformed files, and ignores untouched prefilled template rows', () => {
    // Empty buffer
    const emptyRes = validateAthleteWorkbook(Buffer.alloc(0), makeValidationContext());
    expect(emptyRes.valid).toBe(false);
    expect(emptyRes.workbookErrors[0].code).toBe('EMPTY_FILE');

    // Non-ZIP malformed file
    const badRes = validateAthleteWorkbook(
      Buffer.from('not a valid xlsx zip file', 'utf8'),
      makeValidationContext()
    );
    expect(badRes.valid).toBe(false);
    expect(badRes.workbookErrors[0].code).toBe('INVALID_FILE_FORMAT');

    // Untouched template with 500 prefilled rows -> reports NO_ATHLETE_ROWS
    const untouchedTemplate = generateAthleteWorkbook({
      mode: 'template',
      club: CLUB_A,
      selectedBranch: BRANCH_A1,
    });
    const untouchedRes = validateAthleteWorkbook(
      untouchedTemplate,
      makeValidationContext()
    );
    expect(untouchedRes.valid).toBe(false);
    expect(untouchedRes.workbookErrors[0].code).toBe('NO_ATHLETE_ROWS');
  });

  it('8. detects missing, duplicate, and unsupported column headers', () => {
    const workbookXml = `<?xml version="1.0" encoding="utf-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Athletes" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    // Missing required headers and duplicate club_id header + custom unknown_col
    const sheet1Xml = `<?xml version="1.0" encoding="utf-8"?>
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>
          <row r="1">
            <c r="A1" t="inlineStr"><is><t>club_id</t></is></c>
            <c r="B1" t="inlineStr"><is><t>club_id</t></is></c>
            <c r="C1" t="inlineStr"><is><t>unknown_custom_col</t></is></c>
          </row>
        </sheetData>
      </worksheet>`;

    const customZip = createZipBuffer([
      { name: 'xl/workbook.xml', data: workbookXml },
      { name: 'xl/worksheets/sheet1.xml', data: sheet1Xml },
    ]);

    const res = validateAthleteWorkbook(customZip, makeValidationContext());
    expect(res.valid).toBe(false);
    const codes = res.workbookErrors.map((e) => e.code);
    expect(codes).toContain('DUPLICATE_HEADER');
    expect(codes).toContain('UNSUPPORTED_HEADER');
    expect(codes).toContain('MISSING_REQUIRED_HEADER');
  });

  it('9. rejects future birth dates, invalid calendar dates, invalid dropdowns, and non-positive weight/height', () => {
    const invalidRow = makeBaseRow({
      date_of_birth: '2029-01-01', // Future date
      id_type: 'DriverLicense', // Invalid dropdown
      gender: 'UnknownGender', // Invalid dropdown
      status: 'PendingApproval', // Invalid dropdown
      weight_kg: -45, // Negative weight
      height_cm: 0, // Zero height
      email: 'not-an-email',
    });

    const buf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [invalidRow],
    });

    const res = validateAthleteWorkbook(buf, makeValidationContext());
    expect(res.valid).toBe(false);
    const errFields = res.rowErrors.map((e) => e.field);
    expect(errFields).toContain('date_of_birth');
    expect(errFields).toContain('id_type');
    expect(errFields).toContain('gender');
    expect(errFields).toContain('status');
    expect(errFields).toContain('weight_kg');
    expect(errFields).toContain('height_cm');
    expect(errFields).toContain('email');
    // Verify exact Excel row number is 2
    expect(res.rowErrors.every((e) => e.rowNumber === 2)).toBe(true);
  });

  it('10. detects duplicate rows within the same workbook (duplicate id_number and duplicate athlete_id)', () => {
    const sharedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const row1 = makeBaseRow({
      athlete_id: sharedId,
      id_number: '100101-10-1234',
      full_name: 'First Athlete',
    });
    const row2 = makeBaseRow({
      athlete_id: sharedId,
      id_number: '100101101234', // Same ID number without dashes
      full_name: 'Second Athlete Duplicate',
    });

    const buf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [row1, row2],
    });

    const res = validateAthleteWorkbook(buf, makeValidationContext());
    expect(res.valid).toBe(false);
    const row3Errors = res.rowErrors.filter((e) => e.rowNumber === 3);
    expect(row3Errors.map((e) => e.code)).toContain('DUPLICATE_ATHLETE_ID_IN_FILE');
    expect(row3Errors.map((e) => e.code)).toContain('DUPLICATE_ID_NUMBER_IN_FILE');
  });

  it('11. detects existing database duplicates when a new row omits athlete_id', () => {
    const existingMember: ExistingDbMemberRecord = {
      id: '7dc910f1-a3d6-4051-845d-176082dbcadd',
      member_no: 'CSGR-1001',
      club_id: CLUB_A.id,
      branch_id: BRANCH_A1.id,
      full_name: 'Existing Athlete',
      gender: 'Male',
      date_of_birth: '2008-05-19',
      id_type: 'MyKad',
      ic_passport: '080519-10-0123',
      nationality: 'Malaysian',
      email: 'existing@example.com',
      phone: '012-3456789',
      status: 'Active',
      sport_data: {},
      emergency_contact: {},
      updated_at: '2026-10-01T00:00:00.000Z',
    };

    const newRowWithDuplicateIc = makeBaseRow({
      athlete_id: '', // Blank athlete_id
      id_number: '080519100123', // Matches existingMember's IC
    });

    const buf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [newRowWithDuplicateIc],
    });

    const res = validateAthleteWorkbook(
      buf,
      makeValidationContext({ existingClubMembers: [existingMember] })
    );
    expect(res.valid).toBe(false);
    expect(res.rowErrors[0].code).toBe('DUPLICATE_ID_NUMBER_IN_DB');
  });

  it('12 & 13. allows shared guardian email addresses across siblings and requires no login account', () => {
    const sibling1 = makeBaseRow({
      full_name: 'Nurul Aina Binti Razak',
      id_type: 'MyKid',
      id_number: '140202-10-0222',
      gender: 'Female',
      email: 'razak.parent@example.com',
      guardian_name: 'Razak Bin Ahmad',
      guardian_phone: '019-0011223',
    });
    const sibling2 = makeBaseRow({
      full_name: 'Nurul Iman Binti Razak',
      id_type: 'MyKid',
      id_number: '160404-10-0444',
      gender: 'Female',
      email: 'razak.parent@example.com', // Identical parent email
      guardian_name: 'Razak Bin Ahmad',
      guardian_phone: '019-0011223',
    });
    const athleteWithoutEmail = makeBaseRow({
      full_name: 'Harith Iskandar',
      id_type: 'MyKad',
      id_number: '090909-10-0999',
      email: '', // No email at all
    });

    const buf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [sibling1, sibling2, athleteWithoutEmail],
    });

    const res = validateAthleteWorkbook(buf, makeValidationContext());
    expect(res.valid).toBe(true);
    expect(res.newCount).toBe(3);
    expect(res.errorCount).toBe(0);
  });

  it('14 & 15. validates existing athlete updates, detects UNCHANGED vs UPDATE, and blocks stale updated_at conflicts', () => {
    const existingMember: ExistingDbMemberRecord = {
      id: '7dc910f1-a3d6-4051-845d-176082dbcadd',
      member_no: 'CSGR-1001',
      club_id: CLUB_A.id,
      branch_id: BRANCH_A1.id,
      full_name: 'Amirul Hakim Bin Razak',
      gender: 'Male',
      date_of_birth: '2008-05-19',
      id_type: 'MyKad',
      ic_passport: '080519-10-0123',
      nationality: 'Malaysian',
      email: 'parent.shared@example.com',
      phone: '012-3456789',
      address_line_1: '12 Jalan Puchong Utama',
      address_line_2: 'Taman Saujana',
      postcode: '01000',
      city: 'Puchong',
      state: 'Selangor',
      country: 'Malaysia',
      guardian_name: 'Razak Bin Ahmad',
      guardian_phone: '019-0011223',
      status: 'Active',
      notes: 'No allergies',
      sport_data: {
        beltRank: 'Green Belt (6th Kyu)',
        weightKg: 54.5,
        heightCm: 165.0,
        competitionExperience: 'Gold Medal 2025', // Extra sport_data key
      },
      emergency_contact: {
        name: 'Siti Aminah',
        phone: '013-0099887',
      },
      updated_at: '2026-11-10T10:00:00.000Z',
    };

    const clubMap = new Map([[CLUB_A.id, CLUB_A]]);
    const branchMap = new Map([[BRANCH_A1.id, BRANCH_A1]]);
    const exportedRow = mapDbMemberToWorkbookRow(existingMember, clubMap, branchMap);

    // 14a: Unchanged row -> action === 'UNCHANGED'
    const unchangedBuf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [exportedRow],
    });
    const unchangedRes = validateAthleteWorkbook(
      unchangedBuf,
      makeValidationContext({ existingClubMembers: [existingMember] })
    );
    expect(unchangedRes.valid).toBe(true);
    expect(unchangedRes.unchangedCount).toBe(1);
    expect(unchangedRes.updateCount).toBe(0);

    // 14b: Modified weight_kg and belt_rank -> action === 'UPDATE'
    const updatedRow = {
      ...exportedRow,
      belt_rank: 'Blue Belt (4th Kyu)',
      weight_kg: 56.0,
    };
    const updateBuf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [updatedRow],
    });
    const updateRes = validateAthleteWorkbook(
      updateBuf,
      makeValidationContext({ existingClubMembers: [existingMember] })
    );
    expect(updateRes.valid).toBe(true);
    expect(updateRes.updateCount).toBe(1);
    expect(updateRes.rows[0].changedFields).toEqual(['belt_rank', 'weight_kg']);

    // 15: Stale updated_at -> STALE_UPDATE_CONFLICT
    const staleRow = {
      ...updatedRow,
      updated_at: '2026-10-01T00:00:00.000Z', // Older than 2026-11-10T10:00:00.000Z
    };
    const staleBuf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [staleRow],
    });
    const staleRes = validateAthleteWorkbook(
      staleBuf,
      makeValidationContext({ existingClubMembers: [existingMember] })
    );
    expect(staleRes.valid).toBe(false);
    expect(staleRes.rowErrors[0].code).toBe('STALE_UPDATE_CONFLICT');
  });

  it('16 & 17. enforces branch-manager scope rules and rejects branch-manager requests with omitted or unauthorized branchId', async () => {
    // Mock adminClient for resolveAuthorizedScope
    const mockAdminClient = {
      from: (table: string) => ({
        select: () => {
          if (table === 'user_roles') {
            return {
              eq: async () => ({
                data: [
                  {
                    role: 'BRANCH_MANAGER',
                    club_id: CLUB_A.id,
                    branch_id: BRANCH_A1.id,
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === 'clubs') {
            return Promise.resolve({
              data: [
                {
                  id: CLUB_A.id,
                  name: CLUB_A.name,
                  short_name: CLUB_A.shortName,
                  display_name: CLUB_A.name,
                  primary_admin_id: 'other-admin',
                  status: 'Active',
                },
                {
                  id: CLUB_B.id,
                  name: CLUB_B.name,
                  short_name: CLUB_B.shortName,
                  display_name: CLUB_B.name,
                  primary_admin_id: 'other-admin',
                  status: 'Active',
                },
              ],
              error: null,
            });
          }
          if (table === 'club_branches') {
            return Promise.resolve({
              data: [
                {
                  id: BRANCH_A1.id,
                  club_id: CLUB_A.id,
                  name: BRANCH_A1.name,
                  display_name: BRANCH_A1.name,
                  status: 'Active',
                },
                {
                  id: BRANCH_A2.id,
                  club_id: CLUB_A.id,
                  name: BRANCH_A2.name,
                  display_name: BRANCH_A2.name,
                  status: 'Active',
                },
                {
                  id: BRANCH_B1.id,
                  club_id: CLUB_B.id,
                  name: BRANCH_B1.name,
                  display_name: BRANCH_B1.name,
                  status: 'Active',
                },
              ],
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        },
      }),
    } as any;

    // 17a: Branch manager omits branchId -> rejected with BRANCH_SCOPE_REQUIRED
    await expect(
      resolveAuthorizedScope({
        adminClient: mockAdminClient,
        userId: 'branch-mgr-user',
        clubId: CLUB_A.id,
        branchId: null,
      })
    ).rejects.toMatchObject({
      status: 403,
      code: 'BRANCH_SCOPE_REQUIRED',
    } as Partial<ScopeAuthorizationError>);

    // 17b: Branch manager passes 'ALL' -> rejected with BRANCH_SCOPE_REQUIRED
    await expect(
      resolveAuthorizedScope({
        adminClient: mockAdminClient,
        userId: 'branch-mgr-user',
        clubId: CLUB_A.id,
        branchId: 'ALL',
      })
    ).rejects.toMatchObject({
      status: 403,
      code: 'BRANCH_SCOPE_REQUIRED',
    });

    // 16a: Branch manager tries to access another branch (BRANCH_A2) -> rejected with UNAUTHORIZED_BRANCH_ACCESS
    await expect(
      resolveAuthorizedScope({
        adminClient: mockAdminClient,
        userId: 'branch-mgr-user',
        clubId: CLUB_A.id,
        branchId: BRANCH_A2.id,
      })
    ).rejects.toMatchObject({
      status: 403,
      code: 'UNAUTHORIZED_BRANCH_ACCESS',
    });

    // 16b: Branch manager tries to access another club (CLUB_B) -> rejected with UNAUTHORIZED_CLUB_ACCESS
    await expect(
      resolveAuthorizedScope({
        adminClient: mockAdminClient,
        userId: 'branch-mgr-user',
        clubId: CLUB_B.id,
        branchId: BRANCH_B1.id,
      })
    ).rejects.toMatchObject({
      status: 403,
      code: 'UNAUTHORIZED_CLUB_ACCESS',
    });

    // 16c: Branch manager accesses their assigned branch (BRANCH_A1) -> succeeds
    const validScope = await resolveAuthorizedScope({
      adminClient: mockAdminClient,
      userId: 'branch-mgr-user',
      clubId: CLUB_A.id,
      branchId: BRANCH_A1.id,
    });
    expect(validScope.targetBranch?.id).toBe(BRANCH_A1.id);
    expect(validScope.isBranchManagerOnly).toBe(true);
  });

  it('18, 19 & 20. rejects athlete IDs from another club, branch IDs from another club, and unauthorized branch transfers', () => {
    const existingMemberInBranchA1: ExistingDbMemberRecord = {
      id: '7dc910f1-a3d6-4051-845d-176082dbcadd',
      member_no: 'CSGR-1001',
      club_id: CLUB_A.id,
      branch_id: BRANCH_A1.id,
      full_name: 'Branch A1 Athlete',
      gender: 'Male',
      date_of_birth: '2008-05-19',
      id_type: 'MyKad',
      ic_passport: '080519-10-0123',
      nationality: 'Malaysian',
      email: null,
      phone: null,
      status: 'Active',
      sport_data: {},
      emergency_contact: {},
      updated_at: '2026-11-10T10:00:00.000Z',
    };

    const otherClubAthleteId = '60f27b9a-6e75-420c-804f-a05da51010e6';
    const globalMap = new Map([
      [
        otherClubAthleteId.toLowerCase(),
        { id: otherClubAthleteId, club_id: CLUB_B.id, branch_id: BRANCH_B1.id },
      ],
    ]);

    // Row 1: Athlete ID belonging to Club B submitted with Club A's club_id
    const rowOtherClubAthlete = makeBaseRow({
      athlete_id: otherClubAthleteId,
      id_number: '010101-10-9999',
    });

    // Row 2: Branch ID belonging to Club B submitted with Club A's club_id
    const rowOtherClubBranch = makeBaseRow({
      athlete_id: '',
      id_number: '020202-10-8888',
      branch_id: BRANCH_B1.id,
      branch_name: BRANCH_B1.name,
    });

    // Row 3: Existing athlete in Branch A1 moved to Branch A2 via spreadsheet
    const rowAttemptedTransfer = makeBaseRow({
      athlete_id: existingMemberInBranchA1.id,
      id_number: existingMemberInBranchA1.ic_passport!,
      branch_id: BRANCH_A2.id,
      branch_name: BRANCH_A2.name,
    });

    const buf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [rowOtherClubAthlete, rowOtherClubBranch, rowAttemptedTransfer],
    });

    const res = validateAthleteWorkbook(
      buf,
      makeValidationContext({
        existingClubMembers: [existingMemberInBranchA1],
        existingMembersByIdGlobal: globalMap,
      })
    );

    expect(res.valid).toBe(false);
    const errorCodes = res.rowErrors.map((e) => e.code);
    expect(errorCodes).toContain('ATHLETE_BELONGS_TO_OTHER_CLUB');
    expect(errorCodes).toContain('BRANCH_BELONGS_TO_OTHER_CLUB');
    expect(errorCodes).toContain('TRANSFER_NOT_ALLOWED');
  });

  it('21. rejects workbooks containing macros (vbaProject.bin) or formula cells', () => {
    // 21a: Macro archive rejection
    const macroZip = createZipBuffer([
      { name: 'xl/workbook.xml', data: '<workbook/>' },
      { name: 'xl/vbaProject.bin', data: 'fake-macro-binary' },
    ]);
    const macroRes = validateAthleteWorkbook(macroZip, makeValidationContext());
    expect(macroRes.valid).toBe(false);
    expect(macroRes.workbookErrors[0].code).toBe('MACROS_NOT_ALLOWED');

    // 21b: Formula cell rejection
    const formulaRow = makeBaseRow({
      full_name: '=HYPERLINK("http://evil.example.com","Click")',
    });
    const formulaBuf = generateAthleteWorkbook({
      mode: 'template', // In template mode, raw strings aren't pre-escaped with "'"
      club: CLUB_A,
      athletes: [formulaRow],
    });
    const formulaRes = validateAthleteWorkbook(formulaBuf, makeValidationContext());
    expect(formulaRes.valid).toBe(false);
    expect(formulaRes.rowErrors.some((e) => e.code === 'FORMULA_NOT_ALLOWED')).toBe(true);
  });

  it('22. prevents spreadsheet formula injection when exporting user-entered text', () => {
    expect(sanitizeSpreadsheetText('=CMD|"/c calc"!A0')).toBe('\'=CMD|"/c calc"!A0');
    expect(sanitizeSpreadsheetText('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
    expect(sanitizeSpreadsheetText('+1+1')).toBe("'+1+1");
    expect(sanitizeSpreadsheetText('-2+3')).toBe("'-2+3");
    // Valid international phone number with allowPhonePlus is kept clean
    expect(sanitizeSpreadsheetText('+6012-3456789', { allowPhonePlus: true })).toBe(
      '+6012-3456789'
    );
  });

  it('23. performs zero database writes in preview mode and supports idempotent commit & round-trip export/re-import', async () => {
    const dbMembers: ExistingDbMemberRecord[] = [];
    const csvHistoryRows: any[] = [];
    const auditLogRows: any[] = [];
    let writeCallsDuringPreview = 0;
    let currentPhase: 'preview' | 'commit' = 'preview';

    const mockAdminClient = {
      from: (table: string) => {
        if (table === 'members') {
          return {
            select: () => {
              const chain: any = {
                eq: () => chain,
                in: () => chain,
                or: () => chain,
                order: () => chain,
                range: async (start: number) => ({
                  data: start === 0 ? [...dbMembers] : [],
                  error: null,
                }),
                then: (resolve: any) =>
                  resolve({
                    data: dbMembers.map((m) => ({
                      id: m.id,
                      club_id: m.club_id,
                      branch_id: m.branch_id,
                    })),
                    error: null,
                  }),
              };
              return chain;
            },
            insert: (payload: any) => {
              if (currentPhase === 'preview') writeCallsDuringPreview++;
              const created: ExistingDbMemberRecord = {
                id: '99999999-9999-4999-8999-999999999999',
                ...payload,
              };
              dbMembers.push(created);
              return {
                select: () => ({
                  single: async () => ({ data: { id: created.id }, error: null }),
                }),
              };
            },
            update: (payload: any) => {
              if (currentPhase === 'preview') writeCallsDuringPreview++;
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      select: async () => {
                        dbMembers[0] = { ...dbMembers[0], ...payload };
                        return { data: [{ id: dbMembers[0].id }], error: null };
                      },
                    }),
                    select: async () => {
                      dbMembers[0] = { ...dbMembers[0], ...payload };
                      return { data: [{ id: dbMembers[0].id }], error: null };
                    },
                  }),
                }),
              };
            },
          };
        }
        if (table === 'member_roles') {
          return {
            insert: async () => {
              if (currentPhase === 'preview') writeCallsDuringPreview++;
              return { error: null };
            },
          };
        }
        if (table === 'scms_karatetech_participant_links') {
          return {
            update: () => ({
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            }),
          };
        }
        if (table === 'csv_history') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => ({
                  data:
                    csvHistoryRows.find((r) => r.idempotency_key === val) || null,
                  error: null,
                }),
              }),
            }),
            insert: (payload: any) => {
              if (currentPhase === 'preview') writeCallsDuringPreview++;
              const row = { id: `job-${csvHistoryRows.length + 1}`, ...payload };
              csvHistoryRows.push(row);
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: { id: row.id }, error: null }),
                }),
              };
            },
          };
        }
        if (table === 'audit_logs') {
          return {
            insert: async (payload: any) => {
              if (currentPhase === 'preview') writeCallsDuringPreview++;
              auditLogRows.push(payload);
              return { error: null };
            },
          };
        }
        return {};
      },
    } as any;

    const scope = {
      userId: 'admin-user-1',
      isGlobalAdmin: true,
      isClubAdmin: true,
      isBranchManagerOnly: false,
      targetClub: CLUB_A,
      targetBranch: null,
      authorizedClubs: new Map([[CLUB_A.id.toLowerCase(), CLUB_A]]),
      clubBranches: new Map([
        [BRANCH_A1.id, BRANCH_A1],
        [BRANCH_A2.id, BRANCH_A2],
      ]),
      authorizedBranches: [BRANCH_A1, BRANCH_A2],
      allBranchesById: new Map([
        [
          BRANCH_A1.id.toLowerCase(),
          { id: BRANCH_A1.id, clubId: CLUB_A.id, name: BRANCH_A1.name },
        ],
        [
          BRANCH_A2.id.toLowerCase(),
          { id: BRANCH_A2.id, clubId: CLUB_A.id, name: BRANCH_A2.name },
        ],
      ]),
    };

    const newAthleteRow = makeBaseRow({
      full_name: 'Roundtrip Test Athlete',
      id_number: '110203-10-0555',
    });
    const wbBuf = generateAthleteWorkbook({
      mode: 'export',
      club: CLUB_A,
      athletes: [newAthleteRow],
    });

    // Step A: Preview mode -> 0 DB writes
    currentPhase = 'preview';
    const previewOut = await processAthleteWorkbookImport({
      adminClient: mockAdminClient,
      scope,
      fileBuffer: wbBuf,
      fileName: 'test.xlsx',
      mode: 'preview',
    });
    expect(previewOut.validation.valid).toBe(true);
    expect(previewOut.validation.newCount).toBe(1);
    expect(writeCallsDuringPreview).toBe(0);
    expect(dbMembers.length).toBe(0);

    // Step B: Commit mode -> creates 1 athlete & writes audit record without raw IC in logs
    currentPhase = 'commit';
    const commitOut = await processAthleteWorkbookImport({
      adminClient: mockAdminClient,
      scope,
      fileBuffer: wbBuf,
      fileName: 'test.xlsx',
      mode: 'commit',
      idempotencyKey: 'idem-key-123',
    });
    expect(commitOut.commitResult?.success).toBe(true);
    expect(commitOut.commitResult?.createdCount).toBe(1);
    expect(dbMembers.length).toBe(1);
    expect(JSON.stringify(auditLogRows)).not.toContain('110203-10-0555');

    // Step C: Idempotent retry with same idempotencyKey -> does NOT create a duplicate
    const retryOut = await processAthleteWorkbookImport({
      adminClient: mockAdminClient,
      scope,
      fileBuffer: wbBuf,
      fileName: 'test.xlsx',
      mode: 'commit',
      idempotencyKey: 'idem-key-123',
    });
    expect(retryOut.commitResult?.idempotentReplay).toBe(true);
    expect(dbMembers.length).toBe(1);
  });

  it('24. parses the reference SCMS_Athlete_Bulk_Template.xlsx workbook when present', () => {
    const refPath = 'C:/Users/svana/Downloads/SCMS_Athlete_Bulk_Template.xlsx';
    if (!fs.existsSync(refPath)) return;

    const refBuf = fs.readFileSync(refPath);
    const parsed = parseXlsxWorkbook(refBuf);
    expect(parsed.sheetNames).toEqual(['Athletes', 'Guide']);

    const athletesSheet = parsed.sheets.get('Athletes')!;
    expect(athletesSheet.rows.length).toBe(501);

    const headers = Array.from(athletesSheet.rows[0].cells.values()).map(
      (c) => c.value
    );
    expect(headers).toEqual([...ATHLETE_BASE_COLUMNS]);

    // Untouched reference template should cleanly report NO_ATHLETE_ROWS (all 500 blank rows ignored)
    const valRes = validateAthleteWorkbook(refBuf, makeValidationContext());
    expect(valRes.valid).toBe(false);
    expect(valRes.workbookErrors[0].code).toBe('NO_ATHLETE_ROWS');
  });

  it(
    '25. executes live SCMS database round-trip verification (scoped export, preview, write, idempotent retry, update, and cleanup)',
    async () => {
      const envPath = 'c:/Users/svana/Projects/Scms/.env.local';
      if (!fs.existsSync(envPath)) return;

      const envText = fs.readFileSync(envPath, 'utf8');
      const env = Object.fromEntries(
        envText
          .split(/\r?\n/)
          .filter((l) => l && !l.startsWith('#') && l.includes('='))
          .map((l) => [
            l.slice(0, l.indexOf('=')).trim(),
            l.slice(l.indexOf('=') + 1).trim(),
          ])
      );
      if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;

      const adminClient = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const SUPERADMIN_USER_ID = '899d161b-f099-486b-9389-4c2ff949d99b';
      const SENSHI_CLUB_ID = '11111111-1111-1111-1111-111111111111';
      const SENSHI_HQ_BRANCH_ID = '22222222-2222-2222-2222-222222222222';
      const TEST_CLUB_ID = '4e55fdd1-ccfa-42db-b469-9a8fa9880ae7';

      // 1. Read-only export & preview check on Senshi Goju-Ryu
      const senshiClubScope = await resolveAuthorizedScope({
        adminClient,
        userId: SUPERADMIN_USER_ID,
        clubId: SENSHI_CLUB_ID,
        branchId: null,
      });

      const senshiAllMembers = await fetchAllScopedMembers({
        adminClient,
        clubId: SENSHI_CLUB_ID,
      });
      expect(senshiAllMembers.length).toBeGreaterThanOrEqual(5);

      const senshiHqMembers = await fetchAllScopedMembers({
        adminClient,
        clubId: SENSHI_CLUB_ID,
        branchId: SENSHI_HQ_BRANCH_ID,
      });
      expect(senshiHqMembers.length).toBe(2);

      const senshiClubMap = new Map([
        [senshiClubScope.targetClub.id, senshiClubScope.targetClub],
      ]);
      const senshiExportRows = senshiAllMembers.map((m) =>
        mapDbMemberToWorkbookRow(m, senshiClubMap, senshiClubScope.clubBranches)
      );
      const senshiExportBuf = generateAthleteWorkbook({
        mode: 'export',
        club: senshiClubScope.targetClub,
        authorizedBranches: senshiClubScope.authorizedBranches,
        athletes: senshiExportRows,
      });

      const senshiPreview = await processAthleteWorkbookImport({
        adminClient,
        scope: senshiClubScope,
        fileBuffer: senshiExportBuf,
        fileName: 'Senshi_Export_Roundtrip.xlsx',
        mode: 'preview',
      });
      expect(senshiPreview.validation.valid).toBe(true);
      expect(senshiPreview.validation.unchangedCount).toBe(senshiAllMembers.length);
      expect(senshiPreview.validation.newCount).toBe(0);
      expect(senshiPreview.validation.updateCount).toBe(0);

      // 2. Live write, idempotent retry, export, update, and cleanup in SCMS TEST Karate Club 20261029
      const testClubScope = await resolveAuthorizedScope({
        adminClient,
        userId: SUPERADMIN_USER_ID,
        clubId: TEST_CLUB_ID,
        branchId: null,
      });

      const syntheticRows: AthleteWorkbookRowData[] = [
        makeBaseRow({
          club_id: testClubScope.targetClub.id,
          club_name: testClubScope.targetClub.name,
          branch_id: '',
          branch_name: '',
          full_name: 'SYNTHETIC TEST ATHLETE ONE',
          id_type: 'MyKad',
          id_number: '090102-10-0091',
          date_of_birth: '2009-01-02',
          gender: 'Male',
          phone: '012-0011223',
          email: 'synthetic.parent@example.com',
          postcode: '01000',
          belt_rank: 'Yellow Belt (8th Kyu)',
          weight_kg: 48.5,
          height_cm: 158.0,
        }),
        makeBaseRow({
          club_id: testClubScope.targetClub.id,
          club_name: testClubScope.targetClub.name,
          branch_id: '',
          branch_name: '',
          full_name: 'SYNTHETIC TEST ATHLETE TWO',
          id_type: 'MyKid',
          id_number: '130405-10-0092',
          date_of_birth: '2013-04-05',
          gender: 'Female',
          phone: '012-0011223',
          email: 'synthetic.parent@example.com', // Shared parent email
          postcode: '01000',
          belt_rank: 'White Belt',
          weight_kg: 36.0,
          height_cm: 140.0,
        }),
      ];

      const importBuf = generateAthleteWorkbook({
        mode: 'export',
        club: testClubScope.targetClub,
        athletes: syntheticRows,
      });

      const idemKey = `synthetic-verify-${Date.now()}`;
      const commitRes = await processAthleteWorkbookImport({
        adminClient,
        scope: testClubScope,
        fileBuffer: importBuf,
        fileName: 'synthetic_verify.xlsx',
        mode: 'commit',
        idempotencyKey: idemKey,
      });

      expect(commitRes.commitResult?.success).toBe(true);
      expect(commitRes.commitResult?.createdCount).toBe(2);

      const createdIds = commitRes.commitResult!.affectedMemberIds;
      const createdJobId = commitRes.commitResult!.jobId;

      try {
        // Verify idempotent retry does not duplicate rows
        const retryRes = await processAthleteWorkbookImport({
          adminClient,
          scope: testClubScope,
          fileBuffer: importBuf,
          fileName: 'synthetic_verify.xlsx',
          mode: 'commit',
          idempotencyKey: idemKey,
        });
        expect(retryRes.commitResult?.idempotentReplay).toBe(true);

        // Export test club, modify athlete 1, keep athlete 2 unchanged, and re-import
        const exportedMembers = await fetchAllScopedMembers({
          adminClient,
          clubId: TEST_CLUB_ID,
        });
        expect(exportedMembers.length).toBe(2);
        // Verify leading zeros preserved in DB
        expect(exportedMembers[0].ic_passport).toBe('090102-10-0091');
        expect(exportedMembers[0].postcode).toBe('01000');
        expect(exportedMembers[0].profile_id).toBeNull();

        const testClubMap = new Map([
          [testClubScope.targetClub.id, testClubScope.targetClub],
        ]);
        const exportedRows = exportedMembers.map((m) =>
          mapDbMemberToWorkbookRow(m, testClubMap, testClubScope.clubBranches)
        );
        exportedRows[0].belt_rank = 'Orange Belt (7th Kyu)';
        exportedRows[0].weight_kg = 50.0;

        const updateBuf = generateAthleteWorkbook({
          mode: 'export',
          club: testClubScope.targetClub,
          athletes: exportedRows,
        });

        const updateCommit = await processAthleteWorkbookImport({
          adminClient,
          scope: testClubScope,
          fileBuffer: updateBuf,
          fileName: 'synthetic_update.xlsx',
          mode: 'commit',
        });
        expect(updateCommit.commitResult?.success).toBe(true);
        expect(updateCommit.commitResult?.updatedCount).toBe(1);
        expect(updateCommit.commitResult?.unchangedCount).toBe(1);

        const updateJobId = updateCommit.commitResult!.jobId;
        await adminClient.from('csv_history').delete().eq('id', updateJobId);
        await adminClient.from('audit_logs').delete().eq('entity_id', updateJobId);
      } finally {
        // Always clean up synthetic records
        await adminClient.from('members').delete().in('id', createdIds);
        await adminClient.from('csv_history').delete().eq('id', createdJobId);
        await adminClient.from('audit_logs').delete().eq('entity_id', createdJobId);
      }

      const remainingAfterCleanup = await fetchAllScopedMembers({
        adminClient,
        clubId: TEST_CLUB_ID,
      });
      expect(remainingAfterCleanup.length).toBe(0);
    },
    30000
  );
});

