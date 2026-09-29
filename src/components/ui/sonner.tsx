import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      duration={3000}
      closeButton
      expand
      offset={16}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "group toast relative overflow-hidden pr-9 group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-current/90",
          success:
            "!bg-emerald-700 !text-emerald-50 !border-emerald-800 [&_[data-description]]:!text-emerald-50/90",
          error:
            "!bg-red-700 !text-red-50 !border-red-900 [&_[data-description]]:!text-red-50/90",
          warning:
            "!bg-red-700 !text-red-50 !border-red-900 [&_[data-description]]:!text-red-50/90",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "!left-auto !right-2 !top-2 !translate-x-0 !translate-y-0 !border-0 !bg-transparent !text-current hover:!bg-black/10",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
