import { useState, useMemo } from "react";
import { 
  useGetDailySnapshot, 
  useGetHeatmap, 
  useListCategories, 
  useListQuickTasks, 
  useListConnections 
} from "@workspace/api-client-react";
import { Progress, Button, Card, Badge } from "@/components/ui";
import { LightweightLoader } from "@/components/lightweight-loader";
import { format, parseISO } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Quote, 
  ArrowLeft, 
  Loader2, 
  Zap, 
  Brain, 
  Star, 
  Award, 
  Clock, 
  Activity, 
  Sparkles, 
  Map, 
  Layers, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  PenLine,
  Flame,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function routineStatusLabel(routine: {
  type: string;
  value: number;
  target: number | null;
  targetDurationSeconds: number | null;
  elapsedSeconds: number;
  unit: string | null;
}) {
  if (routine.type === "duration") {
    return routine.targetDurationSeconds
      ? `${formatDuration(routine.elapsedSeconds)} / ${formatDuration(routine.targetDurationSeconds)}`
      : formatDuration(routine.elapsedSeconds);
  }
  if (routine.target) return `${routine.value} / ${routine.target} ${routine.unit ?? ""}`.trim();
  return `${routine.value} ${routine.unit ?? ""}`.trim();
}

export default function History() {
  const currentYear = new Date().getFullYear();
  const [view, setView] = useState<'years' | 'months' | 'days' | 'snapshot'>('years');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Always fetch heatmap for selectedYear (it caches)
  const { data: heatmap, isLoading: hLoading } = useGetHeatmap({ year: selectedYear });
  const { data: snapshot, isLoading: sLoading } = useGetDailySnapshot(selectedDate);
  const { data: categories, isLoading: catLoading } = useListCategories();
  const { data: quickTasks, isLoading: qtLoading } = useListQuickTasks({ date: selectedDate });
  const { data: connections, isLoading: connLoading } = useListConnections();

  const isHistoryLoading = hLoading || sLoading || catLoading || qtLoading || connLoading;

  const handlePrevDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    const prevDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setSelectedDate(prevDateStr);
    setSelectedMonth(d.getMonth());
    setSelectedYear(d.getFullYear());
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (selectedDate === todayStr) return;
    const nextDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setSelectedDate(nextDateStr);
    setSelectedMonth(d.getMonth());
    setSelectedYear(d.getFullYear());
  };

  const dateHelpers = useMemo(() => {
    let seed = 0;
    for (let char of selectedDate) {
      seed += char.charCodeAt(0);
    }
    
    const quotes = [
      "The secret of your future is hidden in your daily routine.",
      "Focus is a muscle, and you built it today.",
      "Consistency is quiet excellence.",
      "One small step today is a giant leap for your consistency tomorrow.",
      "Rhythm is not about perfection, it is about staying in the dance.",
      "Track your efforts, cherish your energy, and trust your pace.",
      "The only limit to our realization of tomorrow will be our doubts of today.",
      "Simplicity is the ultimate sophistication of routine.",
      "Your energy is your currency. Spend it wisely.",
      "Continuous effort, not strength or intelligence, is the key to unlocking our potential."
    ];
    const selectedQuote = quotes[seed % quotes.length];

    // Find actual completion timestamps
    let actualFinish = "Unfinished";
    let completedRoutinesCount = 0;
    if (snapshot && snapshot.routines) {
      const completedRoutines = snapshot.routines.filter((r: any) => r.completed && r.completedAt);
      completedRoutinesCount = completedRoutines.length;
      if (completedRoutines.length > 0) {
        const times = completedRoutines.map((r: any) => new Date(r.completedAt).getTime());
        const maxTime = Math.max(...times);
        actualFinish = new Date(maxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }

    const focusSeconds = snapshot?.routines.reduce((sum: number, r: any) => sum + (r.elapsedSeconds || 0), 0) || 0;
    const focusDurationStr = focusSeconds > 0 
      ? `${Math.floor(focusSeconds / 60)}m`
      : "0m";

    // Calculate actual morning/afternoon/evening/night percentages based on completed timestamps
    let rMorning = 0;
    let rAfternoon = 0;
    let rEvening = 0;
    let rNight = 0;

    if (snapshot && snapshot.routines) {
      const completedWithTimestamp = snapshot.routines.filter((r: any) => r.completed && r.completedAt);
      const totalCompleted = completedWithTimestamp.length;
      if (totalCompleted > 0) {
        let mCount = 0;
        let aCount = 0;
        let eCount = 0;
        let nCount = 0;

        completedWithTimestamp.forEach((r: any) => {
          try {
            const h = new Date(r.completedAt).getHours();
            if (h >= 5 && h < 12) mCount++;
            else if (h >= 12 && h < 17) aCount++;
            else if (h >= 17 && h < 22) eCount++;
            else nCount++;
          } catch (e) {
            mCount++;
          }
        });

        rMorning = Math.round((mCount / totalCompleted) * 100);
        rAfternoon = Math.round((aCount / totalCompleted) * 100);
        rEvening = Math.round((eCount / totalCompleted) * 100);
        rNight = Math.round((nCount / totalCompleted) * 100);
      }
    }

    const achievements = [
      { name: "Routines Completed", value: `${snapshot?.completedCount || 0} / ${snapshot?.activeCount || 0}`, desc: "Direct Progress" },
      { name: "Daily Completion Rate", value: `${Math.round(snapshot?.completionPercentage || 0)}%`, desc: "Focus Efficiency" },
      { name: "Total Tracked Focus", value: focusDurationStr, desc: "Deep Flow Time" },
      { name: "Active Categories", value: `${snapshot ? new Set(snapshot.routines.map((r: any) => r.categoryId)).size : 0}`, desc: "Variety in Balance" }
    ];

    const inProgressCount = snapshot ? snapshot.routines.filter((r: any) => !r.completed).length : 0;
    const completedChains = snapshot ? snapshot.routines.filter((r: any) => r.completed).length : 0;

    return {
      rMorning,
      rAfternoon,
      rEvening,
      rNight,
      selectedQuote,
      actualFinish,
      achievements,
      inProgressCount,
      completedChains,
      completedRoutinesCount,
      focusDurationStr
    };
  }, [selectedDate, snapshot]);

  // Extract completed routines with formatted times
  const completedWithTimes = useMemo(() => {
    if (!snapshot || !snapshot.routines) return [];
    return snapshot.routines
      .filter((r: any) => r.completed && r.completedAt)
      .map((r: any) => ({
        ...r,
        time: new Date(r.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(r.completedAt).getTime()
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [snapshot]);

  // Extract Workflow Chains snapshot
  const workflowChains = useMemo(() => {
    if (!snapshot || !snapshot.routines || !connections) return [];
    
    const dayRoutineIds = new Set(snapshot.routines.map((r: any) => r.routineId));
    const dayConnections = connections.filter((c: any) => dayRoutineIds.has(c.fromRoutineId) && dayRoutineIds.has(c.toRoutineId));
    
    const adj: Record<number, number[]> = {};
    const inDegree: Record<number, number> = {};
    
    snapshot.routines.forEach((r: any) => {
      adj[r.routineId] = [];
      inDegree[r.routineId] = 0;
    });
    
    dayConnections.forEach((c: any) => {
      if (adj[c.fromRoutineId]) {
        adj[c.fromRoutineId].push(c.toRoutineId);
      }
      inDegree[c.toRoutineId] = (inDegree[c.toRoutineId] || 0) + 1;
    });
    
    const chains: any[][] = [];
    const visited = new Set<number>();
    
    const dfs = (nodeId: number, currentPath: any[]) => {
      visited.add(nodeId);
      const rNode = snapshot.routines.find((r: any) => r.routineId === nodeId);
      if (rNode) {
        currentPath.push(rNode);
      }
      
      const neighbors = adj[nodeId] || [];
      const unvisitedNeighbors = neighbors.filter(n => !visited.has(n));
      
      if (unvisitedNeighbors.length > 0) {
        unvisitedNeighbors.forEach(neighbor => {
          dfs(neighbor, [...currentPath]);
        });
      } else {
        if (currentPath.length > 1) {
          chains.push(currentPath);
        }
      }
    };
    
    snapshot.routines.forEach((r: any) => {
      if (inDegree[r.routineId] === 0 && !visited.has(r.routineId)) {
        dfs(r.routineId, []);
      }
    });
    
    return chains;
  }, [snapshot, connections]);

  const realHistoryStats = useMemo(() => {
    const raw = localStorage.getItem("logs_v4");
    if (!raw) return null;
    try {
      const logs = JSON.parse(raw) as Record<string, Record<number, { completed: boolean; completedAt?: string; elapsedSeconds?: number; value?: number }>>;
      const dates = Object.keys(logs).sort();
      let totalCompletedCount = 0;
      let totalCompletionPctSum = 0;
      let loggedDaysCount = 0;
      
      for (const dateStr of dates) {
        const dayLogs = logs[dateStr];
        let completedInDay = 0;
        let loggedInDay = Object.keys(dayLogs).length;
        if (loggedInDay > 0) {
          for (const rId in dayLogs) {
            if (dayLogs[rId].completed) {
              completedInDay++;
              totalCompletedCount++;
            }
          }
          totalCompletionPctSum += (completedInDay / loggedInDay) * 100;
          loggedDaysCount++;
        }
      }
      
      const averageCompletion = loggedDaysCount > 0 ? Math.round(totalCompletionPctSum / loggedDaysCount) : 0;
      return {
        averageCompletion,
        loggedDaysCount,
        totalCompletedCount,
        hasHistory: dates.length > 0 && totalCompletedCount > 0
      };
    } catch (e) {
      return null;
    }
  }, [snapshot]);

  const years = [currentYear - 2, currentYear - 1, currentYear];

  const calculateYearAvg = () => {
    if (!heatmap || heatmap.length === 0) return 0;
    const sum = heatmap.reduce((acc, h) => acc + h.completionPercentage, 0);
    return Math.round(sum / heatmap.length);
  };

  const calculateMonthAvg = (monthIndex: number) => {
    if (!heatmap) return 0;
    const prefix = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    const monthDays = heatmap.filter(h => h.date.startsWith(prefix));
    if (monthDays.length === 0) return 0;
    const sum = monthDays.reduce((acc, h) => acc + h.completionPercentage, 0);
    return Math.round(sum / monthDays.length);
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getStartDayOfWeek = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const startDay = getStartDayOfWeek(selectedYear, selectedMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: startDay }, (_, i) => i);

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto space-y-10 pb-24">
      <AnimatePresence mode="popLayout">
        
        {/* YEARS VIEW */}
        {view === 'years' && (
          <motion.div key="years" className="space-y-8" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} transition={{ type: "spring", stiffness: 100, damping: 20 }}>
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2">History</h1>
              <p className="text-muted-foreground">Travel back through time.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {years.map(y => (
                <motion.div 
                  layoutId={`container-${y}`}
                  key={y}
                  onClick={() => { setSelectedYear(y); setView('months'); }}
                  className="bg-card p-8 rounded-3xl cursor-pointer hover:bg-secondary/50 transition-colors border border-border group"
                >
                  <motion.h2 layoutId={`title-${y}`} className="text-4xl font-bold mb-4 group-hover:text-primary transition-colors">{y}</motion.h2>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {y === selectedYear && heatmap ? `${calculateYearAvg()}% Avg Completion` : "View Year"}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* MONTHS VIEW */}
        {view === 'months' && (
          <motion.div key="months" className="space-y-6 w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.1 }} transition={{ type: "spring", stiffness: 100, damping: 20 }}>
            <Button variant="ghost" onClick={() => setView('years')} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Years
            </Button>
            <motion.div layoutId={`container-${selectedYear}`} className="bg-card p-8 rounded-3xl w-full border border-border">
              <motion.h2 layoutId={`title-${selectedYear}`} className="text-4xl font-bold mb-8 text-primary">{selectedYear}</motion.h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {monthNames.map((m, i) => {
                  const avg = calculateMonthAvg(i);
                  return (
                    <motion.div 
                      layoutId={`container-${selectedYear}-${i}`}
                      key={i}
                      onClick={() => { setSelectedMonth(i); setView('days'); }}
                      className="bg-background/50 p-6 rounded-2xl cursor-pointer hover:bg-secondary/50 transition-colors border border-border/50 group"
                    >
                      <motion.h3 layoutId={`title-${selectedYear}-${i}`} className="text-2xl font-semibold mb-2 group-hover:text-primary transition-colors">{m}</motion.h3>
                      <div className="text-xs text-muted-foreground font-mono">{avg > 0 ? `${avg}% avg` : '-'}</div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* DAYS VIEW */}
        {view === 'days' && (
          <motion.div key="days" className="space-y-6 w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.1 }} transition={{ type: "spring", stiffness: 100, damping: 20 }}>
            <div className="flex gap-2 mb-4">
              <Button variant="ghost" onClick={() => setView('years')} className="text-muted-foreground hover:text-foreground">
                {selectedYear}
              </Button>
              <span className="text-muted-foreground py-2">/</span>
              <Button variant="ghost" onClick={() => setView('months')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> {monthNames[selectedMonth]}
              </Button>
            </div>
            
            <motion.div layoutId={`container-${selectedYear}-${selectedMonth}`} className="bg-card p-8 rounded-3xl w-full border border-border">
              <motion.h3 layoutId={`title-${selectedYear}-${selectedMonth}`} className="text-4xl font-bold mb-8 text-primary">{monthNames[selectedMonth]} {selectedYear}</motion.h3>
              
              <div className="grid grid-cols-7 gap-4">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="text-muted-foreground text-sm font-semibold text-center mb-2">{d}</div>
                ))}
                {blanks.map(b => <div key={`blank-${b}`} />)}
                {days.map(d => {
                  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const heat = heatmap?.find(h => h.date === dateStr);
                  const pct = heat?.completionPercentage || 0;
                  
                  // Color intensity based on pct
                  let bgClass = "bg-background/50 hover:bg-secondary/80";
                  if (pct > 80) bgClass = "bg-primary/40 hover:bg-primary/50 text-primary-foreground";
                  else if (pct > 50) bgClass = "bg-primary/20 hover:bg-primary/30 text-primary-foreground";
                  else if (pct > 0) bgClass = "bg-primary/10 hover:bg-primary/20 text-primary-foreground";

                  return (
                    <motion.div 
                      layoutId={`container-${dateStr}`}
                      key={d}
                      onClick={() => { setSelectedDate(dateStr); setView('snapshot'); }}
                      className={`aspect-square rounded-2xl p-3 md:p-4 cursor-pointer transition-all border border-border/50 flex flex-col justify-between group ${bgClass}`}
                    >
                      <motion.span layoutId={`title-${dateStr}`} className="font-semibold text-lg">{d}</motion.span>
                      {pct > 0 && <div className="text-right font-mono text-xs opacity-70 group-hover:opacity-100">{pct}%</div>}
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* SNAPSHOT VIEW */}
        {view === 'snapshot' && (
          <motion.div key="snapshot" className="space-y-6 w-full max-w-4xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 100, damping: 20 }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setView('years')} className="text-muted-foreground hover:text-foreground">
                  {selectedYear}
                </Button>
                <span className="text-muted-foreground py-2">/</span>
                <Button variant="ghost" onClick={() => setView('months')} className="text-muted-foreground hover:text-foreground">
                  {monthNames[selectedMonth]}
                </Button>
                <span className="text-muted-foreground py-2">/</span>
                <Button variant="ghost" onClick={() => setView('days')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Calendar
                </Button>
              </div>

              {/* Timeline Navigation: Prev / Next adjacent days */}
              <div className="flex items-center gap-2 bg-secondary/20 p-1 rounded-xl border border-border/40">
                <Button variant="ghost" size="sm" onClick={handlePrevDay} className="h-9 px-3 text-sm hover:bg-secondary/40">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous Day
                </Button>
                <div className="h-4 w-[1px] bg-border/50" />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleNextDay} 
                  disabled={selectedDate === format(new Date(), 'yyyy-MM-dd')}
                  className="h-9 px-3 text-sm hover:bg-secondary/40 disabled:opacity-40"
                >
                  Next Day <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            <motion.div layoutId={`container-${selectedDate}`} className="bg-card p-6 md:p-10 rounded-3xl w-full border-l-4 border-l-primary border-y border-r border-border shadow-2xl space-y-10">
              {/* Header Title with Date and Percentage */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-border/50">
                <div>
                  <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest mb-1">
                    <Sparkles className="w-4 h-4" /> Productivity Memory Snapshot
                  </div>
                  <motion.h2 layoutId={`title-${selectedDate}`} className="text-3xl md:text-4xl font-bold tracking-tight">
                    {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
                  </motion.h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-4xl font-bold text-primary font-mono">{Math.round(snapshot?.completionPercentage || 0)}%</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Completion Rate</div>
                  </div>
                </div>
              </div>

              {sLoading && <div className="py-12 flex justify-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin" /></div>}

              {snapshot && snapshot.activeCount === 0 && (
                <div className="py-16 text-center space-y-4">
                  <CalendarIcon className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                  <h3 className="text-lg font-semibold text-muted-foreground">No active routines on this date.</h3>
                  <p className="text-sm text-muted-foreground/60 max-w-sm mx-auto">
                    There were no routines active or scheduled for completion on {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}.
                  </p>
                </div>
              )}

              {snapshot && snapshot.activeCount > 0 && (
                <div className="space-y-10">
                  
                  {/* BENTO GRID: Productivity Snapshot & Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Progress details */}
                    <Card className="p-6 md:col-span-2 border border-border/50 bg-background/30 flex flex-col justify-between space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Completion Progress</h4>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-foreground">{snapshot.completedCount}</span>
                          <span className="text-muted-foreground text-sm">/ {snapshot.activeCount} routines</span>
                        </div>
                      </div>
                      <Progress value={snapshot.completionPercentage} className="h-2 bg-secondary" />
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30 text-xs text-muted-foreground font-mono">
                        <div>Completed: <span className="text-primary font-semibold">{snapshot.completedCount}</span></div>
                        <div>Incomplete: <span className="text-destructive font-semibold">{Math.max(0, snapshot.activeCount - snapshot.completedCount)}</span></div>
                      </div>
                    </Card>

                    {/* Streak & Consistency */}
                    <Card className="p-6 border border-border/50 bg-background/30 flex flex-col justify-between space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Consistency Peak</h4>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <Flame className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold font-mono">
                              {snapshot.currentStreak > 0 ? `${snapshot.currentStreak} Days` : "No Streak"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {snapshot.currentStreak > 0 ? "Persistent momentum" : "Unlogged or broken streak"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground pt-2 border-t border-border/30 font-mono">
                        Active streak at this date
                      </div>
                    </Card>

                    {/* Completions Boundary Card */}
                    <Card className="p-6 border border-border/50 bg-background/30 flex flex-col justify-between space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Completion Boundaries</h4>
                        <div className="space-y-2">
                          {dateHelpers.completedRoutinesCount > 0 ? (
                            <>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">First Logged:</span>
                                <span className="font-semibold font-mono text-primary">
                                  {completedWithTimes[0]?.time}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">Last Logged:</span>
                                <span className="font-semibold font-mono text-primary">
                                  {dateHelpers.actualFinish}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground font-mono italic py-1">
                              No logs recorded today.
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground pt-2 border-t border-border/30 font-mono">
                        Day boundaries of action
                      </div>
                    </Card>
                  </div>

                  {/* SUBSECTION: Energy, Focus & Day Ratings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="p-6 border border-border/40 bg-secondary/5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-400" />
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Energy Levels</h4>
                      </div>
                      <div className="flex items-center gap-3">
                        {snapshot.reflection?.energy === "high" && (
                          <span className="px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-semibold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" /> 🟢 High Energy
                          </span>
                        )}
                        {snapshot.reflection?.energy === "medium" && (
                          <span className="px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-semibold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> 🟡 Mid Energy
                          </span>
                        )}
                        {snapshot.reflection?.energy === "low" && (
                          <span className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> 🔴 Low Energy
                          </span>
                        )}
                        {!snapshot.reflection?.energy && (
                          <span className="px-3 py-1.5 rounded-full bg-muted/10 border border-border/40 text-muted-foreground text-xs font-mono">
                            Not recorded
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Measured physical and cognitive energy reserves throughout the logging cycle.
                      </p>
                    </Card>

                    <Card className="p-6 border border-border/40 bg-secondary/5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-blue-400" />
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Focus Quality</h4>
                      </div>
                      <div className="flex items-center gap-1">
                        {snapshot.reflection?.focusRating ? (
                          <>
                            {Array.from({ length: 5 }).map((_, idx) => {
                              const val = snapshot.reflection?.focusRating || 0;
                              return (
                                <Star 
                                  key={idx} 
                                  className={`w-6 h-6 ${idx < val ? "text-yellow-400 fill-yellow-400" : "text-muted/40"}`} 
                                />
                              );
                            })}
                            <span className="ml-2 text-sm font-semibold font-mono text-foreground font-bold">
                              ({snapshot.reflection.focusRating}/5)
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">Not recorded</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Deep focus capacity, distraction resistance, and flow state duration levels.
                      </p>
                    </Card>

                    <Card className="p-6 border border-border/40 bg-secondary/5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-indigo-400" />
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Day Satisfaction</h4>
                      </div>
                      <div className="flex items-center gap-1">
                        {snapshot.reflection?.dayRating ? (
                          <>
                            {Array.from({ length: 5 }).map((_, idx) => {
                              const val = snapshot.reflection?.dayRating || 0;
                              return (
                                <Star 
                                  key={idx} 
                                  className={`w-6 h-6 ${idx < val ? "text-amber-400 fill-amber-400" : "text-muted/40"}`} 
                                />
                              );
                            })}
                            <span className="ml-2 text-sm font-semibold font-mono text-foreground font-bold">
                              ({snapshot.reflection.dayRating}/5)
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">Not recorded</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Overall subjective index rating reflecting productivity achievement vs expectations.
                      </p>
                    </Card>
                  </div>

                  {/* SUBSECTION: Memory of the Day Polaroid Highlight Card & Journal */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* POLAROID MEMORY CARD */}
                    <div className="md:col-span-5 flex flex-col justify-center items-center bg-card p-6 rounded-2xl border border-border/60 shadow-lg relative transform rotate-[-1deg] hover:rotate-0 transition-transform duration-300">
                      <div className="w-full aspect-[4/3] bg-muted/20 rounded-lg border border-border/30 overflow-hidden relative flex flex-col justify-center items-center p-6 text-center space-y-3">
                        {snapshot.reflection?.wentWell ? (
                          <>
                            <Sparkles className="w-8 h-8 text-primary/80 animate-pulse" />
                            <div className="text-xs text-primary font-semibold uppercase tracking-wider">Highlight of the Day</div>
                            <h5 className="font-bold text-lg text-foreground tracking-tight px-2 leading-snug">
                              {snapshot.reflection.wentWell}
                            </h5>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-8 h-8 text-muted/60" />
                            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Highlight of the Day</div>
                            <h5 className="font-semibold text-sm text-muted-foreground/80 tracking-tight px-4 leading-snug">
                              No daily highlight recorded.
                            </h5>
                          </>
                        )}
                        
                        <div className="text-xs font-mono text-muted-foreground">
                          Tracked focus: {dateHelpers.focusDurationStr}
                        </div>
                        {snapshot.completionPercentage > 80 && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] uppercase font-mono font-bold">
                            🏆 Peak Day
                          </span>
                        )}
                      </div>
                      <div className="w-full pt-6 pb-2 text-center">
                        <span className="font-serif italic text-base text-muted-foreground/90 font-medium">
                          "Memory of the Day"
                        </span>
                        <div className="text-[10px] font-mono text-muted-foreground/60 mt-2 uppercase tracking-widest">
                          Captured {selectedDate}
                        </div>
                      </div>
                    </div>

                    {/* ONE-LINE JOURNAL & PROMPT Q&A */}
                    <Card className="md:col-span-7 p-6 border border-border/50 bg-secondary/10 flex flex-col justify-between space-y-6">
                      {/* One-Line Journal */}
                      <div className="space-y-2 border-b border-border/30 pb-4">
                        <h4 className="text-xs uppercase font-bold tracking-widest text-primary flex items-center gap-2">
                          <PenLine className="w-4 h-4" /> One-Line Journal
                        </h4>
                        {snapshot.reflection?.journal ? (
                          <blockquote className="font-serif italic text-base text-foreground/90 leading-relaxed border-l-2 border-primary/40 pl-3">
                            "{snapshot.reflection.journal}"
                          </blockquote>
                        ) : (
                          <p className="text-sm italic text-muted-foreground border-l-2 border-muted/40 pl-3 font-mono py-1">
                            No journal entry logged today.
                          </p>
                        )}
                      </div>

                      {/* Prompt Q&A */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground font-mono uppercase">
                          Daily Reflection Prompt
                        </div>
                        {snapshot.reflection?.reflectionPrompt && snapshot.reflection?.reflectionAnswer ? (
                          <div className="p-4 rounded-xl bg-background/50 border border-border/30 space-y-2">
                            <div className="text-sm font-semibold text-primary flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                              {snapshot.reflection.reflectionPrompt}
                            </div>
                            <p className="text-sm text-foreground/80 leading-relaxed pl-3.5">
                              {snapshot.reflection.reflectionAnswer}
                            </p>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-background/10 border border-dashed border-border/60 text-center text-sm text-muted-foreground font-mono">
                            No daily reflection Q&A completed.
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* THREE-COLUMN SELF REVIEW BULLETS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-secondary/10 p-6 rounded-2xl border border-border/30">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-primary font-bold mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary" /> Went Well
                      </div>
                      <p className={`text-sm leading-relaxed p-3 rounded-xl border ${snapshot.reflection?.wentWell ? "text-foreground/85 bg-background/30 border-border/20" : "text-muted-foreground/60 bg-background/10 border-dashed border-border/40 font-mono"}`}>
                        {snapshot.reflection?.wentWell || "Not recorded"}
                      </p>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-destructive font-bold mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-destructive" /> Could Improve
                      </div>
                      <p className={`text-sm leading-relaxed p-3 rounded-xl border ${snapshot.reflection?.couldImprove ? "text-foreground/85 bg-background/30 border-border/20" : "text-muted-foreground/60 bg-background/10 border-dashed border-border/40 font-mono"}`}>
                        {snapshot.reflection?.couldImprove || "Not recorded"}
                      </p>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground" /> Focus Tomorrow
                      </div>
                      <p className={`text-sm leading-relaxed p-3 rounded-xl border ${snapshot.reflection?.focusTomorrow ? "text-foreground/85 bg-background/30 border-border/20" : "text-muted-foreground/60 bg-background/10 border-dashed border-border/40 font-mono"}`}>
                        {snapshot.reflection?.focusTomorrow || "Not recorded"}
                      </p>
                    </div>
                  </div>

                  {/* ONE-DAY TASKS (QUICK TASKS) */}
                  <Card className="p-6 border border-border/50 bg-card/60 space-y-4">
                    <div className="flex items-center justify-between border-b border-border/30 pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        <h4 className="font-bold text-base text-foreground tracking-tight">One-Day Tasks of the Day</h4>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {quickTasks ? quickTasks.length : 0} Total
                      </Badge>
                    </div>
                    {quickTasks && quickTasks.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {quickTasks.map(task => (
                          <div 
                            key={task.id} 
                            className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border/60"
                          >
                            <div 
                              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                task.completed 
                                  ? "bg-primary/20 border-primary text-primary" 
                                  : "border-muted-foreground/40"
                              }`}
                            >
                              {task.completed && <span className="text-[10px] font-bold">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium leading-none block truncate ${
                                task.completed ? "line-through text-muted-foreground/80" : "text-foreground"
                              }`}>
                                {task.title}
                              </span>
                              {task.notes && (
                                <span className="text-xs text-muted-foreground block truncate mt-0.5">{task.notes}</span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded">
                              {task.completed ? "Completed" : "Active"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic font-mono text-center py-4 bg-secondary/5 rounded-xl border border-dashed border-border/40">
                        No one-day tasks logged for this date.
                      </p>
                    )}
                  </Card>

                  {/* ACTIVE WORKSPACE ROUTINES SECTION */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-bold tracking-tight">Active Workspace Routines</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {snapshot.routines.map((routine: any, index: number) => {
                        const cat = categories?.find(c => c.id === routine.categoryId) || { name: "General", color: "#6b7280" };
                        
                        // Stable completion time computation based on logged completedAt
                        let formattedTime = "";
                        if (routine.completed && routine.completedAt) {
                          try {
                            formattedTime = new Date(routine.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          } catch (e) {
                            formattedTime = "Unknown time";
                          }
                        }

                        return (
                          <div 
                            key={routine.routineId} 
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-background/50 rounded-2xl border border-border hover:bg-secondary/20 transition-colors gap-4"
                          >
                            <div className="flex items-start gap-3">
                              <div className="pt-1.5">
                                <div 
                                  className={`w-3.5 h-3.5 rounded-full transition-all`} 
                                  style={{ 
                                    backgroundColor: routine.completed ? cat.color : "transparent",
                                    border: `2.5px solid ${cat.color}`,
                                    boxShadow: routine.completed ? `0 0 10px ${cat.color}` : "none" 
                                  }} 
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-lg text-foreground/90">{routine.name}</span>
                                  <Badge 
                                    variant="outline" 
                                    style={{ 
                                      color: cat.color, 
                                      borderColor: `${cat.color}30`, 
                                      backgroundColor: `${cat.color}08` 
                                    }}
                                  >
                                    {cat.name}
                                  </Badge>
                                </div>
                                <div className="text-[10px] font-mono text-muted-foreground mt-1 uppercase tracking-wider">
                                  Canvas: Position ({Math.round(routine.positionX || 120)}, {Math.round(routine.positionY || 100)})
                                </div>
                              </div>
                            </div>
                            <div className="flex sm:flex-col items-end justify-between sm:justify-start w-full sm:w-auto gap-2 text-right">
                              <div className="text-sm font-extrabold text-foreground font-mono">
                                {routine.type === 'boolean' ? (
                                  routine.completed ? "Completed" : "Incomplete"
                                ) : (
                                  routineStatusLabel(routine)
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono font-medium">
                                {routine.completed ? (
                                  <span className="text-primary flex items-center gap-1 font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Logged at {formattedTime}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Pending action</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ACTIVE WORKFLOWS SNAPSHOT */}
                  <Card className="p-6 border border-border/50 bg-card/60 space-y-4">
                    <div className="flex items-center gap-2 border-b border-border/30 pb-3">
                      <Layers className="w-5 h-5 text-primary" />
                      <h4 className="font-bold text-base text-foreground tracking-tight">Active Workflows of the Day</h4>
                    </div>
                    {workflowChains.length > 0 ? (
                      <div className="space-y-4">
                        {workflowChains.map((chain, chainIdx) => (
                          <div key={chainIdx} className="p-4 rounded-xl bg-background/40 border border-border/50 space-y-3">
                            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/80 font-bold">
                              Workflow Chain #{chainIdx + 1}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {chain.map((node, nodeIdx) => {
                                const cat = categories?.find(c => c.id === node.categoryId) || { name: "General", color: "#6b7280" };
                                return (
                                  <div key={node.routineId} className="flex items-center gap-2">
                                    <div 
                                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                                        node.completed 
                                          ? "bg-primary/10 border-primary/40 text-primary" 
                                          : "bg-muted/10 border-border text-muted-foreground"
                                      }`}
                                    >
                                      <span 
                                        className="w-2 h-2 rounded-full" 
                                        style={{ backgroundColor: cat.color }}
                                      />
                                      {node.name}
                                      {node.completed && <span className="text-[10px] font-bold">✓</span>}
                                    </div>
                                    {nodeIdx < chain.length - 1 && (
                                      <span className="text-muted-foreground/60 font-bold">➔</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic font-mono text-center py-4 bg-secondary/5 rounded-xl border border-dashed border-border/40">
                        No active workflow connections detected between routines for today.
                      </p>
                    )}
                  </Card>

                  {/* TIMELINE OF LOGGED ACTIONS */}
                  <Card className="p-6 border border-border/50 bg-card/60 space-y-4">
                    <div className="flex items-center gap-2 border-b border-border/30 pb-3">
                      <Clock className="w-5 h-5 text-primary" />
                      <h4 className="font-bold text-base text-foreground tracking-tight">Timeline of Daily Accomplishments</h4>
                    </div>
                    {completedWithTimes.length > 0 ? (
                      <div className="relative pl-6 border-l border-border/60 space-y-6 py-2">
                        {completedWithTimes.map((item) => {
                          const cat = categories?.find(c => c.id === item.categoryId) || { name: "General", color: "#6b7280" };
                          return (
                            <div key={item.routineId} className="relative">
                              {/* Dot */}
                              <div 
                                className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-background"
                                style={{ backgroundColor: cat.color, boxShadow: `0 0 6px ${cat.color}` }}
                              />
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <div>
                                  <span className="font-bold text-sm text-foreground/95">{item.name}</span>
                                  <span className="text-xs text-muted-foreground font-mono ml-2">({cat.name})</span>
                                </div>
                                <span className="text-xs text-primary font-mono font-bold">{item.time}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic font-mono text-center py-4 bg-secondary/5 rounded-xl border border-dashed border-border/40">
                        No routine completions logged on this date.
                      </p>
                    )}
                  </Card>

                  {/* PERSONAL MILESTONE RECORDS */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-bold tracking-tight">Personal Milestone Records</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {dateHelpers.achievements.map((ach, idx) => (
                        <Card key={idx} className="p-4 border border-border/40 bg-secondary/10 flex flex-col justify-between space-y-2 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-8 h-8 bg-primary/10 rounded-bl-2xl flex items-center justify-center opacity-75 group-hover:opacity-100 transition-opacity">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground font-mono">{ach.desc}</div>
                            <h5 className="font-bold text-sm tracking-tight text-foreground/90">{ach.name}</h5>
                          </div>
                          <div className="text-xl font-extrabold text-primary font-mono">{ach.value}</div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* PRODUCTIVITY RHYTHM INTENSITY */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-bold tracking-tight">Productivity Rhythm Intensity</h3>
                    </div>
                    {dateHelpers.completedRoutinesCount > 0 ? (
                      <Card className="p-6 border border-border/40 bg-background/40">
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-xs font-mono mb-1">
                              <span className="text-muted-foreground font-semibold">Morning (5:00 AM - 12:00 PM)</span>
                              <span className="text-primary font-bold">{dateHelpers.rMorning}% of daily logs</span>
                            </div>
                            <Progress value={dateHelpers.rMorning} className="h-2 bg-secondary" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-mono mb-1">
                              <span className="text-muted-foreground font-semibold">Afternoon (12:00 PM - 5:00 PM)</span>
                              <span className="text-primary font-bold">{dateHelpers.rAfternoon}% of daily logs</span>
                            </div>
                            <Progress value={dateHelpers.rAfternoon} className="h-2 bg-secondary" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-mono mb-1">
                              <span className="text-muted-foreground font-semibold">Evening (5:00 PM - 10:00 PM)</span>
                              <span className="text-primary font-bold">{dateHelpers.rEvening}% of daily logs</span>
                            </div>
                            <Progress value={dateHelpers.rEvening} className="h-2 bg-secondary" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-mono mb-1">
                              <span className="text-muted-foreground font-semibold">Night (10:00 PM - 5:00 AM)</span>
                              <span className="text-primary font-bold">{dateHelpers.rNight}% of daily logs</span>
                            </div>
                            <Progress value={dateHelpers.rNight} className="h-2 bg-secondary" />
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <Card className="p-6 border border-border/40 bg-secondary/5 text-center text-sm text-muted-foreground font-mono">
                        No completions logged to evaluate rhythm intensity.
                      </Card>
                    )}
                  </div>

                  {/* WEEKLY / MONTHLY CONTEXT */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/5 p-6 rounded-2xl border border-border/30">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Layers className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Weekly Progress Context</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Consistent habit routines completed this week: <strong>{realHistoryStats ? `${realHistoryStats.averageCompletion}%` : '0%'}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Map className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Monthly Goal Milestones</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Productivity index achieved for month target: <strong>{realHistoryStats ? `${realHistoryStats.averageCompletion}%` : '0%'}</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ESTIMATED TARGET WORKSPACE SUMMARY */}
                  <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-muted-foreground text-xs font-mono uppercase tracking-wider">
                    <div>
                      Completed items: <span className="text-primary font-bold">{dateHelpers.completedChains} Routines</span>
                    </div>
                    <div>
                      Items in progress: <span className="text-primary font-bold">{dateHelpers.inProgressCount} Routines</span>
                    </div>
                    <div>
                      Active Categories: <span className="text-primary font-bold">Health, Mind, Work, Leisure</span>
                    </div>
                  </div>

                  {/* DAILY QUOTE */}
                  <div className="bg-secondary/5 p-6 rounded-2xl border border-border/30 text-center relative overflow-hidden">
                    <Quote className="absolute top-2 left-2 w-12 h-12 text-primary/5 -rotate-6" />
                    <Quote className="absolute bottom-2 right-2 w-12 h-12 text-primary/5 rotate-6" />
                    <div className="relative z-10 space-y-2">
                      <p className="font-serif italic text-base md:text-lg text-foreground/90 max-w-xl mx-auto leading-relaxed">
                        "{dateHelpers.selectedQuote}"
                      </p>
                      <div className="text-[10px] uppercase font-mono tracking-widest text-primary/70">
                        Daily Inspiration Index
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <LightweightLoader isLoading={isHistoryLoading} message="Loading History..." />
    </div>
    </div>
  );
}
