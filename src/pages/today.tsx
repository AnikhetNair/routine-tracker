import { 
  useGetTodaySummary, 
  useGetReflection, 
  useUpsertReflection, 
  getGetReflectionQueryKey,
  useListQuickTasks,
  useCreateQuickTask,
  useToggleQuickTask,
  useDeleteQuickTask,
  useListCategories,
  useListRoutines
} from "@workspace/api-client-react";
import type { RoutineProgress, Routine } from "@workspace/api-client-react";
import { getTodayStr, cn } from "@/lib/utils";
import { Card, Label, Button } from "@/components/ui";
import { LightweightLoader } from "@/components/lightweight-loader";
import { 
  CheckCircle2, 
  Flame, 
  Target, 
  Zap, 
  Brain, 
  Star, 
  Clock, 
  Award, 
  PenLine, 
  TrendingUp, 
  Activity, 
  Sparkles,
  BookOpen,
  Plus,
  Trash2,
  ListTodo,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertCircle,
  Sunset,
  Sunrise,
  Grid,
  Moon,
  Keyboard,
  Compass,
  Check
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useSpring, useMotionValue, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { toast } from "sonner";

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function routineStatusLabel(routine: {
  type: string;
  completed: boolean;
  value: number;
  target: number | null;
  targetDurationSeconds: number | null;
  elapsedSeconds: number;
  unit: string | null;
}) {
  if (routine.type === "boolean") return routine.completed ? "Completed" : "Pending";
  if (routine.type === "duration") {
    return routine.targetDurationSeconds
      ? `${formatDuration(routine.elapsedSeconds)} / ${formatDuration(routine.targetDurationSeconds)}`
      : formatDuration(routine.elapsedSeconds);
  }
  if (routine.target) return `${routine.value} / ${routine.target} ${routine.unit ?? ""}`.trim();
  return `${routine.value} ${routine.unit ?? ""}`.trim();
}

function AnimatedProgressBar({ value, colorClass = "bg-primary" }: { value: number; colorClass?: string }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5 border border-white/5">
      <motion.div
        className={`h-full rounded-full ${colorClass}`}
        initial={{ width: 0 }}
        animate={{ width: value + "%" }}
        transition={{ type: "spring", stiffness: 60, damping: 20 }}
      />
    </div>
  );
}

function AnimatedPercentage({ value, reducedMotion }: { value: number; reducedMotion: boolean }) {
  const motionVal = useMotionValue(value);
  const springVal = useSpring(motionVal, reducedMotion
    ? { stiffness: 1000, damping: 100 }
    : { stiffness: 80, damping: 25 }
  );
  const [displayVal, setDisplayVal] = useState(value);

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useMotionValueEvent(springVal, "change", (latest) => {
    setDisplayVal(Math.round(latest));
  });

  return <>{displayVal}%</>;
}

const REFLECTION_PROMPTS = [
  "What surprised you today?",
  "What slowed you down?",
  "What are you grateful for today?",
  "What deserves another attempt tomorrow?",
  "What was the single most peaceful moment of your day?"
];

// Synth click sound for typewriter tactile keyboard effect
const playKeypressSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Synthesize typewriter strike sound
    osc.type = "sine";
    osc.frequency.setValueAtTime(1000 + Math.random() * 300, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {
    // Suppress audio context restrictions
  }
};

const ANIMATION_VARIANTS: Record<string, (direction: number) => {
  enter: any;
  center: any;
  exit: any;
}> = {
  "camera-fly": (direction) => ({
    enter: { scale: 0.3, y: direction > 0 ? 300 : -300, rotateX: 60, opacity: 0 },
    center: { scale: 1, y: 0, rotateX: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { scale: 1.8, y: direction > 0 ? -300 : 300, rotateX: -60, opacity: 0, transition: { duration: 0.45, ease: "easeIn" } }
  }),
  "card-explosion": (direction) => ({
    enter: { scale: 1.5, rotate: direction > 0 ? 15 : -15, opacity: 0, filter: "blur(12px)" },
    center: { scale: 1, rotate: 0, opacity: 1, filter: "blur(0px)", transition: { duration: 0.45, ease: "circOut" } },
    exit: { scale: 0.5, rotate: direction > 0 ? -15 : 15, opacity: 0, filter: "blur(12px)", transition: { duration: 0.4, ease: "circIn" } }
  }),
  "depth-transition": () => ({
    enter: { scale: 0.1, opacity: 0, filter: "blur(20px)" },
    center: { scale: 1, opacity: 1, filter: "blur(0px)", transition: { type: "spring", stiffness: 150, damping: 20 } },
    exit: { scale: 2.2, opacity: 0, filter: "blur(15px)", transition: { duration: 0.4, ease: "easeIn" } }
  }),
  "liquid-morph": () => ({
    enter: { borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%", scale: 0.8, opacity: 0, filter: "blur(25px)" },
    center: { borderRadius: "0% 0% 0% 0% / 0% 0% 0% 0%", scale: 1, opacity: 1, filter: "blur(0px)", transition: { duration: 0.55, ease: "easeInOut" } },
    exit: { borderRadius: "30% 70% 70% 30% / 50% 60% 40% 50%", scale: 1.1, opacity: 0, filter: "blur(25px)", transition: { duration: 0.45, ease: "easeInOut" } }
  }),
  "curtain-reveal": () => ({
    enter: { clipPath: "inset(0% 50% 0% 50%)", opacity: 0 },
    center: { clipPath: "inset(0% 0% 0% 0%)", opacity: 1, transition: { duration: 0.5, ease: "anticipate" } },
    exit: { clipPath: "inset(0% 50% 0% 50%)", opacity: 0, transition: { duration: 0.45, ease: "anticipate" } }
  }),
  "parallax-layers": (direction) => ({
    enter: { x: direction > 0 ? "100%" : "-100%", opacity: 0 },
    center: { x: 0, opacity: 1, transition: { duration: 0.45, ease: "easeOut" } },
    exit: { x: direction > 0 ? "-30%" : "30%", opacity: 0.5, transition: { duration: 0.45, ease: "easeIn" } }
  }),
  "focus-pull": () => ({
    enter: { filter: "blur(25px)", opacity: 0, scale: 0.9 },
    center: { filter: "blur(0px)", opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { filter: "blur(25px)", opacity: 0, scale: 1.1, transition: { duration: 0.4, ease: "easeIn" } }
  }),
  "orbit-transition": (direction) => ({
    enter: { rotateY: direction > 0 ? 90 : -90, x: direction > 0 ? 300 : -300, opacity: 0, scale: 0.8 },
    center: { rotateY: 0, x: 0, opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { rotateY: direction > 0 ? -90 : 90, x: direction > 0 ? -300 : 300, opacity: 0, scale: 0.8, transition: { duration: 0.45, ease: "easeIn" } }
  }),
  "vertical-elevator": (direction) => ({
    enter: { y: direction > 0 ? "100%" : "-100%", opacity: 0 },
    center: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 120, damping: 18 } },
    exit: { y: direction > 0 ? "-100%" : "100%", opacity: 0, transition: { duration: 0.4 } }
  }),
  "portal-transition": () => ({
    enter: { scale: 0, rotate: -180, opacity: 0, filter: "blur(15px)" },
    center: { scale: 1, rotate: 0, opacity: 1, filter: "blur(0px)", transition: { type: "spring", stiffness: 100, damping: 15 } },
    exit: { scale: 0, rotate: 180, opacity: 0, filter: "blur(15px)", transition: { duration: 0.45 } }
  }),
  "particle-transition": () => ({
    enter: { opacity: 0, scale: 0.85, clipPath: "polygon(0 0, 0 0, 0 100%, 0% 100%)" },
    center: { opacity: 1, scale: 1, clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)", transition: { duration: 0.5, ease: "easeInOut" } },
    exit: { opacity: 0, scale: 1.05, clipPath: "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)", transition: { duration: 0.45, ease: "easeInOut" } }
  }),
  "fold-transition": (direction) => ({
    enter: { rotateX: direction > 0 ? 90 : -90, transformOrigin: "top", opacity: 0 },
    center: { rotateX: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { rotateX: direction > 0 ? -90 : 90, transformOrigin: "bottom", opacity: 0, transition: { duration: 0.45, ease: "easeIn" } }
  }),
  "magnetic-pull": (direction) => ({
    enter: { x: direction > 0 ? 500 : -500, scale: 0.7, opacity: 0 },
    center: { x: 0, scale: 1, opacity: 1, transition: { type: "spring", stiffness: 160, damping: 16 } },
    exit: { x: direction > 0 ? -150 : 150, scale: 0.9, opacity: 0, transition: { duration: 0.35 } }
  }),
  "layer-peel": () => ({
    enter: { x: "100%", skewX: -10, opacity: 0 },
    center: { x: 0, skewX: 0, opacity: 1, transition: { duration: 0.45, ease: "circOut" } },
    exit: { x: "-20%", skewX: 5, opacity: 0, transition: { duration: 0.4, ease: "circIn" } }
  }),
  "time-warp": () => ({
    enter: { scaleX: 3, scaleY: 0.1, skewX: 45, opacity: 0, filter: "blur(20px)" },
    center: { scaleX: 1, scaleY: 1, skewX: 0, opacity: 1, filter: "blur(0px)", transition: { duration: 0.5, ease: "easeOut" } },
    exit: { scaleX: 0.1, scaleY: 3, skewX: -45, opacity: 0, filter: "blur(20px)", transition: { duration: 0.45, ease: "easeIn" } }
  }),
  "object-morph": () => ({
    enter: { scale: 0.4, borderRadius: "50%", opacity: 0 },
    center: { scale: 1, borderRadius: "1.5rem", opacity: 1, transition: { type: "spring", stiffness: 120, damping: 18 } },
    exit: { scale: 1.6, borderRadius: "50%", opacity: 0, transition: { duration: 0.45 } }
  }),
  "floating-islands": (direction) => ({
    enter: { y: direction > 0 ? 150 : -150, rotate: direction > 0 ? 8 : -8, opacity: 0 },
    center: { y: 0, rotate: 0, opacity: 1, transition: { type: "spring", stiffness: 110, damping: 15 } },
    exit: { y: direction > 0 ? -150 : 150, rotate: direction > 0 ? -8 : 8, opacity: 0, transition: { duration: 0.4 } }
  }),
  "ripple": () => ({
    enter: { scale: 0.9, opacity: 0, filter: "contrast(1.5) brightness(1.2)" },
    center: { scale: 1, opacity: 1, filter: "none", transition: { duration: 0.5, ease: "easeOut" } },
    exit: { scale: 1.05, opacity: 0, transition: { duration: 0.4 } }
  }),
  "card-conveyor": (direction) => ({
    enter: { x: direction > 0 ? 350 : -350, rotateY: 45, scale: 0.8, opacity: 0 },
    center: { x: 0, rotateY: 0, scale: 1, opacity: 1, transition: { type: "spring", stiffness: 140, damping: 20 } },
    exit: { x: direction > 0 ? -350 : 350, rotateY: -45, scale: 0.8, opacity: 0, transition: { duration: 0.45 } }
  }),
  "light-sweep": () => ({
    enter: { opacity: 0 },
    center: { opacity: 1, transition: { duration: 0.45, ease: "easeOut" } },
    exit: { opacity: 0, transition: { duration: 0.4 } }
  })
};

export default function Today() {
  const today = getTodayStr();
  const { data: summary, isLoading: sLoading } = useGetTodaySummary({ date: today });
  const { data: reflection, isLoading: rLoading } = useGetReflection(today, { query: { enabled: !!today, queryKey: getGetReflectionQueryKey(today) } });
  
  // Quick Tasks Section
  const { data: quickTasks, isLoading: qtLoading } = useListQuickTasks({ date: today });
  const { data: categories, isLoading: catLoading } = useListCategories();
  const { data: allRoutines, isLoading: routLoading } = useListRoutines({ includeArchived: false });
  const createQuickTask = useCreateQuickTask();

  const isTodayLoading = sLoading || rLoading || qtLoading || catLoading || routLoading;

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<number | null>(null);
  const [isExpandingDetails, setIsExpandingDetails] = useState(false);

  const upsertReflection = useUpsertReflection();
  const queryClient = useQueryClient();

  // State hooks for reflection
  const [energy, setEnergy] = useState<"low" | "medium" | "high" | null>(null);
  const [focusRating, setFocusRating] = useState<number | null>(null);
  const [dayRating, setDayRating] = useState<number | null>(null);
  const [journal, setJournal] = useState("");
  const [promptAnswer, setPromptAnswer] = useState("");

  // Tomorrow Room options
  const [tomorrowFocus, setTomorrowFocus] = useState("Deep Work");
  const [tomorrowTask, setTomorrowTask] = useState("");
  const [journeyCompleted, setJourneyCompleted] = useState(false);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (reflection && !initializedRef.current) {
      setEnergy(reflection.energy || null);
      setFocusRating(reflection.focusRating || null);
      setDayRating(reflection.dayRating || null);
      setJournal(reflection.journal || "");
      setPromptAnswer(reflection.reflectionAnswer || "");
      initializedRef.current = true;
    }
  }, [reflection]);

  const handleSaveField = (fieldName: string, value: any) => {
    upsertReflection.mutate({
      date: today,
      data: { [fieldName]: value }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetReflectionQueryKey(today) });
      }
    });
  };

  const pct = Math.round(summary?.completionPercentage || 0);
  const reducedMotion = useReducedMotion();

  // Deterministic daily reflection prompt
  const selectedPrompt = useMemo(() => {
    const day = new Date().getDate();
    return REFLECTION_PROMPTS[day % REFLECTION_PROMPTS.length];
  }, []);

  // Estimated Completion Time formula
  const estimatedFinishTime = useMemo(() => {
    if (!summary?.routines) return "N/A";
    const incomplete = summary.routines.filter(r => !r.completed);
    if (incomplete.length === 0) return "All done!";
    
    let totalRemainingMinutes = 0;
    incomplete.forEach(r => {
      if (r.type === "duration") {
        const remainingSeconds = r.targetDurationSeconds ? Math.max(0, r.targetDurationSeconds - r.elapsedSeconds) : 900;
        totalRemainingMinutes += remainingSeconds / 60;
      } else {
        totalRemainingMinutes += 20; // Default estimate
      }
    });

    const now = new Date();
    const finishDate = new Date(now.getTime() + totalRemainingMinutes * 60000);
    
    return finishDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  }, [summary?.routines]);

  // Longest focus session today
  const longestSession = useMemo(() => {
    if (!summary?.routines) return "0m";
    const durations = summary.routines.filter(r => r.type === "duration");
    if (durations.length === 0) return "0m";
    const maxElapsed = Math.max(...durations.map(r => r.elapsedSeconds));
    if (maxElapsed === 0) return "0m";
    const h = Math.floor(maxElapsed / 3600);
    const m = Math.floor((maxElapsed % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [summary?.routines]);

  // Real history stats
  const realHistoryStats = useMemo(() => {
    const raw = localStorage.getItem("logs_v4");
    if (!raw) return null;
    try {
      const logs = JSON.parse(raw) as Record<string, Record<number, { completed: boolean; completedAt?: string; elapsedSeconds?: number; value?: number }>>;
      
      let highestStreak = 0;
      let tempStreak = 0;
      let longestFocusSeconds = 0;
      
      const dates = Object.keys(logs).sort();
      let lastDate: Date | null = null;
      let streakRuns: number[] = [];
      
      for (const dateStr of dates) {
        const dayLogs = logs[dateStr];
        let dayHasCompletion = false;
        for (const routineIdStr in dayLogs) {
          const l = dayLogs[routineIdStr];
          if (l.completed) {
            dayHasCompletion = true;
          }
          if (l.elapsedSeconds && l.elapsedSeconds > longestFocusSeconds) {
            longestFocusSeconds = l.elapsedSeconds;
          }
        }
        
        if (dayHasCompletion) {
          if (lastDate) {
            const diffTime = Math.abs(new Date(dateStr).getTime() - lastDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
              tempStreak++;
            } else {
              streakRuns.push(tempStreak);
              tempStreak = 1;
            }
          } else {
            tempStreak = 1;
          }
          lastDate = new Date(dateStr);
        } else {
          if (tempStreak > 0) {
            streakRuns.push(tempStreak);
            tempStreak = 0;
          }
        }
      }
      if (tempStreak > 0) {
        streakRuns.push(tempStreak);
      }
      highestStreak = streakRuns.length > 0 ? Math.max(...streakRuns) : 0;
      
      let morningCount = 0;
      let afternoonCount = 0;
      let eveningCount = 0;
      let nightCount = 0;
      let totalCompletedCount = 0;
      const weekdayCompletions = Array(7).fill(0);
      
      for (const dateStr of dates) {
        const dayLogs = logs[dateStr];
        const dObj = new Date(dateStr);
        const wday = dObj.getDay();
        
        for (const rId in dayLogs) {
          const l = dayLogs[rId];
          if (l.completed) {
            totalCompletedCount++;
            weekdayCompletions[wday]++;
            
            if (l.completedAt) {
              const hour = new Date(l.completedAt).getHours();
              if (hour >= 5 && hour < 12) morningCount++;
              else if (hour >= 12 && hour < 17) afternoonCount++;
              else if (hour >= 17 && hour < 22) eveningCount++;
              else nightCount++;
            } else {
              morningCount++;
            }
          }
        }
      }
      
      const sumRhythms = morningCount + afternoonCount + eveningCount + nightCount;
      const morningPct = sumRhythms > 0 ? Math.round((morningCount / sumRhythms) * 100) : 0;
      const afternoonPct = sumRhythms > 0 ? Math.round((afternoonCount / sumRhythms) * 100) : 0;
      const eveningPct = sumRhythms > 0 ? Math.round((eveningCount / sumRhythms) * 100) : 0;
      
      let peakDayIdx = -1;
      let maxWdayVal = -1;
      for (let i = 0; i < 7; i++) {
        if (weekdayCompletions[i] > maxWdayVal) {
          maxWdayVal = weekdayCompletions[i];
          peakDayIdx = i;
        }
      }
      
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const peakDay = maxWdayVal > 0 ? daysOfWeek[peakDayIdx] : "None yet";
      
      let totalCompletionPctSum = 0;
      let loggedDaysCount = 0;
      
      for (const dateStr of dates) {
        const dayLogs = logs[dateStr];
        let completedInDay = 0;
        let loggedInDay = Object.keys(dayLogs).length;
        if (loggedInDay > 0) {
          for (const rId in dayLogs) {
            if (dayLogs[rId].completed) completedInDay++;
          }
          totalCompletionPctSum += (completedInDay / loggedInDay) * 100;
          loggedDaysCount++;
        }
      }
      
      const averageCompletion = loggedDaysCount > 0 ? Math.round(totalCompletionPctSum / loggedDaysCount) : 0;
      
      return {
        highestStreak,
        longestFocusSeconds,
        morningPct,
        afternoonPct,
        eveningPct,
        peakDay,
        averageCompletion,
        loggedDaysCount,
        totalCompletedCount,
        hasHistory: dates.length > 0 && totalCompletedCount > 0
      };
    } catch (e) {
      return null;
    }
  }, [summary]);

  const rhythmStats = useMemo(() => {
    if (realHistoryStats && realHistoryStats.hasHistory) {
      return {
        morning: realHistoryStats.morningPct,
        afternoon: realHistoryStats.afternoonPct,
        evening: realHistoryStats.eveningPct,
      };
    }
    return { morning: 35, afternoon: 45, evening: 20 };
  }, [realHistoryStats]);

  // Immersive greeting logic
  const immersiveGreeting = useMemo(() => {
    const hour = new Date().getHours();
    let text = "Good Evening, companion. Let's trace today's path.";
    if (hour < 12) text = "Good Morning, explorer. A fresh start awaits.";
    else if (hour < 17) text = "Good Afternoon, adventurer. Stay steady.";
    else if (hour < 22) text = "Good Evening, companion. Reflect and wind down.";
    else text = "Good Night, traveler. Capture your thoughts.";
    return text;
  }, []);

  // Guided daily scenes setup (7 scenes)
  const [activeScene, setActiveScene] = useState(0);
  const [direction, setDirection] = useState(0);
  const [activeTransition, setActiveTransition] = useState("camera-fly");
  const lastScrollTime = useRef(0);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  const totalScenes = 7;

  const navigateTo = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= totalScenes) return;

    // Choose next transition using the Motion Director logic
    const preferredAnimationsByScene: Record<number, string[]> = {
      0: ["camera-fly", "ripple", "light-sweep"],
      1: ["card-conveyor", "particle-transition", "magnetic-pull"],
      2: ["liquid-morph", "time-warp", "orbit-transition"],
      3: ["vertical-elevator", "parallax-layers", "fold-transition"],
      4: ["depth-transition", "curtain-reveal", "layer-peel"],
      5: ["focus-pull", "object-morph", "portal-transition"],
      6: ["floating-islands", "card-explosion", "camera-fly"]
    };

    const preferred = preferredAnimationsByScene[nextIndex] || ["camera-fly"];
    
    // Filter out activeTransition to prevent immediate consecutive repetition
    let suitable = preferred.filter(anim => anim !== activeTransition);
    
    // If empty (e.g. all filtered), fallback to any other of the 20 transition styles (except activeTransition)
    if (suitable.length === 0) {
      const allAnims = Object.keys(ANIMATION_VARIANTS);
      suitable = allAnims.filter(anim => anim !== activeTransition);
    }
    
    // Select one randomly
    const selectedAnim = suitable[Math.floor(Math.random() * suitable.length)];
    
    setActiveTransition(selectedAnim);
    setDirection(nextIndex > activeScene ? 1 : -1);
    setActiveScene(nextIndex);
  }, [activeScene, activeTransition]);

  // Wheel listener for camera navigation
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 15) return;
      const now = Date.now();
      if (now - lastScrollTime.current < 750) return;

      if (e.deltaY > 0) {
        if (activeScene < totalScenes - 1) {
          lastScrollTime.current = now;
          navigateTo(activeScene + 1);
        }
      } else {
        if (activeScene > 0) {
          lastScrollTime.current = now;
          navigateTo(activeScene - 1);
        }
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [activeScene, navigateTo]);

  // Keyboard arrows listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        navigateTo(activeScene + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        navigateTo(activeScene - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeScene, navigateTo]);

  // Swipe gestures
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        navigateTo(activeScene + 1);
      } else {
        navigateTo(activeScene - 1);
      }
    }
  };

  // Predict tomorrow's completion
  const predictedCompletion = useMemo(() => {
    if (realHistoryStats && realHistoryStats.hasHistory) {
      return Math.round((pct + realHistoryStats.averageCompletion) / 2);
    }
    return Math.max(50, pct);
  }, [pct, realHistoryStats]);

  // Combine routines and quick tasks for a unified visual timeline
  const combinedTimelineItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      completed: boolean;
      type: "routine" | "task";
      categoryColor?: string;
    }> = [];

    (summary?.routines || []).forEach(r => {
      const category = categories?.find(c => c.id === r.categoryId);
      items.push({
        id: `routine-${r.routineId}`,
        title: r.name,
        subtitle: routineStatusLabel(r),
        completed: r.completed,
        type: "routine",
        categoryColor: category?.color
      });
    });

    (quickTasks || []).forEach(t => {
      const category = categories?.find(c => c.id === t.categoryId);
      items.push({
        id: `task-${t.id}`,
        title: t.title,
        subtitle: t.notes || "Quick Milestone",
        completed: t.completed,
        type: "task",
        categoryColor: category?.color
      });
    });

    return items;
  }, [summary?.routines, quickTasks, categories]);

  // Atmosphere descriptions
  const ROOMS = [
    { name: "Summary", theme: "Serene Sanctuary", bg: "from-slate-950 via-slate-900 to-black text-slate-100" },
    { name: "Progress", theme: "Vibrant Engine", bg: "from-[#080d1a] via-[#050810] to-black text-white" },
    { name: "Mood", theme: "Cosmic Reflection", bg: "from-[#1a0c30] via-[#0b0618] to-black text-purple-100" },
    { name: "Timeline", theme: "Aesthetic Chronology", bg: "from-[#1f1b18] via-[#151210] to-[#0c0a09] text-[#f4f1eb]" },
    { name: "Insights", theme: "Data Grid", bg: "from-[#111316] via-[#0b0c0e] to-black text-slate-200" },
    { name: "Reflection", theme: "Ink & Paper", bg: "from-[#faf8f5] via-[#f7f4ed] to-[#f0ece3] text-[#1c1a17]" },
    { name: "Tomorrow", theme: "Aesthetic Anticipation", bg: "from-[#1a1710] via-[#0e0d0a] to-[#050504] text-slate-100" }
  ];

  const currentRoom = ROOMS[activeScene];

  // Specific physical motion transition profiles using Motion Director
  const getVariants = () => {
    const resolver = ANIMATION_VARIANTS[activeTransition];
    if (resolver) {
      return resolver(direction);
    }
    return {
      enter: { opacity: 0 },
      center: { opacity: 1 },
      exit: { opacity: 0 }
    };
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    playKeypressSound();
  };

  return (
    <div 
      className={cn(
        "w-full h-screen overflow-hidden relative select-none bg-gradient-to-tr transition-all duration-1000",
        currentRoom.bg
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Floating navigation dot indicators (right side) */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3.5 z-40 hidden sm:flex">
        {ROOMS.map((room, idx) => {
          return (
            <button
              key={idx}
              onClick={() => navigateTo(idx)}
              className="flex items-center gap-3 group focus:outline-none cursor-pointer"
            >
              <span className={cn(
                "text-[9px] font-mono uppercase tracking-widest opacity-0 group-hover:opacity-80 transition-all duration-300",
                activeScene === 5 ? "text-slate-800" : "text-white/60"
              )}>
                {room.name}
              </span>
              <div 
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-300 border",
                  activeScene === idx 
                    ? "bg-primary border-primary scale-125 shadow-[0_0_8px_hsl(var(--primary))]" 
                    : activeScene === 5
                      ? "bg-slate-300 border-slate-400 hover:border-slate-800"
                      : "bg-white/10 border-white/20 hover:border-white/50"
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Top breadcrumb of the active scene */}
      <div className={cn(
        "absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-40 backdrop-blur-md border px-4 py-2 rounded-full text-[10px] font-mono font-bold transition-all duration-500",
        activeScene === 5
          ? "bg-slate-200/50 border-slate-300 text-slate-800"
          : "bg-black/30 border-white/10 text-white/80"
      )}>
        <span className="text-primary font-black">{activeScene + 1}</span> / <span>{totalScenes}</span>
        <span className="opacity-30">•</span>
        <span className="uppercase tracking-widest">{currentRoom.theme}</span>
      </div>

      {/* Main viewport for current scene */}
      <div className="w-full h-full relative z-10 flex items-center justify-center p-4 md:p-8 max-h-full">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={activeScene}
            custom={direction}
            variants={getVariants()}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full max-w-4xl h-full flex flex-col justify-center items-center relative overflow-hidden"
          >
            {/* ── ROOM 1: Today's Summary (Serene Sanctuary) ── */}
            {activeScene === 0 && (
              <div className="flex flex-col items-center text-center space-y-7 w-full px-4 max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative shadow-xl"
                >
                  <Compass className="w-7 h-7 text-primary/80 animate-spin" style={{ animationDuration: "35s" }} />
                  {/* Subtle pulsing ambient light */}
                  <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                </motion.div>
                
                <div className="space-y-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-extrabold bg-primary/10 px-3 py-1 rounded-full">Atmosphere: Sanctuary</span>
                  <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight font-sans">
                    {immersiveGreeting}
                  </h1>
                  <p className="text-muted-foreground text-xs md:text-sm max-w-lg mx-auto font-medium">
                    Today is <span className="text-foreground font-semibold">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>.
                  </p>
                </div>

                <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 w-full">
                  <Card className="p-4 border-white/5 bg-card/20 flex flex-col items-center justify-center shadow-lg hover:bg-card/30 transition-all rounded-2xl">
                    <Flame className="w-5 h-5 text-orange-500 mb-1.5" />
                    <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Active Streak</span>
                    <span className="text-lg font-bold text-foreground mt-0.5">{summary?.currentStreak || 0} Days</span>
                  </Card>

                  <Card className="p-4 border-white/5 bg-card/20 flex flex-col items-center justify-center shadow-lg hover:bg-card/30 transition-all rounded-2xl">
                    <Target className="w-5 h-5 text-primary mb-1.5" />
                    <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Completed</span>
                    <span className="text-lg font-bold text-foreground mt-0.5">{pct}%</span>
                  </Card>

                  <Card className="p-4 border-white/5 bg-card/20 flex flex-col items-center justify-center shadow-lg hover:bg-card/30 transition-all rounded-2xl">
                    <Clock className="w-5 h-5 text-sky-400 mb-1.5" />
                    <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Estimated Finish</span>
                    <span className="text-sm font-bold text-foreground mt-1 truncate max-w-full">{estimatedFinishTime}</span>
                  </Card>

                  <Card className="p-4 border-white/5 bg-card/20 flex flex-col items-center justify-center shadow-lg hover:bg-card/30 transition-all rounded-2xl">
                    <Brain className="w-5 h-5 text-violet-400 mb-1.5" />
                    <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">Longest Focus</span>
                    <span className="text-lg font-bold text-foreground mt-0.5">{longestSession}</span>
                  </Card>
                </div>

                <motion.button 
                  onClick={() => navigateTo(1)}
                  className="flex flex-col items-center gap-1 text-muted-foreground/50 hover:text-primary transition-all duration-300 pt-6 focus:outline-none cursor-pointer"
                  animate={{ y: [0, 6, 0] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                >
                  <span className="text-[9px] font-mono uppercase tracking-widest">Next Chamber: Progress</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            )}

            {/* ── ROOM 2: Progress (Vibrant Engine) ── */}
            {activeScene === 1 && (
              <div className="flex flex-col items-center text-center space-y-6 w-full max-w-2xl px-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">Zenith Rings</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-white">Vibrant Progress Engine</h2>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    A beautiful feedback visualization of today's completed milestones.
                  </p>
                </div>

                {/* Glassy Glowing Arc Ring */}
                <div className="relative w-56 h-56 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="112"
                      cy="112"
                      r="76"
                      className="stroke-white/5"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="112"
                      cy="112"
                      r="76"
                      className="stroke-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                      strokeWidth="10"
                      strokeDasharray="477"
                      initial={{ strokeDashoffset: 477 }}
                      animate={{ strokeDashoffset: 477 - (477 * pct) / 100 }}
                      transition={{ type: "spring", stiffness: 45, damping: 15 }}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black text-cyan-300 font-mono tracking-tighter">
                      <AnimatedPercentage value={pct} reducedMotion={reducedMotion} />
                    </span>
                    <span className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-widest mt-1 font-semibold">
                      Total Output
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                    You have securely completed <span className="text-white font-bold">{summary?.completedCount || 0}</span> of <span className="text-white font-bold">{summary?.activeCount || 0}</span> routines active today.
                  </p>
                  
                  <button
                    onClick={() => setIsAnalyticsOpen(true)}
                    className="rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold text-xs transition-all px-5 py-2.5 cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.15)] hover:shadow-[0_0_18px_rgba(6,182,212,0.3)]"
                  >
                    Analyze Rhythm Waves
                  </button>
                </div>

                {/* Performance Waves Modal Overlay */}
                <AnimatePresence>
                  {isAnalyticsOpen && (
                    <motion.div 
                      className="absolute inset-0 bg-slate-950/95 backdrop-blur-md rounded-3xl p-6 border border-white/10 z-50 flex flex-col justify-between"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-cyan-400" />
                            <h3 className="text-base font-bold text-white">Daily Rhythm Waves</h3>
                          </div>
                          <button 
                            onClick={() => setIsAnalyticsOpen(false)}
                            className="text-xs bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1 rounded-lg text-slate-300 transition-all cursor-pointer"
                          >
                            Close Analyzer
                          </button>
                        </div>
                        <p className="text-slate-400 text-xs leading-relaxed text-left">
                          Analyze the exact periods when you maintain optimal focus based on your completed entries over time.
                        </p>

                        <div className="space-y-4 pt-4 text-left">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-mono flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500" /> Morning Rhythm (5 AM - 12 PM)
                              </span>
                              <span className="text-white font-bold font-mono">{rhythmStats.morning}%</span>
                            </div>
                            <AnimatedProgressBar value={rhythmStats.morning} colorClass="bg-amber-500" />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-mono flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-cyan-500" /> Afternoon Momentum (12 PM - 5 PM)
                              </span>
                              <span className="text-white font-bold font-mono">{rhythmStats.afternoon}%</span>
                            </div>
                            <AnimatedProgressBar value={rhythmStats.afternoon} colorClass="bg-cyan-500" />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-mono flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500" /> Evening Reflection (5 PM - 10 PM)
                              </span>
                              <span className="text-white font-bold font-mono">{rhythmStats.evening}%</span>
                            </div>
                            <AnimatedProgressBar value={rhythmStats.evening} colorClass="bg-indigo-500" />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-3.5 flex justify-between items-center text-[10px] font-mono text-slate-500">
                        <span>EST. OVERALL AVERAGE: {realHistoryStats?.averageCompletion || 0}%</span>
                        <span>BEST STREAK DAY: {realHistoryStats?.peakDay || "None"}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── ROOM 3: Mood & Energy (Cosmic Reflection) ── */}
            {activeScene === 2 && (
              <div className="flex flex-col items-center text-center space-y-6 w-full max-w-2xl px-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400 font-bold">Stardust Well-being</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-white">Cosmic Mind Reflection</h2>
                  <p className="text-xs text-purple-200/60 max-w-sm mx-auto">
                    Record your emotional frequencies below to map daily trends.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5 w-full pt-2">
                  <Card className="p-5 border-white/5 bg-purple-950/10 flex flex-col justify-between gap-4 text-left rounded-2xl relative overflow-hidden backdrop-blur-xl">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
                    <div>
                      <div className="flex items-center gap-2 text-purple-300 mb-1.5">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-[9px] uppercase tracking-wider font-mono font-bold">Vibration</span>
                      </div>
                      <h3 className="text-xs font-semibold text-purple-100">Daily energy levels?</h3>
                    </div>
                    <div className="flex flex-col gap-1.5 pt-2">
                      {[
                        { id: "low", label: "🔴 Low Vibe", activeBg: "bg-red-500/20 border-red-500/50 text-white" },
                        { id: "medium", label: "🟡 Gentle Flow", activeBg: "bg-amber-500/20 border-amber-500/50 text-white" },
                        { id: "high", label: "🟢 Radiant Light", activeBg: "bg-emerald-500/20 border-emerald-500/50 text-white" }
                      ].map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => {
                            setEnergy(btn.id as any);
                            handleSaveField("energy", btn.id);
                          }}
                          className={`w-full py-1.5 text-[10px] font-semibold rounded-xl border transition-all cursor-pointer ${
                            energy === btn.id ? btn.activeBg : "bg-white/5 text-purple-300/60 border-transparent hover:bg-white/10"
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-5 border-white/5 bg-purple-950/10 flex flex-col justify-between gap-4 text-left rounded-2xl relative overflow-hidden backdrop-blur-xl">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
                    <div>
                      <div className="flex items-center gap-2 text-purple-300 mb-1.5">
                        <Brain className="w-4 h-4 text-cyan-400" />
                        <span className="text-[9px] uppercase tracking-wider font-mono font-bold">Focus</span>
                      </div>
                      <h3 className="text-xs font-semibold text-purple-100">Quality of attention?</h3>
                    </div>
                    <div className="flex items-center justify-between px-1 py-4">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            setFocusRating(val);
                            handleSaveField("focusRating", val);
                          }}
                          className="group flex flex-col items-center gap-1 focus:outline-none cursor-pointer"
                        >
                          <Star 
                            className={`w-4 h-4 transition-all group-hover:scale-110 ${
                              focusRating !== null && val <= focusRating 
                                ? "text-cyan-400 fill-cyan-400/20" 
                                : "text-purple-300/20 hover:text-cyan-400"
                            }`} 
                          />
                          <span className="text-[8px] font-mono text-purple-300/40">{val}</span>
                        </button>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-5 border-white/5 bg-purple-950/10 flex flex-col justify-between gap-4 text-left rounded-2xl relative overflow-hidden backdrop-blur-xl">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
                    <div>
                      <div className="flex items-center gap-2 text-purple-300 mb-1.5">
                        <Star className="w-4 h-4 text-violet-400" />
                        <span className="text-[9px] uppercase tracking-wider font-mono font-bold">Gratitude</span>
                      </div>
                      <h3 className="text-xs font-semibold text-purple-100">Deep inner satisfaction?</h3>
                    </div>
                    <div className="flex items-center justify-between px-1 py-4">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            setDayRating(val);
                            handleSaveField("dayRating", val);
                          }}
                          className="group flex flex-col items-center gap-1 focus:outline-none cursor-pointer"
                        >
                          <Star 
                            className={`w-4 h-4 transition-all group-hover:scale-110 ${
                              dayRating !== null && val <= dayRating 
                                ? "text-violet-400 fill-violet-400/20" 
                                : "text-purple-300/20 hover:text-violet-400"
                            }`} 
                          />
                          <span className="text-[8px] font-mono text-purple-300/40">{val}</span>
                        </button>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* ── ROOM 4: Timeline (Aesthetic Chronology) ── */}
            {activeScene === 3 && (
              <div className="flex flex-col items-center space-y-5 w-full h-[90%] max-w-2xl px-4 text-left">
                <div className="text-center space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-600/80 font-bold">Chronology</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-[#eeeade] font-serif">Today's Chronicle</h2>
                  <p className="text-xs text-amber-100/50 italic max-w-sm mx-auto">
                    A warm, classic layout preserving the chronological trail.
                  </p>
                </div>

                <div className="w-full flex-1 overflow-y-auto pr-2 border border-amber-500/10 bg-[#141210] rounded-2xl p-5 md:p-6 space-y-6">
                  {combinedTimelineItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-20 text-amber-100/40">
                      <BookOpen className="w-10 h-10 mb-3 opacity-30 text-amber-500" />
                      <p className="font-mono text-[10px] uppercase tracking-wider">The slate remains clean.</p>
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6">
                      <div className="absolute left-[11px] top-2 bottom-2 w-px border-l border-dashed border-amber-500/20" />

                      {combinedTimelineItems.map((item) => (
                        <div key={item.id} className="relative flex items-start gap-4">
                          <div 
                            className={cn(
                              "absolute -left-[20px] w-3 h-3 rounded-full border transition-all duration-300 z-10 bg-[#141210]",
                              item.completed 
                                ? "border-amber-400 bg-amber-400/20 shadow-[0_0_6px_rgba(251,191,36,0.3)]" 
                                : "border-[#3e3a36]"
                            )}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn(
                                "font-serif text-sm",
                                item.completed ? "text-amber-100/30 line-through" : "text-[#eeeade] font-medium"
                              )}>
                                {item.title}
                              </span>
                              <span className="text-[8px] font-mono text-amber-300/40 bg-amber-950/10 border border-amber-900/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {item.type === "routine" ? "Routine" : "Task"}
                              </span>
                            </div>
                            <p className="text-[10px] text-amber-100/40 font-mono mt-0.5 truncate">{item.subtitle}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ROOM 5: Insights (Data Grid) ── */}
            {activeScene === 4 && (
              <div className="flex flex-col items-center space-y-6 w-full text-center max-w-3xl px-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">Metadata logs</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-100 font-sans">Historical Telemetry</h2>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Direct cryptographic history parsed from database indexes.
                  </p>
                </div>

                {realHistoryStats && realHistoryStats.hasHistory ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                    <Card className="p-5 border-white/5 bg-slate-900/10 flex flex-col justify-between text-left h-36 rounded-2xl">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Max Streak</span>
                      <div>
                        <div className="text-xl font-bold text-slate-100 font-mono">{realHistoryStats.highestStreak} Days</div>
                        <span className="text-[9px] text-emerald-400 font-mono">Persistence Curve</span>
                      </div>
                    </Card>

                    <Card className="p-5 border-white/5 bg-slate-900/10 flex flex-col justify-between text-left h-36 rounded-2xl">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Zenith Focus</span>
                      <div>
                        <div className="text-xl font-bold text-slate-100 font-mono">
                          {realHistoryStats.longestFocusSeconds > 0 
                            ? `${Math.floor(realHistoryStats.longestFocusSeconds / 3600)}h ${Math.floor((realHistoryStats.longestFocusSeconds % 3600) / 60)}m`
                            : "0m"
                          }
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono">True Personal Best</span>
                      </div>
                    </Card>

                    <Card className="p-5 border-white/5 bg-slate-900/10 flex flex-col justify-between text-left h-36 rounded-2xl">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Weekly Average</span>
                      <div>
                        <div className="text-xl font-bold text-slate-100 font-mono">{realHistoryStats.averageCompletion}%</div>
                        <span className="text-[9px] text-emerald-400 font-mono">Mean Completion</span>
                      </div>
                    </Card>

                    <Card className="p-5 border-white/5 bg-slate-900/10 flex flex-col justify-between text-left h-36 rounded-2xl">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Peak Peak Rhythm</span>
                      <div>
                        <div className="text-xl font-bold text-slate-100 font-mono">{realHistoryStats.peakDay}</div>
                        <span className="text-[9px] text-slate-400 font-mono">Active Frequency</span>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <Card className="p-10 border-dashed border-white/10 bg-slate-900/5 flex flex-col items-center justify-center text-center text-slate-400 max-w-md w-full rounded-2xl">
                    <Award className="w-8 h-8 mb-3 opacity-30 text-emerald-400" />
                    <p className="font-mono text-[10px] leading-relaxed uppercase tracking-wider">
                      Metadata calibrating. Complete routines on the board to seed database records.
                    </p>
                  </Card>
                )}
              </div>
            )}

            {/* ── ROOM 6: Reflection (Ink & Paper) ── */}
            {activeScene === 5 && (
              <div className="flex flex-col items-center space-y-4 w-full h-[90%] max-w-2xl px-4 text-left">
                <div className="text-center space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold">Ink & Paper</span>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-800 font-serif">Daily Reflections</h2>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto italic">
                    Type below. A physical typewriter sound simulates tactile ink strikes.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full flex-1 overflow-y-auto">
                  <Card className="p-5 border-slate-300 bg-white/70 flex flex-col justify-between gap-3 text-left rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Prompt Response</span>
                      <Label className="text-xs font-serif font-bold text-slate-800 block leading-tight">{selectedPrompt}</Label>
                      <textarea 
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-xs min-h-[110px] resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-800 font-serif leading-relaxed"
                        value={promptAnswer}
                        onKeyDown={handleKeyPress}
                        onChange={e => {
                          setPromptAnswer(e.target.value);
                          handleSaveField("reflectionAnswer", e.target.value);
                        }}
                        placeholder="Type your ink response here..."
                      />
                    </div>
                  </Card>

                  <Card className="p-5 border-slate-300 bg-white/70 flex flex-col justify-between gap-3 text-left rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">One Line Journal</span>
                      <Label className="text-xs font-serif font-bold text-slate-800 block leading-tight">Preserve today in one short, peaceful sentence.</Label>
                      <textarea 
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-xs min-h-[110px] resize-none focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-800 font-serif leading-relaxed"
                        value={journal}
                        onKeyDown={handleKeyPress}
                        onChange={e => {
                          setJournal(e.target.value);
                          handleSaveField("journal", e.target.value);
                        }}
                        placeholder="Today felt memorable because..."
                      />
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* ── ROOM 7: Tomorrow (Aesthetic Anticipation) ── */}
            {activeScene === 6 && (
              <div className="flex flex-col items-center text-center space-y-6 w-full max-w-2xl px-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">Outlook</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-white">Aesthetic Anticipation</h2>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Configure your focal area and prime tomorrow's schedule cleanly.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
                  <Card className="p-5 border-white/5 bg-amber-950/5 rounded-2xl relative overflow-hidden flex flex-col justify-between gap-3.5">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-amber-400 uppercase tracking-widest font-bold">Choice Focus Area</span>
                      <h3 className="text-xs font-semibold text-white">What is tomorrow's key priority?</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {["Deep Work", "Self Care", "Fitness", "Creative", "Social"].map(f => (
                        <button
                          key={f}
                          onClick={() => {
                            setTomorrowFocus(f);
                            toast.info(`Tomorrow's primary anchor set to: ${f}`);
                          }}
                          className={cn(
                            "py-2 px-3 text-[10px] font-bold rounded-xl border text-center transition-all cursor-pointer",
                            tomorrowFocus === f 
                              ? "bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-md" 
                              : "bg-white/5 border-transparent text-slate-400 hover:bg-white/10"
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-5 border-white/5 bg-amber-950/5 rounded-2xl flex flex-col justify-between gap-3.5">
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-mono text-amber-400 uppercase tracking-widest font-bold">Schedule blocks</span>
                      <h3 className="text-xs font-semibold text-white">Tomorrow's scheduled routines</h3>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Expected velocity completion: <span className="text-amber-400 font-bold">{predictedCompletion}%</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {allRoutines && allRoutines.length > 0 ? (
                        allRoutines.slice(0, 4).map(r => (
                          <span key={r.id} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-slate-300">
                            {r.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[9px] font-mono text-slate-500">No active routines.</span>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => {
                      setJourneyCompleted(true);
                      toast.success("Daily Chapter completed. Returning to canvas!");
                      setTimeout(() => {
                        window.location.href = "/";
                      }, 1000);
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 text-amber-950 font-bold text-xs shadow-[0_0_20px_rgba(251,191,36,0.35)] hover:shadow-[0_0_25px_rgba(251,191,36,0.5)] transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.98]"
                  >
                    <Check className="w-4 h-4 stroke-[3px]" />
                    <span>Complete Today's Journey</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Manual Arrow Nav buttons in bottom-left */}
      <div className="absolute bottom-6 left-6 flex items-center gap-2.5 z-40">
        <Button
          variant="outline"
          size="icon"
          disabled={activeScene === 0}
          onClick={() => navigateTo(activeScene - 1)}
          className={cn(
            "w-8 h-8 rounded-full border cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center",
            activeScene === 5 
              ? "border-slate-300 bg-white/60 hover:bg-white text-slate-800 shadow-sm" 
              : "border-white/10 bg-black/40 hover:bg-black/60 text-white"
          )}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={activeScene === totalScenes - 1}
          onClick={() => navigateTo(activeScene + 1)}
          className={cn(
            "w-8 h-8 rounded-full border cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center justify-center",
            activeScene === 5 
              ? "border-slate-300 bg-white/60 hover:bg-white text-slate-800 shadow-sm" 
              : "border-white/10 bg-black/40 hover:bg-black/60 text-white"
          )}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
      <LightweightLoader isLoading={isTodayLoading} message="Computing Today's Statistics..." />
    </div>
  );
}
