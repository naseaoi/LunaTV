/**
 * 图片加载并发调度器
 *
 * 限制同时加载的图片数量，避免 25+ 封面同时请求导致
 * 浏览器 6 连接/域名 上限 + CDN 限流 → 大面积加载失败。
 *
 * 用法：
 *   const release = scheduler.acquire(callback)  // 排队，获得 slot 后调用 callback
 *   release()  // 释放 slot 或取消排队
 */

interface QueueItem {
  onGrant: () => void;
  cancelled: boolean;
  granted: boolean;
}

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
  addEventListener?: (type: 'change', listener: () => void) => void;
};

function getNetworkInformation(): NetworkInformationLike | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  return (navigator as Navigator & { connection?: NetworkInformationLike })
    .connection;
}

function resolveAdaptiveConcurrency(defaultConcurrent: number): number {
  const connection = getNetworkInformation();
  if (!connection) {
    return defaultConcurrent;
  }

  if (connection.saveData) {
    return 3;
  }

  switch (connection.effectiveType) {
    case 'slow-2g':
      return 2;
    case '2g':
      return 3;
    case '3g':
      return 5;
    default:
      break;
  }

  const downlink = connection.downlink ?? 0;
  if (downlink >= 10) {
    return 12;
  }
  if (downlink >= 5) {
    return 10;
  }
  if (downlink >= 2) {
    return 8;
  }

  return defaultConcurrent;
}

class ImageScheduler {
  private readonly defaultConcurrent: number;
  private maxConcurrent: number;
  private active = 0;
  private queue: QueueItem[] = [];

  constructor(maxConcurrent = 6) {
    this.defaultConcurrent = maxConcurrent;
    this.maxConcurrent = maxConcurrent;
    this.bindNetworkAwareness();
  }

  private bindNetworkAwareness() {
    if (typeof window === 'undefined') {
      return;
    }

    const syncConcurrency = () => {
      const nextConcurrency = resolveAdaptiveConcurrency(
        this.defaultConcurrent,
      );
      if (nextConcurrency === this.maxConcurrent) {
        return;
      }

      this.maxConcurrent = nextConcurrency;
      this.drain();
    };

    syncConcurrency();
    getNetworkInformation()?.addEventListener?.('change', syncConcurrency);
    window.addEventListener('online', syncConcurrency);
  }

  /**
   * 请求一个加载 slot。
   * - 若当前并发数未满，立即调用 onGrant
   * - 否则排入队列，等待其他 slot 释放后再调用
   *
   * 返回 release 函数：调用后释放 slot（或取消排队），幂等。
   */
  acquire(onGrant: () => void): () => void {
    const item: QueueItem = { onGrant, cancelled: false, granted: false };

    if (this.active < this.maxConcurrent) {
      this.active++;
      item.granted = true;
      onGrant();
    } else {
      this.queue.push(item);
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (item.granted) {
        this.active--;
        this.drain();
      } else {
        item.cancelled = true;
      }
    };
  }

  /** 从队列中取出下一个未取消的项，授予 slot */
  private drain() {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift()!;
      if (next.cancelled) continue;
      this.active++;
      next.granted = true;
      next.onGrant();
    }
  }
}

/** 全局单例，默认 6 并发，并按网络环境自适应调整 */
export const imageScheduler = new ImageScheduler(6);
