import { Link, useParams } from "react-router-dom";
import { useFetch } from "../lib/use-fetch";
import type { StaticPage } from "../lib/types";

export function Static() {
  const { slug } = useParams();
  const { data, loading, error } = useFetch<{ page: StaticPage }>(slug ? `/pages/${slug}` : null);
  const page = data?.page ?? null;

  if (loading) return <div className="page empty">ЗАГРУЗКА…</div>;
  if (error || !page) return <div className="page empty">{error || "Страница не найдена"}</div>;

  return (
    <div className="page">
      <div className="static">
        <div className="row row--between">
          <Link to="/" className="small link-underline">
            ← НА ГЛАВНУЮ
          </Link>
          <span className="label">ИНФОРМАЦИЯ</span>
        </div>
        <h1 className="h1">{page.title}</h1>
        <div className="col gap-16" style={{ maxWidth: 640 }}>
          {page.blocks.map((block) => (
            <p key={block} className="small" style={{ margin: 0, lineHeight: 1.75 }}>
              {block}
            </p>
          ))}
        </div>
        <Link to="/index/products" className="chip chip--ink" style={{ alignSelf: "flex-start" }}>
          В КАТАЛОГ <span>↗</span>
        </Link>
      </div>
    </div>
  );
}
