import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Upload, Wand2, Search, FileText, ChevronDown, ChevronRight, FolderClosed, FolderOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { Request } from "@shared/schema";
import { generateRouteId } from "@/lib/utils";

interface SidebarProps {
  onRequestSelect: (request: Request) => void;
}

interface RequestFolder {
  id: string;
  name: string;
  requests: Request[];
}

export function Sidebar({ onRequestSelect }: SidebarProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folders, setFolders] = useState<RequestFolder[]>([]);

  // Load saved requests and organize them into folders
  useEffect(() => {
    const savedRequests = localStorage.getItem("saved_requests");
    if (savedRequests) {
      const requests: Request[] = JSON.parse(savedRequests);
      organizeRequestsIntoFolders(requests);
    }
  }, []);

  const organizeRequestsIntoFolders = (requests: Request[]) => {
    const folderMap = new Map<string, Request[]>();
    const newRequests: Request[] = [];

    // Group requests by collection ID
    requests.forEach(request => {
      if (request.collectionId) {
        const collection = folderMap.get(request.collectionId) || [];
        collection.push(request);
        folderMap.set(request.collectionId, collection);
      } else {
        newRequests.push(request);
      }
    });

    // Create folders array
    const newFolders: RequestFolder[] = [];

    // Add collection folders
    folderMap.forEach((requests, collectionId) => {
      const firstRequest = requests[0];
      newFolders.push({
        id: collectionId,
        name: firstRequest.collectionName || 'Unnamed Collection',
        requests
      });
    });

    // Add "New Requests" folder if there are any
    if (newRequests.length > 0) {
      newFolders.push({
        id: 'new-requests',
        name: 'New Requests',
        requests: newRequests
      });
    }

    setFolders(newFolders);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const content = await file.text();
      const importedRequests = JSON.parse(content);

      // Process imported requests
      let requests: Request[];
      if (Array.isArray(importedRequests)) {
        requests = importedRequests;
      } else {
        // Handle OpenAPI/Postman collection format
        // Assuming there's a collection ID and name in the imported format
        const collectionId = importedRequests.info?.id || generateRouteId(file.name);
        const collectionName = importedRequests.info?.name || file.name.replace(/\.[^/.]+$/, "");

        requests = importedRequests.requests.map((req: any) => ({
          ...req,
          collectionId,
          collectionName,
          routeId: generateRouteId(`${collectionName}-${req.name}`),
          requestId: generateRouteId(`${collectionName}-${req.name}`)
        }));
      }

      // Update localStorage
      const savedRequests = localStorage.getItem("saved_requests");
      const existingRequests = savedRequests ? JSON.parse(savedRequests) : [];
      const updatedRequests = [...existingRequests, ...requests];
      localStorage.setItem("saved_requests", JSON.stringify(updatedRequests));

      // Reorganize folders
      organizeRequestsIntoFolders(updatedRequests);

      toast({
        title: "Success",
        description: `Imported: ${file.name}`,
      });
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to import ${file.name}. Please check the file format.`,
      });
    }

    event.target.value = '';
  };

  const handleImportWizard = () => {
    toast({
      title: "Coming Soon",
      description: "Import Wizard feature will be implemented soon!",
    });
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const filteredFolders = folders.map(folder => ({
    ...folder,
    requests: folder.requests.filter(request =>
      request.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.baseUrl.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(folder => folder.requests.length > 0);

  return (
    <div className="w-64 flex-shrink-0 border-r bg-background/95 h-screen">
      <div className="p-4 border-b space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="file"
              accept=".json,.yaml,.yml"
              className="hidden"
              onChange={handleFileUpload}
              id="request-import"
            />
            <label htmlFor="request-import" className="flex-1">
              <Button variant="outline" className="w-full" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </span>
              </Button>
            </label>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleImportWizard}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Wizard
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-8rem)]">
        <div className="p-2">
          {filteredFolders.map((folder) => (
            <div key={folder.id} className="mb-2">
              <Button
                variant="ghost"
                className="w-full justify-start mb-1"
                onClick={() => toggleFolder(folder.id)}
              >
                {expandedFolders.has(folder.id) ? (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    <FolderOpen className="h-4 w-4 mr-2" />
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4 mr-2" />
                    <FolderClosed className="h-4 w-4 mr-2" />
                  </>
                )}
                {folder.name}
              </Button>
              {expandedFolders.has(folder.id) && (
                <div className="pl-4">
                  {folder.requests.map((request) => (
                    <Button
                      key={request.requestId}
                      variant="ghost"
                      className="w-full justify-start hover:bg-muted/50 h-auto py-1.5"
                      onClick={() => onRequestSelect(request)}
                    >
                      <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                      <div className="flex flex-col items-start">
                        <span className="truncate text-sm">{request.name}</span>
                        <span className="text-xs font-mono font-medium">
                          {request.method}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}