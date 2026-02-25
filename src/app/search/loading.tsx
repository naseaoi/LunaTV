import { Search } from 'lucide-react';

import PageLayout from '@/components/PageLayout';

export default function SearchLoading() {
  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        <div className='mb-8'>
          <div className='max-w-2xl mx-auto'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
              <div className='h-12 rounded-lg bg-gray-50/80 py-3 pl-10 pr-12 text-sm text-gray-400 border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700 flex items-center'>
                搜索电影、电视剧...
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
