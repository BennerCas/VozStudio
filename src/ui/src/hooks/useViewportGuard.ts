import { useEffect, useState } from 'react';

export interface ViewportGuardState {
  width: number;
  height: number;
  isCompactOrPortrait: boolean;
}

export function useViewportGuard(): ViewportGuardState {
  const [state, setState] = useState<ViewportGuardState>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const h = typeof window !== 'undefined' ? window.innerHeight : 1080;
    return {
      width: w,
      height: h,
      isCompactOrPortrait: w < 900 || h > w,
    };
  });

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setState({
        width: w,
        height: h,
        isCompactOrPortrait: w < 900 || h > w,
      });
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return state;
}
