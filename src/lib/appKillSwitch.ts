export const APP_KILL_SWITCH_ENABLED = import.meta.env.VITE_APP_KILL_SWITCH === "true";

export const APP_KILL_SWITCH_MESSAGE =
  import.meta.env.VITE_APP_KILL_SWITCH_MESSAGE || "We're doing a quick maintenance update. Please try again later.";