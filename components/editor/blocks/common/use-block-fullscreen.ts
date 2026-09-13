"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FULLSCREEN_ATTR = "data-block-fullscreen";
const TARGET_ATTR = "data-fullscreen-target";

export function useBlockFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!isFullscreen) {
      document.documentElement.removeAttribute(FULLSCREEN_ATTR);
      el?.removeAttribute(TARGET_ATTR);
      return;
    }

    document.documentElement.setAttribute(FULLSCREEN_ATTR, "true");
    el?.setAttribute(TARGET_ATTR, "true");

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Do not exit fullscreen if a dialog or popover is open
      if (
        document.querySelector('[data-slot="popover-content"]') ||
        document.querySelector('[data-slot="dialog-content"]')
      ) {
        return;
      }
      event.preventDefault();
      setIsFullscreen(false);
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.documentElement.removeAttribute(FULLSCREEN_ATTR);
      el?.removeAttribute(TARGET_ATTR);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  return {
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
    containerRef,
  };
}
