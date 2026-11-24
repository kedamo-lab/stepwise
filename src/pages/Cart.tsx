import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../lib/app-context";
import { api, formatPrice, pad } from "../lib/api";
import { useFetch } from "../lib/use-fetch";
import type { Order, Product } from "../lib/types";

export function CartPage() {
  const { user, cart, cartTotal, setQty, removeLine, clearCart, notify } = useApp();
  const navigate = useNavigate();
  const catalog = useFetch<{ items: Product[] }>("/catalog");
  const [fio, setFio] = useState(user?.fio ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Order | null>(null);

  const products = catalog.data?.items ?? [];
  const limitFor = (slug: string, size: string) =>
    products.find((p) => p.slug === slug)?.sizes.find((s) => s.size === size)?.qty ?? 0;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<{ order: Order }>("/orders", {
        method: "POST",
        body: {
          clientFio: fio,
          items: cart.map((l) => ({ slug: l.slug, size: l.size, qty: l.qty })),
        },
      });
      setPlaced(res.order);
      clearCart();
      notify(`Заказ ${res.order.id} принят`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось оформить заказ");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="login">
          <span className="label">ОФОРМЛЕНИЕ ЗАКАЗА</span>
          <h1 className="h1">НУЖЕН ВХОД</h1>
          <p className="small muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Заказ может оформить только авторизованный пользователь. Вход выполняется по логину из
            списка пользователей системы — без пароля.
          </p>
          <Link to="/login" className="chip chip--ink" style={{ alignSelf: "flex-start" }}>
            ВОЙТИ <span>↗</span>
          </Link>
        </div>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="page">
        <div className="login" style={{ maxWidth: 640 }}>
          <span className="label">ЗАКАЗ ПРИНЯТ</span>
          <h1 className="h1">{placed.id}</h1>
          <div className="kv-list">
            <div className="kv">
              <span className="kv__k">ДАТА</span>
              <span className="mono">{new Date(placed.date).toLocaleString("ru-RU")}</span>
            </div>
            <div className="kv">
              <span className="kv__k">КЛИЕНТ</span>
              <span>{placed.clientFio}</span>
            </div>
            <div className="kv">
              <span className="kv__k">ПОЗИЦИЙ</span>
              <span className="mono">{pad(placed.items.length)}</span>
            </div>
            <div className="kv">
              <span className="kv__k">ЕДИНИЦ</span>
              <span className="mono">{placed.units}</span>
            </div>
            <div className="kv">
              <span className="kv__k">ИТОГО</span>
              <span className="mono">{formatPrice(placed.total)}</span>
            </div>
          </div>

          {placed.items.map((item) => (
            <div className="kv" key={`${item.slug}-${item.size}`}>
              <span className="kv__k">
                {item.manufacturer} {item.name} / {item.size}
              </span>
              <span className="mono">
                {item.qty} × {formatPrice(item.unitPrice)}
              </span>
            </div>
          ))}

          <div className="row gap-6">
            <Link to="/index/products" className="chip chip--ink">
              ВЕРНУТЬСЯ В КАТАЛОГ <span>↗</span>
            </Link>
            <Link to="/account" className="chip chip--ghost">
              ЛИЧНЫЙ КАБИНЕТ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="index-head">
        <div className="row row--between">
          <span className="label">КОРЗИНА / ОФОРМЛЕНИЕ</span>
          <span className="label">{pad(cart.length)} ПОЗИЦИЙ</span>
        </div>
        <div className="index-title">
          <h1 className="h1">ЗАКАЗ</h1>
          <span className="label">ВСЕ РАСЧЁТЫ В РУБЛЯХ</span>
        </div>
      </section>

      {cart.length === 0 ? (
        <div className="empty">
          <div className="col gap-16" style={{ alignItems: "center" }}>
            <span>КОРЗИНА ПУСТА</span>
            <Link to="/index/products" className="chip chip--ink">
              В КАТАЛОГ <span>↗</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="checkout">
          <div className="checkout__list">
            <div className="row row--between" style={{ paddingBottom: 8 }}>
              <span className="label">ТОВАРНЫЕ ПОЗИЦИИ</span>
              <button type="button" className="small dim link-underline" onClick={clearCart}>
                ОЧИСТИТЬ
              </button>
            </div>
            {cart.map((line) => {
              const limit = limitFor(line.slug, line.size);
              return (
                <div className="checkout__row" key={`${line.slug}-${line.size}`}>
                  <div className="checkout__media">
                    <img src={line.image} alt={line.name} />
                  </div>
                  <div className="col gap-6">
                    <span className="num">{line.number}</span>
                    <Link to={`/products/${line.slug}`} className="link-underline">
                      {line.manufacturer} {line.name}
                    </Link>
                    <span className="small muted">РАЗМЕР {line.size}</span>
                    <span className="small muted">
                      {limit > 0 ? `ДОСТУПНО НА СКЛАДЕ: ${limit}` : "ОСТАТОК ИСЧЕРПАН"}
                    </span>
                  </div>
                  <div className="qty">
                    <button
                      type="button"
                      onClick={() => setQty(line.slug, line.size, line.qty - 1)}
                      aria-label="Меньше"
                    >
                      −
                    </button>
                    <span>{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(line.slug, line.size, Math.min(limit || 1, line.qty + 1))}
                      aria-label="Больше"
                    >
                      +
                    </button>
                  </div>
                  <div className="col gap-6 right">
                    <span className="mono">{formatPrice(line.qty * line.price)}</span>
                    <button
                      type="button"
                      className="small dim link-underline"
                      onClick={() => removeLine(line.slug, line.size)}
                    >
                      УБРАТЬ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="checkout__side">
            <span className="label">ДАННЫЕ КЛИЕНТА</span>
            <label className="field field--block">
              <span className="label">ФИО</span>
              <input
                value={fio}
                onChange={(e) => setFio(e.target.value)}
                placeholder="ФАМИЛИЯ ИМЯ ОТЧЕСТВО"
              />
            </label>
            <div className="kv">
              <span className="kv__k">ЛОГИН</span>
              <span className="mono">{user.login}</span>
            </div>
            <div className="kv">
              <span className="kv__k">ПОЗИЦИЙ</span>
              <span className="mono">{pad(cart.length)}</span>
            </div>
            <div className="kv">
              <span className="kv__k">ИТОГО</span>
              <span className="mono">{formatPrice(cartTotal)}</span>
            </div>

            {error ? <p className="small" style={{ color: "var(--accent)", margin: 0 }}>{error}</p> : null}

            <button
              type="button"
              className="action action--primary"
              style={{ position: "static" }}
              disabled={submitting}
              onClick={submit}
            >
              <span>{submitting ? "ОТПРАВКА…" : "ПОДТВЕРДИТЬ ЗАКАЗ"}</span>
              <span className="action__go">↗</span>
            </button>

            <button
              type="button"
              className="chip chip--ghost"
              onClick={() => navigate("/index/products")}
            >
              ПРОДОЛЖИТЬ ВЫБОР
            </button>

            <p className="small dim" style={{ margin: 0, lineHeight: 1.6 }}>
              Оформляя заказ, вы подтверждаете корректность ФИО. Менеджер свяжется для
              подтверждения состава и доставки.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
