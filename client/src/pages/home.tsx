import { RequestTabs } from "@/components/request-tabs";
import { Sidebar } from "@/components/sidebar";
import { Request } from "@shared/schema";
import { useLocation } from "wouter";

export default function Home() {
  const [location, setLocation] = useLocation();

  const handleRequestSelect = (request: Request) => {
    console.log('Home: Request selected:', request);
    // First change location, which will trigger the tab creation
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