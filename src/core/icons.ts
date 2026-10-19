/** Default sensor icon: a signal/beacon glyph, as a data URI so the bundle is self-contained. */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#0f172a" stroke="#38bdf8" stroke-width="3"/>
  <circle cx="32" cy="36" r="5" fill="#38bdf8"/>
  <path d="M20 26a17 17 0 0 1 24 0" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M14 19a26 26 0 0 1 36 0" fill="none" stroke="#7dd3fc" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;

export const DEFAULT_SENSOR_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
