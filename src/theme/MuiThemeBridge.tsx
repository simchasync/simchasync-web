import { useMemo, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { StyledEngineProvider, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { createAppMuiTheme } from "./muiTheme";

/**
 * Bridges next-themes (which controls the `.dark` class used by Tailwind)
 * to a matching MUI theme. `injectFirst` makes MUI inject its styles before
 * Tailwind's stylesheet, so Tailwind utility classes can still override MUI
 * component defaults via `className`.
 */
export default function MuiThemeBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const theme = useMemo(() => createAppMuiTheme(mode), [mode]);

  return (
    <StyledEngineProvider injectFirst>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </StyledEngineProvider>
  );
}
