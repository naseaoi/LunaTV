'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Radio,
  RefreshCw,
  Tv,
  X,
} from 'lucide-react';
import { Suspense, useRef } from 'react';

import LoadingStatePanel from '@/components/LoadingStatePanel';
import PageLayout from '@/components/PageLayout';

import { LiveChannelInfo } from '@/features/live/components/LiveChannelInfo';
import { LiveChannelSidebar } from '@/features/live/components/LiveChannelSidebar';
import { useLiveFavorite } from '@/features/live/hooks/useLiveFavorite';
import { useLiveKeyboard } from '@/features/live/hooks/useLiveKeyboard';
import { useLivePlayer } from '@/features/live/hooks/useLivePlayer';
import { useLiveSources } from '@/features/live/hooks/useLiveSources';

// 导入全局类型扩展
import '@/features/live/types';

function LivePageClient() {
  // DOM Refs
  const artRef = useRef<HTMLDivElement | null>(null);
  const groupContainerRef = useRef<HTMLDivElement>(null);
  const channelListRef = useRef<HTMLDivElement>(null);

  // ---- 数据 & 频道管理 ----
  // 先用一个临时空函数初始化，后续被 useLivePlayer 返回的 cleanupPlayer 替换
  const cleanupPlayerRef = useRef<() => void>(() => {});

  const sources = useLiveSources({
    cleanupPlayer: () => cleanupPlayerRef.current(),
    channelListRef,
    groupContainerRef,
  });

  // ---- 播放器 ----
  const { artPlayerRef, cleanupPlayer } = useLivePlayer({
    videoUrl: sources.videoUrl,
    currentChannel: sources.currentChannel,
    currentSourceRef: sources.currentSourceRef,
    loading: sources.loading,
    artRef,
    setError: sources.setError,
    setIsVideoLoading: sources.setIsVideoLoading,
    setUnsupportedType: sources.setUnsupportedType,
  });

  // 将真正的 cleanupPlayer 赋值给 ref，供 useLiveSources 回调使用
  cleanupPlayerRef.current = cleanupPlayer;

  // ---- 键盘快捷键 ----
  useLiveKeyboard({ artPlayerRef });

  // ---- 收藏 ----
  const { favorited, handleToggleFavorite } = useLiveFavorite({
    currentSource: sources.currentSource,
    currentChannel: sources.currentChannel,
    currentSourceRef: sources.currentSourceRef,
    currentChannelRef: sources.currentChannelRef,
  });

  // ---- 早返回: loading ----
  if (sources.loading) {
    return (
      <PageLayout activePath='/live'>
        <div className='fixed inset-0 z-40 flex items-center justify-center bg-white dark:bg-gray-950 overflow-hidden'>
          <div className='flex flex-col items-center gap-4'>
            <LoadingStatePanel
              icon={
                sources.loadingStage === 'ready' ? (
                  <CheckCircle2 className='w-10 h-10' />
                ) : (
                  <Tv className='w-10 h-10' />
                )
              }
              tone='blue'
              title='正在准备直播'
              message={sources.loadingMessage}
              description='正在同步直播源、频道列表与节目单信息。'
              progress={sources.loadingProgress}
            />
            <button
              onClick={() => sources.router.back()}
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

  // ---- 早返回: error ----
  if (sources.error) {
    return (
      <PageLayout activePath='/live'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <LoadingStatePanel
            icon={<AlertTriangle className='w-10 h-10' />}
            tone='red'
            title='哎呀，出现了一些问题'
            message={sources.error}
            description='请检查网络连接或稍后重试。'
          >
            <button
              onClick={() => window.location.reload()}
              className='w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2'
            >
              <RefreshCw className='w-4 h-4' />
              重新尝试
            </button>
          </LoadingStatePanel>
        </div>
      </PageLayout>
    );
  }

  // ---- 主 JSX ----
  return (
    <PageLayout activePath='/live'>
      <div className='flex flex-col gap-3 py-4 px-5 lg:px-[3rem] 2xl:px-20'>
        {/* 第一行：页面标题 */}
        <div className='py-1'>
          <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 max-w-[80%]'>
            <Radio className='w-5 h-5 text-blue-500 flex-shrink-0' />
            <div className='min-w-0 flex-1'>
              <div className='truncate'>
                {sources.currentSource?.name}
                {sources.currentSource && sources.currentChannel && (
                  <span className='text-gray-500 dark:text-gray-400'>
                    {` > ${sources.currentChannel.name}`}
                  </span>
                )}
                {sources.currentSource && !sources.currentChannel && (
                  <span className='text-gray-500 dark:text-gray-400'>
                    {` > ${sources.currentSource.name}`}
                  </span>
                )}
              </div>
            </div>
          </h1>
        </div>

        {/* 第二行：播放器和频道列表 */}
        <div className='space-y-2'>
          {/* 折叠控制 - 仅在 lg 及以上屏幕显示 */}
          <div className='hidden lg:flex justify-end'>
            <button
              onClick={() =>
                sources.setIsChannelListCollapsed(
                  !sources.isChannelListCollapsed,
                )
              }
              className='group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200'
              title={
                sources.isChannelListCollapsed ? '显示频道列表' : '隐藏频道列表'
              }
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                  sources.isChannelListCollapsed ? 'rotate-180' : 'rotate-0'
                }`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 5l7 7-7 7'
                />
              </svg>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-300'>
                {sources.isChannelListCollapsed ? '显示' : '隐藏'}
              </span>
              <div
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-all duration-200 ${
                  sources.isChannelListCollapsed
                    ? 'bg-orange-400 animate-pulse'
                    : 'bg-green-400'
                }`}
              ></div>
            </button>
          </div>

          <div
            className={`grid gap-4 lg:h-[500px] xl:h-[650px] 2xl:h-[750px] transition-all duration-300 ease-in-out ${
              sources.isChannelListCollapsed
                ? 'grid-cols-1'
                : 'grid-cols-1 md:grid-cols-4'
            }`}
          >
            {/* 播放器 */}
            <div
              className={`h-full transition-all duration-300 ease-in-out ${sources.isChannelListCollapsed ? 'col-span-1' : 'md:col-span-3'}`}
            >
              <div className='relative w-full h-[300px] lg:h-full'>
                <div
                  ref={artRef}
                  className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg border border-white/0 dark:border-white/30'
                ></div>

                {/* 不支持的直播类型提示 */}
                {sources.unsupportedType && (
                  <div className='absolute inset-0 bg-black/90 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg border border-white/0 dark:border-white/30 flex items-center justify-center z-[600] transition-all duration-300'>
                    <LoadingStatePanel
                      compact
                      icon={<AlertTriangle className='w-9 h-9' />}
                      tone='amber'
                      title='暂不支持的直播流类型'
                      message={sources.unsupportedType.toUpperCase()}
                      description='目前仅支持 M3U8 格式，请尝试其他频道。'
                    />
                  </div>
                )}

                {/* 视频加载蒙层 */}
                {sources.isVideoLoading && (
                  <div className='absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg border border-white/0 dark:border-white/30 flex items-center justify-center z-[500] transition-all duration-300'>
                    <LoadingStatePanel
                      compact
                      icon={<Tv className='w-9 h-9' />}
                      tone='blue'
                      title='IPTV 加载中...'
                      description='正在拉取频道流并初始化播放器缓冲。'
                    >
                      <div className='flex items-center justify-center text-sky-300'>
                        <Loader2 className='w-5 h-5 animate-spin' />
                      </div>
                    </LoadingStatePanel>
                  </div>
                )}
              </div>
            </div>

            {/* 频道列表侧栏 */}
            <LiveChannelSidebar
              activeTab={sources.activeTab}
              setActiveTab={sources.setActiveTab}
              isChannelListCollapsed={sources.isChannelListCollapsed}
              isSwitchingSource={sources.isSwitchingSource}
              groupedChannels={sources.groupedChannels}
              selectedGroup={sources.selectedGroup}
              filteredChannels={sources.filteredChannels}
              currentChannel={sources.currentChannel}
              currentSource={sources.currentSource}
              liveSources={sources.liveSources}
              groupContainerRef={groupContainerRef}
              channelListRef={channelListRef}
              handleGroupChange={sources.handleGroupChange}
              handleChannelChange={sources.handleChannelChange}
              handleSourceChange={sources.handleSourceChange}
            />
          </div>
        </div>

        {/* 当前频道信息 */}
        {sources.currentChannel && (
          <LiveChannelInfo
            currentChannel={sources.currentChannel}
            currentSource={sources.currentSource}
            favorited={favorited}
            handleToggleFavorite={handleToggleFavorite}
            epgData={sources.epgData}
            isEpgLoading={sources.isEpgLoading}
          />
        )}
      </div>
    </PageLayout>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LivePageClient />
    </Suspense>
  );
}
