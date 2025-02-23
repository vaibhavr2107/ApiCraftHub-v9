import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponseData } from "@/pages/home";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
          <Badge variant={getStatusColor(response.status)}>
            {response.status} {response.statusText}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap break-all rounded-lg bg-muted p-4 text-sm">
          {JSON.stringify(response.data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
