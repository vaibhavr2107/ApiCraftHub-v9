import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Upload, Wand2, Search, FileText, ChevronDown, ChevronRight, FolderClosed, FolderOpen, History } from "lucide-react";
import { useState, useEffect } from "react";
import { Collection, Request } from "@shared/schema";
import { generateRouteId } from "@/lib/utils";
import yaml from 'js-yaml';
import { useQuery } from "@tanstack/react-query";
import { loadRequests, saveRequest } from "@/lib/api";
import { useLocation } from "wouter";
import { saveHistoryRequest } from '@/lib/history';

interface SidebarProps {
  onRequestSelect: (request: Request) => void;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    queryParams: Record<string, string>;
  };
  response: {
    status: number;
    statusText: string;
    data: any;
    headers: Record<string, string>;
  };
}

export function Sidebar({ onRequestSelect }: SidebarProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [, setLocation] = useLocation();
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem("request_history");
    return saved ? JSON.parse(saved) : [];
  });
  // Removed isRegexSearch state


  const { data: rawRequests = [], isLoading, error } = useQuery({
    queryKey: ['/api/requests'],
    queryFn: async () => {
      console.log('Fetching requests from API...');
      const data = await loadRequests();
      console.log('Received requests from API:', data);
      return data;
    },
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("request_history");
      if (saved) {
        setHistoryEntries(JSON.parse(saved));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Deep search function for objects
  const searchInObject = (obj: any, searchTerm: string): boolean => {
    if (!obj) return false;

    const search = (value: any): boolean => {
      // Convert to string and do case-insensitive search
      if (value === null || value === undefined) return false;

      if (typeof value === 'string') {
        return value.toLowerCase().includes(searchTerm);
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value).toLowerCase().includes(searchTerm);
      }

      if (Array.isArray(value)) {
        // For arrays, check each element
        return value.some(item => search(item));
      }

      if (typeof value === 'object') {
        // For objects, check both keys and values
        return Object.entries(value).some(([key, val]) => {
          return key.toLowerCase().includes(searchTerm) || search(val);
        });
      }

      // Convert anything else to string
      return String(value).toLowerCase().includes(searchTerm);
    };

    return search(obj);
  };

  const filteredHistory = historyEntries.filter(entry => {
    if (!historySearch) return true;

    const searchTerm = historySearch.toLowerCase();

    // Check method, URL and status code
    if (
      entry.request.method.toLowerCase().includes(searchTerm) ||
      entry.request.url.toLowerCase().includes(searchTerm) ||
      entry.response.status.toString().includes(searchTerm)
    ) {
      return true;
    }

    // Deep search in all aspects of the request and response
    if (searchInObject(entry.request.body, searchTerm)) return true;
    if (searchInObject(entry.response.data, searchTerm)) return true;
    if (searchInObject(entry.request.headers, searchTerm)) return true;
    if (searchInObject(entry.response.headers, searchTerm)) return true;
    if (searchInObject(entry.request.queryParams, searchTerm)) return true;

    // Convert the entire entry to a string and search within it as a fallback
    // This ensures we catch any nested fields in complex JSON objects
    const entryStr = JSON.stringify(entry).toLowerCase();
    return entryStr.includes(searchTerm);
  });

  const collections = groupRequestsByCollection(rawRequests);
  console.log('Grouped collections:', collections);

  const handleRequestSelect = (request: Request) => {
    console.log('Sidebar: Request selected:', request);
    onRequestSelect(request);
    setLocation(`/request/${request.routeId}`);
  };

  const handleHistoryItemClick = async (entry: HistoryEntry) => {
    const timestamp = new Date(entry.timestamp).getTime();
    const routeId = generateRouteId(`history-${entry.request.method.toLowerCase()}-${timestamp}`);

    const historyRequest: Request = {
      requestId: routeId,
      routeId,
      name: `${entry.request.method} ${new URL(entry.request.url).pathname} (${new Date(entry.timestamp).toLocaleString()})`,
      method: entry.request.method,
      baseUrl: entry.request.url,
      headers: entry.request.headers || {},
      queryParams: entry.request.queryParams || {},
      pathVariables: {},
      auth: { type: "none" },
      requestBody: entry.request.body || {},
      responseFields: entry.response.data || {},
      historyId: routeId,
      historyRequests: [{
        method: entry.request.method,
        url: entry.request.url,
        timestamp: entry.timestamp,
        responseTime: 0,
        requestBody: entry.request.body || {},
        responseFields: entry.response.data || {}
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedEnvironment: "qa01",
      devUrl: "",
      qa01Url: "",
      qa02Url: "",
      qa03Url: "",
      perfUrl: "",
      exampleResponseBody: entry.response.data || {},
      tags: [],
      version: 1,
      collectionId: "history",
      collectionName: "History Requests"
    };

    try {
      await saveHistoryRequest(historyRequest);
      const savedRequests = localStorage.getItem("active_requests");
      const requests = savedRequests ? JSON.parse(savedRequests) : [];
      const existingIndex = requests.findIndex((r: Request) => r.routeId === routeId);
      if (existingIndex !== -1) {
        requests[existingIndex] = historyRequest;
      } else {
        requests.push(historyRequest);
      }

      localStorage.setItem("active_requests", JSON.stringify(requests));
      window.dispatchEvent(new Event("storage"));
      onRequestSelect(historyRequest);
    } catch (error) {
      console.error('Error creating history request:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create history request",
      });
    }
  };

  function groupRequestsByCollection(requests: Request[]): Collection[] {
    const collectionMap = new Map<string, Collection>();

    requests.forEach(request => {
      const collectionId = request.collectionId || 'uncategorized';
      const collectionName = request.collectionName || 'Uncategorized Requests';

      if (!collectionMap.has(collectionId)) {
        collectionMap.set(collectionId, {
          id: collectionId,
          name: collectionName,
          requests: []
        });
      }

      collectionMap.get(collectionId)!.requests.push(request);
    });

    return Array.from(collectionMap.values());
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    console.log('Processing file:', file.name);

    try {
      const content = await file.text();
      let requests: Request[] = [];

      try {
        const json = JSON.parse(content);
        console.log('Parsed JSON:', json);

        if (json.info && json.item) {
          requests = processPostmanCollection(json);
        } else if (json.openapi || json.swagger) {
          requests = processOpenAPI(json);
        } else if (Array.isArray(json)) {
          requests = json;
        }
      } catch (e) {
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

  const processPostmanCollection = (json: any): Request[] => {
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

  const processOpenAPI = (spec: any): Request[] => {
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
    console.log('Toggling folder:', folderId);
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Filter requests based on search
  const filteredCollections = collections.map(collection => ({
    ...collection,
    requests: collection.requests.filter(request => searchInObject(request, searchQuery))
  })).filter(collection => collection.requests.length > 0);

  if (isLoading) {
    return (
      <div className="w-64 flex-shrink-0 border-r bg-background/95 h-screen p-4">
        Loading requests...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-64 flex-shrink-0 border-r bg-background/95 h-screen p-4">
        Error loading requests. Please try again.
      </div>
    );
  }

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
              placeholder="Search requests (searches all content)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="mr-2 h-4 w-4" />
            {showHistory ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
            History
          </Button>

          {showHistory && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search history (searches all content)..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {filteredHistory.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => handleHistoryItemClick(entry)}
                      className="flex flex-col p-2 text-sm cursor-pointer hover:bg-muted/50 rounded-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {entry.request.method}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {entry.request.url}
                      </span>
                      <span className={`text-xs ${entry.response.status < 400 ? 'text-green-500' : 'text-red-500'}`}>
                        {entry.response.status} {entry.response.statusText}
                      </span>
                      {historySearch && (searchInObject(entry.request.body, historySearch) || searchInObject(entry.response.data, historySearch)) && (
                        <span className="text-xs text-muted-foreground mt-1">
                          Match found in request/response data
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-8rem)]">
        <div className="p-2">
          {filteredCollections.map((collection) => (
            <div key={collection.id} className="mb-2">
              <Button
                variant="ghost"
                className="w-full justify-start mb-1"
                onClick={() => toggleFolder(collection.id)}
              >
                {expandedFolders.has(collection.id) ? (
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
                {collection.name}
              </Button>
              {expandedFolders.has(collection.id) && (
                <div className="pl-4">
                  {collection.requests.map((request) => (
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