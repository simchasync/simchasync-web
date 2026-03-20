import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Trigger fade-in on route change
    setVisible(false);
    const timeout = requestAnimationFrame(() => {
      // Force reflow then fade in
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(timeout);
  }, [location.pathname]);

  return (
    <div
      className={`transition-all duration-200 ease-out ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-1"
      }`}
    >
      {children}
    </div>
  );
}
