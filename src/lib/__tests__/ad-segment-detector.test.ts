/**
 * 广告段识别纯函数的单测。
 * 跳过网络相关路径（computeSegmentBitrate 依赖 fetch），仅覆盖解析、
 * 众数计算与重建 m3u8 的纯逻辑。
 */
import {
  shouldRunAdDetection,
  stripAdSegmentsByPhysicalSignal,
} from '@/lib/ad-segment-detector';

describe('shouldRunAdDetection', () => {
  test('仅对 rycj 源站启用', () => {
    expect(shouldRunAdDetection('rycj')).toBe(true);
    expect(shouldRunAdDetection('other')).toBe(false);
    expect(shouldRunAdDetection(null)).toBe(false);
    expect(shouldRunAdDetection('')).toBe(false);
  });
});

describe('stripAdSegmentsByPhysicalSignal', () => {
  test('不含 DISCONTINUITY 时原样返回', async () => {
    const m3u8 = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXTINF:5,',
      'a.ts',
      '#EXT-X-ENDLIST',
    ].join('\n');
    const result = await stripAdSegmentsByPhysicalSignal(
      m3u8,
      'https://cdn.example.com/x/index.m3u8',
      'ua',
    );
    expect(result).toBe(m3u8);
  });

  test('段数不足时原样返回', async () => {
    const m3u8 = [
      '#EXTM3U',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:5,',
      'a.ts',
      '#EXT-X-DISCONTINUITY',
      '#EXTINF:5,',
      'b.ts',
      '#EXT-X-ENDLIST',
    ].join('\n');
    // 虽然有 DISCONTINUITY 但只有 2 段，应短路
    const result = await stripAdSegmentsByPhysicalSignal(
      m3u8,
      'https://cdn.example.com/x/index.m3u8',
      'ua',
    );
    expect(result).toBe(m3u8);
  });

  test('段切分不规整（众数覆盖率低）时原样返回', async () => {
    // 5 段时长各异，无明显众数
    const lines = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:10'];
    const durs = [5, 8, 12, 6, 10];
    durs.forEach((d, i) => {
      lines.push('#EXT-X-DISCONTINUITY');
      lines.push(`#EXTINF:${d}.0,`);
      lines.push(`s${i}.ts`);
    });
    lines.push('#EXT-X-ENDLIST');
    const m3u8 = lines.join('\n');
    const result = await stripAdSegmentsByPhysicalSignal(
      m3u8,
      'https://cdn.example.com/x/index.m3u8',
      'ua',
    );
    // 众数覆盖率 = 1/5 = 20% < 60%，应原样返回
    expect(result).toBe(m3u8);
  });

  test('所有段都贴近众数且无偏离段时原样返回', async () => {
    const lines = ['#EXTM3U'];
    for (let i = 0; i < 10; i++) {
      lines.push('#EXT-X-DISCONTINUITY');
      lines.push('#EXTINF:5.005,');
      lines.push(`s${i}.ts`);
    }
    lines.push('#EXT-X-ENDLIST');
    const m3u8 = lines.join('\n');
    const result = await stripAdSegmentsByPhysicalSignal(
      m3u8,
      'https://cdn.example.com/x/index.m3u8',
      'ua',
    );
    expect(result).toBe(m3u8);
  });
});
