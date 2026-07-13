import { useGetAnalytics, useGetRecords, useListRoutines } from "@workspace/api-client-react";
import { Card, Progress } from "@/components/ui";
import { LightweightLoader } from "@/components/lightweight-loader";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Trophy, TrendingUp, Calendar, Zap, Lock, Sparkles, Award } from "lucide-react";
import { motion } from "framer-motion";

export default function Analytics() {
  const { data: analytics, isLoading: isAnalyticsLoading } = useGetAnalytics({ days: 30 });
  const { data: records } = useGetRecords();
  const { data: routines } = useListRoutines({ includeArchived: false });

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (isAnalyticsLoading) {
    return (
      <div className="w-full h-full relative">
        <LightweightLoader isLoading={true} message="Analyzing focus profile..." />
      </div>
    );
  }

  // Pure data-only check for empty states:
  // If no trend entries exist at all, meaning no routines have ever been logged in the 30-day window.
  const isProfileEmpty = !analytics || analytics.completionTrend.length === 0;

  if (isProfileEmpty) {
    return (
      <div className="w-full h-full overflow-y-auto flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6 py-16">
          <div className="inline-flex p-4 rounded-3xl bg-primary/10 text-primary relative animate-pulse">
            <Lock className="w-12 h-12" />
            <Sparkles className="w-4 h-4 text-primary absolute top-2 right-2" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">Performance Analytics Locked</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We require at least one day of logged activity in the workspace to construct your focus profile, trend velocity, and weekday consistency patterns.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-secondary/25 border border-border/40 text-left space-y-3">
            <div className="text-xs uppercase font-mono font-bold text-primary flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Steps to unlock
            </div>
            <ul className="text-xs text-muted-foreground space-y-2 font-medium">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>Navigate to the <strong>Workspace</strong> canvas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>Complete any active routine or run a focus timer</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>Return here to see your performance metrics materialize</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const hasWeekdayData = analytics.completionByWeekday.some(w => w.averageCompletion > 0);
  const hasTrendData = analytics.completionTrend.length >= 3;

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto space-y-8 pb-20">
        <header>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Analytics</h1>
          <p className="text-muted-foreground text-lg">Your progress over time.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="p-5 flex flex-col items-start gap-2 lg:col-span-1 border-primary/20 bg-primary/5">
            <TrendingUp className="w-6 h-6 text-primary" />
            <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mt-2">Avg Completion</div>
            <div className="text-3xl font-bold font-mono">{Math.round(analytics.averageCompletion)}%</div>
          </Card>
          
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {routines && routines.length > 0 ? (
              routines.slice(0, 3).map(routine => {
                const record = records?.find(r => r.routineId === routine.id);
                const rate = record?.completionRate30d ?? 0;
                return (
                  <motion.div
                    layoutId={`routine-card-${routine.id}`}
                    key={routine.id}
                    className="p-5 flex flex-col items-start gap-3 border border-border bg-card/40 rounded-xl relative overflow-hidden shadow-sm"
                  >
                    <motion.div layoutId={`routine-title-${routine.id}`} className="font-semibold text-base line-clamp-1 relative z-10">
                      {routine.name}
                    </motion.div>

                    <div className="w-full h-4 bg-background/50 rounded-md overflow-hidden relative z-10">
                      <motion.div
                        layoutId={`routine-progress-${routine.id}`}
                        className="absolute left-0 top-0 bottom-0 bg-primary/40 border-r-2 border-primary origin-left"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <div className="text-xs font-bold relative z-10 flex items-center gap-2 mt-auto text-muted-foreground font-mono">
                      <Trophy className="w-3.5 h-3.5 text-primary" /> {rate}% (30d) · Streak {record?.bestStreak ?? 0}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <Card className="col-span-3 p-5 flex items-center justify-center text-center text-muted-foreground font-mono text-xs border border-dashed border-border/40 bg-secondary/5">
                No active routines scheduled in your workspace.
              </Card>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 flex flex-col space-y-4">
            <h2 className="text-xl font-semibold">30-Day Trend</h2>
            <div className="flex-1 min-h-[250px] flex items-center justify-center">
              {hasTrendData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.completionTrend}>
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={str => new Date(str).getDate().toString()} 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="completionPercentage" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center p-6 bg-secondary/5 rounded-2xl border border-dashed border-border/40 w-full h-full flex flex-col items-center justify-center space-y-2">
                  <TrendingUp className="w-8 h-8 text-muted-foreground/40" />
                  <h3 className="font-semibold text-sm">Trend Velocity Accumulating</h3>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                    We require at least 3 active logging days to graph your focus trend. (Currently {analytics.completionTrend.length}/3 days logged).
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6 flex flex-col space-y-4">
            <h2 className="text-xl font-semibold">By Weekday</h2>
            <div className="flex-1 min-h-[250px] flex items-center justify-center">
              {hasWeekdayData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.completionByWeekday}>
                    <XAxis 
                      dataKey="weekday" 
                      tickFormatter={val => daysOfWeek[val]}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                    />
                    <Bar 
                      dataKey="averageCompletion" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center p-6 bg-secondary/5 rounded-2xl border border-dashed border-border/40 w-full h-full flex flex-col items-center justify-center space-y-2">
                  <Calendar className="w-8 h-8 text-muted-foreground/40" />
                  <h3 className="font-semibold text-sm">Weekday Focus Rhythm Pending</h3>
                  <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                    Log routines on different weekdays to generate your consistency patterns.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
