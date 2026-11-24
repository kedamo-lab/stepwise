import { useEffect, useState } from "react";

export function Scrollbar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="scrollbar" aria-hidden="true">
      <span className="scrollbar__arrow">▲</span>
      <div className="scrollbar__track">
        <div
          className="scrollbar__thumb"
          style={{ height: `${Math.max(8, progress * 100)}%`, top: `${progress * 92}%` }}
        />
      </div>
      <span className="scrollbar__arrow">▼</span>
    </div>
  );
}
