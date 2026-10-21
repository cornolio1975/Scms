'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ParentContact, NewVolunteerAssignment, VolunteerAssignmentMember } from '@/types';
import { Users, Plus, CheckCircle2, Clock, MapPin, XCircle } from 'lucide-react';

interface VolunteerManagementPortalProps {
  clubId?: string;
  branchId?: string;
}

export default function VolunteerManagementPortal({ clubId, branchId }: VolunteerManagementPortalProps = {}) {
  const { activeClub, activeBranch, activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'directory' | 'assignments'>('directory');

  const effectiveClubId = clubId || activeClub?.id || 'Scms-CLUB-000001';
  const effectiveBranchId = branchId !== '__ALL__' ? (branchId || activeBranch?.id) : undefined;

  const [parentContacts, setParentContacts] = useState<ParentContact[]>([]);
  const [assignments, setAssignments] = useState<NewVolunteerAssignment[]>([]);
  const [assignmentMembers, setAssignmentMembers] = useState<VolunteerAssignmentMember[]>([]);

  // Modals
  const [isCreateAssignmentModalOpen, setIsCreateAssignmentModalOpen] = useState(false);
  const [isAssignVolunteersModalOpen, setIsAssignVolunteersModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveClubId.startsWith('Scms-')) {
      import('@/lib/store').then(({ store }) => {
        let clubContacts = store.getParentContacts(effectiveClubId).filter(c => c.isVolunteerEligible);
        if (effectiveBranchId) {
          const branchAthletes = store.getMembers(effectiveClubId, effectiveBranchId).map(m => m.id);
          const branchGuardianContactIds = new Set(
            store.athleteGuardianRelationships
              .filter(rel => branchAthletes.includes(rel.athleteId))
              .map(rel => rel.guardianContactId)
          );
          clubContacts = clubContacts.filter(c => branchGuardianContactIds.has(c.id));
        }
        setParentContacts(clubContacts);

        let clubAssignments = store.newVolunteerAssignments.filter(a => a.clubId === effectiveClubId);
        if (effectiveBranchId) {
          clubAssignments = clubAssignments.filter(a => !a.branchId || a.branchId === effectiveBranchId);
        }
        setAssignments(clubAssignments);
        setAssignmentMembers(store.volunteerAssignmentMembers);
      });
    }
  }, [effectiveClubId, effectiveBranchId, isCreateAssignmentModalOpen, isAssignVolunteersModalOpen]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveClubId) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const { store } = await import('@/lib/store');
    
    const newAss = {
      id: `Scms-VASS-${Date.now()}`,
      clubId: effectiveClubId,
      branchId: effectiveBranchId,
      title: formData.get('title') as string,
      eventName: formData.get('eventName') as string,
      eventDate: formData.get('eventDate') as string,
      startTime: formData.get('startTime') as string,
      endTime: formData.get('endTime') as string,
      location: formData.get('location') as string,
      generalDuty: formData.get('generalDuty') as string,
      volunteersRequired: parseInt(formData.get('volunteersRequired') as string, 10),
      instructions: formData.get('instructions') as string,
      status: 'Open' as const,
      createdBy: 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    store.newVolunteerAssignments.push(newAss);
    store['saveState']?.();
    setAssignments([...assignments, newAss]);
    setIsCreateAssignmentModalOpen(false);
  };

  const handleAssignVolunteers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentId) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const selectedContactIds = formData.getAll('contactIds') as string[];
    
    const { store } = await import('@/lib/store');
    
    const newMembers = selectedContactIds.map(contactId => ({
      assignmentId: selectedAssignmentId,
      guardianContactId: contactId,
      status: 'Pending Confirmation' as const,
      assignedBy: 'Admin',
      assignedAt: new Date().toISOString(),
    }));
    
    store.volunteerAssignmentMembers.push(...newMembers);
    store['saveState']?.();
    setAssignmentMembers([...assignmentMembers, ...newMembers]);
    setIsAssignVolunteersModalOpen(false);
    setSelectedAssignmentId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">Central Volunteer Portal</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage parent/guardian volunteer opt-ins and future event assignments.</p>
        </div>
        <button onClick={() => setIsCreateAssignmentModalOpen(true)} className="flex items-center space-x-2 px-4 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors">
          <Plus size={16} />
          <span>Create Assignment</span>
        </button>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button onClick={() => setActiveTab('directory')} className={`px-4 py-2.5 text-xs font-bold border-b-2 ${activeTab === 'directory' ? 'border-[#0284C7] text-[#0284C7]' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>Volunteer Directory</button>
        <button onClick={() => setActiveTab('assignments')} className={`px-4 py-2.5 text-xs font-bold border-b-2 ${activeTab === 'assignments' ? 'border-[#0284C7] text-[#0284C7]' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>Future Assignments</button>
      </div>

      {activeTab === 'directory' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Guardian Name</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Consent Status</th>
                  <th className="py-3 px-3">Interests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parentContacts.length > 0 ? parentContacts.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-semibold text-slate-900">{c.fullName}</td>
                    <td className="py-3 px-3">{activeRole !== 'SUPERADMIN' ? c.contactNumber.replace(/.\d{4}$/, '****') : c.contactNumber}</td>
                    <td className="py-3 px-3">
                      {c.volunteerCommunicationConsent ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">Consent Provided</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">No Consent</span>
                      )}
                    </td>
                    <td className="py-3 px-3">{c.volunteerInterests?.join(', ') || 'General Duty'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-500 italic">No eligible parent volunteers found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {assignments.map(a => {
            const assignedCount = assignmentMembers.filter(m => m.assignmentId === a.id).length;
            return (
              <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">{a.generalDuty}</span>
                    <h4 className="font-extrabold text-base text-slate-900 leading-snug mt-2">{a.title}</h4>
                    <p className="text-xs font-semibold text-slate-500">{a.eventName}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-[#0284C7]">{a.status}</span>
                </div>
                
                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center space-x-1.5"><Clock size={13} /><span>{new Date(a.eventDate).toLocaleDateString()} • {a.startTime} - {a.endTime}</span></div>
                  <div className="flex items-center space-x-1.5"><MapPin size={13} /><span>{a.location}</span></div>
                  <div className="flex items-center space-x-1.5"><Users size={13} /><span>{assignedCount} / {a.volunteersRequired} Volunteers Assigned</span></div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <button onClick={() => { setSelectedAssignmentId(a.id); setIsAssignVolunteersModalOpen(true); }} className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors">
                    Manage & Assign Volunteers
                  </button>
                </div>
              </div>
            );
          })}
          {assignments.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-500 italic bg-white border border-slate-200 rounded-3xl">No upcoming volunteer assignments.</div>
          )}
        </div>
      )}

      {/* Create Assignment Modal */}
      {isCreateAssignmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="font-black text-lg text-slate-900">Create Volunteer Assignment</h3>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assignment Title</label>
                  <input type="text" name="title" required className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Event/Tournament Name</label>
                  <input type="text" name="eventName" required className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input type="date" name="eventDate" required className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Time</label>
                  <input type="time" name="startTime" required className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Time</label>
                  <input type="time" name="endTime" required className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Location</label>
                  <input type="text" name="location" required className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duty Type</label>
                  <select name="generalDuty" className="w-full px-3 py-2 text-sm border rounded-lg">
                    <option value="Tournament Registration">Tournament Registration</option>
                    <option value="Transport Coordinator">Transport Coordinator</option>
                    <option value="Event Setup">Event Setup</option>
                    <option value="Refreshment Support">Refreshment Support</option>
                    <option value="Scoreboard Assistance">Scoreboard Assistance</option>
                    <option value="General Event Helper">General Event Helper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Volunteers Needed</label>
                  <input type="number" name="volunteersRequired" min="1" defaultValue="1" required className="w-full px-3 py-2 text-sm border rounded-lg" />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setIsCreateAssignmentModalOpen(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#0284C7] text-white font-bold text-xs rounded-xl">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Volunteers Modal */}
      {isAssignVolunteersModalOpen && selectedAssignmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4">
            <h3 className="font-black text-lg text-slate-900">Assign Multiple Volunteers</h3>
            <p className="text-xs text-slate-500">Select eligible parents/guardians for this event.</p>
            <form onSubmit={handleAssignVolunteers} className="space-y-4 max-h-[60vh] overflow-y-auto">
              {parentContacts.map(c => {
                const isAlreadyAssigned = assignmentMembers.some(m => m.assignmentId === selectedAssignmentId && m.guardianContactId === c.id);
                return (
                  <label key={c.id} className={`flex items-center space-x-3 p-3 border rounded-xl cursor-pointer ${isAlreadyAssigned ? 'bg-slate-50 opacity-60 cursor-not-allowed' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" name="contactIds" value={c.id} disabled={isAlreadyAssigned} className="rounded text-[#0284C7] w-4 h-4" />
                    <div>
                      <span className="block text-sm font-bold text-slate-800">{c.fullName} {isAlreadyAssigned && '(Already Assigned)'}</span>
                      <span className="block text-xs text-slate-500">{c.volunteerInterests?.join(', ') || 'Available'}</span>
                    </div>
                  </label>
                );
              })}
              {parentContacts.length === 0 && <div className="text-sm italic text-slate-500 text-center py-4">No eligible volunteers available.</div>}
              <div className="flex justify-end space-x-2 pt-4 sticky bottom-0 bg-white">
                <button type="button" onClick={() => setIsAssignVolunteersModalOpen(false)} className="px-4 py-2 border rounded-xl text-xs font-bold">Cancel</button>
                <button type="submit" disabled={parentContacts.length === 0} className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl">Assign Selected</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
