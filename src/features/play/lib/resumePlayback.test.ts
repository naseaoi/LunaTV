import {
  applyResumeTime,
  AUTO_RESUME_WINDOW_SECONDS,
  isWithinAutoResumeWindow,
  resolveResumeTimeTarget,
} from '@/features/play/lib/resumePlayback';

describe('resumePlayback', () => {
  it('只在起播前几秒内保留自动恢复窗口', () => {
    expect(isWithinAutoResumeWindow(0)).toBe(true);
    expect(isWithinAutoResumeWindow(AUTO_RESUME_WINDOW_SECONDS)).toBe(true);
    expect(isWithinAutoResumeWindow(AUTO_RESUME_WINDOW_SECONDS + 0.1)).toBe(
      false,
    );
  });

  it('恢复点靠近片尾时会自动回退几秒', () => {
    expect(resolveResumeTimeTarget(118, 120)).toBe(115);
    expect(resolveResumeTimeTarget(45, 120)).toBe(45);
  });

  it('会把安全恢复时间写回播放器实例', () => {
    const player = { currentTime: 0, duration: 120 };

    expect(applyResumeTime(player, 118)).toBe(true);
    expect(player.currentTime).toBe(115);
  });
});
