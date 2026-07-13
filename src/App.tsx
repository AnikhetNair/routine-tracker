import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Layout } from '@/components/layout';
import Workspace from '@/pages/workspace';
import Today from '@/pages/today';
import History from '@/pages/history';
import Analytics from '@/pages/analytics';
import { Toaster } from 'sonner';
import { AnimatePresence, motion, LayoutGroup, type Variants } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { DailyResetManager } from '@/components/daily-reset-manager';

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
      <p className="text-muted-foreground">Page not found</p>
    </div>
  );
}

function AnimatedRoutes() {
  const [location] = useLocation();
  const prevLocationRef = useRef(location);

  useEffect(() => {
    prevLocationRef.current = location;
  }, [location]);

  const getCoords = (path: string) => {
    if (path === '/') return { x: 0, y: 0, z: 0 };
    if (path === '/history') return { x: 1, y: 0, z: -0.2 };
    if (path === '/analytics') return { x: -1, y: 0, z: 0 };
    if (path === '/today') return { x: 0, y: -1, z: 0.2 };
    if (path === '/routines') return { x: 0, y: 0, z: -1 };
    return { x: 0, y: 0, z: 0 };
  };

  const prev = getCoords(prevLocationRef.current);
  const next = getCoords(location);

  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const dz = next.z - prev.z;

  const isInitial = dx === 0 && dy === 0 && dz === 0;
  const rotate = dx !== 0 && dy !== 0 ? (dx * dy * -3) : 0;

  const custom = { dx, dy, dz, isInitial, rotate };

  const variants: Variants = {
    initial: (c: any) => {
      if (c.isInitial) return { opacity: 0, scale: 0.95, filter: "blur(10px)" };
      return {
        x: c.dx * 30 + "vw",
        y: c.dy * 30 + "vh",
        scale: 1 + c.dz * 0.1 - (Math.abs(c.dx) + Math.abs(c.dy)) * 0.05,
        filter: `blur(${Math.min(Math.abs(c.dx) + Math.abs(c.dy) + Math.abs(c.dz), 1) * 15}px)`,
        opacity: 0,
        rotate: c.rotate,
      };
    },
    animate: {
      x: 0,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      opacity: 1,
      rotate: 0,
      transition: { type: "spring" as const, stiffness: 60, damping: 18, mass: 1 }
    },
    exit: (c: any) => {
      return {
        x: c.dx * -30 + "vw",
        y: c.dy * -30 + "vh",
        scale: 1 - c.dz * 0.1 - (Math.abs(c.dx) + Math.abs(c.dy)) * 0.05,
        filter: `blur(${Math.min(Math.abs(c.dx) + Math.abs(c.dy) + Math.abs(c.dz), 1) * 15}px)`,
        opacity: 0,
        rotate: -c.rotate,
        transition: { type: "spring" as const, stiffness: 60, damping: 18, mass: 1 }
      };
    }
  };

  return (
    <AnimatePresence mode="popLayout" custom={custom}>
      <motion.div
        key={location}
        custom={custom}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute inset-0 w-full h-full"
      >
        <Switch location={location}>
          <Route path="/" component={Workspace} />
          <Route path="/today" component={Today} />
          <Route path="/history" component={History} />
          <Route path="/analytics" component={Analytics} />
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Layout>
          <LayoutGroup>
            <div className="relative w-full h-full overflow-hidden">
              <AnimatedRoutes />
            </div>
          </LayoutGroup>
        </Layout>
      </WouterRouter>
      <Toaster theme="dark" position="bottom-right" />
      <DailyResetManager />
    </QueryClientProvider>
  );
}

export default App;
