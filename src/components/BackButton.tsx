import { ArrowLeft } from 'lucide-react';

export function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className='flex h-10 w-10 items-center justify-center rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 md:h-auto md:w-auto md:gap-1.5'
      aria-label='返回'
    >
      <ArrowLeft className='h-full w-full md:h-4 md:w-4' />
      <span className='hidden text-xs font-medium md:inline'>返回</span>
    </button>
  );
}
