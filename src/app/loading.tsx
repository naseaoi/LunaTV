import { Clapperboard } from 'lucide-react';

import LoadingStatePanel from '@/components/LoadingStatePanel';
import PageLayout from '@/components/PageLayout';

/**
 * 全局 Loading：用于非首页路由切换时的过渡占位。
 * 注意：不要在这里放“首页骨架屏”，否则从首页跳转到播放页等场景会闪回首页样式。
 */
export default function GlobalLoading() {
  return (
    <PageLayout>
      <div className='fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-white dark:bg-gray-950'>
        <div className='flex w-full max-w-2xl flex-col items-center gap-4 px-4'>
          <LoadingStatePanel
            icon={<Clapperboard className='h-10 w-10' />}
            tone='emerald'
            title='正在加载'
            message='正在切换页面...'
          />
        </div>
      </div>
    </PageLayout>
  );
}
