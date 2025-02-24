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
import type { ApiRequest, RequestParameter, BodyType, RawFormat } from "@/types/api-request";
import { useToast } from "@/hooks/use-toast";
import { X, Plus } from "lucide-react";
import { useLocation } from "wouter";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
const BODY_TYPES: BodyType[] = ["none", "form-data", "x-www-form-urlencoded", "raw"];
const RAW_FORMATS: RawFormat[] = ["json", "text", "xml", "html"];

interface RequestPanelProps {
  request: ApiRequest;
  onRequestChange: (updates: Partial<ApiRequest>) => void;
  onResponse: (response: any) => void;
  onLoading: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
}

const detectPathVariables = (url: string): RequestParameter[] => {
  const regex = /\{\{([^}]+)\}\}/g;
  const pathVars: RequestParameter[] = [];
  let match;

  while ((match = regex.exec(url)) !== null) {
    pathVars.push({
      key: match[1].trim(),
      value: "",
      enabled: true
    });
  }

  return pathVars;
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

  // Initialize path variables if not present
  useEffect(() => {
    if (!request.pathVariables) {
      onRequestChange({ pathVariables: [] });
    }
  }, []);

  // Path Variables Management
  useEffect(() => {
    const pathVars = detectPathVariables(request.url);
    if (pathVars.length > 0 && request.pathVariables) {
      const existingKeys = new Set(request.pathVariables.map(v => v.key));
      const newVars = pathVars.filter(v => !existingKeys.has(v.key));
      if (newVars.length > 0) {
        onRequestChange({ 
          pathVariables: [...request.pathVariables, ...newVars]
        });
      }
    }
  }, [request.url]);

  const updateUrl = (baseUrl: string) => {
    try {
      if (baseUrl.includes('{{')) {
        onRequestChange({ url: baseUrl });
        return;
      }

      const formattedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
      const url = new URL(formattedUrl);

      // Clear existing query parameters
      url.search = '';

      // Add enabled query parameters
      request.queryParams.forEach(({ key, value, enabled }) => {
        if (key && value && enabled) {
          url.searchParams.append(key, value);
        }
      });

      onRequestChange({ url: url.toString() });
    } catch (e) {
      onRequestChange({ url: baseUrl });
    }
  };

  const addQueryParam = () => {
    onRequestChange({
      queryParams: [...request.queryParams, { key: "", value: "", enabled: true }],
    });
  };

  const removeQueryParam = (index: number) => {
    const newParams = request.queryParams.filter((_, i) => i !== index);
    if (newParams.length === 0) {
      newParams.push({ key: "", value: "", enabled: true });
    }
    onRequestChange({ queryParams: newParams });
  };

  const updateQueryParam = (index: number, field: keyof RequestParameter, value: string | boolean) => {
    const newParams = [...request.queryParams];
    newParams[index] = { ...newParams[index], [field]: value };
    onRequestChange({ queryParams: newParams });

    // Update URL with query parameters
    if (field === "enabled" || (newParams[index].key && newParams[index].value)) {
      try {
        const url = new URL(request.url);
        url.search = '';
        newParams.forEach(({ key, value, enabled }) => {
          if (key && value && enabled) {
            url.searchParams.append(key, value);
          }
        });
        onRequestChange({ url: url.toString() });
      } catch (e) {
        // Invalid URL, skip URL update
      }
    }
  };

  const addPathVariable = () => {
    if (!request.pathVariables) {
      onRequestChange({
        pathVariables: [{ key: "", value: "", enabled: true }],
      });
      return;
    }

    onRequestChange({
      pathVariables: [...request.pathVariables, { key: "", value: "", enabled: true }],
    });
  };

  const removePathVariable = (index: number) => {
    if (!request.pathVariables) return;

    const newPathVars = request.pathVariables.filter((_, i) => i !== index);
    onRequestChange({ pathVariables: newPathVars });
  };

  const updatePathVariable = (index: number, field: keyof RequestParameter, value: string | boolean) => {
    if (!request.pathVariables) return;

    const newPathVars = [...request.pathVariables];
    newPathVars[index] = { ...newPathVars[index], [field]: value };
    onRequestChange({ pathVariables: newPathVars });
  };

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

  const updateHeader = (index: number, field: keyof RequestParameter, value: string | boolean) => {
    const newHeaders = [...request.headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    onRequestChange({ headers: newHeaders });
  };

  const updateBodyType = (type: BodyType) => {
    onRequestChange({
      body: {
        ...request.body,
        type,
        content: type === "raw" ? request.body.content : "",
        formData: type === "form-data" ? [] : undefined,
        urlEncoded: type === "x-www-form-urlencoded" ? [] : undefined,
      },
    });
  };

  const formatBody = () => {
    if (request.body.type !== "raw" || !request.body.content) return;

    try {
      let formatted = request.body.content;
      if (request.body.rawFormat === "json") {
        formatted = JSON.stringify(JSON.parse(request.body.content), null, 2);
      }

      onRequestChange({
        body: {
          ...request.body,
          content: formatted,
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
      if (request.auth.type === "basic" && request.auth.basic) {
        headers["Authorization"] = `Basic ${btoa(
          `${request.auth.basic.username}:${request.auth.basic.password}`
        )}`;
      } else if (request.auth.type === "bearer" && request.auth.bearer) {
        headers["Authorization"] = `Bearer ${request.auth.bearer.token}`;
      }

      let body: string | FormData | undefined;
      if (request.body.type === "raw" && request.body.content) {
        body = request.body.content;
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
            onValueChange={(value) => onRequestChange({ method: value as ApiRequest["method"] })}
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
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Query Parameters</h3>
              {request.queryParams.map((param, index) => (
                <div key={index} className="flex gap-2">
                  <Checkbox
                    checked={param.enabled}
                    onCheckedChange={(checked) =>
                      updateQueryParam(index, "enabled", checked === true)
                    }
                  />
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
                Add Query Parameter
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Path Variables</h3>
              {request.pathVariables?.map((param, index) => (
                <div key={index} className="flex gap-2">
                  <Checkbox
                    checked={param.enabled}
                    onCheckedChange={(checked) =>
                      updatePathVariable(index, "enabled", checked === true)
                    }
                  />
                  <Input
                    placeholder="Variable"
                    value={param.key}
                    onChange={(e) => updatePathVariable(index, "key", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => updatePathVariable(index, "value", e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePathVariable(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button onClick={addPathVariable} variant="outline" className="w-full">
                Add Path Variable
              </Button>
            </div>
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

            {request.auth.type === "basic" && request.auth.basic && (
              <div className="space-y-2">
                <Input
                  placeholder="Username"
                  value={request.auth.basic.username}
                  onChange={(e) =>
                    onRequestChange({
                      auth: { 
                        ...request.auth, 
                        basic: { ...request.auth.basic, username: e.target.value }
                      },
                    })
                  }
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={request.auth.basic.password}
                  onChange={(e) =>
                    onRequestChange({
                      auth: { 
                        ...request.auth, 
                        basic: { ...request.auth.basic, password: e.target.value }
                      },
                    })
                  }
                />
              </div>
            )}

            {request.auth.type === "bearer" && request.auth.bearer && (
              <Input
                placeholder="Token"
                value={request.auth.bearer.token}
                onChange={(e) =>
                  onRequestChange({
                    auth: { 
                      ...request.auth, 
                      bearer: { token: e.target.value }
                    },
                  })
                }
              />
            )}
          </TabsContent>

          <TabsContent value="body" className="space-y-4">
            <Select
              value={request.body.type}
              onValueChange={(value) => updateBodyType(value as BodyType)}
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
                      body: { ...request.body, rawFormat: format as RawFormat },
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
                    value={request.body.content}
                    onChange={(e) =>
                      onRequestChange({
                        body: { ...request.body, content: e.target.value },
                      })
                    }
                    placeholder="Enter request body"
                    className="font-mono min-h-[200px] pl-8"
                  />
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-muted border-r text-right pr-2 text-sm text-muted-foreground select-none">
                    {request.body.content.split('\n').map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                </div>
                <Button variant="outline" onClick={formatBody}>
                  Format {request.body.rawFormat?.toUpperCase()}
                </Button>
              </div>
            )}

            {request.body.type === "form-data" && request.body.formData && (
              <div className="space-y-2">
                {request.body.formData.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Key"
                      value={item.key}
                      onChange={(e) => {
                        const newFormData = [...request.body.formData!];
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
                        const newFormData = [...request.body.formData!];
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
                        const newFormData = request.body.formData!.filter(
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
                      { key: "", value: "", type: "text" as const, enabled: true },
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

            {request.body.type === "x-www-form-urlencoded" && request.body.urlEncoded && (
              <div className="space-y-2">
                {request.body.urlEncoded.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Key"
                      value={item.key}
                      onChange={(e) => {
                        const newUrlEncoded = [...request.body.urlEncoded!];
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
                        const newUrlEncoded = [...request.body.urlEncoded!];
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
                        const newUrlEncoded = request.body.urlEncoded!.filter(
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
                      { key: "", value: "", enabled: true },
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
        </div>
      </CardContent>
    </Card>
  );
}