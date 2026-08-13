"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { applyTheme, DEFAULT_THEME_KEY, getTheme, type ThemeKey } from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeKey;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME_KEY,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseClient();
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT_THEME_KEY);

  const applyKey = useCallback((key: ThemeKey) => {
    const def = getTheme(key);
    applyTheme(def);
    setThemeState(def.key);
  }, []);

  const loadUserTheme = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("theme")
      .eq("id", user.id)
      .single();
    if (data?.theme) applyKey(data.theme as ThemeKey);
  }, [supabase, applyKey]);

  useEffect(() => {
    loadUserTheme();
    const onProfileUpdated = () => loadUserTheme();
    window.addEventListener("theme-updated", onProfileUpdated);
    return () => window.removeEventListener("theme-updated", onProfileUpdated);
  }, [loadUserTheme]);

  const setTheme = useCallback(
    (key: ThemeKey) => {
      applyKey(key);
      window.dispatchEvent(new Event("theme-updated"));
    },
    [applyKey]
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
