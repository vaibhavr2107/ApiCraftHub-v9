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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { makeRequest } from "@/lib/api";
import type { ApiRequest, RequestParameter, BodyType, RawFormat } from "@/types/api-request";
import { useToast } from "@/hooks/use-toast";
import { X, Send } from "lucide-react";
import { useLocation } from "wouter";
import { EnvironmentSelector } from "./environment-selector";
import { Environment, EnvironmentStore, DEFAULT_ENVIRONMENTS } from "@/types/environment";

// Import component styles
import "@/styles/request-panel.css";

/**
 * RequestPanel Component
 * Handles the main API request interface including:
 * - URL and method selection
 * - Query parameters
 * - Headers
 * - Request body
 * - Environment selection
 */
export function RequestPanel({
  request,
  onRequestChange,
  onResponse,
  onLoading,
  onError,
}: RequestPanelProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // URL Parameter Detection and Management
  useEffect(() => {
    if (!request.pathVariables) {
      onRequestChange({ pathVariables: [] });
    }
  }, []);

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

  // URL Management Helpers
  const updateUrl = (baseUrl: string) => {
    try {
      if (baseUrl.includes('{{') || baseUrl.includes(':')) {
        onRequestChange({ url: baseUrl });
        return;
      }

      const formattedUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
      const url = new URL(formattedUrl);
      url.search = '';

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

  // Environment Management
  const handleEnvironmentChange = (environment: Environment) => {
    const envStore = localStorage.getItem("environment_store");
    if (!envStore) return;

    try {
      const store: EnvironmentStore = JSON.parse(envStore);

      // Initialize request environments if not present
      if (!store.environments[request.id]) {
        store.environments[request.id] = DEFAULT_ENVIRONMENTS;
      }

      const requestEnvironments = store.environments[request.id];
      const config = requestEnvironments[environment];

      // For dev environment, keep the original URL
      if (environment === 'dev') {
        onRequestChange({
          selectedEnvironment: environment,
          auth: { type: "none" }
        });
        return;
      }

      // Update URL if base URL is configured
      let newUrl = request.url;
      if (config && config.baseUrl) {
        try {
          const currentUrl = new URL(request.url);
          const path = currentUrl.pathname + currentUrl.search;
          newUrl = new URL(path, config.baseUrl).toString();
        } catch (e) {
          // If URL parsing fails, treat it as a relative path
          newUrl = new URL(request.url, config.baseUrl).toString();
        }
      }

      // Update URL, auth, and selected environment in a single change
      onRequestChange({
        url: newUrl,
        auth: config?.bearerToken
          ? { type: "bearer", bearer: { token: config.bearerToken } }
          : { type: "none" },
        selectedEnvironment: environment
      });

      // Update environment store with the new request-specific configuration
      store.requestConfigs[request.id] = environment;
      localStorage.setItem("environment_store", JSON.stringify(store));

    } catch (e) {
      console.error("Error processing environment change:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update environment configuration"
      });
    }
  };

  // Request Execution
  const handleSend = async () => {
    onLoading(true);
    onError(null);
    const startTime = performance.now();

    try {
      // Process headers
      const headers: Record<string, string> = {};
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

      // Wrap makeRequest in Promise.resolve to ensure all rejections are caught
      const response = await Promise.resolve().then(() =>
        makeRequest({
          method: request.method,
          url: processedUrl,
          body,
          headers,
        })
      );


      const endTime = performance.now();
      const responseTime = endTime - startTime;

      onResponse({
        ...response,
        time: responseTime
      });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : "An error occurred";
      onError(message);
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: message,
      });
    } finally {
      onLoading(false);
    }
  };

  const handleAddQueryParam = () => {
    const newParams = [...request.queryParams, { key: "", value: "", enabled: true }];
    onRequestChange({ queryParams: newParams });
    updateUrlWithParams(newParams);
  };

  const handleRemoveQueryParam = (index: number) => {
    const newParams = request.queryParams.filter((_, i) => i !== index);
    if (newParams.length === 0) {
      newParams.push({ key: "", value: "", enabled: true });
    }
    onRequestChange({ queryParams: newParams });
    updateUrlWithParams(newParams);
  };

  const handleUpdateQueryParam = (index: number, field: keyof RequestParameter, value: string | boolean) => {
    const newParams = [...request.queryParams];
    newParams[index] = { ...newParams[index], [field]: value };
    onRequestChange({ queryParams: newParams });

    // Update URL with query parameters
    if (field === "enabled" || (newParams[index].key && newParams[index].value)) {
      updateUrlWithParams(newParams);
    }
  };

  const handleAddPathVariable = () => {
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

  const handleRemovePathVariable = (index: number) => {
    if (!request.pathVariables) return;

    const newPathVars = request.pathVariables.filter((_, i) => i !== index);
    onRequestChange({ pathVariables: newPathVars });
  };

  const handleUpdatePathVariable = (index: number, field: keyof RequestParameter, value: string | boolean) => {
    if (!request.pathVariables) return;

    const newPathVars = [...request.pathVariables];
    newPathVars[index] = { ...newPathVars[index], [field]: value };
    onRequestChange({ pathVariables: newPathVars });
  };

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

  const handleUpdateHeader = (index: number, field: "key" | "value" | "enabled", value: string | boolean) => {
    const newHeaders = [...request.headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    onRequestChange({ headers: newHeaders });
  };

  const handleAddHeader = () => {
    onRequestChange({ headers: [...request.headers, { key: "", value: "", enabled: true }] });
  };

  const handleRemoveHeader = (index: number) => {
    const newHeaders = request.headers.filter((_, i) => i !== index);
    onRequestChange({ headers: newHeaders });
  };

  const handleUpdateBodyType = (type: BodyType) => {
    const newBody = {
      type,
      rawFormat: type === "raw" ? request.body.rawFormat || "json" : undefined,
      content: type === "raw" ? request.body.content || "" : undefined,
      formData: type === "form-data" ? [{ key: "", value: "", type: "text" as const, enabled: true }] : undefined,
      urlEncoded: type === "x-www-form-urlencoded" ? [{ key: "", value: "", enabled: true }] : undefined
    };

    onRequestChange({ body: newBody });
  };

  const handleFormatBody = () => {
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


  const ParametersSection = ({title, parameters, onAdd, onRemove, onChange}: any) => (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="space-y-2">
        {parameters.map((param:any, index:number) => (
          <div key={index} className="flex items-center gap-2">
            <Checkbox
              checked={param.enabled}
              onCheckedChange={(checked) =>
                onChange(index, "enabled", checked === true)
              }
            />
            <Input
              placeholder="Key"
              value={param.key}
              onChange={(e) => onChange(index, "key", e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Value"
              value={param.value}
              onChange={(e) => onChange(index, "value", e.target.value)}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button onClick={onAdd} variant="outline" size="sm" className="w-full">
          Add {title.replace('Parameters', '').trim()}
        </Button>
      </div>
    </div>
  );

  const AuthorizationSection = ({ auth, onChange }: any) => (
    <div className="space-y-4">
      <Select
        value={auth.type}
        onValueChange={(value: "none" | "basic" | "bearer") =>
          onChange({
            type: value,
            basic: value === "basic" ? { username: "", password: "" } : undefined,
            bearer: value === "bearer" ? { token: "" } : undefined,
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

      {auth.type === "basic" && (
        <div className="space-y-2">
          <Input
            placeholder="Username"
            value={auth.basic?.username || ""}
            onChange={(e) =>
              onChange({
                ...auth,
                basic: {
                  ...auth.basic,
                  username: e.target.value,
                },
              })
            }
          />
          <Input
            type="password"
            placeholder="Password"
            value={auth.basic?.password || ""}
            onChange={(e) =>
              onChange({
                ...auth,
                basic: {
                  ...auth.basic,
                  password: e.target.value,
                },
              })
            }
          />
        </div>
      )}

      {auth.type === "bearer" && (
        <Input
          placeholder="Bearer Token"
          value={auth.bearer?.token || ""}
          onChange={(e) =>
            onChange({
              ...auth,
              bearer: { token: e.target.value },
            })
          }
        />
      )}
    </div>
  );

  const HeadersSection = ({ headers, onAdd, onRemove, onChange }: any) => (
    <div className="space-y-4">
      {headers.map((header: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <Checkbox
            checked={header.enabled}
            onCheckedChange={(checked) =>
              onChange(index, "enabled", checked === true)
            }
          />
          <Input
            placeholder="Header"
            value={header.key}
            onChange={(e) => onChange(index, "key", e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Value"
            value={header.value}
            onChange={(e) => onChange(index, "value", e.target.value)}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button onClick={onAdd} variant="outline" size="sm" className="w-full">
        Add Header
      </Button>
    </div>
  );

  const RequestBodySection = ({ body, onChange, onFormat }: any) => (
    <div className="space-y-4">
      <div className="flex items-center gap-4 py-2 border-b">
        <RadioGroup
          value={body.type}
          onValueChange={(value) => handleUpdateBodyType(value as BodyType)}
          className="flex items-center gap-4"
        >
          {BODY_TYPES.map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <RadioGroupItem value={type} id={`body-type-${type}`} />
              <Label htmlFor={`body-type-${type}`}>{type}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {body.type === "raw" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <RadioGroup
              value={body.rawFormat}
              onValueChange={(format) =>
                onChange({ ...body, rawFormat: format as RawFormat })
              }
              className="flex items-center gap-4"
            >
              {RAW_FORMATS.map((format) => (
                <div key={format} className="flex items-center space-x-2">
                  <RadioGroupItem value={format} id={`format-${format}`} />
                  <Label htmlFor={`format-${format}`}>{format.toUpperCase()}</Label>
                </div>
              ))}
            </RadioGroup>
            <Button 
              onClick={onFormat} 
              variant="outline"
              size="sm"
              className="ml-auto"
            >
              Beautify
            </Button>
          </div>
          <div className="relative border rounded-md">
            <Textarea
              value={body.content}
              onChange={(e) =>
                onChange({ ...body, content: e.target.value })
              }
              placeholder="Enter request body"
              className="font-['Courier_New'] min-h-[200px] pl-12 pt-2 resize-y"
              style={{
                tabSize: 2,
                fontFamily: "Courier New, monospace"
              }}
            />
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-muted/50 border-r select-none">
              {body.content.split('\n').map((_, i) => (
                <div 
                  key={i}
                  className="text-right pr-2 text-sm text-muted-foreground leading-6"
                  style={{ height: "24px" }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {body.type === "form-data" && body.formData && (
        <div className="space-y-2">
          {body.formData.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Key"
                value={item.key}
                onChange={(e) => {
                  const newFormData = [...body.formData!];
                  newFormData[index] = { ...item, key: e.target.value };
                  onChange({ ...body, formData: newFormData });
                }}
                className="flex-1"
              />
              <Input
                placeholder="Value"
                value={item.value}
                onChange={(e) => {
                  const newFormData = [...body.formData!];
                  newFormData[index] = { ...item, value: e.target.value };
                  onChange({ ...body, formData: newFormData });
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newFormData = body.formData!.filter(
                    (_, i) => i !== index
                  );
                  onChange({ ...body, formData: newFormData });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            onClick={() => {
              const newFormData = [
                ...(body.formData || []),
                { key: "", value: "", type: "text" as const, enabled: true },
              ];
              onChange({ ...body, formData: newFormData });
            }}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Add Form Field
          </Button>
        </div>
      )}

      {body.type === "x-www-form-urlencoded" && body.urlEncoded && (
        <div className="space-y-2">
          {body.urlEncoded.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Key"
                value={item.key}
                onChange={(e) => {
                  const newUrlEncoded = [...body.urlEncoded!];
                  newUrlEncoded[index] = { ...item, key: e.target.value };
                  onChange({ ...body, urlEncoded: newUrlEncoded });
                }}
                className="flex-1"
              />
              <Input
                placeholder="Value"
                value={item.value}
                onChange={(e) => {
                  const newUrlEncoded = [...body.urlEncoded!];
                  newUrlEncoded[index] = { ...item, value: e.target.value };
                  onChange({ ...body, urlEncoded: newUrlEncoded });
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newUrlEncoded = body.urlEncoded!.filter(
                    (_, i) => i !== index
                  );
                  onChange({ ...body, urlEncoded: newUrlEncoded });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            onClick={() => {
              const newUrlEncoded = [
                ...(body.urlEncoded || []),
                { key: "", value: "", enabled: true },
              ];
              onChange({ ...body, urlEncoded: newUrlEncoded });
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
  );

  // Render Component
  return (
    <div className="request-panel">
      <div className="request-header">
        <div className="request-header-content">
          <Select
            value={request.method}
            onValueChange={(value) => onRequestChange({ method: value as ApiRequest["method"] })}
          >
            <SelectTrigger className="request-method-select">
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
          <div className="request-url-container">
            <Input
              value={request.url}
              onChange={(e) => updateUrl(e.target.value)}
              placeholder="Enter URL"
              className="request-url-input"
            />
            <Button onClick={handleSend} size="sm" className="h-9">
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
            <EnvironmentSelector
              selectedEnvironment={request.selectedEnvironment}
              requestId={request.id}
              onEnvironmentChange={handleEnvironmentChange}
            />
          </div>
        </div>
      </div>

      {/* Request Configuration Tabs */}
      <Tabs defaultValue="params" className="request-tabs">
        <div className="request-tabs-header">
          <TabsList className="p-0 h-auto bg-transparent border-b-0">
            <TabsTrigger value="params" className="tab-trigger">
              Params
            </TabsTrigger>
            <TabsTrigger value="auth" className="tab-trigger">
              Authorization
            </TabsTrigger>
            <TabsTrigger value="headers" className="tab-trigger">
              Headers
            </TabsTrigger>
            <TabsTrigger value="body" className="tab-trigger">
              Body
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {/* Parameters Tab */}
          <TabsContent value="params" className="p-4 space-y-6">
            {/* Query Parameters Section */}
            <ParametersSection
              title="Query Parameters"
              parameters={request.queryParams}
              onAdd={handleAddQueryParam}
              onRemove={handleRemoveQueryParam}
              onChange={handleUpdateQueryParam}
            />

            {/* Path Variables Section */}
            <ParametersSection
              title="Path Variables"
              parameters={request.pathVariables || []}
              onAdd={handleAddPathVariable}
              onRemove={handleRemovePathVariable}
              onChange={handleUpdatePathVariable}
            />
          </TabsContent>

          {/* Authorization Tab */}
          <TabsContent value="auth" className="p-4">
            <AuthorizationSection
              auth={request.auth}
              onChange={(updates) => onRequestChange({ auth: updates })}
            />
          </TabsContent>

          {/* Headers Tab */}
          <TabsContent value="headers" className="p-4">
            <HeadersSection
              headers={request.headers}
              onAdd={handleAddHeader}
              onRemove={handleRemoveHeader}
              onChange={handleUpdateHeader}
            />
          </TabsContent>

          {/* Body Tab */}
          <TabsContent value="body" className="p-4">
            <RequestBodySection
              body={request.body}
              onChange={(updates) => onRequestChange({ body: updates })}
              onFormat={handleFormatBody}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

interface RequestPanelProps {
  request: ApiRequest;
  onRequestChange: (updates: Partial<ApiRequest>) => void;
  onResponse: (response: any) => void;
  onLoading: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
const BODY_TYPES: BodyType[] = ["none", "form-data", "x-www-form-urlencoded", "raw"];
const RAW_FORMATS: RawFormat[] = ["json", "text", "xml", "html"];