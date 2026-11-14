import { useEffect, useRef, useState } from "react";
export function useDelayedBusy(active: boolean) {
  const [visible, setVisible] = useState(false),
    shown = useRef(0);
  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (active) shown.current = Date.now();
        setVisible(active);
      },
      active ? 300 : Math.max(0, 400 - (Date.now() - shown.current)),
    );
    return () => clearTimeout(timer);
  }, [active]);
  return visible;
}
