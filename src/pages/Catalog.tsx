import { Link, useSearchParams } from "react-router-dom";
import { ProductCell } from "../components/ProductCell";
import { useApp } from "../lib/app-context";
import { pad } from "../lib/api";
import { useFetch } from "../lib/use-fetch";
import type { Facets, Product } from "../lib/types";

const sortOptions = [
  { value: "number", label: "ПО НОМЕРУ" },
  { value: "price", label: "ПО ЦЕНЕ" },
  { value: "name", label: "ПО НАЗВАНИЮ" },
  { value: "stock", label: "ПО ОСТАТКУ" },
];

export function Catalog() {
  const { user } = useApp();
  const [params, setParams] = useSearchParams();

  const search = params.get("search") || "";
  const manufacturer = params.get("manufacturer") || "";
  const subcategory = params.get("subcategory") || "";
  const size = params.get("size") || "";
  const sort = params.get("sort") || "number";
  const dir = params.get("dir") || "asc";

  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (manufacturer) query.set("manufacturer", manufacturer);
  if (subcategory) query.set("subcategory", subcategory);
  if (size) query.set("size", size);
  query.set("sort", sort);
  query.set("dir", dir);

  const { data, loading, error } = useFetch<{ items: Product[]; total: number; facets: Facets }>(
    `/catalog?${query.toString()}`,
  );

  const items = data?.items ?? [];
  const facets = data?.facets;

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const reset = () => setParams(new URLSearchParams(), { replace: true });

  const activeFilters = [search, manufacturer, subcategory, size].filter(Boolean).length;

  return (
    <div className="page">
      <section className="index-head">
        <div className="row row--between">
          <span className="label">STEPWISE / ИНДЕКС</span>
          <span className="label">
            01 / ПОЛНЫЙ КАТАЛОГ · {pad(data?.total ?? 0)} МОДЕЛЕЙ
          </span>
        </div>

        <div className="index-intro">
          <h1 className="h2">
            ВСЯ ОБУВЬ
            <br />В ОДНОМ ИНДЕКСЕ
          </h1>
        </div>

        {user ? (
          <div className="filters">
            <label className="field">
              <span className="label">ПОИСК</span>
              <input
                type="search"
                placeholder="МОДЕЛЬ, БРЕНД…"
                value={search}
                onChange={(e) => update("search", e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">БРЕНД</span>
              <select value={manufacturer} onChange={(e) => update("manufacturer", e.target.value)}>
                <option value="">ВСЕ</option>
                {(facets?.manufacturers ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="label">ТИП</span>
              <select value={subcategory} onChange={(e) => update("subcategory", e.target.value)}>
                <option value="">ВСЕ</option>
                {(facets?.subcategories ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="label">РАЗМЕР</span>
              <select value={size} onChange={(e) => update("size", e.target.value)}>
                <option value="">ЛЮБОЙ</option>
                {(facets?.sizes ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="label">СОРТИРОВКА</span>
              <select value={sort} onChange={(e) => update("sort", e.target.value)}>
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="chip chip--ghost"
              onClick={() => update("dir", dir === "asc" ? "desc" : "asc")}
              title="Направление сортировки"
            >
              {dir === "asc" ? "↑ ВОЗР." : "↓ УБЫВ."}
            </button>

            {activeFilters > 0 ? (
              <button type="button" className="chip chip--hover" onClick={reset}>
                СБРОСИТЬ ({activeFilters})
              </button>
            ) : null}
          </div>
        ) : (
          <div className="filters">
            <span className="chip chip--ghost">ФИЛЬТРЫ, СОРТИРОВКА И ПОИСК — ПОСЛЕ ВХОДА</span>
            <Link to="/login" className="chip chip--ink">
              ВОЙТИ <span>↗</span>
            </Link>
          </div>
        )}
      </section>

      {loading ? (
        <div className="empty">ЗАГРУЗКА ИНДЕКСА…</div>
      ) : error ? (
        <div className="empty">{error}</div>
      ) : items.length === 0 ? (
        <div className="empty">ПО ЭТИМ ФИЛЬТРАМ НИЧЕГО НЕ НАЙДЕНО</div>
      ) : (
        <>
          <div className="index-grid index-grid--5">
            {items.map((product) => (
              <ProductCell key={product.slug} product={product} />
            ))}
          </div>
          <div className="row row--between" style={{ paddingBottom: 40 }}>
            <span className="label">
              ПОКАЗАНО {pad(items.length)} ИЗ {pad(data?.total ?? 0)}
            </span>
            <span className="label">СТР. 01 / 01</span>
          </div>
        </>
      )}
    </div>
  );
}
