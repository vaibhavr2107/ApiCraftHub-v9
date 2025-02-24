import { useState, useEffect } from "react";
import { FolderTree, Settings, History } from "lucide-react";
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
}

export function ViewSection({ onEnvironmentSelect }: ViewSectionProps) {
  const [activeView, setActiveView] = useState<"collections" | "environment" | "history">("collections");
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

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Views</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => setActiveView("collections")}
            isActive={activeView === "collections"}
          >
            <FolderTree className="h-4 w-4" />
            <span>Collections</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => setActiveView("environment")}
            isActive={activeView === "environment"}
          >
            <Settings className="h-4 w-4" />
            <span>Environment</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => setActiveView("history")}
            isActive={activeView === "history"}
          >
            <History className="h-4 w-4" />
            <span>History</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <div className="mt-4 px-2">
        {activeView === "collections" && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Collections</h3>
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
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="space-y-2">
                {requestHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md border p-2 text-xs space-y-1"
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
                {requestHistory.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No recent requests
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </SidebarGroup>
  );
}