import { RequestTabs } from "@/components/request-tabs";
import { Sidebar } from "@/components/sidebar";
import { Request } from "@shared/schema";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { generateRouteId } from "@/lib/utils";

export default function Home() {
  const [location, setLocation] = useLocation();

  // Create and open a default request only if we're at root and no requests are open
  useEffect(() => {
    console.log('Home: Checking current route');
    if (location === '/') {
      console.log('Home: At root, checking for existing requests');
      const savedRequests = localStorage.getItem('active_requests');
      if (!savedRequests || JSON.parse(savedRequests).length === 0) {
        console.log('Home: No existing requests, creating new request');
        const newRequestId = generateRouteId('new-request-v1');
        setLocation(`/request/${newRequestId}`);
      } else {
        console.log('Home: Using existing requests');
        const requests = JSON.parse(savedRequests);
        setLocation(`/request/${requests[0].routeId}`);
      }
    }
  }, [location, setLocation]);

  const handleRequestSelect = (request: Request) => {
    console.log('Home: Request selected from sidebar:', request);
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
          <RequestTabs />
        </main>
      </div>
    </div>
  );
}