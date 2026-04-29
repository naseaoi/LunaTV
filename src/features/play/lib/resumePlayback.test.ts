import {
  applyResumeTime,
  AUTO_RESUME_WINDOW_SECONDS,
  isWithinAutoResumeWindow,
  resolvePendingResumeTime,
  resolveResumeTimeTarget,
  shouldForcePlaybackStartFromHead,
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

  it('起播时只允许使用显式恢复点', () => {
    expect(
      resolvePendingResumeTime({
        resumeTime: 180,
        resumeMode: 'forced',
        allowAutoResume: false,
      }),
    ).toBe(180);

    expect(
      resolvePendingResumeTime({
        resumeTime: 180,
        resumeMode: 'history',
        allowAutoResume: true,
      }),
    ).toBe(180);

    expect(
      resolvePendingResumeTime({
        resumeTime: 180,
        resumeMode: 'history',
        allowAutoResume: false,
      }),
    ).toBeNull();

    expect(
      resolvePendingResumeTime({
        resumeTime: null,
        resumeMode: null,
        allowAutoResume: true,
      }),
    ).toBeNull();
  });

  it('显式从头播放目标集时会要求播放器把 currentTime 归零', () => {
    expect(
      shouldForcePlaybackStartFromHead({
        resumeTime: 0,
        resumeMode: 'forced',
      }),
    ).toBe(true);

    expect(
      shouldForcePlaybackStartFromHead({
        resumeTime: 180,
        resumeMode: 'forced',
      }),
    ).toBe(false);

    expect(
      shouldForcePlaybackStartFromHead({
        resumeTime: 0,
        resumeMode: 'history',
      }),
    ).toBe(false);
  });
});
