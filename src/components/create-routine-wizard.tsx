import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  CheckCircle2,
  Target,
  Timer,
  Route as RouteIcon,
  Repeat,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  X
} from "lucide-react";
import {
  useCreateRoutine,
  useListCategories,
  getListRoutinesQueryKey,
  RoutineType
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Card, Input, Label } from "@/components/ui";

const MEASUREMENT_METHODS: {
  type: RoutineType;
  label: string;
  icon: typeof CheckCircle2;
  description: string;
  examples: string;
}[] = [
  {
    type: "boolean",
    label: "Simple Completion",
    icon: CheckCircle2,
    description: "One click completes it.",
    examples: "Brush Teeth · Journal · Meditate",
  },
  {
    type: "numeric",
    label: "Goal Progress",
    icon: Target,
    description: "A measurable target with quick increments.",
    examples: "Push-ups · Pages Read · Water Intake",
  },
  {
    type: "duration",
    label: "Time Based",
    icon: Timer,
    description: "A live timer toward a target duration.",
    examples: "Study · Gym · Coding",
  },
  {
    type: "distance",
    label: "Distance",
    icon: RouteIcon,
    description: "Current distance vs. a target distance.",
    examples: "Running · Walking · Cycling",
  },
  {
    type: "session",
    label: "Session Count",
    icon: Repeat,
    description: "Repeated sessions with a target count.",
    examples: "Pomodoros · Practice Questions",
  },
  {
    type: "open",
    label: "Open Progress",
    icon: Sparkles,
    description: "Free logging, no fixed finish line.",
    examples: "Brainstorming · Research · Creative Work",
  },
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

type WizardStep = "name" | "category" | "method" | "details";

export function CreateRoutineWizard({ 
  onDone,
  spawnX,
  spawnY
}: { 
  onDone: () => void;
  spawnX?: number;
  spawnY?: number;
}) {
  const { data: categories } = useListCategories();
  const createRoutine = useCreateRoutine();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>("name");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [type, setType] = useState<RoutineType | null>(null);
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState<string>("");
  const [targetMinutes, setTargetMinutes] = useState<string>("");
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const steps: WizardStep[] = ["name", "category", "method", "details"];
  const stepIndex = steps.indexOf(step);

  const canAdvance =
    (step === "name" && name.trim().length > 0) ||
    (step === "category") ||
    (step === "method" && type !== null) ||
    step === "details";

  const goNext = () => {
    if (step === "details") {
      handleSubmit();
      return;
    }
    const next = steps[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = steps[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleSubmit = () => {
    if (!name.trim() || !type) return;
    createRoutine.mutate(
      {
        data: {
          name: name.trim(),
          type,
          categoryId,
          unit: unit.trim() || null,
          target: target ? Number(target) : null,
          targetDurationSeconds: targetMinutes ? Number(targetMinutes) * 60 : null,
          activeDays,
          positionX: spawnX ?? (120 + Math.random() * 200),
          positionY: spawnY ?? (120 + Math.random() * 200),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoutinesQueryKey() });
          onDone();
        },
      },
    );
  };

  const toggleDay = (day: number) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const methodFor = (t: string) => MEASUREMENT_METHODS.find((m) => m.type === t);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 15 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className="fixed inset-0 flex items-center justify-center z-[100] p-4 bg-black/40 backdrop-blur-sm"
    >
      <Card className="w-full max-w-lg p-6 border border-white/10 bg-card/70 backdrop-blur-2xl shadow-2xl relative flex flex-col overflow-hidden rounded-3xl">
        {/* Soft Ambient Inner Glow */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
        
        <header className="flex justify-between items-center mb-6">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-primary font-bold">New Routine</span>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Create Routine</h1>
          </div>
          <button
            onClick={onDone}
            className="p-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Progress Dots */}
        <div className="flex items-center gap-1.5 mb-6">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i <= stepIndex ? "bg-primary flex-[2]" : "bg-white/5 flex-1",
              )}
            />
          ))}
        </div>

        {/* Form Body with Height Transition */}
        <div className="flex-1 min-h-[220px] max-h-[420px] overflow-y-auto pr-1">
          <AnimatePresence mode="wait">
            {step === "name" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h2 className="text-sm font-semibold text-muted-foreground">What do you want to build?</h2>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning Meditation"
                  className="bg-muted/40 border-white/5 rounded-xl text-sm h-11"
                  onKeyDown={(e) => e.key === "Enter" && canAdvance && goNext()}
                />
              </motion.div>
            )}

            {step === "category" && (
              <motion.div
                key="category"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h2 className="text-sm font-semibold text-muted-foreground">Which category fits?</h2>
                <div className="grid grid-cols-2 gap-2">
                  {categories?.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                      className={cn(
                        "p-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex items-center gap-2",
                        categoryId === c.id
                          ? "bg-white/10 text-foreground border-white/20 shadow-lg"
                          : "bg-muted/20 text-muted-foreground border-transparent hover:border-white/5 hover:bg-muted/30"
                      )}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === "method" && (
              <motion.div
                key="method"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <h2 className="text-sm font-semibold text-muted-foreground">How should we track progress?</h2>
                <div className="grid gap-2">
                  {MEASUREMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.type}
                        onClick={() => setType(m.type)}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all cursor-pointer flex gap-3 items-start",
                          type === m.type
                            ? "bg-white/10 text-foreground border-white/20 shadow-lg"
                            : "bg-muted/20 text-muted-foreground border-transparent hover:border-white/5 hover:bg-muted/30"
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5 border border-white/5">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-foreground">{m.label}</div>
                          <div className="text-[10px] text-muted-foreground/80 mt-0.5">{m.description}</div>
                          <div className="text-[9px] font-mono text-muted-foreground/50 mt-1 truncate">{m.examples}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === "details" && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h2 className="text-sm font-semibold text-muted-foreground">Refine your target</h2>

                {(type === "numeric" || type === "session" || type === "distance") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Target value</Label>
                      <Input
                        type="number"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder="e.g. 8"
                        className="bg-muted/40 border-white/5 rounded-xl h-10 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <Input
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder={type === "distance" ? "km, miles" : "glasses, pages"}
                        className="bg-muted/40 border-white/5 rounded-xl h-10 text-xs"
                      />
                    </div>
                  </div>
                )}

                {type === "duration" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Target duration (minutes)</Label>
                    <Input
                      type="number"
                      value={targetMinutes}
                      onChange={(e) => setTargetMinutes(e.target.value)}
                      placeholder="e.g. 45"
                      className="bg-muted/40 border-white/5 rounded-xl h-10 text-xs"
                    />
                  </div>
                )}

                {type === "open" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Unit (optional)</Label>
                    <Input
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="entries, ideas, minutes..."
                      className="bg-muted/40 border-white/5 rounded-xl h-10 text-xs"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Active days</Label>
                  <div className="flex gap-1.5 justify-between">
                    {DAY_LABELS.map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={cn(
                          "w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center",
                          activeDays.includes(i)
                            ? "bg-primary text-primary-foreground font-semibold shadow-[0_0_12px_rgba(189,255,77,0.3)]"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-white/5",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
          {stepIndex > 0 ? (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <button
              onClick={onDone}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            onClick={goNext}
            disabled={!canAdvance || createRoutine.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
          >
            {step === "details" ? "Create Routine" : "Continue"}
            {step !== "details" && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </Card>
    </motion.div>
  );
}
