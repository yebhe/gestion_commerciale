/**
 * Moteur de thème : à partir d'une couleur de fond unique choisie par
 * l'utilisateur, on calcule automatiquement toute une palette
 * (surface, texte, primaire, gris) optimisée pour la visibilité.
 *
 * Corrections apportées à la version d'origine :
 *  1. Les échelles primary/gray génèrent maintenant 10 crans (50 à 900)
 *     au lieu de 9 — avant, --primary-900 et --gray-900 recevaient
 *     `undefined` en CSS.
 *  2. La teinte primaire (PRIMARY_HUE) est fixée en dur au lieu d'être
 *     dérivée de la couleur de fond. Avant, un simple changement de
 *     fond neutre pouvait faire basculer la couleur de marque du teal
 *     vers du brun ou de l'orange sans prévenir. Elle reste maintenant
 *     stable quel que soit le fond choisi (cohérence de marque).
 */

// Teinte de marque fixe (teal, ~ #0d9488). Modifier cette seule valeur
// pour changer la couleur primaire de toute l'application.
const PRIMARY_HUE = 0.483;

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return { r, g, b };
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) => {
    const hex = Math.round(v * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r, g, b };
}

function hexToHsl(hex) {
  return rgbToHsl(hexToRgb(hex) || { r: 1, g: 1, b: 1 });
}

function hslToHex(hsl) {
  return rgbToHex(hslToRgb(hsl));
}

function getLuminance({ r, g, b }) {
  const a = [r, g, b].map((v) => {
    const channel = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return channel;
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function interpolateHsl(a, b, t) {
  let h = a.h + (b.h - a.h) * t;
  let dh = b.h - a.h;
  if (dh > 0.5) h -= 1;
  if (dh < -0.5) h += 1;
  return {
    h: h % 1,
    s: a.s + (b.s - a.s) * t,
    l: a.l + (b.l - a.l) * t,
  };
}

function buildScale(from, to, steps) {
  const result = [];
  for (let i = 0; i < steps; i++) {
    result.push(interpolateHsl(from, to, i / (steps - 1)));
  }
  return result;
}

/**
 * Génère une palette complète à partir d'une couleur de fond en hex.
 */
export function generatePalette(backgroundHex = '#f9fafb') {
  const bg = hexToHsl(backgroundHex);
  const isDark = bg.l < 0.5;

  // Texte principal : noir/blanc très légèrement teinté par la couleur de fond.
  const foreground = {
    h: bg.h,
    s: Math.min(bg.s, 0.08),
    l: isDark ? 0.96 : 0.08,
  };

  // Surface des cartes/boutons : plus claire en mode sombre, proche du blanc en mode clair.
  const surface = {
    h: bg.h,
    s: clamp(bg.s - 0.22, 0.03, 0.15),
    l: isDark ? clamp(bg.l + 0.09, 0.12, 0.22) : clamp(bg.l + 0.07, 0.94, 0.999),
  };

  // Fond subtil (hover, inputs, badges) : entre background et surface.
  const surface2 = interpolateHsl(bg, surface, 0.35);

  // Couleur primaire : teinte fixe (teal), ajustée en saturation/luminosité
  // selon le fond, mais jamais en teinte — la marque reste reconnaissable
  // quel que soit le fond choisi.
  const primaryHue = PRIMARY_HUE;
  const primarySat = clamp(bg.s + 0.35, 0.55, 0.88);
  const primaryLight = isDark ? 0.58 : 0.45;
  const primaryBase = { h: primaryHue, s: primarySat, l: primaryLight };

  // Teinte très claire / très foncée pour le début de l'échelle primaire.
  const primaryTint = {
    h: primaryHue,
    s: clamp(primarySat - 0.3, 0.2, 0.5),
    l: isDark ? 0.14 : 0.93,
  };

  const primaryShade = {
    h: primaryHue,
    s: clamp(primarySat - 0.05, 0.5, 0.85),
    l: isDark ? 0.86 : 0.1,
  };

  // 10 crans : 50, 100, 200, 300, 400, 500, 600, 700, 800, 900.
  const primaryScale = buildScale(primaryTint, primaryShade, 10);

  // Échelle de gris teintée, du fond subtil au texte.
  const grayBase = {
    h: bg.h,
    s: clamp(bg.s * 0.25, 0.02, 0.08),
    l: surface2.l,
  };
  const grayScale = buildScale(grayBase, foreground, 10);

  // Bordures et texte secondaire.
  const border = interpolateHsl(surface2, foreground, 0.18);
  const muted = interpolateHsl(surface2, foreground, 0.45);

  return {
    background: backgroundHex,
    foreground: hslToHex(foreground),
    surface: hslToHex(surface),
    surface2: hslToHex(surface2),
    primaryForeground: hslToHex(surface),
    border: hslToHex(border),
    muted: hslToHex(muted),
    primary: primaryScale.map(hslToHex),
    gray: grayScale.map(hslToHex),
  };
}

/**
 * Applique la palette en tant que variables CSS sur :root.
 */
export function applyTheme(palette) {
  const root = document.documentElement;
  root.style.setProperty('--background', palette.background);
  root.style.setProperty('--foreground', palette.foreground);
  root.style.setProperty('--surface', palette.surface);
  root.style.setProperty('--surface-2', palette.surface2);
  root.style.setProperty('--primary-foreground', palette.primaryForeground);
  root.style.setProperty('--border', palette.border);
  root.style.setProperty('--muted', palette.muted);

  const scaleNames = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

  scaleNames.forEach((name, index) => {
    root.style.setProperty(`--primary-${name}`, palette.primary[index]);
  });

  scaleNames.forEach((name, index) => {
    root.style.setProperty(`--gray-${name}`, palette.gray[index]);
  });
}

/**
 * Applique le thème par défaut (fallback) : sombre + accent teal,
 * l'apparence par défaut souhaitée pour l'application.
 */
export function applyDefaultTheme() {
  applyTheme(generatePalette('#12151a'));
}

/**
 * Applique le thème sombre par défaut, pratique pour un toggle
 * clair/sombre dans l'app.
 */
export function applyDarkTheme() {
  applyTheme(generatePalette('#12151a'));
}