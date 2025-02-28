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

// Local storage key for active requests
const ACTIVE_REQUESTS_KEY = 'active_requests';

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

  // Get route ID
  const routeId = useMemo(() => {
    const id = location.split('/').pop();
    console.log('RequestTabs: Current routeId from location:', id);
    return id;
  }, [location]);

  // Load active requests from localStorage
  useEffect(() => {
    if (!initialized.current) {
      const savedRequests = localStorage.getItem(ACTIVE_REQUESTS_KEY);
      if (savedRequests) {
        try {
          const requests = JSON.parse(savedRequests);
          setActiveRequests(requests);
          initialized.current = true;
        } catch (error) {
          console.error('Error loading active requests from localStorage:', error);
        }
      }
    }
  }, []);

  // Save active requests to localStorage
  useEffect(() => {
    if (initialized.current && activeRequests.length > 0) {
      localStorage.setItem(ACTIVE_REQUESTS_KEY, JSON.stringify(activeRequests));
    }
  }, [activeRequests]);

  const createDefaultRequest = useCallback(() => {
    const newId = generateRouteId('new-request');

    console.log('RequestTabs: Creating new default request with ID:', newId);

    const newRequest: Request = {
      requestId: newId,
      routeId: newId,
      name: "New Request",
      method: "GET",
      baseUrl: "https://api.restful-api.dev/objects",
      // Initialize environment URLs
      devUrl: "",
      qa01Url: "",
      qa02Url: "",
      qa03Url: "",
      perfUrl: "",
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

    console.log('RequestTabs: Adding new request to active requests:', newRequest);
    setActiveRequests([newRequest]);
    setLocation(`/request/${newRequest.routeId}`);
    return newRequest;
  }, [setLocation]);

  // Initialize with a single default request if no active requests
  useEffect(() => {
    if (!initialized.current && activeRequests.length === 0) {
      console.log('RequestTabs: Initializing with default request');
      initialized.current = true;
      createDefaultRequest();
    }
  }, [createDefaultRequest, activeRequests.length]);

  // Handle route changes and request loading
  useEffect(() => {
    if (!routeId || !initialized.current) {
      return;
    }

    console.log('RequestTabs: Processing route change for routeId:', routeId);

    // Check if request is already in active requests
    const existingRequest = activeRequests.find(r => r.routeId === routeId);
    if (existingRequest) {
      console.log('RequestTabs: Request already in active tabs:', existingRequest);
      return;
    }

    // Handle incoming request from sidebar
    if (!routeId.startsWith('new-request')) {
      // Attempt to find the request in localStorage first
      const savedRequests = localStorage.getItem(ACTIVE_REQUESTS_KEY);
      let savedRequest: Request | undefined;

      if (savedRequests) {
        try {
          const requests = JSON.parse(savedRequests);
          savedRequest = requests.find((r: Request) => r.routeId === routeId);
        } catch (error) {
          console.error('Error parsing saved requests:', error);
        }
      }

      // If we have a saved request with full data, use that
      if (savedRequest) {
        setActiveRequests(prev => [...prev, savedRequest!]);
      } else {
        // If no saved request, create a new request with the routeId
        // The sidebar component will update this with full data
        const sidebarRequest: Request = {
          requestId: routeId,
          routeId: routeId,
          name: routeId, // Use routeId as name until updated
          method: "GET",
          baseUrl: "",
          // Initialize environment URLs
          devUrl: "",
          qa01Url: "",
          qa02Url: "",
          qa03Url: "",
          perfUrl: "",
          queryParams: {},
          pathVariables: {},
          auth: { type: "none" },
          headers: {},
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

        // Add to active requests and trigger fetch of full data
        setActiveRequests(prev => [...prev, sidebarRequest]);

        // Fetch the full request data
        fetch(`/api/requests/${routeId}`)
          .then(response => response.json())
          .then(fullRequest => {
            setActiveRequests(prev =>
              prev.map(req =>
                req.routeId === routeId ? { ...fullRequest, routeId } : req
              )
            );
          })
          .catch(error => {
            console.error('Error fetching request data:', error);
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to load request data"
            });
          });
      }
    }
  }, [routeId, activeRequests, toast, initialized.current]);

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
      await saveRequest(updatedRequest);
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

  const handleNewRequest = useCallback(() => {
    const newRequest = createDefaultRequest();
    setLocation(`/request/${newRequest.routeId}`);
  }, [createDefaultRequest, setLocation]);

  if (!initialized.current && activeRequests.length === 0) {
    return null;
  }

  return (
    <div className="container py-6 max-w-[1400px]">
      <Tabs value={routeId} onValueChange={handleTabChange} className="w-full">
        <div className="flex items-center gap-2 mb-4">
          <div ref={tabsContainerRef} className="flex-1 overflow-x-auto">
            <TabsList className="flex w-max space-x-1">
              {activeRequests.map((request) => (
                <div
                  key={request.requestId}
                  className={cn(
                    "flex items-center mx-1 rounded-md transition-colors",
                    routeId === request.requestId ? "bg-muted" : "bg-transparent"
                  )}
                >
                  <TabsTrigger
                    value={request.requestId}
                    className={cn(
                      "w-[160px] justify-start text-left truncate",
                      routeId === request.requestId ? "bg-muted" : ""
                    )}
                  >
                    {request.name}
                  </TabsTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      routeId === request.requestId ? "bg-muted hover:bg-muted/80" : ""
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
                        routeId === request.requestId ? "bg-muted hover:bg-muted/80" : ""
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

          <Button variant="outline" size="icon" onClick={handleNewRequest}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {activeRequests.map((request) => (
          <TabsContent key={request.requestId} value={request.requestId} className="space-y-6">
            <div className="flex flex-col gap-6">
              <RequestPanel
                request={request}
                onRequestChange={(updates) => setActiveRequests(prev =>
                  prev.map(req =>
                    req.requestId === request.requestId ? { ...req, ...updates } : req
                  )
                )}
                onResponse={(response) => {
                  setResponses(prev => ({ ...prev, [request.requestId]: response }));
                  if (onRequestComplete) {
                    onRequestComplete(request, response);
                  }
                }}
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