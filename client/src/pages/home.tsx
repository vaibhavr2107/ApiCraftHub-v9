import { RequestTabs } from "@/components/request-tabs";
import { Sidebar, type CollectionRequest } from "@/components/sidebar";

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
  const handleRequestSelect = (request: CollectionRequest) => {
    // TODO: Open request in a new tab
    console.log("Selected request:", request);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onRequestSelect={handleRequestSelect} />
      <div className="flex-1">
        <header className="border-b">
          <div className="container py-4">
            <h1 className="text-2xl font-bold">API Request Tester</h1>
          </div>
        </header>

        <main>
          <RequestTabs />
        </main>
      </div>
    </div>
  );
}