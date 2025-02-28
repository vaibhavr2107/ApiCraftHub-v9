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
import { X, Send, History } from "lucide-react";
import { nanoid } from "nanoid";

// Add HistorySection component
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
          {entry.requestBody && (
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
  const [body, setBody] = useState<string>("");

  // Initialize parameters from request
  useEffect(() => {
    // Convert query params from record to array
    const qParams = Object.entries(request.queryParams || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    setQueryParams(qParams.length > 0 ? qParams : [{ key: "", value: "", enabled: true }]);

    // Convert path variables from record to array
    const pParams = Object.entries(request.pathVariables || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    setPathParams(pParams.length > 0 ? pParams : [{ key: "", value: "", enabled: true }]);

    // Convert headers from record to array
    const hParams = Object.entries(request.headers || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }));
    setHeaders(hParams.length > 0 ? hParams : [{ key: "", value: "", enabled: true }]);

    // Set body
    setBody(JSON.stringify(request.requestBody || {}, null, 2));
  }, [request]);

  const handleSend = async () => {
    onLoading(true);
    onError(null);
    const startTime = performance.now();

    try {
      // Convert parameters back to records
      const queryParamsRecord: Record<string, string> = {};
      queryParams
        .filter(p => p.enabled && p.key && p.value)
        .forEach(p => {
          queryParamsRecord[p.key] = p.value;
        });

      const headersRecord: Record<string, string> = {};
      headers
        .filter(h => h.enabled && h.key && h.value)
        .forEach(h => {
          headersRecord[h.key] = h.value;
        });

      // Process path variables
      let url = request.baseUrl;
      pathParams
        .filter(p => p.enabled && p.key && p.value)
        .forEach(p => {
          url = url.replace(`{{${p.key}}}`, p.value);
        });

      // Add query parameters to URL
      const urlObj = new URL(url);
      Object.entries(queryParamsRecord).forEach(([key, value]) => {
        urlObj.searchParams.append(key, value);
      });

      // Add auth header if present
      if (request.auth.type === "bearer" && request.auth.token) {
        headersRecord["Authorization"] = `Bearer ${request.auth.token}`;
      }

      const response = await makeRequest({
        method: request.method,
        url: urlObj.toString(),
        headers: headersRecord,
        body: body ? JSON.parse(body) : undefined
      });

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
          <ParametersSection
            title="Query Parameters"
            parameters={queryParams}
            setParameters={setQueryParams}
          />
          <ParametersSection
            title="Path Parameters"
            parameters={pathParams}
            setParameters={setPathParams}
          />
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <Select
            value={request.auth.type}
            onValueChange={(value) =>
              onRequestChange({
                auth: { type: value, token: request.auth.token }
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select auth type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Auth</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
            </SelectContent>
          </Select>

          {request.auth.type === "bearer" && (
            <Input
              type="text"
              placeholder="Bearer Token"
              value={request.auth.token}
              onChange={(e) =>
                onRequestChange({
                  auth: { ...request.auth, token: e.target.value }
                })
              }
            />
          )}
        </TabsContent>

        <TabsContent value="headers" className="space-y-4">
          <ParametersSection
            title="Headers"
            parameters={headers}
            setParameters={setHeaders}
          />
        </TabsContent>

        <TabsContent value="body" className="space-y-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Request Body (JSON)"
            className="font-mono min-h-[200px]"
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <HistorySection history={request.historyRequests || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}