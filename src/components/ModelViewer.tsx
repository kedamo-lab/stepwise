import type { Product } from "../lib/types";

type Props = {
  product: Product;
  spin?: number;
  className?: string;
};

export function ModelViewer({ product, spin = 0.3, className }: Props) {
  const src =
    `https://sketchfab.com/models/${product.model3d.uid}/embed` +
    `?autospin=${spin}&autostart=1&transparent=1&ui_theme=light&ui_infos=0&dnt=1`;

  return (
    <div className={className ? `viewer ${className}` : "viewer"}>
      <iframe
        key={product.slug}
        title={`3D-модель ${product.manufacturer} ${product.name}`}
        src={src}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
      />

      <div className="viewer__badge">
        <span className="chip__dot" />
        3D / {product.model3d.author}
      </div>
      <div className="viewer__hint">ТЯНИТЕ → ВРАЩЕНИЕ</div>
    </div>
  );
}
