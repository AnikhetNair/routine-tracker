import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Target,
  Timer,
  Route as RouteIcon,
  Repeat,
  Sparkles,
  X
} from "lucide-react";
import {
  useUpdateRoutine,
  useListCategories,
  getListRoutinesQueryKey,
  Routine,
  RoutineType
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Card, Input, Label } from "@/components/ui";

const MEASUREMENT_METHODS: {
  type: RoutineType;
  label: string;
  icon: typeof CheckCircle2;
  description: string;
}[] = [
  {
    type: "boolean",
    label: "Simple Completion",
    icon: CheckCircle2,
    description: "One click completes it.",
  },
  {
    type: "numeric",
    label: "Goal Progress",
    icon: Target,
    description: "A measurable target with quick increments.",
  },
  {
    type: "duration",
    label: "Time Based",
    icon: Timer,
    description: "A live timer toward a target duration.",
  },
  {
    type: "distance",
    label: "Distance",
    icon: RouteIcon,
    description: "Current distance vs. a target distance.",
  },
  {
    type: "session",
    label: "Session Count",
    icon: Repeat,
    description: "Repeated sessions with a target count.",
  },
  {
    type: "open",
    label: "Open Progress",
    icon: Sparkles,
    description: "Free logging, no fixed finish line.",
  },
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function EditRoutineModal({
  routine,
  onDone
}: {
  routine: Routine;
  onDone: () => void;
}) {
  const { data: categories } = useListCategories();
  const updateRoutine = useUpdateRoutine();
  const queryClient = useQueryClient();

  const [name, setName] = useState(routine.name);
  const [categoryId, setCategoryId] = useState<number | null>(routine.categoryId);
  const [type, setType] = useState<RoutineType>(routine.type);
  const [unit, setUnit] = useState(routine.unit || "");
  const [target, setTarget] = useState<string>(routine.target ? String(routine.target) : "");
  const [targetMinutes, setTargetMinutes] = useState<string>(
    routine.targetDurationSeconds ? String(Math.round(routine.targetDurationSeconds / 60)) : ""
  );
  const [activeDays, setActiveDays] = useState<number[]>(routine.activeDays || [0, 1, 2, 3, 4, 5, 6]);

  const toggleDay = (day: number) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    updateRoutine.mutate(
      {
        id: routine.id,
        data: {
          name: name.trim(),
          type,
          categoryId,
          unit: unit.trim() || null,
          target: target ? Number(target) : null,
          targetDurationSeconds: targetMinutes ? Number(targetMinutes) * 60 : null,
          activeDays,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoutinesQueryKey() });
          onDone();
        }
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 15 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className="fixed inset-0 flex items-center justify-center z-[100] p-4 bg-black/40 backdrop-blur-sm"
    >
      <Card className="w-full max-w-lg p-6 border border-white/10 bg-card/70 backdrop-blur-2xl shadow-2xl relative flex flex-col overflow-hidden rounded-3xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
        
        <header className="flex justify-between items-center mb-6">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-primary font-bold">Manage Routine</span>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Edit Routine</h1>
          </div>
          <button
            onClick={onDone}
            className="p-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 max-h-[460px] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Routine Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning Meditation"
              className="bg-muted/40 border-white/5 rounded-xl text-sm h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Measurement Method</Label>
            <div className="grid grid-cols-2 gap-2">
              {MEASUREMENT_METHODS.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.type}
                    onClick={() => setType(m.type)}
                    className={cn(
                      "p-3 rounded-xl border text-left text-xs transition-all cursor-pointer flex gap-2.5 items-center",
                      type === m.type
                        ? "bg-white/10 text-foreground border-white/20 shadow-lg"
                        : "bg-muted/20 text-muted-foreground border-transparent hover:border-white/5 hover:bg-muted/30"
                    )}
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold text-xs text-foreground truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

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
        </div>

        <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-white/5">
          <button
            onClick={onDone}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || updateRoutine.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      </Card>
    </motion.div>
  );
}
