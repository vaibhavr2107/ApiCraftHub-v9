import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Environment, EnvironmentStore, DEFAULT_ENVIRONMENTS } from "@/types/environment";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface EnvironmentSelectorProps {
  selectedEnvironment: Environment;
  requestId: string;
  onEnvironmentChange: (environment: Environment) => void;
}

export function EnvironmentSelector({ selectedEnvironment, requestId, onEnvironmentChange }: EnvironmentSelectorProps) {
  const [store, setStore] = useState<EnvironmentStore>(() => {
    const saved = localStorage.getItem("environment_store");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          requestConfigs: {
            ...parsed.requestConfigs,
            [requestId]: selectedEnvironment // Set initial environment for this request
          }
        };
      } catch (e) {
        console.error("Error loading environment store:", e);
      }
    }
    return {
      environments: DEFAULT_ENVIRONMENTS,
      requestConfigs: { [requestId]: selectedEnvironment }
    };
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("environment_store", JSON.stringify(store));
  }, [store]);

  const updateEnvironmentConfig = (env: Environment, field: keyof typeof DEFAULT_ENVIRONMENTS[Environment], value: string) => {
    setStore(prev => ({
      ...prev,
      environments: {
        ...prev.environments,
        [env]: {
          ...prev.environments[env],
          [field]: value
        }
      }
    }));
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedEnvironment} onValueChange={onEnvironmentChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Environment" />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(store.environments).map((env) => (
            <SelectItem key={env} value={env}>
              {env.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Environment Settings</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {Object.entries(store.environments).map(([env, config]) => (
              <div key={env} className="grid gap-2">
                <h4 className="font-medium">{env.toUpperCase()}</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Base URL"
                    value={config.baseUrl}
                    onChange={(e) => updateEnvironmentConfig(env as Environment, "baseUrl", e.target.value)}
                  />
                  <Input
                    placeholder="Bearer Token"
                    value={config.bearerToken}
                    type="password"
                    onChange={(e) => updateEnvironmentConfig(env as Environment, "bearerToken", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}