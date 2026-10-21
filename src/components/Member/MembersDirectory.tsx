'use client';

/**
 * Scms Members Directory & Data Import Centre
 * Sections 7 & 23: Member roster, CSV import wizard, duplicate detection, and Member 360 launch pad
 */

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { useAuth } from '@/context/AuthContext';
import { Member } from '@/types';
import {
  Users,
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ChevronRight,
  UserCheck,
  HeartHandshake,
} from 'lucide-react';
import Member360 from './Member360';
import { createNormalizedMember, getNormalizedMembers } from '@/lib/repositories/members';

export default function MembersDirectory() {
  const { activeClub, activeBranch, currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [normalizedMembers, setNormalizedMembers] = useState<Member[] | null>(null);
  const [memberLoadError, setMemberLoadError] = useState<string | null>(null);
  const [isSavingMember, setIsSavingMember] = useState(false);

  // New Member Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');
  const [newDob, setNewDob] = useState('2005-01-01');
  const [newIc, setNewIc] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newWeight, setNewWeight] = useState(65);
  const [newBelt, setNewBelt] = useState('White Belt (10th Kyu)');
  const [newIsAthlete, setNewIsAthlete] = useState(true);
  const [newIsVolunteer, setNewIsVolunteer] = useState(false);

  // Data Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const legacyMembers = store.getMembers(activeClub?.id, activeBranch?.id);
  const members = normalizedMembers ?? legacyMembers;

  useEffect(() => {
    let cancelled = false;
    setNormalizedMembers(null);
    setMemberLoadError(null);

    getNormalizedMembers(activeClub?.id, activeBranch?.id)
      .then(data => {
        if (!cancelled) setNormalizedMembers(data);
      })
      .catch(error => {
        console.error('Normalized member load failed; using legacy fallback.', error);
        if (!cancelled) setMemberLoadError('Using legacy member data while the database connection is unavailable.');
      });

    return () => {
      cancelled = true;
    };
  }, [activeClub?.id, activeBranch?.id]);

  const filteredMembers = members.filter(m => {
    const matchesSearch =
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.icPassport.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
    const matchesRole =
      roleFilter === 'All'
        ? true
        : roleFilter === 'Athlete'
        ? m.isAthlete
        : roleFilter === 'Volunteer'
        ? m.isVolunteer
        : true;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClub) return;

    const branchId = activeBranch?.id || store.getBranches(activeClub.id)[0]?.id;
    if (!branchId) {
      setMemberLoadError('Select or create a branch before adding a member.');
      return;
    }

    setIsSavingMember(true);
    setMemberLoadError(null);
    try {
      await createNormalizedMember({
        clubId: activeClub.id,
        branchId,
        fullName: newName,
        gender: newGender,
        dob: newDob,
        icPassport: newIc,
        email: newEmail,
        phone: newPhone,
        beltRank: newBelt,
        weightKg: newWeight,
        isAthlete: newIsAthlete,
        isVolunteer: newIsVolunteer,
      });
      const refreshed = await getNormalizedMembers(activeClub.id, activeBranch?.id);
      setNormalizedMembers(refreshed);
      setIsAddModalOpen(false);
      setNewName('');
      setNewIc('');
      setNewEmail('');
      setNewPhone('');
    } catch (error) {
      console.error('Unable to create normalized member.', error);
      setMemberLoadError('Member could not be saved. Check your access and member details, then try again.');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleCsvFile = async (file?: File) => {
    setImportMessage(null);
    setImportErrors([]);
    setImportRows([]);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportErrors(['Only .csv files are supported in this validation stage.']);
      return;
    }

    const text = await file.text();
    const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      setImportErrors(['CSV must contain a header row and at least one member row.']);
      return;
    }

    // Conservative parser for the initial validation stage. Quoted commas are supported.
    const parseLine = (line: string) => {
      const cells: string[] = [];
      let current = '';
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
          if (quoted && line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            quoted = !quoted;
          }
        } else if (char === ',' && !quoted) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    };

    const headers = parseLine(lines[0]).map(header => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const aliases: Record<string, string[]> = {
      fullname: ['fullname', 'name'],
      gender: ['gender', 'sex'],
      dob: ['dob', 'dateofbirth', 'birthdate'],
      icpassport: ['icpassport', 'ic', 'passport', 'icpassportno'],
    };
    const findIndex = (key: string) => headers.findIndex(header => aliases[key].includes(header));
    const indexes = Object.fromEntries(Object.keys(aliases).map(key => [key, findIndex(key)]));
    const missing = Object.entries(indexes).filter(([, index]) => index < 0).map(([key]) => key);
    if (missing.length) {
      setImportErrors([`Missing required columns: ${missing.join(', ')}.`]);
      return;
    }

    const errors: string[] = [];
    const rows = lines.slice(1).map((line, offset) => {
      const cells = parseLine(line);
      const row = {
        fullName: cells[indexes.fullname] || '',
        gender: cells[indexes.gender] || '',
        dob: cells[indexes.dob] || '',
        icPassport: cells[indexes.icpassport] || '',
      };
      const rowNo = offset + 2;
      if (!row.fullName) errors.push(`Row ${rowNo}: Full Name is required.`);
      if (!['Male', 'Female'].includes(row.gender)) errors.push(`Row ${rowNo}: Gender must be Male or Female.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dob)) errors.push(`Row ${rowNo}: DOB must use YYYY-MM-DD.`);
      if (!row.icPassport) errors.push(`Row ${rowNo}: IC/Passport is required.`);
      return row;
    });

    setImportFileName(file.name);
    setImportRows(rows);
    setImportErrors(errors);
    setImportMessage(
      errors.length
        ? 'Validation found errors. Nothing has been written to the database.'
        : `${rows.length} rows passed initial CSV validation. Database import remains disabled until the transactional batch importer is enabled.`
    );
    setImportStep(2);
  };

  if (selectedMember) {
    return <Member360 member={selectedMember} onBack={() => setSelectedMember(null)} />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
            <Users size={14} />
            <span>Membership Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Members & Athletes Roster
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Maintain complete member profiles, assign sports attributes, and manage parent linkages.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 touch-target"
          >
            <Upload size={16} className="text-[#0284C7]" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="py-2.5 px-5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 touch-target"
          >
            <Plus size={16} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {memberLoadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {memberLoadError}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, IC, Member ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#0284C7] focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="All">All Roles</option>
            <option value="Athlete">Athletes Only</option>
            <option value="Volunteer">Volunteers Only</option>
          </select>
        </div>
      </div>

      {/* Responsive Member Cards (Mobile) / Table (Desktop) */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Member ID</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Gender & DOB</th>
                <th className="py-3 px-4">Rank / Belt</th>
                <th className="py-3 px-4">Roles</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map(m => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-[#0284C7] whitespace-nowrap">
                    {m.id}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-extrabold text-slate-900 block">{m.fullName}</span>
                    <span className="text-[11px] text-slate-400">{m.icPassport}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    <span>{m.gender}, {m.dob}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-800">
                      {m.sportData?.beltRank || 'Athlete'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {m.isAthlete && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-[#0284C7]">
                          Athlete
                        </span>
                      )}
                      {m.isVolunteer && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                          Volunteer
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedMember(m)}
                      className="px-3 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold rounded-lg transition-colors flex items-center space-x-1 ml-auto touch-target"
                    >
                      <Eye size={13} />
                      <span>Member 360</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MEMBER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900">Add New Member</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kenji Sato"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Gender *
                  </label>
                  <select
                    value={newGender}
                    onChange={e => setNewGender(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDob}
                    onChange={e => setNewDob(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  IC / Passport No. *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 050412-14-1235"
                  value={newIc}
                  onChange={e => setNewIc(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Belt / Rank
                  </label>
                  <select
                    value={newBelt}
                    onChange={e => setNewBelt(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="White Belt (10th Kyu)">White Belt (10th Kyu)</option>
                    <option value="Yellow Belt (9th Kyu)">Yellow Belt (9th Kyu)</option>
                    <option value="Green Belt (7th Kyu)">Green Belt (7th Kyu)</option>
                    <option value="Brown Belt (4th-1st Kyu)">Brown Belt (4th-1st Kyu)</option>
                    <option value="Black Belt (1st Dan+)">Black Belt (1st Dan+)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={newWeight}
                    onChange={e => setNewWeight(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsAthlete}
                    onChange={e => setNewIsAthlete(e.target.checked)}
                    className="rounded text-[#0284C7]"
                  />
                  <span>Athlete Roster</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsVolunteer}
                    onChange={e => setNewIsVolunteer(e.target.checked)}
                    className="rounded text-[#0284C7]"
                  />
                  <span>Enrol as Volunteer</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="px-5 py-2 disabled:opacity-60 disabled:cursor-not-allowed bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  {isSavingMember ? 'Saving…' : 'Save Member Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATA IMPORT CENTRE MODAL (Section 23) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="text-[#0284C7]" size={20} />
                <h3 className="font-black text-lg text-slate-900">Data Import Centre</h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {importStep === 1 && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Upload your existing club athlete or member roster CSV/Excel spreadsheet to batch-import into Scms.
                </p>

                <label className="border-2 border-dashed border-[#BAE6FD] hover:border-[#0284C7] bg-[#F0F9FF]/50 hover:bg-[#F0F9FF] rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-2 block">
                  <Upload size={32} className="mx-auto text-[#0284C7]" />
                  <span className="font-bold text-sm text-slate-800 block">Choose CSV file</span>
                  <span className="text-[11px] text-slate-400 block">
                    Required: Full Name, Gender, DOB (YYYY-MM-DD), IC/Passport
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={event => void handleCsvFile(event.target.files?.[0])}
                  />
                </label>
              </div>
            )}

            {importStep === 2 && (
              <div className="space-y-4">
                <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-2xl text-xs text-sky-900">
                  <span className="font-bold block">{importFileName || 'CSV validation'}</span>
                  <p>{importMessage}</p>
                </div>
                {importErrors.length > 0 && (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">
                    {importErrors.slice(0, 20).map(error => <div key={error}>{error}</div>)}
                  </div>
                )}
                {importRows.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 text-[11px] divide-y divide-slate-100">
                    {importRows.slice(0, 10).map((row, index) => (
                      <div key={`${row.icPassport}-${index}`} className="py-1 flex justify-between gap-3">
                        <span>{row.fullName} · {row.gender} · {row.dob}</span>
                        <span className="font-mono text-slate-500">{row.icPassport}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => setImportStep(1)} className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700">
                    Choose another file
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
