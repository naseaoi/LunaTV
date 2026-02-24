import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

import { clearSearchHistory, deleteSearchHistory } from '@/lib/db.client';
import ConfirmModal from '@/components/modals/ConfirmModal';

interface SearchHistoryProps {
  searchHistory: string[];
  setSearchQuery: (query: string) => void;
}

export default function SearchHistory({
  searchHistory,
  setSearchQuery,
}: SearchHistoryProps) {
  const router = useRouter();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (searchHistory.length === 0) return null;

  return (
    <section className='mb-12'>
      <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
        搜索历史
        {searchHistory.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className='ml-3 text-sm text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400 dark:hover:text-red-500'
          >
            清空
          </button>
        )}
      </h2>
      <div className='flex flex-wrap gap-2'>
        {searchHistory.map((item) => (
          <div key={item} className='relative group'>
            <button
              onClick={() => {
                setSearchQuery(item);
                router.push(`/search?q=${encodeURIComponent(item.trim())}`);
              }}
              className='px-4 py-2 bg-gray-500/10 hover:bg-gray-300 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-300'
            >
              {item}
            </button>
            <button
              aria-label='删除搜索历史'
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                deleteSearchHistory(item);
              }}
              className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
            >
              <X className='w-3 h-3' />
            </button>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={showClearConfirm}
        title='确认清空搜索历史？'
        message='该操作将删除所有搜索历史记录，删除后无法恢复。'
        danger
        cancelText='取消'
        confirmText='清空'
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={() => {
          clearSearchHistory();
          setShowClearConfirm(false);
        }}
      />
    </section>
  );
}
