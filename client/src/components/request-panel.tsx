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
import { useEffect, useState } from "react";
import { makeRequest } from "@/lib/api";
import type { ResponseData, SavedRequest, QueryParam } from "@/types/request";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

interface RequestPanelProps {
  request: SavedRequest;
  onRequestChange: (updates: Partial<SavedRequest>) => void;
  onResponse: (response: ResponseData) => void;
  onLoading: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
}

export function RequestPanel({
  request,
  onRequestChange,
  onResponse,
  onLoading,
  onError,
}: RequestPanelProps) {
  const { toast } = useToast();

  // Synchronize URL and query parameters
  useEffect(() => {
    try {
      const url = new URL(request.url);
      const params: QueryParam[] = Array.from(url.searchParams.entries()).map(
        ([key, value]) => ({ key, value })
      );

      if (params.length === 0) {
        params.push({ key: "", value: "" });
      }

      onRequestChange({ queryParams: params });
    } catch (e) {
      // Invalid URL, keep existing query params
    }
  }, [request.url, onRequestChange]);

  const updateUrl = (baseUrl: string) => {
    try {
      const url = new URL(baseUrl);
      request.queryParams.forEach(({ key, value }) => {
        if (key && value) {
          url.searchParams.set(key, value);
        }
      });
      onRequestChange({ url: url.toString() });
    } catch (e) {
      // Invalid URL, just update the raw value
      onRequestChange({ url: baseUrl });
    }
  };

  const addQueryParam = () => {
    onRequestChange({
      queryParams: [...request.queryParams, { key: "", value: "" }],
    });
  };

  const removeQueryParam = (index: number) => {
    const newParams = request.queryParams.filter((_, i) => i !== index);
    if (newParams.length === 0) {
      newParams.push({ key: "", value: "" });
    }
    onRequestChange({ queryParams: newParams });
  };

  const updateQueryParam = (index: number, field: "key" | "value", value: string) => {
    const newParams = [...request.queryParams];
    newParams[index][field] = value;
    onRequestChange({ queryParams: newParams });

    // Update URL with new query parameters
    try {
      const url = new URL(request.url);
      url.search = ""; // Clear existing query parameters
      newParams.forEach(({ key, value }) => {
        if (key && value) {
          url.searchParams.append(key, value);
        }
      });
      onRequestChange({ url: url.toString() });
    } catch (e) {
      // Invalid URL, skip URL update
    }
  };

  const handleSend = async () => {
    onLoading(true);
    onError(null);

    try {
      const headers: Record<string, string> = {};

      if (request.auth.type === "basic" && request.auth.username && request.auth.password) {
        headers["Authorization"] = `Basic ${btoa(
          `${request.auth.username}:${request.auth.password}`
        )}`;
      } else if (request.auth.type === "bearer" && request.auth.token) {
        headers["Authorization"] = `Bearer ${request.auth.token}`;
      }

      const response = await makeRequest({
        method: request.method,
        url: request.url,
        body: request.body ? JSON.parse(request.body) : undefined,
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
          <Select
            value={request.method}
            onValueChange={(value) => onRequestChange({ method: value as SavedRequest["method"] })}
          >
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
            value={request.url}
            onChange={(e) => updateUrl(e.target.value)}
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
            {request.queryParams.map((param, index) => (
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
              value={request.auth.type}
              onValueChange={(value: "none" | "basic" | "bearer") =>
                onRequestChange({ auth: { ...request.auth, type: value } })
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

            {request.auth.type === "basic" && (
              <div className="space-y-2">
                <Input
                  placeholder="Username"
                  value={request.auth.username}
                  onChange={(e) =>
                    onRequestChange({
                      auth: { ...request.auth, username: e.target.value },
                    })
                  }
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={request.auth.password}
                  onChange={(e) =>
                    onRequestChange({
                      auth: { ...request.auth, password: e.target.value },
                    })
                  }
                />
              </div>
            )}

            {request.auth.type === "bearer" && (
              <Input
                placeholder="Token"
                value={request.auth.token}
                onChange={(e) =>
                  onRequestChange({
                    auth: { ...request.auth, token: e.target.value },
                  })
                }
              />
            )}
          </TabsContent>

          <TabsContent value="body" className="space-y-2">
            <Textarea
              value={request.body}
              onChange={(e) => onRequestChange({ body: e.target.value })}
              placeholder="{}"
              className="font-mono min-h-[200px]"
            />
            <Button
              variant="outline"
              onClick={() => {
                try {
                  const formatted = JSON.stringify(
                    JSON.parse(request.body || ""),
                    null,
                    2
                  );
                  onRequestChange({ body: formatted });
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