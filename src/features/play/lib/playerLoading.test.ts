import { shouldDismissLoadingFromCanPlay } from '@/features/play/lib/playerLoading';

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
});
