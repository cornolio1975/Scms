'use client';

/**
 * Scms Membership & Finance Module
 * Section 12 & 54: Plans, Invoices, DuitNow QR / FPX payment logging, and printable receipt generation
 */

import React, { useState } from 'react';
import { store } from '@/lib/store';
import { useAuth } from '@/context/AuthContext';
import { Invoice, PaymentReceipt, InvoiceStatus } from '@/types';
import {
  CreditCard,
  Plus,
  Receipt,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ArrowRight,
  Printer,
  Download,
} from 'lucide-react';
import { generateImmutableId } from '@/lib/idGenerator';

interface FinanceModuleProps {
  clubId?: string;
  branchId?: string;
}

export default function FinanceModule({ clubId, branchId }: FinanceModuleProps = {}) {
  const { activeClub, activeBranch, currentUser } = useAuth();
  const effectiveClubId = clubId || activeClub?.id || 'Scms-CLUB-000001';
  const effectiveBranchId = branchId !== '__ALL__' ? (branchId || activeBranch?.id) : undefined;

  const [activeTab, setActiveTab] = useState<'invoices' | 'receipts' | 'plans'>('invoices');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);

  // Quick Pay Modal State
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentReceipt['paymentMethod']>('DuitNow QR');
  const [payRef, setPayRef] = useState<string>('');

  let invoices = store.invoices.filter(i => i.clubId === effectiveClubId);
  let receipts = store.receipts.filter(r => r.clubId === effectiveClubId);

  if (effectiveBranchId) {
    const branchMemberIds = store.getMembers(effectiveClubId, effectiveBranchId).map(m => m.id);
    invoices = invoices.filter(i => branchMemberIds.includes(i.memberId));
    receipts = receipts.filter(r => {
      const parentInvoice = store.invoices.find(inv => inv.id === r.invoiceId);
      return parentInvoice && branchMemberIds.includes(parentInvoice.memberId);
    });
  }

  const filteredInvoices = invoices.filter(
    i => (statusFilter === 'All' ? true : i.status === statusFilter)
  );

  const handleOpenPay = (inv: Invoice) => {
    setPayingInvoice(inv);
    setPayAmount(inv.balanceDue);
    setPayRef(`DN-${Math.floor(10000000 + Math.random() * 90000000)}`);
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;

    const receipt = store.recordPayment(
      payingInvoice.id,
      payAmount,
      payMethod,
      currentUser?.fullName || 'Cashier',
      payRef
    );

    setPayingInvoice(null);
    if (receipt) {
      setSelectedReceipt(receipt);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0284C7] uppercase tracking-wider mb-1">
            <CreditCard size={14} />
            <span>Financial Administration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Finance & Invoicing Desk
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage membership fee schedules, generate official club invoices, and log digital payments.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'invoices'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard size={15} />
          <span>Invoices ({invoices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'receipts'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt size={15} />
          <span>Receipts Archive ({receipts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === 'plans'
              ? 'border-[#0284C7] text-[#0284C7] bg-sky-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Fee Plans</span>
        </button>
      </div>

      {/* 1. INVOICES TAB */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Invoice No.</th>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Paid</th>
                    <th className="py-3 px-4">Balance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-[#0284C7]">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{inv.memberName}</td>
                      <td className="py-3 px-4 text-slate-500">{inv.dueDate}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">MYR {inv.total.toFixed(2)}</td>
                      <td className="py-3 px-4 text-emerald-600 font-semibold">MYR {inv.amountPaid.toFixed(2)}</td>
                      <td className="py-3 px-4 font-black text-slate-900">MYR {inv.balanceDue.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {inv.balanceDue > 0 ? (
                          <button
                            onClick={() => handleOpenPay(inv)}
                            className="py-1 px-3 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold rounded-lg transition-colors shadow-xs touch-target"
                          >
                            Log Payment
                          </button>
                        ) : (
                          <span className="text-slate-400 font-medium italic">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. RECEIPTS TAB */}
      {activeTab === 'receipts' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
          <h3 className="font-extrabold text-base text-slate-900">Official Receipts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Receipt No.</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Member Name</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600">{r.receiptNumber}</td>
                    <td className="py-3 px-4 text-slate-500">{r.paymentDate}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{r.memberName}</td>
                    <td className="py-3 px-4 font-black text-slate-900">MYR {r.amount.toFixed(2)}</td>
                    <td className="py-3 px-4 text-slate-700">{r.paymentMethod} ({r.referenceNo || 'Direct'})</td>
                    <td className="py-3 px-4 text-slate-500">{r.receivedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LOG PAYMENT MODAL */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900">Log Payment Receipt</h3>
              <button onClick={() => setPayingInvoice(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              <div>
                <span className="text-xs text-slate-400 block">Settling Invoice:</span>
                <span className="font-bold text-sm text-slate-900 font-mono">
                  {payingInvoice.invoiceNumber} — {payingInvoice.memberName}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Payment Amount (MYR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(parseFloat(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="DuitNow QR">DuitNow QR 📱</option>
                  <option value="FPX">Online Banking (FPX)</option>
                  <option value="Cash">Cash at Dojo Desk 💵</option>
                  <option value="Credit Card">Credit / Debit Card 💳</option>
                  <option value="Bank Transfer">Direct Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Transaction Reference No.
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Confirm & Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
