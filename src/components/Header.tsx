import { Link, NavLink, useLocation } from "react-router-dom";
import { useApp } from "../lib/app-context";
import { pad } from "../lib/api";
import { useFetch } from "../lib/use-fetch";

type Overview = {
  products: number;
  drops: number;
  stories: number;
};

export function Header() {
  const { user, cartCount, cartOpen, setCartOpen } = useApp();
  const overview = useFetch<Overview>("/overview");
  const { pathname } = useLocation();
  const staff = user && (user.role === "manager" || user.role === "admin");
  // На самой странице заказов ссылка в шапке не нужна: там уже есть вкладки.
  const showStaffLink = staff && pathname !== "/orders";

  return (
    <header className="header">
      <div className="header__panel">
        <div className="header__row header__row--brand">
          <Link to="/" className="brand" aria-label="Stepwise — на главную">
            <svg className="brand__mark" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M0 10 L4 10 L4 14 L0 14 Z" fill="currentColor" />
              <path d="M5 5 L9 5 L9 14 L5 14 Z" fill="currentColor" />
              <path d="M10 0 L14 0 L14 14 L10 14 Z" fill="currentColor" />
            </svg>
            <span>STEPWISE</span>
          </Link>
          {user ? (
            <Link to="/account" className="header__account">
              {user.login}
              <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <Link to="/login" className="header__account">
              ВОЙТИ
              <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>

        <div className="header__row header__row--menu">
          <nav className="header__nav">
            <NavLink to="/index/products">
              КАТАЛОГ <span>{pad(overview.data?.products ?? 0)}</span>
            </NavLink>
            <NavLink to="/drops">
              ДРОПЫ <span>{pad(overview.data?.drops ?? 0)}</span>
            </NavLink>
            <NavLink to="/stories">
              ЖУРНАЛ <span>{pad(overview.data?.stories ?? 0)}</span>
            </NavLink>
          </nav>

          <button
            type="button"
            className={cartOpen ? "header__cart is-open" : "header__cart"}
            onClick={() => setCartOpen(!cartOpen)}
            aria-expanded={cartOpen}
          >
            КОРЗИНА <span>{pad(cartCount)}</span>
          </button>
        </div>
      </div>

      <div className="header__aside">
        {showStaffLink ? (
          <Link to="/orders" className="header__aside-chip header__aside-chip--panel">
            ПАНЕЛЬ <span aria-hidden="true">↗</span>
          </Link>
        ) : null}
        <Link to="/index/products" className="header__aside-chip header__aside-chip--index">
          <span>КОЛЛЕКЦИЯ 01 / 01</span>
          <span className="header__grid" aria-hidden="true">
            <img src="/models/running-shoes.png" alt="" width={24} height={24} />
          </span>
        </Link>
      </div>
    </header>
  );
}
