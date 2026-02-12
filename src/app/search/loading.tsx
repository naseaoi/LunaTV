export default function SearchLoading() {
  return (
    <div className='px-4 sm:px-10 py-4 sm:py-8'>
      <div className='mx-auto mb-8 h-12 max-w-2xl animate-pulse rounded-lg bg-gray-200/80 dark:bg-gray-700/70' />
      <div className='mx-auto mt-10 grid max-w-[95%] grid-cols-3 gap-x-2 gap-y-14 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8 sm:gap-y-20'>
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className='space-y-2'>
            <div className='aspect-[2/3] animate-pulse rounded-xl bg-gray-200/80 dark:bg-gray-700/70' />
            <div className='h-4 animate-pulse rounded bg-gray-200/80 dark:bg-gray-700/70' />
            <div className='h-3 w-2/3 animate-pulse rounded bg-gray-200/80 dark:bg-gray-700/70' />
          </div>
        ))}
      </div>
    </div>
  );
}
