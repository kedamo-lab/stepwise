import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ModelViewer } from "../components/ModelViewer";
import { ProductCell } from "../components/ProductCell";
import { useApp } from "../lib/app-context";
import { formatPrice, pad } from "../lib/api";
import { useFetch } from "../lib/use-fetch";
import type { Drop, Product } from "../lib/types";

function Accordion({
  title,
  children,
  open,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="acc">
      <button type="button" className="acc__head" onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <span className="dim">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="acc__body">{children}</div> : null}
    </div>
  );
}

export function ProductPage() {
  const { slug } = useParams();
  const { addToCart, notify, user } = useApp();
  const { data, loading, error } = useFetch<{ product: Product; drop: Drop | null }>(
    slug ? `/products/${slug}` : null,
  );
  const dropFeed = useFetch<{ items: Product[] }>("/catalog");

  const product = data?.product ?? null;
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState<string | null>("details");

  const available = useMemo(() => product?.sizes.filter((s) => s.qty > 0) ?? [], [product]);

  useEffect(() => {
    setSize(available[0]?.size ?? "");
    setQty(1);
  }, [product?.slug, available]);

  const limit = product?.sizes.find((s) => s.size === size)?.qty ?? 0;
  const related = (dropFeed.data?.items ?? [])
    .filter((p) => p.slug !== product?.slug)
    .slice(0, 5);

  if (loading) return <div className="page empty">ЗАГРУЗКА МОДЕЛИ…</div>;
  if (error || !product) return <div className="page empty">{error || "Модель не найдена"}</div>;

  return (
    <div className="page product-page">
      <div className="row row--between" style={{ paddingTop: 96 }}>
        <Link to="/index/products" className="small link-underline">
          ← ИНДЕКС / ПРОДУКТЫ
        </Link>
        <span className="label">
          МОДЕЛЬ {product.number} / {pad(dropFeed.data?.items.length ?? 10)}
        </span>
      </div>

      <div className="product">
        <div className="product__meta">
          <div className="col gap-6">
            <span className="label">{product.subcategory} / {product.manufacturer}</span>
            <div className="product__title">
              <h1 className="h2">{product.name}</h1>
              <span className="product__price">{formatPrice(product.price)}</span>
            </div>
          </div>

          <div className="col gap-6">
            <div className="row row--between">
              <span className="label">РАЗМЕР / ДОСТУПНЫЕ ПОЗИЦИИ</span>
              <span className="label">{product.sizeRange}</span>
            </div>
            <div className="option-list">
              {product.sizes.map((position) => {
                const disabled = position.qty === 0;
                return (
                  <button
                    key={position.size}
                    type="button"
                    className={
                      "option" +
                      (size === position.size ? " option--active" : "") +
                      (disabled ? " option--disabled" : "")
                    }
                    disabled={disabled}
                    onClick={() => {
                      setSize(position.size);
                      setQty(1);
                    }}
                    title={disabled ? "Нет в наличии" : `Остаток: ${position.qty}`}
                  >
                    {position.size}
                  </button>
                );
              })}
            </div>
            <span className="label">
              {available.length > 0
                ? `В НАЛИЧИИ РАЗМЕРОВ: ${pad(available.length)} · ОСТАТОК НА СКЛАДЕ: ${product.totalQty}`
                : "НЕТ В НАЛИЧИИ"}
            </span>
          </div>

          <div className="col gap-6">
            <span className="label">КОЛИЧЕСТВО</span>
            <div className="row gap-10">
              <div className="qty">
                <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Меньше">
                  −
                </button>
                <span>{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(Math.min(limit || 1, qty + 1))}
                  aria-label="Больше"
                >
                  +
                </button>
              </div>
              <span className="label">
                {size ? `ДОСТУПНО ${limit} ШТ.` : "ВЫБЕРИТЕ РАЗМЕР"}
              </span>
            </div>
          </div>

          <div className="col">
            <Accordion
              title="ДЕТАЛИ"
              open={open === "details"}
              onToggle={() => setOpen(open === "details" ? null : "details")}
            >
              {product.description}
            </Accordion>
            <Accordion
              title="МАТЕРИАЛЫ"
              open={open === "materials"}
              onToggle={() => setOpen(open === "materials" ? null : "materials")}
            >
              {product.composition}
            </Accordion>
            <Accordion
              title="ДОСТАВКА И ОПЛАТА"
              open={open === "shipping"}
              onToggle={() => setOpen(open === "shipping" ? null : "shipping")}
            >
              Сборка заказа — 24 часа. Доставка по городу 1–2 дня, по стране 3–7 дней. Оплата при
              получении или картой. Все расчёты в рублях.
            </Accordion>
          </div>

          <div className="kv-list">
            <div className="kv">
              <span className="kv__k">АРТИКУЛ</span>
              <span className="mono">SW-{pad(product.id)}</span>
            </div>
            <div className="kv">
              <span className="kv__k">КАТЕГОРИЯ</span>
              <span>{product.category} / {product.subcategory}</span>
            </div>
            <div className="kv">
              <span className="kv__k">ПРОИЗВОДСТВО</span>
              <span>{product.manufacturer}</span>
            </div>
            <div className="kv">
              <span className="kv__k">РАЗМЕРНЫЙ РЯД</span>
              <span>{product.sizeRange}</span>
            </div>
            {data?.drop ? (
              <div className="kv">
                <span className="kv__k">ДРОП</span>
                <Link to={`/drops/${data.drop.slug}`} className="link-underline">
                  {data.drop.title} ↗
                </Link>
              </div>
            ) : null}
          </div>

          <div className="credits">
            <span className="label">3D-МОДЕЛЬ</span>
            <a href={product.model3d.url} target="_blank" rel="noreferrer noopener" className="small link-underline">
              {product.model3d.author} ↗
            </a>
            <span className="small muted">{product.model3d.license} · Sketchfab</span>
          </div>
        </div>

        <div className="col gap-16">
          <ModelViewer product={product} />
          <div className="row row--between">
            <span className="label">ИЗОБРАЖЕНИЕ / 3D-ВЬЮЕР · ВРАЩЕНИЕ МЫШЬЮ</span>
            <span className="label">360°</span>
          </div>
          <p className="small muted" style={{ margin: 0, lineHeight: 1.6, maxWidth: 460 }}>
            {product.manufacturer} {product.name} — вращаемая копия модели. Осмотрите подошву,
            боковую панель и пятку, прежде чем выбрать размер.
          </p>
        </div>
      </div>

      <div className="action-bar">
        <button
          type="button"
          className="action action--primary"
          disabled={!size || available.length === 0 || !user}
          onClick={() => {
            if (!size) return;
            addToCart(product, size, qty);
            notify(`${product.name}, размер ${size} — в корзине`);
          }}
        >
          <span>
            {!user
              ? "ВОЙДИТЕ, ЧТОБЫ ЗАКАЗАТЬ"
              : available.length === 0
                ? "НЕТ В НАЛИЧИИ"
                : `ДОБАВИТЬ В КОРЗИНУ — ${formatPrice(product.price * qty)}`}
          </span>
          <span className="action__go">↗</span>
        </button>
        {user ? null : (
          <Link to="/login" className="action">
            ВОЙТИ <span className="dim">↗</span>
          </Link>
        )}
      </div>

      <section className="section" style={{ paddingBottom: 40 }}>
        <div className="section__head">
          <span className="label">ИЗ ЭТОГО ЖЕ ИНДЕКСА</span>
          <span className="label">05 МОДЕЛЕЙ</span>
        </div>
        <div className="index-grid">
          {related.map((item) => (
            <ProductCell key={item.slug} product={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
