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
import { saveRequest } from "@/lib/api";
import type { Request, RequestHistory } from "@shared/schema";
import { RequestPanel } from "./request-panel";
import { ResponsePanel } from "./response-panel";

export function RequestTabs({ onRequestComplete }: RequestTabsProps) {
  const [location, setLocation] = useLocation();
  const [activeRequests, setActiveRequests] = useState<Request[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const { toast } = useToast();
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Get route ID
  const routeId = useMemo(() => location.split('/').pop(), [location]);

  const createDefaultRequest = useCallback(() => {
    const routeId = generateRouteId('new-request');

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

    setActiveRequests([newRequest]);
    setLocation(`/request/${routeId}`);
    return newRequest;
  }, [setLocation]);

  // Initialize with a new request on first load
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      createDefaultRequest();
    }
  }, [createDefaultRequest]);

  const handleRequestSelect = useCallback((request: Request) => {
    setActiveRequests(prev => {
      // Check if request is already in active requests
      if (prev.some(r => r.routeId === request.routeId)) {
        return prev;
      }
      return [...prev, request];
    });
    setLocation(`/request/${request.routeId}`);
  }, [setLocation]);

  const handleCloseTab = useCallback((requestId: string) => {
    setActiveRequests(prev => {
      const updatedRequests = prev.filter(req => req.requestId !== requestId);
      if (updatedRequests.length === 0) {
        createDefaultRequest();
      } else if (requestId === routeId) {
        // If closing active tab, switch to last tab
        setLocation(`/request/${updatedRequests[updatedRequests.length - 1].routeId}`);
      }
      return updatedRequests;
    });
  }, [routeId, createDefaultRequest, setLocation]);

  const handleTabChange = useCallback((value: string) => {
    const request = activeRequests.find(r => r.requestId === value);
    if (request && request.routeId !== routeId) {
      setLocation(`/request/${request.routeId}`);
    }
  }, [activeRequests, routeId, setLocation]);

  const handleUpdateRequest = useCallback((requestId: string, updates: Partial<Request>) => {
    setActiveRequests(prev =>
      prev.map(req =>
        req.requestId === requestId ? { ...req, ...updates } : req
      )
    );
  }, []);

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

        setActiveRequests(prev =>
          prev.map(r => r.requestId === updatedRequest.requestId ? updatedRequest : r)
        );

        // Update localStorage for sidebar
        const savedRequests = localStorage.getItem("saved_requests");
        const allRequests = savedRequests ? JSON.parse(savedRequests) : [];
        const updatedRequests = allRequests.map((r: Request) => 
          r.routeId === updatedRequest.routeId ? updatedRequest : r
        );
        if (!allRequests.some((r: Request) => r.routeId === updatedRequest.routeId)) {
          updatedRequests.push(updatedRequest);
        }
        localStorage.setItem("saved_requests", JSON.stringify(updatedRequests));

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

  const handleResponse = useCallback((requestId: string, response: any) => {
    setResponses(prev => ({ ...prev, [requestId]: response }));
    const request = activeRequests.find(req => req.requestId === requestId);
    if (request) {
      updateRequestHistory(request, response);
    }
  }, [activeRequests]);

  // Find active request
  const activeRequest = useMemo(() => 
    activeRequests.find(r => r.routeId === routeId),
    [activeRequests, routeId]
  );

  if (!activeRequest && !initialized.current) {
    return null;
  }

  return (
    <div className="container py-6 max-w-[1400px]">
      <Tabs value={activeRequest?.requestId} onValueChange={handleTabChange} className="w-full">
        <div className="flex items-center gap-2 mb-4">
          <div ref={tabsContainerRef} className="flex-1 overflow-x-auto">
            <TabsList className="flex w-max space-x-1">
              {activeRequests.map((request) => (
                <div
                  key={request.requestId}
                  className={cn(
                    "flex items-center mx-1 rounded-md transition-colors",
                    activeRequest?.requestId === request.requestId ? "bg-muted" : "bg-transparent"
                  )}
                >
                  <TabsTrigger
                    value={request.requestId}
                    className={cn(
                      "w-[160px] justify-start text-left truncate",
                      activeRequest?.requestId === request.requestId ? "bg-muted" : ""
                    )}
                  >
                    {request.name}
                  </TabsTrigger>
                  {activeRequests.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        activeRequest?.requestId === request.requestId ? "bg-muted hover:bg-muted/80" : ""
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

          <Button variant="outline" size="icon" onClick={createDefaultRequest}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {activeRequests.map((request) => (
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