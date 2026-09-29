import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConsultazione } from "@/contexts/ConsultazioneContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, FolderPlus, Upload, Home } from "lucide-react";
import FolderCard from "@/components/documentale/FolderCard";
import DocumentCard from "@/components/documentale/DocumentCard";
import CreateFolderDialog from "@/components/documentale/CreateFolderDialog";
import UploadDocumentDialog from "@/components/documentale/UploadDocumentDialog";
import LibreriaCgaSection from "@/components/documentale/LibreriaCgaSection";
import AssistenteGaranzieSection from "@/components/documentale/AssistenteGaranzieSection";
import CbBotLogo from "@/components/shared/CbBotLogo";
import {
  CB_BOT_LABEL,
  documentalePageSubtitle,
  documentaleRouteLabel,
  documentaleTabToQuery,
  isCbBotChromeTab,
  parseDocumentaleTab,
  type DocumentaleTab,
} from "@/lib/documentaleTab";

interface Folder {
  id: string;
  name: string;
  icon: string;
  folder_type: string;
  description: string | null;
  parent_folder_id: string | null;
  compagnia_id: string | null;
  order_index: number;
  doc_count?: number;
}

interface Doc {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
  tags: string[];
  uploaded_at: string;
}

type DocumentalePageProps = {
  /** Area consultazione: sola lettura, senza azioni admin, log ricerche. */
  consultazioneMode?: boolean;
};

export default function DocumentalePage({ consultazioneMode = false }: DocumentalePageProps) {
  const { isAdmin, profile, user } = useAuth();
  const { logRicerca } = useConsultazione();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseDocumentaleTab(searchParams.get("tab"), consultazioneMode);
  const setTab = (v: string) => {
    const next = v as DocumentaleTab;
    const sp = new URLSearchParams(searchParams);
    const q = documentaleTabToQuery(next, consultazioneMode);
    if (q) sp.set("tab", q);
    else sp.delete("tab");
    setSearchParams(sp, { replace: true });
  };
  const canManage =
    !consultazioneMode &&
    (isAdmin ||
      ["ufficio", "backoffice", "contabilita", "cfo"].includes(profile?.ruolo || ""));
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string | null; name: string }[]>([{ id: null, name: "Home" }]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const searchLogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!consultazioneMode) return;
    const q = search.trim();
    if (q.length < 2) return;
    if (searchLogTimer.current) clearTimeout(searchLogTimer.current);
    searchLogTimer.current = setTimeout(() => {
      const percorso = breadcrumb.map((b) => b.name).join(" / ");
      logRicerca(q, percorso);
    }, 800);
    return () => {
      if (searchLogTimer.current) clearTimeout(searchLogTimer.current);
    };
  }, [search, consultazioneMode, logRicerca, breadcrumb]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch subfolders
      let foldersQuery = supabase
        .from("document_folders")
        .select("id, name, icon, folder_type, description, parent_folder_id, compagnia_id, order_index")
        .eq("active", true)
        .order("order_index");

      if (currentFolderId) {
        foldersQuery = foldersQuery.eq("parent_folder_id", currentFolderId);
      } else {
        foldersQuery = foldersQuery.is("parent_folder_id", null);
      }

      const { data: foldersData } = await foldersQuery;

      // Fetch doc counts for each folder
      const foldersWithCounts: Folder[] = [];
      if (foldersData) {
        for (const f of foldersData) {
          const { count } = await supabase
            .from("document_library")
            .select("id", { count: "exact", head: true })
            .eq("folder_id", f.id)
            .eq("active", true);
          foldersWithCounts.push({ ...f, doc_count: count ?? 0 });
        }
      }
      setFolders(foldersWithCounts);

      // Fetch documents in current folder
      if (currentFolderId) {
        const { data: docsData } = await supabase
          .from("document_library")
          .select("id, file_name, file_url, file_type, file_size, description, tags, uploaded_at")
          .eq("folder_id", currentFolderId)
          .eq("active", true)
          .order("uploaded_at", { ascending: false });
        setDocs(docsData || []);
      } else {
        setDocs([]);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [currentFolderId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const navigateToFolder = async (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumb((prev) => [...prev, { id: folderId, name: folderName }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const item = breadcrumb[index];
    setCurrentFolderId(item.id);
    setBreadcrumb(breadcrumb.slice(0, index + 1));
  };

  const handleCreateFolder = async (data: { name: string; folder_type: string; icon: string; description: string }) => {
    setActionLoading(true);
    const { error } = await supabase.from("document_folders").insert({
      name: data.name,
      folder_type: data.folder_type,
      icon: data.icon,
      description: data.description || null,
      parent_folder_id: currentFolderId,
    });
    setActionLoading(false);
    if (error) { toast.error("Errore nella creazione della cartella"); return; }
    toast.success("Cartella creata");
    setShowCreateFolder(false);
    fetchData();
  };

  const handleUpload = async (files: File[], description: string, tags: string[]) => {
    if (!currentFolderId) { toast.error("Seleziona prima una cartella"); return; }
    if (files.length === 0) return;
    setActionLoading(true);
    let ok = 0;
    let fail = 0;
    for (const file of files) {
      const path = `${currentFolderId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("document-library").upload(path, file);
      if (uploadError) {
        toast.error(`${file.name}: ${uploadError.message}`);
        fail += 1;
        continue;
      }

      const { data: urlData } = supabase.storage.from("document-library").getPublicUrl(path);

      const { error: dbError } = await supabase.from("document_library").insert({
        folder_id: currentFolderId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        description: description || null,
        tags,
        uploaded_by: user?.id,
      });
      if (dbError) {
        toast.error(`${file.name}: errore salvataggio`);
        fail += 1;
        continue;
      }
      ok += 1;
    }
    setActionLoading(false);
    if (ok > 0 && fail === 0) {
      toast.success(ok === 1 ? "Documento caricato" : `${ok} documenti caricati`);
      setShowUpload(false);
      fetchData();
    } else if (ok > 0) {
      toast.warning(`${ok} caricati, ${fail} con errore`);
      fetchData();
    }
  };

  const handleDownload = async (doc: Doc) => {
    // Extract storage path from file_url or use direct download
    const pathMatch = doc.file_url.match(/document-library\/(.+)$/);
    if (pathMatch) {
      const { data } = await supabase.storage.from("document-library").createSignedUrl(pathMatch[1], 60);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } else {
      window.open(doc.file_url, "_blank");
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    const { error } = await supabase.from("document_library").update({ active: false }).eq("id", docId);
    if (error) { toast.error("Errore eliminazione"); return; }
    toast.success("Documento rimosso");
    fetchData();
  };

  const handleDeleteFolder = async (folderId: string) => {
    const { error } = await supabase.from("document_folders").update({ active: false }).eq("id", folderId);
    if (error) { toast.error("Errore eliminazione"); return; }
    toast.success("Cartella rimossa");
    fetchData();
  };

  const filteredFolders = search
    ? folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : folders;

  const filteredDocs = search
    ? docs.filter((d) => d.file_name.toLowerCase().includes(search.toLowerCase()) || d.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase())))
    : docs;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {isCbBotChromeTab(tab) || consultazioneMode ? (
            <>
              <div className="flex items-center gap-3">
                <CbBotLogo className="h-10 w-auto" />
                <h1 className="text-2xl font-bold">{CB_BOT_LABEL}</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {consultazioneMode && isCbBotChromeTab(tab)
                  ? "Assistente Web, Libreria CGA e documenti: carica, analizza e confronta senza entrare nel gestionale."
                  : documentalePageSubtitle(tab)}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{documentaleRouteLabel(tab)}</h1>
              <p className="text-sm text-muted-foreground">
                {documentalePageSubtitle(tab)}
              </p>
            </>
          )}
        </div>
        {canManage && tab === "archivio" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreateFolder(true)}>
              <FolderPlus className="mr-2 h-4 w-4" /> Nuova Cartella
            </Button>
            {currentFolderId && (
              <Button size="sm" onClick={() => setShowUpload(true)}>
                <Upload className="mr-2 h-4 w-4" /> Carica Documento
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          {consultazioneMode ? (
            <>
              <TabsTrigger value="assistente-garanzie">{CB_BOT_LABEL}</TabsTrigger>
              <TabsTrigger value="libreria-cga">Libreria CGA</TabsTrigger>
              <TabsTrigger value="archivio">Archivio</TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="archivio">Archivio</TabsTrigger>
              <TabsTrigger value="libreria-cga">Libreria CGA</TabsTrigger>
              <TabsTrigger value="assistente-garanzie">{CB_BOT_LABEL}</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="assistente-garanzie" className="mt-4">
          <AssistenteGaranzieSection consultazioneMode={consultazioneMode} />
        </TabsContent>

        <TabsContent value="libreria-cga" className="mt-4">
          <LibreriaCgaSection />
        </TabsContent>

        <TabsContent value="archivio" className="space-y-6 mt-4">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumb.map((item, i) => (
                <BreadcrumbItem key={i}>
                  {i > 0 && <BreadcrumbSeparator />}
                  {i < breadcrumb.length - 1 ? (
                    <BreadcrumbLink className="cursor-pointer" onClick={() => navigateToBreadcrumb(i)}>
                      {i === 0 ? <Home className="h-4 w-4" /> : item.name}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{i === 0 ? "Home" : item.name}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca cartelle o documenti..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Content */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* Folders */}
              {filteredFolders.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground mb-3">Cartelle</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {filteredFolders.map((folder) => (
                      <FolderCard
                        key={folder.id}
                        id={folder.id}
                        name={folder.name}
                        icon={folder.icon}
                        folderType={folder.folder_type}
                        documentCount={folder.doc_count ?? 0}
                        onClick={() => navigateToFolder(folder.id, folder.name)}
                        isAdmin={canManage}
                        onEdit={() => {}}
                        onDelete={() => handleDeleteFolder(folder.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              {filteredDocs.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground mb-3">Documenti</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredDocs.map((doc) => (
                      <DocumentCard
                        key={doc.id}
                        id={doc.id}
                        fileName={doc.file_name}
                        fileType={doc.file_type}
                        fileSize={doc.file_size}
                        description={doc.description}
                        tags={doc.tags || []}
                        uploadedAt={doc.uploaded_at}
                        isAdmin={canManage}
                        onDownload={() => handleDownload(doc)}
                        onDelete={() => handleDeleteDoc(doc.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {filteredFolders.length === 0 && filteredDocs.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">
                    {search ? "Nessun risultato trovato" : currentFolderId ? "Cartella vuota" : "Nessuna cartella disponibile"}
                  </p>
                  {canManage && currentFolderId && !search && (
                    <Button variant="outline" className="mt-4" onClick={() => setShowUpload(true)}>
                      <Upload className="mr-2 h-4 w-4" /> Carica il primo documento
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateFolderDialog open={showCreateFolder} onOpenChange={setShowCreateFolder} onSubmit={handleCreateFolder} loading={actionLoading} />
      <UploadDocumentDialog open={showUpload} onOpenChange={setShowUpload} onUpload={handleUpload} loading={actionLoading} />
    </div>
  );
}
