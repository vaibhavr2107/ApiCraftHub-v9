import { RequestTabs } from "@/components/request-tabs";

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