import {
  hasReachedResumeTarget,
  shouldDismissLoadingFromCanPlay,
} from '@/features/play/lib/playerLoading';

describe('playerLoading', () => {
  it('视频仍处于暂停态时，canplay 不能提前关闭加载遮罩', () => {
    expect(
      shouldDismissLoadingFromCanPlay({ paused: true, ended: false }),
    ).toBe(false);
  });

  it('只有视频已经进入实际播放态时，canplay 才能兜底关闭遮罩', () => {
    expect(
      shouldDismissLoadingFromCanPlay({ paused: false, ended: false }),
    ).toBe(true);
  });

  it('恢复进度达到目标附近后即可关闭遮罩', () => {
    expect(hasReachedResumeTarget(299.4, 300)).toBe(true);
    expect(hasReachedResumeTarget(120, 300)).toBe(false);
  });
});
