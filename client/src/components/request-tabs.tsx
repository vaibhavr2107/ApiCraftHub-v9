import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState, useRef } from "react";
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

    console.log('RequestTabs: Processing route change for routeId:', routeId);

    // Check if request is already in active tabs
    const existingRequest = activeRequests.find(r => r.routeId === routeId);
    if (existingRequest) {
      console.log('RequestTabs: Request already in active tabs:', existingRequest);
      return;
    }

    // If it's a new request, create it
    if (routeId.startsWith('new-request')) {
      const newRequest = createDefaultRequest();
      setActiveRequests(prev => [...prev, newRequest]);
      return;
    }

    // Otherwise, load the request from the API
    console.log('RequestTabs: Loading request from API:', routeId);
    setLoading(prev => ({ ...prev, [routeId]: true }));

    openRequest(routeId)
      .then(request => {
        console.log('RequestTabs: Loaded request from API:', request);
        setActiveRequests(prev => {
          // Check for duplicates again before adding
          if (prev.some(r => r.routeId === routeId)) return prev;
          return [...prev, request];
        });
      })
      .catch(error => {
        console.error('RequestTabs: Error loading request:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to load request"
        });
      })
      .finally(() => {
        setLoading(prev => ({ ...prev, [routeId]: false }));
      });
  }, [routeId, activeRequests, toast]);

  const handleTabChange = (value: string) => {
    setLocation(`/request/${value}`);
  };

  const handleCloseTab = (routeId: string) => {
    setActiveRequests(prev => {
      const filtered = prev.filter(r => r.routeId !== routeId);
      if (filtered.length === 0) {
        // If closing last tab, create a new request
        const newRequest = createDefaultRequest();
        return [newRequest];
      }
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
      const mergedRequest = {
        ...currentRequest,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Update the request on the server
      const updatedRequest = await updateRequest(routeId, mergedRequest);

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
              </div>
            ))}
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newRequest = createDefaultRequest();
              setActiveRequests(prev => [...prev, newRequest]);
              setLocation(`/request/${newRequest.routeId}`);
            }}
          >
            <Plus className="h-4 w-4" />
            New Request
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
            <ResponsePanel
              response={responses[request.routeId]}
              isLoading={loading[request.routeId]}
              error={errors[request.routeId]}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// Helper function to create a default request
function createDefaultRequest(): Request {
  const routeId = generateRouteId('new-request');
  return {
    requestId: routeId,
    routeId,
    name: "New Request",
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
}