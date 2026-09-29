import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { hasSeenClienteTour, useTour } from "./AppTourContext";

const TourLauncher = () => {
  const { startTour, isActive } = useTour();

  // Auto-start at first visit
  useEffect(() => {
    if (!hasSeenClienteTour()) {
      const t = setTimeout(() => startTour(), 1200);
      return () => clearTimeout(t);
    }
  }, [startTour]);

  if (isActive) return null;

  return (
    <button
      onClick={() => startTour()}
      title="Avvia tour guidato"
      aria-label="Avvia tour guidato"
      className="fixed bottom-4 right-4 z-40 group flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all px-4 h-12 hover:pl-3 hover:pr-5"
      style={{ boxShadow: "0 8px 24px hsl(var(--primary) / 0.35)" }}
    >
      <Sparkles className="h-5 w-5 animate-pulse" />
      <span className="text-sm font-semibold hidden sm:inline">Tour guidato</span>
    </button>
  );
};

export default TourLauncher;
