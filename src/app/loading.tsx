import PageLayout from '@/components/PageLayout';

/** 首页骨架屏：导航到首页时立即显示，避免等待服务端数据期间页面无反馈 */
export default function HomeLoading() {
  return (
    <PageLayout>
      <div className='overflow-visible px-2 pb-2 pt-4 sm:px-10 sm:pt-8'>
        {/* CapsuleSwitch 骨架 */}
        <div className='mb-8 flex justify-center'>
          <div className='h-10 w-48 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800' />
        </div>

        <div className='mx-auto max-w-[95%]'>
          {/* 推荐区域骨架 ×2 */}
          {[1, 2].map((i) => (
            <section key={i} className='mb-8'>
              <div className='mb-4 flex items-center justify-between'>
                <div className='h-6 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
                <div className='h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
              </div>
              <div className='flex space-x-6 overflow-hidden py-1 pb-12 pl-1 pr-4 sm:py-2 sm:pb-14 sm:pr-6'>
                {Array.from({ length: 8 }).map((_, j) => (
                  <div
                    key={j}
                    className='w-24 min-w-[96px] sm:w-44 sm:min-w-[180px]'
                  >
                    <div className='relative aspect-[2/3] w-full animate-pulse overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800' />
                    <div className='mt-2 h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
