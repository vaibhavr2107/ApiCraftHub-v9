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
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { makeRequest } from "@/lib/api";
import type { ResponseData, SavedRequest, QueryParam, Header, BodyConfig } from "@/types/request";
import { useToast } from "@/hooks/use-toast";
import { X, Plus } from "lucide-react";
import { useLocation } from "wouter";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const BODY_TYPES = ["none", "form-data", "x-www-form-urlencoded", "raw"] as const;
const RAW_FORMATS = ["json", "text", "html", "xml", "javascript"] as const;

interface RequestPanelProps {
  request: SavedRequest;
  onRequestChange: (updates: Partial<SavedRequest>) => void;
  onResponse: (response: ResponseData) => void;
  onLoading: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
}

const validateAndFormatUrl = (url: string): string => {
  if (!url) return url;

  // If URL starts with {{, it might contain variables, return as is
  if (url.startsWith('{{')) return url;

  // Check if URL starts with http:// or https://
  if (!url.match(/^https?:\/\//i)) {
    // Add https:// as default
    return `https://${url}`;
  }

  return url;
};

export function RequestPanel({
  request,
  onRequestChange,
  onResponse,
  onLoading,
  onError,
}: RequestPanelProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // URL and Query Parameters Synchronization
  useEffect(() => {
    try {
      // Only process URL if it doesn't contain variables
      if (!request.url.includes('{{')) {
        const url = new URL(validateAndFormatUrl(request.url));
        const params: QueryParam[] = Array.from(url.searchParams.entries()).map(
          ([key, value]) => ({ key, value })
        );

        if (params.length === 0) {
          params.push({ key: "", value: "" });
        }

        onRequestChange({ queryParams: params });
      }
    } catch (e) {
      // Invalid URL or contains variables, keep existing query params
      console.log('URL processing skipped:', e);
    }
  }, [request.url, onRequestChange]);

  const updateUrl = (baseUrl: string) => {
    try {
      // Don't process URL if it contains variables
      if (baseUrl.includes('{{')) {
        onRequestChange({ url: baseUrl });
        return;
      }

      const formattedUrl = validateAndFormatUrl(baseUrl);
      const url = new URL(formattedUrl);

      // Add query parameters if they exist
      request.queryParams.forEach(({ key, value }) => {
        if (key && value) {
          url.searchParams.set(key, value);
        }
      });
      onRequestChange({ url: url.toString() });
    } catch (e) {
      // If URL is invalid, store it as is
      onRequestChange({ url: baseUrl });
    }
  };

  // Headers Management
  const addHeader = () => {
    onRequestChange({
      headers: [...request.headers, { key: "", value: "", enabled: true }],
    });
  };

  const removeHeader = (index: number) => {
    onRequestChange({
      headers: request.headers.filter((_, i) => i !== index),
    });
  };

  const updateHeader = (index: number, field: keyof Header, value: string | boolean) => {
    const newHeaders = [...request.headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    onRequestChange({ headers: newHeaders });
  };

  // Query Parameters Management
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

    try {
      const url = new URL(request.url);
      url.search = '';
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

  // Body Management
  const updateBodyType = (type: BodyConfig["type"]) => {
    onRequestChange({
      body: {
        ...request.body,
        type,
        raw: type === "raw" ? request.body.raw || "" : undefined,
        formData: type === "form-data" ? [] : undefined,
        urlEncoded: type === "x-www-form-urlencoded" ? [] : undefined,
      },
    });
  };

  const formatBody = () => {
    if (request.body.type !== "raw" || !request.body.raw) return;

    try {
      let formatted = request.body.raw;
      if (request.body.rawFormat === "json") {
        formatted = JSON.stringify(JSON.parse(request.body.raw), null, 2);
      }
      // Add more formatters for other content types if needed

      onRequestChange({
        body: {
          ...request.body,
          raw: formatted,
        },
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Format Error",
        description: "Invalid format for the selected content type",
      });
    }
  };

  const handleSend = async () => {
    onLoading(true);
    onError(null);

    try {
      const headers: Record<string, string> = {};

      // Add enabled headers
      request.headers
        .filter((h) => h.enabled && h.key && h.value)
        .forEach((h) => {
          headers[h.key] = h.value;
        });

      // Add auth headers
      if (request.auth.type === "basic" && request.auth.username && request.auth.password) {
        headers["Authorization"] = `Basic ${btoa(
          `${request.auth.username}:${request.auth.password}`
        )}`;
      } else if (request.auth.type === "bearer" && request.auth.token) {
        headers["Authorization"] = `Bearer ${request.auth.token}`;
      }

      let body: string | FormData | undefined;
      if (request.body.type === "raw" && request.body.raw) {
        body = request.body.raw;
      } else if (request.body.type === "form-data" && request.body.formData) {
        const formData = new FormData();
        request.body.formData.forEach(({ key, value }) => {
          formData.append(key, value);
        });
        body = formData;
      } else if (request.body.type === "x-www-form-urlencoded" && request.body.urlEncoded) {
        const params = new URLSearchParams();
        request.body.urlEncoded.forEach(({ key, value }) => {
          params.append(key, value);
        });
        body = params.toString();
      }

      const response = await makeRequest({
        method: request.method,
        url: request.url,
        body,
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="params">Params</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
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

          <TabsContent value="headers" className="space-y-4">
            {request.headers.map((header, index) => (
              <div key={index} className="flex items-center gap-2">
                <Checkbox
                  checked={header.enabled}
                  onCheckedChange={(checked) =>
                    updateHeader(index, "enabled", checked === true)
                  }
                />
                <Input
                  placeholder="Header"
                  value={header.key}
                  onChange={(e) => updateHeader(index, "key", e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => updateHeader(index, "value", e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeHeader(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button onClick={addHeader} variant="outline" className="w-full">
              Add Header
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

          <TabsContent value="body" className="space-y-4">
            <Select
              value={request.body.type}
              onValueChange={(value) => updateBodyType(value as BodyConfig["type"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Body Type" />
              </SelectTrigger>
              <SelectContent>
                {BODY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {request.body.type === "raw" && (
              <div className="space-y-2">
                <Select
                  value={request.body.rawFormat}
                  onValueChange={(format) =>
                    onRequestChange({
                      body: { ...request.body, rawFormat: format as BodyConfig["rawFormat"] },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    {RAW_FORMATS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {format.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Textarea
                    value={request.body.raw}
                    onChange={(e) =>
                      onRequestChange({
                        body: { ...request.body, raw: e.target.value },
                      })
                    }
                    placeholder="Enter request body"
                    className="font-mono min-h-[200px] pl-8"
                  />
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-muted border-r text-right pr-2 text-sm text-muted-foreground select-none">
                    {request.body.raw?.split('\n').map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                </div>
                <Button variant="outline" onClick={formatBody}>
                  Format {request.body.rawFormat?.toUpperCase()}
                </Button>
              </div>
            )}

            {request.body.type === "form-data" && (
              <div className="space-y-2">
                {(request.body.formData || []).map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Key"
                      value={item.key}
                      onChange={(e) => {
                        const newFormData = [...(request.body.formData || [])];
                        newFormData[index] = { ...item, key: e.target.value };
                        onRequestChange({
                          body: { ...request.body, formData: newFormData },
                        });
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={item.value}
                      onChange={(e) => {
                        const newFormData = [...(request.body.formData || [])];
                        newFormData[index] = { ...item, value: e.target.value };
                        onRequestChange({
                          body: { ...request.body, formData: newFormData },
                        });
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newFormData = (request.body.formData || []).filter(
                          (_, i) => i !== index
                        );
                        onRequestChange({
                          body: { ...request.body, formData: newFormData },
                        });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const newFormData = [
                      ...(request.body.formData || []),
                      { key: "", value: "", type: "text" as const },
                    ];
                    onRequestChange({
                      body: { ...request.body, formData: newFormData },
                    });
                  }}
                  className="w-full"
                >
                  Add Form Field
                </Button>
              </div>
            )}

            {request.body.type === "x-www-form-urlencoded" && (
              <div className="space-y-2">
                {(request.body.urlEncoded || []).map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Key"
                      value={item.key}
                      onChange={(e) => {
                        const newUrlEncoded = [...(request.body.urlEncoded || [])];
                        newUrlEncoded[index] = { ...item, key: e.target.value };
                        onRequestChange({
                          body: { ...request.body, urlEncoded: newUrlEncoded },
                        });
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={item.value}
                      onChange={(e) => {
                        const newUrlEncoded = [...(request.body.urlEncoded || [])];
                        newUrlEncoded[index] = { ...item, value: e.target.value };
                        onRequestChange({
                          body: { ...request.body, urlEncoded: newUrlEncoded },
                        });
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newUrlEncoded = (request.body.urlEncoded || []).filter(
                          (_, i) => i !== index
                        );
                        onRequestChange({
                          body: { ...request.body, urlEncoded: newUrlEncoded },
                        });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const newUrlEncoded = [
                      ...(request.body.urlEncoded || []),
                      { key: "", value: "" },
                    ];
                    onRequestChange({
                      body: { ...request.body, urlEncoded: newUrlEncoded },
                    });
                  }}
                  className="w-full"
                >
                  Add URL Encoded Field
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Button onClick={handleSend} className="w-full">
            Send Request
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLocation(`/request/${request.id}`)}
          >
            Go to Route Page
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}