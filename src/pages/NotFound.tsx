import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="page">
      <div className="login">
        <span className="label">ОШИБКА 404</span>
        <h1 className="h1">СТРАНИЦА НЕ НАЙДЕНА</h1>
        <p className="small muted" style={{ margin: 0 }}>
          Такого адреса в индексе нет. Проверьте модель или вернитесь в каталог.
        </p>
        <div className="row gap-6">
          <Link to="/index/products" className="chip chip--ink">
            КАТАЛОГ <span>↗</span>
          </Link>
          <Link to="/" className="chip chip--ghost">
            НА ГЛАВНУЮ
          </Link>
        </div>
      </div>
    </div>
  );
}
