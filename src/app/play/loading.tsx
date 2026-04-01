import { Clapperboard } from 'lucide-react';

import LoadingStatePanel from '@/components/LoadingStatePanel';
import PageLayout from '@/components/PageLayout';

/** 播放页路由级 Loading：点击播放后优先显示加载动画，避免闪回首页骨架屏 */
export default function PlayRouteLoading() {
  return (
    <PageLayout activePath='/play'>
      <div className='fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-white dark:bg-gray-950'>
        <div className='flex w-full max-w-2xl flex-col items-center gap-4 px-4'>
          <LoadingStatePanel
            icon={<Clapperboard className='h-10 w-10' />}
            tone='emerald'
            title='正在打开播放页'
            message='正在准备播放器...'
          />
        </div>
      </div>
    </PageLayout>
  );
}
