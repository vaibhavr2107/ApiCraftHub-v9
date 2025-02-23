import { Collection, CollectionVariable } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Plus, Trash } from "lucide-react";
import { useState } from "react";

interface CollectionHomeProps {
  collection: Collection;
  onUpdate: (collection: Collection) => void;
}

export function CollectionHome({ collection, onUpdate }: CollectionHomeProps) {
  const { toast } = useToast();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const handleAuthChange = (field: string, value: string) => {
    const newCollection = { ...collection };
    if (!newCollection.auth) {
      newCollection.auth = { type: "none" };
    }

    if (field === "type") {
      newCollection.auth.type = value as any;
      // Reset the auth details when changing type
      delete newCollection.auth.basic;
      delete newCollection.auth.bearer;
      delete newCollection.auth.oauth2;
    } else {
      const [authType, authField] = field.split(".");
      if (!newCollection.auth[authType]) {
        newCollection.auth[authType] = {};
      }
      newCollection.auth[authType][authField] = value;
    }

    onUpdate(newCollection);
    toast({
      title: "Success",
      description: "Collection authentication updated",
    });
  };

  const handleAddVariable = () => {
    const newVariable: CollectionVariable = {
      id: Math.random().toString(36).substr(2, 9),
      key: "",
      value: "",
      type: "default",
    };

    const newCollection = {
      ...collection,
      variables: [...(collection.variables || []), newVariable],
    };
    onUpdate(newCollection);
  };

  const handleVariableChange = (
    variableId: string,
    field: keyof CollectionVariable,
    value: string
  ) => {
    const newCollection = {
      ...collection,
      variables: collection.variables?.map((v) =>
        v.id === variableId ? { ...v, [field]: value } : v
      ),
    };
    onUpdate(newCollection);
  };

  const handleDeleteVariable = (variableId: string) => {
    const newCollection = {
      ...collection,
      variables: collection.variables?.filter((v) => v.id !== variableId),
    };
    onUpdate(newCollection);
    toast({
      title: "Success",
      description: "Variable deleted",
    });
  };

  const toggleSecretVisibility = (variableId: string) => {
    setShowSecrets((prev) => ({
      ...prev,
      [variableId]: !prev[variableId],
    }));
  };

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="auth">Authentication</TabsTrigger>
        <TabsTrigger value="variables">Variables</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <Label>Collection Name</Label>
              <Input
                value={collection.name}
                onChange={(e) =>
                  onUpdate({ ...collection, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={collection.description || ""}
                onChange={(e) =>
                  onUpdate({ ...collection, description: e.target.value })
                }
              />
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="auth" className="space-y-4">
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <Label>Authentication Type</Label>
              <Select
                value={collection.auth?.type || "none"}
                onValueChange={(value) => handleAuthChange("type", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Auth</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {collection.auth?.type === "basic" && (
              <div className="space-y-4">
                <div>
                  <Label>Username</Label>
                  <Input
                    value={collection.auth.basic?.username || ""}
                    onChange={(e) =>
                      handleAuthChange("basic.username", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={collection.auth.basic?.password || ""}
                    onChange={(e) =>
                      handleAuthChange("basic.password", e.target.value)
                    }
                  />
                </div>
              </div>
            )}

            {collection.auth?.type === "bearer" && (
              <div>
                <Label>Token</Label>
                <Input
                  value={collection.auth.bearer?.token || ""}
                  onChange={(e) =>
                    handleAuthChange("bearer.token", e.target.value)
                  }
                />
              </div>
            )}

            {collection.auth?.type === "oauth2" && (
              <div className="text-sm text-muted-foreground">
                OAuth 2.0 configuration will be implemented soon
              </div>
            )}
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="variables" className="space-y-4">
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Collection Variables</h3>
              <Button onClick={handleAddVariable}>
                <Plus className="h-4 w-4 mr-2" />
                Add Variable
              </Button>
            </div>

            <div className="space-y-2">
              {collection.variables?.map((variable) => (
                <div
                  key={variable.id}
                  className="grid grid-cols-[1fr,1fr,auto,auto] gap-2 items-center"
                >
                  <Input
                    placeholder="Variable name"
                    value={variable.key}
                    onChange={(e) =>
                      handleVariableChange(variable.id, "key", e.target.value)
                    }
                  />
                  <div className="relative">
                    <Input
                      type={
                        variable.type === "secret" && !showSecrets[variable.id]
                          ? "password"
                          : "text"
                      }
                      placeholder="Value"
                      value={variable.value}
                      onChange={(e) =>
                        handleVariableChange(
                          variable.id,
                          "value",
                          e.target.value
                        )
                      }
                    />
                    {variable.type === "secret" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => toggleSecretVisibility(variable.id)}
                      >
                        {showSecrets[variable.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  <Select
                    value={variable.type}
                    onValueChange={(value) =>
                      handleVariableChange(
                        variable.id,
                        "type",
                        value as "default" | "secret"
                      )
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="secret">Secret</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteVariable(variable.id)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
