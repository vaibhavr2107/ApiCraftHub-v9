import { useState, useEffect } from "react";
import { FolderTree, Settings, History, Search, FileJson } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
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

interface Environment {
  id: string;
  name: string;
  variables: { key: string; value: string }[];
}

interface ViewSectionProps {
  onEnvironmentSelect?: (environment: Environment) => void;
  onViewChange?: (view: 'collections' | 'environment' | 'history' | 'openapi') => void;
}

export function ViewSection({ onEnvironmentSelect, onViewChange }: ViewSectionProps) {
  const [activeView, setActiveView] = useState<"collections" | "environment" | "history" | "openapi">("collections");
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

  // Add search states
  const [historySearch, setHistorySearch] = useState("");
  const [collectionsSearch, setCollectionsSearch] = useState("");

  const handleViewChange = (view: typeof activeView) => {
    setActiveView(view);
    if (onViewChange) {
      onViewChange(view);
    }
  };

  // Keep history in sync with localStorage
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-emerald-500";
    if (status >= 400 && status < 500) return "text-amber-500";
    if (status >= 500) return "text-red-500";
    return "text-gray-500";
  };

  const handleHistoryItemClick = (entry: any) => {
    const historyRequest = {
      id: crypto.randomUUID(),
      name: `History: ${entry.request.method} ${new URL(entry.request.url).pathname}`,
      method: entry.request.method,
      url: entry.request.url,
      headers: entry.request.headers || [],
      queryParams: entry.request.queryParams || [],
      body: entry.request.body || { type: "none", content: "", rawFormat: "json" },
      pathVariables: [],
      auth: { type: "none" }
    };

    const savedRequests = localStorage.getItem("saved_requests");
    const requests = savedRequests ? JSON.parse(savedRequests) : [];
    localStorage.setItem("saved_requests", JSON.stringify([...requests, historyRequest]));

    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent('activateTab', { detail: historyRequest.id }));
  };

  // Filter history based on search
  const filteredHistory = requestHistory.filter(entry => {
    if (!historySearch) return true;
    const searchLower = historySearch.toLowerCase();
    return (
      entry.request.method.toLowerCase().includes(searchLower) ||
      entry.request.url.toLowerCase().includes(searchLower) ||
      entry.response.status.toString().includes(searchLower) ||
      (entry.request.body?.content || "").toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Views</SidebarGroupLabel>
      <SidebarMenu>
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
        {activeView === "collections" && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Collections</h3>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search collections..."
                value={collectionsSearch}
                onChange={(e) => setCollectionsSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              No collections imported yet
            </div>
          </div>
        )}

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
              <Input
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="space-y-2">
                {filteredHistory.map((entry) => (
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
                  </div>
                ))}
                {filteredHistory.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    {requestHistory.length === 0 ? "No recent requests" : "No matching requests"}
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