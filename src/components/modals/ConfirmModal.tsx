'use client';

import { AlertTriangle } from 'lucide-react';

import ModalShell from '@/components/modals/ModalShell';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onCancel,
  onConfirm,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
}: ConfirmModalProps) {
  const confirmClassName = danger
    ? 'bg-rose-600 hover:bg-rose-500'
    : 'bg-blue-600 hover:bg-blue-500';

  return (
    <ModalShell isOpen={isOpen} onClose={onCancel} panelClassName='max-w-md'>
      <div className='p-6 sm:p-7'>
        <div className='text-center'>
          <span className='mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300'>
            <AlertTriangle className='h-5 w-5' />
          </span>
          <h3 className='mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100'>
            {title}
          </h3>
          <p className='mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300'>
            {message}
          </p>
        </div>

        <div className='mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <button
            onClick={onCancel}
            className='rounded-xl border border-gray-200/70 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100/70 dark:border-white/10 dark:bg-gray-800/70 dark:text-gray-200 dark:hover:bg-white/[0.06]'
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors ${confirmClassName}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
