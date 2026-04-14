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
