import { useLayoutEffect, useState } from "react";
import { reservedHandHeight } from "./handLayout";

export function useHandLayout(initialCount) {
  // A callback ref also measures when the table returns after a score screen.
  const [node, setNode] = useState(null);
  const [height, setHeight] = useState(0);
  const [geometry, setGeometry] = useState({ width: 0, cardWidth: 80, columnGap: 8, rowGap: 26 });
  useLayoutEffect(() => {
    if (!node) return;
    const measure = () => {
      const css = window.getComputedStyle(node);
      const read = name => Number.parseFloat(css.getPropertyValue(name)) || 0;
      const width = node.getBoundingClientRect().width;
      const nextGeometry = { width, cardWidth: read("--hand-card-width"), rowGap: read("--hand-row-gap"), columnGap: read("--hand-column-gap") };
      const next = reservedHandHeight({ initialCount, ...nextGeometry, columns: 10 });
      setHeight(previous => Math.abs(previous - next) < .1 ? previous : next);
      setGeometry(previous => Object.keys(nextGeometry).every(key => previous[key] === nextGeometry[key]) ? previous : nextGeometry);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    // Height-only viewport changes also change our compact-card breakpoint.
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [initialCount, node]);
  return { ref: setNode, geometry, style: height ? { minHeight: `${height}px` } : undefined };
}
