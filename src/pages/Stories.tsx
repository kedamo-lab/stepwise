import { Link } from "react-router-dom";
import { pad } from "../lib/api";
import { useFetch } from "../lib/use-fetch";
import type { Story } from "../lib/types";

export function Stories() {
  const { data, loading, error } = useFetch<{ items: Story[] }>("/stories");
  const items = data?.items ?? [];

  return (
    <div className="page">
      <section className="index-head">
        <div className="row row--between">
          <span className="label">STEPWISE / ЖУРНАЛ</span>
          <span className="label">{pad(items.length)} МАТЕРИАЛА</span>
        </div>
        <div className="index-title">
          <h1 className="h1">ЖУРНАЛ</h1>
          <p className="small muted" style={{ maxWidth: 320, margin: 0, lineHeight: 1.5 }}>
            Заметки о том, как устроена обувь: материалы, сканы, размеры и логика выбора.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="empty">ЗАГРУЗКА…</div>
      ) : error ? (
        <div className="empty">{error}</div>
      ) : (
        <div className="story-grid story-grid--wide">
          {items.map((story) => (
            <Link to={`/stories/${story.slug}`} className="story-card" key={story.slug}>
              <div className="story-card__media story-card__media--tall">
                <img src={story.image} alt={story.title} loading="lazy" />
              </div>
              <div className="row row--between">
                <span className="num">{story.number}</span>
                <span className="num">{story.subtitle}</span>
              </div>
              <h3 className="h2" style={{ fontSize: 20 }}>
                {story.title}
              </h3>
              <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
                {story.lead}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
