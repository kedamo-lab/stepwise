const LOGIN_KEY = "stepwise.login";

export function getStoredLogin(): string {
  try {
    return localStorage.getItem(LOGIN_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredLogin(login: string) {
  try {
    if (login) localStorage.setItem(LOGIN_KEY, login);
    else localStorage.removeItem(LOGIN_KEY);
  } catch {
    /* приватный режим */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = {
  method?: string;
  body?: unknown;
  login?: string | null;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const login = options.login === undefined ? getStoredLogin() : options.login;
  if (login) headers["X-Login"] = login;

  const res = await fetch(`/api${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Ошибка запроса (${res.status})`, res.status);
  }
  return data as T;
}

export const formatPrice = (value: number) =>
  `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const pad = (n: number, len = 2) => String(n).padStart(len, "0");

export const statusLabel: Record<string, string> = {
  new: "НОВЫЙ",
  confirmed: "ПОДТВЕРЖДЁН",
  done: "ВЫПОЛНЕН",
};

export const roleLabel: Record<string, string> = {
  user: "КЛИЕНТ",
  manager: "МЕНЕДЖЕР",
  admin: "АДМИНИСТРАТОР",
};
