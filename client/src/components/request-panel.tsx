import { Card } from "@/components/ui/card";
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
import { X, Send, Play } from "lucide-react";
import { useLocation } from "wouter";
import { EnvironmentSelector } from "./environment-selector";
import { Environment, EnvironmentStore } from "@/types/environment";

// Detect path variables in URL
const detectPathVariables = (url: string): RequestParameter[] => {
  // Match both {{variable}} and :variable formats
  const regex = /(?:\{\{([^}]+)\}\})|:([a-zA-Z][a-zA-Z0-9_]*)/g;
  const pathVars: RequestParameter[] = [];
  const seen = new Set<string>();
  let match;

  while ((match = regex.exec(url)) !== null) {
    const varName = match[1] || match[2]; // match[1] for {{var}}, match[2] for :var
    if (!seen.has(varName)) {
      seen.add(varName);
      pathVars.push({
        key: varName.trim(),
        value: "",
        enabled: true
      });
    }
  }

  return pathVars;
};

// Replace path variables in URL with their values
const replacePathVariables = (url: string, pathVariables: RequestParameter[]): string => {
  let processedUrl = url;
  pathVariables.forEach(variable => {
    if (variable.enabled && variable.value) {
      // Replace both formats with the value
      processedUrl = processedUrl
        .replace(new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g'), variable.value)
        .replace(new RegExp(`:${variable.key}\\b`, 'g'), variable.value);
    }
  });
  return processedUrl;
};

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

  // Path Variables Detection
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

  // Update URL when query parameters change
  const updateUrlWithParams = (queryParams: RequestParameter[]) => {
    try {
      const url = new URL(request.url);
      url.search = '';
      queryParams.forEach(({ key, value, enabled }) => {
        if (key && value && enabled) {
          url.searchParams.append(key, value);
        }
      });
      onRequestChange({ url: url.toString() });
    } catch (e) {
      // Invalid URL or contains variables, skip update
    }
  };

  const updateUrl = (baseUrl: string) => {
    try {
      if (baseUrl.includes('{{') || baseUrl.includes(':')) {
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
    const newParams = [...request.queryParams, { key: "", value: "", enabled: true }];
    onRequestChange({ queryParams: newParams });
    updateUrlWithParams(newParams);
  };

  const removeQueryParam = (index: number) => {
    const newParams = request.queryParams.filter((_, i) => i !== index);
    if (newParams.length === 0) {
      newParams.push({ key: "", value: "", enabled: true });
    }
    onRequestChange({ queryParams: newParams });
    updateUrlWithParams(newParams);
  };

  const updateQueryParam = (index: number, field: keyof RequestParameter, value: string | boolean) => {
    const newParams = [...request.queryParams];
    newParams[index] = { ...newParams[index], [field]: value };
    onRequestChange({ queryParams: newParams });

    // Update URL with query parameters
    if (field === "enabled" || (newParams[index].key && newParams[index].value)) {
      updateUrlWithParams(newParams);
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

  const handleSend = async () => {
    onLoading(true);
    onError(null);
    const startTime = performance.now();

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
        const { username, password } = request.auth.basic;
        const base64Credentials = btoa(`${username}:${password}`);
        headers["Authorization"] = `Basic ${base64Credentials}`;
      } else if (request.auth.type === "bearer" && request.auth.bearer) {
        const { token } = request.auth.bearer;
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Process URL with path variables
      const processedUrl = request.pathVariables ?
        replacePathVariables(request.url, request.pathVariables) :
        request.url;

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
        url: processedUrl,
        body,
        headers,
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Calculate response size
      const responseSize = new TextEncoder().encode(JSON.stringify(response.data)).length;

      onResponse({
        ...response,
        time: responseTime,
        size: responseSize
      });
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

  const updateHeader = (index: number, field: "key" | "value" | "enabled", value: string | boolean) => {
    const newHeaders = [...request.headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    onRequestChange({ headers: newHeaders });
  };

  const addHeader = () => {
    onRequestChange({ headers: [...request.headers, { key: "", value: "", enabled: true }] });
  };

  const removeHeader = (index: number) => {
    const newHeaders = request.headers.filter((_, i) => i !== index);
    onRequestChange({ headers: newHeaders });
  };


  const updateBodyType = (type: BodyType) => {
    const newBody = {
      type,
      rawFormat: type === "raw" ? request.body.rawFormat || "json" : undefined,
      content: type === "raw" ? request.body.content || "" : undefined,
      formData: type === "form-data" ? [{ key: "", value: "", type: "text" as const, enabled: true }] : undefined,
      urlEncoded: type === "x-www-form-urlencoded" ? [{ key: "", value: "", enabled: true }] : undefined
    };

    onRequestChange({ body: newBody });
  };

  const formatBody = () => {
    if (request.body.type !== "raw" || !request.body.content) return;

    try {
      let formatted = request.body.content;
      if (request.body.rawFormat === "json") {
        formatted = JSON.stringify(JSON.parse(request.body.content), null, 2);
      }
      // Add XML formatting if needed later

      onRequestChange({
        body: { ...request.body, content: formatted }
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Formatting Error",
        description: "Invalid content format"
      });
    }
  };

  const handleEnvironmentChange = (environment: Environment) => {
    const envStore = localStorage.getItem("environment_store");
    if (!envStore) return;

    try {
      const store: EnvironmentStore = JSON.parse(envStore);
      const config = store.environments[environment];

      // Update the URL if it's a relative path or matches any environment's baseUrl
      let newUrl = request.url;
      try {
        const currentUrl = new URL(request.url);
        const isRelative = !request.url.startsWith('http');
        const matchesEnvUrl = Object.values(store.environments).some(
          env => request.url.startsWith(env.baseUrl)
        );

        if (isRelative || matchesEnvUrl) {
          const path = currentUrl.pathname + currentUrl.search;
          newUrl = new URL(path, config.baseUrl).toString();
        }
      } catch (e) {
        // If URL parsing fails, treat it as a relative path
        newUrl = new URL(request.url, config.baseUrl).toString();
      }

      // Update URL and auth in a single change
      onRequestChange({
        url: newUrl,
        auth: config.bearerToken ? { type: "bearer", bearer: { token: config.bearerToken } } : { type: "none" }
      });

    } catch (e) {
      console.error("Error processing environment change:", e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/95">
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center gap-2">
          <Select
            value={request.method}
            onValueChange={(value) => onRequestChange({ method: value as ApiRequest["method"] })}
          >
            <SelectTrigger className="w-[100px] h-9 bg-background">
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
          <div className="flex-1 flex gap-2">
            <Input
              value={request.url}
              onChange={(e) => updateUrl(e.target.value)}
              placeholder="Enter URL"
              className="flex-1 h-9 font-mono text-sm"
            />
            <Button onClick={handleSend} size="sm" className="h-9">
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
            <EnvironmentSelector onEnvironmentChange={handleEnvironmentChange} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="params" className="flex-1">
        <div className="border-b bg-muted/40">
          <TabsList className="p-0 h-auto bg-transparent border-b-0">
            <TabsTrigger value="params" className="data-[state=active]:bg-background rounded-none border-b-2 data-[state=active]:border-primary">
              Params
            </TabsTrigger>
            <TabsTrigger value="auth" className="data-[state=active]:bg-background rounded-none border-b-2 data-[state=active]:border-primary">
              Authorization
            </TabsTrigger>
            <TabsTrigger value="headers" className="data-[state=active]:bg-background rounded-none border-b-2 data-[state=active]:border-primary">
              Headers
            </TabsTrigger>
            <TabsTrigger value="body" className="data-[state=active]:bg-background rounded-none border-b-2 data-[state=active]:border-primary">
              Body
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="params" className="p-0 m-0 h-full">
            <div className="p-4 space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Query Parameters</h3>
                <div className="space-y-2">
                  {request.queryParams.map((param, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Checkbox
                        checked={param.enabled}
                        onCheckedChange={(checked) =>
                          updateQueryParam(index, "enabled", checked === true)
                        }
                      />
                      <Input
                        placeholder="Key"
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
                  <Button onClick={addQueryParam} variant="outline" size="sm" className="w-full">
                    Add Query Parameter
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Path Variables</h3>
                <div className="space-y-2">
                  {request.pathVariables?.map((param, index) => (
                    <div key={index} className="flex items-center gap-2">
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
                  <Button onClick={addPathVariable} variant="outline" size="sm" className="w-full">
                    Add Path Variable
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="auth" className="p-0 m-0 h-full">
            <div className="p-4 space-y-4">
              <Select
                value={request.auth.type}
                onValueChange={(value: "none" | "basic" | "bearer") =>
                  onRequestChange({
                    auth: value === "basic"
                      ? { type: "basic", basic: { username: "", password: "" } }
                      : value === "bearer"
                      ? { type: "bearer", bearer: { token: "" } }
                      : { type: "none" }
                  })
                }
              >
                <SelectTrigger className="w-full">
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
                    value={request.auth.basic?.username || ""}
                    onChange={(e) =>
                      onRequestChange({
                        auth: {
                          ...request.auth,
                          basic: {
                            ...request.auth.basic,
                            username: e.target.value,
                            password: request.auth.basic?.password || ""
                          }
                        },
                      })
                    }
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={request.auth.basic?.password || ""}
                    onChange={(e) =>
                      onRequestChange({
                        auth: {
                          ...request.auth,
                          basic: {
                            ...request.auth.basic,
                            username: request.auth.basic?.username || "",
                            password: e.target.value
                          }
                        },
                      })
                    }
                  />
                </div>
              )}

              {request.auth.type === "bearer" && (
                <Input
                  placeholder="Bearer Token"
                  value={request.auth.bearer?.token || ""}
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
            </div>
          </TabsContent>

          <TabsContent value="headers" className="p-0 m-0 h-full">
            <div className="p-4 space-y-4">
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
              <Button onClick={addHeader} variant="outline" size="sm" className="w-full">
                Add Header
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="body" className="p-0 m-0 h-full">
            <div className="p-4 space-y-4">
              <Select
                value={request.body.type}
                onValueChange={(value) => updateBodyType(value as BodyType)}
              >
                <SelectTrigger className="w-full">
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
                    <SelectTrigger className="w-full">
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
                  <Button onClick={formatBody} variant="outline">
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
                    onClick={() => {
                      const newFormData = [
                        ...(request.body.formData || []),
                        { key: "", value: "", type: "text" as const, enabled: true },
                      ];
                      onRequestChange({
                        body: { ...request.body, formData: newFormData },
                      });
                    }}
                    variant="outline"
                    size="sm"
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
                    onClick={() => {
                      const newUrlEncoded = [
                        ...(request.body.urlEncoded || []),
                        { key: "", value: "", enabled: true },
                      ];
                      onRequestChange({
                        body: { ...request.body, urlEncoded: newUrlEncoded },
                      });
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    Add URL Encoded Field
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}