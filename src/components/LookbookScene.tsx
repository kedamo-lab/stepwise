import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { formatPrice } from "../lib/api";

export type SceneShoe = {
  slug: string;
  number: string;
  name: string;
  manufacturer: string;
  price: number;
  file: string;
};

type Props = {
  shoes: SceneShoe[];
};

/** Ширина пары в мировых единицах (длина модели сводится к 1). */
const UNIT = 1;
/** Просвет между парами: одинаковый у всех, пары не касаются. */
const GAP = 0.16;
/** Поле у краёв сцены. */
const SIDE = 0.32;

/** Глубина, масштаб и скорость вращения каждой пары. */
const DEPTH = [0.14, -0.1, 0.2, -0.04, 0.08, -0.16, 0.18, 0.02, -0.06, 0.12];
const SCALE = [1, 0.97, 1.03, 0.96, 1.01, 0.98, 1.02, 0.95, 1.04, 0.99];
/** Скорость вращения каждой пары, рад/с (полный оборот ~14–19 с). */
const SPIN = [0.36, 0.44, 0.31, 0.41, 0.34, 0.46, 0.33, 0.38, 0.43, 0.37];

/** Пара в покое чуть приглушена и возвращается к 1 при наведении. */
const IDLE_OPACITY = 0.85;

/**
 * Разрешение подбирается по факту: на Retina-экранах и слабых GPU полный DPR
 * дороже, чем заметная разница в чёткости. Потолок 1.6, при просадке кадров
 * рендер опускается до 0.95/0.8 — холст растягивается CSS и остаётся резким.
 */
const MAX_PIXEL_RATIO = 1.6;
const FALLBACK_PIXEL_RATIO = 0.8;
const SLOW_FRAME_MS = 24;
const SAMPLE_FRAMES = 90;

/** Мягкое контактное пятно под парой — вместо честной тени, которая
 *  на ортокамере схлопывается в линию. */
function makeShadowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(12, 12, 12, 0.6)");
    gradient.addColorStop(0.5, "rgba(12, 12, 12, 0.24)");
    gradient.addColorStop(1, "rgba(12, 12, 12, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Ряд из всех пар коллекции в одной 3D-сцене (один WebGL-контекст).
 * Кроссовки крутятся вокруг вертикальной оси, останавливаются под курсором
 * и становятся непрозрачными. Ссылки и подписи — обычный DOM поверх канваса,
 * поэтому работают ховер, фокус с клавиатуры и переход в карточку.
 *
 * Производительность: GLB заранее упрощены и склеены в один меш на пару
 * (10 draw call вместо ~190), рендер идёт только когда сцена видна, а при
 * просадке кадров автоматически снижается разрешение канваса.
 */
export function LookbookScene({ shoes }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Индекс пары под курсором: читается в кадре, без ререндера React. */
  const hoverRef = useRef(-1);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas || shoes.length === 0) return;

    const count = shoes.length;
    const total = count * UNIT + (count - 1) * GAP + SIDE * 2;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      // WebGL-контекст не создаётся — сцену показать нечем.
      return;
    }
    let quality = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    renderer.setPixelRatio(quality);
    renderer.setClearAlpha(0);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envTexture = pmrem.fromScene(room, 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.8;

    // Ортокамера: ряд стоит строго по линии пола, пары одного масштаба,
    // и вся композиция считается в мировых единицах без перспективных искажений.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d3cc, 1.1));

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-3, 5, 4);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xffffff, 1.3);
    rim.position.set(4, 2.5, -3);
    scene.add(rim);

    const row = new THREE.Group();
    scene.add(row);

    const shadowTexture = makeShadowTexture();
    const shadowGeometry = new THREE.PlaneGeometry(1.25, 0.2);

    type Slot = {
      pivot: THREE.Group;
      materials: THREE.MeshStandardMaterial[];
      shadow: THREE.Mesh;
      shadowMaterial: THREE.MeshBasicMaterial;
      scale: number;
      speed: number;
      opacity: number;
      fade: number;
      loaded: boolean;
      /** Высота пары в мировых единицах — по ней поднимается подпись. */
      heightWorld: number;
    };

    const slots: Slot[] = shoes.map((_, i) => {
      const scale = SCALE[i % SCALE.length];
      const depth = DEPTH[i % DEPTH.length];

      const pivot = new THREE.Group();
      pivot.position.set(
        -total / 2 + SIDE + UNIT / 2 + i * (UNIT + GAP),
        0,
        depth,
      );
      pivot.scale.setScalar(scale);
      row.add(pivot);

      const shadowMaterial = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
      shadow.position.set(pivot.position.x, 0.004, -0.5);
      shadow.scale.setScalar(scale);
      row.add(shadow);

      return {
        pivot,
        materials: [],
        shadow,
        shadowMaterial,
        scale,
        speed: SPIN[i % SPIN.length],
        opacity: 0,
        fade: 0,
        loaded: false,
        heightWorld: 0,
      };
    });

    const loader = new GLTFLoader();
    let disposed = false;
    let live = false;
    /** Запуск цикла объявлен ниже: к моменту ответа загрузчика он уже готов. */
    let start = () => {};

    shoes.forEach((shoe, i) => {
      const slot = slots[i];
      if (!shoe.file) return;

      loader.load(
        shoe.file,
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;

          // Длина модели по X приводится к единице; пара ставится подошвой на пол.
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const scale = UNIT / Math.max(size.x, 0.0001);

          const holder = new THREE.Group();
          model.position.set(-center.x, -center.y, -center.z);
          holder.add(model);
          holder.scale.setScalar(scale);
          holder.position.y = (size.y * scale) / 2;

          model.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            // Упрощённые модели приходят одним мешем на пару, но на случай
            // старого файла оставляем общий материал на все части.
            const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            const prepared = source.map((material) => {
              const clone = (material as THREE.MeshStandardMaterial).clone();
              clone.transparent = true;
              clone.opacity = 0;
              clone.depthWrite = true;
              clone.envMapIntensity = 0.9;
              slot.materials.push(clone);
              return clone;
            });
            mesh.material = Array.isArray(mesh.material) ? prepared : prepared[0];
          });

          slot.pivot.add(holder);
          slot.pivot.rotation.y = 0;
          slot.loaded = true;
          slot.heightWorld = size.y * scale;

          const slotEl = host.querySelectorAll<HTMLElement>(".lookbook3d__slot")[i];
          if (slotEl) {
            slotEl.style.setProperty(
              "--tag-lift",
              `${Math.round(slot.heightWorld * slotPx) + 12}px`,
            );
          }

          if (!live) {
            live = true;
            host.classList.add("is-live");
          }
          // Пока пара проявляется, кадры нужны даже если сцена ещё не попала
          // в IntersectionObserver (например, страница открыта не сверху).
          start();
        },
        undefined,
        () => {
          /* если файл не нашёлся — пара просто останется пустой */
        },
      );
    });

    const rowEl = host.querySelector<HTMLElement>(".lookbook3d__row");
    let slotPx = 100;
    let compact = false;
    let padLeft = 16;
    let floor = 0.4;
    let viewWidth = 0;
    let viewHeight = 0;

    const applyCamera = () => {
      if (!viewWidth || !viewHeight) return;

      const visibleWidth = viewWidth / slotPx;
      const visibleHeight = viewHeight / slotPx;
      // На телефоне ряд шире экрана: канвас едет вместе с прокруткой ряда.
      const scroll = compact && rowEl ? rowEl.scrollLeft : 0;
      const left = compact
        ? -total / 2 + SIDE + (scroll - padLeft) / slotPx
        : -total / 2;

      camera.left = left;
      camera.right = left + visibleWidth;
      camera.top = visibleHeight * (1 - floor);
      camera.bottom = -visibleHeight * floor;
      camera.updateProjectionMatrix();
    };

    const fit = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;

      viewWidth = width;
      viewHeight = height;

      // Линия пола берётся из разметки: на телефоне она ниже, чем на десктопе.
      const horizon = host.parentElement?.querySelector(".lookbook__horizon");
      floor = 0.4;
      if (horizon) {
        const hostBox = host.getBoundingClientRect();
        const horizonBox = horizon.getBoundingClientRect();
        const ratio = (hostBox.bottom - horizonBox.top) / hostBox.height;
        if (ratio > 0.05 && ratio < 0.95) floor = ratio;
      }

      compact = width <= 640;
      host.classList.toggle("is-compact", compact);
      slotPx = compact ? Math.min(118, Math.max(92, width * 0.26)) : width / total;

      if (rowEl) padLeft = parseFloat(getComputedStyle(rowEl).paddingLeft) || 16;

      // Дом-слой ссылок живёт по тем же мировым единицам, что и канвас.
      host.style.setProperty("--slot", `${slotPx}px`);
      host.style.setProperty("--gap", `${slotPx * GAP}px`);
      host.style.setProperty("--pad", `${compact ? 0 : (SIDE / total) * width}px`);

      // Подпись каждой пары поднимается ровно над её верхом.
      const slotEls = host.querySelectorAll<HTMLElement>(".lookbook3d__slot");
      slots.forEach((slot, i) => {
        const el = slotEls[i];
        if (!el) return;
        const lift = slot.heightWorld ? slot.heightWorld * slotPx + 12 : slotPx * 0.5;
        el.style.setProperty("--tag-lift", `${Math.round(lift)}px`);
      });

      renderer.setPixelRatio(quality);
      renderer.setSize(width, height, false);
      applyCamera();
    };

    fit();

    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(host);

    let targetX = 0;
    let targetY = 0;
    let parallaxX = 0;
    let parallaxY = 0;

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      targetY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      hoverRef.current = -1;
    };

    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);

    const section = host.closest<HTMLElement>(".lookbook");
    let frame = 0;
    let visible = true;
    let slowFrames = 0;
    let sampledFrames = 0;
    let last = 0;

    const canDraw = () =>
      visible && !document.hidden && !section?.classList.contains("is-exited");

    const stop = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const tick = () => {
      frame = 0;
      if (!canDraw()) return;

      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Ряд на телефоне прокручивается — камера должна ехать за ним.
      if (compact) applyCamera();

      parallaxX += (targetX - parallaxX) * Math.min(1, dt * 4);
      parallaxY += (targetY - parallaxY) * Math.min(1, dt * 4);
      row.position.x = parallaxX * -0.055;
      row.position.y = parallaxY * -0.018;

      const active = hoverRef.current;

      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i];
        const isActive = i === active;
        const baseSpeed = SPIN[i % SPIN.length];

        const targetSpeed = isActive ? 0 : baseSpeed;
        slot.speed += (targetSpeed - slot.speed) * Math.min(1, dt * 4);
        slot.pivot.rotation.y += slot.speed * dt;

        if (slot.loaded) slot.fade = Math.min(1, slot.fade + dt * 1.6);

        const targetOpacity = (isActive ? 1 : IDLE_OPACITY) * slot.fade;
        slot.opacity += (targetOpacity - slot.opacity) * Math.min(1, dt * 8);
        for (const material of slot.materials) material.opacity = slot.opacity;

        // Пятно под парой сужается, когда она поворачивается ребром.
        const flat = Math.abs(Math.cos(slot.pivot.rotation.y));
        slot.shadow.scale.x = slot.scale * (0.62 + 0.38 * flat);
        slot.shadowMaterial.opacity = 0.5 * slot.fade * (isActive ? 1 : 0.85);
      }

      renderer.render(scene, camera);

      // Адаптивное качество: если кадры стабильно дольше 24 мс, опускаем
      // внутреннее разрешение. На слабых машинах это главный запас по FPS.
      sampledFrames += 1;
      if (dt * 1000 > SLOW_FRAME_MS) slowFrames += 1;
      if (sampledFrames >= SAMPLE_FRAMES) {
        if (slowFrames > SAMPLE_FRAMES * 0.4 && quality > FALLBACK_PIXEL_RATIO) {
          quality = Math.max(FALLBACK_PIXEL_RATIO, quality - 0.25);
          renderer.setPixelRatio(quality);
          host.dataset.quality = quality.toFixed(2);
        }
        sampledFrames = 0;
        slowFrames = 0;
      }

      frame = requestAnimationFrame(tick);
    };

    start = () => {
      if (frame || !canDraw()) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    start();

    const intersection = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start();
        else stop();
      },
      { threshold: 0.02 },
    );
    intersection.observe(host);

    // Сцена уехала под манифест — гасим цикл совсем, а не крутим пустые кадры.
    const mutation = section
      ? new MutationObserver(() => {
          if (section.classList.contains("is-exited")) stop();
          else start();
        })
      : null;
    mutation?.observe(section!, { attributes: true, attributeFilter: ["class"] });

    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      stop();
      intersection.disconnect();
      mutation?.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);

      scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      });

      shadowGeometry.dispose();
      shadowTexture.dispose();
      envTexture.dispose();
      room.dispose();
      pmrem.dispose();
      renderer.dispose();
      host.classList.remove("is-live");
    };
  }, [shoes]);

  const enter = (index: number) => () => {
    hoverRef.current = index;
  };
  const leave = (index: number) => () => {
    if (hoverRef.current === index) hoverRef.current = -1;
  };

  return (
    <div className="lookbook3d" ref={hostRef}>
      <canvas className="lookbook3d__canvas" ref={canvasRef} aria-hidden="true" />
      <div className="lookbook3d__row">
        {shoes.map((shoe, i) => (
          <Link
            key={shoe.slug}
            to={`/products/${shoe.slug}`}
            className="lookbook3d__slot"
            style={{ "--i": i } as CSSProperties}
            aria-label={`${shoe.manufacturer} ${shoe.name} — ${formatPrice(shoe.price)}`}
            onPointerEnter={enter(i)}
            onPointerLeave={leave(i)}
            onFocus={enter(i)}
            onBlur={leave(i)}
          >
            <span className="lookbook__tag">
              <span className="lookbook__tag-top">
                {shoe.number} / {shoe.manufacturer}
              </span>
              <span className="lookbook__tag-name">
                {shoe.name}
                <em>{formatPrice(shoe.price)}</em>
              </span>
            </span>
            <span className="lookbook3d__idx" aria-hidden="true">
              {shoe.number}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
