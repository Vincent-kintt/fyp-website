import { useEffect, useRef } from "react";

// Shared ref-counted scroll lock.
// Multiple components can lock simultaneously; body overflow is only
// restored when every lock holder has released.
let lockCount = 0;
let savedOverflow = "";

function lock() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount++;
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
  }
}

/**
 * Lock body scroll when `active` is true.
 * Uses a ref guard to prevent double-counting from React Strict Mode.
 */
export default function useScrollLock(active) {
  const isLocked = useRef(false);

  useEffect(() => {
    if (active && !isLocked.current) {
      lock();
      isLocked.current = true;
    } else if (!active && isLocked.current) {
      unlock();
      isLocked.current = false;
    }

    return () => {
      if (isLocked.current) {
        unlock();
        isLocked.current = false;
      }
    };
  }, [active]);
}
