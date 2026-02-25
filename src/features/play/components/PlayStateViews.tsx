import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clapperboard,
  RefreshCw,
  Search,
  X,
  Zap,
} from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';

import LoadingStatePanel from '@/components/LoadingStatePanel';
import PageLayout from '@/components/PageLayout';

type LoadingStage = 'searching' | 'preferring' | 'fetching' | 'ready';

interface PlayLoadingViewProps {
  loadingStage: LoadingStage;
  loadingMessage: string;
  onBack: () => void;
}

interface PlayErrorViewProps {
  error: string;
  videoTitle: string;
  onBack: () => void;
  onRetry: () => void;
}

function getLoadingStageIcon(loadingStage: LoadingStage): ReactNode {
  if (loadingStage === 'searching') {
    return <Search className='w-10 h-10' />;
  }
  if (loadingStage === 'preferring') {
    return <Zap className='w-10 h-10' />;
  }
  if (loadingStage === 'fetching') {
    return <Clapperboard className='w-10 h-10' />;
  }
  return <CheckCircle2 className='w-10 h-10' />;
}

/**
 * 平滑进度 hook：进度条从当前值平滑过渡到目标值，
 * 使用线性步进确保各阶段视觉增长长度一致。
 */
function useSmoothProgress(targetProgress: number) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(0);
  const currentRef = useRef(0);
  const prevTargetRef = useRef(0);

  useEffect(() => {
    const prevTarget = prevTargetRef.current;
    prevTargetRef.current = targetProgress;

    // 阶段跳变（目标值大幅变化）时，先快速追到前一个目标附近
    if (targetProgress - prevTarget > 10) {
      currentRef.current = Math.max(currentRef.current, prevTarget - 2);
    }

    const animate = () => {
      const target = targetProgress;
      const cur = currentRef.current;
      if (cur < target) {
        // 固定步进速度，确保各阶段增长匀速
        const step = 0.5;
        currentRef.current = Math.min(cur + step, target);
        setDisplay(Math.round(currentRef.current));
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetProgress]);

  return display;
}

export function PlayLoadingView({
  loadingStage,
  loadingMessage,
  onBack,
}: PlayLoadingViewProps) {
  // 各阶段进度百分比映射，确保进度条每段增量一致（均为 25%）
  const stageProgressMap: Record<LoadingStage, number> = {
    searching: 25,
    preferring: 50,
    fetching: 75,
    ready: 100,
  };
  const rawProgress = stageProgressMap[loadingStage] ?? 0;
  const loadingProgress = useSmoothProgress(rawProgress);

  return (
    <PageLayout activePath='/play'>
      <div className='fixed inset-0 z-40 flex items-center justify-center bg-white dark:bg-gray-950 overflow-hidden'>
        <div className='flex flex-col items-center gap-4 w-full max-w-2xl px-4'>
          <LoadingStatePanel
            icon={getLoadingStageIcon(loadingStage)}
            tone='emerald'
            title='正在加载'
            message={loadingMessage}
            progress={loadingProgress}
          />
          <button
            onClick={onBack}
            aria-label='取消加载'
            title='取消加载'
            className='inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 transition-colors'
          >
            <X className='w-5 h-5' />
          </button>
        </div>
      </div>
    </PageLayout>
  );
}

export function PlayErrorView({
  error,
  videoTitle,
  onBack,
  onRetry,
}: PlayErrorViewProps) {
  return (
    <PageLayout activePath='/play'>
      <div className='flex items-center justify-center min-h-screen bg-transparent'>
        <LoadingStatePanel
          icon={<AlertTriangle className='w-10 h-10' />}
          tone='red'
          title='哎呀，出现了一些问题'
          message={error}
          description='请检查网络连接或稍后重试。'
        >
          <button
            onClick={onBack}
            className='w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2'
          >
            {videoTitle ? (
              <>
                <Search className='w-4 h-4' />
                返回搜索
              </>
            ) : (
              <>
                <ArrowLeft className='w-4 h-4' />
                返回上页
              </>
            )}
          </button>

          <button
            onClick={onRetry}
            className='w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 flex items-center justify-center gap-2'
          >
            <RefreshCw className='w-4 h-4' />
            重新尝试
          </button>
        </LoadingStatePanel>
      </div>
    </PageLayout>
  );
}
