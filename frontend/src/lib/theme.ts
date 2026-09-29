export const THEME_STORAGE_KEY = "smart-horizon-theme";

export type Theme = "dark";

export function getSystemTheme(): Theme {
  return "dark";
}

export function getStoredTheme(): Theme {
  return "dark";
}

export function resolveTheme(): Theme {
  return "dark";
}

export function applyTheme(_theme?: string) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    document.documentElement.style.colorScheme = "dark";
  }
}

export const themeInitScript = `(function(){try{document.documentElement.classList.add("dark");document.documentElement.classList.remove("light");document.documentElement.style.colorScheme="dark";localStorage.setItem("${THEME_STORAGE_KEY}","dark");}catch(e){}})();`;
