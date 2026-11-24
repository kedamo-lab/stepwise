import { Link, useParams } from "react-router-dom";
import { ProductCell } from "../components/ProductCell";
import { useFetch } from "../lib/use-fetch";
import type { Story } from "../lib/types";

export function StoryPage() {
  const { slug } = useParams();
  const { data, loading, error } = useFetch<{ story: Story }>(slug ? `/stories/${slug}` : null);
  const story = data?.story ?? null;

  if (loading) return <div className="page empty">ЗАГРУЗКА МАТЕРИАЛА…</div>;
  if (error || !story) return <div className="page empty">{error || "Материал не найден"}</div>;

  return (
    <div className="page">
      <div className="story">
        <div className="row row--between" style={{ marginBottom: 18 }}>
          <Link to="/stories" className="small link-underline">
            ← ЖУРНАЛ
          </Link>
          <span className="label">
            МАТЕРИАЛ {story.number} / {story.subtitle}
          </span>
        </div>

        <div className="story__cover">
          <img src={story.image} alt={story.title} />
          <div className="story__overlay">
            <div className="col gap-6">
              <span className="chip" style={{ alignSelf: "flex-start" }}>
                <span className="chip__dot" />
                {story.subtitle}
              </span>
              <h1 className="h1" style={{ maxWidth: 760 }}>
                {story.title}
              </h1>
            </div>
            <p className="small" style={{ maxWidth: 380, margin: 0, lineHeight: 1.6 }}>
              {story.lead}
            </p>
          </div>
        </div>

        <div className="story__body">
          <dl className="story__credits">
            {story.credits.map((credit) => (
              <div key={credit.label} style={{ display: "contents" }}>
                <dt>{credit.label}</dt>
                <dd>{credit.value}</dd>
              </div>
            ))}
          </dl>
          <div className="col gap-16" style={{ maxWidth: 560 }}>
            <p className="small" style={{ margin: 0, lineHeight: 1.75 }}>
              Мы смотрим на кроссовок как на набор данных: номер модели, силуэт, материал, размерный
              ряд и остаток по каждой позиции. Всё, что нельзя измерить, остаётся за кадром.
            </p>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.75 }}>
              Внутри материала — модели, собранные из фотограмметрических сканов сообщества. Они
              доступны во вращении и сохраняют фактуру оригинала: потёртости, швы, зерно кожи.
            </p>
          </div>
        </div>

        <div className="section__head">
          <span className="label">МОДЕЛИ ИЗ МАТЕРИАЛА</span>
          <span className="label">{String(story.items?.length ?? 0).padStart(2, "0")} ШТ.</span>
        </div>
        <div className="index-grid">
          {(story.items ?? []).map((product) => (
            <ProductCell key={product.slug} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
