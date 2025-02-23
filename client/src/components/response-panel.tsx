import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponseData } from "@/types/request";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ResponsePanelProps {
  response: ResponseData | null;
  isLoading: boolean;
  error: string | null;
}

export function ResponsePanel({ response, isLoading, error }: ResponsePanelProps) {
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

  if (!response) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Make a request to see the response
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "success";
    if (status >= 400) return "destructive";
    return "default";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Response
          <Badge variant={getStatusColor(response.status) as any}>
            {response.status} {response.statusText}
          </Badge>
          <div className="text-sm text-muted-foreground ml-auto">
            {response.time}ms • {formatSize(response.size)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="body" className="w-full">
          <TabsList>
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
            <TabsTrigger value="cookies">Cookies</TabsTrigger>
          </TabsList>

          <TabsContent value="body">
            <pre className="whitespace-pre-wrap break-all rounded-lg bg-muted p-4 text-sm font-mono">
              {JSON.stringify(response.data, null, 2)}
            </pre>
          </TabsContent>

          <TabsContent value="headers">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              {Object.entries(response.headers).map(([key, value]) => (
                <div key={key} className="grid grid-cols-3 gap-4 text-sm">
                  <div className="font-medium">{key}</div>
                  <div className="col-span-2 font-mono">{value}</div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cookies">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              {Object.entries(response.cookies).length > 0 ? (
                Object.entries(response.cookies).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-4 text-sm">
                    <div className="font-medium">{key}</div>
                    <div className="col-span-2 font-mono">{value}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">
                  No cookies in response
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}