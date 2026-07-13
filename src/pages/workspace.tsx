import { 
  useListRoutines, 
  useListConnections, 
  useGetTodaySummary, 
  useListCategories, 
  useUpdateRoutine, 
  getListRoutinesQueryKey,
  useCreateConnection,
  useIncrementLog, 
  useUpsertLog, 
  useStartTimer,
  usePauseTimer,
  getListConnectionsQueryKey,
  getGetTodaySummaryQueryKey,
  useListQuickTasks,
  useCreateQuickTask,
  useToggleQuickTask,
  useDeleteQuickTask,
  useUpdateQuickTask,
  useCreateRoutine,
  useDeleteRoutine,
  QuickTask
} from "@workspace/api-client-react";
import { getTodayStr, cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useDragControls, animate, useMotionValue, useSpring, AnimatePresence, useTransform } from "framer-motion";
import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { Card } from "@/components/ui";
import { Check, Plus, Loader2, Play, Pause, Trophy, Sparkles, Square, Trash2, ListTodo, ChevronRight, ChevronLeft, Settings, Download, Trash, Archive, Link2 } from "lucide-react";
import { RoutineProgress, Routine, Connection, Category } from "@workspace/api-client-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { toast } from "sonner";
import { CreateRoutineWizard } from "@/components/create-routine-wizard";
import { EditRoutineModal } from "@/components/edit-routine-modal";
import { CreateOneDayTaskModal } from "@/components/create-one-day-task-modal";
import { CircleMenu } from "@/components/ui/circle-menu";
import { LightweightLoader } from "@/components/lightweight-loader";

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── Ring Pop: animated SVG progress ring + checkmark ── */

const RING_SIZE = 36;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ percentage, completed, reducedMotion }: { percentage: number; completed: boolean; reducedMotion: boolean }) {
  const springOffset = useSpring(
    RING_CIRCUMFERENCE - (percentage / 100) * RING_CIRCUMFERENCE,
    reducedMotion ? { stiffness: 1000, damping: 100 } : { stiffness: 120, damping: 20 }
  );

  useEffect(() => {
    springOffset.set(RING_CIRCUMFERENCE - (percentage / 100) * RING_CIRCUMFERENCE);
  }, [percentage, springOffset]);

  return (
    <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={RING_STROKE}
      />
      <motion.circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        style={{ strokeDashoffset: springOffset }}
      />
    </svg>
  );
}

function AnimatedCheckmark({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="hsl(var(--primary))"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 15 }}
    >
      <motion.path
        d="M4 12l5 5L20 6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut", delay: 0.1 }}
      />
    </motion.svg>
  );
}

/* ── Haptic Compress spring config ── */
const hapticTapSpring = { type: "spring" as const, stiffness: 400, damping: 17 };

/* ── Quick Progress Actions adapt helper ── */
function getQuickIncrements(routine: Routine): { label: string; value: number }[] {
  const name = routine.name.toLowerCase();
  const unit = (routine.unit || "").toLowerCase();
  
  if (name.includes("water") || unit === "ml") {
    return [
      { label: "+250 mL", value: 250 },
      { label: "+500 mL", value: 500 }
    ];
  }
  if (name.includes("distance") || name.includes("run") || name.includes("walk") || unit === "km" || unit === "m") {
    if (unit === "km") {
      return [
        { label: "+0.5 km", value: 0.5 },
        { label: "+1 km", value: 1 },
        { label: "+5 km", value: 5 }
      ];
    }
    return [
      { label: "+100 m", value: 100 },
      { label: "+500 m", value: 500 },
      { label: "+1 km", value: 1000 }
    ];
  }
  if (name.includes("read") || name.includes("page")) {
    return [
      { label: "+1", value: 1 },
      { label: "+5", value: 5 },
      { label: "+10", value: 10 }
    ];
  }
  // Default numeric / push-ups
  return [
    { label: "+1", value: 1 },
    { label: "+5", value: 5 },
    { label: "+10", value: 10 },
    { label: "+25", value: 25 }
  ];
}

/* ── Animated counter displayed value ── */
function AnimatedNumber({ value }: { value: number }) {
  const motionVal = useMotionValue(value);
  const [displayVal, setDisplayVal] = useState(value);

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayVal(Math.round(latest))
    });
    return () => controls.stop();
  }, [value, motionVal]);

  return <span>{displayVal}</span>;
}

type AnimationType =
  | "strike_sink"
  | "card_fold"
  | "achievement_pulse"
  | "gravity_drop"
  | "particle_dissolve"
  | "stamp"
  | "portal"
  | "rocket_launch"
  | "vacuum"
  | "ribbon_wrap"
  | "flip_card"
  | "morph_checkmark"
  | "explosion"
  | "balloon_float"
  | "burn_away"
  | "origami_fold"
  | "domino"
  | "ink_spread"
  | "elastic_snap"
  | "celebration_burst";

function getWorkspaceLighting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      bg: "from-amber-500/10 via-background to-background",
      label: "Morning Light",
      color: "text-amber-500/40"
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      bg: "from-sky-500/10 via-background to-background",
      label: "Afternoon Zenith",
      color: "text-sky-500/40"
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      bg: "from-indigo-500/10 via-background to-background",
      label: "Evening Glow",
      color: "text-indigo-500/40"
    };
  } else {
    return {
      bg: "from-violet-950/25 via-background to-background",
      label: "Midnight Ambience",
      color: "text-violet-500/30"
    };
  }
}

function RoutineCard({ 
  routine, 
  progress, 
  category, 
  onDragEnd, 
  onDragActive,
  onInteract,
  routineState,
  isConnecting,
  onRightClick,
  currentStreak = 0,
  is100PercentDay = false,
  isFocusMode = false,
  isConnectedInFocus = false,
  isFocusedRoutine = false,
  isPrevious = false,
  isImmediateNext = false,
  isDownstream = false,
  isSuggested = false,
  scale: boardScale,
  isResetting = false
}: { 
  routine: Routine, 
  progress?: RoutineProgress, 
  category?: Category,
  onDragEnd: (id: number, x: number, y: number) => void,
  onDragActive?: (id: number, offset: { x: number; y: number }) => void,
  onInteract: () => void,
  routineState: 'settled' | 'active' | 'future',
  isConnecting: boolean,
  onRightClick: (e: React.MouseEvent) => void,
  currentStreak?: number,
  is100PercentDay?: boolean,
  isFocusMode?: boolean,
  isConnectedInFocus?: boolean,
  isFocusedRoutine?: boolean,
  isPrevious?: boolean,
  isImmediateNext?: boolean,
  isDownstream?: boolean,
  isSuggested?: boolean,
  scale?: any,
  isResetting?: boolean
}) {
  const dragControls = useDragControls();
  const reducedMotion = useReducedMotion();
  const isBoolean = routine.type === "boolean";
  const isDuration = routine.type === "duration";
  const isOpen = routine.type === "open";
  const hasTarget = routine.target !== null && routine.target !== undefined;
  const completed = progress?.completed ?? false;
  const percentage = progress?.progressPercentage ?? 0;
  const progressFactor = percentage / 100;
  const timerRunning = progress?.timerRunning ?? false;
  const elapsedSeconds = progress?.elapsedSeconds ?? 0;
  
  const categoryColor = category?.color ?? "var(--primary)";

  // Proximity states & handlers
  const cardRef = useRef<HTMLDivElement>(null);
  const [proximity, setProximity] = useState({ x: 0, y: 0, distance: 9999 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    setProximity({ x: dx, y: dy, distance: dist });
  };

  const handleMouseLeave = () => {
    setProximity({ x: 0, y: 0, distance: 9999 });
  };

  const currentScale = boardScale ? (typeof boardScale === 'number' ? boardScale : (boardScale.get ? boardScale.get() : 1)) : 1;

  // Actual physical boundary hover detection (card is 256px wide, ~96px tall)
  const hoverActive = Math.abs(proximity.x) <= 128 && Math.abs(proximity.y) <= 48;
  const hoverStrength = hoverActive ? 1.0 : 0;

  // Calm physical hover effects: 2-3px lift and 2-3 degrees tilt max
  const liftY = hoverActive ? -3 : 0;
  const scaleBoost = 1.015; // scales to 101.5%
  const proximityRotateX = hoverActive ? -(proximity.y / 48) * 2.5 : 0;
  const proximityRotateY = hoverActive ? (proximity.x / 128) * 2.5 : 0;

  // ── Ring Pop: detect the moment progress first reaches 100% ──
  const prevPercentageRef = useRef(percentage);
  const [showRingPop, setShowRingPop] = useState(false);
  const ringPopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevPercentageRef.current;
    if (prev < 100 && percentage >= 100 && !isBoolean && hasTarget) {
      setShowRingPop(true);
      ringPopTimerRef.current = setTimeout(() => setShowRingPop(false), 2000);
    }
    prevPercentageRef.current = percentage;
    return () => { if (ringPopTimerRef.current) clearTimeout(ringPopTimerRef.current); };
  }, [percentage, isBoolean, hasTarget]);

  // ── Living Completion Animation States & Animation Director ──
  const prevCompletedRef = useRef(completed);
  const originalActivePosRef = useRef({ x: routine.positionX, y: routine.positionY });

  useEffect(() => {
    if (!completed) {
      originalActivePosRef.current = { x: routine.positionX, y: routine.positionY };
    }
  }, [completed, routine.positionX, routine.positionY]);

  const [animationPhase, setAnimationPhase] = useState<'idle' | 'playing' | 'drifting' | 'settled'>(
    completed ? 'settled' : 'idle'
  );
  const [activeAnimation, setActiveAnimation] = useState<AnimationType | null>(null);
  const [confettiParticles, setConfettiParticles] = useState<{ id: number; x: number; y: number; color: string; scale: number; angle: number; speed: number }[]>([]);
  const [xpFloats, setXpFloats] = useState<{ id: number; text: string }[]>([]);
  const [showStamp, setShowStamp] = useState(false);
  const [showRibbon, setShowRibbon] = useState(false);
  const [flipActive, setFlipActive] = useState(false);
  const [inkSpreadActive, setInkSpreadActive] = useState(false);
  const [showTrophy, setShowTrophy] = useState(false);
  const [fireworks, setFireworks] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [paperAirplane, setPaperAirplane] = useState(false);
  const [dissolved, setDissolved] = useState(false);

  useEffect(() => {
    const prev = prevCompletedRef.current;
    if (!prev && completed) {
      // ── Animation Director: Selection Logic ──
      const isMilestone = currentStreak === 7 || currentStreak === 30 || is100PercentDay;
      
      let selectedAnim: AnimationType;
      
      if (isMilestone) {
        selectedAnim = "celebration_burst";
      } else {
        const rand = Math.random() * 100;
        if (rand < 55) { // Common (55% weight)
          const list: AnimationType[] = ["strike_sink", "achievement_pulse", "ink_spread", "elastic_snap", "morph_checkmark", "flip_card"];
          selectedAnim = list[Math.floor(Math.random() * list.length)];
        } else if (rand < 90) { // Occasional (35% weight)
          const list: AnimationType[] = ["card_fold", "gravity_drop", "ribbon_wrap", "vacuum", "balloon_float", "origami_fold", "stamp", "domino"];
          selectedAnim = list[Math.floor(Math.random() * list.length)];
        } else { // Rare (10% weight)
          const list: AnimationType[] = ["particle_dissolve", "portal", "rocket_launch", "burn_away", "explosion"];
          selectedAnim = list[Math.floor(Math.random() * list.length)];
        }
      }

      setActiveAnimation(selectedAnim);
      setAnimationPhase('playing');
      onInteract();

      // Trigger animation-specific triggers
      if (selectedAnim === "strike_sink" || selectedAnim === "explosion" || selectedAnim === "celebration_burst" || selectedAnim === "achievement_pulse" || selectedAnim === "particle_dissolve") {
        const count = selectedAnim === "celebration_burst" ? 48 : (selectedAnim === "particle_dissolve" ? 14 : 20);
        const particles = Array.from({ length: count }).map((_, i) => ({
          id: i,
          x: 0,
          y: 0,
          color: selectedAnim === "celebration_burst" 
            ? ["#FFD700", "#FF4500", "#FF1493", "#00FFFF", "#ADFF2F"][Math.floor(Math.random() * 5)]
            : categoryColor,
          scale: Math.random() * 0.6 + 0.4,
          angle: Math.random() * 360,
          speed: Math.random() * 8 + (selectedAnim === "particle_dissolve" ? 2 : 4)
        }));
        setConfettiParticles(particles);
      }

      if (selectedAnim === "achievement_pulse") {
        setXpFloats([{ id: Date.now(), text: "+100 XP" }]);
      }

      if (selectedAnim === "celebration_burst") {
        setXpFloats([
          { id: Date.now(), text: "Milestone Cleared!" },
          { id: Date.now() + 1, text: "+500 XP" }
        ]);
        setShowTrophy(true);
        const fw = Array.from({ length: 5 }).map((_, i) => ({
          id: i,
          x: (Math.random() - 0.5) * 160,
          y: -80 - Math.random() * 80,
          color: ["#FFD700", "#FF4500", "#FF1493", "#00FFFF", "#00FF7F"][Math.floor(Math.random() * 5)]
        }));
        setFireworks(fw);
      }

      if (selectedAnim === "stamp") {
        setShowStamp(true);
      }

      if (selectedAnim === "ribbon_wrap") {
        setShowRibbon(true);
      }

      if (selectedAnim === "flip_card") {
        setFlipActive(true);
      }

      if (selectedAnim === "ink_spread") {
        setInkSpreadActive(true);
      }

      if (selectedAnim === "origami_fold") {
        setPaperAirplane(true);
      }

      if (selectedAnim === "particle_dissolve") {
        setTimeout(() => setDissolved(true), 400);
      }

      // Timing controls
      const playTimer = setTimeout(() => {
        setAnimationPhase('drifting');
      }, 800);

      const driftTimer = setTimeout(() => {
        setAnimationPhase('settled');
        setShowStamp(false);
        setShowRibbon(false);
        setFlipActive(false);
        setInkSpreadActive(false);
        setShowTrophy(false);
        setPaperAirplane(false);
        setDissolved(false);
        setFireworks([]);
      }, 1800); // 800ms playing + 1000ms drift (perfectly in the 700–1200 ms range)

      return () => {
        clearTimeout(playTimer);
        clearTimeout(driftTimer);
      };
    } else if (prev && !completed) {
      setAnimationPhase('idle');
      setActiveAnimation(null);
      setShowStamp(false);
      setShowRibbon(false);
      setFlipActive(false);
      setInkSpreadActive(false);
      setShowTrophy(false);
      setPaperAirplane(false);
      setDissolved(false);
      setFireworks([]);
    }
    prevCompletedRef.current = completed;
  }, [completed, categoryColor, currentStreak, is100PercentDay]);

  // Should we show the ring (for non-boolean routines with a target)?
  const showRing = !isBoolean && !isOpen && hasTarget;

  const incrementLog = useIncrementLog();
  const upsertLog = useUpsertLog();
  const startTimer = useStartTimer();
  const pauseTimer = usePauseTimer();
  const toggleQuickTask = useToggleQuickTask();
  const queryClient = useQueryClient();
  const today = getTodayStr();

  const handleToggle = () => {
    onInteract();
    if (routine.id < 0) {
      const taskId = -routine.id;
      toggleQuickTask.mutate({ id: taskId, completed: !completed }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["quick-tasks"] });
          queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey({ date: today }) });
        }
      });
    } else {
      upsertLog.mutate({
        data: { routineId: routine.id, date: today, completed: !completed }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey({ date: today }) });
        }
      });
    }
  };

  const handleIncrement = () => {
    onInteract();
    incrementLog.mutate({
      id: routine.id,
      data: { date: today, delta: 1 }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey({ date: today }) });
      }
    });
  };

  const handleQuickIncrement = (delta: number) => {
    onInteract();
    incrementLog.mutate({
      id: routine.id,
      data: { date: today, delta }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey({ date: today }) });
      }
    });
  };

  const handleToggleTimer = () => {
    onInteract();
    const mutation = timerRunning ? pauseTimer : startTimer;
    mutation.mutate({ id: routine.id, date: today }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey({ date: today }) });
      }
    });
  };

  // Haptic tap props — disabled when reduced motion is preferred
  const hapticTap = reducedMotion ? {} : { whileTap: { scale: 0.96 }, transition: hapticTapSpring };

  const yOffset = useMotionValue(0);
  const xOffset = useMotionValue(0);
  const rotate = useMotionValue(0);

  // Completed elements visual adjustments
  let opacity = 0.4;
  let saturate = 0.2;
  let brightness = 1.0;
  let scale = 0.95;
  let cardGlow = "none";
  let floatDistance = -8;
  let floatDuration = 4 + Math.random() * 3;

  // Custom visual overrides
  let rotateXVal = 0;
  let rotateYVal = 0;
  let skewYVal = 0;
  let scaleXVal = 1;
  let scaleYVal = 1;
  let borderStyle: string | undefined = undefined;

  if (completed) {
    if (animationPhase === 'playing') {
      opacity = 1.0;
      saturate = 1.15;
      brightness = 1.05; // Subtle vibrant glow boost
      scale = 0.98; // Shrinks slightly to approximately 97-98%

      if (activeAnimation === "elastic_snap") {
        scaleYVal = 0.82;
        scaleXVal = 1.12;
      } else if (activeAnimation === "card_fold") {
        rotateYVal = -45;
        skewYVal = 12;
        scale = 0.9;
      } else if (activeAnimation === "flip_card" || flipActive) {
        rotateYVal = 180;
      } else if (activeAnimation === "morph_checkmark") {
        scale = 0.7;
      } else if (activeAnimation === "domino") {
        rotateXVal = 35;
      } else if (activeAnimation === "origami_fold") {
        scale = 0.55;
        rotateYVal = 60;
        skewYVal = -15;
      } else if (activeAnimation === "portal") {
        scale = 0.25;
        rotateYVal = 180;
      } else if (activeAnimation === "particle_dissolve") {
        opacity = 0.35;
      } else if (activeAnimation === "burn_away") {
        borderStyle = `1px dashed ${categoryColor}`;
      }
      
      cardGlow = `0 0 45px ${categoryColor}dd, 0 0 20px ${categoryColor}9a`;
    } else if (animationPhase === 'drifting') {
      opacity = 0.85;
      saturate = 0.65; // Saturation decreases slightly
      brightness = 0.8; // Gradually loses brightness
      scale = 0.975; // Shrunk to 97.5%

      if (activeAnimation === "elastic_snap") {
        scaleYVal = 1.15;
        scaleXVal = 0.92;
      } else if (activeAnimation === "rocket_launch") {
        scaleYVal = 1.05;
        opacity = 0.9;
      } else if (activeAnimation === "vacuum") {
        scaleYVal = 1.12;
        skewYVal = -3;
      } else if (activeAnimation === "portal") {
        scale = 0.05;
        opacity = 0.1;
      } else if (activeAnimation === "origami_fold") {
        scale = 0.2;
        opacity = 0.3;
      } else if (activeAnimation === "particle_dissolve") {
        opacity = 0.05;
      } else if (activeAnimation === "burn_away") {
        opacity = 0.15;
      }
      
      cardGlow = `0 0 25px ${categoryColor}3a`;
    } else {
      opacity = 0.55;
      saturate = 0.4;
      brightness = 0.65; // Final settled dimmed brightness
      scale = 0.95;
      floatDistance = -4;
      floatDuration = 6 + Math.random() * 4;
    }
  } else if (routineState === 'active') {
    opacity = 1.0;
    saturate = 1.0;
    brightness = 1.0;
    scale = 1.0;
    cardGlow = `0 0 35px ${categoryColor}2a`;
  } else if (routineState === 'future') {
    opacity = 0.6;
    saturate = 0.5;
    brightness = 0.95;
    scale = 0.98;
  }

  if (isFocusMode) {
    if (isFocusedRoutine) {
      opacity = 0;
      scale = 0;
    } else if (isDownstream || isImmediateNext) {
      // Related connected downstream routines: fully visible and interactive
      opacity = 1.0;
      saturate = 1.0;
      scale = 1.0;
      cardGlow = `0 0 25px ${categoryColor}44`;
    } else {
      // Unrelated routines (upstream or disconnected): softly fade away, no interaction
      opacity = 0.25; // 25% opacity
      saturate = 0.35;
      scale = 0.96;
      cardGlow = "none";
    }
  }

  if (animationPhase === 'playing' && activeAnimation === "achievement_pulse") {
    scale = 1.08;
    cardGlow = `0 0 50px ${categoryColor}dd`;
  }

  useEffect(() => {
    if (completed && (animationPhase === 'playing' || animationPhase === 'drifting')) {
      if (activeAnimation === "gravity_drop" && animationPhase === 'playing') {
        const drop = animate(yOffset, [0, 50, 30, 45, 40], { duration: 0.9, ease: "easeOut" });
        return () => drop.stop();
      }
      if (activeAnimation === "balloon_float" && animationPhase === 'drifting') {
        const sway = animate(xOffset, [0, -25, 25, -12, 0], { duration: 2.2, ease: "easeInOut" });
        return () => sway.stop();
      }
      return;
    }

    const cy = animate(yOffset, [0, floatDistance, 0], { duration: floatDuration, repeat: Infinity, ease: "easeInOut" });
    const cx = animate(xOffset, [0, 4, 0], { duration: floatDuration * 1.2, repeat: Infinity, ease: "easeInOut" });
    const cr = animate(rotate, [0, 1.5, -1, 0], { duration: floatDuration * 1.5, repeat: Infinity, ease: "easeInOut" });

    return () => {
      cy.stop(); cx.stop(); cr.stop();
    };
  }, [xOffset, yOffset, rotate, floatDistance, floatDuration, completed, animationPhase, activeAnimation]);

  const isMorphed = activeAnimation === "morph_checkmark" && (animationPhase === 'playing' || animationPhase === 'drifting');
  const isFlipped = flipActive && animationPhase !== 'idle';

  return (
    <motion.div
      id={`routine-card-container-${routine.id}`}
      drag={!isFocusMode}
      dragControls={dragControls}
      dragMomentum={false}
      onDrag={(e, info) => {
        onDragActive?.(routine.id, info.offset);
      }}
      onDragEnd={(e, info) => {
        onDragEnd(routine.id, routine.positionX + info.offset.x, routine.positionY + info.offset.y);
      }}
      initial={{ 
        x: routine.positionX, 
        y: routine.positionY,
        opacity: isFocusMode && isFocusedRoutine ? 0 : 1,
        scale: isFocusMode && isFocusedRoutine ? 0 : 1
      }}
      animate={{ 
        x: (animationPhase === 'drifting' || animationPhase === 'settled') 
          ? routine.positionX 
          : originalActivePosRef.current.x, 
        y: (animationPhase === 'drifting' || animationPhase === 'settled') 
          ? routine.positionY 
          : originalActivePosRef.current.y,
        opacity: isFocusMode && isFocusedRoutine ? 0 : 1,
        scale: isFocusMode && isFocusedRoutine ? 0 : 1
      }}
      transition={
        reducedMotion ? { duration: 0 } :
        isResetting
          ? {
              type: "spring",
              stiffness: 15,
              damping: 12,
              mass: 1.2
            }
          : animationPhase === 'drifting'
          ? { 
              type: "tween", 
              duration: 1.0, 
              ease: [0.25, 0.1, 0.25, 1.0] 
            }
          : { type: "spring", stiffness: 300, damping: 30 }
      }
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
      className="absolute w-64 cursor-grab"
      style={{ 
        touchAction: "none", 
        filter: isFocusMode && !(isDownstream || isImmediateNext) ? "blur(1px)" : "blur(0px)",
        pointerEvents: (isFocusMode && !(isDownstream || isImmediateNext)) || isFocusedRoutine ? "none" : "auto"
      }}
      onContextMenu={onRightClick}
    >
      {/* Suggested Pick floating bubble */}
      <AnimatePresence>
        {isSuggested && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: -45, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary px-3 py-1.5 rounded-full text-[11px] font-bold text-primary-foreground shadow-lg flex items-center gap-1.5 z-[60] select-none whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            Try this next.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gamified floating points/experience indicator */}
      <AnimatePresence>
        {xpFloats.map(xp => (
          <motion.div
            key={xp.id}
            initial={{ y: 20, opacity: 0, scale: 0.8 }}
            animate={{ y: -70, opacity: [0, 1, 1, 0], scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-primary/95 text-primary-foreground px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider shadow-lg flex items-center gap-1 select-none"
          >
            ⚡ {xp.text}
          </motion.div>
        ))}
      </AnimatePresence>

      <motion.div 
        style={{ 
          x: xOffset, 
          y: hoverActive ? liftY : yOffset, 
          rotate: hoverActive ? (rotate.get() + (proximity.x / 128) * 1) : rotate,
          rotateX: rotateXVal !== 0 ? rotateXVal : proximityRotateX,
          rotateY: rotateYVal !== 0 ? rotateYVal : proximityRotateY,
          skewY: skewYVal,
          scaleX: scaleXVal,
          scaleY: scaleYVal,
        }}
        animate={{ opacity: dissolved ? 0 : opacity, filter: `saturate(${saturate}) brightness(${brightness})`, scale: hoverActive ? scale * scaleBoost : scale }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 20 }}
        className="w-full h-full"
      >
        <motion.div 
          layoutId={`routine-card-${routine.id}`}
          animate={isSuggested ? {
            scale: [1, 1.05, 1, 1.05, 1],
            boxShadow: [
              `0 0 15px ${categoryColor}2a`,
              `0 0 45px ${categoryColor}ff`,
              `0 0 15px ${categoryColor}2a`,
              `0 0 45px ${categoryColor}ff`,
              `0 0 15px ${categoryColor}2a`
            ]
          } : undefined}
          transition={isSuggested ? { duration: 1.5, ease: "easeInOut", repeat: 1 } : undefined}
          style={{ 
            boxShadow: hoverActive 
              ? `0 ${8 + hoverStrength * 12}px ${20 + hoverStrength * 18}px rgba(0, 243, 255, ${0.12 + hoverStrength * 0.22}), 0 0 ${25 + hoverStrength * 25}px ${categoryColor}55`
              : cardGlow,
            border: borderStyle,
            ...(isMorphed ? {
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: categoryColor,
              borderColor: categoryColor,
              margin: "0 auto",
            } : {})
          }}
          className={`relative overflow-hidden border-2 rounded-xl bg-card text-card-foreground shadow-sm transition-colors duration-500 ${
            completed ? "border-primary/20 bg-card/40 backdrop-blur-sm" : 
            routineState === 'active' ? "border-primary/50 bg-card/90 backdrop-blur-xl" : 
            "border-card-border bg-card/60 backdrop-blur-md"
          } ${isConnecting ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        >
          {/* Subtle Glowing Connection Anchors */}
          <motion.div 
            animate={{ opacity: hoverActive ? 0.95 : 0, scale: hoverActive ? 1.0 : 0.6 }}
            transition={{ duration: 0.2 }}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-30 pointer-events-none"
            style={{ 
              backgroundColor: categoryColor, 
              boxShadow: `0 0 10px ${categoryColor}, 0 0 20px ${categoryColor}` 
            }}
          />
          <motion.div 
            animate={{ opacity: hoverActive ? 0.95 : 0, scale: hoverActive ? 1.0 : 0.6 }}
            transition={{ duration: 0.2 }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-30 pointer-events-none"
            style={{ 
              backgroundColor: categoryColor, 
              boxShadow: `0 0 10px ${categoryColor}, 0 0 20px ${categoryColor}` 
            }}
          />

          {/* Confetti Particle Burst */}
          <AnimatePresence>
            {confettiParticles.map((p) => {
              const angleRad = (p.angle * Math.PI) / 180;
              const targetX = Math.cos(angleRad) * p.speed * 15;
              const targetY = Math.sin(angleRad) * p.speed * 15;
              return (
                <motion.div
                  key={p.id}
                  className="absolute rounded-full pointer-events-none"
                  initial={{ x: isMorphed ? 40 : 128, y: isMorphed ? 40 : 48, scale: p.scale, opacity: 1, width: 6, height: 6, backgroundColor: p.color }}
                  animate={{
                    x: (isMorphed ? 40 : 128) + targetX,
                    y: (isMorphed ? 40 : 48) + targetY,
                    scale: 0,
                    opacity: 0,
                  }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  style={{ zIndex: 100 }}
                />
              );
            })}
          </AnimatePresence>

          {/* Fireworks Overlay */}
          {fireworks.map(fw => (
            <motion.div
              key={fw.id}
              className="absolute rounded-full pointer-events-none"
              initial={{ x: fw.x, y: 150, scale: 0.1, width: 4, height: 4, backgroundColor: fw.color }}
              animate={{
                y: fw.y,
                scale: [1, 8, 0],
                opacity: [1, 1, 0]
              }}
              transition={{ duration: 1.2, ease: "easeOut", delay: fw.id * 0.1 }}
              style={{ zIndex: 35, boxShadow: `0 0 15px ${fw.color}` }}
            />
          ))}

          {/* Stamp Overlay */}
          {showStamp && (
            <motion.div 
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              initial={{ scale: 3.5, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 0.9, rotate: -15 }}
              transition={{ type: "spring", stiffness: 220, damping: 12 }}
            >
              <div className="border-4 border-destructive/80 text-destructive/90 px-4 py-1 font-mono font-black uppercase text-xl tracking-widest rounded bg-background/90 shadow-lg select-none backdrop-blur-xs">
                DONE!
              </div>
            </motion.div>
          )}

          {/* Ribbon Wrap Overlay */}
          {showRibbon && (
            <motion.div 
              className="absolute top-2 -right-10 w-32 bg-primary text-primary-foreground text-[8px] font-bold py-0.5 text-center rotate-45 select-none shadow-md z-30 uppercase tracking-widest"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 10 }}
            >
              PASSED
            </motion.div>
          )}

          {/* Ink Spread Background Wave */}
          {inkSpreadActive && (
            <motion.div 
              className="absolute rounded-full pointer-events-none z-0"
              style={{ backgroundColor: categoryColor }}
              initial={{ width: 0, height: 0, left: "50%", top: "50%", x: "-50%", y: "-50%", opacity: 0.4 }}
              animate={{ width: "300%", height: "300%", opacity: 0.1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}

          {/* Rocket Launch exhaust flame */}
          {activeAnimation === "rocket_launch" && animationPhase === "drifting" && (
            <div className="absolute bottom-0 left-0 right-0 h-4 flex justify-center overflow-visible pointer-events-none z-30">
              {Array.from({ length: 6 }).map((_, idx) => (
                <motion.div 
                  key={idx}
                  className="w-1.5 h-1.5 rounded-full bg-amber-500"
                  initial={{ y: 0, opacity: 1, scale: 1 }}
                  animate={{ 
                    y: [0, 25, 45], 
                    x: [(idx - 2.5) * 6, (idx - 2.5) * 10 + (Math.random() - 0.5) * 10],
                    opacity: [1, 0.8, 0], 
                    scale: [1, 1.5, 0] 
                  }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: idx * 0.08 }}
                  style={{ filter: "blur(0.5px)" }}
                />
              ))}
            </div>
          )}

          {/* Origami Flight Overlay */}
          {paperAirplane && (
            <motion.div 
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              initial={{ scale: 0.1, rotate: 0 }}
              animate={{ scale: [0.1, 1, 0], x: [0, 50, 150], y: [0, -50, -200], rotate: [0, -15, -45] }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            >
              <div style={{ color: categoryColor }} className="drop-shadow-[0_0_10px_rgba(189,255,77,0.6)]">
                <svg className="w-10 h-10 fill-current" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </div>
            </motion.div>
          )}

          {/* Milestone Golden Trophy */}
          {showTrophy && (
            <motion.div 
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40 bg-background/50 backdrop-blur-xs rounded-xl"
              initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
              animate={{ scale: [0.5, 1.15, 1], rotate: 0, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.6, ease: "backOut" }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 mb-1 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                  <Trophy className="w-6 h-6 animate-pulse" />
                </div>
                <span className="text-[9px] font-mono font-black uppercase text-amber-400 tracking-widest bg-amber-500/10 px-1.5 py-0.5 rounded">Milestone</span>
              </motion.div>
            </motion.div>
          )}

          {/* Morph into Checkmark view */}
          {isMorphed ? (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center justify-center text-primary-foreground h-full"
              style={{ width: "72px", height: "72px" }}
            >
              <Check className="w-8 h-8 stroke-[3.5px] text-background" />
            </motion.div>
          ) : isFlipped ? (
            /* Flip Card Reverse View */
            <div className="p-4 flex flex-col items-center justify-center min-h-[96px] select-none text-center [transform:rotateY(180deg)]">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary mb-1.5 shadow-[0_0_20px_rgba(189,255,77,0.3)]"
              >
                <Check className="w-5 h-5 stroke-[3px]" />
              </motion.div>
              <span className="text-xs font-semibold tracking-wide uppercase text-primary">Completed!</span>
            </div>
          ) : (
            /* Front face layout */
            <>
              {routineState === 'active' && percentage === 0 && (
                <motion.div 
                  className="absolute inset-0 bg-primary/5"
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              {!isBoolean && (
                <motion.div 
                  layoutId={`routine-progress-${routine.id}`}
                  className="absolute inset-0 bg-primary/20 transition-all duration-500 ease-out z-0 origin-left" 
                  style={{ width: `${percentage}%`, borderRight: percentage > 0 ? `2px solid ${categoryColor}` : 'none' }}
                />
              )}
              
              <div className="p-4 relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="relative">
                    {category && (
                      <motion.div layoutId={`routine-category-${routine.id}`} className="text-[10px] uppercase tracking-wider font-bold mb-1 opacity-70" style={{ color: categoryColor }}>
                        {category.name}
                      </motion.div>
                    )}
                    <motion.h3 layoutId={`routine-title-${routine.id}`} className="font-semibold text-lg leading-tight relative">
                      {routine.name}
                      {activeAnimation === "strike_sink" && completed && (
                        <motion.div 
                          className="absolute h-[2px] bg-primary left-0 top-[60%] z-30 shadow-[0_0_8px_rgba(189,255,77,0.8)]"
                          initial={{ width: 0 }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 0.6, ease: "easeInOut" }}
                        />
                      )}
                    </motion.h3>
                  </div>
                  
                  {isBoolean ? (
                    <motion.button 
                      onClick={handleToggle}
                      {...hapticTap}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${completed ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 hover:border-primary/50"}`}
                    >
                      {completed && <Check className="w-4 h-4" />}
                    </motion.button>
                  ) : isDuration ? (
                    <motion.button 
                      onClick={handleToggleTimer}
                      {...hapticTap}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${timerRunning ? "bg-primary border-primary text-primary-foreground animate-pulse" : "border-muted-foreground/30 hover:border-primary/50"}`}
                    >
                      {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </motion.button>
                  ) : (
                    <motion.button 
                      onClick={handleIncrement}
                      {...hapticTap}
                      className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 hover:border-primary hover:bg-primary/10 flex items-center justify-center transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                  )}

                  {/* Ring Pop: SVG progress ring for targeted routines */}
                  {showRing && (
                    <motion.div
                      animate={(showRingPop || animationPhase === 'playing') && !reducedMotion ? {
                        scale: [1, 1.15, 1],
                      } : {}}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    >
                      <ProgressRing percentage={percentage} completed={completed} reducedMotion={reducedMotion} />
                    </motion.div>
                  )}
                </div>

                {isDuration ? (
                  <div className="flex items-end justify-between text-sm">
                    <div className={`font-mono text-xl font-medium tracking-tight ${timerRunning ? "text-primary" : ""}`}>
                      {formatDuration(elapsedSeconds)}
                    </div>
                    {routine.targetDurationSeconds && (
                      <div className="text-muted-foreground font-mono text-xs">
                        / {formatDuration(routine.targetDurationSeconds)}
                      </div>
                    )}
                  </div>
                ) : !isBoolean && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-end justify-between text-sm">
                      <AnimatePresence mode="wait">
                        {completed ? (
                          <motion.div
                            key="checkmark"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={reducedMotion ? { duration: 0 } : { duration: 0.25 }}
                            className="font-mono text-xl font-medium tracking-tight flex items-center gap-2"
                          >
                            <AnimatedCheckmark reducedMotion={reducedMotion} />
                            <span className="text-primary font-semibold">Done!</span>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="value"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
                            className="font-mono text-xl font-medium tracking-tight"
                          >
                            <AnimatedNumber value={progress?.value || 0} /> <span className="text-muted-foreground text-sm">{routine.unit}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {hasTarget && !isOpen && (
                        <div className="text-muted-foreground font-mono text-xs">
                          / {routine.target}
                        </div>
                      )}
                    </div>

                    {/* Quick Action adaptive controls */}
                    {!completed && !isOpen && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/40">
                        {getQuickIncrements(routine).map((inc) => (
                          <motion.button
                            key={inc.label}
                            onClick={() => handleQuickIncrement(inc.value)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="text-[10px] px-2 py-1 rounded bg-secondary hover:bg-primary hover:text-primary-foreground font-medium font-mono text-secondary-foreground transition-all duration-200"
                          >
                            {inc.label}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Connections({ 
  routines, 
  connections, 
  pulsingIds, 
  connectingFrom, 
  cursorPos,
  progressMap,
  isFocusMode = false,
  connectedRoutineIds = new Set<number>(),
  dragPositions = {}
}: { 
  routines: Routine[], 
  connections: Connection[], 
  pulsingIds: number[], 
  connectingFrom: number | null, 
  cursorPos: {x: number, y: number},
  progressMap: Map<number, RoutineProgress>,
  isFocusMode?: boolean,
  connectedRoutineIds?: Set<number>,
  dragPositions?: Record<number, { x: number; y: number }>
}) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      {/* Existing connections */}
      {connections.map(conn => {
        const from = routines.find(r => r.id === conn.fromRoutineId);
        const to = routines.find(r => r.id === conn.toRoutineId);
        if (!from || !to) return null;
        
        const fromProgress = progressMap.get(from.id);
        const toProgress = progressMap.get(to.id);
        const fromCompleted = fromProgress?.completed ?? false;
        const toCompleted = toProgress?.completed ?? false;
        const isPulsing = pulsingIds.includes(conn.id);
        
        // Connections gracefully detach unless they are actively pulsing!
        if ((fromCompleted || toCompleted) && !isPulsing) {
          return null;
        }

        const isWorkflowConn = connectedRoutineIds.has(conn.fromRoutineId) && connectedRoutineIds.has(conn.toRoutineId);
        if (isFocusMode) {
          if (!isWorkflowConn) return null;
          // Exclude connection if either end is a completed routine and not the active running timer routine
          const fromRunning = fromProgress?.type === "duration" && fromProgress?.timerRunning;
          const toRunning = toProgress?.type === "duration" && toProgress?.timerRunning;
          if ((fromCompleted && !fromRunning) || (toCompleted && !toRunning)) {
            return null;
          }
        }

        const fromPos = dragPositions[from.id] || { x: from.positionX, y: from.positionY };
        const toPos = dragPositions[to.id] || { x: to.positionX, y: to.positionY };

        const startX = fromPos.x + 128; 
        const startY = fromPos.y + 48;  
        const endX = toPos.x + 128;
        const endY = toPos.y + 48;
        
        const distance = Math.abs(endX - startX);
        const cp1x = startX + distance * 0.4;
        const cp1y = startY;
        const cp2x = endX - distance * 0.4;
        const cp2y = endY;
        
        const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
        
        return (
          <g key={conn.id}>
            {/* Soft Outer Glow Path */}
            <path 
              d={path} 
              fill="none" 
              stroke="#00f3ff" 
              strokeWidth="5" 
              opacity="0.18" 
              strokeLinecap="round" 
              style={{ filter: "blur(3px)" }} 
            />
            
            {/* Core Anti-aliased Glowing Neon Blue Path */}
            <path 
              d={path} 
              fill="none" 
              stroke="#00f3ff" 
              strokeWidth="2.5" 
              opacity="0.85" 
              strokeLinecap="round" 
              className="drop-shadow-[0_0_8px_rgba(0,243,255,0.7)]"
            />
            
            {/* Continuous Glowing Energy Particle flowing along path to indicate direction */}
            <circle 
              r="4.5" 
              fill="#00f3ff" 
              style={{ filter: "drop-shadow(0 0 6px #00f3ff)" }}
            >
              <animateMotion 
                dur="3s" 
                repeatCount="indefinite" 
                path={path} 
              />
            </circle>

            {isPulsing && (
               <motion.path 
                 d={path} 
                 fill="none" 
                 stroke="#00f3ff" 
                 strokeWidth="4" 
                 initial={{ pathLength: 0, opacity: 1 }}
                 animate={{ pathLength: 1, opacity: 0 }}
                 transition={{ duration: 1.2, ease: "easeOut" }}
                 className="drop-shadow-[0_0_12px_rgba(0,243,255,1.0)]"
               />
            )}
          </g>
        );
      })}

      {/* Preview connection */}
      {connectingFrom !== null && (() => {
        const from = routines.find(r => r.id === connectingFrom);
        if (!from) return null;
        const fromProgress = progressMap.get(from.id);
        const fromCompleted = fromProgress?.completed ?? false;
        const fromPos = dragPositions[from.id] || { x: from.positionX, y: from.positionY };
        const startX = fromPos.x + 128;
        const startY = fromPos.y + 48;
        const endX = cursorPos.x;
        const endY = cursorPos.y;
        
        const distance = Math.abs(endX - startX);
        const cp1x = startX + distance * 0.4;
        const cp1y = startY;
        const cp2x = endX - distance * 0.4;
        const cp2y = endY;
        const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
        
        return (
          <g>
            <path 
              d={path} 
              fill="none" 
              stroke="#00f3ff" 
              strokeWidth="2" 
              strokeDasharray="6 6" 
              className="animate-pulse drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]" 
            />
            <circle cx={endX} cy={endY} r="4" fill="#00f3ff" className="animate-ping" />
          </g>
        );
      })()}
    </svg>
  );
}

export default function Workspace() {
  const today = getTodayStr();
  const reducedMotion = useReducedMotion();
  const { data: routines, isLoading: rLoading } = useListRoutines({ includeArchived: false });
  const { data: connections, isLoading: cLoading } = useListConnections();
  const { data: summary, isLoading: sLoading } = useGetTodaySummary({ date: today });
  const { data: categories } = useListCategories();
  const updateRoutine = useUpdateRoutine();
  const createConnection = useCreateConnection();
  const pauseTimer = usePauseTimer();
  const startTimer = useStartTimer();
  const queryClient = useQueryClient();

  // Quick Tasks state & hooks
  const { data: quickTasks, isLoading: qtLoading } = useListQuickTasks({ date: today });
  const createQuickTask = useCreateQuickTask();
  const toggleQuickTask = useToggleQuickTask();
  const deleteQuickTask = useDeleteQuickTask();
  const updateQuickTask = useUpdateQuickTask();

  const [isCreatingOneDayTask, setIsCreatingOneDayTask] = useState(false);
  const [resetPhase, setResetPhase] = useState<'idle' | 'fading' | 'drifting' | 'brightening'>('idle');
  const [suggestedRoutineId, setSuggestedRoutineId] = useState<number | null>(null);
  const [showAllCompleteCelebration, setShowAllCompleteCelebration] = useState(false);
  const [celebrationTitle, setCelebrationTitle] = useState("Perfect Harmony");
  const [celebrationSubtitle, setCelebrationSubtitle] = useState("Everything is complete for today.");

  // ── Loading & Camera Navigation States ──
  const [isCameraNavigating, setIsCameraNavigating] = useState(false);
  const [isFindingTask, setIsFindingTask] = useState(false);
  const [isEnteringFocus, setIsEnteringFocus] = useState(false);

  // Floating Command Menu, Context Menu & Wizard States
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; routineId: number; routineName: string } | null>(null);
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const deleteRoutine = useDeleteRoutine();

  useEffect(() => {
    const handleOutsideClick = () => {
      setContextMenu(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);


  const activeRoutines = useMemo(() => {
    return routines?.filter(r => r.activeDays.includes(new Date().getDay())) || [];
  }, [routines]);

  const progressMap = useMemo(() => {
    const map = new Map((summary?.routines || []).map(p => [p.routineId, p]));
    (quickTasks || []).forEach(task => {
      map.set(-task.id, {
        id: -task.id,
        routineId: -task.id,
        date: today,
        completed: task.completed,
        progressPercentage: task.completed ? 100 : 0,
        value: task.completed ? 1 : 0,
        elapsedSeconds: 0,
        timerRunning: false,
        timerStartedAt: null,
        streakCount: 0,
        type: "boolean"
      } as any);
    });
    return map;
  }, [summary?.routines, quickTasks, today]);

  const hasIncompleteItems = useMemo(() => {
    return activeRoutines.some(r => !progressMap.get(r.id)?.completed) || (quickTasks || []).some(t => !t.completed);
  }, [activeRoutines, progressMap, quickTasks]);

  const isWorkspaceLoading = 
    rLoading || 
    cLoading || 
    sLoading || 
    qtLoading || 
    isCameraNavigating || 
    isFindingTask || 
    isEnteringFocus ||
    startTimer.isPending ||
    pauseTimer.isPending;

  const getWorkspaceLoadingMessage = () => {
    if (isFindingTask) return "Selecting best routine for you...";
    if (isEnteringFocus) return "Preparing Focus Chamber...";
    if (isCameraNavigating) return "Shifting viewport...";
    if (rLoading || cLoading || sLoading || qtLoading) return "Syncing routines...";
    return "Optimizing Workspace...";
  };
  
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const [dragPositions, setDragPositions] = useState<Record<number, { x: number; y: number }>>({});
  const [connectingFrom, setConnectingFrom] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [pulsingIds, setPulsingIds] = useState<number[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus Mode variables
  const activeFocusRoutine = summary?.routines.find(r => r.type === "duration" && r.timerRunning);
  const [savedBoardOffset, setSavedBoardOffset] = useState({ x: 0, y: 0 });
  const wasInFocusRef = useRef(false);

  // Connected routines graph (full component traversal, ignoring completed steps)
  const connectedRoutineIds = useMemo(() => {
    if (!activeFocusRoutine || !connections) return new Set<number>();
    const ids = new Set<number>([activeFocusRoutine.routineId]);
    let added = true;
    while (added) {
      added = false;
      connections.forEach(c => {
        const fromCompleted = progressMap.get(c.fromRoutineId)?.completed ?? false;
        const toCompleted = progressMap.get(c.toRoutineId)?.completed ?? false;

        if (ids.has(c.fromRoutineId) && !ids.has(c.toRoutineId)) {
          // If the next step in focus is completed, we don't display it
          if (!toCompleted || c.toRoutineId === activeFocusRoutine.routineId) {
            ids.add(c.toRoutineId);
            added = true;
          }
        }
        if (ids.has(c.toRoutineId) && !ids.has(c.fromRoutineId)) {
          // If the previous step in focus is completed, we don't display it
          if (!fromCompleted || c.fromRoutineId === activeFocusRoutine.routineId) {
            ids.add(c.fromRoutineId);
            added = true;
          }
        }
      });
    }
    return ids;
  }, [activeFocusRoutine, connections, progressMap]);

  // Upstream and downstream roles for styling
  const workflowRoles = useMemo(() => {
    if (!activeFocusRoutine || !connections) {
      return { upstream: new Set<number>(), downstream: new Set<number>() };
    }
    const upstream = new Set<number>();
    let currentNodes = [activeFocusRoutine.routineId];
    while (currentNodes.length > 0) {
      const nextNodes: number[] = [];
      connections.forEach(c => {
        if (currentNodes.includes(c.toRoutineId) && !upstream.has(c.fromRoutineId) && c.fromRoutineId !== activeFocusRoutine.routineId) {
          upstream.add(c.fromRoutineId);
          nextNodes.push(c.fromRoutineId);
        }
      });
      currentNodes = nextNodes;
    }

    const downstream = new Set<number>();
    currentNodes = [activeFocusRoutine.routineId];
    while (currentNodes.length > 0) {
      const nextNodes: number[] = [];
      connections.forEach(c => {
        if (currentNodes.includes(c.fromRoutineId) && !downstream.has(c.toRoutineId) && c.toRoutineId !== activeFocusRoutine.routineId) {
          downstream.add(c.toRoutineId);
          nextNodes.push(c.toRoutineId);
        }
      });
      currentNodes = nextNodes;
    }

    return { upstream, downstream };
  }, [activeFocusRoutine, connections]);

  const immediateNextRoutineId = useMemo(() => {
    if (!activeFocusRoutine || !connections) return null;
    return connections.find(c => c.fromRoutineId === activeFocusRoutine.routineId)?.toRoutineId || null;
  }, [activeFocusRoutine, connections]);

  const prevRoutine = useMemo(() => {
    if (!activeFocusRoutine || !connections || !routines) return null;
    const conn = connections.find(c => c.toRoutineId === activeFocusRoutine.routineId);
    if (!conn) return null;
    return routines.find(r => r.id === conn.fromRoutineId) || null;
  }, [activeFocusRoutine, connections, routines]);

  const nextRoutine = useMemo(() => {
    if (!activeFocusRoutine || !connections || !routines) return null;
    const conn = connections.find(c => c.fromRoutineId === activeFocusRoutine.routineId);
    if (!conn) return null;
    return routines.find(r => r.id === conn.toRoutineId) || null;
  }, [activeFocusRoutine, connections, routines]);

  // Keep saved offset & fly/center camera smoothly on exit/enter
  useEffect(() => {
    if (activeFocusRoutine) {
      if (!wasInFocusRef.current) {
        setSavedBoardOffset(boardOffset);
        wasInFocusRef.current = true;
      }
    } else {
      if (wasInFocusRef.current) {
        const startX = boardOffset.x;
        const startY = boardOffset.y;
        const controlsX = animate(startX, savedBoardOffset.x, {
          type: "spring",
          stiffness: 40,
          damping: 15,
          onUpdate: (val) => setBoardOffset(prev => ({ ...prev, x: val }))
        });
        const controlsY = animate(startY, savedBoardOffset.y, {
          type: "spring",
          stiffness: 40,
          damping: 15,
          onUpdate: (val) => setBoardOffset(prev => ({ ...prev, y: val }))
        });
        wasInFocusRef.current = false;
        return () => {
          controlsX.stop();
          controlsY.stop();
        };
      }
    }
  }, [activeFocusRoutine]);

  // Auto-pause / complete timer when target reached
  useEffect(() => {
    if (!summary?.routines || !today) return;
    summary.routines.forEach(p => {
      if (p.timerRunning && p.targetDurationSeconds && p.elapsedSeconds >= p.targetDurationSeconds) {
        pauseTimer.mutate({ id: p.routineId, date: today }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey({ date: today }) });
          }
        });
      }
    });
  }, [summary?.routines, today, queryClient]);

  // Keep ticking every second
  useEffect(() => {
    if (!activeFocusRoutine) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey({ date: today }) });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFocusRoutine, queryClient, today]);

  // Cinematic centering - smooth fly camera
  useEffect(() => {
    if (activeFocusRoutine && routines && containerRef.current) {
      const matchedRoutine = routines.find(r => r.id === activeFocusRoutine.routineId);
      if (matchedRoutine) {
        const rect = containerRef.current.getBoundingClientRect();
        const scale = combinedScale.get() || 1;
        const camX = cameraX ? cameraX.get() : 0;
        const camY = cameraY ? cameraY.get() : 0;
        
        const targetX = (rect.width / 2) / scale - (matchedRoutine.positionX + 128) - camX;
        const targetY = (rect.height / 2) / scale - (matchedRoutine.positionY + 48) - camY;
        
        const startX = boardOffset.x;
        const startY = boardOffset.y;
        const controlsX = animate(startX, targetX, {
          type: "spring",
          stiffness: 45,
          damping: 16,
          onUpdate: (val) => setBoardOffset(prev => ({ ...prev, x: val }))
        });
        const controlsY = animate(startY, targetY, {
          type: "spring",
          stiffness: 45,
          damping: 16,
          onUpdate: (val) => setBoardOffset(prev => ({ ...prev, y: val }))
        });
        
        return () => {
          controlsX.stop();
          controlsY.stop();
        };
      }
    }
  }, [activeFocusRoutine?.routineId, routines]);
  
  useEffect(() => {
    if (activeFocusRoutine) {
      setIsEnteringFocus(true);
      const timer = setTimeout(() => setIsEnteringFocus(false), 500);
      return () => clearTimeout(timer);
    }
  }, [activeFocusRoutine?.routineId]);

  // ── Two-Zone Workspace Camera System ──
  const cameraX = useMotionValue(0);
  const springCameraX = useSpring(cameraX, { stiffness: 60, damping: 20 });
  const cameraY = useMotionValue(0);
  const springCameraY = useSpring(cameraY, { stiffness: 60, damping: 20 });
  const [currentZone, setCurrentZone] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    cameraX.set(0);
    cameraY.set(0);
    setCurrentZone('active');
  }, [today, cameraX, cameraY]);

  // ── Workspace Canvas Scale and Drag System ──
  const boardX = useMotionValue(0);
  const boardY = useMotionValue(0);

  useEffect(() => {
    boardX.set(boardOffset.x);
    boardY.set(boardOffset.y);
  }, [boardOffset, boardX, boardY]);

  const canvasX = useTransform([boardX, springCameraX], ([x, camX]) => (x as number) + (camX as number));
  const canvasY = useTransform([boardY, springCameraY], ([y, camY]) => (y as number) + (camY as number));

  const cameraBlur = useTransform([springCameraX, springCameraY], ([x, y]) => {
    const targetX = cameraX.get();
    const targetY = cameraY.get();
    const diffX = Math.abs((x as number) - targetX);
    const diffY = Math.abs((y as number) - targetY);
    const totalDiff = Math.max(diffX, diffY);
    return `blur(${Math.min(8, totalDiff * 0.015)}px)`;
  });

  const focusScale = useMotionValue(1);
  const springFocusScale = useSpring(focusScale, { stiffness: 60, damping: 20 });

  const userZoom = useMotionValue(1);
  const springZoom = useSpring(userZoom, { stiffness: 120, damping: 24 });

  useEffect(() => {
    focusScale.set(activeFocusRoutine ? 1.15 : 1.0);
  }, [activeFocusRoutine, focusScale]);

  const cameraScale = useTransform(springCameraY, (y) => {
    const target = cameraY.get();
    const diff = Math.abs(y - target);
    return 1 - Math.min(0.04, diff * 0.0001);
  });

  const combinedScale = useTransform(
    [cameraScale, springFocusScale, springZoom], 
    ([camScale, focScale, usrZoom]) => (camScale as number) * (focScale as number) * (usrZoom as number)
  );

  // Setup non-passive event listener for mouse wheel interactive zooming
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 0.08;
      const currentVal = userZoom.get();
      const nextZoom = Math.min(2.0, Math.max(0.4, currentVal - e.deltaY * zoomFactor * 0.005));
      userZoom.set(nextZoom);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [userZoom]);

  // Predefined Region Camera Constants
  const COMPLETED_REGION_OFFSET_X = 900;
  const COMPLETED_REGION_OFFSET_Y = 900;
  const ACTIVE_REGION_OFFSET_X = 0;
  const ACTIVE_REGION_OFFSET_Y = 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeFocusRoutine) return; // disable camera hotkeys in focus mode
      if (e.key === 'Escape') setConnectingFrom(null);
      
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentZone === 'completed') return;
        setIsCameraNavigating(true);
        setCurrentZone('completed');
        animate(cameraX, COMPLETED_REGION_OFFSET_X, { duration: 0.5, ease: "easeInOut" });
        animate(cameraY, COMPLETED_REGION_OFFSET_Y, { duration: 0.5, ease: "easeInOut" });
        setTimeout(() => setIsCameraNavigating(false), 500);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentZone === 'active') return;
        setIsCameraNavigating(true);
        setCurrentZone('active');
        animate(cameraX, ACTIVE_REGION_OFFSET_X, { duration: 0.5, ease: "easeInOut" });
        animate(cameraY, ACTIVE_REGION_OFFSET_Y, { duration: 0.5, ease: "easeInOut" });
        setTimeout(() => setIsCameraNavigating(false), 500);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraX, cameraY, activeFocusRoutine, currentZone]);

  const visibleActiveNodes = useMemo(() => {
    const activeRoutList = !activeFocusRoutine ? activeRoutines : activeRoutines.filter(routine => {
      if (!connectedRoutineIds.has(routine.id)) return false;
      const progress = progressMap.get(routine.id);
      const isCompleted = progress?.completed ?? false;
      if (isCompleted && routine.id !== activeFocusRoutine.routineId) return false;
      return true;
    });

    const activeTaskList = (quickTasks || []).map(task => ({
      id: -task.id,
      name: task.title,
      title: task.title,
      categoryId: task.categoryId,
      notes: task.notes,
      positionX: task.positionX ?? 0,
      positionY: task.positionY ?? 0,
      type: "boolean" as const,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      target: null,
      unit: "",
      streak: 0,
      description: ""
    })).filter(taskNode => {
      if (!activeFocusRoutine) return true;
      if (!connectedRoutineIds.has(taskNode.id)) return false;
      const progress = progressMap.get(taskNode.id);
      const isCompleted = progress?.completed ?? false;
      if (isCompleted) return false;
      return true;
    });

    return [...activeRoutList, ...activeTaskList];
  }, [activeRoutines, quickTasks, activeFocusRoutine, connectedRoutineIds, progressMap]);

  const displayNodes = useMemo(() => {
    // Get completed nodes sorted deterministically by ID so they stay in consistent slots
    const completedNodesSorted = [...visibleActiveNodes]
      .filter(node => progressMap.get(node.id)?.completed)
      .sort((a, b) => a.id - b.id);

    return visibleActiveNodes.map(node => {
      const isCompleted = progressMap.get(node.id)?.completed ?? false;
      if (isCompleted) {
        const completedIndex = completedNodesSorted.findIndex(n => n.id === node.id);
        if (completedIndex !== -1) {
          const col = completedIndex % 3;
          const row = Math.floor(completedIndex / 3);
          const baseX = -650 + col * 280;
          const baseY = -650 + row * 160;
          
          // Deterministic slight offset based on ID for an organic grid placement
          const randomSeed = Math.abs(node.id * 7321) % 100;
          const randomX = (randomSeed % 16) - 8;
          const randomY = ((randomSeed >> 2) % 16) - 8;
          
          return {
            ...node,
            positionX: baseX + randomX,
            positionY: baseY + randomY
          };
        }
      }
      return node;
    });
  }, [visibleActiveNodes, progressMap]);

  // Structured Grid Placement for Completed Region
  const getNextFreeCompletedPosition = useCallback((nodes: any[]) => {
    let index = 0;
    while (true) {
      const col = index % 3;
      const row = Math.floor(index / 3);
      // Completed Region top-left anchor: x: -650, y: -650
      const baseX = -650 + col * 280;
      const baseY = -650 + row * 160;
      
      // Preserving slight randomness (deterministic pseudo-randomness based on index)
      const randomSeed = (index * 7321) % 100;
      const randomX = (randomSeed % 16) - 8; // -8px to +8px
      const randomY = ((randomSeed >> 2) % 16) - 8;
      
      const targetX = baseX + randomX;
      const targetY = baseY + randomY;
      
      // Check collision with any existing node in completed region
      const collision = nodes.some(node => {
        const dx = node.positionX - targetX;
        const dy = node.positionY - targetY;
        return Math.sqrt(dx * dx + dy * dy) < 150;
      });
      
      if (!collision) {
        return { x: targetX, y: targetY };
      }
      index++;
    }
  }, []);

  // Smooth Spiral Placement for In Progress Region
  const getNextFreeInProgressPosition = useCallback((nodes: any[]) => {
    // In Progress Region bottom-right anchor: x: 350, y: 350
    const baseCenterX = 350;
    const baseCenterY = 350;
    
    let angle = 0;
    let radius = 0;
    const step = 45;
    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = baseCenterX + Math.cos(angle) * radius;
      const y = baseCenterY + Math.sin(angle) * radius;

      // Add slight random variation
      const randomX = x + (Math.sin(attempt) * 15);
      const randomY = y + (Math.cos(attempt) * 15);

      const collision = nodes.some(node => {
        const dx = node.positionX - randomX;
        const dy = node.positionY - randomY;
        return Math.sqrt(dx * dx + dy * dy) < 180;
      });

      if (!collision) {
        return { x: randomX, y: randomY };
      }

      angle += 0.9;
      radius += step * (angle / (2 * Math.PI));
    }
    
    // Fallback
    return { x: baseCenterX + Math.random() * 100, y: baseCenterY + Math.random() * 100 };
  }, []);

  // Natural Spawn Placement algorithm with collision avoidance
  const getSpawnPosition = useCallback((taskId: number) => {
    return getNextFreeInProgressPosition(visibleActiveNodes);
  }, [visibleActiveNodes, getNextFreeInProgressPosition]);

  // Lazy initialize position for any pre-existing tasks that don't have coordinates
  useEffect(() => {
    if (!quickTasks || qtLoading) return;
    const tasksWithoutPos = quickTasks.filter(t => t.positionX === undefined || t.positionY === undefined);
    if (tasksWithoutPos.length > 0) {
      tasksWithoutPos.forEach((task, idx) => {
        const spawnPos = getSpawnPosition(task.id);
        const staggeredX = spawnPos.x + idx * 40;
        const staggeredY = spawnPos.y + idx * 40;
        updateQuickTask.mutate({ id: task.id, data: { positionX: staggeredX, positionY: staggeredY } });
      });
    }
  }, [quickTasks, qtLoading, getSpawnPosition]);

  // Listen to daily reset sequence custom event
  useEffect(() => {
    const handleResetSequence = () => {
      setResetPhase('fading');
      
      // Step 2: Drifting (after 1.2s yesterday is archived and queries invalidated)
      setTimeout(() => {
        setResetPhase('drifting');
      }, 1200);

      // Step 3: Brightening (after 3.7s total, drift completes)
      setTimeout(() => {
        setResetPhase('brightening');
      }, 3700);

      // Step 4: Idle / Ready (after 4.9s total, brightening completes)
      setTimeout(() => {
        setResetPhase('idle');
      }, 4900);
    };

    window.addEventListener("daily-reset-sequence", handleResetSequence);
    return () => window.removeEventListener("daily-reset-sequence", handleResetSequence);
  }, []);



  if (rLoading || cLoading || sLoading) {
    return <div className="h-full flex items-center justify-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  // compute incoming dependencies
  const incoming = new Map<number, number[]>();
  
  connections?.forEach(c => {
    if (!incoming.has(c.toRoutineId)) incoming.set(c.toRoutineId, []);
    incoming.get(c.toRoutineId)!.push(c.fromRoutineId);
  });

  const getRoutineState = (id: number) => {
    const p = progressMap.get(id);
    if (p?.completed) return 'settled';
    const inDeps = incoming.get(id) || [];
    if (inDeps.length === 0) return 'active';
    const allDepsCompleted = inDeps.every(depId => progressMap.get(depId)?.completed);
    return allDepsCompleted ? 'active' : 'future';
  };

  const flyCameraToNode = (id: number, posX: number, posY: number) => {
    if (!containerRef.current) return;
    setIsCameraNavigating(true);
    setTimeout(() => setIsCameraNavigating(false), 800);

    const rect = containerRef.current.getBoundingClientRect();
    const el = document.getElementById(`routine-card-container-${id}`);
    const cardWidth = el ? el.offsetWidth : 256;
    const cardHeight = el ? el.offsetHeight : 120;

    const camXOffset = cameraX ? cameraX.get() : 0;
    const camYOffset = cameraY ? cameraY.get() : 0;
    const scale = combinedScale.get() || 1;

    const targetX = (rect.width / 2) / scale - (posX + cardWidth / 2) - camXOffset;
    const targetY = (rect.height / 2) / scale - (posY + cardHeight / 2) - camYOffset;

    const startX = boardOffset.x;
    const startY = boardOffset.y;
    
    animate(startX, targetX, {
      type: "spring",
      stiffness: 45,
      damping: 16,
      onUpdate: (val) => setBoardOffset(prev => ({ ...prev, x: val }))
    });
    animate(startY, targetY, {
      type: "spring",
      stiffness: 45,
      damping: 16,
      onUpdate: (val) => setBoardOffset(prev => ({ ...prev, y: val }))
    });
  };

  const handlePickSomething = () => {
    // Filter out active, incomplete routines and quick tasks that are visible & not completed
    const incomplete = visibleActiveNodes.filter(node => {
      const progress = progressMap.get(node.id);
      if (progress?.completed) return false;
      // If it's a routine (positive ID), ignore if it is a future routine
      if (node.id > 0) {
        const state = getRoutineState(node.id);
        if (state === 'future') return false;
      }
      return true;
    });

    if (incomplete.length > 0) {
      setIsFindingTask(true);
      const randomIndex = Math.floor(Math.random() * incomplete.length);
      const chosen = incomplete[randomIndex];
      
      // Fly camera to the chosen item
      flyCameraToNode(chosen.id, chosen.positionX, chosen.positionY);
      
      // Trigger glowing/pulse effect
      setSuggestedRoutineId(chosen.id);
      
      setTimeout(() => {
        setIsFindingTask(false);
      }, 800);

      setTimeout(() => {
        setSuggestedRoutineId(null);
      }, 4000);
    } else {
      // Everything is complete! Trigger celebration
      setCelebrationTitle("You're all caught up for today.");
      setCelebrationSubtitle("Nothing left to work on.");
      setShowAllCompleteCelebration(true);
      setTimeout(() => {
        setShowAllCompleteCelebration(false);
      }, 4500);
    }
  };

  const handleDragEnd = (id: number, x: number, y: number) => {
    if (id < 0) {
      updateQuickTask.mutate({ id: -id, data: { positionX: x, positionY: y } });
    } else {
      updateRoutine.mutate({ id, data: { positionX: x, positionY: y } });
    }
    
    // Clear dynamic drag position
    setDragPositions(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleDragActive = (id: number, offset: { x: number; y: number }) => {
    const node = visibleActiveNodes.find(n => n.id === id);
    if (!node) return;
    setDragPositions(prev => ({
      ...prev,
      [id]: { x: node.positionX + offset.x, y: node.positionY + offset.y }
    }));
  };

  const handleInteract = (routineId: number) => {
    const outConnIds = connections?.filter(c => c.fromRoutineId === routineId).map(c => c.id) || [];
    if (outConnIds.length > 0) {
      setPulsingIds(prev => [...prev, ...outConnIds]);
      setTimeout(() => {
        setPulsingIds(prev => prev.filter(id => !outConnIds.includes(id)));
      }, 1500);
    }
  };

  return (
    <div 
      className="w-full h-full overflow-hidden relative canvas-bg transition-all duration-[1200ms] ease-in-out"
      style={{
        opacity: (resetPhase === 'fading' || resetPhase === 'drifting') ? 0.35 : 1.0,
        filter: (resetPhase === 'fading' || resetPhase === 'drifting') 
          ? "saturate(0.2) brightness(0.6)" 
          : "saturate(1) brightness(1)"
      }}
      ref={containerRef}
      onMouseMove={(e) => {
        if (connectingFrom !== null && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setCursorPos({
            x: e.clientX - rect.left - boardOffset.x,
            y: e.clientY - rect.top - boardOffset.y - cameraY.get()
          });
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setConnectingFrom(null);
      }}
    >
      {/* Ambient Lighting Dynamic Background */}
      <div 
        className={`absolute inset-0 pointer-events-none transition-all duration-[3000ms] ease-in-out bg-gradient-to-tr ${getWorkspaceLighting().bg}`}
        style={{ opacity: 0.85, mixBlendMode: "screen" }}
      />

      {/* Dynamic Lighting Indicator HUD badge */}
      {!activeFocusRoutine && (
        <div className="absolute right-6 top-6 bg-card/45 backdrop-blur-md px-3 py-1 border border-card-border/50 rounded-full text-[10px] uppercase font-mono font-bold tracking-widest pointer-events-none select-none z-50 flex items-center gap-1.5 text-muted-foreground/80">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />
          {getWorkspaceLighting().label}
        </div>
      )}

      <motion.div 
        drag={true}
        dragMomentum={true}
        dragTransition={{ power: 0.15, timeConstant: 150 }}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onDrag={(e, info) => {
          const scaleVal = combinedScale.get();
          setBoardOffset(prev => ({ 
            x: prev.x + info.delta.x / scaleVal, 
            y: prev.y + info.delta.y / scaleVal 
          }));
        }}
        style={{ touchAction: "none" }}
      >
        <motion.div 
          style={{ 
            x: canvasX, 
            y: canvasY,
            filter: activeFocusRoutine ? "none" : cameraBlur,
            scale: combinedScale,
            width: '100%', 
            height: '100%', 
            position: 'absolute' 
          }}
        >
          {connections && displayNodes && (
            <Connections 
              routines={displayNodes} 
              connections={connections} 
              pulsingIds={pulsingIds}
              connectingFrom={connectingFrom}
              cursorPos={cursorPos}
              progressMap={progressMap}
              isFocusMode={!!activeFocusRoutine}
              connectedRoutineIds={connectedRoutineIds}
              dragPositions={dragPositions}
            />
          )}
          
          {displayNodes.map(routine => {
            const progress = progressMap.get(routine.id);
            const category = categories?.find(c => c.id === routine.categoryId);
            const state = getRoutineState(routine.id);
            
            return (
              <RoutineCard 
                key={routine.id} 
                routine={routine as any} 
                progress={progress} 
                category={category}
                routineState={state}
                isConnecting={connectingFrom === routine.id}
                onDragEnd={handleDragEnd}
                onDragActive={handleDragActive}
                onInteract={() => handleInteract(routine.id)}
                currentStreak={summary?.currentStreak || 0}
                is100PercentDay={summary?.completionPercentage === 100}
                isFocusMode={!!activeFocusRoutine}
                isConnectedInFocus={connectedRoutineIds.has(routine.id)}
                isFocusedRoutine={activeFocusRoutine?.routineId === routine.id}
                isPrevious={workflowRoles.upstream.has(routine.id)}
                isImmediateNext={routine.id === immediateNextRoutineId}
                isDownstream={workflowRoles.downstream.has(routine.id)}
                isSuggested={suggestedRoutineId === routine.id}
                scale={combinedScale}
                isResetting={resetPhase === 'drifting'}
                onRightClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (connectingFrom === null) {
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      routineId: routine.id,
                      routineName: routine.name
                    });
                  } else if (connectingFrom === routine.id) {
                    setConnectingFrom(null);
                  } else {
                    createConnection.mutate({ data: { fromRoutineId: connectingFrom, toRoutineId: routine.id } }, {
                      onSuccess: (data: any) => {
                        queryClient.invalidateQueries({ queryKey: getListConnectionsQueryKey() });
                        if (data && data.loopCancelled) {
                          toast.info("Direct loop detected. Connection nodes cleared!");
                        } else {
                          toast.success("Workflow connection established");
                        }
                      },
                      onError: (error: any) => {
                        toast.error(error?.message || "Failed to establish connection");
                      }
                    });
                    setConnectingFrom(null);
                  }
                }}
              />
            );
          })}
        </motion.div>
      </motion.div>


      
      {/* Workspace HUD */}
      <motion.div 
        animate={{ opacity: activeFocusRoutine ? 0 : 1, pointerEvents: activeFocusRoutine ? "none" : "auto" }}
        className="absolute bottom-6 right-6 pointer-events-none z-50"
      >
        <div className="bg-card/80 backdrop-blur border border-card-border p-4 rounded-2xl shadow-xl flex items-center gap-6 pointer-events-auto">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Today's Progress</div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{Math.round(summary?.completionPercentage || 0)}%</span>
            </div>
          </div>
          <div className="w-px h-10 bg-border" />
          <div>
            <div className="text-sm text-muted-foreground mb-1">Streak</div>
            <div className="flex items-end gap-2 text-primary">
              <span className="text-3xl font-bold">{summary?.currentStreak || 0}</span>
              <span className="text-sm pb-1 uppercase tracking-wider font-semibold">Days</span>
            </div>
          </div>
        </div>
      </motion.div>
 
      {/* ── Focus Mode Immersive Glass HUD Timer (Top Right Corner, Apple Vision Pro Style) ── */}
      <AnimatePresence>
        {activeFocusRoutine && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            className="absolute top-6 right-6 z-50 w-80 pointer-events-auto"
          >
            <div className="relative bg-black/35 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl overflow-hidden text-white flex flex-col gap-4">
              {/* Soft Ambient Inner Glow */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-white/40">Active Focus</span>
                  <h3 className="text-sm font-semibold tracking-tight text-white/90">{activeFocusRoutine.name}</h3>
                </div>
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-2 py-0.5 text-[9px] font-mono text-white/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Live
                </div>
              </div>

              {/* Countdown / Elapsed Display in high-fidelity HMS */}
              <div className="flex flex-col items-center py-2">
                <span className="text-4xl font-extrabold tracking-tighter leading-none font-mono text-white select-none tabular-nums">
                  {activeFocusRoutine.targetDurationSeconds ? (
                    formatHMS(Math.max(0, activeFocusRoutine.targetDurationSeconds - activeFocusRoutine.elapsedSeconds))
                  ) : (
                    formatHMS(activeFocusRoutine.elapsedSeconds)
                  )}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-white/30 font-mono mt-2.5">
                  {activeFocusRoutine.targetDurationSeconds ? "Remaining Time" : "Elapsed Time"}
                </span>
              </div>

              {/* Time stats layout */}
              <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-3 text-[11px] font-mono text-white/60">
                <div className="flex flex-col bg-white/5 rounded-lg p-2 border border-white/5">
                  <span className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5">Elapsed</span>
                  <span className="text-white/85 font-medium tabular-nums">{formatHMS(activeFocusRoutine.elapsedSeconds)}</span>
                </div>
                <div className="flex flex-col bg-white/5 rounded-lg p-2 border border-white/5">
                  <span className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5">Target</span>
                  <span className="text-white/85 font-medium tabular-nums">
                    {activeFocusRoutine.targetDurationSeconds ? formatHMS(activeFocusRoutine.targetDurationSeconds) : "--:--:--"}
                  </span>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center gap-2 mt-1">
                {/* Play/Pause */}
                <button
                  onClick={() => {
                    const mutation = activeFocusRoutine.timerRunning ? pauseTimer : startTimer;
                    mutation.mutate({ id: activeFocusRoutine.routineId, date: today }, {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey({ date: today }) });
                      }
                    });
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border font-medium text-xs transition-all duration-250 cursor-pointer ${
                    activeFocusRoutine.timerRunning
                      ? "bg-white/10 hover:bg-white/20 text-white border-white/10"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent shadow-[0_0_15px_rgba(189,255,77,0.2)] animate-pulse"
                  }`}
                >
                  {activeFocusRoutine.timerRunning ? (
                    <>
                      <Pause className="w-3.5 h-3.5 stroke-[2.5px]" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current stroke-[2.5px]" />
                      Resume
                    </>
                  )}
                </button>

                {/* Stop */}
                <button
                  onClick={() => {
                    pauseTimer.mutate({ id: activeFocusRoutine.routineId, date: today }, {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey({ date: today }) });
                      }
                    });
                  }}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 rounded-xl py-2 px-4 text-xs font-medium transition-all duration-250 cursor-pointer flex items-center justify-center gap-1.5"
                  title="Stop session"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop
                </button>
              </div>

              {/* Prev / Next indicators */}
              <div className="flex flex-col gap-1.5 border-t border-white/5 pt-3.5 text-[10px] text-white/50 font-mono">
                {prevRoutine && (
                  <div className="flex justify-between items-center bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5">
                    <span className="text-white/30 uppercase tracking-wider text-[8px]">Previous</span>
                    <span className="text-white/80 font-medium truncate max-w-[140px]">{prevRoutine.name}</span>
                  </div>
                )}
                {nextRoutine && (
                  <div className="flex justify-between items-center bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5">
                    <span className="text-white/30 uppercase tracking-wider text-[8px]">Next</span>
                    <span className="text-white/80 font-medium truncate max-w-[140px]">{nextRoutine.name}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Workspace Floating Circular Command Menu (Top Left, Radial) ── */}
      {!activeFocusRoutine && (
        <CircleMenu 
          onCreateRoutine={() => setIsCreatingRoutine(true)}
          onCreateOneDayTask={() => {
            setIsCreatingOneDayTask(true);
          }}
          onPickSomething={handlePickSomething}
        />
      )}

      {/* ── Compact Glass Context Menu (Right Click on Routine Card) ── */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-[9999] w-48 rounded-2xl border border-white/10 bg-card/80 backdrop-blur-2xl p-2.5 shadow-2xl overflow-hidden pointer-events-auto"
            onClick={(e) => e.stopPropagation()} // Prevent closing on clicking menu itself
          >
            {/* Ambient Line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
            
            <div className="px-2 py-1.5 border-b border-white/5 mb-1.5">
              <div className="text-[9px] uppercase font-mono tracking-wider text-muted-foreground font-bold truncate">Actions</div>
              <div className="text-xs font-semibold text-foreground truncate">{contextMenu.routineName}</div>
            </div>

            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => {
                  setConnectingFrom(contextMenu.routineId);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-left font-medium text-foreground hover:bg-white/5 hover:text-primary transition-all cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5 text-primary" />
                <span>Link / Connect</span>
              </button>

              <button
                onClick={() => {
                  const r = routines?.find(rt => rt.id === contextMenu.routineId);
                  if (r) setEditingRoutine(r);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-left font-medium text-foreground hover:bg-white/5 hover:text-primary transition-all cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Edit Routine</span>
              </button>

              <button
                onClick={() => {
                  deleteRoutine.mutate({ id: contextMenu.routineId }, {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListRoutinesQueryKey() });
                      toast.success("Routine archived securely");
                    }
                  });
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-left font-medium text-foreground hover:bg-white/5 hover:text-amber-400 transition-all cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-amber-500" />
                <span>Archive</span>
              </button>

              <button
                onClick={() => {
                  deleteRoutine.mutate({ id: contextMenu.routineId }, {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListRoutinesQueryKey() });
                      toast.success("Routine deleted (historical logs preserved)");
                    }
                  });
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-left font-medium text-foreground hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer"
              >
                <Trash className="w-3.5 h-3.5 text-red-500" />
                <span>Delete</span>
              </button>

              {/* Placeholders */}
              <button
                disabled
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-left font-medium text-muted-foreground/40 cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Duplicate</span>
              </button>

              <button
                disabled
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs text-left font-medium text-muted-foreground/40 cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full-screen AnimatePresence Overlay for Wizards ── */}
      <AnimatePresence>
        {isCreatingRoutine && (
          <CreateRoutineWizard 
            onDone={() => setIsCreatingRoutine(false)}
            spawnX={getNextFreeInProgressPosition(visibleActiveNodes).x}
            spawnY={getNextFreeInProgressPosition(visibleActiveNodes).y}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreatingOneDayTask && (
          <CreateOneDayTaskModal 
            onDone={() => setIsCreatingOneDayTask(false)}
            getSpawnPosition={getSpawnPosition}
            onSuccessCreated={(newTask) => {
              if (newTask && newTask.positionX !== undefined) {
                const rect = containerRef.current?.getBoundingClientRect() || { width: 1200, height: 800 };
                const scale = combinedScale.get() || 1;
                const camX = cameraX ? cameraX.get() : 0;
                const camY = cameraY ? cameraY.get() : 0;
                const targetX = (rect.width / 2) / scale - (newTask.positionX + 128) - camX;
                const targetY = (rect.height / 2) / scale - (newTask.positionY + 48) - camY;
                
                animate(boardOffset.x, targetX, {
                  type: "spring",
                  stiffness: 45,
                  damping: 16,
                  onUpdate: (val) => setBoardOffset(prev => ({ ...prev, x: val }))
                });
                animate(boardOffset.y, targetY, {
                  type: "spring",
                  stiffness: 45,
                  damping: 16,
                  onUpdate: (val) => setBoardOffset(prev => ({ ...prev, y: val }))
                });
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingRoutine && (
          <EditRoutineModal 
            routine={editingRoutine}
            onDone={() => setEditingRoutine(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAllCompleteCelebration && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-sm pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="bg-card/90 border border-card-border/60 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center space-y-4 max-w-sm pointer-events-auto"
            >
              <div className="p-4 rounded-full bg-primary/15 text-primary relative animate-bounce">
                <Trophy className="w-10 h-10 animate-pulse" />
                <Sparkles className="w-5 h-5 absolute -top-1 -right-1 text-primary animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight text-foreground">{celebrationTitle}</h3>
                <p className="text-sm text-muted-foreground">{celebrationSubtitle}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Elegant Centered Empty Workspace State */}
      <AnimatePresence>
        {!hasIncompleteItems && !activeFocusRoutine && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
            {/* Gentle Radial Glow */}
            <div className="absolute w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10 animate-pulse" style={{ animationDuration: '6s' }} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="flex flex-col items-center text-center space-y-4 max-w-md px-6 pointer-events-auto"
            >
              {/* Subtle Floating Icon Container */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="p-5 rounded-full bg-primary/10 border border-primary/20 text-primary relative shadow-[0_0_30px_rgba(189,255,77,0.1)]"
              >
                <Trophy className="w-12 h-12" />
                <Sparkles className="w-6 h-6 absolute -top-1 -right-1 text-primary animate-pulse" />
              </motion.div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">🎉 Everything is complete for today.</h2>
                <p className="text-muted-foreground text-sm font-medium">Enjoy the rest of your day.</p>
              </div>
            </motion.div>

            {/* Subtle, Peaceful Floating Confetti Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 15 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    x: `${Math.random() * 100}%`, 
                    y: '110%', 
                    scale: Math.random() * 0.5 + 0.5, 
                    opacity: Math.random() * 0.3 + 0.2,
                    rotate: Math.random() * 360
                  }}
                  animate={{ 
                    y: '-10%', 
                    x: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
                    rotate: [0, 360]
                  }}
                  transition={{ 
                    duration: Math.random() * 10 + 15, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                  className="absolute w-2 h-2 rounded-sm"
                  style={{
                    backgroundColor: ['#BDF94D', '#FFD700', '#FF4500', '#00FFFF', '#FF1493'][i % 5]
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightweight Loader overlay */}
      <LightweightLoader isLoading={isWorkspaceLoading} message={getWorkspaceLoadingMessage()} />
    </div>
  );
}
