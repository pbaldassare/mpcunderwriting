import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageContainerVariant = "narrow" | "form" | "detail" | "full";

const variantClasses: Record<PageContainerVariant, string> = {
  /** Profilo, wizard corti */
  narrow: "max-w-4xl w-full space-y-6",
  /** Immissione, appendici, form operativi — allineati a sinistra */
  form: "max-w-6xl xl:max-w-7xl w-full space-y-8",
  /** Dettaglio titolo/polizza — centrato, leggermente più largo su desktop */
  detail: "max-w-6xl xl:max-w-7xl w-full space-y-6 mx-auto",
  /** Cruscotti e liste full-width */
  full: "max-w-none w-full space-y-6",
};

export interface PageContainerProps {
  variant?: PageContainerVariant;
  className?: string;
  children: ReactNode;
}

export function PageContainer({ variant = "form", className, children }: PageContainerProps) {
  return <div className={cn(variantClasses[variant], className)}>{children}</div>;
}

export default PageContainer;
