// Статистика магазина: считается на сервере из заказов, склада и каталога.
// Все коэффициенты — прозрачные тарифы, они же показываются в интерфейсе.

export const TARIFFS = {
  logisticsPerOrder: 1200,
  logisticsPerUnit: 180,
  packagingPerOrder: 90,
  acquiringRate: 0.022,
};

const MONTHS = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"];
const DAY = 86_400_000;

export function costOf(product) {
  if (product && Number.isFinite(product.cost) && product.cost > 0) return product.cost;
  return Math.round(((product?.price || 0) * 46) / 100);
}

function monthBucket(date) {
  return date.getFullYear() * 12 + date.getMonth();
}

function timeline(orders) {
  if (orders.length === 0) return [];

  const first = new Date(orders[0].date);
  const last = new Date(orders[orders.length - 1].date);
  const days = Math.round((last - first) / DAY);

  const byMonth = days > 45;
  const buckets = new Map();
  const keyFor = (date) =>
    byMonth
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : date.toISOString().slice(0, 10);

  const labelFor = (date) =>
    byMonth
      ? `${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`
      : `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;

  const add = (date) => {
    const key = keyFor(date);
    if (!buckets.has(key)) {
      buckets.set(key, { key, label: labelFor(date), revenue: 0, units: 0, orders: 0 });
    }
    return buckets.get(key);
  };

  if (byMonth) {
    const from = monthBucket(first);
    const to = monthBucket(last);
    for (let m = from; m <= to; m += 1) {
      const date = new Date(Math.floor(m / 12), m % 12, 1);
      add(date);
    }
  } else {
    for (let t = new Date(first.getFullYear(), first.getMonth(), first.getDate()); t <= last; t = new Date(t.getTime() + DAY)) {
      add(t);
    }
  }

  for (const order of orders) {
    const bucket = add(new Date(order.date));
    bucket.revenue += order.total;
    bucket.units += order.units;
    bucket.orders += 1;
  }

  return [...buckets.values()];
}

export function buildStats(db) {
  const products = db.products || [];
  const orders = [...(db.orders || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const productBySlug = new Map(products.map((p) => [p.slug, p]));

  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const units = orders.reduce((sum, order) => sum + order.units, 0);
  const ordersCount = orders.length;

  const statuses = ["new", "confirmed", "done"].map((status) => {
    const list = orders.filter((order) => order.status === status);
    return {
      status,
      count: list.length,
      revenue: list.reduce((sum, order) => sum + order.total, 0),
      units: list.reduce((sum, order) => sum + order.units, 0),
    };
  });

  let importCost = 0;
  const byModel = new Map();
  const bySizeSold = new Map();

  for (const order of orders) {
    for (const item of order.items) {
      const product = productBySlug.get(item.slug);
      importCost += costOf(product || { price: item.unitPrice }) * item.qty;

      const model = byModel.get(item.slug) || {
        slug: item.slug,
        name: product ? product.name : item.name,
        manufacturer: product ? product.manufacturer : item.manufacturer,
        image: product ? product.image : "",
        units: 0,
        revenue: 0,
      };
      model.units += item.qty;
      model.revenue += item.qty * item.unitPrice;
      byModel.set(item.slug, model);

      const size = bySizeSold.get(String(item.size)) || { size: String(item.size), units: 0, revenue: 0 };
      size.units += item.qty;
      size.revenue += item.qty * item.unitPrice;
      bySizeSold.set(String(item.size), size);
    }
  }

  const logistics =
    ordersCount * TARIFFS.logisticsPerOrder + units * TARIFFS.logisticsPerUnit;
  const packaging = ordersCount * TARIFFS.packagingPerOrder;
  const acquiring = Math.round(revenue * TARIFFS.acquiringRate);
  const totalCosts = importCost + logistics + packaging + acquiring;
  const profit = revenue - totalCosts;

  // Склад
  let pairs = 0;
  let retail = 0;
  let stockCost = 0;
  let positions = 0;
  let emptySizes = 0;
  const lowStock = [];
  const byBrand = new Map();
  const bySize = new Map();

  for (const product of products) {
    const brand = byBrand.get(product.manufacturer) || {
      name: product.manufacturer,
      pairs: 0,
      retail: 0,
      models: 0,
    };
    brand.models += 1;

    for (const position of product.sizes || []) {
      positions += 1;
      if (position.qty <= 0) {
        emptySizes += 1;
        continue;
      }
      pairs += position.qty;
      retail += position.qty * product.price;
      stockCost += position.qty * costOf(product);
      brand.pairs += position.qty;
      brand.retail += position.qty * product.price;

      const size = bySize.get(String(position.size)) || { size: String(position.size), pairs: 0 };
      size.pairs += position.qty;
      bySize.set(String(position.size), size);

      if (position.qty <= 2) {
        lowStock.push({
          slug: product.slug,
          name: product.name,
          manufacturer: product.manufacturer,
          size: String(position.size),
          qty: position.qty,
        });
      }
    }

    byBrand.set(product.manufacturer, brand);
  }

  const top = [...byModel.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)
    .map((model) => ({
      ...model,
      share: revenue > 0 ? Math.round((model.revenue / revenue) * 100) : 0,
    }));

  const recent = [...orders]
    .reverse()
    .slice(0, 6)
    .map((order) => ({
      id: order.id,
      date: order.date,
      clientFio: order.clientFio,
      total: order.total,
      units: order.units,
      status: order.status,
    }));

  return {
    generatedAt: new Date().toISOString(),
    tariffs: TARIFFS,
    kpi: {
      revenue,
      orders: ordersCount,
      units,
      avgOrder: ordersCount ? Math.round(revenue / ordersCount) : 0,
      importCost,
      logistics,
      packaging,
      acquiring,
      costs: totalCosts,
      profit,
      margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    },
    statuses,
    timeline: timeline(orders),
    costs: [
      { key: "import", label: "Импорт и закупка", amount: importCost },
      { key: "logistics", label: "Логистика", amount: logistics },
      { key: "acquiring", label: "Эквайринг", amount: acquiring },
      { key: "packaging", label: "Упаковка", amount: packaging },
    ].map((row) => ({
      ...row,
      share: revenue > 0 ? Math.round((row.amount / revenue) * 100) : 0,
    })),
    top,
    sizesSold: [...bySizeSold.values()].sort((a, b) => Number(a.size) - Number(b.size)),
    stock: {
      pairs,
      retail,
      cost: stockCost,
      positions,
      emptySizes,
      models: products.length,
      low: lowStock.slice(0, 8),
      lowCount: lowStock.length,
      brands: [...byBrand.values()].sort((a, b) => b.retail - a.retail),
      sizes: [...bySize.values()].sort((a, b) => Number(a.size) - Number(b.size)),
    },
    catalog: {
      products: products.length,
      drops: (db.drops || []).length,
      stories: (db.stories || []).length,
      brands: new Set(products.map((p) => p.manufacturer)).size,
      priceMin: products.length ? Math.min(...products.map((p) => p.price)) : 0,
      priceMax: products.length ? Math.max(...products.map((p) => p.price)) : 0,
    },
    recent,
  };
}
