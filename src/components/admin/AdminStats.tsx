import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { formatDate, formatPrice, pad, statusLabel } from "../../lib/api";
import { useFetch } from "../../lib/use-fetch";
import type { Stats } from "../../lib/types";

/* ---------------------------- анимации чисел --------------------------- */

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

/** Включение анимаций ширины/высоты после монтирования. */
function useEntered(delay = 60) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);
  return entered;
}

const compact = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} МЛН`;
  if (value >= 1000) return `${Math.round(value / 100) / 10} ТЫС.`;
  return String(Math.round(value));
};

/* ------------------------------- карточки ------------------------------ */

function Card({
  title,
  note,
  index,
  wide,
  children,
}: {
  title: string;
  note?: ReactNode;
  index: number;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={"dash-card" + (wide ? " dash-card--wide" : "")}
      style={{ "--i": index } as CSSProperties}
    >
      <header className="dash-card__head">
        <span className="label">{title}</span>
        {note ? <span className="label">{note}</span> : null}
      </header>
      <div className="dash-card__body">{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  display,
  note,
  accent,
  index,
}: {
  label: string;
  value: number;
  display: (v: number) => string;
  note: ReactNode;
  accent?: boolean;
  index: number;
}) {
  const animated = useCountUp(value);
  return (
    <section
      className={"dash-kpi" + (accent ? " dash-kpi--accent" : "")}
      style={{ "--i": index } as CSSProperties}
    >
      <span className="label">{label}</span>
      <span className="dash-kpi__value">{display(animated)}</span>
      <span className="dash-kpi__note">{note}</span>
    </section>
  );
}

/* ------------------------------- графики ------------------------------- */

function Columns({ data }: { data: Stats["timeline"] }) {
  const entered = useEntered(120);
  const max = Math.max(...data.map((d) => d.revenue), 1);

  if (data.length === 0) {
    return <p className="dash-empty">ЗАКАЗОВ ПОКА НЕТ — ГРАФИК ПОЯВИТСЯ ПОСЛЕ ПЕРВОЙ ПРОДАЖИ</p>;
  }

  return (
    <div className="chart">
      <div className="chart__grid" aria-hidden="true">
        {[100, 75, 50, 25, 0].map((line) => (
          <span key={line} className="chart__grid-line" style={{ bottom: `${line}%` }} />
        ))}
      </div>
      <div className={"chart__cols" + (entered ? " is-in" : "")}>
        {data.map((bucket, i) => (
          <div className="chart__col" key={bucket.key} style={{ "--i": i } as CSSProperties}>
            <span className="chart__value">{bucket.revenue > 0 ? compact(bucket.revenue) : ""}</span>
            <span className="chart__track">
              {bucket.revenue > 0 ? (
                <span
                  className="chart__bar"
                  style={{ height: `${Math.max(2, (bucket.revenue / max) * 100)}%` }}
                  title={`${formatPrice(bucket.revenue)} · ${bucket.orders} заказов`}
                />
              ) : null}
            </span>
            <span className="chart__label">{bucket.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostBars({ costs }: { costs: Stats["costs"] }) {
  const entered = useEntered(160);
  const max = Math.max(...costs.map((c) => c.amount), 1);

  return (
    <div className="bars">
      {costs.map((cost, i) => (
        <div className="bars__row" key={cost.key} style={{ "--i": i } as CSSProperties}>
          <div className="bars__top">
            <span>{cost.label}</span>
            <span className="mono">{formatPrice(cost.amount)}</span>
          </div>
          <div className="bars__track">
            <span
              className={"bars__fill" + (cost.key === "import" ? " bars__fill--ink" : "")}
              style={{
                width: entered ? `${(cost.amount / max) * 100}%` : "0%",
                transitionDelay: `${i * 90}ms`,
              }}
            />
          </div>
          <span className="bars__share">{cost.share}% ВЫРУЧКИ</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ statuses, total }: { statuses: Stats["statuses"]; total: number }) {
  const entered = useEntered(180);
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const colors: Record<string, string> = {
    new: "var(--accent)",
    confirmed: "#1b7f3b",
    done: "#8f8f8f",
  };

  let offset = 0;
  const segments = statuses.map((status) => {
    const length = total > 0 ? (status.count / total) * circumference : 0;
    const segment = { ...status, length, offset, color: colors[status.status] };
    offset += length;
    return segment;
  });

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" className="donut" role="img" aria-label="Статусы заказов">
        <circle cx="60" cy="60" r={radius} className="donut__track" />
        {segments.map((segment, i) => (
          <circle
            key={segment.status}
            cx="60"
            cy="60"
            r={radius}
            className="donut__seg"
            style={{ stroke: segment.color, transitionDelay: `${i * 120}ms` }}
            strokeDasharray={
              entered ? `${segment.length} ${circumference - segment.length}` : `0 ${circumference}`
            }
            strokeDashoffset={-segment.offset}
          />
        ))}
        <text x="60" y="57" className="donut__value">
          {pad(total)}
        </text>
        <text x="60" y="70" className="donut__caption">
          ЗАКАЗОВ
        </text>
      </svg>
      <ul className="donut__legend">
        {statuses.map((status) => (
          <li key={status.status}>
            <span className="status-dot" style={{ background: colors[status.status] }} />
            <span>{statusLabel[status.status]}</span>
            <span className="mono">{pad(status.count)}</span>
            <span className="mono muted">{formatPrice(status.revenue)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopModels({ models, revenue }: { models: Stats["top"]; revenue: number }) {
  const entered = useEntered(200);
  if (models.length === 0) return <p className="dash-empty">ПРОДАЖ ЕЩЁ НЕ БЫЛО</p>;
  const max = Math.max(...models.map((m) => m.revenue), 1);

  return (
    <ul className="top-list">
      {models.map((model, i) => (
        <li key={model.slug} style={{ "--i": i } as CSSProperties}>
          <span className="top-list__num">{pad(i + 1)}</span>
          <span className="top-list__name">
            {model.name}
            <span className="label">{model.manufacturer}</span>
          </span>
          <span className="top-list__units mono">{model.units} ПАР</span>
          <span className="top-list__sum mono">{formatPrice(model.revenue)}</span>
          <span className="top-list__track">
            <span
              className="top-list__fill"
              style={{ width: entered ? `${(model.revenue / max) * 100}%` : "0%", transitionDelay: `${i * 80}ms` }}
            />
          </span>
          <span className="top-list__share mono">{Math.round((model.revenue / (revenue || 1)) * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

function Brands({ brands, total }: { brands: Stats["stock"]["brands"]; total: number }) {
  const entered = useEntered(240);

  return (
    <ul className="brand-list">
      {brands.map((brand, i) => (
        <li key={brand.name} style={{ "--i": i } as CSSProperties}>
          <span className="brand-list__name">{brand.name}</span>
          <span className="brand-list__track">
            <span
              className="brand-list__fill"
              style={{
                width: entered ? `${(brand.retail / (total || 1)) * 100}%` : "0%",
                transitionDelay: `${i * 55}ms`,
              }}
            />
          </span>
          <span className="brand-list__value mono">{formatPrice(brand.retail)}</span>
          <span className="brand-list__pairs mono">{brand.pairs} ПАР</span>
        </li>
      ))}
    </ul>
  );
}

function SizeColumns({ sizes }: { sizes: Stats["stock"]["sizes"] }) {
  const entered = useEntered(280);
  const max = Math.max(...sizes.map((s) => s.pairs), 1);
  if (sizes.length === 0) return <p className="dash-empty">СКЛАД ПУСТ</p>;

  return (
    <div className="size-chart">
      {sizes.map((size, i) => (
        <div className="size-chart__col" key={size.size} style={{ "--i": i } as CSSProperties}>
          <span className="size-chart__value mono">{size.pairs}</span>
          <span className="size-chart__track">
            <span
              className="size-chart__bar"
              style={{ height: entered ? `${(size.pairs / max) * 100}%` : "0%", transitionDelay: `${i * 50}ms` }}
            />
          </span>
          <span className="size-chart__size mono">{size.size}</span>
        </div>
      ))}
    </div>
  );
}

function Profit({ kpi }: { kpi: Stats["kpi"] }) {
  const entered = useEntered(220);
  const total = Math.max(kpi.revenue, 1);
  const slices = [
    { key: "import", label: "Импорт", value: kpi.importCost, color: "#0a0a0a" },
    { key: "logistics", label: "Логистика", value: kpi.logistics, color: "#4a4a4a" },
    { key: "acquiring", label: "Эквайринг", value: kpi.acquiring, color: "#8a8a8a" },
    { key: "packaging", label: "Упаковка", value: kpi.packaging, color: "#b2b2b2" },
    { key: "profit", label: "Прибыль", value: Math.max(0, kpi.profit), color: "var(--accent)" },
  ];

  return (
    <div className="profit">
      <div className="profit__bar">
        {slices.map((slice, i) => (
          <span
            key={slice.key}
            className="profit__slice"
            style={{
              width: entered ? `${(slice.value / total) * 100}%` : "0%",
              background: slice.color,
              transitionDelay: `${i * 70}ms`,
            }}
            title={`${slice.label}: ${formatPrice(slice.value)}`}
          />
        ))}
      </div>
      <div className="profit__legend">
        {slices.map((slice) => (
          <span key={slice.key} className="profit__item">
            <span className="status-dot" style={{ background: slice.color }} />
            {slice.label}
            <span className="mono">{formatPrice(slice.value)}</span>
          </span>
        ))}
      </div>
      <div className="profit__foot">
        <span className="label">МАРЖА</span>
        <span className="profit__margin">{kpi.margin}%</span>
        <span className="label">ПРИБЫЛЬ {formatPrice(kpi.profit)}</span>
      </div>
    </div>
  );
}

function Stock({ stock }: { stock: Stats["stock"] }) {
  return (
    <div className="stock">
      <div className="stock__grid">
        <div>
          <span className="label">ПАР НА СКЛАДЕ</span>
          <span className="stock__value">{stock.pairs}</span>
        </div>
        <div>
          <span className="label">В РОЗНИЦЕ</span>
          <span className="stock__value">{compact(stock.retail)} ₽</span>
        </div>
        <div>
          <span className="label">ПО ЗАКУПКЕ</span>
          <span className="stock__value">{compact(stock.cost)} ₽</span>
        </div>
        <div>
          <span className="label">ПОЗИЦИЙ / ПУСТЫХ</span>
          <span className="stock__value">
            {stock.positions} / {stock.emptySizes}
          </span>
        </div>
      </div>
      <div className="stock__low">
        <span className="label">
          НИЗКИЙ ОСТАТОК · {stock.lowCount} ПОЗИЦИЙ (≤ 2 ПАР)
        </span>
        {stock.low.length === 0 ? (
          <span className="small muted">Все позиции в наличии с запасом.</span>
        ) : (
          <ul>
            {stock.low.map((row) => (
              <li key={`${row.slug}-${row.size}`}>
                <span>
                  {row.name} · {row.size}
                </span>
                <span className="mono">{row.qty} ШТ.</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Recent({ items }: { items: Stats["recent"] }) {
  if (items.length === 0) return <p className="dash-empty">ЗАКАЗОВ ПОКА НЕТ</p>;
  return (
    <ul className="recent">
      {items.map((order, i) => (
        <li key={order.id} style={{ "--i": i } as CSSProperties}>
          <span className="mono">{order.id}</span>
          <span className="mono muted">{formatDate(order.date)}</span>
          <span className="recent__client">{order.clientFio}</span>
          <span className={`status status--${order.status}`}>{statusLabel[order.status]}</span>
          <span className="mono">{formatPrice(order.total)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------ страница ------------------------------- */

export function AdminStats() {
  const { data, loading, error, reload } = useFetch<Stats>("/stats");
  const [stamp, setStamp] = useState("");

  useEffect(() => {
    if (data) {
      setStamp(
        new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(
          new Date(data.generatedAt),
        ),
      );
    }
  }, [data]);

  const kpi = data?.kpi;

  if (loading) {
    return (
      <div className="dash dash--loading">
        <div className="skeleton skeleton--title" />
        <div className="dash__kpi">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="skeleton skeleton--kpi" key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
        <div className="dash__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skeleton skeleton--card" key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || !kpi) {
    return (
      <div className="dash">
        <p className="dash-empty">{error || "Статистика недоступна"}</p>
      </div>
    );
  }

  return (
    <div className="dash">
      <header className="dash__head">
        <div>
          <span className="label">СТАТИСТИКА / ОНЛАЙН-МАГАЗИН</span>
          <h1 className="h1">
            ПУЛЬС
            <br />
            МАГАЗИНА
          </h1>
        </div>
        <div className="row gap-6">
          <span className="chip chip--ghost">ОБНОВЛЕНО {stamp}</span>
          <button type="button" className="chip chip--hover" onClick={reload}>
            ОБНОВИТЬ <span aria-hidden="true">↻</span>
          </button>
        </div>
      </header>

      <div className="dash__kpi">
        <Kpi
          index={0}
          label="ВЫРУЧКА"
          value={kpi.revenue}
          display={(v) => formatPrice(Math.round(v))}
          note={`${kpi.orders} ЗАКАЗОВ · ${kpi.units} ПАР`}
          accent
        />
        <Kpi
          index={1}
          label="СРЕДНИЙ ЧЕК"
          value={kpi.avgOrder}
          display={(v) => formatPrice(Math.round(v))}
          note={`ВЫРУЧКА ${compact(kpi.revenue)} ₽`}
        />
        <Kpi
          index={2}
          label="ПРИБЫЛЬ"
          value={kpi.profit}
          display={(v) => formatPrice(Math.round(v))}
          note={`МАРЖА ${kpi.margin}% · РАСХОДЫ ${compact(kpi.costs)} ₽`}
        />
        <Kpi
          index={3}
          label="СКЛАД"
          value={data.stock.retail}
          display={(v) => formatPrice(Math.round(v))}
          note={`${data.stock.pairs} ПАР · ${data.stock.positions} ПОЗИЦИЙ`}
        />
      </div>

      <div className="dash__grid">
        <Card
          index={4}
          wide
          title="ДИНАМИКА ВЫРУЧКИ"
          note={`${data.timeline.length} ПЕРИОДА · ДО ${formatPrice(Math.max(...data.timeline.map((t) => t.revenue), 0))}`}
        >
          <Columns data={data.timeline} />
        </Card>

        <Card index={5} title="СТРУКТУРА РАСХОДОВ" note={`ВСЕГО ${formatPrice(kpi.costs)}`}>
          <CostBars costs={data.costs} />
          <p className="dash-note">
            Логистика — {formatPrice(data.tariffs.logisticsPerOrder)} / заказ +{" "}
            {formatPrice(data.tariffs.logisticsPerUnit)} / пара, упаковка —{" "}
            {formatPrice(data.tariffs.packagingPerOrder)} / заказ, эквайринг —{" "}
            {Math.round(data.tariffs.acquiringRate * 1000) / 10}% выручки.
          </p>
        </Card>

        <Card index={6} title="СТАТУСЫ ЗАКАЗОВ" note={`${pad(kpi.orders)} ВСЕГО`}>
          <Donut statuses={data.statuses} total={kpi.orders} />
        </Card>

        <Card index={7} title="ТОП МОДЕЛЕЙ" note="ПО ВЫРУЧКЕ">
          <TopModels models={data.top} revenue={kpi.revenue} />
        </Card>

        <Card index={8} title="ПРИБЫЛЬ И РАСХОДЫ" note={`${kpi.margin}% МАРЖА`}>
          <Profit kpi={kpi} />
        </Card>

        <Card index={9} title="БРЕНДЫ НА СКЛАДЕ" note={formatPrice(data.stock.retail)}>
          <Brands brands={data.stock.brands} total={data.stock.retail} />
        </Card>

        <Card index={10} title="РАЗМЕРЫ НА СКЛАДЕ" note={`${data.stock.sizes.length} РАЗМЕРОВ`}>
          <SizeColumns sizes={data.stock.sizes} />
        </Card>

        <Card index={11} title="СКЛАД И ОСТАТКИ" note={`${data.stock.models} МОДЕЛЕЙ`}>
          <Stock stock={data.stock} />
        </Card>

        <Card index={12} wide title="ПОСЛЕДНИЕ ЗАКАЗЫ" note={`${data.recent.length} ИЗ ${kpi.orders}`}>
          <Recent items={data.recent} />
        </Card>

        <Card index={13} title="КАТАЛОГ" note={`${data.catalog.brands} БРЕНДОВ`}>
          <ul className="catalog-stats">
            <li>
              <span className="label">МОДЕЛЕЙ</span>
              <span>{pad(data.catalog.products)}</span>
            </li>
            <li>
              <span className="label">ДРОПОВ</span>
              <span>{pad(data.catalog.drops)}</span>
            </li>
            <li>
              <span className="label">МАТЕРИАЛОВ</span>
              <span>{pad(data.catalog.stories)}</span>
            </li>
            <li>
              <span className="label">ЦЕНЫ</span>
              <span>
                {compact(data.catalog.priceMin)} — {compact(data.catalog.priceMax)} ₽
              </span>
            </li>
            <li>
              <span className="label">ПРОДАНО В РАЗМЕРАХ</span>
              <span>{data.sizesSold.map((s) => s.size).join(" · ") || "—"}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
