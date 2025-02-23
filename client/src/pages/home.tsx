import { RequestPanel } from "@/components/request-panel";
import { ResponsePanel } from "@/components/response-panel";
import { useState } from "react";

export type RequestData = {
  method: string;
  url: string;
  body?: string;
};

export type ResponseData = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
};

export default function Home() {
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container py-4">
          <h1 className="text-2xl font-bold">API Request Tester</h1>
        </div>
      </header>

      <main className="container py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <RequestPanel
            onResponse={setResponse}
            onLoading={setIsLoading}
            onError={setError}
          />
          <ResponsePanel
            response={response}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </main>
    </div>
  );
}
