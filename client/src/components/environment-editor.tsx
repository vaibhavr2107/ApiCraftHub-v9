import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Environment {
  id: string;
  name: string;
  variables: { key: string; value: string }[];
}

interface EnvironmentEditorProps {
  environment: Environment;
  onUpdate: (environment: Environment) => void;
}

export function EnvironmentEditor({ environment, onUpdate }: EnvironmentEditorProps) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleAddVariable = () => {
    if (!newKey.trim()) return;

    const updatedEnv = {
      ...environment,
      variables: [
        ...environment.variables,
        { key: newKey, value: newValue }
      ]
    };

    onUpdate(updatedEnv);
    setNewKey("");
    setNewValue("");
  };

  const handleRemoveVariable = (index: number) => {
    const updatedEnv = {
      ...environment,
      variables: environment.variables.filter((_, i) => i !== index)
    };

    onUpdate(updatedEnv);
  };

  const handleUpdateVariable = (index: number, key: string, value: string) => {
    const updatedEnv = {
      ...environment,
      variables: environment.variables.map((v, i) =>
        i === index ? { key, value } : v
      )
    };

    onUpdate(updatedEnv);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Environment Variables</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {/* Add new variable form */}
            <div className="grid grid-cols-[1fr,1fr,auto] gap-2 items-end">
              <div>
                <Label htmlFor="new-key">Key</Label>
                <Input
                  id="new-key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="API_KEY"
                />
              </div>
              <div>
                <Label htmlFor="new-value">Value</Label>
                <Input
                  id="new-value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="your-api-key"
                />
              </div>
              <Button onClick={handleAddVariable}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Existing variables */}
            <div className="space-y-2">
              {environment.variables.map((variable, index) => (
                <div key={index} className="grid grid-cols-[1fr,1fr,auto] gap-2">
                  <Input
                    value={variable.key}
                    onChange={(e) =>
                      handleUpdateVariable(index, e.target.value, variable.value)
                    }
                  />
                  <Input
                    value={variable.value}
                    onChange={(e) =>
                      handleUpdateVariable(index, variable.key, e.target.value)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveVariable(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
