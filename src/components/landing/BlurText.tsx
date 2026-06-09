import { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";

interface BlurTextProps {
  text: string;
  delay?: number;
  animateBy?: "words" | "characters";
  direction?: "top" | "bottom" | "left" | "right";
  onAnimationComplete?: () => void;
  className?: string;
}

const directionMap = {
  top: { y: -20 },
  bottom: { y: 20 },
  left: { x: -20 },
  right: { x: 20 },
};

export default function BlurText({
  text,
  delay = 200,
  animateBy = "words",
  direction = "top",
  onAnimationComplete,
  className = "",
}: BlurTextProps) {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const elements =
    animateBy === "words" ? text.split(" ") : text.split("");

  const totalDuration = elements.length * delay + 500;

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      onAnimationComplete={() => {
        setTimeout(onAnimationComplete!, totalDuration);
      }}
      className={className}
    >
      {elements.map((el, i) => {
        const isLast = i === elements.length - 1;
        return (
          <motion.span
            key={i}
            variants={{
              hidden: {
                opacity: 0,
                filter: "blur(10px)",
                ...directionMap[direction],
              },
              visible: {
                opacity: 1,
                filter: "blur(0px)",
                x: 0,
                y: 0,
                transition: {
                  delay: i * (delay / 1000),
                  duration: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                },
              },
            }}
            className="inline-block"
          >
            {el}
            {!isLast && animateBy === "words" ? "\u00A0" : ""}
          </motion.span>
        );
      })}
    </motion.div>
  );
}
