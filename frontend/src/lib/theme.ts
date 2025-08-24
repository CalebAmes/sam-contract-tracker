export const THEME = {
  // USA-inspired core palette
  red: "#DC2626", // tailwind red-600
  blue: "#2563EB", // tailwind blue-600
  navy: "#0B1220",
  purple: "#7C3AED", // violet-600
  cyan: "#06B6D4", // cyan-500
  // neutrals
  foreground: "#E6EAF2",
  muted: "#94A3B8",
  border: "rgba(255,255,255,0.12)",
};

export const gradients = {
  aiButton: `linear-gradient(90deg, ${THEME.blue} 0%, ${THEME.purple} 50%, ${THEME.cyan} 100%)`,
  aiHeader: `linear-gradient(90deg, ${THEME.blue}22, ${THEME.purple}22, ${THEME.cyan}22)`,
  page: `radial-gradient(1200px 600px at 10% -10%, ${THEME.blue}22, transparent 50%), radial-gradient(1200px 600px at 110% 0%, ${THEME.red}22, transparent 55%), linear-gradient(180deg, ${THEME.navy}, #0E1526)`,
};

export const shadows = {
  soft: "0 6px 24px -6px rgba(0,0,0,.35)",
};
