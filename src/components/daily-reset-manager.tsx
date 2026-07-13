import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { getTodaySummary, getLocalDateStr } from "@/lib/api-client-mock";
import { Sparkles, Sun } from "lucide-react";

export function DailyResetManager() {
  const queryClient = useQueryClient();
  const [showTransition, setShowTransition] = useState(false);
  const [yesterdayCompletion, setYesterdayCompletion] = useState<number | null>(null);
  const [message, setMessage] = useState("Good Morning.");

  const checkNewDay = useCallback((isMidnight: boolean = false) => {
    const lastActive = localStorage.getItem("last_active_date");
    const d = new Date();
    const todayStr = getLocalDateStr(d);

    if (!lastActive) {
      // First time initialization: just set today
      localStorage.setItem("last_active_date", todayStr);
      return;
    }

    if (lastActive !== todayStr) {
      // Date has changed! Let's trigger the beautiful sunrise transition
      
      // Calculate yesterday's completion percentage
      let completionPct = 0;
      try {
        const summary = getTodaySummary(lastActive);
        completionPct = Math.round(summary?.completionPercentage || 0);
      } catch (e) {
        console.error("Error computing yesterday's summary", e);
      }

      setYesterdayCompletion(completionPct);
      setMessage(isMidnight ? "A new day has begun." : "Good Morning.");
      setShowTransition(true);

      // Dispatch the custom event to start the workspace wake-up sequence
      window.dispatchEvent(new CustomEvent("daily-reset-sequence"));

      // Perform the actual reset state updates in localStorage after 1.2s (the Yesterday is archived step!)
      setTimeout(() => {
        performStateReset(lastActive, todayStr);
        queryClient.invalidateQueries();
      }, 1200);

      // End the transition after 5.0 seconds
      setTimeout(() => {
        setShowTransition(false);
      }, 5000);
    }
  }, [queryClient]);

  // Handle state reset logic
  const performStateReset = (lastActiveDate: string, newDate: string) => {
    // 1. Archive unfinished quick tasks (One-Day Tasks)
    const tasksStr = localStorage.getItem("quick_tasks_v1");
    if (tasksStr) {
      try {
        const tasks = JSON.parse(tasksStr);
        let updated = false;
        const updatedTasks = tasks.map((t: any) => {
          if (!t.completed && t.createdAtDate <= lastActiveDate && !t.archived && !t.expired) {
            updated = true;
            return {
              ...t,
              archived: true,
              expired: true
            };
          }
          return t;
        });
        if (updated) {
          localStorage.setItem("quick_tasks_v1", JSON.stringify(updatedTasks));
        }
      } catch (e) {
        console.error("Error resetting quick tasks", e);
      }
    }

    // 2. Pause any active timers in today's (which was today, now yesterday's) logs
    const logsStr = localStorage.getItem("logs_v4");
    if (logsStr) {
      try {
        const logs = JSON.parse(logsStr);
        const yesterdayLogs = logs[lastActiveDate];
        if (yesterdayLogs) {
          let logUpdated = false;
          Object.keys(yesterdayLogs).forEach(rId => {
            const log = yesterdayLogs[rId];
            if (log && log.timerRunning) {
              logUpdated = true;
              let elapsed = log.elapsedSeconds || 0;
              if (log.lastTimerStartedAt) {
                const diff = Math.floor((Date.now() - new Date(log.lastTimerStartedAt).getTime()) / 1000);
                elapsed += Math.max(0, diff);
              }
              log.timerRunning = false;
              log.lastTimerStartedAt = undefined;
              log.elapsedSeconds = elapsed;
            }
          });
          if (logUpdated) {
            localStorage.setItem("logs_v4", JSON.stringify(logs));
          }
        }
      } catch (e) {
        console.error("Error pausing timers", e);
      }
    }

    // 3. Update last active date to today's date
    localStorage.setItem("last_active_date", newDate);
  };

  useEffect(() => {
    // 1. Check on startup
    checkNewDay(false);

    // 2. Check when app regains focus
    const handleFocus = () => {
      checkNewDay(false);
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    // 3. Midnight check: check every 5 seconds if midnight has passed
    const interval = setInterval(() => {
      checkNewDay(true);
    }, 5000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      clearInterval(interval);
    };
  }, [checkNewDay]);

  return (
    <AnimatePresence>
      {showTransition && (
        <motion.div
          id="daily-reset-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden"
          style={{
            background: "radial-gradient(circle at bottom, rgba(254, 134, 48, 0.45) 0%, rgba(244, 63, 94, 0.2) 40%, rgba(12, 13, 18, 0.99) 85%)",
          }}
        >
          {/* Glowing Sunrise Backdrop Sun */}
          <motion.div
            initial={{ scale: 0.8, y: 150, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: [0, 0.8, 1] }}
            exit={{ scale: 0.9, y: -50, opacity: 0 }}
            transition={{ duration: 2.2, ease: "easeOut" }}
            className="absolute bottom-[-150px] w-[500px] h-[500px] rounded-full blur-[140px]"
            style={{
              background: "radial-gradient(circle, rgba(253,186,116,0.6) 0%, rgba(239,68,68,0.3) 50%, rgba(0,0,0,0) 70%)"
            }}
          />

          {/* Floating Sparkles in the Sky */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: `${Math.random() * 100}%`, 
                  y: `${Math.random() * 100}%`,
                  scale: Math.random() * 0.5 + 0.5,
                  opacity: Math.random() * 0.4 + 0.1
                }}
                animate={{ 
                  opacity: [0.1, 0.6, 0.1],
                  y: ["100%", "0%"]
                }}
                transition={{ 
                  duration: Math.random() * 8 + 6, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute text-amber-200/40"
              >
                <Sparkles className="w-5 h-5" />
              </motion.div>
            ))}
          </div>

          {/* Main serenade card content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
            className="text-center space-y-6 max-w-md px-6 relative z-10"
          >
            {/* Sunrise icon inside glowing ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              className="mx-auto w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.2)]"
            >
              <Sun className="w-10 h-10 animate-pulse" />
            </motion.div>

            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white drop-shadow-md font-sans">
                {message}
              </h1>
              
              {yesterdayCompletion !== null && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-amber-200/90"
                >
                  <span>Yesterday:</span>
                  <span className="text-white font-bold">{yesterdayCompletion}% Complete</span>
                </motion.div>
              )}
            </div>

            <p className="text-lg text-amber-100/60 font-medium italic animate-pulse tracking-wide font-serif">
              Today is a fresh start.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
