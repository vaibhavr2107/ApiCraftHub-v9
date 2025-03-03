import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCallback, useState, useEffect } from "react";

export interface ResponseData {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
  time?: number;
  size?: number;
}

interface ResponsePanelProps {
  response: ResponseData | null;
  isLoading: boolean;
  error: string | null;
  exampleResponse?: Record<string, any>;
}

export function ResponsePanel({ response, isLoading, error, exampleResponse }: ResponsePanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"response" | "headers" | "example">("example");

  // Switch to response tab when there's new response data
  useEffect(() => {
    if (response) {
      setActiveTab("response");
    }
  }, [response]);

  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied to clipboard",
        description: "Content has been copied to your clipboard.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Could not copy content to clipboard.",
      });
    }
  }, [toast]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadgeVariant = (status: number) => {
    if (status >= 200 && status < 300) return "default";
    if (status >= 400) return "destructive";
    return "secondary";
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTime = (ms?: number) => {
    if (!ms) return "0ms";
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getLineNumbers = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-muted border-r text-right pr-2 text-sm text-muted-foreground select-none">
        {lines.map((_, i) => (
          <div key={i} className="h-6 leading-6">{i + 1}</div>
        ))}
      </div>
    );
  };

  const renderJsonContent = (data: any) => {
    if (!data || Object.keys(data).length === 0) {
      return <div className="text-muted-foreground text-sm">No data available</div>;
    }

    const jsonString = JSON.stringify(data, null, 2);
    return (
      <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted p-4 pl-16 text-sm font-mono min-h-[200px] overflow-x-auto relative">
        {getLineNumbers(jsonString)}
        {jsonString}
      </pre>
    );
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Response
            {response && (
              <Badge variant={getStatusBadgeVariant(response.status)}>
                {response.status} {response.statusText}
              </Badge>
            )}
          </CardTitle>
          {response && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div>Time: {formatTime(response.time)}</div>
              <div>Size: {formatSize(response.size)}</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="response">Response</TabsTrigger>
              <TabsTrigger value="headers">Headers</TabsTrigger>
              <TabsTrigger value="example">Example Response</TabsTrigger>
            </TabsList>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                let content = '';
                switch (activeTab) {
                  case 'response':
                    content = response ? JSON.stringify(response.data, null, 2) : '';
                    break;
                  case 'headers':
                    content = response ? Object.entries(response.headers)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join('\n') : '';
                    break;
                  case 'example':
                    content = JSON.stringify(exampleResponse, null, 2);
                    break;
                }
                handleCopy(content);
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </div>

          <TabsContent value="response">
            {response ? (
              renderJsonContent(response.data)
            ) : (
              <div className="text-muted-foreground text-sm p-4">
                Make a request to see the response
              </div>
            )}
          </TabsContent>

          <TabsContent value="headers">
            {response ? (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                {Object.entries(response.headers).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-4 text-sm">
                    <div className="font-medium">{key}</div>
                    <div className="col-span-2 font-mono break-all">{String(value)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm p-4">
                Make a request to see the response headers
              </div>
            )}
          </TabsContent>

          <TabsContent value="example">
            {renderJsonContent(exampleResponse)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}