import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../lib/app-context";
import { roleLabel } from "../lib/api";
import { useFetch } from "../lib/use-fetch";
import type { User } from "../lib/types";

export function Login() {
  const { login, user, notify } = useApp();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const users = useFetch<{ users: User[] }>("/users");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async (loginValue: string) => {
    if (!loginValue.trim()) {
      setError("Введите логин");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const account = await login(loginValue.trim());
      notify(`Вход выполнен: ${account.login} (${roleLabel[account.role]})`);
      navigate(location.state?.from || "/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="page">
        <div className="login">
          <span className="label">СЕССИЯ АКТИВНА</span>
          <h1 className="h1">ВЫ УЖЕ ВОШЛИ</h1>
          <p className="small muted" style={{ margin: 0 }}>
            {user.login} / {user.fio} / {roleLabel[user.role]}
          </p>
          <div className="row gap-6">
            <button type="button" className="chip chip--ink" onClick={() => navigate("/account")}>
              ЛИЧНЫЙ КАБИНЕТ <span>↗</span>
            </button>
            <button type="button" className="chip chip--ghost" onClick={() => navigate("/index/products")}>
              КАТАЛОГ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="login">
        <span className="label">ВХОД В СИСТЕМУ / БЕЗ ПАРОЛЯ</span>
        <h1 className="h1">ЛОГИН</h1>

        <label className="field field--block">
          <span className="label">ЛОГИН</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void go(value);
            }}
            placeholder="НАПРИМЕР, CLIENT"
            autoFocus
          />
        </label>

        <div className="row gap-6">
          <button
            type="button"
            className="action action--primary"
            style={{ position: "static", minWidth: 220 }}
            disabled={busy}
            onClick={() => void go(value)}
          >
            <span>{busy ? "ПРОВЕРКА…" : "ВОЙТИ"}</span>
            <span className="action__go">↗</span>
          </button>
        </div>

        {error ? <p className="small" style={{ color: "var(--accent)", margin: 0 }}>{error}</p> : null}

        <div className="hair" style={{ marginTop: 8 }} />
        <span className="label">ПОЛЬЗОВАТЕЛИ В РЕСУРСАХ СИСТЕМЫ</span>
        <div className="login__list">
          {(users.data?.users ?? []).map((account) => (
            <button
              type="button"
              key={account.login}
              className="chip chip--hover"
              style={{ textAlign: "left" }}
              onClick={() => {
                setValue(account.login);
                void go(account.login);
              }}
            >
              <span className="chip__dot" />
              <span>{account.login}</span>
              <span className="chip__sep" />
              <span className="dim">{roleLabel[account.role]}</span>
            </button>
          ))}
        </div>
        <p className="small dim" style={{ margin: 0 }}>
          Подсказка: client — клиент, manager — менеджер, admin — администратор.
        </p>
      </div>
    </div>
  );
}
