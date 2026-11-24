import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

const WORDS =
  "МЫ СОБИРАЕМ ОБУВЬ В ИНДЕКС: НОМЕР, СИЛУЭТ, МАТЕРИАЛ, РАЗМЕР. НИЧЕГО ЛИШНЕГО. КАЖДАЯ ПАРА — ТОЧКА НА МАРШРУТЕ.".split(
    " ",
  );

export function Manifesto() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      // Координаты документа, а не вьюпорта: вход страницы анимирован
      // сдвигом, и getBoundingClientRect давал ложный прогресс.
      let docTop = 0;
      let node: HTMLElement | null = el;
      while (node) {
        docTop += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      const top = docTop - window.scrollY;
      // Проявка идёт, пока секция входит в экран и ещё немного после.
      const span = window.innerHeight * 0.85;
      const progress = Math.min(1, Math.max(0, (window.innerHeight - top) / span));
      el.style.setProperty("--p", progress.toFixed(3));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section className="manifesto" ref={ref} aria-label="Манифест Stepwise">
      <div className="manifesto__pin">
        <div className="manifesto__meta">
          <span className="label">МАНИФЕСТ / 00</span>
          <span className="label">STEPWISE — ОБУВНОЙ ИНДЕКС</span>
        </div>

        <p className="manifesto__text">
          {WORDS.map((word, i) => {
            const dim = word === "НИЧЕГО" || word === "ЛИШНЕГО.";
            return (
              <span
                key={i}
                className={dim ? "manifesto__word is-dim" : "manifesto__word"}
                style={{ "--w": i } as CSSProperties}
              >
                {word}{" "}
              </span>
            );
          })}
        </p>
      </div>
    </section>
  );
}
