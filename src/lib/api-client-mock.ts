import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type RoutineType = "boolean" | "numeric" | "duration" | "distance" | "session" | "open";

export interface Routine {
  id: number;
  name: string;
  type: RoutineType;
  categoryId: number | null;
  unit: string | null;
  target: number | null;
  targetDurationSeconds: number | null;
  activeDays: number[];
  positionX: number;
  positionY: number;
  archived: boolean;
}

export interface Connection {
  id: number;
  fromRoutineId: number;
  toRoutineId: number;
}

export interface Category {
  id: number;
  name: string;
  color: string;
}

export interface Reflection {
  wentWell: string | null;
  couldImprove: string | null;
  focusTomorrow: string | null;
  energy?: "low" | "medium" | "high" | null;
  focusRating?: number | null;
  dayRating?: number | null;
  journal?: string | null;
  reflectionPrompt?: string | null;
  reflectionAnswer?: string | null;
}

export interface RoutineProgress {
  routineId: number;
  name: string;
  type: RoutineType;
  completed: boolean;
  value: number;
  target: number | null;
  targetDurationSeconds: number | null;
  elapsedSeconds: number;
  unit: string | null;
  timerRunning: boolean;
  progressPercentage: number;
}

const defaultCategories: Category[] = [
  { id: 1, name: "Health", color: "#60a5fa" },
  { id: 2, name: "Work", color: "#f87171" },
  { id: 3, name: "Mind", color: "#34d399" },
  { id: 4, name: "Leisure", color: "#fbbf24" }
];

const defaultRoutines: Routine[] = [
  {
    id: 1,
    name: "Morning Meditation",
    type: "boolean",
    categoryId: 3,
    unit: null,
    target: null,
    targetDurationSeconds: null,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    positionX: 80,
    positionY: 80,
    archived: false
  },
  {
    id: 2,
    name: "Drink Water",
    type: "numeric",
    categoryId: 1,
    unit: "ml",
    target: 2000,
    targetDurationSeconds: null,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    positionX: 380,
    positionY: 80,
    archived: false
  },
  {
    id: 3,
    name: "Study Coding",
    type: "duration",
    categoryId: 2,
    unit: "minutes",
    target: null,
    targetDurationSeconds: 1800,
    activeDays: [1, 2, 3, 4, 5],
    positionX: 200,
    positionY: 280,
    archived: false
  }
];

const defaultConnections: Connection[] = [
  { id: 1, fromRoutineId: 1, toRoutineId: 3 }
];

export function getLocalDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseISODate(dateStr: string) {
  const parts = dateStr.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// Generate past logs for 30 days to populate historical charts
function generateHistoricalData() {
  const logs: Record<string, Record<number, any>> = {};
  const reflections: Record<string, Reflection> = {};
  
  const REFLECTION_PROMPTS = [
    "What surprised you today?",
    "What slowed you down?",
    "What are you grateful for today?",
    "What deserves another attempt tomorrow?",
    "What was the single most peaceful moment of your day?"
  ];

  const REFLECTION_ANSWERS = [
    "I was surprised by how much progress I made once I muted my phone and worked in 25-minute intervals.",
    "Getting stuck on a small CSS layout alignment bug slowed down my momentum, but figuring it out was satisfying.",
    "I am extremely grateful for a warm cup of coffee and two full hours of uninterrupted deep focus in the morning.",
    "My reading habit deserves another attempt tomorrow; I let busywork take over my evening routine.",
    "Taking a short 10-minute walk outside around sunset without any screens or notifications was incredibly peaceful."
  ];

  const JOURNALS = [
    "Today I finally understood advanced React transitions and built a beautiful responsive sidebar.",
    "Woke up early, got solid code written, drank plenty of water, and slept with a clear mind.",
    "Had a quiet morning, took time to reflect, and felt very peaceful during my afternoon focus sprints.",
    "Completed all primary targets before lunch and spent the evening reading and unwinding.",
    "Managed my focus exceptionally well today despite feeling slightly lower energy in the late afternoon."
  ];

  const WENT_WELLS = [
    "Smashed my coding targets and completed all active habits before 5 PM.",
    "Had amazing mental clarity in the morning and avoided social media distractions.",
    "Drank plenty of water and stayed hydrated throughout my entire work session.",
    "Felt incredibly calm, focused, and persistent during difficult debugging.",
    "Woke up right on time and set a wonderful rhythm for the rest of the day."
  ];

  const COULD_IMPROVES = [
    "Spent slightly too much time on distracting social feeds after lunch.",
    "Let myself get stuck on a single hard problem without taking a short break.",
    "Stayed seated for too long without stretching or walking around.",
    "Drank a bit too much caffeine in the afternoon, which made me a bit jittery.",
    "Skipped my mid-day meditation because of a tight scheduling constraint."
  ];

  const FOCUS_TOMORROWS = [
    "Wake up early, avoid checking emails, and dive straight into coding.",
    "Take short breaks every 30 minutes to stay fresh and alert.",
    "Track my water intake more closely during the morning block.",
    "Keep my phone in another room during high-focus tasks.",
    "End the workday strictly on time and take a longer screen-free break."
  ];
  
  for (let i = 1; i <= 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateStr(d);
    
    logs[dateStr] = {
      1: { value: 0, completed: Math.random() > 0.3, elapsedSeconds: 0, timerRunning: false },
      2: { value: Math.random() > 0.4 ? 2000 : 1000, completed: Math.random() > 0.4, elapsedSeconds: 0, timerRunning: false },
      3: { value: 0, completed: Math.random() > 0.5, elapsedSeconds: Math.random() > 0.5 ? 1800 : 900, timerRunning: false }
    };
    
    const idx = i % 5;
    const energyVals: ("low" | "medium" | "high")[] = ["low", "medium", "high", "medium", "high"];
    
    reflections[dateStr] = {
      wentWell: WENT_WELLS[idx],
      couldImprove: COULD_IMPROVES[idx],
      focusTomorrow: FOCUS_TOMORROWS[idx],
      energy: energyVals[idx],
      focusRating: (idx % 3) + 3, // 3, 4, 5
      dayRating: (idx % 3) + 3, // 3, 4, 5
      journal: JOURNALS[idx],
      reflectionPrompt: REFLECTION_PROMPTS[idx],
      reflectionAnswer: REFLECTION_ANSWERS[idx]
    };
  }
  return { logs, reflections };
}

function getRoutines(): Routine[] {
  const data = localStorage.getItem("routines");
  if (!data) {
    localStorage.setItem("routines", JSON.stringify(defaultRoutines));
    return defaultRoutines;
  }
  return JSON.parse(data);
}

function setRoutines(data: Routine[]) {
  localStorage.setItem("routines", JSON.stringify(data));
}

function getConnections(): Connection[] {
  const data = localStorage.getItem("connections");
  if (!data) {
    localStorage.setItem("connections", JSON.stringify(defaultConnections));
    return defaultConnections;
  }
  return JSON.parse(data);
}

function setConnections(data: Connection[]) {
  localStorage.setItem("connections", JSON.stringify(data));
}

function getCategories(): Category[] {
  const data = localStorage.getItem("categories");
  if (!data) {
    localStorage.setItem("categories", JSON.stringify(defaultCategories));
    return defaultCategories;
  }
  return JSON.parse(data);
}

function getLogs(): Record<string, Record<number, any>> {
  const data = localStorage.getItem("logs_v4");
  if (!data) {
    localStorage.setItem("logs_v4", JSON.stringify({}));
    localStorage.setItem("reflections_v4", JSON.stringify({}));
    return {};
  }
  return JSON.parse(data);
}

function setLogs(data: Record<string, Record<number, any>>) {
  localStorage.setItem("logs_v4", JSON.stringify(data));
}

function getReflections(): Record<string, Reflection> {
  const data = localStorage.getItem("reflections_v4");
  if (!data) {
    localStorage.setItem("reflections_v4", JSON.stringify({}));
    return {};
  }
  return JSON.parse(data);
}

function setReflections(data: Record<string, Reflection>) {
  localStorage.setItem("reflections_v4", JSON.stringify(data));
}

function getReflection(date: string): Reflection {
  const list = getReflections();
  return list[date] || { 
    wentWell: null, 
    couldImprove: null, 
    focusTomorrow: null, 
    energy: null, 
    focusRating: null, 
    dayRating: null, 
    journal: null, 
    reflectionPrompt: null, 
    reflectionAnswer: null 
  };
}

function getRoutinesProgressForDate(date: string) {
  const routines = getRoutines().filter(r => !r.archived);
  const logs = getLogs();
  const d = parseISODate(date);
  const dayOfWeek = d.getDay();
  const activeRoutines = routines.filter(r => r.activeDays.includes(dayOfWeek));
  const dateLogs = logs[date] || {};

  let completedCount = 0;
  activeRoutines.forEach(r => {
    const log = dateLogs[r.id];
    if (log) {
      if (r.type === "boolean" && log.completed) {
        completedCount++;
      } else if (r.type === "duration" && r.targetDurationSeconds && log.elapsedSeconds >= r.targetDurationSeconds) {
        completedCount++;
      } else if (r.target && log.value >= r.target) {
        completedCount++;
      }
    }
  });

  return {
    activeCount: activeRoutines.length,
    completedCount
  };
}

export function getTodaySummary(date: string) {
  const routines = getRoutines().filter(r => !r.archived);
  const logs = getLogs();
  const d = parseISODate(date);
  const dayOfWeek = d.getDay();
  
  const activeRoutines = routines.filter(r => r.activeDays.includes(dayOfWeek));
  const dateLogs = logs[date] || {};

  const routineProgressList = activeRoutines.map(r => {
    const log = dateLogs[r.id] || { value: 0, completed: false, elapsedSeconds: 0, timerRunning: false };
    
    let elapsed = log.elapsedSeconds || 0;
    if (log.timerRunning && log.lastTimerStartedAt) {
      const diff = Math.floor((Date.now() - new Date(log.lastTimerStartedAt).getTime()) / 1000);
      elapsed += Math.max(0, diff);
    }

    let progressPercentage = 0;
    let completed = log.completed;

    if (r.type === "boolean") {
      progressPercentage = completed ? 100 : 0;
    } else if (r.type === "duration") {
      if (r.targetDurationSeconds) {
        progressPercentage = Math.min(100, Math.round((elapsed / r.targetDurationSeconds) * 100));
        completed = elapsed >= r.targetDurationSeconds;
      }
    } else if (r.type === "open") {
      progressPercentage = 0;
      completed = false;
    } else {
      if (r.target) {
        progressPercentage = Math.min(100, Math.round((log.value / r.target) * 100));
        completed = log.value >= r.target;
      }
    }

    return {
      routineId: r.id,
      name: r.name,
      type: r.type,
      completed,
      value: log.value,
      target: r.target,
      targetDurationSeconds: r.targetDurationSeconds,
      elapsedSeconds: elapsed,
      unit: r.unit,
      timerRunning: log.timerRunning,
      progressPercentage
    };
  });

  const activeCount = routineProgressList.length;
  const completedCount = routineProgressList.filter(p => p.completed).length;
  const completionPercentage = activeCount > 0 ? (completedCount / activeCount) * 100 : 0;

  let currentStreak = 0;
  let curr = parseISODate(date);
  for (let i = 0; i < 365; i++) {
    const dStr = getLocalDateStr(curr);
    const progress = getRoutinesProgressForDate(dStr);
    if (progress.activeCount > 0) {
      if (progress.completedCount === progress.activeCount) {
        currentStreak++;
      } else {
        if (i > 0) {
          break;
        }
      }
    }
    curr.setDate(curr.getDate() - 1);
  }

  return {
    completionPercentage,
    currentStreak,
    completedCount,
    activeCount,
    routines: routineProgressList
  };
}

// Hooks

export function useListRoutines(params?: { includeArchived?: boolean }) {
  const includeArchived = params?.includeArchived ?? false;
  return useQuery({
    queryKey: getListRoutinesQueryKey(params),
    queryFn: () => {
      const list = getRoutines();
      if (!includeArchived) {
        return list.filter(r => !r.archived);
      }
      return list;
    }
  });
}

export function useListConnections() {
  return useQuery({
    queryKey: getListConnectionsQueryKey(),
    queryFn: () => getConnections()
  });
}

export function useListCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories()
  });
}

export function useGetTodaySummary(params: { date: string }) {
  return useQuery({
    queryKey: getGetTodaySummaryQueryKey(params),
    queryFn: () => getTodaySummary(params.date)
  });
}

export function useGetDailySnapshot(date: string) {
  return useQuery({
    queryKey: ["daily-snapshot", date],
    queryFn: () => {
      const summary = getTodaySummary(date);
      const reflection = getReflection(date);
      return {
        date,
        completionPercentage: summary.completionPercentage,
        completedCount: summary.completedCount,
        activeCount: summary.activeCount,
        routines: summary.routines,
        reflection,
        currentStreak: summary.currentStreak
      };
    }
  });
}

export function useGetHeatmap(params?: { year?: number }) {
  const year = params?.year ?? new Date().getFullYear();
  return useQuery({
    queryKey: ["heatmap", year],
    queryFn: () => {
      const logs = getLogs();
      const result: { date: string; completionPercentage: number; }[] = [];
      Object.keys(logs).forEach(date => {
        if (date.startsWith(String(year))) {
          const summary = getTodaySummary(date);
          if (summary.activeCount > 0) {
            result.push({
              date,
              completionPercentage: summary.completionPercentage
            });
          }
        }
      });
      return result;
    }
  });
}

export function useGetRecords() {
  return useQuery({
    queryKey: ["records"],
    queryFn: () => {
      const routines = getRoutines().filter(r => !r.archived);
      const logs = getLogs();
      
      return routines.map(r => {
        let completedDays30d = 0;
        let activeDays30d = 0;
        
        for (let i = 0; i < 30; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = getLocalDateStr(d);
          const dayOfWeek = d.getDay();
          
          if (r.activeDays.includes(dayOfWeek)) {
            activeDays30d++;
            const log = logs[dateStr]?.[r.id];
            if (log) {
              if (r.type === "boolean" && log.completed) {
                completedDays30d++;
              } else if (r.type === "duration" && r.targetDurationSeconds && log.elapsedSeconds >= r.targetDurationSeconds) {
                completedDays30d++;
              } else if (r.target && log.value >= r.target) {
                completedDays30d++;
              }
            }
          }
        }
        
        const completionRate30d = activeDays30d > 0 ? Math.round((completedDays30d / activeDays30d) * 100) : 0;
        
        let bestStreak = 0;
        let tempStreak = 0;
        
        for (let i = 365; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = getLocalDateStr(d);
          const dayOfWeek = d.getDay();
          
          if (r.activeDays.includes(dayOfWeek)) {
            const log = logs[dateStr]?.[r.id];
            let comp = false;
            if (log) {
              if (r.type === "boolean" && log.completed) comp = true;
              else if (r.type === "duration" && r.targetDurationSeconds && log.elapsedSeconds >= r.targetDurationSeconds) comp = true;
              else if (r.target && log.value >= r.target) comp = true;
            }
            if (comp) {
              tempStreak++;
              if (tempStreak > bestStreak) bestStreak = tempStreak;
            } else {
              tempStreak = 0;
            }
          }
        }
        
        return {
          routineId: r.id,
          completionRate30d,
          bestStreak
        };
      });
    }
  });
}

export function useGetAnalytics(params: { days: number }) {
  const days = params.days;
  return useQuery({
    queryKey: ["analytics", days],
    queryFn: () => {
      const trend: { date: string; completionPercentage: number; }[] = [];
      let totalPercentage = 0;
      let trendCount = 0;
      
      const weekdaySums = Array(7).fill(0);
      const weekdayCounts = Array(7).fill(0);
      
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateStr(d);
        const summary = getTodaySummary(dateStr);
        
        if (summary.activeCount > 0) {
          trend.push({
            date: dateStr,
            completionPercentage: summary.completionPercentage
          });
          totalPercentage += summary.completionPercentage;
          trendCount++;
          
          const weekday = d.getDay();
          weekdaySums[weekday] += summary.completionPercentage;
          weekdayCounts[weekday]++;
        }
      }
      
      const averageCompletion = trendCount > 0 ? totalPercentage / trendCount : 0;
      
      const completionByWeekday = weekdaySums.map((sum, i) => ({
        weekday: i,
        averageCompletion: weekdayCounts[i] > 0 ? Math.round(sum / weekdayCounts[i]) : 0
      }));
      
      return {
        averageCompletion,
        completionTrend: trend,
        completionByWeekday
      };
    }
  });
}

export function useCreateRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { data: any }) => {
      const list = getRoutines();
      const newId = list.length > 0 ? Math.max(...list.map(r => r.id)) + 1 : 1;
      const newRoutine = {
        id: newId,
        archived: false,
        ...variables.data
      };
      list.push(newRoutine);
      setRoutines(list);
      return newRoutine;
    }
  });
}

export function useUpdateRoutine() {
  return useMutation({
    mutationFn: async (variables: { id: number; data: any }) => {
      const list = getRoutines();
      const index = list.findIndex(r => r.id === variables.id);
      if (index !== -1) {
        list[index] = { ...list[index], ...variables.data };
        setRoutines(list);
        return list[index];
      }
      throw new Error("Routine not found");
    }
  });
}

export function useDeleteRoutine() {
  return useMutation({
    mutationFn: async (variables: { id: number }) => {
      const list = getRoutines();
      const index = list.findIndex(r => r.id === variables.id);
      if (index !== -1) {
        list[index].archived = true;
        setRoutines(list);
        return list[index];
      }
      throw new Error("Routine not found");
    }
  });
}

function hasPath(start: number, end: number, connections: Connection[]): boolean {
  const visited = new Set<number>();
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === end) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    
    const nextNodes = connections
      .filter(c => c.fromRoutineId === current)
      .map(c => c.toRoutineId);
    queue.push(...nextNodes);
  }
  return false;
}

export function useCreateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { data: { fromRoutineId: number; toRoutineId: number } }) => {
      let list = getConnections();
      const { fromRoutineId, toRoutineId } = variables.data;

      // 1. Never connect to itself
      if (fromRoutineId === toRoutineId) {
        throw new Error("A routine cannot connect to itself");
      }

      // Detect direct 2-node loop: A -> B and B -> A
      const directLoopIdx = list.findIndex(c => c.fromRoutineId === toRoutineId && c.toRoutineId === fromRoutineId);
      if (directLoopIdx !== -1) {
        // Remove the existing connection
        list.splice(directLoopIdx, 1);
        setConnections(list);
        // Do NOT add the new connection. Return a response indicating loop cleared.
        return { loopCancelled: true };
      }

      // 2. Resolve Outgoing conflict: At most one outgoing connection from fromRoutineId
      list = list.filter(c => c.fromRoutineId !== fromRoutineId);

      // 3. Resolve Incoming conflict: At most one incoming connection to toRoutineId
      list = list.filter(c => c.toRoutineId !== toRoutineId);

      // 4. Prevent circular loops (longer loops)
      if (hasPath(toRoutineId, fromRoutineId, list)) {
        throw new Error("This connection would form a circular loop");
      }

      const newId = list.length > 0 ? Math.max(...list.map(c => c.id)) + 1 : 1;
      const newConn = {
        id: newId,
        fromRoutineId,
        toRoutineId
      };
      list.push(newConn);
      setConnections(list);
      return newConn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListConnectionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["today-summary"] });
    }
  });
}

export function useIncrementLog() {
  return useMutation({
    mutationFn: async (variables: { id: number; data: { date: string; delta: number } }) => {
      const logs = getLogs();
      const { date, delta } = variables.data;
      if (!logs[date]) logs[date] = {};
      if (!logs[date][variables.id]) {
        logs[date][variables.id] = { value: 0, completed: false, elapsedSeconds: 0, timerRunning: false };
      }
      logs[date][variables.id].value += delta;
      
      const routine = getRoutines().find(r => r.id === variables.id);
      if (routine && routine.target && logs[date][variables.id].value >= routine.target) {
        logs[date][variables.id].completed = true;
        logs[date][variables.id].completedAt = new Date().toISOString();
      }

      setLogs(logs);
      return logs[date][variables.id];
    }
  });
}

export function useUpsertLog() {
  return useMutation({
    mutationFn: async (variables: { data: { routineId: number; date: string; completed: boolean } }) => {
      const logs = getLogs();
      const { routineId, date, completed } = variables.data;
      if (!logs[date]) logs[date] = {};
      if (!logs[date][routineId]) {
        logs[date][routineId] = { value: 0, completed: false, elapsedSeconds: 0, timerRunning: false };
      }
      logs[date][routineId].completed = completed;
      if (completed) {
        logs[date][routineId].completedAt = new Date().toISOString();
        const routine = getRoutines().find(r => r.id === routineId);
        if (routine && routine.target) {
          logs[date][routineId].value = routine.target;
        } else {
          logs[date][routineId].value = 1;
        }
      } else {
        logs[date][routineId].value = 0;
        logs[date][routineId].completedAt = undefined;
      }
      setLogs(logs);
      return logs[date][routineId];
    }
  });
}

export function useStartTimer() {
  return useMutation({
    mutationFn: async (variables: { id: number; date: string }) => {
      const logs = getLogs();
      const { id, date } = variables;
      if (!logs[date]) logs[date] = {};
      if (!logs[date][id]) {
        logs[date][id] = { value: 0, completed: false, elapsedSeconds: 0, timerRunning: false };
      }
      logs[date][id].timerRunning = true;
      logs[date][id].lastTimerStartedAt = new Date().toISOString();
      setLogs(logs);
      return logs[date][id];
    }
  });
}

export function usePauseTimer() {
  return useMutation({
    mutationFn: async (variables: { id: number; date: string }) => {
      const logs = getLogs();
      const { id, date } = variables;
      if (!logs[date]) logs[date] = {};
      const log = logs[date][id] || { value: 0, completed: false, elapsedSeconds: 0, timerRunning: false };
      if (log.timerRunning && log.lastTimerStartedAt) {
        const diff = Math.floor((Date.now() - new Date(log.lastTimerStartedAt).getTime()) / 1000);
        log.elapsedSeconds = (log.elapsedSeconds || 0) + Math.max(0, diff);
      }
      log.timerRunning = false;
      log.lastTimerStartedAt = undefined;
      
      const routine = getRoutines().find(r => r.id === id);
      if (routine && routine.targetDurationSeconds && log.elapsedSeconds >= routine.targetDurationSeconds) {
        log.completed = true;
        log.completedAt = new Date().toISOString();
      }
      
      logs[date][id] = log;
      setLogs(logs);
      return log;
    }
  });
}

export function useGetReflection(date: string, options?: any) {
  return useQuery({
    queryKey: getGetReflectionQueryKey(date),
    queryFn: () => getReflection(date),
    ...options?.query
  });
}

export function useUpsertReflection() {
  return useMutation({
    mutationFn: async (variables: { date: string; data: any }) => {
      const reflections = getReflections();
      reflections[variables.date] = {
        ...(reflections[variables.date] || {}),
        ...variables.data
      };
      setReflections(reflections);
      return reflections[variables.date];
    }
  });
}

// Key Generators

export function getListRoutinesQueryKey(params?: any) {
  return ["routines", params];
}

export function getListConnectionsQueryKey() {
  return ["connections"];
}

export function getGetTodaySummaryQueryKey(params: { date: string }) {
  return ["today-summary", params.date];
}

export function getGetReflectionQueryKey(date: string) {
  return ["reflection", date];
}

// Quick Tasks Section

export interface QuickTask {
  id: number;
  title: string;
  categoryId: number | null;
  notes: string | null;
  completed: boolean;
  createdAt: string;
  createdAtDate: string;
  completedAt: string | null;
  completedAtDate: string | null;
  positionX?: number;
  positionY?: number;
}

function getQuickTasks(): QuickTask[] {
  const data = localStorage.getItem("quick_tasks_v1");
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function setQuickTasks(data: QuickTask[]) {
  localStorage.setItem("quick_tasks_v1", JSON.stringify(data));
}

export function useListQuickTasks(params?: { date?: string }) {
  const date = params?.date || getLocalDateStr(new Date());
  return useQuery({
    queryKey: ["quick-tasks", date],
    queryFn: () => {
      const tasks = getQuickTasks();
      return tasks.filter(t => {
        if (t.completed) {
          // Completed tasks only appear on the date they were completed
          return t.completedAtDate === date;
        } else {
          // Incomplete tasks:
          // If the task has been archived or marked expired, only show it on its original creation date (history)
          if (t.archived || t.expired) {
            return t.createdAtDate === date;
          }
          // Active incomplete tasks roll over on any date on or after creation date
          return t.createdAtDate <= date;
        }
      });
    }
  });
}

export function useCreateQuickTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { data: { title: string; categoryId?: number | null; notes?: string | null; positionX?: number; positionY?: number } }) => {
      const list = getQuickTasks();
      const newId = list.length > 0 ? Math.max(...list.map(t => t.id)) + 1 : 1;
      const todayStr = getLocalDateStr(new Date());
      const newTask: QuickTask = {
        id: newId,
        title: variables.data.title,
        categoryId: variables.data.categoryId ?? null,
        notes: variables.data.notes ?? null,
        completed: false,
        createdAt: new Date().toISOString(),
        createdAtDate: todayStr,
        completedAt: null,
        completedAtDate: null,
        positionX: variables.data.positionX,
        positionY: variables.data.positionY
      };
      list.push(newTask);
      setQuickTasks(list);
      return newTask;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quick-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["today-summary"] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["quick-tasks-analytics"] });
    }
  });
}

export function useUpdateQuickTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { id: number; data: Partial<QuickTask> }) => {
      const list = getQuickTasks();
      const index = list.findIndex(t => t.id === variables.id);
      if (index !== -1) {
        list[index] = { ...list[index], ...variables.data };
        setQuickTasks(list);
        return list[index];
      }
      throw new Error("Quick task not found");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["today-summary"] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot"] });
    }
  });
}

export function useToggleQuickTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { id: number; completed: boolean; completedAtDate?: string }) => {
      const list = getQuickTasks();
      const index = list.findIndex(t => t.id === variables.id);
      if (index !== -1) {
        const todayDate = variables.completedAtDate || getLocalDateStr(new Date());
        list[index].completed = variables.completed;
        list[index].completedAt = variables.completed ? new Date().toISOString() : null;
        list[index].completedAtDate = variables.completed ? todayDate : null;
        setQuickTasks(list);
        return list[index];
      }
      throw new Error("Quick task not found");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["today-summary"] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["quick-tasks-analytics"] });
    }
  });
}

export function useDeleteQuickTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { id: number }) => {
      let list = getQuickTasks();
      list = list.filter(t => t.id !== variables.id);
      setQuickTasks(list);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["today-summary"] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["quick-tasks-analytics"] });
    }
  });
}

