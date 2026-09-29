import { Route } from "react-router-dom";
import { Search, Landmark } from "lucide-react";
import OpportunityPage from "@/pages/opportunity/OpportunityPage";
import OpportunityToolPage from "@/pages/opportunity/OpportunityToolPage";
import IdGuardPage from "@/pages/opportunity/IdGuardPage";

export const opportunityRoutes = (
  <>
    <Route path="/opportunity" element={<OpportunityPage />} />
    <Route
      path="/opportunity/rui-search"
      element={
        <OpportunityToolPage
          title="RUI Search"
          description="Ricerca iscrizioni e intermediari nel Registro Unico degli Intermediari"
          icon={Search}
        />
      }
    />
    <Route path="/opportunity/iid-guard" element={<IdGuardPage />} />
    <Route
      path="/opportunity/rna-aiuti-bandi"
      element={
        <OpportunityToolPage
          title="RNA Aiuti di stato e bandi"
          description="Registro Nazionale Aiuti, agevolazioni e bandi pubblici"
          icon={Landmark}
        />
      }
    />
  </>
);
