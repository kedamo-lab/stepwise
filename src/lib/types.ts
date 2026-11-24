export type Role = "user" | "manager" | "admin";

export type User = {
  login: string;
  fio: string;
  role: Role;
};

export type SizePosition = {
  size: string;
  qty: number;
};

export type Model3d = {
  uid: string;
  author: string;
  license: string;
  url: string;
};

export type Product = {
  id: number;
  slug: string;
  number: string;
  name: string;
  manufacturer: string;
  category: string;
  subcategory: string;
  price: number;
  /** Закупочная цена пары — база для расчёта прибыли. */
  cost?: number;
  image: string;
  cutout: string;
  /** Файл модели для сцены лукбука на главной. */
  glb: string;
  composition: string;
  description: string;
  sizeRange: string;
  sizes: SizePosition[];
  drop: string;
  model3d: Model3d;
  totalQty: number;
  inStock: boolean;
  availableSizes: string[];
};

export type Drop = {
  id: number;
  slug: string;
  number: string;
  title: string;
  subtitle: string;
  lead: string;
  products: string[];
  items?: Product[];
  productCount?: number;
};

export type Story = {
  id: number;
  slug: string;
  number: string;
  title: string;
  subtitle: string;
  lead: string;
  image: string;
  credits: { label: string; value: string }[];
  products: string[];
  items?: Product[];
};

export type StaticPage = {
  title: string;
  blocks: string[];
};

export type OrderItem = {
  productId: number | null;
  slug: string;
  name: string;
  manufacturer: string;
  size: string;
  qty: number;
  unitPrice: number;
};

export type OrderStatus = "new" | "confirmed" | "done";

export type Order = {
  id: string;
  date: string;
  clientFio: string;
  status: OrderStatus;
  createdBy?: string;
  updatedAt?: string;
  items: OrderItem[];
  total: number;
  units: number;
};

export type CartLine = {
  slug: string;
  size: string;
  qty: number;
  name: string;
  manufacturer: string;
  price: number;
  image: string;
  number: string;
};

export type Facets = {
  manufacturers: string[];
  subcategories: string[];
  sizes: string[];
  drops: { slug: string; title: string; number: string }[];
};

/* ----------------------------- статистика ----------------------------- */

export type StatsStatus = {
  status: OrderStatus;
  count: number;
  revenue: number;
  units: number;
};

export type StatsBucket = {
  key: string;
  label: string;
  revenue: number;
  units: number;
  orders: number;
};

export type StatsCost = {
  key: string;
  label: string;
  amount: number;
  share: number;
};

export type StatsModel = {
  slug: string;
  name: string;
  manufacturer: string;
  image: string;
  units: number;
  revenue: number;
  share: number;
};

export type Stats = {
  generatedAt: string;
  tariffs: {
    logisticsPerOrder: number;
    logisticsPerUnit: number;
    packagingPerOrder: number;
    acquiringRate: number;
  };
  kpi: {
    revenue: number;
    orders: number;
    units: number;
    avgOrder: number;
    importCost: number;
    logistics: number;
    packaging: number;
    acquiring: number;
    costs: number;
    profit: number;
    margin: number;
  };
  statuses: StatsStatus[];
  timeline: StatsBucket[];
  costs: StatsCost[];
  top: StatsModel[];
  sizesSold: { size: string; units: number; revenue: number }[];
  stock: {
    pairs: number;
    retail: number;
    cost: number;
    positions: number;
    emptySizes: number;
    models: number;
    low: {
      slug: string;
      name: string;
      manufacturer: string;
      size: string;
      qty: number;
    }[];
    lowCount: number;
    brands: { name: string; pairs: number; retail: number; models: number }[];
    sizes: { size: string; pairs: number }[];
  };
  catalog: {
    products: number;
    drops: number;
    stories: number;
    brands: number;
    priceMin: number;
    priceMax: number;
  };
  recent: {
    id: string;
    date: string;
    clientFio: string;
    total: number;
    units: number;
    status: OrderStatus;
  }[];
};
