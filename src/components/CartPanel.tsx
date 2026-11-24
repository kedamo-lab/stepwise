import { Link } from "react-router-dom";
import { useApp } from "../lib/app-context";
import { formatPrice } from "../lib/api";

export function CartPanel() {
  const { cart, cartOpen, setCartOpen, cartTotal, setQty, removeLine } = useApp();

  if (!cartOpen) return null;

  return (
    <div className="cart-panel fade-in" role="dialog" aria-label="Корзина">
      <div className="row row--between">
        <span className="chip__dot" />
        <span className="h5">КОРЗИНА / {String(cart.length).padStart(2, "0")} ПОЗИЦИЙ</span>
        <button type="button" className="small dim" onClick={() => setCartOpen(false)}>
          ЗАКРЫТЬ ✕
        </button>
      </div>

      {cart.length === 0 ? (
        <div className="col gap-10" style={{ padding: "18px 0" }}>
          <p className="muted small" style={{ margin: 0 }}>
            Пока пусто. Каждая модель вращается в 3D — выберите размер и добавьте в корзину.
          </p>
          <Link to="/index/products" className="chip chip--ghost" onClick={() => setCartOpen(false)}>
            ПЕРЕЙТИ В КАТАЛОГ <span className="dim">↗</span>
          </Link>
        </div>
      ) : (
        <>
          <div>
            {cart.map((line) => (
              <div className="cart-row" key={`${line.slug}-${line.size}`}>
                <img src={line.image} alt={line.name} />
                <div className="col gap-6">
                  <Link to={`/products/${line.slug}`} className="link-underline">
                    {line.manufacturer} {line.name}
                  </Link>
                  <span className="small muted">
                    РАЗМЕР {line.size} · {formatPrice(line.price)}
                  </span>
                  <div className="qty">
                    <button
                      type="button"
                      onClick={() => setQty(line.slug, line.size, line.qty - 1)}
                      aria-label="Уменьшить количество"
                    >
                      −
                    </button>
                    <span>{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(line.slug, line.size, line.qty + 1)}
                      aria-label="Увеличить количество"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="col gap-10" style={{ alignItems: "flex-end" }}>
                  <span className="mono small">{formatPrice(line.qty * line.price)}</span>
                  <button
                    type="button"
                    className="small dim link-underline"
                    onClick={() => removeLine(line.slug, line.size)}
                  >
                    УБРАТЬ
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="row row--between mt-8">
            <span className="label">ИТОГО</span>
            <span className="mono">{formatPrice(cartTotal)}</span>
          </div>

          <Link
            to="/cart"
            className="action action--primary"
            style={{ position: "static", minWidth: 0 }}
            onClick={() => setCartOpen(false)}
          >
            <span>ОФОРМИТЬ ЗАКАЗ</span>
            <span className="action__go">↗</span>
          </Link>
        </>
      )}
    </div>
  );
}
