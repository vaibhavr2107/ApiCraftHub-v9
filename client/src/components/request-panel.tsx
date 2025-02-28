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
import { useEffect, useState, useRef } from "react";
import { makeRequest } from "@/lib/api";
import type { Request, RequestHistory } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Save, Send, History, X } from "lucide-react";
import { nanoid } from "nanoid";

// History Section Component
const HistorySection = ({ history }: { history: RequestHistory[] }) => {
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
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className={`font-semibold ${METHOD_COLORS[entry.method]}`}>
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
  const [queryParams, setQueryParams] = useState<Parameter[]>([
    { key: "", value: "", enabled: true }
  ]);
  const [pathParams, setPathParams] = useState<Parameter[]>([
    { key: "", value: "", enabled: true }
  ]);
  const [headers, setHeaders] = useState<Parameter[]>([
    { key: "", value: "", enabled: true }
  ]);
  const [bodyType, setBodyType] = useState<typeof BODY_TYPES[number]>("none");
  const [rawFormat, setRawFormat] = useState<typeof RAW_FORMATS[number]>("json");
  const [rawBody, setRawBody] = useState("");
  const [formData, setFormData] = useState<Array<{ key: string; value: string; type: "text" | "file"; enabled: boolean }>>([]);
  const [urlEncodedData, setUrlEncodedData] = useState<Parameter[]>([]);

  // Initialize UI state from request
  useEffect(() => {
    // Query parameters
    const qParams = Object.entries(request.queryParams || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    setQueryParams(qParams.length > 0 ? qParams : [{ key: "", value: "", enabled: true }]);

    // Path variables
    const pParams = Object.entries(request.pathVariables || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    setPathParams(pParams.length > 0 ? pParams : [{ key: "", value: "", enabled: true }]);

    // Headers
    const hParams = Object.entries(request.headers || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    setHeaders(hParams.length > 0 ? hParams : [{ key: "", value: "", enabled: true }]);

    // Request body
    if (request.requestBody && Object.keys(request.requestBody).length > 0) {
      setBodyType("raw");
      setRawFormat("json");
      setRawBody(JSON.stringify(request.requestBody, null, 2));
    }
  }, [request]);

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

      // Add auth header
      if (request.auth.type === "bearer" && request.auth.token) {
        headersRecord["Authorization"] = `Bearer ${request.auth.token}`;
      }

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

      onResponse({
        ...response,
        time: responseTime
      });

      // Update request body in the state if successful
      if (response.status >= 200 && response.status < 300) {
        onRequestChange({
          requestBody: requestBody || {},
          responseFields: response.data || {}
        });
      }

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

  const handleSave = () => {
    onRequestChange({
      requestBody: bodyType === "raw" && rawBody ? JSON.parse(rawBody) : {},
      headers: headers.reduce((acc, h) => {
        if (h.enabled && h.key) {
          acc[h.key] = h.value;
        }
        return acc;
      }, {} as Record<string, string>),
      queryParams: queryParams.reduce((acc, p) => {
        if (p.enabled && p.key) {
          acc[p.key] = p.value;
        }
        return acc;
      }, {} as Record<string, string>),
      updatedAt: new Date().toISOString()
    });

    toast({
      title: "Success",
      description: "Request saved successfully",
    });
  };

  const handleAddParam = (
    params: Parameter[],
    setParams: React.Dispatch<React.SetStateAction<Parameter[]>>
  ) => {
    setParams([...params, { key: "", value: "", enabled: true }]);
  };

  const handleRemoveParam = (
    index: number,
    params: Parameter[],
    setParams: React.Dispatch<React.SetStateAction<Parameter[]>>
  ) => {
    setParams(params.filter((_, i) => i !== index));
  };

  const handleUpdateParam = (
    index: number,
    field: keyof Parameter,
    value: string | boolean,
    params: Parameter[],
    setParams: React.Dispatch<React.SetStateAction<Parameter[]>>
  ) => {
    const newParams = [...params];
    newParams[index] = { ...newParams[index], [field]: value };
    setParams(newParams);
  };

  const ParametersSection = ({
    title,
    parameters,
    setParameters
  }: {
    title: string;
    parameters: Parameter[];
    setParameters: React.Dispatch<React.SetStateAction<Parameter[]>>;
  }) => (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="space-y-2">
        {parameters.map((param, index) => (
          <div key={index} className="flex items-center gap-2">
            <Checkbox
              checked={param.enabled}
              onCheckedChange={(checked) =>
                handleUpdateParam(index, "enabled", checked === true, parameters, setParameters)
              }
            />
            <Input
              placeholder="Key"
              value={param.key}
              onChange={(e) =>
                handleUpdateParam(index, "key", e.target.value, parameters, setParameters)
              }
              className="flex-1"
            />
            <Input
              placeholder="Value"
              value={param.value}
              onChange={(e) =>
                handleUpdateParam(index, "value", e.target.value, parameters, setParameters)
              }
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveParam(index, parameters, setParameters)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          onClick={() => handleAddParam(parameters, setParameters)}
          variant="outline"
          size="sm"
          className="w-full"
        >
          Add {title.replace('Parameters', '').trim()}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select
          value={request.method}
          onValueChange={(value) => onRequestChange({ method: value })}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(METHOD_COLORS).map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={request.baseUrl}
          onChange={(e) => onRequestChange({ baseUrl: e.target.value })}
          placeholder="Enter URL"
          className="flex-1"
        />

        <Button variant="outline" onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>

        <Button onClick={handleSend}>
          <Send className="mr-2 h-4 w-4" />
          Send
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
                    }}
                  />
                  <Input
                    placeholder="Key"
                    value={param.key}
                    onChange={(e) => {
                      const newParams = [...queryParams];
                      newParams[index] = { ...param, key: e.target.value };
                      setQueryParams(newParams);
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
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setQueryParams(queryParams.filter((_, i) => i !== index));
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => setQueryParams([...queryParams, { key: "", value: "", enabled: true }])}
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
                    }}
                  />
                  <Input
                    placeholder="Key"
                    value={param.key}
                    onChange={(e) => {
                      const newParams = [...pathParams];
                      newParams[index] = { ...param, key: e.target.value };
                      setPathParams(newParams);
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
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setPathParams(pathParams.filter((_, i) => i !== index));
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => setPathParams([...pathParams, { key: "", value: "", enabled: true }])}
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
                  token: value === "bearer" ? request.auth.token || "" : undefined,
                  basic: value === "basic" ? { username: "", password: "" } : undefined
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

          {request.auth.type === "basic" && request.auth.basic && (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Username"
                value={request.auth.basic.username}
                onChange={(e) =>
                  onRequestChange({
                    auth: {
                      ...request.auth,
                      basic: { ...request.auth.basic!, username: e.target.value }
                    }
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
                      basic: { ...request.auth.basic!, password: e.target.value }
                    }
                  })
                }
              />
            </div>
          )}

          {request.auth.type === "bearer" && (
            <Input
              type="text"
              placeholder="Bearer Token"
              value={request.auth.token || ""}
              onChange={(e) =>
                onRequestChange({
                  auth: { ...request.auth, token: e.target.value }
                })
              }
            />
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
                  }}
                />
                <Input
                  placeholder="Header"
                  value={header.key}
                  onChange={(e) => {
                    const newHeaders = [...headers];
                    newHeaders[index] = { ...header, key: e.target.value };
                    setHeaders(newHeaders);
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
                  }}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setHeaders(headers.filter((_, i) => i !== index));
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              onClick={() => setHeaders([...headers, { key: "", value: "", enabled: true }])}
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
              onValueChange={(value: typeof BODY_TYPES[number]) => setBodyType(value)}
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
                  <Select value={rawFormat} onValueChange={setRawFormat}>
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
                  onChange={(e) => setRawBody(e.target.value)}
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
                      }}
                    />
                    <Input
                      placeholder="Key"
                      value={field.key}
                      onChange={(e) => {
                        const newFormData = [...formData];
                        newFormData[index] = { ...field, key: e.target.value };
                        setFormData(newFormData);
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
                      }}
                      className="flex-1"
                    />
                    <Select
                      value={field.type}
                      onValueChange={(value: "text" | "file") => {
                        const newFormData = [...formData];
                        newFormData[index] = { ...field, type: value };
                        setFormData(newFormData);
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
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() =>
                    setFormData([
                      ...formData,
                      { key: "", value: "", type: "text", enabled: true }
                    ])
                  }
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
                      }}
                    />
                    <Input
                      placeholder="Key"
                      value={field.key}
                      onChange={(e) => {
                        const newData = [...urlEncodedData];
                        newData[index] = { ...field, key: e.target.value };
                        setUrlEncodedData(newData);
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => {
                        const newData = [...urlEncodedData];
                        newData[index] = { ...field, value: e.target.value };
                        setUrlEncodedData(newData);
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setUrlEncodedData(urlEncodedData.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={() =>
                    setUrlEncodedData([
                      ...urlEncodedData,
                      { key: "", value: "", enabled: true }
                    ])
                  }
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

        <TabsContent value="history" className="space-y-4">
          <HistorySection history={request.historyRequests || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}