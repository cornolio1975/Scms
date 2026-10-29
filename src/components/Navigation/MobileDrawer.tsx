'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
}

export default function MobileDrawer({ isOpen, onClose, currentModule, onSelectModule }: MobileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, [tabindex="0"]');
      const visible = Array.from(controls || []).filter(el => el.getClientRects().length > 0);
      const first = visible[0];
      const last = visible[visible.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const handleResize = () => { if (desktop.matches) onClose(); };
    document.addEventListener('keydown', handleKey);
    desktop.addEventListener('change', handleResize);
    handleResize();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      desktop.removeEventListener('change', handleResize);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-slate-900/50" />
      <div
        ref={panelRef}
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="relative z-10 flex h-dvh w-[min(20rem,calc(100vw-3rem))] flex-col bg-[#F0F9FF] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-sky-200 px-4 pt-[env(safe-area-inset-top)]">
          <span className="text-sm font-bold text-slate-900">Menu</span>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close navigation" className="touch-target flex items-center justify-center rounded-lg text-slate-700 hover:bg-sky-100">
            <X size={22} />
          </button>
        </div>
        <Sidebar
          mobile
          currentModule={currentModule}
          collapsed={false}
          onToggleCollapse={() => {}}
          onSelectModule={moduleId => { onSelectModule(moduleId); onClose(); }}
        />
      </div>
    </div>
  );
}
