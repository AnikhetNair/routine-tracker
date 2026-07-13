import { FloatingNav } from "@/components/floating-nav";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="noise-overlay" />
      <main className="w-full h-screen relative overflow-hidden">
        {children}
      </main>
      <FloatingNav />
    </div>
  );
}
