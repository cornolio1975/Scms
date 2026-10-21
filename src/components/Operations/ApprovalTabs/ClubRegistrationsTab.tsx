'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle, XCircle, Building2 } from 'lucide-react';

interface RegistrationRequest {
  id: string;
  user_id: string;
  club_id: string;
  requested_role: string;
  status: string;
  created_at: string;
  clubs: {
    name: string;
    registration_no: string;
    address: string;
    state: string;
    country: string;
  };
  profiles: {
    full_name: string;
    email: string;
    phone: string;
  };
}

export default function ClubRegistrationsTab() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    const combinedRequests: any[] = [];

    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*, clubs(*), profiles(*)')
        .eq('requested_role', 'CLUB_ADMIN')
        .eq('status', 'PENDING_APPROVAL')
        .order('created_at', { ascending: false });

      if (!error && data) {
        combinedRequests.push(...data);
      }
    } catch (supaErr) {
      console.warn('Supabase approval requests fetch warning:', supaErr);
    }

    try {
      const { store } = await import('@/lib/store');
      const pendingStoreApps = store.approvals
        .filter(a => a.type === 'Club Registration' && a.status === 'Pending')
        .map(a => {
          const club = a.clubId ? store.getClubById(a.clubId) : undefined;
          return {
            id: a.id,
            user_id: a.submittedByUserId,
            club_id: a.clubId,
            requested_role: 'CLUB_ADMIN',
            status: 'PENDING_APPROVAL',
            created_at: a.submittedAt,
            clubs: {
              name: club?.name || a.clubName,
              registration_no: club?.registrationNo || (a.payload as any)?.registrationNo || 'N/A',
              address: club?.address || 'N/A',
              state: club?.state || (a.payload as any)?.city || 'Selangor',
              country: club?.country || 'Malaysia'
            },
            profiles: {
              full_name: a.submittedByName,
              email: club?.primaryAdminEmail || club?.email || `${a.submittedByName.toLowerCase().replace(/\s+/g, '')}@example.com`,
              phone: club?.primaryAdminPhone || club?.phone || '+6012-3456789'
            }
          };
        });
      combinedRequests.push(...pendingStoreApps);
    } catch (e) {
      console.warn('Failed to load store approvals:', e);
    }

    setRequests(combinedRequests);
    setLoading(false);
  };

  const handleAction = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch('/api/admin/approve-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action })
      });
      if (res.ok) {
        setRequests(requests.filter(r => r.id !== requestId));
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to process request.');
      }
    } catch (err) {
      alert('Network error.');
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500 py-10 text-center">Loading registrations...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-900 mb-1">No Pending Registrations</h3>
        <p className="text-sm text-slate-500">All club registrations have been processed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <div key={req.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row justify-between gap-6 hover:shadow-md transition-shadow">
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900">{req.clubs?.name}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                  Pending Approval
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">Reg No: {req.clubs?.registration_no || 'N/A'}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location Details</p>
                <p className="text-sm font-medium text-slate-700">{req.clubs?.state}, {req.clubs?.country}</p>
                <p className="text-xs text-slate-500 mt-0.5">{req.clubs?.address}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Proposed Admin</p>
                <p className="text-sm font-medium text-slate-700">{req.profiles?.full_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{req.profiles?.email}</p>
                <p className="text-xs text-slate-500">{req.profiles?.phone}</p>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              Submitted: {new Date(req.created_at).toLocaleDateString()}
            </div>
          </div>
          
          <div className="flex sm:flex-col justify-end gap-3 min-w-[140px]">
            <button
              onClick={() => handleAction(req.id, 'APPROVE')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
            >
              <CheckCircle size={16} />
              <span>Approve</span>
            </button>
            <button
              onClick={() => handleAction(req.id, 'REJECT')}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-sm font-bold transition-colors"
            >
              <XCircle size={16} />
              <span>Reject</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
