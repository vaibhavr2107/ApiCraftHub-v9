import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Upload, Wand2, Search, FileText, ChevronDown, ChevronRight, FolderClosed, FolderOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { Request } from "@shared/schema";
import { generateRouteId } from "@/lib/utils";
import yaml from 'js-yaml';

export interface Collection {
  id: string;
  name: string;
  description?: string;
  requests: Request[];
}

export interface RequestFolder {
  id: string;
  name: string;
  requests: Request[];
}

interface SidebarProps {
  onRequestSelect: (request: Request) => void;
}

export function Sidebar({ onRequestSelect }: SidebarProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folders, setFolders] = useState<RequestFolder[]>([]);

  useEffect(() => {
    const savedRequests = localStorage.getItem("saved_requests");
    if (savedRequests) {
      try {
        const requests: Request[] = JSON.parse(savedRequests);
        console.log('Loaded saved requests:', requests);
        organizeRequestsIntoFolders(requests);
      } catch (error) {
        console.error('Error loading saved requests:', error);
      }
    }
  }, []);

  const organizeRequestsIntoFolders = (requests: Request[]) => {
    console.log('Organizing requests into folders:', requests);
    const folderMap = new Map<string, Request[]>();
    const newRequests: Request[] = [];

    requests.forEach(request => {
      if (request.collectionId) {
        const collection = folderMap.get(request.collectionId) || [];
        collection.push(request);
        folderMap.set(request.collectionId, collection);
      } else {
        newRequests.push(request);
      }
    });

    const newFolders: RequestFolder[] = [];

    folderMap.forEach((requests, collectionId) => {
      if (requests.length > 0) {
        newFolders.push({
          id: collectionId,
          name: requests[0].collectionName || 'Unnamed Collection',
          requests: requests.sort((a, b) => a.name.localeCompare(b.name))
        });
      }
    });

    if (newRequests.length > 0) {
      newFolders.push({
        id: 'new-requests',
        name: 'New Requests',
        requests: newRequests.sort((a, b) => a.name.localeCompare(b.name))
      });
    }

    console.log('Organized folders:', newFolders);
    setFolders(newFolders);
  };

  const handleRequestSelect = (request: Request) => {
    console.log('Sidebar: Request selected:', request);
    onRequestSelect(request);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    console.log('Processing file:', file.name);

    try {
      const content = await file.text();
      let requests: Request[] = [];

      // Try to parse as JSON first
      try {
        const json = JSON.parse(content);
        console.log('Parsed JSON:', json);

        // Check if it's a Postman collection
        if (json.info && json.item) {
          requests = processPostmanCollection(json);
        }
        // Check if it's an OpenAPI spec
        else if (json.openapi || json.swagger) {
          requests = processOpenAPI(json);
        }
        // Assume it's our own request format
        else if (Array.isArray(json)) {
          requests = json;
        }
      } catch (e) {
        // If JSON parsing fails, try YAML
        try {
          const spec = yaml.load(content);
          if (spec && typeof spec === 'object' && ('openapi' in spec || 'swagger' in spec)) {
            requests = processOpenAPI(spec);
          }
        } catch (yamlError) {
          throw new Error('Invalid file format. Please provide a valid Postman collection, OpenAPI specification, or request JSON file.');
        }
      }

      if (requests.length === 0) {
        throw new Error('No valid requests found in the file.');
      }

      console.log('Processed requests:', requests);

      // Save each request to both localStorage and API
      const savedPromises = requests.map(async (request) => {
        try {
          await saveRequest(request);
          return request;
        } catch (error) {
          console.error(`Error saving request ${request.name}:`, error);
          return null;
        }
      });

      const savedRequests = await Promise.all(savedPromises);
      const successfulSaves = savedRequests.filter((r): r is Request => r !== null);

      // Update localStorage
      const existingRequests = localStorage.getItem("saved_requests");
      const currentRequests = existingRequests ? JSON.parse(existingRequests) : [];

      // Merge requests, avoiding duplicates
      const uniqueRequests = [...currentRequests];
      successfulSaves.forEach(newRequest => {
        const existingIndex = uniqueRequests.findIndex(r => r.routeId === newRequest.routeId);
        if (existingIndex !== -1) {
          uniqueRequests[existingIndex] = newRequest;
        } else {
          uniqueRequests.push(newRequest);
        }
      });

      localStorage.setItem("saved_requests", JSON.stringify(uniqueRequests));

      // Reorganize folders
      organizeRequestsIntoFolders(uniqueRequests);

      toast({
        title: "Success",
        description: `Imported ${successfulSaves.length} requests from ${file.name}`,
      });
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to import ${file.name}`
      });
    }

    event.target.value = '';
  };

  const processPostmanCollection = (json: any) => {
    const collectionId = generateRouteId(json.info?.name || 'imported-collection');
    const collectionName = json.info?.name || 'Imported Collection';

    const processRequest = (item: any): Request | null => {
      if (!item.request) return null;

      const url = typeof item.request.url === 'string'
        ? item.request.url
        : item.request.url?.raw || '';

      const requestName = item.name || 'Unnamed Request';
      const requestId = generateRouteId(`${collectionName}-${requestName}`);

      return {
        requestId,
        routeId: requestId,
        name: requestName,
        method: item.request.method || 'GET',
        baseUrl: url,
        queryParams: {},
        pathVariables: {},
        auth: { type: "bearer-tiaa" },
        headers: item.request.header?.reduce((acc: Record<string, string>, h: any) => {
          if (!h.disabled) acc[h.key] = h.value;
          return acc;
        }, {}) || {},
        historyId: generateRouteId(`history-${collectionName}-${requestName}`),
        historyRequests: [],
        responseFields: {},
        requestBody: item.request.body?.raw ? JSON.parse(item.request.body.raw) : {},
        exampleResponseBody: {},
        tags: [],
        collectionId,
        collectionName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        selectedEnvironment: "qa01"
      };
    };

    const processItems = (items: any[]): Request[] => {
      const requests: Request[] = [];
      items.forEach(item => {
        if (item.request) {
          const request = processRequest(item);
          if (request) requests.push(request);
        } else if (item.item) {
          requests.push(...processItems(item.item));
        }
      });
      return requests;
    };

    return processItems(json.item || []);
  };

  const processOpenAPI = (spec: any) => {
    if (!spec || typeof spec !== 'object') return [];

    const collectionId = generateRouteId(spec.info?.title || 'openapi-collection');
    const collectionName = spec.info?.title || 'OpenAPI Collection';
    const requests: Request[] = [];

    if (spec.paths && typeof spec.paths === 'object') {
      Object.entries(spec.paths).forEach(([path, methods]: [string, any]) => {
        if (methods && typeof methods === 'object') {
          Object.entries(methods).forEach(([method, operation]: [string, any]) => {
            if (operation && typeof operation === 'object') {
              const operationId = operation.operationId || `${method}-${path}`;
              const requestName = operation.summary || operationId;
              const requestId = generateRouteId(`${collectionName}-${requestName}`);

              requests.push({
                requestId,
                routeId: requestId,
                name: requestName,
                method: method.toUpperCase(),
                baseUrl: `${spec.servers?.[0]?.url || ''}${path}`,
                queryParams: {},
                pathVariables: {},
                auth: { type: "bearer-tiaa" },
                headers: {},
                historyId: generateRouteId(`history-${collectionName}-${operationId}`),
                historyRequests: [],
                responseFields: {},
                requestBody: operation.requestBody?.content?.['application/json']?.example || {},
                exampleResponseBody: {},
                tags: operation.tags || [],
                collectionId,
                collectionName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
                selectedEnvironment: "qa01"
              });
            }
          });
        }
      });
    }

    return requests;
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

  const saveRequest = async (request: Request) => {
    try {
      console.log('Saving request:', request);
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Failed to save request: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Save request response:', result);
      return result;
    } catch (error) {
      console.error(`Error saving request ${request.name}:`, error);
      throw error;
    }
  };


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
                      onClick={() => handleRequestSelect(request)}
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