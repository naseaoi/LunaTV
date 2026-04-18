import { ImagePlaceholder } from '@/components/ImagePlaceholder';

const DoubanCardSkeleton = () => {
  return (
    <div className='w-full'>
      <div className='group relative flex w-full flex-col rounded-lg bg-transparent shadow-none'>
        {/* 图片占位符 - 骨架屏效果 */}
        <ImagePlaceholder aspectRatio='aspect-[2/3]' />

        {/* 信息层骨架：与真实卡片保持同一高度模型，避免切换时整体布局跳动。 */}
        <div className='mt-2 flex flex-col items-center justify-center'>
          <div className='mb-2 h-4 w-24 animate-pulse rounded bg-gray-200 sm:w-32'></div>
        </div>
      </div>
    </div>
  );
};

export default DoubanCardSkeleton;
