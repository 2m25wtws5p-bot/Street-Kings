import { useLayoutEffect, useState } from "react";
import { reservedHandHeight } from "./handLayout";

export function useHandLayout(initialCount) {
  // A callback ref also measures when the table returns after a score screen.
  const [node, setNode] = useState(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!node) return;
    const measure = () => {
      const css = window.getComputedStyle(node);
      const read = name => Number.parseFloat(css.getPropertyValue(name)) || 0;
      const next = reservedHandHeight({ initialCount, width: node.getBoundingClientRect().width,
        cardWidth: read("--hand-card-width"), rowGap: read("--hand-row-gap"),
        columnGap: read("--hand-column-gap"), columns: read("--hand-columns") });
      setHeight(previous => Math.abs(previous - next) < .1 ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    // Height-only viewport changes also change our compact-card breakpoint.
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [initialCount, node]);
  return { ref: setNode, style: height ? { minHeight: `${height}px` } : undefined };
}
