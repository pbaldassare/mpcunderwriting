import { useNavigate } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const OpportunityToolPage = ({ title, description, icon: Icon }: Props) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/opportunity")} title="Torna a Opportunity">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Modulo in preparazione. Lo strumento sarà collegato da qui.
      </div>
    </div>
  );
};

export default OpportunityToolPage;
