import { useEffect, useState } from "react";
import { FolderTree, Settings, History, Search, FileJson, Database } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { generateHistoryRouteId } from "@/lib/history";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Environment {
  id: string;
  name: string;
  variables: { key: string; value: string }[];
}

interface ViewSectionProps {
  onEnvironmentSelect?: (environment: Environment) => void;
  onViewChange?: (view: 'collections' | 'environment' | 'history' | 'openapi' | 'catalog') => void;
}

export function ViewSection({ onEnvironmentSelect, onViewChange }: ViewSectionProps) {
  const [activeView, setActiveView] = useState<"collections" | "environment" | "history" | "openapi" | "catalog">("collections");
  const [environments, setEnvironments] = useState<Environment[]>(() => {
    const saved = localStorage.getItem("environments");
    return saved ? JSON.parse(saved) : [];
  });
  const [newEnvDialogOpen, setNewEnvDialogOpen] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [requestHistory, setRequestHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem("request_history");
    return saved ? JSON.parse(saved) : [];
  });

  const [historySearch, setHistorySearch] = useState("");
  const [isRegexSearch, setIsRegexSearch] = useState(false);

  const handleViewChange = (view: typeof activeView) => {
    setActiveView(view);
    if (onViewChange) {
      onViewChange(view);
    }
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("request_history");
      if (saved) {
        setRequestHistory(JSON.parse(saved));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleHistoryItemClick = (entry: any) => {
    try {
      const currentTimestamp = new Date().getTime();
      const routeId = generateHistoryRouteId(entry.request.method, currentTimestamp);

      console.log('Creating history request with routeId:', routeId);

      const savedRequests = localStorage.getItem("active_requests");
      const requests = savedRequests ? JSON.parse(savedRequests) : [];

      const historyRequest = {
        requestId: routeId,
        routeId: routeId,
        name: `${entry.request.method} Request (${new Date(currentTimestamp).toLocaleString()})`,
        method: entry.request.method,
        baseUrl: entry.request.url,
        headers: entry.request.headers || {},
        queryParams: {},
        pathVariables: {},
        auth: { type: "none" },
        requestBody: entry.request.body || {},
        responseFields: entry.response.data || {},
        historyId: routeId,
        historyRequests: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        selectedEnvironment: "qa01",
        devUrl: "",
        qa01Url: "",
        qa02Url: "",
        qa03Url: "",
        perfUrl: "",
        exampleResponseBody: entry.response.data || {},
        tags: []
      };

      const updatedRequests = [...requests, historyRequest];
      localStorage.setItem("active_requests", JSON.stringify(updatedRequests));
      window.dispatchEvent(new Event("storage"));

      window.location.href = `/request/${routeId}`;
    } catch (error) {
      console.error('Error handling history item click:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-emerald-500";
    if (status >= 400 && status < 500) return "text-amber-500";
    if (status >= 500) return "text-red-500";
    return "text-gray-500";
  };

  const handleAddEnvironment = () => {
    if (!newEnvName.trim()) return;

    const newEnv: Environment = {
      id: crypto.randomUUID(),
      name: newEnvName,
      variables: []
    };

    setEnvironments(prev => {
      const updated = [...prev, newEnv];
      localStorage.setItem("environments", JSON.stringify(updated));
      return updated;
    });

    setNewEnvDialogOpen(false);
    setNewEnvName("");
  };

  const handleEnvironmentClick = (env: Environment) => {
    if (onEnvironmentSelect) {
      onEnvironmentSelect(env);
    }
  };

  const searchInObject = (obj: any, searchTerm: string): boolean => {
    let searchRegex;

    if (isRegexSearch) {
      const regexPattern = searchTerm.match(/^\/(.+)\/([gimuy]*)$/);
      if (regexPattern) {
        try {
          searchRegex = new RegExp(regexPattern[1], regexPattern[2]);
        } catch (e) {
          searchRegex = new RegExp(searchTerm, 'i');
        }
      } else {
        searchRegex = new RegExp(searchTerm, 'i');
      }
    } else {
      searchRegex = new RegExp(searchTerm, 'i');
    }

    const search = (value: any): boolean => {
      if (typeof value === 'string') {
        return searchRegex.test(value);
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return searchRegex.test(String(value));
      }
      if (Array.isArray(value)) {
        return value.some(item => search(item));
      }
      if (value && typeof value === 'object') {
        return Object.values(value).some(val => search(val));
      }
      return false;
    };

    return search(obj);
  };

  const filteredHistory = requestHistory.filter(entry => {
    if (!historySearch) return true;

    if (
      searchInObject(entry.request.method, historySearch) ||
      searchInObject(entry.request.url, historySearch) ||
      searchInObject(entry.response.status.toString(), historySearch)
    ) {
      return true;
    }

    if (searchInObject(entry.request.body, historySearch)) return true;
    if (searchInObject(entry.response.data, historySearch)) return true;
    if (searchInObject(entry.request.headers, historySearch)) return true;
    if (searchInObject(entry.request.queryParams, historySearch)) return true;

    return false;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Views</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => handleViewChange("catalog")}
            isActive={activeView === "catalog"}
          >
            <Database className="h-4 w-4" />
            <span>API Catalog</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => handleViewChange("collections")}
            isActive={activeView === "collections"}
          >
            <FolderTree className="h-4 w-4" />
            <span>Collections</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => handleViewChange("environment")}
            isActive={activeView === "environment"}
          >
            <Settings className="h-4 w-4" />
            <span>Environment</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => handleViewChange("history")}
            isActive={activeView === "history"}
          >
            <History className="h-4 w-4" />
            <span>History</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => handleViewChange("openapi")}
            isActive={activeView === "openapi"}
          >
            <FileJson className="h-4 w-4" />
            <span>OpenAPI</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <div className="mt-4 px-2">
        {activeView === "environment" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Environments</h3>
              <Dialog open={newEnvDialogOpen} onOpenChange={setNewEnvDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">New</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Environment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Environment Name</Label>
                      <Input
                        id="name"
                        value={newEnvName}
                        onChange={(e) => setNewEnvName(e.target.value)}
                        placeholder="Development, Production, etc."
                      />
                    </div>
                    <Button onClick={handleAddEnvironment}>Create</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2">
              {environments.map((env) => (
                <Button
                  key={env.id}
                  variant="ghost"
                  className="justify-start text-left font-normal"
                  onClick={() => handleEnvironmentClick(env)}
                >
                  {env.name}
                </Button>
              ))}
              {environments.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No environments created
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === "history" && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">History</h3>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <div className="space-y-1">
                <Input
                  placeholder="Search history... (searches all content)"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-8"
                />
                <div className="text-xs text-muted-foreground">
                  Tip: Search finds matches in URLs, request/response bodies, headers, and all fields
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 mb-2">
            </div>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="space-y-2">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-md border p-2 text-xs space-y-1 cursor-pointer hover:bg-muted/50"
                      onClick={() => handleHistoryItemClick(entry)}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "font-mono font-medium",
                          getStatusColor(entry.response.status)
                        )}>
                          {entry.request.method} ({entry.response.status})
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(entry.timestamp)}
                        </span>
                      </div>
                      <div className="truncate font-mono text-muted-foreground">
                        {entry.request.url}
                      </div>
                      {historySearch && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {searchInObject(entry.request.body, historySearch) && (
                            <div>Match found in request body</div>
                          )}
                          {searchInObject(entry.response.data, historySearch) && (
                            <div>Match found in response data</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No history entries found. Make requests to see them here.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {activeView === "openapi" && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">OpenAPI</h3>
            <div className="text-sm text-muted-foreground">
              Import an OpenAPI specification to get started
            </div>
          </div>
        )}
      </div>
    </SidebarGroup>
  );
}