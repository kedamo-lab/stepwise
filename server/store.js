import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { products, drops, stories, users, staticPages } from "./data/seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "data", "db.json");

const seedOrders = [
  {
    id: "SW-0001",
    date: "2027-02-11T10:24:00.000Z",
    clientFio: "Соколов Иван Андреевич",
    status: "confirmed",
    items: [
      {
        productId: 1,
        slug: "converse-chuck-70",
        name: "CHUCK 70 HI",
        manufacturer: "Converse",
        size: "42",
        qty: 1,
        unitPrice: 12400,
      },
      {
        productId: 6,
        slug: "vans-old-skool",
        name: "OLD SKOOL",
        manufacturer: "Vans",
        size: "41",
        qty: 2,
        unitPrice: 9800,
      },
    ],
  },
  {
    id: "SW-0002",
    date: "2027-02-14T16:05:00.000Z",
    clientFio: "Ветрова Анна Павловна",
    status: "new",
    items: [
      {
        productId: 5,
        slug: "asics-gel-1130",
        name: "GEL-1130",
        manufacturer: "Asics",
        size: "39",
        qty: 1,
        unitPrice: 17800,
      },
    ],
  },
];

function withTotals(order) {
  const total = order.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const units = order.items.reduce((sum, item) => sum + item.qty, 0);
  return { ...order, total, units };
}

function buildDb() {
  // глубокая копия — мутации остатков не должны портить исходный seed
  const clone = (value) => JSON.parse(JSON.stringify(value));
  return {
    users: clone(users),
    products: clone(products),
    drops: clone(drops),
    stories: clone(stories),
    staticPages: clone(staticPages),
    orders: clone(seedOrders.map(withTotals)),
    counter: 3,
  };
}

let db;

export function load() {
  if (fs.existsSync(DB_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      // структура могла измениться — дополняем отсутствующие разделы из seed
      const fresh = buildDb();
      for (const key of Object.keys(fresh)) {
        if (db[key] === undefined) db[key] = fresh[key];
      }
      // у товаров могли появиться новые поля (например, файл 3D-модели) —
      // доклеиваем их, не трогая остатки и заказы
      for (const product of db.products) {
        const seedProduct = fresh.products.find((item) => item.slug === product.slug);
        if (!seedProduct) continue;
        for (const key of Object.keys(seedProduct)) {
          if (product[key] === undefined) product[key] = seedProduct[key];
        }
      }
      return db;
    } catch {
      db = buildDb();
      save();
      return db;
    }
  }
  db = buildDb();
  save();
  return db;
}

export function save() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function getDb() {
  if (!db) load();
  return db;
}

export function resetDb() {
  const fresh = buildDb();
  // сохраняем ссылку на объект: server/index.js держит его же
  if (db) {
    for (const key of Object.keys(db)) delete db[key];
    Object.assign(db, fresh);
  } else {
    db = fresh;
  }
  save();
  return db;
}

export { withTotals };
