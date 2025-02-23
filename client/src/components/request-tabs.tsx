import { Plus, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SavedRequest, ResponseData } from "@/types/request";
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
  onTabChange?: (activeTab: string) => void;
}

const DEFAULT_REQUEST: Omit<SavedRequest, "id" | "name"> = {
  method: "GET",
  url: "https://api.restful-api.dev/objects",
  queryParams: [{ key: "", value: "" }],
  headers: [{ key: "", value: "" }],
  auth: { type: "none" },
};

export function RequestTabs({ onTabChange }: RequestTabsProps) {
  const [requests, setRequests] = useState<SavedRequest[]>(() => {
    const saved = localStorage.getItem("saved_requests");
    if (saved) {
      return JSON.parse(saved);
    }
    return [{ ...DEFAULT_REQUEST, id: nanoid(), name: "New Request" }];
  });

  const [activeTab, setActiveTab] = useState(requests[0].id);
  const [responses, setResponses] = useState<Record<string, ResponseData | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem("saved_requests", JSON.stringify(requests));
  }, [requests]);

  const handleNewTab = () => {
    const newRequest = {
      ...DEFAULT_REQUEST,
      id: nanoid(),
      name: "New Request",
    };
    setRequests([...requests, newRequest]);
    setActiveTab(newRequest.id);
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

  const handleUpdateRequest = useCallback((requestId: string, updates: Partial<SavedRequest>) => {
    setRequests((prev) =>
      prev.map((req) =>
        req.id === requestId ? { ...req, ...updates } : req
      )
    );
  }, []);

  return (
    <div className="container py-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center gap-2 mb-4">
          <TabsList className="flex-1">
            {requests.map((request) => (
              <TabsTrigger key={request.id} value={request.id} className="flex-1">
                {request.name}
              </TabsTrigger>
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
            <div className="grid gap-6 lg:grid-cols-2">
              <RequestPanel
                request={request}
                onRequestChange={(updates) => handleUpdateRequest(request.id, updates)}
                onResponse={(response) =>
                  setResponses((prev) => ({ ...prev, [request.id]: response }))
                }
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