'use client';

import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';

interface ThemeToggleProps {
  variant?: 'icon' | 'sidebar';
  isCollapsed?: boolean;
}

export function ThemeToggle({
  variant = 'icon',
  isCollapsed = false,
}: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const setThemeColor = (theme?: string) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      const newMeta = document.createElement('meta');
      newMeta.name = 'theme-color';
      newMeta.content = theme === 'dark' ? '#0c111c' : '#f9fbfe';
      document.head.appendChild(newMeta);
    } else {
      meta.setAttribute('content', theme === 'dark' ? '#0c111c' : '#f9fbfe');
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // 监听主题变化和路由变化，确保主题色始终同步
  useEffect(() => {
    if (mounted) {
      setThemeColor(resolvedTheme);
    }
  }, [mounted, resolvedTheme, pathname]);

  if (!mounted) {
    // SSR/hydration 阶段：渲染带默认图标的占位符避免图标闪烁
    if (variant === 'sidebar') {
      return (
        <div className='group flex min-h-[40px] w-full items-center justify-start gap-3 rounded-lg px-2 py-2 pl-4 text-sm text-gray-500 dark:text-gray-400'>
          <div className='flex h-4 w-4 flex-shrink-0 items-center justify-center'>
            <Moon className='h-4 w-4' />
          </div>
          <span
            className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
              isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[120px] opacity-100'
            }`}
          >
            主题
          </span>
        </div>
      );
    }
    return (
      <div className='flex h-10 w-10 items-center justify-center rounded-full p-2 text-gray-600 dark:text-gray-300'>
        <Moon className='h-full w-full' />
      </div>
    );
  }

  const toggleTheme = () => {
    const targetTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setThemeColor(targetTheme);

    const startViewTransition = (document as any).startViewTransition as
      | ((callback: () => void) => { ready: Promise<void> })
      | undefined;

    if (
      !startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setTheme(targetTheme);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const maxRadius = Math.hypot(
      Math.max(centerX, window.innerWidth - centerX),
      Math.max(centerY, window.innerHeight - centerY),
    );

    const root = document.documentElement;
    root.style.setProperty('--theme-transition-x', `${centerX}px`);
    root.style.setProperty('--theme-transition-y', `${centerY}px`);
    root.style.setProperty('--theme-transition-radius', `${maxRadius}px`);

    const transition = startViewTransition.call(document, () => {
      setTheme(targetTheme);
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              'circle(0px at var(--theme-transition-x) var(--theme-transition-y))',
              'circle(var(--theme-transition-radius) at var(--theme-transition-x) var(--theme-transition-y))',
            ],
          },
          {
            duration: 380,
            easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        );
      })
      .catch(() => undefined);
  };

  if (variant === 'sidebar') {
    return (
      <button
        ref={buttonRef}
        onClick={toggleTheme}
        className='group flex min-h-[40px] w-full items-center justify-start gap-3 rounded-lg px-2 py-2 pl-4 text-sm text-gray-500 transition-colors duration-200 hover:bg-gray-100/30 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400'
        aria-label='Toggle theme'
        title='主题'
      >
        <div className='flex h-4 w-4 flex-shrink-0 items-center justify-center'>
          {resolvedTheme === 'dark' ? (
            <Sun className='h-4 w-4' />
          ) : (
            <Moon className='h-4 w-4' />
          )}
        </div>
        <span
          className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
            isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[120px] opacity-100'
          }`}
        >
          主题
        </span>
      </button>
    );
  }

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className='flex h-10 w-10 items-center justify-center rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50'
      aria-label='Toggle theme'
    >
      {resolvedTheme === 'dark' ? (
        <Sun className='h-full w-full' />
      ) : (
        <Moon className='h-full w-full' />
      )}
    </button>
  );
}
