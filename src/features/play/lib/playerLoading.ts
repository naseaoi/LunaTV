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
