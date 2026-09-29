import { useState } from "react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useClienteSearch } from "@/hooks/useClienteSearch";
import { CLIENTE_SEARCH_MIN_CHARS, type ClienteSearchRow } from "@/lib/clienteSearch";

type Props = {
  value: string;
  onValueChange: (id: string) => void;
  onSelectCliente?: (row: ClienteSearchRow | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
  clearLabel?: string;
  className?: string;
  disabled?: boolean;
  onlyAttivi?: boolean;
  enabled?: boolean;
};

export function ClienteSearchSelect({
  value,
  onValueChange,
  onSelectCliente,
  placeholder = "Cerca cliente…",
  searchPlaceholder = "Nome, più nomi, indirizzo, CF…",
  emptyText,
  clearable = false,
  clearLabel = "— Tutti —",
  className,
  disabled = false,
  onlyAttivi = true,
  enabled = true,
}: Props) {
  const [search, setSearch] = useState("");
  const { options, rows, isFetching } = useClienteSearch(search, {
    selectedId: value,
    onlyAttivi,
    enabled,
  });

  const resolvedEmpty =
    emptyText ??
    (isFetching
      ? "Ricerca in corso…"
      : search.trim().length < CLIENTE_SEARCH_MIN_CHARS
        ? "Digita almeno 2 caratteri oppure scorri l’elenco"
        : "Nessun cliente trovato.");

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={(id) => {
        onValueChange(id);
        if (onSelectCliente) {
          onSelectCliente(id ? rows.find((r) => r.id === id) ?? null : null);
        }
      }}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      searchValue={search}
      onSearchChange={setSearch}
      serverSideSearch
      emptyText={resolvedEmpty}
      clearable={clearable}
      clearLabel={clearLabel}
      className={className}
      disabled={disabled}
    />
  );
}

export default ClienteSearchSelect;
