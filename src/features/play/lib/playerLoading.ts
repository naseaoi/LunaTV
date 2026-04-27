export interface PlayerLoadingSessionState {
  pendingInitialResumeTarget: number | null;
  playbackStartNotified: boolean;
}

/**
 * canplay 只能说明媒体已具备继续播放的能力，
 * 但不代表用户已经看到首帧，因此仍需确认视频处于实际播放态。
 */
export function shouldDismissLoadingFromCanPlay(
  video: Pick<HTMLVideoElement, 'paused' | 'ended'> | null | undefined,
): boolean {
  if (!video) {
    return false;
  }

  return !video.paused && !video.ended;
}

/**
 * 某些浏览器/内核在切集后会先更新 currentTime，再补发 playing；
 * 只要已离开起播零点区间，就说明新视频已实际推进，可以安全收起遮罩。
 */
export function shouldDismissLoadingFromPlaybackProgress(
  currentTime: number,
): boolean {
  return Number.isFinite(currentTime) && currentTime > 1;
}

/**
 * 切集或换源开始新一轮加载时，必须重置本轮的 loading 会话状态。
 */
export function resetPlayerLoadingSessionState(
  state: PlayerLoadingSessionState,
): void {
  state.pendingInitialResumeTarget = null;
  state.playbackStartNotified = false;
}

/**
 * loading 关闭只允许执行一次；同一轮后续重复事件应直接忽略。
 */
export function markPlayerLoadingSessionStarted(
  state: PlayerLoadingSessionState,
): boolean {
  if (state.playbackStartNotified) {
    return false;
  }

  state.playbackStartNotified = true;
  return true;
}

/**
 * 恢复进度时允许 1 秒误差，避免 HLS 分片边界或浏览器取整造成永远等不到完全相等。
 */
export function hasReachedResumeTarget(
  currentTime: number,
  targetTime: number | null | undefined,
): boolean {
  if (!Number.isFinite(currentTime) || !Number.isFinite(targetTime)) {
    return false;
  }

  if ((targetTime as number) <= 0) {
    return true;
  }

  return currentTime >= (targetTime as number) - 1;
}
