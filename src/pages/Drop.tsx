import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ModelViewer } from "../components/ModelViewer";
import { formatPrice, pad } from "../lib/api";
import { useFetch } from "../lib/use-fetch";
import type { Drop, Product } from "../lib/types";

export function DropPage() {
  const { slug } = useParams();
  const { data, loading, error } = useFetch<{ drop: Drop }>(slug ? `/drops/${slug}` : null);
  const drop = data?.drop ?? null;
  const items: Product[] = drop?.items ?? [];
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
  }, [drop?.slug]);

  if (loading) return <div className="page empty">ЗАГРУЗКА ДРОПА…</div>;
  if (error || !drop) return <div className="page empty">{error || "Дроп не найден"}</div>;

  const current = items[active] ?? items[0];

  return (
    <div className="page">
      <section className="drop">
        <div className="row row--between">
          <Link to="/drops" className="small link-underline">
            ← ВСЕ ДРОПЫ
          </Link>
          <span className="label">
            ДРОП {drop.number} / {pad(items.length)} МОДЕЛИ
          </span>
        </div>

        <div className="drop__grid" style={{ marginTop: 24 }}>
          <aside className="drop__aside">
            <div className="col gap-6">
              <span className="label">{drop.subtitle}</span>
              <h1 className="h1">{drop.title}</h1>
            </div>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>
              {drop.lead}
            </p>

            <div className="drop__list">
              {items.map((item, index) => (
                <button
                  type="button"
                  key={item.slug}
                  className={"drop__row" + (index === active ? " is-active" : "")}
                  onClick={() => setActive(index)}
                >
                  <span className="num">{pad(index + 1)}</span>
                  <span>
                    {item.manufacturer} {item.name}
                  </span>
                  <span className="small muted">{item.sizeRange}</span>
                  <span className="mono small">{formatPrice(item.price)}</span>
                </button>
              ))}
            </div>

            {current ? (
              <Link to={`/products/${current.slug}`} className="action action--primary" style={{ position: "static" }}>
                <span>ОТКРЫТЬ {current.name}</span>
                <span className="action__go">↗</span>
              </Link>
            ) : null}
          </aside>

          <div className="col gap-16">
            {current ? (
              <>
                <ModelViewer product={current} spin={0.28} />
                <div className="row row--between">
                  <span className="label">
                    {pad(active + 1)} / {pad(items.length)} · {current.manufacturer}{" "}
                    {current.name}
                  </span>
                  <span className="label">{current.model3d.license}</span>
                </div>
                <div className="row gap-6">
                  {items.map((item, index) => (
                    <button
                      type="button"
                      key={item.slug}
                      className={index === active ? "chip chip--active" : "chip chip--hover"}
                      onClick={() => setActive(index)}
                    >
                      {pad(index + 1)}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
