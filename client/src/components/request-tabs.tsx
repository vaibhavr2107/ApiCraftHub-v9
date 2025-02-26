import { Plus, Save, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { nanoid } from "nanoid";
import { useLocation } from "wouter";
import { generateRequestId, generateRouteId } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ApiRequest } from "@/types/api-request";
import { RequestPanel } from "./request-panel";
import { ResponsePanel } from "./response-panel";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Keep track of version numbers for new requests
let newRequestVersion = 1;

// Moved outside component to prevent recreation
const substituteVariables = (str: string, collection: any): string => {
  if (!collection || !str) return str;

  const variablePattern = /\{\{([^}]+)\}\}/g;
  return str.replace(variablePattern, (match, variableName) => {
    const trimmedName = variableName.trim();
    const variable = collection.variables?.find((v: any) => v.key === trimmedName);
    return variable ? variable.value : match;
  });
};

export function RequestTabs({ onRequestComplete }: RequestTabsProps) {
  const [location, setLocation] = useLocation();
  const [requests, setRequests] = useState<ApiRequest[]>(() => {
    try {
      const saved = localStorage.getItem("saved_requests");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error loading saved requests:", e);
      return [];
    }
  });

  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const { toast } = useToast();
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Get route ID once
  const routeId = useMemo(() => location.split('/').pop(), [location]);

  // Memoize active request lookup
  const activeRequest = useMemo(() => {
    // First try to find in current requests
    let active = requests.find(r => r.routeId === routeId);
    if (active) return active;

    // Try OpenAPI specs
    if (routeId) {
      try {
        const savedSpecs = localStorage.getItem("openapi_specs");
        if (savedSpecs) {
          const specs = JSON.parse(savedSpecs);
          for (const spec of specs) {
            for (const [path, methods] of Object.entries(spec.paths)) {
              for (const [method, operation] of Object.entries(methods as any)) {
                const cleanPath = path.replace(/[{}]/g, '').replace(/\//g, '-');
                const expectedRouteId = generateRouteId(`${method.toLowerCase()}-${cleanPath}`, spec.fileName);

                if (expectedRouteId === routeId) {
                  active = {
                    id: nanoid(),
                    routeId,
                    name: operation.summary || `${method.toUpperCase()} ${path}`,
                    method: method.toUpperCase() as ApiRequest["method"],
                    url: `${spec.servers?.[0]?.url || 'https://api.example.com'}${path}`,
                    collectionName: spec.fileName,
                    queryParams: operation.parameters
                      ?.filter((p: any) => p.in === "query")
                      .map((p: any) => ({
                        key: p.name,
                        value: "",
                        enabled: true,
                      })) || [],
                    headers: DEFAULT_HEADERS,
                    pathVariables: [],
                    auth: { type: "none" },
                    body: {
                      type: "none",
                      rawFormat: "json",
                      content: "",
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    selectedEnvironment: "dev"
                  };
                  setRequests(prev => [...prev, active!]);
                  return active;
                }
              }
            }
          }
        }
      } catch (e) {
        console.error("Error processing OpenAPI specs:", e);
      }
    }

    // Try collections
    try {
      const savedCollections = localStorage.getItem("collections");
      if (savedCollections) {
        const collections = JSON.parse(savedCollections);
        for (const collection of collections) {
          // Check root requests
          let request = collection.requests?.find((r: ApiRequest) => r.routeId === routeId);
          if (request) {
            request = {
              ...request,
              id: nanoid(),
              url: substituteVariables(request.url, collection)
            };
            setRequests(prev => {
              if (!prev.some(r => r.routeId === request.routeId)) {
                return [...prev, request];
              }
              return prev;
            });
            return request;
          }

          // Search in folders
          if (collection.folders) {
            const findRequestInFolder = (folder: any): ApiRequest | null => {
              const found = folder.requests?.find((r: ApiRequest) => r.routeId === routeId);
              if (found) {
                return {
                  ...found,
                  id: nanoid(),
                  url: substituteVariables(found.url, collection)
                };
              }

              if (folder.folders) {
                for (const subfolder of folder.folders) {
                  const result = findRequestInFolder(subfolder);
                  if (result) return result;
                }
              }
              return null;
            };

            for (const folder of collection.folders) {
              const found = findRequestInFolder(folder);
              if (found) {
                setRequests(prev => {
                  if (!prev.some(r => r.routeId === found.routeId)) {
                    return [...prev, found];
                  }
                  return prev;
                });
                return found;
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Error processing collections:", e);
    }

    // Fallback to first request
    return requests[0];
  }, [routeId, requests]);

  const activeTab = activeRequest?.id;

  // Persist requests to localStorage
  useEffect(() => {
    localStorage.setItem("saved_requests", JSON.stringify(requests));
  }, [requests]);

  // Memoized handlers
  const handleNewTab = useCallback(() => {
    const id = nanoid();
    const routeId = generateRouteId(`new-request-v${newRequestVersion}`);
    newRequestVersion++; // Increment version for next new request

    const newRequest: ApiRequest = {
      id,
      routeId,
      name: "New Request",
      method: "GET",
      url: "https://api.restful-api.dev/objects",
      queryParams: [{ key: "", value: "", enabled: true }],
      headers: DEFAULT_HEADERS,
      pathVariables: [],
      auth: { type: "none" },
      body: {
        type: "none",
        rawFormat: "json",
        content: "",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedEnvironment: "dev"
    };

    setRequests(prev => [...prev, newRequest]);
    setLocation(`/request/${routeId}`);
  }, [setLocation]);

  const handleCloseTab = useCallback((requestId: string) => {
    setRequests(prev => {
      const updatedRequests = prev.filter(req => req.id !== requestId);

      // If we're closing the active tab, navigate to another tab
      if (requestId === activeTab) {
        const nextTab = updatedRequests[0];
        if (nextTab) {
          setLocation(`/request/${nextTab.routeId}`);
        } else {
          setLocation('/');
          handleNewTab();
        }
      }

      return updatedRequests;
    });
  }, [activeTab, setLocation, handleNewTab]);

  const handleTabChange = useCallback((value: string) => {
    const request = requests.find(r => r.id === value);
    if (request && request.routeId !== routeId) {
      setLocation(`/request/${request.routeId}`);
    }
  }, [requests, routeId, setLocation]);

  const handleUpdateRequest = useCallback((requestId: string, updates: Partial<ApiRequest>) => {
    setRequests(prev =>
      prev.map(req =>
        req.id === requestId ? { ...req, ...updates } : req
      )
    );
  }, []);

  const handleResponse = useCallback((requestId: string, response: any) => {
    setResponses(prev => ({ ...prev, [requestId]: response }));
    if (onRequestComplete) {
      const request = requests.find(req => req.id === requestId);
      if (request) {
        onRequestComplete(request, response);
      }
    }
  }, [requests, onRequestComplete]);

  // Create initial tab if needed
  useEffect(() => {
    if (requests.length === 0) {
      handleNewTab();
    }
  }, [requests.length, handleNewTab]);

  if (!activeRequest) {
    return null;
  }

  return (
    <div className="container py-6 max-w-[1400px]">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => {
              if (tabsContainerRef.current) {
                tabsContainerRef.current.scrollLeft -= 200;
              }
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div
            ref={tabsContainerRef}
            className="flex-1 overflow-x-auto relative"
          >
            <TabsList className="flex w-max space-x-1">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className={cn(
                    "flex items-center mx-1 rounded-md transition-colors",
                    activeTab === request.id ? "bg-muted" : "bg-transparent"
                  )}
                >
                  <TabsTrigger
                    value={request.id}
                    className={cn(
                      "w-[160px] justify-start text-left truncate",
                      activeTab === request.id ? "bg-muted" : ""
                    )}
                  >
                    {request.name}
                  </TabsTrigger>
                  {requests.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        activeTab === request.id ? "bg-muted hover:bg-muted/80" : ""
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(request.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </TabsList>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => {
              if (tabsContainerRef.current) {
                tabsContainerRef.current.scrollLeft += 200;
              }
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="icon" onClick={handleNewTab}>
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRequests([])}
            className="ml-2"
          >
            Close All
          </Button>
        </div>

        {requests.map((request) => (
          <TabsContent key={request.id} value={request.id} className="space-y-6">
            <div className="flex flex-col gap-6">
              <RequestPanel
                request={request}
                onRequestChange={(updates) => handleUpdateRequest(request.id, updates)}
                onResponse={(response) => handleResponse(request.id, response)}
                onLoading={(isLoading) =>
                  setLoading(prev => ({ ...prev, [request.id]: isLoading }))
                }
                onError={(error) =>
                  setErrors(prev => ({ ...prev, [request.id]: error }))
                }
              />
              <ResponsePanel
                response={responses[request.id]}
                isLoading={loading[request.id]}
                error={errors[request.id]}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface RequestTabsProps {
  onRequestComplete?: (request: ApiRequest, response: any) => void;
}

const DEFAULT_HEADERS = [
  { key: "Accept", value: "*/*", enabled: true },
  { key: "User-Agent", value: "API-Tester/1.0", enabled: true },
  { key: "Content-Type", value: "application/json", enabled: true }
];