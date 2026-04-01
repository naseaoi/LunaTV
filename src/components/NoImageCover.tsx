import { ImageOff } from 'lucide-react';
import React from 'react';

interface NoImageCoverProps {
  label?: string;
  className?: string;
  labelClassName?: string;
  iconSize?: number;
  iconStrokeWidth?: number;
}

const NoImageCover: React.FC<NoImageCoverProps> = ({
  label = '无图片',
  className = '',
  labelClassName = '',
  iconSize = 16,
  iconStrokeWidth = 1.6,
}) => {
  const wrapperClassName =
    `absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-gray-200/80 text-gray-400 dark:bg-gray-700/80 dark:text-gray-500 ${className}`.trim();
  const textClassName =
    `text-[9px] leading-none font-medium ${labelClassName}`.trim();

  return (
    <div className={wrapperClassName}>
      <ImageOff size={iconSize} strokeWidth={iconStrokeWidth} />
      <span className={textClassName}>{label}</span>
    </div>
  );
};

export default NoImageCover;
