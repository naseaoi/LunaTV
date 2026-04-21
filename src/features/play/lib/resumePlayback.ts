export const AUTO_RESUME_WINDOW_SECONDS = 5;

export type ResumeMode = 'history' | 'forced' | null;

type ResumePlayerLike = {
  currentTime: number;
  duration?: number;
};

/**
 * 仅允许在起播最初几秒内自动套用历史进度，避免播放中途 canplay 再次触发时误跳转。
 */
export function isWithinAutoResumeWindow(currentTime: number): boolean {
  return (
    Number.isFinite(currentTime) && currentTime <= AUTO_RESUME_WINDOW_SECONDS
  );
}

/**
 * 进度接近片尾时稍微回退几秒，避免落在 ended 附近直接触发播完逻辑。
 */
export function resolveResumeTimeTarget(
  targetTime: number,
  duration?: number,
): number {
  if (!Number.isFinite(targetTime) || targetTime <= 0) {
    return 0;
  }

  let safeTarget = Math.max(0, targetTime);
  if (
    Number.isFinite(duration) &&
    typeof duration === 'number' &&
    duration > 0 &&
    safeTarget >= duration - 2
  ) {
    safeTarget = Math.max(0, duration - 5);
  }

  return safeTarget;
}

export function applyResumeTime(
  player: ResumePlayerLike | null | undefined,
  targetTime: number,
): boolean {
  if (!player) {
    return false;
  }

  const safeTarget = resolveResumeTimeTarget(targetTime, player.duration);
  if (safeTarget <= 0) {
    return false;
  }

  player.currentTime = safeTarget;
  return true;
}
