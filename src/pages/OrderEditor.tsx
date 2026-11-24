import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../lib/app-context";
import { api, formatDate, formatPrice, pad, statusLabel } from "../lib/api";
import { useFetch } from "../lib/use-fetch";
import type { Order, Product } from "../lib/types";

export function OrderPage() {
  const { id } = useParams();
  const { user, notify } = useApp();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch<{ order: Order }>(
    user && id ? `/orders/${id}` : null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const order = data?.order ?? null;
  const allowed = user && (user.role === "manager" || user.role === "admin");

  if (!user || !allowed) {
    return (
      <div className="page">
        <div className="login">
          <span className="label">ЗАКАЗ</span>
          <h1 className="h1">НЕТ ДОСТУПА</h1>
          <Link to="/login" className="chip chip--ink" style={{ alignSelf: "flex-start" }}>
            ВОЙТИ <span>↗</span>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page empty">ЗАГРУЗКА ЗАКАЗА…</div>;
  if (error || !order) return <div className="page empty">{error || "Заказ не найден"}</div>;

  const remove = async () => {
    if (!window.confirm(`Удалить заказ ${order.id}?`)) return;
    setActionError(null);
    try {
      await api(`/orders/${order.id}`, { method: "DELETE" });
      notify(`Заказ ${order.id} удалён`);
      navigate("/orders", { replace: true });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Не удалось удалить заказ");
    }
  };

  return (
    <div className="page">
      <div className="row row--between" style={{ paddingTop: 96 }}>
        <Link to="/orders" className="small link-underline">
          ← ВСЕ ЗАКАЗЫ
        </Link>
        <span className="label">ЗАКАЗ / {order.id}</span>
      </div>

      <div className="order-head">
        <div className="col gap-6">
          <span className="label">ДАТА {formatDate(order.date)}</span>
          <h1 className="h1">{order.id}</h1>
          <span className="small muted">
            {order.clientFio} · создан {order.createdBy || "—"}
          </span>
        </div>
        <div className="col gap-6" style={{ alignItems: "flex-end" }}>
          <span className={`status status--${order.status}`}>{statusLabel[order.status]}</span>
          <span className="mono small">
            {pad(order.items.length)} ПОЗИЦИИ / {order.units} ЕД.
          </span>
          <span className="mono">{formatPrice(order.total)}</span>
        </div>
      </div>

      {actionError ? <p className="small" style={{ color: "var(--accent)" }}>{actionError}</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th>№</th>
            <th>МОДЕЛЬ</th>
            <th>РАЗМЕР</th>
            <th>КОЛ-ВО</th>
            <th>ЦЕНА ЗА ЕД.</th>
            <th>СУММА</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={`${item.slug}-${item.size}`}>
              <td className="num">{pad(index + 1)}</td>
              <td>
                <Link to={`/products/${item.slug}`} className="link-underline">
                  {item.manufacturer} {item.name}
                </Link>
              </td>
              <td className="mono">{item.size}</td>
              <td className="mono">{item.qty}</td>
              <td className="mono">{formatPrice(item.unitPrice)}</td>
              <td className="mono">{formatPrice(item.qty * item.unitPrice)}</td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row row--between mt-24" style={{ paddingBottom: 60 }}>
        <div className="row gap-6">
          <Link to={`/orders/${order.id}/edit`} className="chip chip--ink">
            ИЗМЕНИТЬ ЗАКАЗ <span>↗</span>
          </Link>
          <button type="button" className="chip chip--ghost" onClick={() => void remove()}>
            УДАЛИТЬ ЗАКАЗ
          </button>
        </div>
        <button type="button" className="chip chip--hover" onClick={reload}>
          ОБНОВИТЬ ↻
        </button>
      </div>
    </div>
  );
}

export function OrderEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user, notify } = useApp();
  const navigate = useNavigate();
  const catalog = useFetch<{ items: Product[] }>("/catalog");
  const existing = useFetch<{ order: Order }>(editing && user ? `/orders/${id}` : null);

  const products = catalog.data?.items ?? [];
  const order = existing.data?.order ?? null;

  const [fio, setFio] = useState("");
  const [status, setStatus] = useState("new");
  const [lines, setLines] = useState<{ slug: string; size: string; qty: number }[]>([]);
  const [pick, setPick] = useState("");
  const [pickSize, setPickSize] = useState("");
  const [pickQty, setPickQty] = useState(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReady(false);
    setFio("");
    setStatus("new");
    setLines([]);
    setPick("");
    setPickSize("");
    setPickQty(1);
    setError(null);
  }, [id]);

  // инициализация формы после загрузки
  if (order && !ready) {
    setFio(order.clientFio);
    setStatus(order.status);
    setLines(order.items.map((i) => ({ slug: i.slug, size: i.size, qty: i.qty })));
    setReady(true);
  }

  const allowed = user && (user.role === "manager" || user.role === "admin");

  const pickProduct = products.find((p) => p.slug === pick) || null;
  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const product = products.find((p) => p.slug === line.slug);
        return sum + (product ? product.price * line.qty : 0);
      }, 0),
    [lines, products],
  );

  if (!allowed) {
    return (
      <div className="page">
        <div className="login">
          <span className="label">УПРАВЛЕНИЕ ЗАКАЗАМИ</span>
          <h1 className="h1">НЕТ ДОСТУПА</h1>
          <p className="small muted" style={{ margin: 0 }}>
            Управление заказами доступно менеджеру и администратору.
          </p>
          <Link to="/orders" className="chip chip--ghost" style={{ alignSelf: "flex-start" }}>
            К ЗАКАЗАМ
          </Link>
        </div>
      </div>
    );
  }

  const addLine = () => {
    const product = products.find((p) => p.slug === pick);
    if (!product || !pickSize) {
      setError("Выберите модель и размер");
      return;
    }
    setError(null);
    setLines((prev) => {
      const index = prev.findIndex((l) => l.slug === pick && l.size === pickSize);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], qty: next[index].qty + pickQty };
        return next;
      }
      return [...prev, { slug: pick, size: pickSize, qty: pickQty }];
    });
    setPickSize("");
    setPickQty(1);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing && order) {
        await api<{ order: Order }>(`/orders/${order.id}`, {
          method: "PATCH",
          body: { clientFio: fio, status, items: lines },
        });
        notify(`Заказ ${order.id} обновлён`);
        navigate(`/orders/${order.id}`);
      } else {
        const res = await api<{ order: Order }>("/orders", {
          method: "POST",
          body: { clientFio: fio, items: lines },
        });
        notify(`Заказ ${res.order.id} создан`);
        navigate(`/orders/${res.order.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить заказ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="row row--between" style={{ paddingTop: 96 }}>
        <Link to={editing && order ? `/orders/${order.id}` : "/orders"} className="small link-underline">
          ← {editing ? "К ЗАКАЗУ" : "ВСЕ ЗАКАЗЫ"}
        </Link>
        <span className="label">{editing ? "ИЗМЕНЕНИЕ ЗАКАЗА" : "НОВЫЙ ЗАКАЗ"}</span>
      </div>

      <section className="index-head" style={{ paddingTop: 24 }}>
        <div className="index-title">
          <h1 className="h1">{editing && order ? order.id : "НОВЫЙ"}</h1>
          <div className="row gap-6">
            {editing ? (
              <label className="field">
                <span className="label">СТАТУС</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="new">НОВЫЙ</option>
                  <option value="confirmed">ПОДТВЕРЖДЁН</option>
                  <option value="done">ВЫПОЛНЕН</option>
                </select>
              </label>
            ) : null}
            <span className="chip chip--ghost">ИТОГО {formatPrice(total)}</span>
          </div>
        </div>
      </section>

      <div className="checkout">
        <div className="checkout__list">
          <span className="label">ТОВАРНЫЕ ПОЗИЦИИ / {pad(lines.length)}</span>

          <div className="editor-add">
            <label className="field">
              <span className="label">МОДЕЛЬ</span>
              <select
                value={pick}
                onChange={(e) => {
                  setPick(e.target.value);
                  setPickSize("");
                }}
              >
                <option value="">ВЫБЕРИТЕ</option>
                {products.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.manufacturer} {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="label">РАЗМЕР</span>
              <select value={pickSize} onChange={(e) => setPickSize(e.target.value)}>
                <option value="">—</option>
                {(pickProduct?.sizes ?? []).map((s) => (
                  <option key={s.size} value={s.size} disabled={s.qty === 0}>
                    {s.size} ({s.qty})
                  </option>
                ))}
              </select>
            </label>

            <label className="field field--qty" style={{ minWidth: 110 }}>
              <span className="label">КОЛ-ВО</span>
              <input
                type="number"
                min={1}
                value={pickQty}
                onChange={(e) => setPickQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>

            <button type="button" className="chip chip--ink" onClick={addLine}>
              ДОБАВИТЬ <span>+</span>
            </button>
          </div>

          {lines.length === 0 ? (
            <div className="empty" style={{ padding: 40 }}>
              ПОЗИЦИЙ НЕТ
            </div>
          ) : (
            lines.map((line, index) => {
              const product = products.find((p) => p.slug === line.slug);
              return (
                <div className="checkout__row" key={`${line.slug}-${line.size}`}>
                  <div className="checkout__media">
                    {product ? <img src={product.image} alt={product.name} /> : null}
                  </div>
                  <div className="col gap-6">
                    <span className="small">
                      {product ? `${product.manufacturer} ${product.name}` : line.slug}
                    </span>
                    <span className="small muted">РАЗМЕР {line.size}</span>
                  </div>
                  <div className="qty">
                    <button
                      type="button"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === index ? { ...l, qty: Math.max(1, l.qty - 1) } : l)),
                        )
                      }
                      aria-label="Меньше"
                    >
                      −
                    </button>
                    <span>{line.qty}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setLines((prev) => prev.map((l, i) => (i === index ? { ...l, qty: l.qty + 1 } : l)))
                      }
                      aria-label="Больше"
                    >
                      +
                    </button>
                  </div>
                  <div className="col gap-6 right">
                    <span className="mono small">{formatPrice((product?.price ?? 0) * line.qty)}</span>
                    <button
                      type="button"
                      className="small dim link-underline"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                    >
                      УБРАТЬ
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <aside className="checkout__side">
          <span className="label">КЛИЕНТ</span>
          <label className="field field--block">
            <span className="label">ФИО</span>
            <input value={fio} onChange={(e) => setFio(e.target.value)} placeholder="ФАМИЛИЯ ИМЯ ОТЧЕСТВО" />
          </label>
          <div className="kv">
            <span className="kv__k">ПОЗИЦИЙ</span>
            <span className="mono">{pad(lines.length)}</span>
          </div>
          <div className="kv">
            <span className="kv__k">ЕДИНИЦ</span>
            <span className="mono">{lines.reduce((s, l) => s + l.qty, 0)}</span>
          </div>
          <div className="kv">
            <span className="kv__k">ИТОГО</span>
            <span className="mono">{formatPrice(total)}</span>
          </div>

          {error ? <p className="small" style={{ color: "var(--accent)", margin: 0 }}>{error}</p> : null}

          <button
            type="button"
            className="action action--primary"
            style={{ position: "static" }}
            disabled={busy || lines.length === 0}
            onClick={() => void submit()}
          >
            <span>{busy ? "СОХРАНЕНИЕ…" : editing ? "СОХРАНИТЬ ИЗМЕНЕНИЯ" : "СОЗДАТЬ ЗАКАЗ"}</span>
            <span className="action__go">↗</span>
          </button>
          <Link to={editing && order ? `/orders/${order.id}` : "/orders"} className="chip chip--ghost">
            ОТМЕНА
          </Link>
        </aside>
      </div>
    </div>
  );
}
