import { Link } from "react-router-dom";
import { pad } from "../lib/api";
import { useFetch } from "../lib/use-fetch";
import type { Drop } from "../lib/types";

export function Drops() {
  const { data, loading, error } = useFetch<{ items: Drop[] }>("/drops");
  const items = data?.items ?? [];

  return (
    <div className="page">
      <section className="index-head">
        <div className="row row--between">
          <span className="label">STEPWISE / ДРОПЫ</span>
          <span className="label">{pad(items.length)} ЛИНИИ</span>
        </div>
        <div className="index-title">
          <h1 className="h1">ДРОПЫ</h1>
          <p className="small muted" style={{ maxWidth: 320, margin: 0, lineHeight: 1.5 }}>
            Модели собраны в линии по сценарию носки: улица, корт, трейл. Внутри каждой линии — 3D и
            остатки по размерам.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="empty">ЗАГРУЗКА…</div>
      ) : error ? (
        <div className="empty">{error}</div>
      ) : (
        <div className="drop-list">
          {items.map((drop) => (
            <Link to={`/drops/${drop.slug}`} className="drop-list__row" key={drop.slug}>
              <span className="num">{drop.number}</span>
              <div className="col gap-6">
                <span className="h2">{drop.title}</span>
                <span className="small muted">{drop.subtitle}</span>
              </div>
              <p className="small muted drop-list__lead">{drop.lead}</p>
              <div className="drop-list__thumbs">
                {(drop.items ?? []).slice(0, 4).map((p) => (
                  <img key={p.slug} src={p.image} alt={p.name} loading="lazy" />
                ))}
              </div>
              <span className="small">{pad(drop.productCount ?? 0)} МОДЕЛИ ↗</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
