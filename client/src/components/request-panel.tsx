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
import { saveHistoryRequest } from "@/lib/history";

const ENVIRONMENTS = ['dev', 'qa01', 'qa02', 'qa03', 'perf'] as const;

interface EnvironmentUrlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: Request;
  onUpdate: (updates: Partial<Request>) => void;
}

function EnvironmentUrlDialog({ isOpen, onClose, request, onUpdate }: EnvironmentUrlDialogProps) {
  const [urls, setUrls] = useState({
    devUrl: request.devUrl || '',
    qa01Url: request.qa01Url || '',
    qa02Url: request.qa02Url || '',
    qa03Url: request.qa03Url || '',
    perfUrl: request.perfUrl || '',
  });

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

const HistorySection = ({ history }: { history: RequestHistory[] }) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (entryId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedItems(newExpanded);
  };

  console.log("History data received:", history);

  if (!history || history.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No request history available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((entry, index) => {
        const entryId = `${entry.timestamp || ''}-${index}`;

        return (
          <Card key={entryId} className="p-4">
            <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={() => toggleExpand(entryId)}>
              <div className="flex items-center">
                {expandedItems.has(entryId) ? (
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
                {entry.responseTime ? entry.responseTime.toFixed(0) : '0'}ms
              </div>
            </div>
            <div className="text-sm break-all">{entry.url}</div>
            {expandedItems.has(entryId) && (
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
        );
      })}
    </div>
  );
};

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
  // Keep a local copy of the request that we'll update as changes are made
  const [localRequest, setLocalRequest] = useState<Request>(request);
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
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [authHeaders, setAuthHeaders] = useState({});
  
  // Update local request without triggering server save
  const updateLocalRequest = (updates: Partial<Request>) => {
    setLocalRequest(prev => ({
      ...prev,
      ...updates
    }));
    setUnsavedChanges(true);
  };


  // Function to extract path variables from URL
  const extractPathVariables = (url: string): Parameter[] => {
    try {
      // Look for path parameters like {variable} in the URL
      const pathVarRegex = /{([^{}]+)}/g;
      const matches: string[] = [];
      let match;
      
      // Extract path variables manually instead of using matchAll to avoid TypeScript error
      while ((match = pathVarRegex.exec(url)) !== null) {
        if (match[1]) {
          matches.push(match[1]);
        }
      }
      
      // Create a map of existing path params for quick lookup
      const existingPathParams = new Map(
        pathParams.map(param => [param.key, param])
      );
      
      // Map the matches to Parameter objects
      return matches.map(key => {
        // Use existing value if available, otherwise empty string
        const existingParam = existingPathParams.get(key);
        return {
          key,
          value: existingParam ? existingParam.value : "",
          enabled: existingParam ? existingParam.enabled : true
        };
      });
    } catch (e) {
      console.warn('Error extracting path variables:', e);
      return [];
    }
  };

  const syncUrlQueryParams = (url: string) => {
    try {
      const urlObj = new URL(url);
      const params: Parameter[] = [];
      urlObj.searchParams.forEach((value, key) => {
        params.push({ key, value, enabled: true });
      });
      setQueryParams(params);
      
      // Also extract and sync path variables
      const pathVars = extractPathVariables(url);
      if (pathVars.length > 0) {
        setPathParams(pathVars);
      }
    } catch (e) {
      console.warn('Invalid URL for query param sync:', e);
    }
  };

  // Function to update URL with query parameters
  const updateUrlWithQueryParams = () => {
    try {
      const url = localRequest.baseUrl;
      const urlObj = new URL(url);
      
      // Clear all existing query parameters
      urlObj.search = '';
      
      // Add all enabled query parameters
      queryParams.forEach(param => {
        if (param.enabled && param.key) {
          urlObj.searchParams.append(param.key, param.value);
        }
      });
      
      // Only update if the URL has actually changed
      if (urlObj.toString() !== localRequest.baseUrl) {
        updateLocalRequest({
          baseUrl: urlObj.toString()
        });
      }
    } catch (e) {
      console.warn('Invalid URL for query param update:', e);
    }
  };
  
  // Initialize component state when request changes
  useEffect(() => {
    console.log('Initializing request panel state');
    syncUrlQueryParams(request.baseUrl);

    const pParams = Object.entries(request.pathVariables || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    setPathParams(pParams);

    const hParams = Object.entries(request.headers || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    setHeaders(hParams);

    if (request.requestBody && Object.keys(request.requestBody).length > 0) {
      setBodyType("raw");
      setRawFormat("json");
      setRawBody(JSON.stringify(request.requestBody, null, 2));
    }
    setUnsavedChanges(false); 
  }, [request.routeId]); 

  const handleEnvironmentChange = (env: typeof ENVIRONMENTS[number]) => {
    let baseUrl = localRequest.baseUrl;

    if (env !== 'dev') {
      const envUrl = localRequest[`${env}Url` as keyof Request];
      if (envUrl) {
        baseUrl = envUrl;
      }
    }

    updateLocalRequest({
      selectedEnvironment: env,
      baseUrl
    });
  };

  // Function to update URL with path variables
  const updateUrlWithPathVariables = () => {
    try {
      let baseUrl = localRequest.baseUrl;
      
      // Replace path variables in URL with their values
      pathParams.forEach(param => {
        if (param.enabled && param.key && param.value) {
          // Replace {paramName} with actual value
          const regex = new RegExp(`{${param.key}}`, 'g');
          baseUrl = baseUrl.replace(regex, param.value);
        }
      });
      
      // Only update if the URL has actually changed
      if (baseUrl !== localRequest.baseUrl) {
        updateLocalRequest({
          baseUrl
        });
      }
    } catch (e) {
      console.warn('Error updating URL with path variables:', e);
    }
  };
  
  // Add effect to sync query params when they change
  useEffect(() => {
    if (queryParams.length > 0) {
      updateUrlWithQueryParams();
    }
  }, [queryParams]);
  
  // Add effect to sync path variables when they change
  useEffect(() => {
    if (pathParams.length > 0) {
      updateUrlWithPathVariables();
    }
  }, [pathParams]);

  const handleSend = async () => {
    console.log('Sending request with body:', rawBody);
    setIsSending(true);
    setResponse(null);
    setResponseError(null);
    onLoading(true);

    try {
      const formattedHeaders = headers
        .filter(h => h.enabled && h.key)
        .reduce((acc, h) => {
          acc[h.key] = h.value;
          return acc;
        }, {} as Record<string, string>);

      let reqBody = {};
      if (bodyType === "raw" && rawBody) {
        try {
          reqBody = JSON.parse(rawBody);
        } catch (e) {
          console.log('Raw body is not JSON, sending as is');
          reqBody = rawBody;
        }
      }

      const startTime = Date.now();

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: request.method,
          url: request.baseUrl,
          headers: {
            ...formattedHeaders,
            ...authHeaders
          },
          body: reqBody
        }),
      });

      const responseTime = Date.now() - startTime;

      const contentType = res.headers.get('content-type') || '';
      let responseData;

      if (contentType.includes('application/json')) {
        responseData = await res.json();
      } else {
        const text = await res.text();
        responseData = text;
      }

      const actualResponseData = responseData.data || responseData;

      const responseObj = {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        data: actualResponseData,
        time: responseTime,
        size: JSON.stringify(actualResponseData).length
      };

      onResponse(responseObj);
      onError(null);

      const historyEntry = {
        method: request.method,
        url: request.baseUrl,
        timestamp: new Date().toISOString(),
        responseTime,
        requestBody: reqBody,
        responseFields: actualResponseData
      };

      const updatedHistory = [
        historyEntry,
        ...(request.historyRequests || []).slice(0, 9)
      ];

      await saveHistoryRequest({
        ...request,
        requestBody: reqBody,
        responseFields: actualResponseData,
        historyRequests: updatedHistory
      });

      const shouldAutoSave = 
        (!localRequest.exampleResponseBody || 
         (typeof localRequest.exampleResponseBody === 'object' && 
          Object.keys(localRequest.exampleResponseBody).length === 0)) && 
        res.status === 200;

      // Instead of auto-saving every time, just update the local state without saving
      // This way, only clicking the Save button will trigger a save
      updateLocalRequest({
        historyRequests: updatedHistory,
        responseFields: actualResponseData,
        // Only set example response if it doesn't exist and the request is successful
        ...(shouldAutoSave ? { exampleResponseBody: maskResponseValues(actualResponseData) } : {}),
        updatedAt: new Date().toISOString()
      });
      
      // Set unsaved changes to true so user knows they should save
      setUnsavedChanges(true);

      toast({
        title: "Request completed",
        description: `${res.status} ${res.statusText} in ${responseTime}ms`,
      });

      const savedHistory = localStorage.getItem("request_history") || "[]";
      const parsedHistory = JSON.parse(savedHistory);
      const newHistory = [{
        id: `${localRequest.method}-${Date.now()}`,
        request: {
          method: localRequest.method,
          url: localRequest.baseUrl,
          headers: formattedHeaders,
          body: reqBody
        },
        response: {
          status: res.status,
          data: actualResponseData
        },
        timestamp: new Date().toISOString()
      }, ...parsedHistory].slice(0, 50); 
      localStorage.setItem("request_history", JSON.stringify(newHistory));

      window.dispatchEvent(new Event("storage"));

    } catch (error) {
      console.error('Error sending request:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setResponseError(errorMessage as string);
      onError(errorMessage);
      toast({
        variant: "destructive",
        title: "Request failed",
        description: errorMessage,
      });
    } finally {
      setIsSending(false);
      onLoading(false);
    }
  };

  const handleUrlChange = (newUrl: string) => {
    console.log('URL changed, syncing query params');
    // Update the local request first
    updateLocalRequest({
      baseUrl: newUrl
    });
    // Then extract and sync query params and path variables
    syncUrlQueryParams(newUrl);
  };

  const handleSave = () => {
    console.log('Saving request with current state');
    try {
      const headersObj = headers
        .filter(h => h.enabled && h.key)
        .reduce((acc, h) => {
          acc[h.key] = h.value;
          return acc;
        }, {} as Record<string, string>);

      const queryParamsObj = queryParams
        .filter(p => p.enabled && p.key)
        .reduce((acc, p) => {
          acc[p.key] = p.value;
          return acc;
        }, {} as Record<string, string>);
        
      const pathVariablesObj = pathParams
        .filter(p => p.enabled && p.key)
        .reduce((acc, p) => {
          acc[p.key] = p.value;
          return acc;
        }, {} as Record<string, string>);

      console.log('Saving request with example body:', localRequest.exampleResponseBody);

      let requestBodyObj = {};
      if (bodyType === "raw" && rawBody) {
        try {
          requestBodyObj = JSON.parse(rawBody);
        } catch (e) {
          console.warn('Invalid JSON in raw body, saving as is');
          requestBodyObj = rawBody;
        }
      }

      const formattedHistoryRequests = (localRequest.historyRequests || []).map(entry => ({
        method: entry.method || localRequest.method,
        url: entry.url || localRequest.baseUrl,
        timestamp: entry.timestamp || new Date().toISOString(),
        responseTime: entry.responseTime || 0,
        requestBody: entry.requestBody || {},
        responseFields: entry.responseFields || {}
      }));

      // Save all local changes to the server at once
      onRequestChange({
        ...localRequest, // Include all local changes
        baseUrl: localRequest.baseUrl,
        headers: headersObj,
        queryParams: queryParamsObj,
        pathVariables: pathVariablesObj,
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

  const maskResponseValues = (data: any): any => {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      const sampleSize = Math.min(data.length, 3);
      return Array(sampleSize).fill(0).map((_, i) => maskResponseValues(data[i]));
    }

    if (typeof data === 'object') {
      const result: Record<string, any> = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = maskResponseValues(data[key]);
        }
      }
      return result;
    }

    if (typeof data === 'string') {
      if (data.length > 30) return data.substring(0, 10) + '...';
      return data.replace(/./g, '*'); 
    }
    if (typeof data === 'number') return 0;
    if (typeof data === 'boolean') return false;

    return data; 
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select
          value={localRequest.method}
          onValueChange={(value) => {
            updateLocalRequest({ method: value });
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
          value={localRequest.baseUrl}
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

        <Button onClick={handleSend} className="bg-indigo-600 hover:bg-indigo-700" disabled={isSending}>
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>

        <Select
          value={localRequest.selectedEnvironment || 'qa01'}
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
            value={localRequest.auth.type}
            onValueChange={(value) => {
              updateLocalRequest({
                auth: {
                  type: value,
                  basic: value === "basic" ? { username: "", password: "" } : undefined,
                  bearer: value === "bearer" ? { token: "" } : undefined
                }
              });
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

          {localRequest.auth.type === "basic" && localRequest.auth.basic && (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Username"
                value={localRequest.auth.basic.username}
                onChange={(e) => {
                  updateLocalRequest({
                    auth: {
                      ...localRequest.auth,
                      basic: { ...localRequest.auth.basic!, username: e.target.value }
                    }
                  });
                }}
              />
              <Input
                type="password"
                placeholder="Password"
                value={localRequest.auth.basic.password}
                onChange={(e) => {
                  updateLocalRequest({
                    auth: {
                      ...localRequest.auth,
                      basic: { ...localRequest.auth.basic!, password: e.target.value }
                    }
                  });
                }}
              />
            </div>
          )}

          {localRequest.auth.type === "bearer" && (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Bearer Token"
                value={localRequest.auth.bearer?.token || ""}
                onChange={(e) => {
                  updateLocalRequest({
                    auth: {
                      ...localRequest.auth,
                      bearer: { token: e.target.value }
                    }
                  });
                }}
              />
            </div>
          )}

          {localRequest.auth.type === "bearer-tiaa" && (
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
        request={localRequest}
        onUpdate={(updates) => {
          updateLocalRequest(updates);
        }}
      />
    </div>
  );
}