import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { api, formatPrice, pad } from "../../lib/api";
import { useApp } from "../../lib/app-context";
import { useFetch } from "../../lib/use-fetch";
import type { Drop, Product, Story } from "../../lib/types";

type Section = "products" | "drops" | "stories";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "products", label: "КАТАЛОГ" },
  { id: "drops", label: "ДРОПЫ" },
  { id: "stories", label: "ЖУРНАЛ" },
];

const emptySize = () => ({ size: "", qty: "0" });

const emptyProduct = () => ({
  slug: "",
  number: "",
  name: "",
  manufacturer: "",
  category: "Sneakers",
  subcategory: "Low-top",
  price: "",
  cost: "",
  image: "",
  glb: "",
  composition: "",
  description: "",
  sizeRange: "",
  drop: "",
  sizes: [emptySize()],
  model3d: { uid: "", author: "", license: "CC BY 4.0", url: "" },
});

type ProductDraft = ReturnType<typeof emptyProduct>;

const emptyDrop = () => ({
  slug: "",
  number: "",
  title: "",
  subtitle: "",
  lead: "",
  products: [] as string[],
});

type DropDraft = ReturnType<typeof emptyDrop>;

const emptyStory = () => ({
  slug: "",
  number: "",
  title: "",
  subtitle: "",
  lead: "",
  image: "",
  credits: [
    { label: "Текст", value: "" },
    { label: "Год", value: String(new Date().getFullYear()) },
  ],
  products: [] as string[],
});

type StoryDraft = ReturnType<typeof emptyStory>;

/* ------------------------------- разметка ------------------------------ */

function Field({
  label,
  wide,
  hint,
  children,
}: {
  label: string;
  wide?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={"ef" + (wide ? " ef--wide" : "")}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="ef__hint">{hint}</span> : null}
    </label>
  );
}

function ProductPicker({
  products,
  selected,
  onToggle,
}: {
  products: Product[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="ef__chips">
      {products.map((product) => (
        <button
          key={product.slug}
          type="button"
          className={"ef-chip" + (selected.includes(product.slug) ? " is-on" : "")}
          onClick={() => onToggle(product.slug)}
        >
          <span className="mono">{product.number}</span>
          {product.name}
        </button>
      ))}
    </div>
  );
}

function EditorMessage({ text }: { text: string }) {
  return <div className="editor__hint">{text}</div>;
}

/* ------------------------------ товары --------------------------------- */

function ProductForm({
  entity,
  drops,
  onSaved,
  onRemoved,
  notify,
}: {
  entity: Product | null;
  drops: Drop[];
  onSaved: (slug: string) => void;
  onRemoved: () => void;
  notify: (text: string) => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(() =>
    entity
      ? {
          slug: entity.slug,
          number: entity.number,
          name: entity.name,
          manufacturer: entity.manufacturer,
          category: entity.category,
          subcategory: entity.subcategory,
          price: String(entity.price),
          cost: String(entity.cost ?? ""),
          image: entity.image,
          glb: entity.glb,
          composition: entity.composition,
          description: entity.description,
          sizeRange: entity.sizeRange,
          drop: entity.drop,
          sizes: entity.sizes.map((row) => ({ size: row.size, qty: String(row.qty) })),
          model3d: { ...entity.model3d },
        }
      : emptyProduct(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [entity?.slug]);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = {
        slug: draft.slug.trim() || undefined,
        number: draft.number.trim() || undefined,
        name: draft.name,
        manufacturer: draft.manufacturer,
        category: draft.category,
        subcategory: draft.subcategory,
        price: Number(draft.price) || 0,
        cost: Number(draft.cost) || undefined,
        image: draft.image,
        glb: draft.glb,
        composition: draft.composition,
        description: draft.description,
        sizeRange: draft.sizeRange,
        drop: draft.drop,
        sizes: draft.sizes
          .filter((row) => row.size.trim())
          .map((row) => ({ size: row.size.trim(), qty: Number(row.qty) || 0 })),
        model3d: draft.model3d,
      };
      const res = await api<{ product: Product }>(
        entity ? `/admin/products/${entity.slug}` : "/admin/products",
        { method: entity ? "PATCH" : "POST", body },
      );
      notify(entity ? `Модель ${res.product.name} сохранена` : `Модель ${res.product.name} добавлена`);
      onSaved(res.product.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить модель");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!entity) return;
    if (!window.confirm(`Удалить модель ${entity.name}? Она исчезнет из каталога, дропов и журнала.`)) return;
    setBusy(true);
    try {
      await api(`/admin/products/${entity.slug}`, { method: "DELETE" });
      notify(`Модель ${entity.name} удалена`);
      onRemoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить модель");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="editor__form" key={entity?.slug ?? "new"}>
      <header className="editor__form-head">
        <div>
          <span className="label">
            {entity ? `МОДЕЛЬ ${entity.number} / ${entity.slug}` : "НОВАЯ МОДЕЛЬ"}
          </span>
          <h2 className="h2">{entity ? entity.name : "ДОБАВИТЬ ПОЗИЦИЮ"}</h2>
        </div>
        <span className="label">{formatPrice(Number(draft.price) || 0)}</span>
      </header>

      <div className="ef-grid">
        <Field label="название">
          <input
            className="ef__input"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="CHUCK 70 HI"
          />
        </Field>
        <Field label="бренд / производство">
          <input
            className="ef__input"
            value={draft.manufacturer}
            onChange={(e) => set("manufacturer", e.target.value)}
            placeholder="Converse"
          />
        </Field>
        <Field label="категория">
          <input
            className="ef__input"
            value={draft.category}
            onChange={(e) => set("category", e.target.value)}
          />
        </Field>
        <Field label="подкатегория">
          <input
            className="ef__input"
            value={draft.subcategory}
            onChange={(e) => set("subcategory", e.target.value)}
          />
        </Field>
        <Field label="цена, ₽">
          <input
            className="ef__input"
            inputMode="numeric"
            value={draft.price}
            onChange={(e) => set("price", e.target.value.replace(/[^\d]/g, ""))}
          />
        </Field>
        <Field label="закупка, ₽" hint="база для расчёта прибыли">
          <input
            className="ef__input"
            inputMode="numeric"
            value={draft.cost}
            onChange={(e) => set("cost", e.target.value.replace(/[^\d]/g, ""))}
            placeholder="—"
          />
        </Field>
        <Field label="номер в индексе">
          <input
            className="ef__input"
            value={draft.number}
            onChange={(e) => set("number", e.target.value)}
            placeholder="авто"
          />
        </Field>
        <Field label="slug" hint="латиницей; при смене обновятся ссылки">
          <input
            className="ef__input"
            value={draft.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="auto"
          />
        </Field>
        <Field label="дроп">
          <select
            className="ef__input"
            value={draft.drop}
            onChange={(e) => set("drop", e.target.value)}
          >
            <option value="">БЕЗ ДРОПА</option>
            {drops.map((drop) => (
              <option key={drop.slug} value={drop.slug}>
                {drop.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="размерный ряд">
          <input
            className="ef__input"
            value={draft.sizeRange}
            onChange={(e) => set("sizeRange", e.target.value)}
            placeholder="39–46"
          />
        </Field>
        <Field label="изображение" wide hint="путь от корня сайта; пусто — заглушка">
          <input
            className="ef__input"
            value={draft.image}
            onChange={(e) => set("image", e.target.value)}
            placeholder="/models/модель.png"
          />
        </Field>
        <Field label="3D-файл сцены (glb)" wide>
          <input
            className="ef__input"
            value={draft.glb}
            onChange={(e) => set("glb", e.target.value)}
            placeholder="/lookbook-models/…glb"
          />
        </Field>
      </div>

      <div className="editor__block">
        <div className="editor__block-head">
          <span className="label">РАЗМЕРЫ И ОСТАТКИ</span>
          <button
            type="button"
            className="chip chip--ghost"
            onClick={() => set("sizes", [...draft.sizes, emptySize()])}
          >
            ＋ РАЗМЕР
          </button>
        </div>
        <div className="size-rows">
          {draft.sizes.map((row, i) => (
            <div className="size-row" key={i}>
              <input
                className="ef__input ef__input--sm"
                value={row.size}
                placeholder="42"
                onChange={(e) =>
                  set(
                    "sizes",
                    draft.sizes.map((item, index) =>
                      index === i ? { ...item, size: e.target.value.replace(/[^\d.]/g, "") } : item,
                    ),
                  )
                }
              />
              <input
                className="ef__input ef__input--sm"
                value={row.qty}
                inputMode="numeric"
                onChange={(e) =>
                  set(
                    "sizes",
                    draft.sizes.map((item, index) =>
                      index === i
                        ? { ...item, qty: e.target.value.replace(/[^\d]/g, "") }
                        : item,
                    ),
                  )
                }
              />
              <span className="label">ПАР</span>
              <button
                type="button"
                className="size-row__remove"
                onClick={() => set("sizes", draft.sizes.filter((_, index) => index !== i))}
                aria-label="Убрать размер"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="ef-grid">
        <Field label="состав" wide>
          <textarea
            className="ef__input ef__input--area"
            rows={2}
            value={draft.composition}
            onChange={(e) => set("composition", e.target.value)}
          />
        </Field>
        <Field label="описание" wide>
          <textarea
            className="ef__input ef__input--area"
            rows={3}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
      </div>

      <div className="editor__block">
        <div className="editor__block-head">
          <span className="label">3D-МОДЕЛЬ / ЛИЦЕНЗИЯ</span>
          <span className="label">Sketchfab</span>
        </div>
        <div className="ef-grid">
          <Field label="uid">
            <input
              className="ef__input"
              value={draft.model3d.uid}
              onChange={(e) => set("model3d", { ...draft.model3d, uid: e.target.value })}
            />
          </Field>
          <Field label="автор">
            <input
              className="ef__input"
              value={draft.model3d.author}
              onChange={(e) => set("model3d", { ...draft.model3d, author: e.target.value })}
            />
          </Field>
          <Field label="лицензия">
            <input
              className="ef__input"
              value={draft.model3d.license}
              onChange={(e) => set("model3d", { ...draft.model3d, license: e.target.value })}
            />
          </Field>
          <Field label="ссылка">
            <input
              className="ef__input"
              value={draft.model3d.url}
              onChange={(e) => set("model3d", { ...draft.model3d, url: e.target.value })}
            />
          </Field>
        </div>
      </div>

      {error ? <p className="editor__error">{error}</p> : null}

      <div className="editor__actions">
        <button type="button" className="chip chip--ink" onClick={() => void save()} disabled={busy}>
          {busy ? "СОХРАНЯЕМ…" : entity ? "СОХРАНИТЬ ✓" : "ДОБАВИТЬ ✓"}
        </button>
        {entity ? (
          <button type="button" className="chip chip--ghost" onClick={() => void remove()} disabled={busy}>
            УДАЛИТЬ
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------- дропы --------------------------------- */

function DropForm({
  entity,
  products,
  onSaved,
  onRemoved,
  notify,
}: {
  entity: Drop | null;
  products: Product[];
  onSaved: (slug: string) => void;
  onRemoved: () => void;
  notify: (text: string) => void;
}) {
  const [draft, setDraft] = useState<DropDraft>(() =>
    entity
      ? {
          slug: entity.slug,
          number: entity.number,
          title: entity.title,
          subtitle: entity.subtitle,
          lead: entity.lead,
          products: [...entity.products],
        }
      : emptyDrop(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = {
        slug: draft.slug.trim() || undefined,
        number: draft.number.trim() || undefined,
        title: draft.title,
        subtitle: draft.subtitle,
        lead: draft.lead,
        products: draft.products,
      };
      const res = await api<{ drop: Drop }>(entity ? `/admin/drops/${entity.slug}` : "/admin/drops", {
        method: entity ? "PATCH" : "POST",
        body,
      });
      notify(`Дроп ${res.drop.title} сохранён`);
      onSaved(res.drop.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить дроп");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!entity) return;
    if (!window.confirm(`Удалить дроп ${entity.title}? Модели останутся в каталоге.`)) return;
    setBusy(true);
    try {
      await api(`/admin/drops/${entity.slug}`, { method: "DELETE" });
      notify(`Дроп ${entity.title} удалён`);
      onRemoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить дроп");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (slug: string) =>
    setDraft((prev) => ({
      ...prev,
      products: prev.products.includes(slug)
        ? prev.products.filter((item) => item !== slug)
        : [...prev.products, slug],
    }));

  return (
    <div className="editor__form" key={entity?.slug ?? "new"}>
      <header className="editor__form-head">
        <div>
          <span className="label">{entity ? `ДРОП ${entity.number} / ${entity.slug}` : "НОВЫЙ ДРОП"}</span>
          <h2 className="h2">{entity ? entity.title : "СОБРАТЬ ЛИНИЮ"}</h2>
        </div>
        <span className="label">{pad(draft.products.length)} МОДЕЛИ</span>
      </header>

      <div className="ef-grid">
        <Field label="название">
          <input
            className="ef__input"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="STREET INDEX"
          />
        </Field>
        <Field label="подзаголовок">
          <input
            className="ef__input"
            value={draft.subtitle}
            onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
          />
        </Field>
        <Field label="номер">
          <input
            className="ef__input"
            value={draft.number}
            onChange={(e) => setDraft({ ...draft, number: e.target.value })}
            placeholder="авто"
          />
        </Field>
        <Field label="slug">
          <input
            className="ef__input"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            placeholder="auto"
          />
        </Field>
        <Field label="описание" wide>
          <textarea
            className="ef__input ef__input--area"
            rows={3}
            value={draft.lead}
            onChange={(e) => setDraft({ ...draft, lead: e.target.value })}
          />
        </Field>
      </div>

      <div className="editor__block">
        <div className="editor__block-head">
          <span className="label">МОДЕЛИ В ДРОПЕ</span>
          <span className="label">КЛИК — ДОБАВИТЬ / УБРАТЬ</span>
        </div>
        <ProductPicker products={products} selected={draft.products} onToggle={toggle} />
      </div>

      {error ? <p className="editor__error">{error}</p> : null}

      <div className="editor__actions">
        <button type="button" className="chip chip--ink" onClick={() => void save()} disabled={busy}>
          {busy ? "СОХРАНЯЕМ…" : entity ? "СОХРАНИТЬ ✓" : "ДОБАВИТЬ ✓"}
        </button>
        {entity ? (
          <button type="button" className="chip chip--ghost" onClick={() => void remove()} disabled={busy}>
            УДАЛИТЬ
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------- журнал -------------------------------- */

function StoryForm({
  entity,
  products,
  onSaved,
  onRemoved,
  notify,
}: {
  entity: Story | null;
  products: Product[];
  onSaved: (slug: string) => void;
  onRemoved: () => void;
  notify: (text: string) => void;
}) {
  const [draft, setDraft] = useState<StoryDraft>(() =>
    entity
      ? {
          slug: entity.slug,
          number: entity.number,
          title: entity.title,
          subtitle: entity.subtitle,
          lead: entity.lead,
          image: entity.image,
          credits: entity.credits.map((row) => ({ ...row })),
          products: [...entity.products],
        }
      : emptyStory(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const body = {
        slug: draft.slug.trim() || undefined,
        number: draft.number.trim() || undefined,
        title: draft.title,
        subtitle: draft.subtitle,
        lead: draft.lead,
        image: draft.image,
        credits: draft.credits.filter((row) => row.label.trim() && row.value.trim()),
        products: draft.products,
      };
      const res = await api<{ story: Story }>(
        entity ? `/admin/stories/${entity.slug}` : "/admin/stories",
        { method: entity ? "PATCH" : "POST", body },
      );
      notify(`Материал ${res.story.title} сохранён`);
      onSaved(res.story.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить материал");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!entity) return;
    if (!window.confirm(`Удалить материал ${entity.title}?`)) return;
    setBusy(true);
    try {
      await api(`/admin/stories/${entity.slug}`, { method: "DELETE" });
      notify(`Материал ${entity.title} удалён`);
      onRemoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить материал");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (slug: string) =>
    setDraft((prev) => ({
      ...prev,
      products: prev.products.includes(slug)
        ? prev.products.filter((item) => item !== slug)
        : [...prev.products, slug],
    }));

  return (
    <div className="editor__form" key={entity?.slug ?? "new"}>
      <header className="editor__form-head">
        <div>
          <span className="label">
            {entity ? `МАТЕРИАЛ ${entity.number} / ${entity.slug}` : "НОВЫЙ МАТЕРИАЛ"}
          </span>
          <h2 className="h2">{entity ? entity.title : "НАПИСАТЬ МАТЕРИАЛ"}</h2>
        </div>
        <span className="label">{pad(draft.products.length)} МОДЕЛИ</span>
      </header>

      <div className="ef-grid">
        <Field label="заголовок" wide>
          <input
            className="ef__input"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </Field>
        <Field label="рубрика">
          <input
            className="ef__input"
            value={draft.subtitle}
            onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
          />
        </Field>
        <Field label="номер">
          <input
            className="ef__input"
            value={draft.number}
            onChange={(e) => setDraft({ ...draft, number: e.target.value })}
            placeholder="авто"
          />
        </Field>
        <Field label="slug">
          <input
            className="ef__input"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            placeholder="auto"
          />
        </Field>
        <Field label="обложка">
          <input
            className="ef__input"
            value={draft.image}
            onChange={(e) => setDraft({ ...draft, image: e.target.value })}
            placeholder="/models/slug.png"
          />
        </Field>
        <Field label="лид" wide>
          <textarea
            className="ef__input ef__input--area"
            rows={3}
            value={draft.lead}
            onChange={(e) => setDraft({ ...draft, lead: e.target.value })}
          />
        </Field>
      </div>

      <div className="editor__block">
        <div className="editor__block-head">
          <span className="label">КРЕДИТЫ</span>
          <button
            type="button"
            className="chip chip--ghost"
            onClick={() => setDraft({ ...draft, credits: [...draft.credits, { label: "", value: "" }] })}
          >
            ＋ СТРОКА
          </button>
        </div>
        <div className="size-rows">
          {draft.credits.map((row, i) => (
            <div className="size-row size-row--credit" key={i}>
              <input
                className="ef__input ef__input--sm"
                value={row.label}
                placeholder="ПОДПИСЬ"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    credits: draft.credits.map((item, index) =>
                      index === i ? { ...item, label: e.target.value } : item,
                    ),
                  })
                }
              />
              <input
                className="ef__input"
                value={row.value}
                placeholder="ЗНАЧЕНИЕ"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    credits: draft.credits.map((item, index) =>
                      index === i ? { ...item, value: e.target.value } : item,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="size-row__remove"
                onClick={() => setDraft({ ...draft, credits: draft.credits.filter((_, index) => index !== i) })}
                aria-label="Убрать строку"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="editor__block">
        <div className="editor__block-head">
          <span className="label">МОДЕЛИ ИЗ МАТЕРИАЛА</span>
          <span className="label">КЛИК — ДОБАВИТЬ / УБРАТЬ</span>
        </div>
        <ProductPicker products={products} selected={draft.products} onToggle={toggle} />
      </div>

      {error ? <p className="editor__error">{error}</p> : null}

      <div className="editor__actions">
        <button type="button" className="chip chip--ink" onClick={() => void save()} disabled={busy}>
          {busy ? "СОХРАНЯЕМ…" : entity ? "СОХРАНИТЬ ✓" : "ДОБАВИТЬ ✓"}
        </button>
        {entity ? (
          <button type="button" className="chip chip--ghost" onClick={() => void remove()} disabled={busy}>
            УДАЛИТЬ
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------ страница ------------------------------- */

export function AdminEditor() {
  const { notify } = useApp();
  const catalog = useFetch<{ items: Product[] }>("/admin/products");
  const dropsFeed = useFetch<{ items: Drop[] }>("/drops");
  const storiesFeed = useFetch<{ items: Story[] }>("/stories");

  const [section, setSection] = useState<Section>("products");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const products = catalog.data?.items ?? [];
  const drops = dropsFeed.data?.items ?? [];
  const stories = storiesFeed.data?.items ?? [];

  const list =
    section === "products"
      ? products.map((p) => ({ slug: p.slug, number: p.number, title: p.name, note: formatPrice(p.price) }))
      : section === "drops"
        ? drops.map((d) => ({
            slug: d.slug,
            number: d.number,
            title: d.title,
            note: `${d.productCount ?? d.products.length} МОДЕЛИ`,
          }))
        : stories.map((s) => ({ slug: s.slug, number: s.number, title: s.title, note: s.subtitle }));

  const currentProduct = products.find((p) => p.slug === selected) ?? null;
  const currentDrop = drops.find((d) => d.slug === selected) ?? null;
  const currentStory = stories.find((s) => s.slug === selected) ?? null;

  const switchSection = (next: Section) => {
    setSection(next);
    setSelected(null);
    setCreating(false);
  };

  const reload = () => {
    catalog.reload();
    dropsFeed.reload();
    storiesFeed.reload();
  };

  return (
    <div className="editor">
      <header className="editor__head">
        <div>
          <span className="label">РЕДАКТОР / КАТАЛОГ · ДРОПЫ · ЖУРНАЛ</span>
          <h1 className="h1">
            РЕДАКТОР
            <br />
            КОНТЕНТА
          </h1>
        </div>
        <div className="editor__tabs">
          {SECTIONS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={"editor__tab" + (section === item.id ? " is-active" : "")}
              style={{ "--i": i } as CSSProperties}
              onClick={() => switchSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="editor__body">
        <aside className="editor__list">
          <button
            type="button"
            className={"editor__new" + (creating ? " is-active" : "")}
            onClick={() => {
              setCreating(true);
              setSelected(null);
            }}
          >
            <span>＋</span>
            {section === "products" ? "НОВАЯ МОДЕЛЬ" : section === "drops" ? "НОВЫЙ ДРОП" : "НОВЫЙ МАТЕРИАЛ"}
          </button>

          {catalog.loading || dropsFeed.loading || storiesFeed.loading ? (
            <div className="editor__hint">ЗАГРУЗКА…</div>
          ) : (
            <ul>
              {list.map((item, i) => (
                <li key={item.slug} style={{ "--i": i } as CSSProperties}>
                  <button
                    type="button"
                    className={"editor__item" + (selected === item.slug && !creating ? " is-active" : "")}
                    onClick={() => {
                      setSelected(item.slug);
                      setCreating(false);
                    }}
                  >
                    <span className="editor__item-num mono">{item.number}</span>
                    <span className="editor__item-name">{item.title}</span>
                    <span className="editor__item-note">{item.note}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="editor__canvas">
          {section === "products" ? (
            creating || currentProduct ? (
              <ProductForm
                key={currentProduct?.slug ?? "new"}
                entity={currentProduct}
                drops={drops}
                notify={notify}
                onSaved={(slug) => {
                  reload();
                  setCreating(false);
                  setSelected(slug);
                }}
                onRemoved={() => {
                  reload();
                  setSelected(null);
                }}
              />
            ) : (
              <EditorMessage text="ВЫБЕРИТЕ МОДЕЛЬ В СПИСКЕ ИЛИ СОЗДАЙТЕ НОВУЮ" />
            )
          ) : section === "drops" ? (
            creating || currentDrop ? (
              <DropForm
                key={currentDrop?.slug ?? "new"}
                entity={currentDrop}
                products={products}
                notify={notify}
                onSaved={(slug) => {
                  reload();
                  setCreating(false);
                  setSelected(slug);
                }}
                onRemoved={() => {
                  reload();
                  setSelected(null);
                }}
              />
            ) : (
              <EditorMessage text="ВЫБЕРИТЕ ДРОП ИЛИ СОБЕРИТЕ НОВУЮ ЛИНИЮ" />
            )
          ) : creating || currentStory ? (
            <StoryForm
              key={currentStory?.slug ?? "new"}
              entity={currentStory}
              products={products}
              notify={notify}
              onSaved={(slug) => {
                reload();
                setCreating(false);
                setSelected(slug);
              }}
              onRemoved={() => {
                reload();
                setSelected(null);
              }}
            />
          ) : (
            <EditorMessage text="ВЫБЕРИТЕ МАТЕРИАЛ ИЛИ НАПИШИТЕ НОВЫЙ" />
          )}
        </div>
      </div>
    </div>
  );
}

