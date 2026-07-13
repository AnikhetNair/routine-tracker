import { Link, useLocation } from "wouter";
import { LayoutGrid, CalendarDays, History, BarChart3, Settings } from "lucide-react";
import { cn, getTodayStr } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGetTodaySummary } from "@workspace/api-client-react";

const NAV_ITEMS = [
  { href: "/", label: "Workspace", icon: LayoutGrid },
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/history", label: "History", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

// Height, in pixels, of the invisible activation strip along the bottom
// edge of the viewport. Entering it "peeks" the dock; continuing to move
// toward it opens it fully. Leaving either zone retracts it.
const ACTIVATION_ZONE_PX = 4;
const PEEK_ZONE_PX = 64;

export function FloatingNav() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = getTodayStr();
  const { data: summary } = useGetTodaySummary({ date: today });
  const hasActiveTimer = summary?.routines.some(r => r.type === "duration" && r.timerRunning);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (hasActiveTimer) {
        setPeek(false);
        setOpen(false);
        return;
      }
      const distanceFromBottom = window.innerHeight - e.clientY;

      if (distanceFromBottom <= ACTIVATION_ZONE_PX) {
        if (closeTimer.current) {
          clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
        setPeek(true);
        setOpen(true);
      } else if (distanceFromBottom <= PEEK_ZONE_PX) {
        setPeek(true);
      } else {
        setPeek(false);
        if (open) {
          if (closeTimer.current) clearTimeout(closeTimer.current);
          closeTimer.current = setTimeout(() => setOpen(false), 220);
        }
      }
    };

    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [open, hasActiveTimer]);

  return (
    <>
      {/* Invisible activation strip along the bottom edge */}
      <div className="fixed bottom-0 left-0 right-0 h-8 z-40" aria-hidden="true" />

      {/* Tiny peek hint — a soft glow just barely visible before the dock opens */}
      <AnimatePresence>
        {peek && !open && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-2 left-1/2 -translate-x-1/2 w-24 h-1.5 rounded-full bg-primary/30 blur-[1px] z-40 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.nav
            onMouseEnter={() => {
              if (closeTimer.current) {
                clearTimeout(closeTimer.current);
                closeTimer.current = null;
              }
              setOpen(true);
              setPeek(true);
            }}
            onMouseLeave={() => {
              setPeek(false);
              closeTimer.current = setTimeout(() => setOpen(false), 220);
            }}
            initial={{ opacity: 0, y: 24, scale: 0.98, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 20, scale: 0.98, filter: "blur(8px)" }}
            transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.9 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
          >
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-2 rounded-3xl",
                "bg-card/60 backdrop-blur-2xl border border-white/10",
                "shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)]",
              )}
            >
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-medium",
                      "transition-all duration-200 ease-out",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                    )}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span
                      className={cn(
                        "overflow-hidden whitespace-nowrap transition-all duration-200",
                        isActive
                          ? "max-w-[100px] opacity-100"
                          : "max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100",
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
