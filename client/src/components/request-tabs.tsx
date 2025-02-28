import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { generateRouteId } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { saveRequest, loadRequests } from "@/lib/api";
import type { Request, RequestHistory } from "@shared/schema";
import { RequestPanel } from "./request-panel";
import { ResponsePanel } from "./response-panel";

export function RequestTabs({ onRequestComplete }: RequestTabsProps) {
  const [location, setLocation] = useLocation();
  const [requests, setRequests] = useState<Request[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const { toast } = useToast();
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Get route ID
  const routeId = useMemo(() => location.split('/').pop(), [location]);

  const createDefaultRequest = useCallback(() => {
    const routeId = generateRouteId(`new-request`);

    const newRequest: Request = {
      requestId: routeId,
      routeId,
      name: "New Request",
      method: "GET",
      baseUrl: "https://api.restful-api.dev/objects",
      queryParams: {},
      pathVariables: {},
      auth: { type: "bearer-tiaa" },
      headers: {
        'Accept': '*/*',
        'User-Agent': 'API-Tester/1.0',
        'Content-Type': 'application/json'
      },
      historyId: `history-${routeId}`,
      historyRequests: [],
      responseFields: {},
      requestBody: {},
      exampleResponseBody: {},
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      selectedEnvironment: "qa01"
    };

    setRequests([newRequest]);
    setLocation(`/request/${routeId}`);
    return newRequest;
  }, [setLocation]);

  // Initialize with a single new request
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      createDefaultRequest();
    }
  }, [createDefaultRequest]);

  // Find active request
  const activeRequest = useMemo(() => 
    requests.find(r => r.routeId === routeId),
    [requests, routeId]
  );

  const handleNewTab = useCallback(() => {
    createDefaultRequest();
  }, [createDefaultRequest]);

  const handleCloseTab = useCallback((requestId: string) => {
    if (!activeRequest) return;

    setRequests(prev => {
      const updatedRequests = prev.filter(req => req.requestId !== requestId);

      if (requestId === activeRequest.requestId) {
        createDefaultRequest();
      }

      return updatedRequests;
    });
  }, [activeRequest, createDefaultRequest]);

  const handleTabChange = useCallback((value: string) => {
    const request = requests.find(r => r.requestId === value);
    if (request && request.routeId !== routeId) {
      setLocation(`/request/${request.routeId}`);
    }
  }, [requests, routeId, setLocation]);

  const handleUpdateRequest = useCallback((requestId: string, updates: Partial<Request>) => {
    setRequests(prev =>
      prev.map(req =>
        req.requestId === requestId ? { ...req, ...updates } : req
      )
    );
  }, []);

  const handleResponse = useCallback((requestId: string, response: any) => {
    setResponses(prev => ({ ...prev, [requestId]: response }));
    const request = requests.find(req => req.requestId === requestId);
    if (request) {
      updateRequestHistory(request, response);
      if (onRequestComplete) {
        onRequestComplete(request, response);
      }
    }
  }, [requests, onRequestComplete]);

  const updateRequestHistory = async (request: Request, response: any) => {
    if (response.status >= 200 && response.status < 300) {
      const historyEntry: RequestHistory = {
        method: request.method,
        url: request.baseUrl,
        requestBody: request.requestBody || null,
        responseFields: response.data,
        timestamp: new Date().toISOString(),
        responseTime: response.time
      };

      const updatedRequest = {
        ...request,
        historyRequests: [
          historyEntry,
          ...(request.historyRequests || []).slice(0, 4)
        ]
      };

      try {
        await saveRequest(updatedRequest);
        setRequests(prev =>
          prev.map(r => r.requestId === updatedRequest.requestId ? updatedRequest : r)
        );
      } catch (error) {
        console.error('Error saving request history:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save request history"
        });
      }
    }
  };

  // Don't render until we have an active request
  if (!activeRequest) {
    return null;
  }

  return (
    <div className="container py-6 max-w-[1400px]">
      <Tabs value={activeRequest.requestId} onValueChange={handleTabChange} className="w-full">
        <div className="flex items-center gap-2 mb-4">
          <div ref={tabsContainerRef} className="flex-1 overflow-x-auto">
            <TabsList className="flex w-max space-x-1">
              {requests.map((request) => (
                <div
                  key={request.requestId}
                  className={cn(
                    "flex items-center mx-1 rounded-md transition-colors",
                    activeRequest.requestId === request.requestId ? "bg-muted" : "bg-transparent"
                  )}
                >
                  <TabsTrigger
                    value={request.requestId}
                    className={cn(
                      "w-[160px] justify-start text-left truncate",
                      activeRequest.requestId === request.requestId ? "bg-muted" : ""
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
                        activeRequest.requestId === request.requestId ? "bg-muted hover:bg-muted/80" : ""
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(request.requestId);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </TabsList>
          </div>

          <Button variant="outline" size="icon" onClick={handleNewTab}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {requests.map((request) => (
          <TabsContent key={request.requestId} value={request.requestId} className="space-y-6">
            <div className="flex flex-col gap-6">
              <RequestPanel
                request={request}
                onRequestChange={(updates) => handleUpdateRequest(request.requestId, updates)}
                onResponse={(response) => handleResponse(request.requestId, response)}
                onLoading={(isLoading) =>
                  setLoading(prev => ({ ...prev, [request.requestId]: isLoading }))
                }
                onError={(error) =>
                  setErrors(prev => ({ ...prev, [request.requestId]: error }))
                }
              />
              <ResponsePanel
                response={responses[request.requestId]}
                isLoading={loading[request.requestId]}
                error={errors[request.requestId]}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface RequestTabsProps {
  onRequestComplete?: (request: Request, response: any) => void;
}