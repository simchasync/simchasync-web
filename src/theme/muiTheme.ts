import { createTheme, type Theme } from "@mui/material/styles";

/**
 * MUI theme mirrored from the HSL design tokens in src/index.css so MUI
 * components (Card, Button, Chip, etc.) match the existing Tailwind/shadcn
 * look in both light and dark mode.
 */
const palettes = {
  light: {
    mode: "light" as const,
    primary: { main: "hsl(40, 88%, 52%)", contrastText: "hsl(220, 25%, 7%)" },
    secondary: { main: "hsl(150, 100%, 32%)", contrastText: "hsl(0, 0%, 100%)" },
    error: { main: "hsl(0, 84%, 50%)" },
    warning: { main: "hsl(38, 92%, 50%)" },
    success: { main: "hsl(160, 60%, 34%)" },
    info: { main: "hsl(201, 80%, 45%)" },
    background: { default: "hsl(210, 40%, 98%)", paper: "hsl(0, 0%, 100%)" },
    text: { primary: "hsl(222, 47%, 11%)", secondary: "hsl(220, 9%, 46%)" },
    divider: "hsl(214, 20%, 88%)",
  },
  dark: {
    mode: "dark" as const,
    primary: { main: "hsl(40, 90%, 58%)", contrastText: "hsl(220, 20%, 6%)" },
    secondary: { main: "hsl(150, 100%, 50%)", contrastText: "hsl(220, 20%, 6%)" },
    error: { main: "hsl(0, 72%, 45%)" },
    warning: { main: "hsl(38, 80%, 45%)" },
    success: { main: "hsl(160, 70%, 40%)" },
    info: { main: "hsl(201, 96%, 59%)" },
    background: { default: "hsl(220, 50%, 5%)", paper: "hsl(220, 48%, 9%)" },
    text: { primary: "hsl(210, 40%, 98%)", secondary: "hsl(215, 20%, 64%)" },
    divider: "hsl(217, 33%, 17%)",
  },
};

export function createAppMuiTheme(mode: "light" | "dark"): Theme {
  return createTheme({
    palette: palettes[mode],
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: '"Inter", sans-serif',
      h1: { fontFamily: '"Plus Jakarta Sans", sans-serif' },
      h2: { fontFamily: '"Plus Jakarta Sans", sans-serif' },
      h3: { fontFamily: '"Plus Jakarta Sans", sans-serif' },
      h4: { fontFamily: '"Plus Jakarta Sans", sans-serif' },
      h5: { fontFamily: '"Plus Jakarta Sans", sans-serif' },
      h6: { fontFamily: '"Plus Jakarta Sans", sans-serif' },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
      },
    },
  });
}
