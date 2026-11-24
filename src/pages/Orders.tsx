import { useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AdminEditor } from "../components/admin/AdminEditor";
import { AdminStats } from "../components/admin/AdminStats";
import { useApp } from "../lib/app-context";
import { api, formatDate, formatPrice, pad, statusLabel } from "../lib/api";
import { useFetch } from "../lib/use-fetch";
import type { Order } from "../lib/types";

type AdminTab = "orders" | "stats" | "editor";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "orders", label: "ЗАКАЗЫ" },
  { id: "stats", label: "СТАТИСТИКА" },
  { id: "editor", label: "РЕДАКТОР" },
];

function AdminTabs({
  tab,
  onChange,
  editor,
}: {
  tab: AdminTab;
  onChange: (tab: AdminTab) => void;
  editor: boolean;
}) {
  const tabs = editor ? TABS : TABS.filter((item) => item.id !== "editor");
  return (
    <nav className="admin-tabs" role="tablist" aria-label="Админ-панель">
      {tabs.map((item, i) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          className={"admin-tab" + (tab === item.id ? " is-active" : "")}
          style={{ "--i": i } as CSSProperties}
          onClick={() => onChange(item.id)}
        >
          <span className="admin-tab__num mono">{pad(i + 1)}</span>
          <span className="admin-tab__label">{item.label}</span>
          <span className="admin-tab__mark" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}

export function Orders() {
  const { user, notify } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const orders = useFetch<{ items: Order[] }>(user ? "/orders" : null);
  const [error, setError] = useState<string | null>(null);

  const allowed = user && (user.role === "manager" || user.role === "admin");

  if (!user) {
    return (
      <div className="page">
        <div className="login">
          <span className="label">РАЗДЕЛ ЗАКАЗОВ</span>
          <h1 className="h1">НУЖЕН ВХОД</h1>
          <Link to="/login" className="chip chip--ink" style={{ alignSelf: "flex-start" }}>
            ВОЙТИ <span>↗</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="page">
        <div className="login">
          <span className="label">РАЗДЕЛ ЗАКАЗОВ</span>
          <h1 className="h1">НЕТ ДОСТУПА</h1>
          <p className="small muted" style={{ margin: 0 }}>
            Просмотр и управление заказами доступны менеджеру и администратору.
          </p>
          <Link to="/index/products" className="chip chip--ghost" style={{ alignSelf: "flex-start" }}>
            В КАТАЛОГ
          </Link>
        </div>
      </div>
    );
  }

  const items = orders.data?.items ?? [];
  const revenue = items.reduce((sum, o) => sum + o.total, 0);
  const isAdmin = user.role === "admin";
  const requested = params.get("tab");
  const tab: AdminTab =
    requested === "stats" || (isAdmin && requested === "editor") ? requested : "orders";

  const goTab = (next: AdminTab) => {
    const search = new URLSearchParams(params);
    if (next === "orders") search.delete("tab");
    else search.set("tab", next);
    setParams(search, { replace: true });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const remove = async (order: Order) => {
    if (!window.confirm(`Удалить заказ ${order.id}? Позиции вернутся на склад.`)) return;
    setError(null);
    try {
      await api(`/orders/${order.id}`, { method: "DELETE" });
      notify(`Заказ ${order.id} удалён`);
      orders.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить заказ");
    }
  };

  return (
    <div className="page admin-page">
      <AdminTabs tab={tab} onChange={goTab} editor={isAdmin} />

      {tab === "orders" ? (
        <>
          <section className="index-head">
            <div className="row row--between">
              <span className="label">ЗАКАЗЫ / {user.role === "admin" ? "АДМИНИСТРАТОР" : "МЕНЕДЖЕР"}</span>
              <span className="label">{pad(items.length)} ЗАКАЗОВ</span>
            </div>
            <div className="index-title">
              <h1 className="h1">ЗАКАЗЫ</h1>
              <div className="row gap-6">
                <span className="chip chip--ghost">СУММА {formatPrice(revenue)}</span>
                <Link to="/orders/new" className="chip chip--ink">
                  НОВЫЙ ЗАКАЗ <span>↗</span>
                </Link>
              </div>
            </div>
          </section>

          {error ? <p className="small" style={{ color: "var(--accent)" }}>{error}</p> : null}

          {orders.loading ? (
            <div className="empty">ЗАГРУЗКА ЗАКАЗОВ…</div>
          ) : items.length === 0 ? (
            <div className="empty">ЗАКАЗОВ ПОКА НЕТ</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>НОМЕР</th>
                    <th>ДАТА</th>
                    <th>КЛИЕНТ</th>
                    <th>ПОЗИЦИИ</th>
                    <th>ЕД.</th>
                    <th>СУММА</th>
                    <th>СТАТУС</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((order) => (
                    <tr key={order.id}>
                      <td className="mono">
                        <Link to={`/orders/${order.id}`} className="link-underline">
                          {order.id}
                        </Link>
                      </td>
                      <td className="mono">{formatDate(order.date)}</td>
                      <td>{order.clientFio}</td>
                      <td className="mono">{pad(order.items.length)}</td>
                      <td className="mono">{order.units}</td>
                      <td className="mono">{formatPrice(order.total)}</td>
                      <td>
                        <span className={`status status--${order.status}`}>{statusLabel[order.status]}</span>
                      </td>
                      <td>
                        <div className="row gap-6" style={{ justifyContent: "flex-end" }}>
                          <Link to={`/orders/${order.id}`} className="small link-underline">
                            СОСТАВ
                          </Link>
                          <button
                            type="button"
                            className="small link-underline"
                            onClick={() => navigate(`/orders/${order.id}/edit`)}
                          >
                            ИЗМЕНИТЬ
                          </button>
                          <button
                            type="button"
                            className="small dim link-underline"
                            onClick={() => void remove(order)}
                          >
                            УДАЛИТЬ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="admin-view" key={tab}>
          {tab === "stats" ? <AdminStats /> : <AdminEditor />}
        </div>
      )}
    </div>
  );
}
