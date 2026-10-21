'use client';

import React, { useState, useRef } from 'react';
import { Database, Upload, Download, Trash2, AlertTriangle, X } from 'lucide-react';

interface DataManagementCenterProps {
  clubId?: string;
  branchId?: string;
}

export default function DataManagementCenter({ clubId, branchId }: DataManagementCenterProps) {
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clubId) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 2) throw new Error('File is empty or has no data rows');
      
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const emailIdx = headers.findIndex(h => h.toLowerCase() === 'email');
      const nameIdx = headers.findIndex(h => h.toLowerCase() === 'full name' || h.toLowerCase() === 'name');
      
      if (emailIdx === -1) throw new Error('CSV must contain an "Email" column');
      
      const newMembers = [];
      for (let i = 1; i < lines.length; i++) {
        // Basic CSV split, ignores commas inside quotes for simplicity
        const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
        const email = cols[emailIdx];
        const name = nameIdx !== -1 ? cols[nameIdx] : email?.split('@')[0];
        if (email) newMembers.push({ email, name });
      }

      if (clubId.startsWith('Scms-')) {
         const { store } = await import('@/lib/store');
         for (const m of newMembers) {
            const newMember = {
              id: `Scms-MEM-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              clubId,
              branchId: branchId || null,
              email: m.email,
              fullName: m.name,
              roles: ['MEMBER'],
              status: 'Active',
            };
            store.addMember(newMember as any, 'Data Import');
         }
         alert(`Successfully imported ${newMembers.length} records into the mock store!`);
      } else {
         alert(`Parsed ${newMembers.length} records. Real backend import requires bulk API endpoint.`);
      }
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleExportClick = async () => {
    if (!clubId) return;
    setIsExporting(true);
    try {
      let membersToExport: any[] = [];
      
      if (clubId.startsWith('Scms-')) {
        const { store } = await import('@/lib/store');
        const mockMembers = store.getMembers(clubId);
        if (branchId) {
          membersToExport = mockMembers.filter((m: any) => m.branchId === branchId);
        } else {
          membersToExport = mockMembers;
        }
      } else {
         const { createClient } = await import('@/utils/supabase/client');
         const supabase = createClient();
         let query = supabase.from('user_roles').select('role, status: granted_at, profiles(id, email, full_name, status)').eq('club_id', clubId);
         if (branchId) query = query.eq('branch_id', branchId);
         const { data } = await query;
         if (data) {
           const unique = new Map();
           data.forEach((r: any) => {
             if (r.profiles && !unique.has(r.profiles.id)) {
               unique.set(r.profiles.id, {
                 id: r.profiles.id,
                 fullName: r.profiles.full_name,
                 email: r.profiles.email,
                 status: r.profiles.status || 'Active',
                 roles: [r.role]
               });
             } else if (r.profiles) {
               unique.get(r.profiles.id).roles.push(r.role);
             }
           });
           membersToExport = Array.from(unique.values());
         }
      }

      if (membersToExport.length === 0) {
        alert('No records found to export.');
        return;
      }

      const headers = ['ID', 'Full Name', 'Email', 'Status', 'Roles'];
      const rows = membersToExport.map(m => [
        m.id,
        m.fullName || '',
        m.email || '',
        m.status || '',
        m.roles?.join(';') || m.role || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(e => e.map(field => `"${field}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `members_export_${clubId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert('Failed to export records.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePurgeClick = () => {
    setIsPurgeModalOpen(true);
  };

  const confirmPurge = () => {
    alert('Simulating data purge... (Backend implementation required)');
    setIsPurgeModalOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Database className="w-8 h-8 text-[#0284C7]" />
            Data Management Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Import, export, and manage your club's database records.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Import Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 text-emerald-600">
            <Upload size={24} />
          </div>
          <h3 className="font-bold text-lg text-slate-900 mb-2">Import Data</h3>
          <p className="text-sm text-slate-500 mb-4">
            Upload CSV or Excel files to bulk import members, athletes, coaches, or volunteers.
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
            onChange={handleFileChange} 
          />
          <button 
            onClick={handleImportClick}
            disabled={isImporting}
            className="w-full py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isImporting ? 'Importing...' : 'Start Import'}
          </button>
        </div>

        {/* Export Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 text-blue-600">
            <Download size={24} />
          </div>
          <h3 className="font-bold text-lg text-slate-900 mb-2">Export Data</h3>
          <p className="text-sm text-slate-500 mb-4">
            Download your current database records for backup, reporting, or external use.
          </p>
          <button 
            onClick={handleExportClick}
            disabled={isExporting}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Export Records'}
          </button>
        </div>

        {/* Delete Card */}
        <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4 text-red-600">
            <Trash2 size={24} />
          </div>
          <h3 className="font-bold text-lg text-red-900 mb-2">Purge Records</h3>
          <p className="text-sm text-red-600/80 mb-4">
            Permanently delete old or inactive database records. This action cannot be undone.
          </p>
          <button 
            onClick={handlePurgeClick}
            className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
          >
            <AlertTriangle size={16} />
            Purge Data
          </button>
        </div>
      </div>

      {/* Purge Confirmation Modal */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2">
              <h3 className="font-black text-xl text-red-600 flex items-center gap-2">
                <AlertTriangle size={24} />
                Confirm Purge
              </h3>
              <button onClick={() => setIsPurgeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-slate-700">
              Are you sure you want to permanently delete these records? 
              <strong> This action cannot be undone and will permanently wipe the data from the database.</strong>
            </p>
            
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-4">
              <button 
                onClick={() => setIsPurgeModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmPurge}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
              >
                Yes, Purge Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
