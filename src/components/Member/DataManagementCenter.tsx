'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  GitBranch,
  Search,
  RefreshCw,
  FileDown,
  ShieldCheck,
  History,
  Info,
  Check,
  ArrowRight,
  FileWarning,
} from 'lucide-react';

interface ClubOption {
  id: string;
  name: string;
  shortName?: string | null;
  displayName?: string | null;
}

interface BranchOption {
  id: string;
  clubId: string;
  name: string;
  displayName?: string | null;
}

interface RowValidationError {
  rowNumber: number;
  field: string;
  code: string;
  message: string;
}

interface ValidatedAthleteRow {
  rowNumber: number;
  action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'ERROR';
  data: {
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
    belt_rank: string;
    weight_kg: number | null;
    height_cm: number | null;
    status: string;
  };
  existingMemberId?: string;
  changedFields?: string[];
  errors: RowValidationError[];
}

interface WorkbookValidationResult {
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

interface BulkImportCommitResult {
  success: boolean;
  jobId: string;
  idempotentReplay: boolean;
  destination: {
    clubId: string;
    clubName: string;
    branchId: string | null;
    branchName: string | null;
  };
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedCount: number;
  affectedMemberIds: string[];
  errors: RowValidationError[];
}

interface HistoryEntry {
  id: string;
  operation: 'IMPORT' | 'EXPORT';
  module_name: string;
  filename: string;
  total_records: number;
  successful_records: number;
  created_records: number;
  updated_records: number;
  unchanged_records: number;
  error_records: number;
  status: string;
  club_id: string | null;
  branch_id: string | null;
  created_at: string;
}

interface DataManagementCenterProps {
  clubId?: string;
  branchId?: string;
  initialSearchFilter?: string;
  onImportSuccess?: () => void;
}

const TRANSLATIONS = {
  en: {
    title: 'Athlete Data Management Center',
    subtitle:
      'Download scoped Excel templates, bulk import new or updated athlete rosters, and export authoritative club or branch records.',
    scopeHeader: '1. Select Destination Club & Branch Scope',
    clubLabel: 'Authorized Club',
    branchLabel: 'Branch Scope',
    entireClubOption: 'Entire Club (All Authorized Branches / Club-Level)',
    destinationBanner: 'Active Target Scope',
    clubWideBadge: 'Club-Wide Scope',
    branchScopedBadge: 'Branch-Specific Scope',
    templateTitle: 'Download Excel Template',
    templateDesc:
      'Generates a real .xlsx workbook with "Athletes" (500 entry rows, frozen headers, dropdowns, text-protected IDs) and "Guide" (field dictionary & authorized branch IDs).',
    downloadTemplateBtn: 'Download Scoped .xlsx Template',
    downloadingTemplate: 'Generating Template...',
    exportTitle: 'Export Athletes (.xlsx)',
    exportDesc:
      'Export authoritative athlete records in the exact round-trip template format. Exported files can be edited in Excel and re-imported safely.',
    statusFilterLabel: 'Athlete Status Filter',
    statusAll: 'All Statuses (Active & Inactive)',
    statusActive: 'Active Only',
    statusInactive: 'Inactive Only',
    searchFilterLabel: 'Optional Search Filter (Name, IC/Passport, Member No, Phone)',
    searchFilterPlaceholder: 'Leave blank to export all matching athletes in scope...',
    exportBtn: 'Export Athletes to Excel',
    exportingBtn: 'Exporting Roster...',
    exportSuccessMsg: 'Successfully exported {count} athlete record(s) to {file}.',
    importTitle: 'Bulk Import Athletes (.xlsx)',
    importDesc:
      'Workflow: Select .xlsx file → Validate & Preview (no DB writes) → Confirm Import → Audit Results.',
    limitsInfo:
      'Supported limits: .xlsx workbook only • Max 5 MB • Max 2,000 athlete rows • Formulas, macros, and external links are rejected.',
    selectFileBtn: 'Select Excel (.xlsx) Workbook',
    validateBtn: 'Validate & Preview',
    validatingBtn: 'Validating Workbook...',
    resetBtn: 'Clear / Choose Another File',
    previewHeader: 'Import Validation Preview (Zero Database Writes Performed)',
    totalRows: 'Total Athlete Rows',
    newRecords: 'New Athletes',
    updatedRecords: 'Updates',
    unchangedRecords: 'Unchanged',
    errorRecords: 'Errors',
    downloadErrorReportBtn: 'Download Error Report (.csv)',
    allowPartialLabel:
      'Allow partial import of valid rows (skip rows with errors and import only valid rows)',
    confirmImportBtn: 'Confirm & Commit Import',
    committingBtn: 'Committing Import...',
    resultsHeader: 'Bulk Import Results',
    jobIdLabel: 'Audit Job ID',
    createdLabel: 'Created',
    updatedLabel: 'Updated',
    unchangedLabel: 'Unchanged',
    failedLabel: 'Failed / Skipped',
    importAnotherBtn: 'Import Another Workbook',
    errorTableTitle: 'Validation Errors (By Excel Row Number)',
    previewTableTitle: 'Row-by-Row Preview',
    colRow: 'Excel Row',
    colAction: 'Action',
    colName: 'Full Name',
    colId: 'ID Type / Number',
    colDob: 'DOB / Gender',
    colBranch: 'Branch',
    colStatus: 'Status',
    colDetails: 'Changes / Errors',
    historyTitle: 'Recent Import & Export Audit Log',
    noHistory: 'No import or export operations recorded for this scope yet.',
  },
  ms: {
    title: 'Pusat Pengurusan Data Atlet',
    subtitle:
      'Muat turun templat Excel mengikut skop, import pukal senarai atlet baharu atau dikemas kini, dan eksport rekod rasmi kelab atau cawangan.',
    scopeHeader: '1. Pilih Skop Kelab & Cawangan Sasaran',
    clubLabel: 'Kelab Dibenarkan',
    branchLabel: 'Skop Cawangan',
    entireClubOption: 'Seluruh Kelab (Semua Cawangan / Peringkat Kelab)',
    destinationBanner: 'Skop Sasaran Aktif',
    clubWideBadge: 'Skop Seluruh Kelab',
    branchScopedBadge: 'Skop Cawangan Khusus',
    templateTitle: 'Muat Turun Templat Excel',
    templateDesc:
      'Menjana buku kerja .xlsx sebenar dengan helaian "Athletes" (500 baris kemasukan, pengepala beku, menu pilihan) dan "Guide" (panduan medan & ID cawangan).',
    downloadTemplateBtn: 'Muat Turun Templat .xlsx',
    downloadingTemplate: 'Menjana Templat...',
    exportTitle: 'Eksport Atlet (.xlsx)',
    exportDesc:
      'Eksport rekod atlet rasmi dalam format templat penuh. Fail yang dieksport boleh dikemas kini dalam Excel dan diimport semula dengan selamat.',
    statusFilterLabel: 'Penapis Status Atlet',
    statusAll: 'Semua Status (Aktif & Tidak Aktif)',
    statusActive: 'Aktif Sahaja',
    statusInactive: 'Tidak Aktif Sahaja',
    searchFilterLabel: 'Penapis Carian Pilihan (Nama, KP/Pasport, No. Ahli, Telefon)',
    searchFilterPlaceholder: 'Biarkan kosong untuk mengeksport semua atlet dalam skop...',
    exportBtn: 'Eksport Atlet ke Excel',
    exportingBtn: 'Mengeksport Senarai...',
    exportSuccessMsg: 'Berjaya mengeksport {count} rekod atlet ke {file}.',
    importTitle: 'Import Pukal Atlet (.xlsx)',
    importDesc:
      'Aliran kerja: Pilih fail .xlsx → Sahkan & Pratonton (tiada perubahan DB) → Sahkan Import → Keputusan Audit.',
    limitsInfo:
      'Had disokong: Fail .xlsx sahaja • Maks 5 MB • Maks 2,000 baris atlet • Formula, makro dan pautan luar ditolak.',
    selectFileBtn: 'Pilih Buku Kerja Excel (.xlsx)',
    validateBtn: 'Sahkan & Pratonton',
    validatingBtn: 'Mengesahkan Fail...',
    resetBtn: 'Padam / Pilih Fail Lain',
    previewHeader: 'Pratonton Pengesahan Import (Tiada Penulisan Pangkalan Data)',
    totalRows: 'Jumlah Baris Atlet',
    newRecords: 'Atlet Baharu',
    updatedRecords: 'Kemas Kini',
    unchangedRecords: 'Tiada Perubahan',
    errorRecords: 'Ralat',
    downloadErrorReportBtn: 'Muat Turun Laporan Ralat (.csv)',
    allowPartialLabel:
      'Benarkan import separa bagi baris yang sah (langkau baris ralat dan import baris sah sahaja)',
    confirmImportBtn: 'Sahkan & Laksanakan Import',
    committingBtn: 'Melaksanakan Import...',
    resultsHeader: 'Keputusan Import Pukal',
    jobIdLabel: 'ID Kerja Audit',
    createdLabel: 'Dicipta',
    updatedLabel: 'Dikemas Kini',
    unchangedLabel: 'Tidak Berubah',
    failedLabel: 'Gagal / Dilangkau',
    importAnotherBtn: 'Import Buku Kerja Lain',
    errorTableTitle: 'Senarai Ralat Pengesahan (Mengikut Baris Excel)',
    previewTableTitle: 'Pratonton Baris demi Baris',
    colRow: 'Baris Excel',
    colAction: 'Tindakan',
    colName: 'Nama Penuh',
    colId: 'Jenis / No. Pengenalan',
    colDob: 'Tarikh Lahir / Jantina',
    colBranch: 'Cawangan',
    colStatus: 'Status',
    colDetails: 'Perubahan / Ralat',
    historyTitle: 'Log Audit Import & Eksport Terkini',
    noHistory: 'Tiada sejarah operasi import atau eksport untuk skop ini.',
  },
} as const;

export const DataManagementCenter: React.FC<DataManagementCenterProps> = ({
  clubId: propClubId,
  branchId: propBranchId,
  initialSearchFilter = '',
  onImportSuccess,
}) => {
  const { currentUser, activeClub, activeBranch, activeRole } = useAuth();
  const activeClubId = propClubId || activeClub?.id || currentUser?.activeClubId;
  const activeBranchId = propBranchId !== undefined ? propBranchId : (activeBranch?.id || currentUser?.activeBranchId);

  const [lang, setLang] = useState<'en' | 'ms'>('en');
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const saved =
      typeof window !== 'undefined'
        ? localStorage.getItem('scms_language')
        : null;
    if (saved === 'ms' || currentUser?.preferredLanguage === 'ms') {
      setLang('ms');
    }
  }, [currentUser?.preferredLanguage]);

  const toggleLanguage = (nextLang: 'en' | 'ms') => {
    setLang(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('scms_language', nextLang);
    }
  };

  // Scope state
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>(activeClubId || '');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    activeBranchId || 'ALL'
  );
  const [loadingScope, setLoadingScope] = useState<boolean>(true);

  // Template download state
  const [downloadingTemplate, setDownloadingTemplate] = useState<boolean>(false);

  // Export state
  const [exportStatusFilter, setExportStatusFilter] = useState<string>('ALL');
  const [exportSearchQuery, setExportSearchQuery] = useState<string>(
    initialSearchFilter
  );
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Import workflow state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validating, setValidating] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);
  const [validationResult, setValidationResult] =
    useState<WorkbookValidationResult | null>(null);
  const [commitResult, setCommitResult] =
    useState<BulkImportCommitResult | null>(null);
  const [allowPartial, setAllowPartial] = useState<boolean>(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Audit history state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Determine role capabilities for the selected club
  const userRoles = useMemo(
    () => currentUser?.roles || [],
    [currentUser?.roles]
  );

  const isGlobalAdmin = useMemo(
    () =>
      activeRole === 'SUPERADMIN' ||
      activeRole === 'SYSTEM_ADMIN' ||
      userRoles.some((r) => ['SUPERADMIN', 'SYSTEM_ADMIN'].includes(r.role)),
    [activeRole, userRoles]
  );

  const isClubAdminForSelectedClub = useMemo(() => {
    if (isGlobalAdmin) return true;
    return userRoles.some(
      (r) =>
        ['CLUB_ADMIN', 'CLUB_CO_ADMIN'].includes(r.role) &&
        r.clubId === selectedClubId
    );
  }, [isGlobalAdmin, userRoles, selectedClubId]);

  const branchManagerBranchIds = useMemo(() => {
    return new Set(
      userRoles
        .filter(
          (r) =>
            r.role === 'BRANCH_MANAGER' &&
            r.clubId === selectedClubId &&
            Boolean(r.branchId)
        )
        .map((r) => r.branchId as string)
    );
  }, [userRoles, selectedClubId]);

  const isBranchManagerOnly =
    !isGlobalAdmin &&
    !isClubAdminForSelectedClub &&
    branchManagerBranchIds.size > 0;

  // Load authorized clubs and branches from Supabase
  useEffect(() => {
    let mounted = true;
    async function loadClubsAndBranches() {
      setLoadingScope(true);
      try {
        const supabase = createClient();
        const [{ data: clubsData }, { data: branchesData }] = await Promise.all([
          supabase
            .from('clubs')
            .select('id, name, short_name, display_name, status')
            .order('name', { ascending: true }),
          supabase
            .from('club_branches')
            .select('id, club_id, name, display_name, status')
            .order('name', { ascending: true }),
        ]);

        if (!mounted) return;

        const allClubs: ClubOption[] = (clubsData || []).map((c) => ({
          id: c.id,
          name: c.name,
          shortName: c.short_name,
          displayName: c.display_name,
        }));

        const filteredClubs = isGlobalAdmin
          ? allClubs
          : allClubs.filter((c) =>
              userRoles.some(
                (r) =>
                  [
                    'CLUB_ADMIN',
                    'CLUB_CO_ADMIN',
                    'BRANCH_MANAGER',
                  ].includes(r.role) && r.clubId === c.id
              )
            );

        setClubs(filteredClubs);

        const allBranches: BranchOption[] = (branchesData || [])
          .filter((b) => Boolean(b.club_id))
          .map((b) => ({
            id: b.id,
            clubId: b.club_id as string,
            name: b.name,
            displayName: b.display_name,
          }));
        setBranches(allBranches);

        // Set default club
        const defaultClubId =
          (activeClubId &&
            filteredClubs.some((c) => c.id === activeClubId) &&
            activeClubId) ||
          filteredClubs[0]?.id ||
          '';
        setSelectedClubId(defaultClubId);
      } catch (err) {
        console.error('Failed to load clubs/branches:', err);
      } finally {
        if (mounted) setLoadingScope(false);
      }
    }
    loadClubsAndBranches();
    return () => {
      mounted = false;
    };
  }, [activeClubId, isGlobalAdmin, userRoles]);

  // Filter branches for the selected club and enforce branch manager restrictions
  const availableBranchesForClub = useMemo(() => {
    const clubB = branches.filter((b) => b.clubId === selectedClubId);
    if (isBranchManagerOnly) {
      return clubB.filter((b) => branchManagerBranchIds.has(b.id));
    }
    return clubB;
  }, [branches, selectedClubId, isBranchManagerOnly, branchManagerBranchIds]);

  useEffect(() => {
    if (!selectedClubId) return;
    if (isBranchManagerOnly) {
      const preferred =
        activeBranchId && branchManagerBranchIds.has(activeBranchId)
          ? activeBranchId
          : availableBranchesForClub[0]?.id || '';
      setSelectedBranchId(preferred);
    } else if (
      activeBranchId &&
      availableBranchesForClub.some((b) => b.id === activeBranchId)
    ) {
      setSelectedBranchId(activeBranchId);
    } else if (
      selectedBranchId !== 'ALL' &&
      !availableBranchesForClub.some((b) => b.id === selectedBranchId)
    ) {
      setSelectedBranchId('ALL');
    }
  }, [
    selectedClubId,
    activeBranchId,
    isBranchManagerOnly,
    branchManagerBranchIds,
    availableBranchesForClub,
    selectedBranchId,
  ]);

  const selectedClubObj = useMemo(
    () => clubs.find((c) => c.id === selectedClubId) || null,
    [clubs, selectedClubId]
  );

  const selectedBranchObj = useMemo(
    () =>
      selectedBranchId !== 'ALL'
        ? availableBranchesForClub.find((b) => b.id === selectedBranchId) ||
          null
        : null,
    [availableBranchesForClub, selectedBranchId]
  );

  const fetchHistory = useCallback(async () => {
    if (!selectedClubId) return;
    if (isBranchManagerOnly && (!selectedBranchId || selectedBranchId === 'ALL')) {
      return;
    }
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ clubId: selectedClubId });
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        params.set('branchId', selectedBranchId);
      }
      const res = await fetch(`/api/admin/members/import?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setHistory(json.history || []);
      }
    } catch {
      // ignore non-critical history error
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedClubId, selectedBranchId, isBranchManagerOnly]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset preview if scope changes
  const handleClubChange = (newClubId: string) => {
    setSelectedClubId(newClubId);
    setSelectedBranchId('ALL');
    setValidationResult(null);
    setCommitResult(null);
    setGeneralError(null);
    setExportFeedback(null);
  };

  const handleBranchChange = (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    setValidationResult(null);
    setCommitResult(null);
    setGeneralError(null);
    setExportFeedback(null);
  };

  // 1. Download Scoped Template
  const handleDownloadTemplate = async () => {
    if (!selectedClubId) return;
    setDownloadingTemplate(true);
    setGeneralError(null);
    try {
      const params = new URLSearchParams({ clubId: selectedClubId });
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        params.set('branchId', selectedBranchId);
      }
      const res = await fetch(
        `/api/admin/members/template?${params.toString()}`
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to download template.');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const fileMatch = /filename="([^"]+)"/.exec(disposition);
      const fileName =
        fileMatch?.[1] || 'SCMS_Athlete_Bulk_Template.xlsx';

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setGeneralError(
        err instanceof Error ? err.message : 'Template download failed.'
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // 2. Export Athletes
  const handleExportAthletes = async () => {
    if (!selectedClubId) return;
    setExporting(true);
    setExportFeedback(null);
    setGeneralError(null);
    try {
      const params = new URLSearchParams({
        clubId: selectedClubId,
        status: exportStatusFilter,
      });
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        params.set('branchId', selectedBranchId);
      }
      if (exportSearchQuery.trim() !== '') {
        params.set('search', exportSearchQuery.trim());
      }

      const res = await fetch(
        `/api/admin/members/export?${params.toString()}`
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to export athletes.');
      }

      const exportCount = res.headers.get('X-Export-Count') || '0';
      const disposition = res.headers.get('Content-Disposition') || '';
      const fileMatch = /filename="([^"]+)"/.exec(disposition);
      const fileName = fileMatch?.[1] || 'SCMS_Athletes_Export.xlsx';

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportFeedback({
        type: 'success',
        message: t.exportSuccessMsg
          .replace('{count}', exportCount)
          .replace('{file}', fileName),
      });
      fetchHistory();
    } catch (err: unknown) {
      setExportFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Export failed.',
      });
    } finally {
      setExporting(false);
    }
  };

  // 3. Select & Validate File (Preview mode)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setValidationResult(null);
    setCommitResult(null);
    setAllowPartial(false);
    setGeneralError(null);

    if (file) {
      const generatedKey = `imp_${selectedClubId}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      setIdempotencyKey(generatedKey);
      await runValidationPreview(file);
    }
  };

  const runValidationPreview = async (fileToValidate?: File | null) => {
    const targetFile = fileToValidate || selectedFile;
    if (!targetFile || !selectedClubId) return;

    setValidating(true);
    setGeneralError(null);
    setCommitResult(null);

    try {
      const formData = new FormData();
      formData.append('file', targetFile);
      formData.append('clubId', selectedClubId);
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        formData.append('branchId', selectedBranchId);
      }
      formData.append('mode', 'preview');

      const res = await fetch('/api/admin/members/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to validate workbook.');
      }

      setValidationResult(json.validation);
    } catch (err: unknown) {
      setGeneralError(
        err instanceof Error ? err.message : 'Workbook validation failed.'
      );
    } finally {
      setValidating(false);
    }
  };

  // 4. Commit Import
  const handleCommitImport = async () => {
    if (!selectedFile || !selectedClubId || !validationResult) return;

    setCommitting(true);
    setGeneralError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('clubId', selectedClubId);
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        formData.append('branchId', selectedBranchId);
      }
      formData.append('mode', 'commit');
      formData.append('allowPartial', allowPartial ? 'true' : 'false');
      if (idempotencyKey) {
        formData.append('idempotencyKey', idempotencyKey);
      }

      const res = await fetch('/api/admin/members/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok && !json.commitResult) {
        throw new Error(json.error || 'Failed to commit athlete import.');
      }

      if (json.validation) {
        setValidationResult(json.validation);
      }
      if (json.commitResult) {
        setCommitResult(json.commitResult);
        if (json.commitResult.success && onImportSuccess) {
          onImportSuccess();
        }
      }
      fetchHistory();
    } catch (err: unknown) {
      setGeneralError(
        err instanceof Error ? err.message : 'Import commit failed.'
      );
    } finally {
      setCommitting(false);
    }
  };

  const handleResetImport = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setCommitResult(null);
    setAllowPartial(false);
    setGeneralError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 5. Download Error Report (.csv)
  const handleDownloadErrorReport = () => {
    if (!validationResult) return;
    const allErrors = [
      ...validationResult.workbookErrors,
      ...validationResult.rowErrors,
    ];
    if (allErrors.length === 0) return;

    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '');
      // Prevent formula injection in error report too
      const safe =
        /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      return `"${safe.replace(/"/g, '""')}"`;
    };

    const header = ['excel_row_number', 'field', 'error_code', 'error_message'];
    const lines = [
      header.join(','),
      ...allErrors.map((err) =>
        [
          escapeCsv(err.rowNumber === 0 ? 'Workbook' : err.rowNumber),
          escapeCsv(err.field),
          escapeCsv(err.code),
          escapeCsv(err.message),
        ].join(',')
      ),
    ];

    const blob = new Blob([lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SCMS_Import_Errors_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const canConfirmImport = useMemo(() => {
    if (!validationResult || committing) return false;
    if (validationResult.workbookErrors.length > 0) return false;
    const actionableCount =
      validationResult.newCount +
      validationResult.updateCount +
      validationResult.unchangedCount;
    if (actionableCount === 0) return false;
    if (validationResult.valid) return true;
    return (
      allowPartial &&
      validationResult.newCount + validationResult.updateCount > 0
    );
  }, [validationResult, committing, allowPartial]);

  const combinedErrors = useMemo(() => {
    if (!validationResult) return [];
    return [
      ...validationResult.workbookErrors,
      ...validationResult.rowErrors,
    ];
  }, [validationResult]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header & Language Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {t.title}
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-1 self-start sm:self-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => toggleLanguage('en')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              lang === 'en'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => toggleLanguage('ms')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              lang === 'ms'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            BM
          </button>
        </div>
      </div>

      {/* 1. Scope Selectors & Active Destination Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {t.scopeHeader}
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              selectedBranchObj
                ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
            }`}
          >
            {selectedBranchObj ? t.branchScopedBadge : t.clubWideBadge}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Club Selector */}
          <div>
            <label
              htmlFor="dm-club-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {t.clubLabel}
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="dm-club-select"
                value={selectedClubId}
                onChange={(e) => handleClubChange(e.target.value)}
                disabled={loadingScope || clubs.length <= 1}
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Branch Selector */}
          <div>
            <label
              htmlFor="dm-branch-select"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              {t.branchLabel}
            </label>
            <div className="relative">
              <GitBranch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="dm-branch-select"
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                disabled={
                  loadingScope ||
                  (isBranchManagerOnly && availableBranchesForClub.length <= 1)
                }
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
              >
                {!isBranchManagerOnly && (
                  <option value="ALL">{t.entireClubOption}</option>
                )}
                {availableBranchesForClub.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Clear Destination Summary Banner */}
        {selectedClubObj && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-white">
                {t.destinationBanner}:
              </span>
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                {selectedClubObj.name}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900 dark:text-white">
                {selectedBranchObj
                  ? `${selectedBranchObj.name}`
                  : t.entireClubOption}
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              club_id: {selectedClubObj.id.slice(0, 8)}…
              {selectedBranchObj
                ? ` | branch_id: ${selectedBranchObj.id.slice(0, 8)}…`
                : ''}
            </div>
          </div>
        )}
      </div>

      {/* General Error Banner */}
      {generalError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 dark:text-red-200 font-medium">
            {generalError}
          </div>
        </div>
      )}

      {/* Template Download & Athlete Export Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card A: Download Excel Template */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <FileDown className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.templateTitle}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.templateDesc}
            </p>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 pt-1">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Prefills{' '}
                  <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                    club_id
                  </code>{' '}
                  &{' '}
                  <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                    club_name
                  </code>{' '}
                  {selectedBranchObj ? '+ selected branch' : '+ branch ID guide'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Preserves leading zeros in MyKad, MyKid, phone, and postcode
                </span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={!selectedClubId || downloadingTemplate}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
          >
            {downloadingTemplate ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {t.downloadingTemplate}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {t.downloadTemplateBtn}
              </>
            )}
          </button>
        </div>

        {/* Card B: Export Athletes */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.exportTitle}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.exportDesc}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="dm-export-status"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t.statusFilterLabel}
                </label>
                <select
                  id="dm-export-status"
                  value={exportStatusFilter}
                  onChange={(e) => setExportStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="ALL">{t.statusAll}</option>
                  <option value="Active">{t.statusActive}</option>
                  <option value="Inactive">{t.statusInactive}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="dm-export-search"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t.searchFilterLabel}
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="dm-export-search"
                    type="text"
                    value={exportSearchQuery}
                    onChange={(e) => setExportSearchQuery(e.target.value)}
                    placeholder={t.searchFilterPlaceholder}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {exportFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  exportFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                }`}
              >
                {exportFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{exportFeedback.message}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportAthletes}
            disabled={!selectedClubId || exporting}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition shadow-sm"
          >
            {exporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {t.exportingBtn}
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                {t.exportBtn}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bulk Import Section */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.importTitle}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t.importDesc}
            </p>
          </div>

          {selectedFile && (
            <button
              type="button"
              onClick={handleResetImport}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 self-start sm:self-center"
            >
              {t.resetBtn}
            </button>
          )}
        </div>

        {/* Supported Limits Info Bar */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400">
          <Info className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>{t.limitsInfo}</span>
        </div>

        {/* File Picker Area */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            className="hidden"
            id="dm-xlsx-upload"
          />
          <label
            htmlFor="dm-xlsx-upload"
            className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-sm font-semibold transition shadow-sm"
          >
            <Upload className="w-4 h-4" />
            {t.selectFileBtn}
          </label>

          {selectedFile && (
            <div className="flex items-center justify-between sm:justify-start gap-3 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 flex-1">
              <span className="truncate">{selectedFile.name}</span>
              <span className="text-slate-500 shrink-0">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
              <button
                type="button"
                onClick={() => runValidationPreview(selectedFile)}
                disabled={validating}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${validating ? 'animate-spin' : ''}`}
                />
                {validating ? t.validatingBtn : t.validateBtn}
              </button>
            </div>
          )}
        </div>

        {/* Validation Preview Panel */}
        {validationResult && !commitResult && (
          <div className="space-y-5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {validationResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                {t.previewHeader}
              </h4>
              <span className="text-xs text-slate-500">
                {validationResult.destination.clubName}
                {validationResult.destination.branchName
                  ? ` → ${validationResult.destination.branchName}`
                  : ` (${t.entireClubOption})`}
              </span>
            </div>

            {/* Summary Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  {t.totalRows}
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {validationResult.totalRows}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70">
                <div className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                  {t.newRecords}
                </div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  {validationResult.newCount}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/70">
                <div className="text-[11px] font-semibold uppercase text-blue-700 dark:text-blue-400">
                  {t.updatedRecords}
                </div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                  {validationResult.updateCount}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  {t.unchangedRecords}
                </div>
                <div className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1">
                  {validationResult.unchangedCount}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-800/70 col-span-2 sm:col-span-1">
                <div className="text-[11px] font-semibold uppercase text-red-700 dark:text-red-400">
                  {t.errorRecords}
                </div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">
                  {validationResult.errorCount}
                </div>
              </div>
            </div>

            {/* Error List & Downloadable Error Report */}
            {combinedErrors.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-800/80 bg-red-50/40 dark:bg-red-950/20 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-bold text-xs uppercase tracking-wider">
                    <FileWarning className="w-4 h-4 shrink-0" />
                    {t.errorTableTitle} ({combinedErrors.length})
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadErrorReport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-50 self-start sm:self-center"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t.downloadErrorReportBtn}
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto rounded-lg border border-red-200 dark:border-red-800/60 bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3 font-semibold w-24">
                          {t.colRow}
                        </th>
                        <th className="py-2 px-3 font-semibold w-36">Field</th>
                        <th className="py-2 px-3 font-semibold w-44">Code</th>
                        <th className="py-2 px-3 font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {combinedErrors.slice(0, 100).map((err, i) => (
                        <tr key={`${err.rowNumber}-${err.field}-${i}`}>
                          <td className="py-2 px-3 font-mono font-bold text-red-700 dark:text-red-400">
                            {err.rowNumber === 0
                              ? 'Workbook'
                              : `Row ${err.rowNumber}`}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                            {err.field}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                            {err.code}
                          </td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-200">
                            {err.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Partial Import Opt-In Checkbox (only if there are valid rows and no workbook structure errors) */}
                {validationResult.workbookErrors.length === 0 &&
                  validationResult.newCount + validationResult.updateCount >
                    0 && (
                    <label className="flex items-start gap-2.5 pt-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allowPartial}
                        onChange={(e) => setAllowPartial(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-medium">{t.allowPartialLabel}</span>
                    </label>
                  )}
              </div>
            )}

            {/* Row-by-Row Preview Table */}
            {validationResult.rows.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {t.previewTableTitle} ({validationResult.rows.length})
                </h5>
                <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">{t.colRow}</th>
                        <th className="py-2.5 px-3 font-semibold">
                          {t.colAction}
                        </th>
                        <th className="py-2.5 px-3 font-semibold">
                          {t.colName}
                        </th>
                        <th className="py-2.5 px-3 font-semibold">{t.colId}</th>
                        <th className="py-2.5 px-3 font-semibold">
                          {t.colDob}
                        </th>
                        <th className="py-2.5 px-3 font-semibold">
                          {t.colBranch}
                        </th>
                        <th className="py-2.5 px-3 font-semibold">
                          {t.colStatus}
                        </th>
                        <th className="py-2.5 px-3 font-semibold">
                          {t.colDetails}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {validationResult.rows.slice(0, 150).map((r) => (
                        <tr
                          key={r.rowNumber}
                          className={
                            r.action === 'ERROR'
                              ? 'bg-red-50/30 dark:bg-red-950/10'
                              : ''
                          }
                        >
                          <td className="py-2 px-3 font-mono font-semibold">
                            #{r.rowNumber}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                r.action === 'CREATE'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : r.action === 'UPDATE'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : r.action === 'UNCHANGED'
                                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              }`}
                            >
                              {r.action}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                            {r.data.full_name || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {r.data.id_type}: {r.data.id_number || '—'}
                          </td>
                          <td className="py-2 px-3">
                            {r.data.date_of_birth || '—'} ({r.data.gender || '—'})
                          </td>
                          <td className="py-2 px-3">
                            {r.data.branch_name || 'Club-level'}
                          </td>
                          <td className="py-2 px-3">{r.data.status}</td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                            {r.action === 'ERROR'
                              ? r.errors.map((e) => e.message).join('; ')
                              : r.action === 'UPDATE' && r.changedFields
                              ? `Updated: ${r.changedFields.join(', ')}`
                              : r.action === 'CREATE'
                              ? 'New athlete record'
                              : 'No changes'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Confirm Import Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={!canConfirmImport}
                className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm"
              >
                {committing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {t.committingBtn}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t.confirmImportBtn}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Import Commit Results Panel */}
        {commitResult && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {commitResult.success ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                )}
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {t.resultsHeader}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                    {t.jobIdLabel}: {commitResult.jobId}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetImport}
                className="px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 self-start sm:self-center"
              >
                {t.importAnotherBtn}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60">
                <div className="text-[11px] font-semibold uppercase text-emerald-700">
                  {t.createdLabel}
                </div>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  {commitResult.createdCount}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60">
                <div className="text-[11px] font-semibold uppercase text-blue-700">
                  {t.updatedLabel}
                </div>
                <div className="text-xl font-bold text-blue-700 dark:text-blue-400">
                  {commitResult.updatedCount}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  {t.unchangedLabel}
                </div>
                <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
                  {commitResult.unchangedCount}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800/60">
                <div className="text-[11px] font-semibold uppercase text-red-700">
                  {t.failedLabel}
                </div>
                <div className="text-xl font-bold text-red-700 dark:text-red-400">
                  {commitResult.failedCount}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Import / Export Audit History */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {t.historyTitle}
          </h3>
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loadingHistory}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            {t.noHistory}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-3 font-semibold">Timestamp</th>
                  <th className="py-2 px-3 font-semibold">Operation</th>
                  <th className="py-2 px-3 font-semibold">File Name</th>
                  <th className="py-2 px-3 font-semibold">Total</th>
                  <th className="py-2 px-3 font-semibold">
                    Created / Updated / Unchanged
                  </th>
                  <th className="py-2 px-3 font-semibold">Errors</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 px-3 font-mono text-slate-500">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-semibold">
                      {item.operation}
                    </td>
                    <td className="py-2 px-3 font-mono truncate max-w-xs">
                      {item.filename}
                    </td>
                    <td className="py-2 px-3 font-semibold">
                      {item.total_records}
                    </td>
                    <td className="py-2 px-3">
                      {item.operation === 'IMPORT'
                        ? `+${item.created_records || 0} / ~${
                            item.updated_records || 0
                          } / =${item.unchanged_records || 0}`
                        : `${item.successful_records} exported`}
                    </td>
                    <td className="py-2 px-3 text-red-600 font-semibold">
                      {item.error_records || 0}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : item.status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataManagementCenter;
