import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, getStoredLogin, setStoredLogin } from "../lib/api";
import type { CartLine, Product, User } from "../lib/types";

const CART_KEY = "stepwise.cart";

type Toast = { id: number; text: string };

type AppState = {
  user: User | null;
  ready: boolean;
  login: (login: string) => Promise<User>;
  logout: () => void;
  cart: CartLine[];
  cartCount: number;
  cartTotal: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (product: Product, size: string, qty?: number) => void;
  setQty: (slug: string, size: string, qty: number) => void;
  removeLine: (slug: string, size: string) => void;
  clearCart: () => void;
  notify: (text: string) => void;
  toasts: Toast[];
};

const AppContext = createContext<AppState | null>(null);

function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const stored = getStoredLogin();
    if (!stored) {
      setReady(true);
      return;
    }
    api<{ user: User }>("/session", { login: stored })
      .then((data) => setUser(data.user))
      .catch(() => setStoredLogin(""))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* размер хранилища */
    }
  }, [cart]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const notify = useCallback((text: string) => {
    const id = ++seq.current;
    setToasts((prev) => [...prev, { id, text }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
    timers.current.push(timer);
  }, []);

  const login = useCallback(async (value: string) => {
    const data = await api<{ user: User }>("/login", {
      method: "POST",
      body: { login: value },
      login: "",
    });
    setStoredLogin(data.user.login);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setStoredLogin("");
    setUser(null);
    setCartOpen(false);
  }, []);

  const addToCart = useCallback(
    (product: Product, size: string, qty = 1) => {
      setCart((prev) => {
        const index = prev.findIndex((l) => l.slug === product.slug && l.size === size);
        const limit = product.sizes.find((s) => s.size === size)?.qty ?? 0;
        if (index >= 0) {
          const next = [...prev];
          const merged = Math.min(next[index].qty + qty, limit);
          next[index] = { ...next[index], qty: merged };
          return next;
        }
        return [
          ...prev,
          {
            slug: product.slug,
            size,
            qty: Math.min(qty, limit || qty),
            name: product.name,
            manufacturer: product.manufacturer,
            price: product.price,
            image: product.image,
            number: product.number,
          },
        ];
      });
      setCartOpen(true);
    },
    [],
  );

  const setQty = useCallback((slug: string, size: string, qty: number) => {
    setCart((prev) =>
      prev.map((l) =>
        l.slug === slug && l.size === size ? { ...l, qty: Math.max(1, Math.min(qty, 99)) } : l,
      ),
    );
  }, []);

  const removeLine = useCallback((slug: string, size: string) => {
    setCart((prev) => prev.filter((l) => !(l.slug === slug && l.size === size)));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = cart.reduce((sum, l) => sum + l.qty, 0);
  const cartTotal = cart.reduce((sum, l) => sum + l.qty * l.price, 0);

  const value = useMemo<AppState>(
    () => ({
      user,
      ready,
      login,
      logout,
      cart,
      cartCount,
      cartTotal,
      cartOpen,
      setCartOpen,
      addToCart,
      setQty,
      removeLine,
      clearCart,
      notify,
      toasts,
    }),
    [
      user,
      ready,
      login,
      logout,
      cart,
      cartCount,
      cartTotal,
      cartOpen,
      addToCart,
      setQty,
      removeLine,
      clearCart,
      notify,
      toasts,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp должен использоваться внутри AppProvider");
  return ctx;
}
