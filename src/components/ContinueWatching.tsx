'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

import { History } from 'lucide-react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import type { PlayRecord } from '@/lib/db.client';
import {
  clearAllPlayRecords,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { parseStorageKey } from '@/lib/utils';

import ScrollableRow from '@/components/ScrollableRow';
import VideoCard from '@/components/VideoCard';
import ConfirmModal from '@/components/modals/ConfirmModal';

// 客户端用 useLayoutEffect（绘制前同步执行），SSR 用 useEffect（避免警告）
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface ContinueWatchingProps {
  className?: string;
}

export default function ContinueWatching({ className }: ContinueWatchingProps) {
  const [playRecords, setPlayRecords] = useState<
    (PlayRecord & { key: string })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [skeletonCount, setSkeletonCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 处理播放记录数据更新的函数
  const updatePlayRecords = (allRecords: Record<string, PlayRecord>) => {
    const recordsArray = Object.entries(allRecords).map(([key, record]) => ({
      ...record,
      key,
    }));

    const sortedRecords = recordsArray.sort(
      (a, b) => b.save_time - a.save_time,
    );

    setPlayRecords(sortedRecords);
    // 缓存数量到 localStorage（客户端骨架）+ cookie（服务端骨架）
    const count = String(sortedRecords.length);
    try {
      localStorage.setItem('continueWatchingCount', count);
    } catch {
      // localStorage 不可用时静默忽略
    }
    document.cookie = `cw_count=${count};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;
  };

  // 绘制前同步读取缓存，立即决定是否显示骨架，避免空白帧闪烁
  useIsomorphicLayoutEffect(() => {
    const isAuthenticated = !!getAuthInfoFromBrowserCookie()?.username;
    if (!isAuthenticated) return;

    const cached = parseInt(
      localStorage.getItem('continueWatchingCount') || '0',
      10,
    );
    if (cached > 0) {
      setSkeletonCount(Math.min(cached, 8));
      setLoading(true);
    }
  }, []);

  // 异步加载播放记录数据
  useEffect(() => {
    const isAuthenticated = !!getAuthInfoFromBrowserCookie()?.username;
    if (!isAuthenticated) return;

    const fetchPlayRecords = async () => {
      try {
        // 从缓存或API获取所有播放记录
        const allRecords = await getAllPlayRecords();
        updatePlayRecords(allRecords);
      } catch (error) {
        console.error('获取播放记录失败:', error);
        setPlayRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayRecords();

    // 监听播放记录更新事件
    const unsubscribe = subscribeToDataUpdates(
      'playRecordsUpdated',
      (newRecords: Record<string, PlayRecord>) => {
        updatePlayRecords(newRecords);
      },
    );

    return unsubscribe;
  }, []);

  // 如果没有播放记录，则不渲染组件
  if (!loading && playRecords.length === 0) {
    return null;
  }

  // 计算播放进度百分比
  const getProgress = (record: PlayRecord) => {
    if (record.total_time === 0) return 0;
    return (record.play_time / record.total_time) * 100;
  };

  // 从 key 中解析 source 和 id
  const parseKey = (key: string) => {
    return parseStorageKey(key);
  };

  return (
    <>
      <section className={`mb-4 ${className || ''}`}>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-gray-200'>
            <History className='h-5 w-5 text-orange-500' />
            继续观看
          </h2>
          {!loading && playRecords.length > 0 && (
            <button
              className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              onClick={() => setShowClearConfirm(true)}
            >
              清空
            </button>
          )}
        </div>
        <ScrollableRow>
          {loading
            ? // 按缓存数量显示骨架占位，避免与加载后的布局不匹配
              Array.from({ length: skeletonCount }).map((_, index) => (
                <div
                  key={index}
                  className='w-24 min-w-[96px] sm:w-44 sm:min-w-[180px]'
                >
                  <div className='relative aspect-[2/3] w-full animate-pulse overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800'>
                    <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
                  </div>
                  <div className='mx-auto mt-2 h-5 w-4/5 animate-pulse rounded bg-gray-200 dark:bg-gray-800'></div>
                  <div className='mx-auto mt-1 h-[22px] w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800'></div>
                </div>
              ))
            : // 显示真实数据
              playRecords.map((record, index) => {
                const parsedKey = parseKey(record.key);
                if (!parsedKey) {
                  return null;
                }

                const { source, id } = parsedKey;
                return (
                  <div
                    key={record.key}
                    className='w-24 min-w-[96px] sm:w-44 sm:min-w-[180px]'
                  >
                    <VideoCard
                      id={id}
                      title={record.title}
                      poster={record.cover}
                      year={record.year}
                      source={source}
                      source_name={record.source_name}
                      progress={getProgress(record)}
                      episodes={record.total_episodes}
                      currentEpisode={record.index}
                      resumeTime={Math.max(
                        0,
                        Math.floor(record.play_time || 0),
                      )}
                      query={record.search_title}
                      from='playrecord'
                      onDelete={() =>
                        setPlayRecords((prev) =>
                          prev.filter((r) => r.key !== record.key),
                        )
                      }
                      priority={index < 4}
                      type={record.total_episodes > 1 ? 'tv' : ''}
                    />
                  </div>
                );
              })}
        </ScrollableRow>
      </section>

      <ConfirmModal
        isOpen={showClearConfirm}
        title='确认清空继续观看记录？'
        message='该操作会删除所有继续观看记录，删除后无法恢复。'
        danger
        cancelText='再想想'
        confirmText='确认清空'
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={async () => {
          await clearAllPlayRecords();
          setPlayRecords([]);
          setShowClearConfirm(false);
          try {
            localStorage.setItem('continueWatchingCount', '0');
          } catch {}
          document.cookie = 'cw_count=0;path=/;max-age=0;samesite=lax';
        }}
      />
    </>
  );
}
