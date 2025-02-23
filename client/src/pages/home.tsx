import { RequestTabs } from "@/components/request-tabs";
import { Sidebar, type CollectionRequest } from "@/components/sidebar";
import { nanoid } from "nanoid";

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
    // Convert CollectionRequest to SavedRequest format with all parameters
    const newRequest = {
      id: nanoid(),
      name: request.name,
      method: request.method,
      url: request.url,
      queryParams: request.queryParams || [{ key: "", value: "" }],
      pathVariables: request.pathVariables || [],
      headers: request.headers || [
        { key: "Accept", value: "*/*", enabled: true },
        { key: "User-Agent", value: "API-Tester/1.0", enabled: true },
        { key: "Content-Type", value: "application/json", enabled: true }
      ],
      auth: request.auth || { type: "none" },
      body: request.body || {
        type: "none",
        rawFormat: "json",
        raw: "",
        formData: [],
        urlEncoded: []
      }
    };

    // Add request to local storage
    const savedRequests = localStorage.getItem("saved_requests");
    const requests = savedRequests ? JSON.parse(savedRequests) : [];
    localStorage.setItem("saved_requests", JSON.stringify([...requests, newRequest]));

    // Force RequestTabs to reload
    window.dispatchEvent(new Event("storage"));
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