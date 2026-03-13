import { useState, useRef, useCallback, useEffect } from "react";

/**
 * useVirtualList – custom virtualization hook.
 *
 * ──────────────────────────────────────────────────────────────────────
 * HOW THE MATH WORKS
 * ──────────────────────────────────────────────────────────────────────
 * Given:
 *   totalItems    – total number of rows in the dataset
 *   itemHeight    – fixed pixel height of each row
 *   containerH    – visible pixel height of the scroll container
 *   buffer        – extra rows to render above and below the viewport
 *
 * At any scroll offset `scrollTop`:
 *   firstVisible  = Math.floor(scrollTop / itemHeight)
 *   lastVisible   = Math.floor((scrollTop + containerH) / itemHeight)
 *
 * With buffer:
 *   startIdx      = Math.max(0, firstVisible - buffer)
 *   endIdx        = Math.min(totalItems - 1, lastVisible + buffer)
 *
 * We then render rows [startIdx, endIdx] and push them down using:
 *   paddingTop    = startIdx * itemHeight    (empty space above rendered rows)
 *   paddingBottom = (totalItems - 1 - endIdx) * itemHeight  (space below)
 *
 * This keeps the scrollbar proportional to the full dataset while only
 * mounting the visible slice in the DOM.
 * ──────────────────────────────────────────────────────────────────────
 *
 * ⚠️  INTENTIONAL BUG (documented in README):
 * The scroll handler is registered inside a useEffect with an EMPTY
 * dependency array []. This means it captures `totalItems` and
 * `itemHeight` from the initial render in a stale closure.
 * If the dataset loads asynchronously after mount (which it does),
 * the handler will compute startIdx/endIdx against `totalItems = 0`,
 * returning an empty slice until the user triggers a manual scroll
 * or the component force-updates. The bug is visible as a brief
 * blank grid right after data arrives; scrolling immediately fixes it.
 *
 * Root cause: missing [totalItems, itemHeight] in the useEffect deps.
 */
export function useVirtualList({
  containerRef,
  totalItems,
  itemHeight = 48,
  buffer = 5,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerHeightRef = useRef(0);

  // Measure container height on mount / resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      containerHeightRef.current = entry.contentRect.height;
      // Force a re-render so slice recalculates after resize
      setScrollTop((s) => s);
    });
    observer.observe(el);
    containerHeightRef.current = el.clientHeight;
    return () => observer.disconnect();
  }, [containerRef]);

  // ⚠️ INTENTIONAL BUG: empty dep array → stale closure over `totalItems`
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // `totalItems` and `itemHeight` are captured here at mount time (= 0 / 48).
    // After data loads, these values inside this closure remain stale.
    function handleScroll() {
      const top = el.scrollTop;
      const containerH = containerHeightRef.current;
      const first = Math.floor(top / itemHeight);   // itemHeight is 48 – stable, fine
      const last  = Math.floor((top + containerH) / itemHeight);
      const start = Math.max(0, first - buffer);
      // BUG: `totalItems` here is the stale value from mount (0), so
      // end = Math.min(-1, last + buffer) = -1 → empty visible slice.
      const end   = Math.min(totalItems - 1, last + buffer);
      setScrollTop(top);
      _ = { start, end }; // computed but not returned – drives state update
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← missing [totalItems, itemHeight, buffer] intentionally

  // Even though the handler above has a bug, we recalculate the slice
  // correctly on every render using the *current* scrollTop state.
  // This means the bug only manifests transiently on first data load.
  const containerH = containerHeightRef.current || 600;
  const firstVisible = Math.floor(scrollTop / itemHeight);
  const lastVisible  = Math.floor((scrollTop + containerH) / itemHeight);
  const startIdx     = Math.max(0, firstVisible - buffer);
  const endIdx       = Math.min(totalItems - 1, lastVisible + buffer);

  const paddingTop    = startIdx * itemHeight;
  const paddingBottom = Math.max(0, (totalItems - 1 - endIdx) * itemHeight);

  const forceUpdate = useCallback(() => {
    setScrollTop((s) => s + 0.001);
  }, []);

  return { startIdx, endIdx, paddingTop, paddingBottom, forceUpdate };
}

// Suppress "unused variable" lint for the intentional bug illustration
let _ = null;
