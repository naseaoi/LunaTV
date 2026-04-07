import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';

import type Artplayer from 'artplayer';

import {
  deletePlayRecord,
  generateStorageKey,
  getAllPlayRecords,
  PlayRecord,
  savePlayRecord,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

import {
  LEGACY_PLAY_CHECKPOINT_KEY,
  PLAY_CHECKPOINT_KEY,
  PlayCheckpoint,
  SessionLostReason,
  WakeLockSentinel,
} from '@/features/play/lib/playTypes';

// ---------------------------------------------------------------------------
// Checkpoint: 保存/恢复
// ---------------------------------------------------------------------------

export function savePlaybackCheckpoint(
  currentSourceRef: MutableRefObject<string>,
  currentIdRef: MutableRefObject<string>,
  currentEpisodeIndexRef: MutableRefObject<number>,
  videoTitleRef: MutableRefObject<string>,
  artPlayerRef: MutableRefObject<Artplayer | null>,
  reason?: SessionLostReason,
) {
  if (typeof window === 'undefined') return;
  if (!currentSourceRef.current || !currentIdRef.current) return;

  const currentTime = artPlayerRef.current?.currentTime || 0;
  const checkpoint: PlayCheckpoint = {
    source: currentSourceRef.current,
    id: currentIdRef.current,
    episodeIndex: Math.max(0, currentEpisodeIndexRef.current),
    currentTime: Math.max(0, Math.floor(currentTime)),
    title: videoTitleRef.current || '',
    saveTime: Date.now(),
  };

  try {
    sessionStorage.setItem(
      PLAY_CHECKPOINT_KEY,
      JSON.stringify({ ...checkpoint, reason: reason || null }),
    );
    sessionStorage.removeItem(LEGACY_PLAY_CHECKPOINT_KEY);
  } catch (error) {
    console.warn('保存播放恢复点失败:', error);
  }
}

export function restorePlaybackCheckpoint(
  currentSourceRef: MutableRefObject<string>,
  currentIdRef: MutableRefObject<string>,
  setCurrentEpisodeIndex: Dispatch<SetStateAction<number>>,
  resumeTimeRef: MutableRefObject<number | null>,
): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const raw =
      sessionStorage.getItem(PLAY_CHECKPOINT_KEY) ||
      sessionStorage.getItem(LEGACY_PLAY_CHECKPOINT_KEY);
    if (!raw) return false;

    const checkpoint = JSON.parse(raw) as PlayCheckpoint;
    if (!checkpoint?.source || !checkpoint?.id) {
      sessionStorage.removeItem(PLAY_CHECKPOINT_KEY);
      sessionStorage.removeItem(LEGACY_PLAY_CHECKPOINT_KEY);
      return false;
    }

    // 仅恢复 4 小时内的检查点
    if (Date.now() - checkpoint.saveTime > 4 * 60 * 60 * 1000) {
      sessionStorage.removeItem(PLAY_CHECKPOINT_KEY);
      sessionStorage.removeItem(LEGACY_PLAY_CHECKPOINT_KEY);
      return false;
    }

    if (
      checkpoint.source !== currentSourceRef.current ||
      checkpoint.id !== currentIdRef.current
    ) {
      return false;
    }

    if (checkpoint.episodeIndex >= 0) {
      setCurrentEpisodeIndex(checkpoint.episodeIndex);
    }
    if (checkpoint.currentTime > 0) {
      resumeTimeRef.current = checkpoint.currentTime;
    }

    sessionStorage.removeItem(PLAY_CHECKPOINT_KEY);
    sessionStorage.removeItem(LEGACY_PLAY_CHECKPOINT_KEY);
    return true;
  } catch (error) {
    console.warn('恢复播放恢复点失败:', error);
    sessionStorage.removeItem(PLAY_CHECKPOINT_KEY);
    sessionStorage.removeItem(LEGACY_PLAY_CHECKPOINT_KEY);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 保存播放进度到 IndexedDB
// ---------------------------------------------------------------------------

type PendingPlayProgressSave = {
  source: string;
  id: string;
  record: PlayRecord;
  fingerprint: string;
};

export interface PlayProgressSaveState {
  inFlight: boolean;
  pending: PendingPlayProgressSave | null;
  lastSavedFingerprint: string | null;
}

function buildPlayProgressFingerprint(
  source: string,
  id: string,
  record: PlayRecord,
): string {
  return [source, id, record.index, record.play_time, record.total_time].join(
    '|',
  );
}

async function flushPlayProgressSave(
  saveStateRef: MutableRefObject<PlayProgressSaveState>,
  lastSaveTimeRef: MutableRefObject<number>,
  payload: PendingPlayProgressSave,
): Promise<void> {
  saveStateRef.current.inFlight = true;
  lastSaveTimeRef.current = Date.now();

  try {
    await savePlayRecord(payload.source, payload.id, payload.record);
    saveStateRef.current.lastSavedFingerprint = payload.fingerprint;
  } finally {
    saveStateRef.current.inFlight = false;

    const pending = saveStateRef.current.pending;
    saveStateRef.current.pending = null;

    if (
      pending &&
      pending.fingerprint !== saveStateRef.current.lastSavedFingerprint
    ) {
      await flushPlayProgressSave(saveStateRef, lastSaveTimeRef, pending);
    }
  }
}

export async function saveCurrentPlayProgress(
  artPlayerRef: MutableRefObject<Artplayer | null>,
  currentSourceRef: MutableRefObject<string>,
  currentIdRef: MutableRefObject<string>,
  videoTitleRef: MutableRefObject<string>,
  detailRef: MutableRefObject<SearchResult | null>,
  currentEpisodeIndexRef: MutableRefObject<number>,
  saveStateRef: MutableRefObject<PlayProgressSaveState>,
  lastSaveTimeRef: MutableRefObject<number>,
  searchTitle: string,
) {
  if (
    !artPlayerRef.current ||
    !currentSourceRef.current ||
    !currentIdRef.current ||
    !videoTitleRef.current ||
    !detailRef.current?.source_name
  ) {
    return;
  }

  const player = artPlayerRef.current;
  const currentTime = player.currentTime || 0;
  const duration = player.duration || 0;

  // 播放时间太短或视频时长无效，不保存
  if (currentTime < 1 || !duration) {
    return;
  }

  const record: PlayRecord = {
    title: videoTitleRef.current,
    source_name: detailRef.current?.source_name || '',
    year: detailRef.current?.year,
    cover: detailRef.current?.poster || '',
    index: currentEpisodeIndexRef.current + 1,
    total_episodes: detailRef.current?.episodes.length || 1,
    play_time: Math.floor(currentTime),
    total_time: Math.floor(duration),
    save_time: Date.now(),
    search_title: searchTitle,
  };

  const fingerprint = buildPlayProgressFingerprint(
    currentSourceRef.current,
    currentIdRef.current,
    record,
  );

  if (fingerprint === saveStateRef.current.lastSavedFingerprint) {
    return;
  }

  try {
    if (saveStateRef.current.inFlight) {
      saveStateRef.current.pending = {
        source: currentSourceRef.current,
        id: currentIdRef.current,
        record,
        fingerprint,
      };
      return;
    }

    await flushPlayProgressSave(saveStateRef, lastSaveTimeRef, {
      source: currentSourceRef.current,
      id: currentIdRef.current,
      record,
      fingerprint,
    });
  } catch (err) {
    console.error('保存播放进度失败:', err);
  }
}

// ---------------------------------------------------------------------------
// usePlayProgress hook — 组合所有进度管理相关 effect
// ---------------------------------------------------------------------------

interface UsePlayProgressParams {
  artPlayerRef: MutableRefObject<Artplayer | null>;
  currentSourceRef: MutableRefObject<string>;
  currentIdRef: MutableRefObject<string>;
  videoTitleRef: MutableRefObject<string>;
  detailRef: MutableRefObject<SearchResult | null>;
  currentEpisodeIndexRef: MutableRefObject<number>;
  resumeTimeRef: MutableRefObject<number | null>;
  saveStateRef: MutableRefObject<PlayProgressSaveState>;
  lastSaveTimeRef: MutableRefObject<number>;
  saveIntervalRef: MutableRefObject<NodeJS.Timeout | null>;
  wakeLockRef: MutableRefObject<WakeLockSentinel | null>;
  searchTitle: string;
  currentSource: string;
  currentId: string;
  currentEpisodeIndex: number;
  detail: SearchResult | null;
  setCurrentEpisodeIndex: Dispatch<SetStateAction<number>>;
  cleanupPlayer: () => void;
}

export function usePlayProgress({
  artPlayerRef,
  currentSourceRef,
  currentIdRef,
  videoTitleRef,
  detailRef,
  currentEpisodeIndexRef,
  resumeTimeRef,
  saveStateRef,
  lastSaveTimeRef,
  saveIntervalRef,
  wakeLockRef,
  searchTitle,
  currentSource,
  currentId,
  currentEpisodeIndex,
  detail,
  setCurrentEpisodeIndex,
  cleanupPlayer,
}: UsePlayProgressParams) {
  const doSave = () =>
    saveCurrentPlayProgress(
      artPlayerRef,
      currentSourceRef,
      currentIdRef,
      videoTitleRef,
      detailRef,
      currentEpisodeIndexRef,
      saveStateRef,
      lastSaveTimeRef,
      searchTitle,
    );

  const doCheckpoint = (reason?: SessionLostReason) =>
    savePlaybackCheckpoint(
      currentSourceRef,
      currentIdRef,
      currentEpisodeIndexRef,
      videoTitleRef,
      artPlayerRef,
      reason,
    );

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (
          navigator as unknown as {
            wakeLock: { request: (type: string) => Promise<WakeLockSentinel> };
          }
        ).wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock 请求失败:', err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (err) {
      console.warn('Wake Lock 释放失败:', err);
    }
  };

  useEffect(() => {
    // 切换到新视频时丢弃旧请求的排队状态，避免旧进度回写到新条目。
    saveStateRef.current.pending = null;
    saveStateRef.current.lastSavedFingerprint = null;
  }, [currentSource, currentId]);

  // 播放记录处理：source/id 就绪后检查恢复点与播放记录
  useEffect(() => {
    const initFromHistory = async () => {
      if (!currentSource || !currentId) return;

      if (
        restorePlaybackCheckpoint(
          currentSourceRef,
          currentIdRef,
          setCurrentEpisodeIndex,
          resumeTimeRef,
        )
      ) {
        return;
      }

      try {
        const allRecords = await getAllPlayRecords();
        const key = generateStorageKey(currentSource, currentId);
        const record = allRecords[key];

        if (record) {
          const targetIndex = record.index - 1;
          const targetTime = record.play_time;

          if (targetIndex !== currentEpisodeIndex) {
            setCurrentEpisodeIndex(targetIndex);
          }
          resumeTimeRef.current = targetTime;
        }
      } catch (err) {
        console.error('读取播放记录失败:', err);
      }
    };

    initFromHistory();
  }, [currentSource, currentId]);

  // beforeunload / visibilitychange 事件处理
  useEffect(() => {
    const handleBeforeUnload = () => {
      doCheckpoint();
      doSave();
      releaseWakeLock();
      cleanupPlayer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        doCheckpoint();
        doSave();
        releaseWakeLock();
      } else if (document.visibilityState === 'visible') {
        if (artPlayerRef.current && artPlayerRef.current.playing) {
          requestWakeLock();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentEpisodeIndex, detail, artPlayerRef.current]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, []);

  // 组件卸载时清理定时器、Wake Lock 和播放器资源
  useEffect(() => {
    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      releaseWakeLock();
      cleanupPlayer();
    };
  }, []);

  return {
    saveCurrentPlayProgress: doSave,
    savePlaybackCheckpoint: doCheckpoint,
    requestWakeLock,
    releaseWakeLock,
  };
}

// ---------------------------------------------------------------------------
// 换源时清理旧播放记录
// ---------------------------------------------------------------------------

export async function deleteOldPlayRecord(source: string, id: string) {
  try {
    await deletePlayRecord(source, id);
  } catch (err) {
    console.error('清除播放记录失败:', err);
  }
}
