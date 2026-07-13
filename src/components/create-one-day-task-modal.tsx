import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X, Sparkles, ListTodo } from "lucide-react";
import {
  useCreateQuickTask,
  useListCategories,
  getGetTodaySummaryQueryKey
} from "@workspace/api-client-react";
import { getTodayStr } from "@/lib/utils";
import { Card, Input, Label } from "@/components/ui";

export function CreateOneDayTaskModal({
  onDone,
  getSpawnPosition,
  onSuccessCreated
}: {
  onDone: () => void;
  getSpawnPosition: (id: number) => { x: number; y: number };
  onSuccessCreated: (task: any) => void;
}) {
  const { data: categories } = useListCategories();
  const createQuickTask = useCreateQuickTask();
  const queryClient = useQueryClient();
  const today = getTodayStr();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const spawnPos = getSpawnPosition(0);

    createQuickTask.mutate(
      {
        data: {
          title: title.trim(),
          notes: notes.trim() || null,
          categoryId,
          positionX: spawnPos.x,
          positionY: spawnPos.y
        }
      },
      {
        onSuccess: (newTask) => {
          queryClient.invalidateQueries({ queryKey: ["quick-tasks"] });
          queryClient.invalidateQueries({ queryKey: getGetTodaySummaryQueryKey({ date: today }) });
          onSuccessCreated(newTask);
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
      <Card className="w-full max-w-md p-6 border border-white/10 bg-card/70 backdrop-blur-2xl shadow-2xl relative flex flex-col overflow-hidden rounded-3xl text-foreground">
        {/* Soft Ambient Inner Glow */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        <header className="flex justify-between items-center mb-6">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-primary font-bold">Today Only</span>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <ListTodo className="w-5 h-5 text-primary" />
              <span>New One-Day Task</span>
            </h1>
          </div>
          <button
            onClick={onDone}
            className="p-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Task Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Plan layout feedback"
              className="bg-muted/40 border-white/5 rounded-xl text-sm h-11 focus-visible:ring-primary focus-visible:border-primary"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes (Optional)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add more details about this task..."
              className="w-full bg-muted/40 border border-white/5 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all resize-none h-20"
            />
          </div>

          {categories && categories.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category (Optional)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer ${
                      categoryId === c.id
                        ? "bg-primary/10 border-primary text-foreground shadow-[0_0_12px_rgba(189,255,77,0.15)]"
                        : "border-white/5 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2.5 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onDone}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || createQuickTask.isPending}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-lg shadow-primary/20 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
          </div>
        </form>
      </Card>
    </motion.div>
  );
}
