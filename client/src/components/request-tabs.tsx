import { Plus, X, Save } from "lucide-react";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { generateRouteId } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { saveRequest } from "@/lib/api";
import type { Request, RequestHistory } from "@shared/schema";
import { RequestPanel } from "./request-panel";
import { ResponsePanel } from "./response-panel";

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName: string;
}

function SaveDialog({ isOpen, onClose, onSave, defaultName }: SaveDialogProps) {
  const [name, setName] = useState(defaultName);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Request</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="name">Request Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(name)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RequestTabs({ onRequestComplete }: RequestTabsProps) {
  const [location, setLocation] = useLocation();
  const [activeRequests, setActiveRequests] = useState<Request[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [requestToSave, setRequestToSave] = useState<Request | null>(null);
  const { toast } = useToast();
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const requestCounter = useRef(0);

  // Get route ID
  const routeId = useMemo(() => location.split('/').pop(), [location]);

  const createDefaultRequest = useCallback(() => {
    const timestamp = Date.now();
    const counter = requestCounter.current++;
    const newId = generateRouteId(`new-request-${timestamp}-${counter}`);

    const newRequest: Request = {
      requestId: newId,
      routeId: newId,
      name: "New Request",
      method: "GET",
      baseUrl: "https://api.restful-api.dev/objects",
      queryParams: {},
      pathVariables: {},
      auth: { type: "none" },
      headers: {
        'Accept': '*/*',
        'User-Agent': 'API-Tester/1.0',
        'Content-Type': 'application/json'
      },
      historyId: `history-${newId}`,
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

    setActiveRequests(prev => [...prev, newRequest]);
    setLocation(`/request/${newId}`);
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

  const handleSaveRequest = useCallback((request: Request) => {
    setRequestToSave(request);
    setSaveDialogOpen(true);
  }, []);

  const handleSaveConfirm = useCallback(async (name: string) => {
    if (!requestToSave) return;

    const updatedRequest = {
      ...requestToSave,
      name,
      updatedAt: new Date().toISOString()
    };

    try {
      // Save to backend first
      await saveRequest(updatedRequest);

      // Update active requests
      setActiveRequests(prev =>
        prev.map(req =>
          req.requestId === updatedRequest.requestId ? updatedRequest : req
        )
      );

      toast({
        title: "Success",
        description: "Request saved successfully",
      });
    } catch (error) {
      console.error('Error saving request:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save request"
      });
    }

    setSaveDialogOpen(false);
    setRequestToSave(null);
  }, [requestToSave, toast]);

  const handleResponse = useCallback((requestId: string, response: any) => {
    setResponses(prev => ({ ...prev, [requestId]: response }));
    const request = activeRequests.find(req => req.requestId === requestId);
    if (request) {
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

      // Update active requests
      setActiveRequests(prev =>
        prev.map(r => r.requestId === updatedRequest.requestId ? updatedRequest : r)
      );

      // Update localStorage if the request was saved
      const savedRequests = localStorage.getItem("saved_requests");
      if (savedRequests) {
        const allRequests = JSON.parse(savedRequests);
        const requestIndex = allRequests.findIndex((r: Request) => r.routeId === updatedRequest.routeId);
        if (requestIndex !== -1) {
          allRequests[requestIndex] = updatedRequest;
          localStorage.setItem("saved_requests", JSON.stringify(allRequests));
        }
      }
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      activeRequest?.requestId === request.requestId ? "bg-muted hover:bg-muted/80" : ""
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveRequest(request);
                    }}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
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

      <SaveDialog
        isOpen={saveDialogOpen}
        onClose={() => {
          setSaveDialogOpen(false);
          setRequestToSave(null);
        }}
        onSave={handleSaveConfirm}
        defaultName={requestToSave?.name || ""}
      />
    </div>
  );
}

interface RequestTabsProps {
  onRequestComplete?: (request: Request, response: any) => void;
}