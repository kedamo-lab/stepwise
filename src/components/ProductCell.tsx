import { Link } from "react-router-dom";
import type { Product } from "../lib/types";
import { formatPrice } from "../lib/api";

export function ProductCell({ product }: { product: Product }) {
  return (
    <Link to={`/products/${product.slug}`} className="cell">
      <div className="row row--between">
        <span className="num">{product.number}</span>
        <span className="num">{product.inStock ? `${product.totalQty} В НАЛИЧИИ` : "НЕТ В НАЛИЧИИ"}</span>
      </div>
      <div className="cell__media">
        <img src={product.image} alt={`${product.manufacturer} ${product.name}`} loading="lazy" />
      </div>
      <div className="cell__foot">
        <span className="cell__name">
          {product.manufacturer} {product.name}
        </span>
        <span className="mono">{formatPrice(product.price)}</span>
      </div>
    </Link>
  );
}
