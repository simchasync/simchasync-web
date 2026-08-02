import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ADMIN_BASE } from "@/lib/adminRoute";

const APP_DOMAIN = "pro.simchasync.com";
const MAIN_DOMAIN = "simchasync.com";

// Paths that belong exclusively on pro.simchasync.com
const APP_PATH_PREFIXES = ["/app", "/auth", ADMIN_BASE, "/reset-password", "/payment-success", "/payment-cancelled"];

// Paths that are public on both domains (don't redirect these)
const PUBLIC_PATH_PREFIXES = ["/book/"];

function isAppPath(pathname: string) {
  return APP_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export default function DomainGuard() {
  const location = useLocation();

  useEffect(() => {
    const { hostname } = window.location;

    // Skip in local dev
    if (hostname === "localhost" || hostname === "127.0.0.1") return;

    const onPro = hostname === APP_DOMAIN;
    const onMain = hostname === MAIN_DOMAIN || hostname === `www.${MAIN_DOMAIN}`;
    const { pathname, search, hash } = location;

    if (isPublicPath(pathname)) return;

    if (onPro && !isAppPath(pathname)) {
      // Pro domain showing a landing-page route — push to app login
      window.location.replace(`https://${APP_DOMAIN}/auth/login`);
      return;
    }

    if (onMain && isAppPath(pathname)) {
      // Main domain showing an app route — push to the same path on pro
      window.location.replace(`https://${APP_DOMAIN}${pathname}${search}${hash}`);
    }
  }, [location]);

  return null;
}
