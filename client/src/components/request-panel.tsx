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
import {RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { makeRequest } from "@/lib/api";
import type { Request, RequestHistory } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Save, Send, History, X, ChevronDown, ChevronRight, Settings } from "lucide-react";

const ENVIRONMENTS = ['dev', 'qa01', 'qa02', 'qa03', 'perf'] as const;

// Updated interface for environment URL dialog
interface EnvironmentUrlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: Request;
  onUpdate: (updates: Partial<Request>) => void;
}

// Environment URL Dialog Component
function EnvironmentUrlDialog({ isOpen, onClose, request, onUpdate }: EnvironmentUrlDialogProps) {
  const [urls, setUrls] = useState({
    devUrl: request.devUrl || '',
    qa01Url: request.qa01Url || '',
    qa02Url: request.qa02Url || '',
    qa03Url: request.qa03Url || '',
    perfUrl: request.perfUrl || '',
  });

  // Utility function to mask response values while preserving structure
  const maskResponseValues = (data: any): any => {
    if (data === null || data === undefined) {
      return data;
    }
    
    if (Array.isArray(data)) {
      // For arrays, mask each item (but keep a small sample)
      const sampleSize = Math.min(data.length, 3);
      return Array(sampleSize).fill(0).map((_, i) => maskResponseValues(data[i]));
    }
    
    if (typeof data === 'object') {
      // For objects, preserve keys but mask values
      const result: Record<string, any> = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = maskResponseValues(data[key]);
        }
      }
      return result;
    }
    
    // Mask primitive values based on their type
    if (typeof data === 'string') {
      if (data.length > 30) return data.substring(0, 10) + '...';
      return data.replace(/./g, '*'); // Mask all characters
    }
    if (typeof data === 'number') return 0;
    if (typeof data === 'boolean') return false;
    
    return data; // Return as is for other types
  };

  const handleSave = () => {
    onUpdate({
      ...urls
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Environment URLs</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {ENVIRONMENTS.map((env) => (
            <div key={env} className="grid gap-2">
              <Label htmlFor={`${env}Url`}>{env.toUpperCase()} URL</Label>
              <Input
                id={`${env}Url`}
                value={urls[`${env}Url` as keyof typeof urls]}
                onChange={(e) =>
                  setUrls((prev) => ({
                    ...prev,
                    [`${env}Url`]: e.target.value,
                  }))
                }
                placeholder={`Enter ${env.toUpperCase()} URL`}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// History Section Component
const HistorySection = ({ history }: { history: RequestHistory[] }) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  if (!history || history.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No request history available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry, index) => (
        <Card key={index} className="p-4">
          <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={() => toggleExpand(index)}>
            <div className="flex items-center">
              {expandedItems.has(index) ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              <span className={`font-semibold ${getMethodColor(entry.method)}`}>
                {entry.method}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                {new Date(entry.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {entry.responseTime.toFixed(0)}ms
            </div>
          </div>
          <div className="text-sm break-all">{entry.url}</div>
          {expandedItems.has(index) && (
            <>
              {entry.requestBody && Object.keys(entry.requestBody).length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-medium text-muted-foreground">Request Body:</div>
                  <pre className="mt-1 text-sm bg-muted p-2 rounded-md overflow-auto">
                    {JSON.stringify(entry.requestBody, null, 2)}
                  </pre>
                </div>
              )}
              {entry.responseFields && (
                <div className="mt-2">
                  <div className="text-sm font-medium text-muted-foreground">Response:</div>
                  <pre className="mt-1 text-sm bg-muted p-2 rounded-md overflow-auto">
                    {JSON.stringify(entry.responseFields, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </Card>
      ))}
    </div>
  );
};

// Method color mapping
const METHOD_COLORS = {
  GET: "text-green-500",
  POST: "text-orange-500",
  PUT: "text-blue-500",
  DELETE: "text-red-500",
  PATCH: "text-purple-500",
  HEAD: "text-gray-500",
  OPTIONS: "text-gray-400"
} as const;

type HttpMethod = keyof typeof METHOD_COLORS;

const getMethodColor = (method: string): string => {
  return METHOD_COLORS[method as HttpMethod] || "text-gray-500";
};


interface RequestPanelProps {
  request: Request;
  onRequestChange: (updates: Partial<Request>) => void;
  onResponse: (response: any) => void;
  onLoading: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
}

interface Parameter {
  key: string;
  value: string;
  enabled: boolean;
}

const BODY_TYPES = ["none", "raw", "form-data", "x-www-form-urlencoded"] as const;
const RAW_FORMATS = ["json", "text", "xml", "html"] as const;

export function RequestPanel({
  request,
  onRequestChange,
  onResponse,
  onLoading,
  onError,
}: RequestPanelProps) {
  const { toast } = useToast();
  const [queryParams, setQueryParams] = useState<Parameter[]>([]);
  const [pathParams, setPathParams] = useState<Parameter[]>([]);
  const [headers, setHeaders] = useState<Parameter[]>([]);
  const [bodyType, setBodyType] = useState<typeof BODY_TYPES[number]>("none");
  const [rawFormat, setRawFormat] = useState<typeof RAW_FORMATS[number]>("json");
  const [rawBody, setRawBody] = useState("");
  const [formData, setFormData] = useState<Array<{ key: string; value: string; type: "text" | "file"; enabled: boolean }>>([]);
  const [urlEncodedData, setUrlEncodedData] = useState<Parameter[]>([]);
  const [isEnvDialogOpen, setIsEnvDialogOpen] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Function to sync URL query params with UI state
  const syncUrlQueryParams = (url: string) => {
    try {
      const urlObj = new URL(url);
      const params: Parameter[] = [];
      urlObj.searchParams.forEach((value, key) => {
        params.push({ key, value, enabled: true });
      });
      setQueryParams(params);
    } catch (e) {
      // Invalid URL, keep existing params
      console.warn('Invalid URL for query param sync:', e);
    }
  };

  // Initialize UI state from request
  useEffect(() => {
    console.log('Initializing request panel state');
    syncUrlQueryParams(request.baseUrl);

    // Path variables
    const pParams = Object.entries(request.pathVariables || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    setPathParams(pParams);

    // Headers
    const hParams = Object.entries(request.headers || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    setHeaders(hParams);

    // Request body
    if (request.requestBody && Object.keys(request.requestBody).length > 0) {
      setBodyType("raw");
      setRawFormat("json");
      setRawBody(JSON.stringify(request.requestBody, null, 2));
    }
    setUnsavedChanges(false); // Reset unsaved changes on new request load
  }, [request.routeId]); // Only reinitialize when routeId changes

  // Handle environment change
  const handleEnvironmentChange = (env: typeof ENVIRONMENTS[number]) => {
    let baseUrl = request.baseUrl;

    // Update URL based on environment
    if (env !== 'dev') {
      const envUrl = request[`${env}Url` as keyof Request];
      if (envUrl) {
        baseUrl = envUrl;
      }
    }

    onRequestChange({
      selectedEnvironment: env,
      baseUrl
    });
    setUnsavedChanges(true);
  };

  const handleSend = async () => {
    onLoading(true);
    onError(null);
    const startTime = performance.now();

    try {
      // Build request parameters
      const urlObj = new URL(request.baseUrl);

      // Add query parameters
      queryParams.forEach(param => {
        if (param.enabled && param.key && param.value) {
          urlObj.searchParams.append(param.key, param.value);
        }
      });

      // Build headers
      const headersRecord: Record<string, string> = {};
      headers
        .filter(h => h.enabled && h.key && h.value)
        .forEach(h => {
          headersRecord[h.key] = h.value;
        });

      // Process body
      let requestBody;
      if (bodyType === "raw" && rawBody) {
        try {
          requestBody = JSON.parse(rawBody);
        } catch (e) {
          requestBody = rawBody;
        }
      } else if (bodyType === "form-data") {
        const formDataObj = new FormData();
        formData.forEach(field => {
          if (field.enabled && field.key) {
            formDataObj.append(field.key, field.value);
          }
        });
        requestBody = formDataObj;
      } else if (bodyType === "x-www-form-urlencoded") {
        const params = new URLSearchParams();
        urlEncodedData.forEach(field => {
          if (field.enabled && field.key) {
            params.append(field.key, field.value);
          }
        });
        requestBody = params.toString();
      }

      const response = await makeRequest({
        method: request.method,
        url: urlObj.toString(),
        headers: headersRecord,
        body: requestBody
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Create history entry that matches the required schema
      const historyEntry = {
        method: request.method,
        url: urlObj.toString(),
        timestamp: new Date().toISOString(),
        responseTime,
        requestBody: requestBody || {},
        responseFields: response.data || {}
      };

      // Save to local storage for global history
      const globalHistoryEntry = {
        id: crypto.randomUUID(),
        request: {
          method: request.method,
          url: urlObj.toString(),
          headers: headersRecord,
          body: requestBody,
          queryParams: Object.fromEntries(urlObj.searchParams.entries())
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          headers: response.headers
        },
        timestamp: new Date().toISOString(),
        responseTime
      };

      const savedHistory = localStorage.getItem('request_history') || '[]';
      const history = JSON.parse(savedHistory);
      history.unshift(globalHistoryEntry);
      localStorage.setItem('request_history', JSON.stringify(history.slice(0, 100)));
      window.dispatchEvent(new Event('storage'));

      // Create an example response if none exists or empty
      let exampleResponse = request.exampleResponseBody;
      if (!exampleResponse || (typeof exampleResponse === 'object' && 
         (Array.isArray(exampleResponse) ? exampleResponse.length === 0 : Object.keys(exampleResponse).length === 0))) {
        
        // Create a masked copy of the response data
        exampleResponse = maskResponseValues(response.data);
        console.log('Created masked example response', exampleResponse);
      }

      // Update request with new history entry and example response
      onRequestChange({
        historyRequests: [historyEntry, ...(request.historyRequests || [])].slice(0, 5),
        requestBody: requestBody || {},
        responseFields: response.data || {},
        exampleResponseBody: exampleResponse
      });
      setUnsavedChanges(true);
      
      // Auto-save the request with the example response
      handleSave();

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

  // Handle URL change without auto-save
  const handleUrlChange = (newUrl: string) => {
    console.log('URL changed, syncing query params');
    syncUrlQueryParams(newUrl);
    onRequestChange({
      baseUrl: newUrl
    });
    setUnsavedChanges(true);
  };

  const handleSave = () => {
    console.log('Saving request with current state');
    try {
      // Format headers
      const headersObj = headers
        .filter(h => h.enabled && h.key)
        .reduce((acc, h) => {
          acc[h.key] = h.value;
          return acc;
        }, {} as Record<string, string>);

      // Format query parameters
      const queryParamsObj = queryParams
        .filter(p => p.enabled && p.key)
        .reduce((acc, p) => {
          acc[p.key] = p.value;
          return acc;
        }, {} as Record<string, string>);
      
      console.log('Saving request with example body:', request.exampleResponseBody);

      // Format request body
      let requestBodyObj = {};
      if (bodyType === "raw" && rawBody) {
        try {
          requestBodyObj = JSON.parse(rawBody);
        } catch (e) {
          console.warn('Invalid JSON in raw body, saving as is');
          requestBodyObj = rawBody;
        }
      }

      // Ensure historyRequests are properly formatted
      const formattedHistoryRequests = (request.historyRequests || []).map(entry => ({
        method: entry.method || request.method,
        url: entry.url || request.baseUrl,
        timestamp: entry.timestamp || new Date().toISOString(),
        responseTime: entry.responseTime || 0,
        requestBody: entry.requestBody || {},
        responseFields: entry.responseFields || {}
      }));

      // Update request with all changes
      onRequestChange({
        baseUrl: request.baseUrl,
        headers: headersObj,
        queryParams: queryParamsObj,
        requestBody: requestBodyObj,
        historyRequests: formattedHistoryRequests,
        updatedAt: new Date().toISOString()
      });
      setUnsavedChanges(false);

      toast({
        title: "Success",
        description: "Request saved successfully",
      });
    } catch (error) {
      console.error('Error saving request:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save request. Please check the console for details.",
      });
    }
  };

  const handleRawFormatChange = (value: typeof RAW_FORMATS[number]) => {
    setRawFormat(value);
    setUnsavedChanges(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select
          value={request.method}
          onValueChange={(value) => {
            onRequestChange({ method: value });
            setUnsavedChanges(true);
          }}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(METHOD_COLORS).map((method) => (
              <SelectItem key={method} value={method as HttpMethod}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={request.baseUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Enter URL"
          className="flex-1"
        />

        <Button
          variant="outline"
          onClick={handleSave}
          disabled={!unsavedChanges}
        >
          <Save className="mr-2 h-4 w-4" />
          Save
          {unsavedChanges && "*"}
        </Button>

        <Button onClick={handleSend} className="bg-indigo-600 hover:bg-indigo-700">
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>

        <Select
          value={request.selectedEnvironment || 'qa01'}
          onValueChange={handleEnvironmentChange}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            {ENVIRONMENTS.map((env) => (
              <SelectItem key={env} value={env}>
                {env.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsEnvDialogOpen(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="params" className="w-full">
        <TabsList>
          <TabsTrigger value="params">Parameters</TabsTrigger>
          <TabsTrigger value="auth">Authorization</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-1" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="space-y-4">
          {/* Query Parameters */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Query Parameters</h3>
            <div className="space-y-2">
              {queryParams.map((param, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    checked={param.enabled}
                    onCheckedChange={(checked) => {
                      const newParams = [...queryParams];
                      newParams[index] = { ...param, enabled: checked === true };
                      setQueryParams(newParams);
                      setUnsavedChanges(true);
                    }}
                  />
                  <Input
                    placeholder="Key"
                    value={param.key}
                    onChange={(e) => {
                      const newParams = [...queryParams];
                      newParams[index] = { ...param, key: e.target.value };
                      setQueryParams(newParams);
                      setUnsavedChanges(true);
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => {
                      const newParams = [...queryParams];
                      newParams[index] = { ...param, value: e.target.value };
                      setQueryParams(newParams);
                      setUnsavedChanges(true);
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setQueryParams(queryParams.filter((_, i) => i !== index));
                      setUnsavedChanges(true);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => {
                  setQueryParams([...queryParams, { key: "", value: "", enabled: true }]);
                  setUnsavedChanges(true);
                }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Add Query Parameter
              </Button>
            </div>
          </div>

          {/* Path Parameters */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Path Parameters</h3>
            <div className="space-y-2">
              {pathParams.map((param, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    checked={param.enabled}
                    onCheckedChange={(checked) => {
                      const newParams = [...pathParams];
                      newParams[index] = { ...param, enabled: checked === true };
                      setPathParams(newParams);
                      setUnsavedChanges(true);
                    }}
                  />
                  <Input
                    placeholder="Key"
                    value={param.key}
                    onChange={(e) => {
                      const newParams = [...pathParams];
                      newParams[index] = { ...param, key: e.target.value };
                      setPathParams(newParams);
                      setUnsavedChanges(true);
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => {
                      const newParams = [...pathParams];
                      newParams[index] = { ...param, value: e.target.value };
                      setPathParams(newParams);
                      setUnsavedChanges(true);
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setPathParams(pathParams.filter((_, i) => i !== index));
                      setUnsavedChanges(true);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => {
                  setPathParams([...pathParams, { key: "", value: "", enabled: true }]);
                  setUnsavedChanges(true);
                }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Add Path Parameter
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <Select
            value={request.auth.type}
            onValueChange={(value) => {
              onRequestChange({
                auth: {
                  type: value,
                  basic: value === "basic" ? { username: "", password: "" } : undefined,
                  bearer: value === "bearer" ? { token: "" } : undefined
                }
              });
              setUnsavedChanges(true);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select auth type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Auth</SelectItem>
              <SelectItem value="basic">Basic Auth</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="bearer-tiaa">Bearer Token (TIAA)</SelectItem>
            </SelectContent>
          </Select>

          {request.auth.type === "basic" && request.auth.basic && (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Username"
                value={request.auth.basic.username}
                onChange={(e) => {
                  onRequestChange({
                    auth: {
                      ...request.auth,
                      basic: { ...request.auth.basic!, username: e.target.value }
                    }
                  });
                  setUnsavedChanges(true);
                }}
              />
              <Input
                type="password"
                placeholder="Password"
                value={request.auth.basic.password}
                onChange={(e) => {
                  onRequestChange({
                    auth: {
                      ...request.auth,
                      basic: { ...request.auth.basic!, password: e.target.value }
                    }
                  });
                  setUnsavedChanges(true);
                }}
              />
            </div>
          )}

          {request.auth.type === "bearer" && (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Bearer Token"
                value={request.auth.bearer?.token || ""}
                onChange={(e) => {
                  onRequestChange({
                    auth: {
                      ...request.auth,
                      bearer: { token: e.target.value }
                    }
                  });
                  setUnsavedChanges(true);
                }}
              />
            </div>
          )}

          {request.auth.type === "bearer-tiaa" && (
            <div className="text-sm text-muted-foreground">
              TIAA token will be retrieved automatically based on environment.
            </div>
          )}
        </TabsContent>

        <TabsContent value="headers" className="space-y-4">
          <div className="space-y-2">
            {headers.map((header, index) => (
              <div key={index} className="flex items-center gap-2">
                <Checkbox
                  checked={header.enabled}
                  onCheckedChange={(checked) => {
                    const newHeaders = [...headers];
                    newHeaders[index] = { ...header, enabled: checked === true };
                    setHeaders(newHeaders);
                    setUnsavedChanges(true);
                  }}
                />
                <Input
                  placeholder="Header"
                  value={header.key}
                  onChange={(e) => {
                    const newHeaders = [...headers];
                    newHeaders[index] = { ...header, key: e.target.value };
                    setHeaders(newHeaders);
                    setUnsavedChanges(true);
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => {
                    const newHeaders = [...headers];
                    newHeaders[index] = { ...header, value: e.target.value };
                    setHeaders(newHeaders);
                    setUnsavedChanges(true);
                  }}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setHeaders(headers.filter((_, i) => i !== index));
                    setUnsavedChanges(true);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              onClick={() => {
                setHeaders([...headers, { key: "", value: "", enabled: true }]);
                setUnsavedChanges(true);
              }}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Add Header
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="body" className="space-y-4">
          <div className="space-y-4">
            <RadioGroup
              value={bodyType}
              onValueChange={(value: typeof BODY_TYPES[number]) => {
                setBodyType(value);
                setUnsavedChanges(true);
              }}
              className="flex items-center gap-4"
            >
              {BODY_TYPES.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <RadioGroupItem value={type} id={`body-type-${type}`} />
                  <Label htmlFor={`body-type-${type}`}>{type}</Label>
                </div>
              ))}
            </RadioGroup>

            {bodyType === "raw" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={rawFormat} onValueChange={handleRawFormatChange}>
                    <SelectTrigger className="w-32">
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        setRawBody(JSON.stringify(JSON.parse(rawBody), null, 2));
                        setUnsavedChanges(true);
                      } catch (e) {
                        toast({
                          variant: "destructive",
                          title: "Invalid JSON",
                          description: "The body content is not valid JSON",
                        });
                      }
                    }}
                  >
                    Format
                  </Button>
                </div>
                <Textarea
                  value={rawBody}
                  onChange={(e) => {
                    setRawBody(e.target.value);
                    setUnsavedChanges(true);
                  }}
                  placeholder="Request Body"
                  className="font-mono h-[300px]"
                />
              </div>
            )}

            {bodyType === "form-data" && (
              <div className="space-y-2">
                {formData.map((field, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Checkbox
                      checked={field.enabled}
                      onCheckedChange={(checked) => {
                        const newFormData = [...formData];
                        newFormData[index] = { ...field, enabled: checked === true };
                        setFormData(newFormData);
                        setUnsavedChanges(true);
                      }}
                    />
                    <Input
                      placeholder="Key"
                      value={field.key}
                      onChange={(e) => {
                        const newFormData = [...formData];
                        newFormData[index] = { ...field, key: e.target.value };
                        setFormData(newFormData);
                        setUnsavedChanges(true);
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => {
                        const newFormData = [...formData];
                        newFormData[index] = { ...field, value: e.target.value };
                        setFormData(newFormData);
                        setUnsavedChanges(true);
                      }}
                      className="flex-1"
                    />
                    <Select
                      value={field.type}
                      onValueChange={(value: "text" | "file") => {
                        const newFormData = [...formData];
                        newFormData[index] = { ...field, type: value };
                        setFormData(newFormData);
                        setUnsavedChanges(true);
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setFormData(formData.filter((_, i) => i !== index));
                        setUnsavedChanges(true);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() => {
                    setFormData([
                      ...formData,
                      { key: "", value: "", type: "text", enabled: true }
                    ]);
                    setUnsavedChanges(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Add Form Field
                </Button>
              </div>
            )}

            {bodyType === "x-www-form-urlencoded" && (
              <div className="space-y-2">
                {urlEncodedData.map((field, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Checkbox
                      checked={field.enabled}
                      onCheckedChange={(checked) => {
                        const newData = [...urlEncodedData];
                        newData[index] = { ...field, enabled: checked === true };
                        setUrlEncodedData(newData);
                        setUnsavedChanges(true);
                      }}
                    />
                    <Input
                      placeholder="Key"
                      value={field.key}
                      onChange={(e) => {
                        const newData = [...urlEncodedData];
                        newData[index] = { ...field, key: e.target.value };
                        setUrlEncodedData(newData);
                        setUnsavedChanges(true);                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => {
                        const newData = [...urlEncodedData];
                        newData[index] = { ...field, value: e.target.value };
                        setUrlEncodedData(newData);
                        setUnsavedChanges(true);
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setUrlEncodedData(urlEncodedData.filter((_, i) => i !== index));
                        setUnsavedChanges(true);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() => {
                    setUrlEncodedData([
                      ...urlEncodedData,
                      { key: "", value: "", enabled: true }
                    ]);
                    setUnsavedChanges(true);
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

        <TabsContent value="history">
          <HistorySection history={request.historyRequests || []} />
        </TabsContent>
      </Tabs>

      <EnvironmentUrlDialog
        isOpen={isEnvDialogOpen}
        onClose={() => setIsEnvDialogOpen(false)}
        request={request}
        onUpdate={(updates) => {
          onRequestChange(updates);
          setUnsavedChanges(true);
        }}
      />
    </div>
  );
}