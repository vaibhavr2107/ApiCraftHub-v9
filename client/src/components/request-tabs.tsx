import { Plus, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { useLocation } from "wouter";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface RequestTabsProps {
  onRequestComplete?: (request: ApiRequest, response: any) => void;
}

const DEFAULT_HEADERS = [
  { key: "Accept", value: "*/*", enabled: true },
  { key: "User-Agent", value: "API-Tester/1.0", enabled: true },
  { key: "Content-Type", value: "application/json", enabled: true }
];

export function RequestTabs({ onRequestComplete }: RequestTabsProps) {
  const [location, setLocation] = useLocation();
  const [requests, setRequests] = useState<ApiRequest[]>(() => {
    const saved = localStorage.getItem("saved_requests");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed;
      } catch (e) {
        console.error("Error loading saved requests:", e);
        return [];
      }
    }
    return [];
  });

  // Get active tab from route or first request
  const requestId = location.split('/').pop();
  const activeTab = requests.find(r => r.id === requestId)?.id || requests[0]?.id;

  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem("saved_requests", JSON.stringify(requests));
  }, [requests]);

  // Listen for storage events to update tabs when a new request is added
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("saved_requests");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setRequests(parsed);
        } catch (e) {
          console.error("Error loading saved requests:", e);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Listen for tab activation events
  useEffect(() => {
    const handleTabActivation = (event: CustomEvent) => {
      const tabId = event.detail;
      if (tabId && tabId !== activeTab) {
        setLocation(`/request/${tabId}`);
      }
    };

    window.addEventListener('activateTab', handleTabActivation as EventListener);
    return () => window.removeEventListener('activateTab', handleTabActivation as EventListener);
  }, [activeTab, setLocation]);

  const handleNewTab = () => {
    const newRequest = {
      id: nanoid(),
      name: "New Request",
      method: "GET",
      url: "https://api.restful-api.dev/objects",
      queryParams: [{ key: "", value: "", enabled: true }],
      headers: DEFAULT_HEADERS,
      auth: { type: "none" },
      body: {
        type: "none",
        rawFormat: "json",
        content: "",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as ApiRequest;

    setRequests([...requests, newRequest]);
    setLocation(`/request/${newRequest.id}`);
  };

  const handleCloseTab = (requestId: string) => {
    const updatedRequests = requests.filter(req => req.id !== requestId);
    setRequests(updatedRequests);

    // If we're closing the active tab, navigate to another tab
    if (requestId === activeTab) {
      const nextTab = updatedRequests[0]?.id;
      if (nextTab) {
        setLocation(`/request/${nextTab}`);
      } else {
        setLocation('/');
        handleNewTab();
      }
    }
  };

  const handleSaveRequest = (requestId: string) => {
    if (!saveName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a name for the request",
      });
      return;
    }

    const updatedRequests = requests.map((req) =>
      req.id === requestId ? { ...req, name: saveName } : req
    );
    setRequests(updatedRequests);
    setSaveDialogOpen(false);
    setSaveName("");
    toast({
      title: "Success",
      description: "Request saved successfully",
    });
  };

  const handleUpdateRequest = useCallback((requestId: string, updates: Partial<ApiRequest>) => {
    setRequests((prev) =>
      prev.map((req) =>
        req.id === requestId ? { ...req, ...updates } : req
      )
    );
  }, []);

  const handleResponse = useCallback((requestId: string, response: any) => {
    setResponses((prev) => ({ ...prev, [requestId]: response }));
    // Find the request and pass both request and response to history
    const request = requests.find(req => req.id === requestId);
    if (request && onRequestComplete) {
      onRequestComplete(request, response);
    }
  }, [requests, onRequestComplete]);

  // Handle tab changes through route updates
  const handleTabChange = (value: string) => {
    if (value !== activeTab) {
      setLocation(`/request/${value}`);
    }
  };

  if (requests.length === 0) {
    handleNewTab();
    return null;
  }

  return (
    <div className="container py-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex items-center gap-2 mb-4">
          <TabsList className="flex-1">
            {requests.map((request) => (
              <div key={request.id} className="flex items-center">
                <TabsTrigger value={request.id} className="flex-1">
                  {request.name}
                </TabsTrigger>
                {requests.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
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
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Save className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Request Name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
                <Button onClick={() => handleSaveRequest(activeTab)}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="icon" onClick={handleNewTab}>
            <Plus className="h-4 w-4" />
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
                  setLoading((prev) => ({ ...prev, [request.id]: isLoading }))
                }
                onError={(error) =>
                  setErrors((prev) => ({ ...prev, [request.id]: error }))
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