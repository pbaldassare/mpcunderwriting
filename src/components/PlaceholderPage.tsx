import { LucideIcon, Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

const PlaceholderPage = ({ title, description, icon: Icon }: PlaceholderPageProps) => {
  return (
    <div className="space-y-6">
      {/* Header allineato allo stile delle pagine reali (teal accent) */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight truncate">{title}</h1>
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        </div>
      </div>

      {/* Card "in costruzione" — coerente con le card del gestionale */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
        <div className="p-10 sm:p-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-5 flex items-center justify-center">
            <Construction className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Sezione in costruzione</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Stiamo lavorando a <span className="font-medium text-foreground">{title}</span>.
            La sezione sarà disponibile a breve con tutte le funzionalità del gestionale.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderPage;
