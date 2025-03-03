import { Plus, X } from "lucide-react";
import { useEffect, useState, useRef } from "react";
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
import type { Request } from "@shared/schema";
import { RequestPanel } from "./request-panel";
import { ResponsePanel } from "./response-panel";
import { openRequest, updateRequest } from "@/lib/api";

// Local storage key for active requests
const ACTIVE_REQUESTS_KEY = 'active_requests';

// Create default request helper with version handling
function createDefaultRequest(): Request {
  // Get existing requests to determine next version number
  const savedRequests = localStorage.getItem(ACTIVE_REQUESTS_KEY);
  let nextVersion = 1;

  if (savedRequests) {
    const requests = JSON.parse(savedRequests);
    // Find highest version number from existing "New Request" items
    const versionRegex = /New Request v(\d+)/;
    nextVersion = requests.reduce((max: number, req: Request) => {
      const match = req.name.match(versionRegex);
      if (match) {
        const version = parseInt(match[1], 10);
        return Math.max(max, version + 1);
      }
      return max;
    }, 1);
  }

  const routeId = generateRouteId(`new-request-v${nextVersion}`);
  return {
    requestId: routeId,
    routeId,
    name: `New Request v${nextVersion}`,
    method: "GET",
    baseUrl: "",
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
    version: nextVersion,
    selectedEnvironment: "qa01"
  };
}

export function RequestTabs() {
  const [location, setLocation] = useLocation();
  const [activeRequests, setActiveRequests] = useState<Request[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const initialized = useRef(false);
  const { toast } = useToast();

  // Get routeId from location
  const routeId = location.split('/').pop();

  // Load active requests from localStorage
  useEffect(() => {
    const savedRequests = localStorage.getItem(ACTIVE_REQUESTS_KEY);
    if (savedRequests) {
      try {
        const requests = JSON.parse(savedRequests);
        setActiveRequests(requests);
        initialized.current = true;
      } catch (error) {
        console.error('Error loading active requests:', error);
        initialized.current = true;
      }
    } else {
      initialized.current = true;
    }
  }, []);

  // Save active requests to localStorage
  useEffect(() => {
    if (initialized.current && activeRequests.length > 0) {
      localStorage.setItem(ACTIVE_REQUESTS_KEY, JSON.stringify(activeRequests));
    }
  }, [activeRequests]);

  // Handle route changes and request loading
  useEffect(() => {
    if (!routeId || !initialized.current) return;

    // Check if request is already in active tabs
    const existingRequest = activeRequests.find(r => r.routeId === routeId);
    if (existingRequest) {
      // If already exists, just focus on it
      setLocation(`/request/${existingRequest.routeId}`);
      return;
    }

    // If it's a new request
    if (routeId.startsWith('new-request')) {
      const newRequest = createDefaultRequest();
      // Check if a request with same name already exists
      const isDuplicate = activeRequests.some(r => r.name === newRequest.name);
      if (!isDuplicate) {
        setActiveRequests(prev => [...prev, newRequest]);
      }
      return;
    }

    // Otherwise, load the request from the API
    setLoading(prev => ({ ...prev, [routeId]: true }));

    openRequest(routeId)
      .then(request => {
        setActiveRequests(prev => {
          // Check for duplicates before adding
          if (prev.some(r => r.routeId === routeId || r.name === request.name)) {
            return prev;
          }
          return [...prev, request];
        });
      })
      .catch(error => {
        console.error('Error loading request:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to load request"
        });

        // Create a new request if we can't load the existing one
        const newRequest = createDefaultRequest();
        setActiveRequests(prev => {
          // Final duplication check before adding
          if (prev.some(r => r.name === newRequest.name)) return prev;
          return [...prev, newRequest];
        });
        setLocation(`/request/${newRequest.routeId}`);
      })
      .finally(() => {
        setLoading(prev => ({ ...prev, [routeId]: false }));
      });
  }, [routeId, activeRequests, toast, setLocation]);

  const handleTabChange = (value: string) => {
    setLocation(`/request/${value}`);
  };

  const handleCloseTab = (routeId: string) => {
    // If there's only one tab, don't allow it to be closed
    if (activeRequests.length <= 1) {
      return;
    }
    
    setActiveRequests(prev => {
      const filtered = prev.filter(r => r.routeId !== routeId);
      return filtered;
    });

    // If closing active tab, switch to another tab
    if (routeId === routeId) {
      const remainingRequests = activeRequests.filter(r => r.routeId !== routeId);
      if (remainingRequests.length > 0) {
        setLocation(`/request/${remainingRequests[remainingRequests.length - 1].routeId}`);
      }
    }
  };

  const handleRequestChange = async (routeId: string, updates: Partial<Request>) => {
    try {
      // Get the current request
      const currentRequest = activeRequests.find(r => r.routeId === routeId);
      if (!currentRequest) {
        throw new Error('Request not found');
      }

      // Merge updates with current request
      const updatedRequest = await updateRequest(routeId, updates);

      // Update local state
      setActiveRequests(prev =>
        prev.map(req =>
          req.routeId === routeId ? updatedRequest : req
        )
      );

      toast({
        title: "Success",
        description: "Request updated successfully"
      });
    } catch (error) {
      console.error('Error updating request:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update request"
      });
    }
  };

  const handleNewRequest = () => {
    const newRequest = createDefaultRequest();
    setActiveRequests(prev => {
      // Check for duplicates before adding
      if (prev.some(r => r.name === newRequest.name)) return prev;
      return [...prev, newRequest];
    });
    setLocation(`/request/${newRequest.routeId}`);
  };

  if (!initialized.current) {
    return null;
  }

  return (
    <div className="container py-6">
      <Tabs value={routeId || ''} onValueChange={handleTabChange}>
        <div className="flex items-center gap-2 mb-4">
          <TabsList className="flex-1">
            {activeRequests.map(request => (
              <div key={request.routeId} className="flex items-center">
                <TabsTrigger value={request.routeId}>
                  {request.name || request.routeId}
                </TabsTrigger>
                {activeRequests.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(request.routeId);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewRequest}
          >
            <Plus className="h-4 w-4" />
            New Request
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Only keep the first tab, close all others
              if (activeRequests.length > 0) {
                setActiveRequests([activeRequests[0]]);
                setLocation(`/request/${activeRequests[0].routeId}`);
              }
            }}
          >
            <X className="h-4 w-4" />
            Close All
          </Button>
        </div>

        {activeRequests.map(request => (
          <TabsContent key={request.routeId} value={request.routeId}>
            <RequestPanel
              request={request}
              onRequestChange={(updates) => handleRequestChange(request.routeId, updates)}
              onResponse={(response) => {
                setResponses(prev => ({ ...prev, [request.routeId]: response }));
              }}
              onLoading={(isLoading) => {
                setLoading(prev => ({ ...prev, [request.routeId]: isLoading }));
              }}
              onError={(error) => {
                setErrors(prev => ({ ...prev, [request.routeId]: error }));
              }}
            />
            <div className="mt-8">
              <ResponsePanel
                response={responses[request.routeId]}
                isLoading={loading[request.routeId]}
                error={errors[request.routeId]}
                exampleResponse={request.exampleResponseBody}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}