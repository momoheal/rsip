import { useCallback, useRef } from 'react';
import type React from 'react';

/** 最大倾斜角度（度） */
const MAX_TILT = 7;

function canTilt(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * 卡牌 3D 倾斜 + 高光跟随：把指针位置写进 CSS 变量（--rx/--ry/--mx/--my），
 * 样式由 .rsip-card 消费。触屏与「减少动态效果」下不生效。
 */
export function useCardTilt<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const frame = useRef<number>(0);

  const onPointerMove = useCallback((event: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el || !canTilt()) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty('--ry', `${(px - 0.5) * MAX_TILT * 2}deg`);
      el.style.setProperty('--rx', `${(0.5 - py) * MAX_TILT * 2}deg`);
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
    });
  }, []);

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
