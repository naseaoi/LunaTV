import PageLayout from '@/components/PageLayout';

function SkeletonCard({ withSubtitle = false }: { withSubtitle?: boolean }) {
  return (
    <div className='w-24 min-w-[96px] sm:w-44 sm:min-w-[180px]'>
      <div className='relative aspect-[2/3] w-full animate-pulse overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
        <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700' />
      </div>
      <div className='mt-2 h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
      {withSubtitle && (
        <div className='mt-1 h-3 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
      )}
    </div>
  );
}

function SkeletonRow({
  count,
  withSubtitle = false,
}: {
  count: number;
  withSubtitle?: boolean;
}) {
  return (
    <div className='relative'>
      <div className='scrollbar-hide flex space-x-6 overflow-x-auto py-1 pb-12 pl-1 pr-4 sm:py-2 sm:pb-14 sm:pr-6'>
        {Array.from({ length: count }).map((_, index) => (
          <SkeletonCard key={index} withSubtitle={withSubtitle} />
        ))}
      </div>
    </div>
  );
}

function SkeletonSectionHeader() {
  return (
    <div className='mb-4 flex items-center justify-between'>
      <div className='h-6 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
      <div className='h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
    </div>
  );
}

/** 首页骨架屏：仅用于导航到首页时的过渡占位 */
export default function HomeLoading() {
  return (
    <PageLayout>
      <div className='overflow-visible px-2 pb-2 pt-4 sm:px-10 sm:pt-8'>
        {/* CapsuleSwitch 骨架 */}
        <div className='mb-8 flex justify-center'>
          <div className='h-10 w-48 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800' />
        </div>

        <div className='mx-auto max-w-[95%]'>
          {/* 继续观看骨架（与首页默认 tab 内容结构对齐） */}
          <section className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='h-6 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
              <div className='h-4 w-10 animate-pulse rounded bg-gray-200 dark:bg-gray-800' />
            </div>
            <SkeletonRow count={6} withSubtitle />
          </section>

          {/* 推荐区域骨架：数量/间距尽量与真实页面一致，避免加载完成后跳动 */}
          <section className='mb-8'>
            <SkeletonSectionHeader />
            <SkeletonRow count={8} />
          </section>

          <section className='mb-8'>
            <SkeletonSectionHeader />
            <SkeletonRow count={8} />
          </section>

          <section className='mb-8'>
            <SkeletonSectionHeader />
            <SkeletonRow count={8} />
          </section>

          <section className='mb-8'>
            <SkeletonSectionHeader />
            <SkeletonRow count={8} />
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
