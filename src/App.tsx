import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { CartPanel } from "./components/CartPanel";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Scrollbar } from "./components/Scrollbar";
import { useApp } from "./lib/app-context";
import { Account } from "./pages/Account";
import { CartPage } from "./pages/Cart";
import { Catalog } from "./pages/Catalog";
import { DropPage } from "./pages/Drop";
import { Drops } from "./pages/Drops";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { OrderEditor, OrderPage } from "./pages/OrderEditor";
import { Orders } from "./pages/Orders";
import { ProductPage } from "./pages/Product";
import { Static } from "./pages/Static";
import { Stories } from "./pages/Stories";
import { StoryPage } from "./pages/Story";
import { NotFound } from "./pages/NotFound";

function RouteEffects() {
  const { pathname } = useLocation();
  const { setCartOpen } = useApp();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    setCartOpen(false);
  }, [pathname, setCartOpen]);

  return null;
}

function Toasts() {
  const { toasts } = useApp();
  return (
    <>
      {toasts.map((toast) => (
        <div className="toast fade-in" key={toast.id}>
          {toast.text}
        </div>
      ))}
    </>
  );
}

/** Разделы, которые открываются «окном» — новая страница опускается сверху. */
const PANEL_ROUTES = new Set(["/index/products", "/drops", "/stories"]);

export function App() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // «Оконный» переход: клик по вкладке помечает следующий маршрут,
  // а рендер забирает эту пометку. Так класс не зависит от того,
  // успел ли завершиться View Transition.
  const lastPath = useRef(pathname);
  const panelPending = useRef(false);
  const panelNav = useRef(false);
  if (lastPath.current !== pathname) {
    lastPath.current = pathname;
    panelNav.current = panelPending.current;
    panelPending.current = false;
  }

  // Перехватываем клики по вкладкам и оборачиваем переход в View Transition:
  // старая страница остаётся кадром позади, новая открывается сверху.
  useEffect(() => {
    if (typeof document.startViewTransition !== "function") return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || (anchor.target && anchor.target !== "_self")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!PANEL_ROUTES.has(url.pathname)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const to = url.pathname + url.search + url.hash;
      panelPending.current = true;

      const transition = document.startViewTransition(() => {
        flushSync(() => navigate(to));
      });

      transition.finished.finally(() => {
        panelPending.current = false;
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [navigate]);

  return (
    <div className="shell">
      <Header />
      <CartPanel />
      <Scrollbar />
      <RouteEffects />
      <main className="main">
        {/* Ключ по маршруту: каждый переход заново запускает появление сверху. */}
        <div
          className={panelNav.current ? "route-anim route-anim--panel" : "route-anim"}
          key={pathname}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/index/products" element={<Catalog />} />
            <Route path="/products/:slug" element={<ProductPage />} />
            <Route path="/drops" element={<Drops />} />
            <Route path="/drops/:slug" element={<DropPage />} />
            <Route path="/stories" element={<Stories />} />
            <Route path="/stories/:slug" element={<StoryPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/account" element={<Account />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<OrderEditor />} />
            <Route path="/orders/:id" element={<OrderPage />} />
            <Route path="/orders/:id/edit" element={<OrderEditor />} />
            <Route path="/pages/:slug" element={<Static />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      {/* На главной подвала нет — первый экран заканчивается манифестом. */}
      {pathname !== "/" && <Footer />}
      <Toasts />
    </div>
  );
}
