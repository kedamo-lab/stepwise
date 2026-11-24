import { useEffect, useMemo, useRef } from "react";
import { Manifesto } from "../components/Manifesto";
import { LookbookScene } from "../components/LookbookScene";
import { pad } from "../lib/api";
import { useFetch } from "../lib/use-fetch";
import type { Product } from "../lib/types";

export function Home() {
  const catalog = useFetch<{ items: Product[]; total: number }>("/catalog");
  const scene = useRef<HTMLElement>(null);

  const products = useMemo(() => catalog.data?.items ?? [], [catalog.data]);
  const positions = products.reduce((sum, p) => sum + p.totalQty, 0);

  // Уход первого экрана: пока манифест наезжает, сцена отъезжает, сжимается
  // и гаснет. Прогресс считается по положению манифеста в окне.
  useEffect(() => {
    const el = scene.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      const manifesto = document.querySelector(".manifesto") as HTMLElement | null;
      if (!manifesto) return;

      const height = el.offsetHeight || window.innerHeight;
      // Позицию манифеста берём в координатах документа через offsetTop:
      // getBoundingClientRect учитывает transform, а страница при входе
      // анимируется сдвигом, из-за чего эффект ухода срабатывал сразу.
      let docTop = 0;
      let node: HTMLElement | null = manifesto;
      while (node) {
        docTop += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      const top = docTop - window.scrollY;
      const raw = Math.min(1, Math.max(0, 1 - top / height));
      // Сцена начинает уходить сразу при прокрутке, а не только в конце.
      const p = Math.pow(raw, 0.7);
      el.style.setProperty("--exit", p.toFixed(4));
      el.classList.toggle("is-exited", p > 0.96);
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

  // Вся коллекция стоит в одной 3D-сцене; каталог работает как раньше.
  const lineup = useMemo(
    () =>
      products.map((product) => ({
        slug: product.slug,
        number: product.number,
        name: product.name,
        manufacturer: product.manufacturer,
        price: product.price,
        file: product.glb,
      })),
    [products],
  );

  return (
    <>
      <section
        className="lookbook"
        ref={scene}
        aria-label="Лукбук: все модели коллекции в одной сцене"
      >
        <div className="lookbook__grid" aria-hidden="true" />
        <div className="lookbook__horizon" aria-hidden="true" />

        <div className="lookbook__head">
          <span className="label">STEPWISE / КОЛЛЕКЦИЯ 01 / 01</span>
          <h1 className="lookbook__title">ЛУКБУК</h1>
          <div className="lookbook__sub">
            <span className="num">{pad(products.length)} МОДЕЛЕЙ</span>
            <span className="num">{positions} ПОЗИЦИЙ</span>
            <span className="num">В СЦЕНЕ — {pad(lineup.length)}</span>
          </div>
        </div>

        <LookbookScene shoes={lineup} />
      </section>

      <Manifesto />
    </>
  );
}
