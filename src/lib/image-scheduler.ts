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

class ImageScheduler {
  private readonly maxConcurrent: number;
  private active = 0;
  private queue: QueueItem[] = [];

  constructor(maxConcurrent = 6) {
    this.maxConcurrent = maxConcurrent;
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

/** 全局单例，限制同时 6 张图片加载 */
export const imageScheduler = new ImageScheduler(6);
