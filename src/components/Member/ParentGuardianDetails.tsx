'use client';

import React, { useState, useEffect } from 'react';
import { ParentContact, GuardianRelationshipType } from '@/types';

interface ParentGuardianDetailsProps {
  clubId: string;
  guardianLinks: any[];
  setGuardianLinks: (links: any[]) => void;
}

export default function ParentGuardianDetails({ clubId, guardianLinks, setGuardianLinks }: ParentGuardianDetailsProps) {
  const [existingContacts, setExistingContacts] = useState<ParentContact[]>([]);
  const [mode, setMode] = useState<'list' | 'select_existing' | 'add_new'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [selectedContact, setSelectedContact] = useState<ParentContact | null>(null);
  
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState<GuardianRelationshipType>('Mother');
  const [relationshipDescription, setRelationshipDescription] = useState('');
  const [isVolunteerEligible, setIsVolunteerEligible] = useState(false);
  const [volunteerCommunicationConsent, setVolunteerCommunicationConsent] = useState(false);
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [isEmergencyContact, setIsEmergencyContact] = useState(false);

  useEffect(() => {
    if (clubId.startsWith('Scms-')) {
      import('@/lib/store').then(({ store }) => {
        setExistingContacts(store.getParentContacts(clubId));
      });
    }
  }, [clubId]);

  const resetForm = () => {
    setFullName('');
    setContactNumber('');
    setEmail('');
    setRelationship('Mother');
    setRelationshipDescription('');
    setIsVolunteerEligible(false);
    setVolunteerCommunicationConsent(false);
    setIsPrimaryContact(false);
    setIsEmergencyContact(false);
    setSelectedContact(null);
  };

  const handleAddNewLink = (e: React.FormEvent) => {
    e.preventDefault();
    const link = {
      isNewContact: mode === 'add_new',
      contact: mode === 'add_new' ? {
        fullName,
        contactNumber,
        email,
        isVolunteerEligible,
        volunteerCommunicationConsent
      } : selectedContact,
      relationshipData: {
        relationship,
        relationshipDescription: relationship === 'Other' ? relationshipDescription : '',
        isPrimaryContact,
        isEmergencyContact
      }
    };

    setGuardianLinks([...guardianLinks, link]);
    setMode('list');
    resetForm();
  };

  const handleRemoveLink = (idx: number) => {
    setGuardianLinks(guardianLinks.filter((_, i) => i !== idx));
  };

  const filteredContacts = existingContacts.filter(c => 
    c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.contactNumber.includes(searchQuery)
  );

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-4">
      <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Parent / Guardian Details</h4>
      
      {mode === 'list' && (
        <div className="space-y-4">
          {guardianLinks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="text-xs uppercase bg-slate-50 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-3 py-2 rounded-tl-lg">Parent/Guardian Name</th>
                    <th className="px-3 py-2">Relationship</th>
                    <th className="px-3 py-2">Contact Number</th>
                    <th className="px-3 py-2">Volunteer</th>
                    <th className="px-3 py-2 rounded-tr-lg">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {guardianLinks.map((link, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium text-slate-800">{link.contact.fullName}</td>
                      <td className="px-3 py-2">{link.relationshipData.relationship}</td>
                      <td className="px-3 py-2">{link.contact.contactNumber}</td>
                      <td className="px-3 py-2">
                        {link.contact.isVolunteerEligible ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Yes</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => handleRemoveLink(idx)} className="text-red-500 hover:text-red-700 text-xs font-semibold">Remove Link</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-slate-500 italic">No guardians added yet.</div>
          )}

          <div className="flex space-x-2">
            <button type="button" onClick={() => { setMode('select_existing'); resetForm(); }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
              Select Existing Contact
            </button>
            <button type="button" onClick={() => { setMode('add_new'); resetForm(); }} className="px-3 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-lg transition-colors">
              Add New Contact
            </button>
          </div>
        </div>
      )}

      {mode === 'select_existing' && (
        <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h5 className="font-bold text-sm text-slate-700">Select Existing Contact</h5>
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredContacts.map(c => (
              <div 
                key={c.id} 
                onClick={() => setSelectedContact(c)}
                className={`p-2 rounded-lg cursor-pointer text-sm ${selectedContact?.id === c.id ? 'bg-[#0284C7] text-white' : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'}`}
              >
                <div className="font-bold">{c.fullName}</div>
                <div className="text-xs opacity-80">{c.contactNumber} {c.isVolunteerEligible && ' • Volunteer'}</div>
              </div>
            ))}
          </div>

          {selectedContact && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Relationship to Athlete *</label>
                <select value={relationship} onChange={(e) => setRelationship(e.target.value as any)} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg">
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {relationship === 'Other' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description *</label>
                  <input type="text" required value={relationshipDescription} onChange={(e) => setRelationshipDescription(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg" />
                </div>
              )}
              <div className="sm:col-span-2 flex space-x-4">
                <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={isPrimaryContact} onChange={(e) => setIsPrimaryContact(e.target.checked)} className="rounded text-[#0284C7]" />
                  <span>Primary Contact</span>
                </label>
                <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={isEmergencyContact} onChange={(e) => setIsEmergencyContact(e.target.checked)} className="rounded text-[#0284C7]" />
                  <span>Emergency Contact</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex space-x-2 pt-2">
            <button type="button" onClick={() => setMode('list')} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={handleAddNewLink} disabled={!selectedContact} className="px-3 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-lg disabled:opacity-50">Link Guardian</button>
          </div>
        </div>
      )}

      {mode === 'add_new' && (
        <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h5 className="font-bold text-sm text-slate-700">Add New Contact</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name *</label>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contact Number *</label>
              <input type="text" required placeholder="+6012-3456789" value={contactNumber} onChange={e => setContactNumber(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email (Optional)</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Relationship to Athlete *</label>
              <select value={relationship} onChange={(e) => setRelationship(e.target.value as any)} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg">
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
                <option value="Spouse">Spouse</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {relationship === 'Other' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description *</label>
                <input type="text" required value={relationshipDescription} onChange={(e) => setRelationshipDescription(e.target.value)} className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg" />
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-2 pt-2 border-t border-slate-200">
            <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={isPrimaryContact} onChange={(e) => setIsPrimaryContact(e.target.checked)} className="rounded text-[#0284C7]" />
              <span>Set as Primary Contact</span>
            </label>
            <label className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={isEmergencyContact} onChange={(e) => setIsEmergencyContact(e.target.checked)} className="rounded text-[#0284C7]" />
              <span>Set as Emergency Contact</span>
            </label>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg space-y-3">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input type="checkbox" checked={isVolunteerEligible} onChange={(e) => setIsVolunteerEligible(e.target.checked)} className="rounded text-indigo-600 mt-1" />
              <div>
                <span className="block text-sm font-bold text-indigo-900">Available for Volunteer Assignments</span>
                <span className="block text-xs text-indigo-700">Add to the central volunteer directory for this club.</span>
              </div>
            </label>
            {isVolunteerEligible && (
              <label className="flex items-start space-x-3 cursor-pointer pl-7">
                <input type="checkbox" checked={volunteerCommunicationConsent} onChange={(e) => setVolunteerCommunicationConsent(e.target.checked)} className="rounded text-indigo-600 mt-1" />
                <div>
                  <span className="block text-sm font-semibold text-indigo-900">Volunteer Communication Consent</span>
                  <span className="block text-xs text-indigo-700">I consent to receiving volunteer-related communications (independent from general marketing).</span>
                </div>
              </label>
            )}
          </div>

          <div className="flex space-x-2 pt-2">
            <button type="button" onClick={() => setMode('list')} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={handleAddNewLink} disabled={!fullName || !contactNumber} className="px-3 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-lg disabled:opacity-50">Save & Link Contact</button>
          </div>
        </div>
      )}
      
      {/* Hidden inputs to pass data to the parent native form submission easily */}
      <input type="hidden" name="guardianLinksJSON" value={JSON.stringify(guardianLinks)} />
    </div>
  );
}
