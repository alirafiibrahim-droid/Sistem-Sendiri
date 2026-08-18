// ============================================================================
// SIORG Themes — palet warna tema tampilan dashboard
// Setiap tema hanya menggantikan colour plate (background dashboard, sidebar,
// warna font, warna komponen) tanpa mengubah model komponen.
// Tema bersifat per-user (disimpan di kolom `profiles.theme`).
// ============================================================================

export type ThemeKey =
  | "default"
  | "black-white"
  | "tropical-punch"
  | "bubblegum-pop"
  | "playful-twilight"
  | "purple-sticky"
  | "brown-cafe"
  | "dark-chocolate"
  | "gray-lemon";

export interface ThemeColors {
  background: string;
  sidebarBg: string;
  foreground: string;
  primary: string;
}

export interface ThemeDefinition {
  key: ThemeKey;
  name: string;
  colors: ThemeColors;
}

export const DEFAULT_THEME_KEY: ThemeKey = "default";

export const THEMES: ThemeDefinition[] = [
  {
    key: "default",
    name: "Default (Saat Ini)",
    colors: {
      background: "#fae3cf",
      sidebarBg: "#7c0a02",
      foreground: "#0a0f24",
      primary: "#bb2233",
    },
  },
  {
    key: "black-white",
    name: "Black and White",
    colors: {
      background: "#FFFFFF",
      sidebarBg: "#D4D4D4",
      foreground: "#B3B3B3",
      primary: "#2B2B2B",
    },
  },
  {
    key: "tropical-punch",
    name: "Tropical Punch",
    colors: {
      background: "#FF8243",
      sidebarBg: "#FFC0CB",
      foreground: "#FCE883",
      primary: "#069494",
    },
  },
  {
    key: "bubblegum-pop",
    name: "Bubblegum Pop",
    colors: {
      background: "#FF69B4",
      sidebarBg: "#069494",
      foreground: "#FFFFFF",
      primary: "#00F0FF",
    },
  },
  {
    key: "playful-twilight",
    name: "Playful Twilight",
    colors: {
      background: "#F6E8EA",
      sidebarBg: "#EF626C",
      foreground: "#22181C",
      primary: "#59C9A5",
    },
  },
  {
    key: "purple-sticky",
    name: "Purple Sticky",
    colors: {
      background: "#5252D4",
      sidebarBg: "#8B8BE2",
      foreground: "#EB1636",
      primary: "#242130",
    },
  },
  {
    key: "brown-cafe",
    name: "Brown Cafe",
    colors: {
      background: "#3A353F",
      sidebarBg: "#505668",
      foreground: "#F1ECE1",
      primary: "#C05850",
    },
  },
  {
    key: "dark-chocolate",
    name: "Dark Chocolate",
    colors: {
      background: "#B18E72",
      sidebarBg: "#1A1713",
      foreground: "#C8C2B9",
      primary: "#E0DDD7",
    },
  },
  {
    key: "gray-lemon",
    name: "Gray Lemon",
    colors: {
      background: "#4A515F",
      sidebarBg: "#C7D3D6",
      foreground: "#EFF1F2",
      primary: "#FFCA28",
    },
  },
];

export function getTheme(key: string): ThemeDefinition {
  return THEMES.find((t) => t.key === key) || THEMES[0];
}

// ----------------------------------------------------------------------------
// Color helpers
// ----------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return { r: 0, g: 0, b: 0 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function toHex(r: number, g: number, b: number): string {
  const part = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Mencampur dua warna; ratioA = proporsi warna pertama (0..1). */
export function mixColors(hexA: string, hexB: string, ratioA: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return toHex(
    a.r * ratioA + b.r * (1 - ratioA),
    a.g * ratioA + b.g * (1 - ratioA),
    a.b * ratioA + b.b * (1 - ratioA)
  );
}

/** Menerangi/menggelapkan warna; percent -1..1 (positif = lebih terang). */
export function shadeColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 + percent;
  return toHex(r * f, g * f, b * f);
}

/** Memilih teks terang/gelap agar kontras dengan warna latar yang diberikan. */
export function getContrastText(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? "#0a0f24" : "#ffffff";
}

// ----------------------------------------------------------------------------
// Apply theme
// ----------------------------------------------------------------------------

export function applyTheme(def: ThemeDefinition) {
  const { background, sidebarBg, primary } = def.colors;
  const root = document.documentElement;
  const set = (key: string, value: string) => root.style.setProperty(key, value);

  // Warna font selalu disesuaikan agar kontras dengan latar agar mudah dibaca:
  // latar terang -> font gelap, latar gelap -> font terang.
  const foreground = getContrastText(background);
  const primaryForeground = getContrastText(primary);
  const sidebarForeground = getContrastText(sidebarBg);

  set("--background", background);
  set("--foreground", foreground);
  set("--card", mixColors(foreground, background, 0.06));
  set("--card-foreground", foreground);
  set("--popover", mixColors(foreground, background, 0.06));
  set("--popover-foreground", foreground);
  set("--primary", primary);
  set("--primary-foreground", primaryForeground);
  set("--secondary", mixColors(foreground, background, 0.06));
  set("--secondary-foreground", foreground);
  set("--muted", mixColors(foreground, background, 0.06));
  set("--muted-foreground", mixColors(foreground, background, 0.62));
  set("--accent", mixColors(foreground, background, 0.1));
  set("--accent-foreground", foreground);
  set("--destructive", "#dc2626");
  set("--destructive-foreground", "#ffffff");
  set("--border", mixColors(foreground, background, 0.16));
  set("--input", mixColors(foreground, background, 0.24));
  set("--ring", primary);
  set("--success", "#16a34a");
  set("--warning", "#fa8603");
  set("--sidebar-bg", sidebarBg);
  set("--sidebar-foreground", sidebarForeground);
  set("--sidebar-accent", shadeColor(sidebarBg, -0.16));
  set("--sidebar-border", mixColors(sidebarForeground, sidebarBg, 0.14));
}
