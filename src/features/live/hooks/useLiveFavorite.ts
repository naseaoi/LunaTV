import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  deleteFavorite,
  generateStorageKey,
  isFavorited as checkIsFavorited,
  saveFavorite,
  subscribeToDataUpdates,
} from '@/lib/db.client';

import type { LiveChannel, LiveSource } from '../types';

interface UseLiveFavoriteParams {
  currentSource: LiveSource | null;
  currentChannel: LiveChannel | null;
  currentSourceRef: MutableRefObject<LiveSource | null>;
  currentChannelRef: MutableRefObject<LiveChannel | null>;
}

export function useLiveFavorite({
  currentSource,
  currentChannel,
  currentSourceRef,
  currentChannelRef,
}: UseLiveFavoriteParams) {
  const [favorited, setFavorited] = useState(false);
  const favoritedRef = useRef(false);

  // 检查收藏状态
  useEffect(() => {
    if (!currentSource || !currentChannel) return;
    (async () => {
      try {
        const fav = await checkIsFavorited(
          `live_${currentSource.key}`,
          `live_${currentChannel.id}`,
        );
        setFavorited(fav);
        favoritedRef.current = fav;
      } catch (err) {
        console.error('检查收藏状态失败:', err);
      }
    })();
  }, [currentSource, currentChannel]);

  // 监听收藏数据更新事件
  useEffect(() => {
    if (!currentSource || !currentChannel) return;

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, unknown>) => {
        const key = generateStorageKey(
          `live_${currentSource.key}`,
          `live_${currentChannel.id}`,
        );
        const isFav = !!favorites[key];
        setFavorited(isFav);
        favoritedRef.current = isFav;
      },
    );

    return unsubscribe;
  }, [currentSource, currentChannel]);

  // 切换收藏
  const handleToggleFavorite = async () => {
    if (!currentSourceRef.current || !currentChannelRef.current) return;

    try {
      const currentFavorited = favoritedRef.current;
      const newFavorited = !currentFavorited;

      // 立即更新状态
      setFavorited(newFavorited);
      favoritedRef.current = newFavorited;

      try {
        if (newFavorited) {
          await saveFavorite(
            `live_${currentSourceRef.current.key}`,
            `live_${currentChannelRef.current.id}`,
            {
              title: currentChannelRef.current.name,
              source_name: currentSourceRef.current.name,
              year: '',
              cover: `/api/proxy/logo?url=${encodeURIComponent(currentChannelRef.current.logo)}&icetv-source=${currentSourceRef.current.key}`,
              total_episodes: 1,
              save_time: Date.now(),
              search_title: '',
              origin: 'live',
            },
          );
        } else {
          await deleteFavorite(
            `live_${currentSourceRef.current.key}`,
            `live_${currentChannelRef.current.id}`,
          );
        }
      } catch (err) {
        console.error('收藏操作失败:', err);
        // 操作失败，回滚状态
        setFavorited(currentFavorited);
        favoritedRef.current = currentFavorited;
      }
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  return { favorited, handleToggleFavorite };
}
