import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__chips">
        <div className="footer__group">
          <span className="chip">© 2027 STEPWISE</span>
          <span className="chip">
            <span className="chip__dot" />
            3D — SKETCHFAB / CC BY
          </span>
        </div>

        <div className="footer__group">
          <Link to="/pages/size-guide" className="chip chip--hover">
            РАЗМЕРЫ
          </Link>
          <Link to="/pages/shipping-policy" className="chip chip--hover">
            ДОСТАВКА
          </Link>
          <Link to="/pages/terms-of-service" className="chip chip--hover">
            УСЛОВИЯ
          </Link>
        </div>

        <div className="footer__group">
          <span className="chip chip--ghost">RU / ₽</span>
          <a
            href="https://sketchfab.com"
            target="_blank"
            rel="noreferrer noopener"
            className="chip chip--hover"
          >
            АТРИБУЦИЯ ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
