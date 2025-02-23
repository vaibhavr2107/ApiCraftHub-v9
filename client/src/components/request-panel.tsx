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
import { useState } from "react";
import { makeRequest } from "@/lib/api";
import { ResponseData } from "@/pages/home";
import { useToast } from "@/hooks/use-toast";

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

interface RequestPanelProps {
  onResponse: (response: ResponseData) => void;
  onLoading: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
}

export function RequestPanel({ onResponse, onLoading, onError }: RequestPanelProps) {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://api.restful-api.dev/objects");
  const [body, setBody] = useState("");
  const { toast } = useToast();

  const handleSend = async () => {
    onLoading(true);
    onError(null);

    try {
      const response = await makeRequest({
        method,
        url,
        body: body ? JSON.parse(body) : undefined,
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

  const showBody = method !== "GET" && method !== "DELETE";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={method} onValueChange={setMethod}>
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
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL"
            className="flex-1"
          />
        </div>

        {showBody && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Request Body (JSON)</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="{}"
              className="font-mono"
              rows={8}
            />
          </div>
        )}

        <Button onClick={handleSend} className="w-full">
          Send Request
        </Button>
      </CardContent>
    </Card>
  );
}
