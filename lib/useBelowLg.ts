"use client";

import { useEffect, useState } from "react";

// Whether the viewport is below the `lg` breakpoint (1024px) — the range
// where the app applies its mobile type scale-up (see globals.css). Used by
// the chart components to widen fixed-pixel axis gutters to fit the larger
// mobile tick labels without changing desktop chart geometry. SSR/first
// paint returns false (desktop sizing); the value corrects on mount, before
// Recharts' ResponsiveContainer has measured, so charts don't visibly shift.
export function useBelowLg(): boolean {
  const [below, setBelow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setBelow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return below;
}
