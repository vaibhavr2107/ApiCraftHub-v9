import { RequestTabs } from "@/components/request-tabs";

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
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container py-4">
          <h1 className="text-2xl font-bold">API Request Tester</h1>
        </div>
      </header>

      <main>
        <RequestTabs />
      </main>
    </div>
  );
}