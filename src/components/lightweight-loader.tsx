import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface LightweightLoaderProps {
  isLoading: boolean;
  message?: string;
}

export function LightweightLoader({ isLoading, message = "Refreshing..." }: LightweightLoaderProps) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isLoading) {
      // Show loader only if loading exceeds 300ms
      timer = setTimeout(() => {
        setShouldShow(true);
      }, 300);
    } else {
      setShouldShow(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading]);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="absolute inset-0 z-[9999] flex items-center justify-center bg-background/25 backdrop-blur-md pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card/75 border border-card-border/40 shadow-xl pointer-events-auto backdrop-blur-lg"
          >
            {/* Soft Pulsing Glowing Outer Ring & Rotating Core */}
            <div className="relative flex items-center justify-center w-5 h-5">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                className="w-5 h-5 rounded-full border border-dashed border-primary/60"
              />
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute inset-0.5 bg-primary/20 rounded-full blur-[4px]"
              />
              <Sparkles className="w-2.5 h-2.5 absolute text-primary animate-pulse" />
            </div>

            {/* Glowing Particles */}
            <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none rounded-full">
              {Array.from({ length: 4 }).map((_, idx) => (
                <motion.div
                  key={idx}
                  animate={{
                    x: [0, (idx % 2 === 0 ? 15 : -15) * Math.random(), 0],
                    y: [0, (idx > 1 ? 15 : -15) * Math.random(), 0],
                    opacity: [0, 0.5, 0],
                    scale: [0.5, 1, 0.5],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2 + Math.random(),
                    ease: "easeInOut",
                  }}
                  className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full bg-primary/40"
                />
              ))}
            </div>

            <span className="text-xs font-medium tracking-tight text-foreground/90 font-sans pr-1 select-none">
              {message}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
