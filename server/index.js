import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb, save, withTotals, resetDb } from "./store.js";
import { buildStats } from "./stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 5174);
const PROD = process.argv.includes("--prod");

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

const db = getDb();

/* ----------------------------- helpers ----------------------------- */

const norm = (v) => String(v ?? "").trim().toLowerCase();
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function userFrom(req) {
  const login = norm(req.header("x-login"));
  if (!login) return null;
  return db.users.find((u) => norm(u.login) === login) || null;
}

function requireRole(...roles) {
  return (req, res, next) => {
    const user = userFrom(req);
    if (!user) return res.status(401).json({ error: "Требуется вход в систему" });
    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ error: "Недостаточно прав для этого действия" });
    }
    req.user = user;
    next();
  };
}

function publicProduct(p) {
  const totalQty = p.sizes.reduce((s, x) => s + x.qty, 0);
  // Закупочная цена — внутренние данные, наружу (каталог, карточка) не отдаём.
  const { cost: _cost, ...rest } = p;
  return {
    ...rest,
    totalQty,
    inStock: totalQty > 0,
    availableSizes: p.sizes.filter((s) => s.qty > 0).map((s) => s.size),
  };
}

function decrementStock(items) {
  for (const item of items) {
    const product = db.products.find((p) => p.slug === item.slug);
    if (!product) throw new Error(`Модель ${item.slug} не найдена`);
    const position = product.sizes.find((s) => s.size === String(item.size));
    if (!position) throw new Error(`Размер ${item.size} недоступен для ${product.name}`);
    if (position.qty < item.qty) {
      throw new Error(`Недостаточно товара: ${product.name}, размер ${item.size} (остаток ${position.qty})`);
    }
    position.qty -= item.qty;
  }
}

function restoreStock(items) {
  for (const item of items) {
    const product = db.products.find((p) => p.slug === item.slug);
    if (!product) continue;
    const position = product.sizes.find((s) => s.size === String(item.size));
    if (position) position.qty += item.qty;
  }
}

function snapshotStock() {
  return db.products.map((p) => p.sizes.map((s) => s.qty));
}

function restoreSnapshot(snapshot) {
  db.products.forEach((product, i) => {
    product.sizes.forEach((position, j) => {
      position.qty = snapshot[i][j];
    });
  });
}

function nextOrderId() {
  const id = `SW-${String(db.counter).padStart(4, "0")}`;
  db.counter += 1;
  return id;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "Заказ должен содержать хотя бы одну товарную позицию";
  }
  for (const item of items) {
    if (!item || !item.slug) return "У товарной позиции не указана модель";
    if (!item.size) return "У товарной позиции не указан размер";
    const qty = num(item.qty);
    if (!Number.isInteger(qty) || qty < 1) return "Количество должно быть целым числом больше нуля";
  }
  return null;
}

function normalizeItems(items) {
  return items.map((item) => {
    const product = db.products.find((p) => p.slug === item.slug);
    return {
      productId: product ? product.id : null,
      slug: item.slug,
      name: product ? product.name : item.name || item.slug,
      manufacturer: product ? product.manufacturer : item.manufacturer || "",
      size: String(item.size),
      qty: num(item.qty),
      unitPrice: product ? product.price : num(item.unitPrice),
    };
  });
}

/* ------------------------------ auth ------------------------------- */

app.get("/api/users", (_req, res) => {
  // список логинов доступен без пароля — вход выполняется только по логину
  res.json({ users: db.users.map((u) => ({ login: u.login, fio: u.fio, role: u.role })) });
});

app.post("/api/login", (req, res) => {
  const login = norm(req.body?.login);
  const user = db.users.find((u) => norm(u.login) === login);
  if (!user) {
    return res.status(401).json({ error: "Логин не найден в списке пользователей системы" });
  }
  res.json({ user });
});

app.get("/api/session", (req, res) => {
  const user = userFrom(req);
  if (!user) return res.status(401).json({ error: "Нет активной сессии" });
  res.json({ user });
});

/* ----------------------------- catalog ----------------------------- */

app.get("/api/catalog", (req, res) => {
  const { search, drop, manufacturer, subcategory, size, sort = "number", dir = "asc" } = req.query;
  let list = db.products.map(publicProduct);

  if (search) {
    const q = norm(search);
    list = list.filter((p) =>
      [p.name, p.manufacturer, p.subcategory, p.composition, p.description]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (drop) list = list.filter((p) => p.drop === drop);
  if (manufacturer) list = list.filter((p) => norm(p.manufacturer) === norm(manufacturer));
  if (subcategory) list = list.filter((p) => norm(p.subcategory) === norm(subcategory));
  if (size) list = list.filter((p) => p.sizes.some((s) => s.size === String(size) && s.qty > 0));

  const sorters = {
    number: (a, b) => a.id - b.id,
    price: (a, b) => a.price - b.price,
    name: (a, b) => a.name.localeCompare(b.name, "ru"),
    stock: (a, b) => a.totalQty - b.totalQty,
  };
  const sorter = sorters[sort] || sorters.number;
  list.sort((a, b) => (dir === "desc" ? sorter(b, a) : sorter(a, b)));

  res.json({
    items: list,
    total: list.length,
    facets: {
      manufacturers: [...new Set(db.products.map((p) => p.manufacturer))].sort(),
      subcategories: [...new Set(db.products.map((p) => p.subcategory))].sort(),
      sizes: [...new Set(db.products.flatMap((p) => p.sizes.map((s) => s.size)))].sort(
        (a, b) => Number(a) - Number(b),
      ),
      drops: db.drops.map((d) => ({ slug: d.slug, title: d.title, number: d.number })),
    },
  });
});

app.get("/api/products/:slug", (req, res) => {
  const product = db.products.find((p) => p.slug === req.params.slug);
  if (!product) return res.status(404).json({ error: "Модель не найдена" });
  const drop = db.drops.find((d) => d.slug === product.drop) || null;
  res.json({ product: publicProduct(product), drop });
});

app.get("/api/drops", (_req, res) => {
  res.json({
    items: db.drops.map((d) => ({
      ...d,
      productCount: d.products.length,
      items: d.products
        .map((slug) => db.products.find((p) => p.slug === slug))
        .filter(Boolean)
        .map(publicProduct),
    })),
  });
});

app.get("/api/drops/:slug", (req, res) => {
  const drop = db.drops.find((d) => d.slug === req.params.slug);
  if (!drop) return res.status(404).json({ error: "Дроп не найден" });
  const items = drop.products
    .map((slug) => db.products.find((p) => p.slug === slug))
    .filter(Boolean)
    .map(publicProduct);
  res.json({ drop: { ...drop, items } });
});

app.get("/api/stories", (_req, res) => {
  res.json({ items: db.stories });
});

app.get("/api/stories/:slug", (req, res) => {
  const story = db.stories.find((s) => s.slug === req.params.slug);
  if (!story) return res.status(404).json({ error: "Материал не найден" });
  const products = story.products
    .map((slug) => db.products.find((p) => p.slug === slug))
    .filter(Boolean)
    .map(publicProduct);
  res.json({ story: { ...story, items: products } });
});

app.get("/api/pages/:slug", (req, res) => {
  const page = db.staticPages[req.params.slug];
  if (!page) return res.status(404).json({ error: "Страница не найдена" });
  res.json({ page });
});

app.get("/api/overview", (_req, res) => {
  res.json({
    products: db.products.length,
    models: db.products.length,
    drops: db.drops.length,
    stories: db.stories.length,
    positions: db.products.reduce((s, p) => s + p.sizes.reduce((a, x) => a + x.qty, 0), 0),
    priceMin: Math.min(...db.products.map((p) => p.price)),
    priceMax: Math.max(...db.products.map((p) => p.price)),
  });
});

/* ------------------------------ orders ----------------------------- */

app.get("/api/orders", requireRole("manager", "admin"), (_req, res) => {
  const orders = [...db.orders].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ items: orders });
});

app.get("/api/orders/:id", requireRole("manager", "admin"), (req, res) => {
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Заказ не найден" });
  res.json({ order });
});

app.post("/api/orders", requireRole("user", "manager", "admin"), (req, res) => {
  const error = validateItems(req.body?.items);
  if (error) return res.status(400).json({ error });

  const clientFio = String(req.body?.clientFio || "").trim();
  if (clientFio.split(/\s+/).length < 2) {
    return res.status(400).json({ error: "Укажите ФИО клиента (минимум фамилия и имя)" });
  }

  const items = normalizeItems(req.body.items);
  const snapshot = snapshotStock();
  try {
    decrementStock(items);
  } catch (e) {
    restoreSnapshot(snapshot);
    return res.status(409).json({ error: e.message });
  }

  const order = withTotals({
    id: nextOrderId(),
    date: new Date().toISOString(),
    clientFio,
    status: "new",
    createdBy: req.user.login,
    items,
  });
  db.orders.unshift(order);
  save();
  res.status(201).json({ order });
});

app.patch("/api/orders/:id", requireRole("manager", "admin"), (req, res) => {
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Заказ не найден" });

  const clientFio = req.body?.clientFio !== undefined ? String(req.body.clientFio).trim() : order.clientFio;
  if (clientFio.split(/\s+/).length < 2) {
    return res.status(400).json({ error: "Укажите ФИО клиента (минимум фамилия и имя)" });
  }

  let items = order.items;
  if (req.body?.items !== undefined) {
    const error = validateItems(req.body.items);
    if (error) return res.status(400).json({ error });
    items = normalizeItems(req.body.items);
  }

  // пересчитываем склад: сначала возвращаем прежний состав, затем списываем новый
  restoreStock(order.items);
  const snapshot = snapshotStock();
  try {
    decrementStock(items);
  } catch (e) {
    // откат к исходному состоянию
    restoreSnapshot(snapshot);
    return res.status(409).json({ error: e.message });
  }

  const updated = withTotals({
    ...order,
    clientFio,
    status: req.body?.status || order.status,
    items,
    updatedAt: new Date().toISOString(),
  });
  const index = db.orders.indexOf(order);
  db.orders[index] = updated;
  save();
  res.json({ order: updated });
});

app.delete("/api/orders/:id", requireRole("manager", "admin"), (req, res) => {
  const index = db.orders.findIndex((o) => o.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Заказ не найден" });
  const [order] = db.orders.splice(index, 1);
  restoreStock(order.items);
  save();
  res.json({ removed: order.id });
});

app.post("/api/reset", requireRole("admin"), (_req, res) => {
  resetDb();
  res.json({ ok: true });
});

/* ------------------------ админ: статистика ------------------------ */

app.get("/api/stats", requireRole("admin", "manager"), (_req, res) => {
  res.json(buildStats(db));
});

app.get("/api/admin/products", requireRole("admin"), (_req, res) => {
  res.json({
    items: db.products.map((product) => ({
      ...publicProduct(product),
      cost: product.cost,
    })),
  });
});

/* -------------------------- админ: контент ------------------------- */

const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const int = (value, fallback = 0) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
};
const slugify = (value) =>
  text(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");

function uniqueSlug(list, wanted, fallback, exceptSlug = "") {
  const base = slugify(wanted) || fallback;
  let slug = base;
  let n = 2;
  while (list.some((item) => item.slug === slug && item.slug !== exceptSlug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function normalizeSizes(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const sizes = [];
  for (const row of input) {
    const size = text(row?.size, 6);
    const qty = int(row?.qty, -1);
    if (!size || qty < 0) continue;
    if (seen.has(size)) continue;
    seen.add(size);
    sizes.push({ size, qty });
  }
  return sizes.sort((a, b) => Number(a.size) - Number(b.size));
}

function sizesRange(sizes) {
  if (sizes.length === 0) return "";
  const list = sizes.map((s) => Number(s.size)).filter((n) => Number.isFinite(n));
  if (list.length === 0) return `${sizes[0].size}–${sizes[sizes.length - 1].size}`;
  return `${Math.min(...list)}–${Math.max(...list)}`;
}

function productPayload(body, current = null) {
  const price = int(body.price, current?.price ?? 0);
  if (price <= 0) return { error: "Укажите цену больше нуля" };

  const name = text(body.name, 80) || current?.name || "";
  if (!name) return { error: "Укажите название модели" };

  const manufacturer = text(body.manufacturer, 60) || current?.manufacturer || "";
  if (!manufacturer) return { error: "Укажите бренд (производство)" };

  const sizes = body.sizes === undefined ? current?.sizes ?? [] : normalizeSizes(body.sizes);
  if (sizes.length === 0) return { error: "Добавьте хотя бы один размер с остатком" };

  const dropSlug = body.drop === undefined ? current?.drop ?? "" : text(body.drop, 80);
  if (dropSlug && !db.drops.some((drop) => drop.slug === dropSlug)) {
    return { error: "Выбранного дропа не существует" };
  }

  const model3d = {
    uid: text(body.model3d?.uid, 80) || current?.model3d?.uid || "",
    author: text(body.model3d?.author, 80) || current?.model3d?.author || "",
    license: text(body.model3d?.license, 40) || current?.model3d?.license || "CC BY 4.0",
    url: text(body.model3d?.url, 300) || current?.model3d?.url || "",
  };

  return {
    value: {
      name,
      manufacturer,
      category: text(body.category, 40) || current?.category || "Sneakers",
      subcategory: text(body.subcategory, 40) || current?.subcategory || "Low-top",
      price,
      cost: Math.max(0, int(body.cost, current?.cost ?? Math.round(price * 0.46))),
      image: text(body.image, 300) || current?.image || "",
      cutout: current?.cutout || "",
      glb: body.glb === undefined ? current?.glb ?? "" : text(body.glb, 300),
      composition: text(body.composition, 300) || current?.composition || "",
      description: text(body.description, 1200) || current?.description || "",
      sizeRange: text(body.sizeRange, 20) || sizesRange(sizes),
      sizes,
      drop: dropSlug,
      model3d,
    },
  };
}

function replaceProductSlug(oldSlug, newSlug) {
  for (const drop of db.drops) {
    drop.products = drop.products.map((slug) => (slug === oldSlug ? newSlug : slug));
  }
  for (const story of db.stories) {
    story.products = story.products.map((slug) => (slug === oldSlug ? newSlug : slug));
  }
  for (const order of db.orders) {
    for (const item of order.items) {
      if (item.slug === oldSlug) item.slug = newSlug;
    }
  }
}

app.post("/api/admin/products", requireRole("admin"), (req, res) => {
  const body = req.body || {};
  const parsed = productPayload(body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const id = nextId(db.products);
  const slug = uniqueSlug(db.products, body.slug || body.name, `model-${id}`);
  const product = {
    id,
    slug,
    number: text(body.number, 3) || String(id).padStart(2, "0"),
    ...parsed.value,
    image: parsed.value.image || "/models/placeholder.svg",
  };

  db.products.push(product);
  for (const drop of db.drops) {
    if (drop.slug === product.drop && !drop.products.includes(slug)) drop.products.push(slug);
  }
  save();
  res.status(201).json({ product: publicProduct(product) });
});

app.patch("/api/admin/products/:slug", requireRole("admin"), (req, res) => {
  const product = db.products.find((item) => item.slug === req.params.slug);
  if (!product) return res.status(404).json({ error: "Модель не найдена" });

  const body = req.body || {};
  const parsed = productPayload(body, product);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const oldSlug = product.slug;
  const nextSlug =
    body.slug === undefined || slugify(body.slug) === oldSlug
      ? oldSlug
      : uniqueSlug(db.products, body.slug, oldSlug, oldSlug);

  Object.assign(product, parsed.value, {    slug: nextSlug,
    number: text(body.number, 3) || product.number,
  });
  if (!product.image) product.image = "/models/placeholder.svg";
  if (nextSlug !== oldSlug) replaceProductSlug(oldSlug, nextSlug);

  // синхронизируем состав дропов
  for (const drop of db.drops) {
    const inDrop = drop.slug === product.drop;
    const had = drop.products.includes(nextSlug);
    if (inDrop && !had) drop.products.push(nextSlug);
    if (!inDrop && had) drop.products = drop.products.filter((slug) => slug !== nextSlug);
  }

  save();
  res.json({ product: publicProduct(product) });
});

app.delete("/api/admin/products/:slug", requireRole("admin"), (req, res) => {
  const index = db.products.findIndex((item) => item.slug === req.params.slug);
  if (index === -1) return res.status(404).json({ error: "Модель не найдена" });
  const [product] = db.products.splice(index, 1);
  for (const drop of db.drops) {
    drop.products = drop.products.filter((slug) => slug !== product.slug);
  }
  for (const story of db.stories) {
    story.products = story.products.filter((slug) => slug !== product.slug);
  }
  save();
  res.json({ removed: product.slug });
});

function setProducts(list, slugs) {
  if (!Array.isArray(slugs)) return { error: "Передайте список моделей" };
  const clean = [...new Set(slugs.map((slug) => text(slug, 100)))].filter((slug) =>
    db.products.some((product) => product.slug === slug),
  );
  return { value: clean };
}

app.post("/api/admin/drops", requireRole("admin"), (req, res) => {
  const body = req.body || {};
  const title = text(body.title, 80);
  if (!title) return res.status(400).json({ error: "Укажите название дропа" });
  const products = setProducts(db.drops, body.products);
  if (products.error) return res.status(400).json({ error: products.error });

  const id = nextId(db.drops);
  const drop = {
    id,
    slug: uniqueSlug(db.drops, body.slug || title, `drop-${id}`),
    number: text(body.number, 3) || String(id).padStart(2, "0"),
    title,
    subtitle: text(body.subtitle, 80),
    lead: text(body.lead, 400),
    products: products.value,
  };

  db.drops.push(drop);
  for (const product of db.products) {
    if (drop.products.includes(product.slug)) product.drop = drop.slug;
  }
  save();
  res.status(201).json({ drop });
});

app.patch("/api/admin/drops/:slug", requireRole("admin"), (req, res) => {
  const drop = db.drops.find((item) => item.slug === req.params.slug);
  if (!drop) return res.status(404).json({ error: "Дроп не найден" });

  const body = req.body || {};
  const title = body.title === undefined ? drop.title : text(body.title, 80);
  if (!title) return res.status(400).json({ error: "Укажите название дропа" });

  let products = drop.products;
  if (body.products !== undefined) {
    const parsed = setProducts(db.drops, body.products);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    products = parsed.value;
  }

  const oldSlug = drop.slug;
  const nextSlug =
    body.slug === undefined || slugify(body.slug) === oldSlug
      ? oldSlug
      : uniqueSlug(db.drops, body.slug, oldSlug, oldSlug);

  Object.assign(drop, {
    slug: nextSlug,
    number: text(body.number, 3) || drop.number,
    title,
    subtitle: body.subtitle === undefined ? drop.subtitle : text(body.subtitle, 80),
    lead: body.lead === undefined ? drop.lead : text(body.lead, 400),
    products,
  });

  for (const product of db.products) {
    if (product.drop === oldSlug) product.drop = nextSlug;
  }
  for (const product of db.products) {
    if (products.includes(product.slug)) product.drop = nextSlug;
    else if (product.drop === nextSlug) product.drop = "";
  }

  save();
  res.json({ drop });
});

app.delete("/api/admin/drops/:slug", requireRole("admin"), (req, res) => {
  const index = db.drops.findIndex((item) => item.slug === req.params.slug);
  if (index === -1) return res.status(404).json({ error: "Дроп не найден" });
  const [drop] = db.drops.splice(index, 1);
  for (const product of db.products) {
    if (product.drop === drop.slug) product.drop = "";
  }
  save();
  res.json({ removed: drop.slug });
});

function normalizeCredits(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => ({ label: text(row?.label, 40), value: text(row?.value, 120) }))
    .filter((row) => row.label && row.value);
}

app.post("/api/admin/stories", requireRole("admin"), (req, res) => {
  const body = req.body || {};
  const title = text(body.title, 120);
  if (!title) return res.status(400).json({ error: "Укажите заголовок материала" });
  const products = setProducts(db.stories, body.products);
  if (products.error) return res.status(400).json({ error: products.error });

  const id = nextId(db.stories);
  const story = {
    id,
    slug: uniqueSlug(db.stories, body.slug || title, `story-${id}`),
    number: text(body.number, 3) || String(id).padStart(2, "0"),
    title,
    subtitle: text(body.subtitle, 60),
    lead: text(body.lead, 400),
    image: text(body.image, 300) || "/models/nike-air-force-1.png",
    credits: normalizeCredits(body.credits),
    products: products.value,
  };

  db.stories.push(story);
  save();
  res.status(201).json({ story });
});

app.patch("/api/admin/stories/:slug", requireRole("admin"), (req, res) => {
  const story = db.stories.find((item) => item.slug === req.params.slug);
  if (!story) return res.status(404).json({ error: "Материал не найден" });

  const body = req.body || {};
  const title = body.title === undefined ? story.title : text(body.title, 120);
  if (!title) return res.status(400).json({ error: "Укажите заголовок материала" });

  let products = story.products;
  if (body.products !== undefined) {
    const parsed = setProducts(db.stories, body.products);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    products = parsed.value;
  }

  Object.assign(story, {
    slug:
      body.slug === undefined || slugify(body.slug) === story.slug
        ? story.slug
        : uniqueSlug(db.stories, body.slug, story.slug, story.slug),
    number: text(body.number, 3) || story.number,
    title,
    subtitle: body.subtitle === undefined ? story.subtitle : text(body.subtitle, 60),
    lead: body.lead === undefined ? story.lead : text(body.lead, 400),
    image: body.image === undefined ? story.image : text(body.image, 300) || story.image,
    credits: body.credits === undefined ? story.credits : normalizeCredits(body.credits),
    products,
  });

  save();
  res.json({ story });
});

app.delete("/api/admin/stories/:slug", requireRole("admin"), (req, res) => {
  const index = db.stories.findIndex((item) => item.slug === req.params.slug);
  if (index === -1) return res.status(404).json({ error: "Материал не найден" });
  const [story] = db.stories.splice(index, 1);
  save();
  res.json({ removed: story.slug });
});


/* ---------------------------- production --------------------------- */

if (PROD) {
  const dist = path.join(ROOT, "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  } else {
    console.warn("dist/ не найден — сначала выполните npm run build");
  }
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

app.listen(PORT, () => {
  console.log(`Stepwise API: http://localhost:${PORT}${PROD ? " (prod: + dist)" : ""}`);
});
