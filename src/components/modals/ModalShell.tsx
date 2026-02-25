'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  closeOnBackdrop?: boolean;
}

const CLOSE_ANIMATION_MS = 220;

export default function ModalShell({
  isOpen,
  onClose,
  children,
  panelClassName,
  closeOnBackdrop = true,
}: ModalShellProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => {
        setVisible(true);
      });
      return;
    }

    setVisible(false);
    const timeout = window.setTimeout(() => {
      setMounted(false);
    }, CLOSE_ANIMATION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isOpen]);

  useEffect(() => {
    if (mounted && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted, onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      ref={overlayRef}
      tabIndex={-1}
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-200 outline-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={() => {
        if (closeOnBackdrop) {
          onClose();
        }
      }}
      role='presentation'
    >
      <div
        className={`w-full transform rounded-2xl border border-gray-200/70 bg-white/80 shadow-2xl backdrop-blur-xl ring-1 ring-black/10 transition-all duration-200 dark:border-white/10 dark:bg-gray-900/70 dark:ring-white/10 ${
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-2'
        } ${panelClassName || ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
