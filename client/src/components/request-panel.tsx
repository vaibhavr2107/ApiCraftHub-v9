import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { makeRequest } from "@/lib/api";
import { ResponseData } from "@/pages/home";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

interface RequestPanelProps {
  onResponse: (response: ResponseData) => void;
  onLoading: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
}

interface QueryParam {
  key: string;
  value: string;
}

interface AuthConfig {
  type: "none" | "basic" | "bearer";
  username?: string;
  password?: string;
  token?: string;
}

export function RequestPanel({ onResponse, onLoading, onError }: RequestPanelProps) {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://api.restful-api.dev/objects");
  const [queryParams, setQueryParams] = useState<QueryParam[]>([{ key: "", value: "" }]);
  const [body, setBody] = useState("");
  const [auth, setAuth] = useState<AuthConfig>({ type: "none" });
  const { toast } = useToast();

  const addQueryParam = () => {
    setQueryParams([...queryParams, { key: "", value: "" }]);
  };

  const removeQueryParam = (index: number) => {
    setQueryParams(queryParams.filter((_, i) => i !== index));
  };

  const updateQueryParam = (index: number, field: "key" | "value", value: string) => {
    const newParams = [...queryParams];
    newParams[index][field] = value;
    setQueryParams(newParams);
  };

  const buildUrl = () => {
    const baseUrl = new URL(url);
    queryParams.forEach(({ key, value }) => {
      if (key && value) {
        baseUrl.searchParams.append(key, value);
      }
    });
    return baseUrl.toString();
  };

  const handleSend = async () => {
    onLoading(true);
    onError(null);

    try {
      const headers: Record<string, string> = {};

      if (auth.type === "basic" && auth.username && auth.password) {
        headers["Authorization"] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
      } else if (auth.type === "bearer" && auth.token) {
        headers["Authorization"] = `Bearer ${auth.token}`;
      }

      const response = await makeRequest({
        method,
        url: buildUrl(),
        body: body ? JSON.parse(body) : undefined,
        headers,
      });
      onResponse(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      onError(message);
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      onLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL"
            className="flex-1"
          />
        </div>

        <Tabs defaultValue="params" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="params">Params</TabsTrigger>
            <TabsTrigger value="auth">Authorization</TabsTrigger>
            <TabsTrigger value="body">Body</TabsTrigger>
          </TabsList>

          <TabsContent value="params" className="space-y-4">
            {queryParams.map((param, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Parameter"
                  value={param.key}
                  onChange={(e) => updateQueryParam(index, "key", e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={param.value}
                  onChange={(e) => updateQueryParam(index, "value", e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQueryParam(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button onClick={addQueryParam} variant="outline" className="w-full">
              Add Parameter
            </Button>
          </TabsContent>

          <TabsContent value="auth" className="space-y-4">
            <Select
              value={auth.type}
              onValueChange={(value: "none" | "basic" | "bearer") =>
                setAuth({ type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select auth type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Auth</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
              </SelectContent>
            </Select>

            {auth.type === "basic" && (
              <div className="space-y-2">
                <Input
                  placeholder="Username"
                  value={auth.username}
                  onChange={(e) =>
                    setAuth({ ...auth, username: e.target.value })
                  }
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={auth.password}
                  onChange={(e) =>
                    setAuth({ ...auth, password: e.target.value })
                  }
                />
              </div>
            )}

            {auth.type === "bearer" && (
              <Input
                placeholder="Token"
                value={auth.token}
                onChange={(e) => setAuth({ ...auth, token: e.target.value })}
              />
            )}
          </TabsContent>

          <TabsContent value="body" className="space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="{}"
              className="font-mono min-h-[200px]"
            />
            <Button
              variant="outline"
              onClick={() => {
                try {
                  const formatted = JSON.stringify(JSON.parse(body), null, 2);
                  setBody(formatted);
                } catch (e) {
                  toast({
                    variant: "destructive",
                    title: "Invalid JSON",
                    description: "Please enter valid JSON",
                  });
                }
              }}
            >
              Format JSON
            </Button>
          </TabsContent>
        </Tabs>

        <Button onClick={handleSend} className="w-full">
          Send Request
        </Button>
      </CardContent>
    </Card>
  );
}