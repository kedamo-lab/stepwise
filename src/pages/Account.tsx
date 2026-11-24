import { Link } from "react-router-dom";
import { useApp } from "../lib/app-context";
import { api, formatPrice, roleLabel } from "../lib/api";

const capabilities: Record<string, string[]> = {
  user: [
    "Просмотр каталога с фильтрами, сортировкой и поиском",
    "Оформление заказов и изменение состава корзины",
  ],
  manager: [
    "Всё, что доступно клиенту",
    "Просмотр списка заказов и их состава",
    "Создание, изменение и удаление заказов",
    "Статистика магазина",
  ],
  admin: [
    "Всё, что доступно менеджеру",
    "Редактор каталога, дропов и журнала",
    "Сброс демонстрационных данных",
  ],
};

export function Account() {
  const { user, cart, cartTotal, logout, cartCount, notify } = useApp();

  const reset = async () => {
    if (!window.confirm("Сбросить демонстрационные данные: остатки, заказы, пользователей?")) return;
    try {
      await api("/reset", { method: "POST" });
      notify("Демонстрационные данные восстановлены");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Не удалось сбросить данные");
    }
  };

  if (!user) {
    return (
      <div className="page">
        <div className="login">
          <span className="label">ЛИЧНЫЙ КАБИНЕТ</span>
          <h1 className="h1">НУЖЕН ВХОД</h1>
          <Link to="/login" className="chip chip--ink" style={{ alignSelf: "flex-start" }}>
            ВОЙТИ <span>↗</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="index-head">
        <div className="row row--between">
          <span className="label">АККАУНТ / {roleLabel[user.role]}</span>
          <span className="label">СЕССИЯ АКТИВНА</span>
        </div>
        <div className="index-title">
          <h1 className="h1">{user.login}</h1>
          <div className="row gap-6">
            <Link to="/index/products" className="chip chip--hover">
              КАТАЛОГ
            </Link>
            {user.role !== "user" ? (
              <Link to="/orders" className="chip chip--ink">
                ЗАКАЗЫ <span>↗</span>
              </Link>
            ) : null}
            <button type="button" className="chip chip--ghost" onClick={logout}>
              ВЫЙТИ
            </button>
            {user.role === "admin" ? (
              <button type="button" className="chip chip--ghost" onClick={() => void reset()}>
                СБРОС ДАННЫХ
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="account">
        <div className="col gap-10">
          <div className="kv">
            <span className="kv__k">ФИО</span>
            <span>{user.fio}</span>
          </div>
          <div className="kv">
            <span className="kv__k">ЛОГИН</span>
            <span className="mono">{user.login}</span>
          </div>
          <div className="kv">
            <span className="kv__k">РОЛЬ</span>
            <span>{roleLabel[user.role]}</span>
          </div>
          <div className="kv">
            <span className="kv__k">КОРЗИНА</span>
            <span className="mono">
              {cartCount} ЕД. / {formatPrice(cartTotal)}
            </span>
          </div>

          <span className="label mt-16">ВОЗМОЖНОСТИ РОЛИ</span>
          <ul className="list">
            {(capabilities[user.role] ?? []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <aside className="checkout__side">
          <span className="label">КОРЗИНА / {cart.length} ПОЗИЦИЙ</span>
          {cart.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              Пусто. Выберите модель в каталоге — каждая доступна во вращении.
            </p>
          ) : (
            cart.map((line) => (
              <div className="kv" key={`${line.slug}-${line.size}`}>
                <span className="kv__k">
                  {line.manufacturer} {line.name} / {line.size}
                </span>
                <span className="mono">
                  {line.qty} × {formatPrice(line.price)}
                </span>
              </div>
            ))
          )}
          <Link to="/cart" className="action action--primary" style={{ position: "static" }}>
            <span>ОФОРМИТЬ ЗАКАЗ</span>
            <span className="action__go">↗</span>
          </Link>
          <p className="small dim" style={{ margin: 0, lineHeight: 1.6 }}>
            Вход выполнен по логину, пароль не используется. Данные сессии хранятся локально в
            браузере.
          </p>
        </aside>
      </div>
    </div>
  );
}
