import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Sparkles, 
  Check,
  HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CircleMenuProps {
  onCreateRoutine: () => void;
  onCreateOneDayTask: () => void;
  onPickSomething?: () => void;
}

export function CircleMenu({ onCreateRoutine, onCreateOneDayTask, onPickSomething }: CircleMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      label: "Create Routine",
      icon: Sparkles,
      dx: 0,
      dy: 80,
      action: () => {
        onCreateRoutine();
        setIsOpen(false);
      },
      disabled: false,
      color: "hover:text-primary hover:border-primary/40",
      glow: "hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.35)]"
    },
    {
      label: "Create One-Day Task",
      icon: Check,
      dx: 80,
      dy: 0,
      action: () => {
        onCreateOneDayTask();
        setIsOpen(false);
      },
      disabled: false,
      color: "hover:text-emerald-400 hover:border-emerald-500/40",
      glow: "hover:shadow-[0_0_15px_rgba(52,211,153,0.35)]"
    },
    {
      label: "I'm Not Sure",
      icon: HelpCircle,
      dx: 56,
      dy: 56,
      action: () => {
        onPickSomething?.();
        setIsOpen(false);
      },
      disabled: !onPickSomething,
      color: "hover:text-purple-400 hover:border-purple-500/40",
      glow: "hover:shadow-[0_0_15px_rgba(168,85,247,0.35)]"
    }
  ];

  return (
    <div className="absolute top-6 left-6 z-[60] pointer-events-auto">
      {/* Radial items */}
      <AnimatePresence>
        {isOpen && (
          <>
            {menuItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.label}
                  custom={{ dx: item.dx, dy: item.dy }}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={{
                    closed: { x: 0, y: 0, scale: 0, opacity: 0 },
                    open: (c: { dx: number; dy: number }) => ({
                      x: c.dx,
                      y: c.dy,
                      scale: 1,
                      opacity: 1,
                      transition: { 
                        type: "spring", 
                        stiffness: 350, 
                        damping: 20, 
                        delay: idx * 0.05 
                      }
                    })
                  }}
                  whileHover={item.disabled ? {} : { scale: 1.1 }}
                  whileTap={item.disabled ? {} : { scale: 0.92 }}
                  onClick={item.disabled ? undefined : item.action}
                  disabled={item.disabled}
                  title={item.label}
                  className={cn(
                    "absolute top-1 left-1 w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300",
                    "backdrop-blur-md bg-slate-950/45 text-foreground shadow-lg border-white/10",
                    item.color,
                    item.glow
                  )}
                  style={{ id: `circle-menu-item-${idx}` }}
                >
                  <Icon className="w-4 h-4" />
                </motion.button>
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* Main Circular Glass Command Button */}
      <motion.button
        id="circle-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        animate={
          isOpen 
            ? { rotate: 135, scale: 1.05 } 
            : { 
                rotate: 0, 
                scale: [1, 1.03, 1],
                boxShadow: [
                  "0 4px 12px rgba(0,0,0,0.1)",
                  "0 4px 20px rgba(var(--primary-rgb),0.15)",
                  "0 4px 12px rgba(0,0,0,0.1)"
                ]
              }
        }
        transition={
          isOpen 
            ? { type: "spring", stiffness: 350, damping: 20 } 
            : { 
                scale: { repeat: Infinity, duration: 4, ease: "easeInOut" },
                boxShadow: { repeat: Infinity, duration: 4, ease: "easeInOut" }
              }
        }
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300 relative z-50 cursor-pointer shadow-xl",
          "bg-slate-950/30 backdrop-blur-lg border-white/10 text-foreground hover:text-primary hover:border-primary/30",
          "hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.25)]"
        )}
        title={isOpen ? "Close Menu" : "Command Menu"}
      >
        <Plus className="w-5 h-5 transition-transform" />
        
        {/* Subtle inner glowing core */}
        <span className="absolute inset-1 rounded-full bg-primary/5 pointer-events-none animate-pulse" />
      </motion.button>
    </div>
  );
}
