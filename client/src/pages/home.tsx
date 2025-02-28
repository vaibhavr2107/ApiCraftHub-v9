import { RequestTabs } from "@/components/request-tabs";
import { Sidebar } from "@/components/sidebar";
import { Request } from "@shared/schema";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { generateRouteId } from "@/lib/utils";

export default function Home() {
  const [location, setLocation] = useLocation();
  const [selectedRequest, setSelectedRequest] = useState<Request | undefined>();

  // Create and open a default request only if we're at root
  useEffect(() => {
    console.log('Home: Checking current route');
    if (location === '/') {
      console.log('Home: At root, redirecting to new request');
      const newRequestId = generateRouteId('new-request');
      setLocation(`/request/${newRequestId}`);
    }
  }, []);

  const handleRequestSelect = (request: Request) => {
    console.log('Home: Request selected from sidebar:', request);
    // Store the selected request and change location
    setSelectedRequest(request);
    setLocation(`/request/${request.routeId}`);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onRequestSelect={handleRequestSelect} />
      <div className="flex-1">
        <header className="border-b">
          <div className="container flex items-center gap-4 py-4">
            <h1 className="text-2xl font-bold ml-4">API Hub</h1>
          </div>
        </header>
        <main className="p-4">
          <RequestTabs selectedRequest={selectedRequest} />
        </main>
      </div>
    </div>
  );
}