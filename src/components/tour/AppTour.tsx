import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { useTour } from "./AppTourContext";

const AUTO_ADVANCE_MIN = 3800;
const MS_PER_CHAR = 38;

const AppTour = () => {
  const { isActive, currentStep, steps, totalSteps, nextStep, prevStep, stopTour } = useTour();
  const navigate = useNavigate();
  const location = useLocation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const retryRef = useRef(0);
  const rafRef = useRef<number>(0);
  const autoTimerRef = useRef<number>(0);
  const countdownRafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);

  const step = steps[currentStep];

  const stepDuration = step
    ? step.duration || Math.max(AUTO_ADVANCE_MIN, step.description.length * MS_PER_CHAR)
    : AUTO_ADVANCE_MIN;

  const startCountdown = useCallback((remaining: number, total: number) => {
    const elapsed = total - remaining;
    startTimeRef.current = performance.now() - elapsed;
    durationRef.current = total;
    const tick = () => {
      const now = performance.now();
      const progress = Math.min(1, (now - startTimeRef.current) / durationRef.current);
      setCountdown(progress);
      if (progress < 1) countdownRafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(countdownRafRef.current);
    countdownRafRef.current = requestAnimationFrame(tick);
  }, []);

  const startAutoAdvance = useCallback(() => {
    clearTimeout(autoTimerRef.current);
    elapsedBeforePauseRef.current = 0;
    setCountdown(0);
    startCountdown(stepDuration, stepDuration);
    autoTimerRef.current = window.setTimeout(() => nextStep(), stepDuration);
  }, [stepDuration, nextStep, startCountdown]);

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      if (prev) {
        const remaining = durationRef.current - elapsedBeforePauseRef.current;
        startCountdown(remaining, durationRef.current);
        autoTimerRef.current = window.setTimeout(() => nextStep(), remaining);
      } else {
        clearTimeout(autoTimerRef.current);
        cancelAnimationFrame(countdownRafRef.current);
        elapsedBeforePauseRef.current = performance.now() - startTimeRef.current;
      }
      return !prev;
    });
  }, [nextStep, startCountdown]);

  const findAndHighlight = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.selector}"]`);
    if (!el) {
      if (retryRef.current < 14) {
        retryRef.current++;
        rafRef.current = window.setTimeout(findAndHighlight, 150);
        return;
      }
      console.warn(
        `[AppTour] data-tour="${step.selector}" non trovato su ${location.pathname} (step ${currentStep + 1}/${totalSteps}). Salto.`
      );
      setShowTooltip(false);
      nextStep();
      return;
    }
    retryRef.current = 0;
    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    setCursorPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setShowTooltip(false);
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      setTargetRect(r);
      setCursorPos({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      setShowTooltip(true);
    }, 450);
  }, [step, nextStep]);

  const executeStepAction = useCallback(() => {
    if (!step) return;
    const action = step.action;
    if (!action) {
      if (step.page && location.pathname !== step.page) {
        navigate(step.page);
        rafRef.current = window.setTimeout(findAndHighlight, 500);
      } else {
        rafRef.current = window.setTimeout(findAndHighlight, 100);
      }
      return;
    }
    switch (action.type) {
      case "navigate":
        if (action.target && location.pathname !== action.target) navigate(action.target);
        rafRef.current = window.setTimeout(findAndHighlight, action.delay || 500);
        break;
      case "scroll": {
        if (action.target) {
          const el = document.querySelector(`[data-tour="${action.target}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        rafRef.current = window.setTimeout(findAndHighlight, action.delay || 400);
        break;
      }
      case "wait":
        rafRef.current = window.setTimeout(findAndHighlight, action.delay || 300);
        break;
      default:
        rafRef.current = window.setTimeout(findAndHighlight, 100);
    }
  }, [step, location.pathname, navigate, findAndHighlight]);

  useEffect(() => {
    if (showTooltip && isActive && !paused) startAutoAdvance();
    return () => {
      clearTimeout(autoTimerRef.current);
      cancelAnimationFrame(countdownRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTooltip, isActive, currentStep]);

  useEffect(() => {
    if (!isActive || !step) return;
    setShowTooltip(false);
    setPaused(false);
    retryRef.current = 0;
    executeStepAction();
    return () => { if (rafRef.current) clearTimeout(rafRef.current); };
  }, [isActive, currentStep, step, executeStepAction]);

  useEffect(() => {
    if (!isActive) return;
    const handler = () => findAndHighlight();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [isActive, findAndHighlight]);

  if (!isActive || !step) return null;

  // Se l'elemento bersaglio è enorme (intera pagina/contenitore principale) lo
  // trattiamo come step "page-level": niente spotlight ritagliato, tooltip
  // centrato, niente cursore che svolazza.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isPageLevel = !!targetRect && (
    (targetRect.width * targetRect.height) > (vw * vh * 0.55) ||
    targetRect.width > vw * 0.85 ||
    targetRect.height > vh * 0.8
  );

  const tooltipStyle: React.CSSProperties = {};
  let tooltipPosition: "top" | "bottom" = "bottom";
  const tooltipWidth = 340;

  if (isPageLevel) {
    tooltipPosition = "bottom";
    tooltipStyle.top = Math.max(24, vh / 2 - 90);
    tooltipStyle.left = Math.max(16, vw / 2 - tooltipWidth / 2);
    tooltipStyle.width = tooltipWidth;
  } else if (targetRect) {
    const spaceBelow = vh - targetRect.bottom;
    const spaceAbove = targetRect.top;
    if (spaceBelow > 220 || spaceBelow > spaceAbove) {
      tooltipPosition = "bottom";
      tooltipStyle.top = targetRect.bottom + 16;
    } else {
      tooltipPosition = "top";
      tooltipStyle.bottom = vh - targetRect.top + 16;
    }
    const centerX = targetRect.left + targetRect.width / 2;
    tooltipStyle.left = Math.max(16, Math.min(centerX - tooltipWidth / 2, vw - tooltipWidth - 16));
    tooltipStyle.width = tooltipWidth;
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="cbnet-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && !isPageLevel && (
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={isPageLevel ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.65)"} mask="url(#cbnet-tour-mask)" style={{ pointerEvents: "auto" }} />
      </svg>

      {targetRect && !isPageLevel && (
        <div
          className="absolute rounded-2xl border-2 border-primary transition-all duration-500 ease-out"
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            pointerEvents: "none",
            boxShadow: "0 0 24px 4px hsl(var(--primary) / 0.35)",
          }}
        />
      )}

      {!isPageLevel && (
        <div
          className="absolute z-[10001] transition-all duration-500 ease-out"
          style={{ left: cursorPos.x - 12, top: cursorPos.y - 4, pointerEvents: "none", opacity: showTooltip ? 0 : 1 }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="hsl(var(--primary))" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {showTooltip && targetRect && (
        <div
          className="absolute z-[10002] animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ ...tooltipStyle, pointerEvents: "auto" }}
          onClick={togglePause}
        >
          <div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-card ${tooltipPosition === "bottom" ? "-top-1.5" : "-bottom-1.5"}`} />
          <div className="relative rounded-2xl bg-card shadow-xl border border-border overflow-hidden">
            <div className="px-4 pt-3 pb-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  {currentStep + 1} / {totalSteps}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePause(); }}
                  className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                  title={paused ? "Riprendi" : "Pausa"}
                >
                  {paused ? <Play className="h-3 w-3 text-primary" /> : <Pause className="h-3 w-3 text-muted-foreground" />}
                </button>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); stopTour(); }}
                className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="px-4 pt-1.5 pb-3">
              <h4 className="text-[15px] font-bold text-foreground leading-snug">{step.title}</h4>
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
            </div>
            <div className="h-1 bg-muted relative overflow-hidden">
              <div className="absolute inset-0 bg-primary/20" style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }} />
              <div
                className="absolute inset-y-0 left-0 bg-primary rounded-r-full"
                style={{ width: `${(1 - countdown) * 100}%`, transition: paused ? "none" : undefined }}
              />
            </div>
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); prevStep(); }}
                disabled={currentStep === 0}
                className="inline-flex items-center gap-1 text-[12px] text-muted-foreground font-medium hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded-md hover:bg-muted"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Indietro
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); stopTour(); }}
                className="text-[11px] text-muted-foreground font-medium hover:text-foreground transition-colors"
              >
                Salta
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextStep(); }}
                className="inline-flex items-center gap-1 text-[12px] text-primary-foreground font-semibold bg-primary hover:bg-primary/90 transition-colors px-3 py-1 rounded-md"
              >
                {currentStep + 1 === totalSteps ? "Fine" : "Avanti"} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppTour;
