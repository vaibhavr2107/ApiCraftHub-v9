import { RequestTabs } from "@/components/request-tabs";
import { Sidebar, type Collection, type CollectionFolder } from "@/components/sidebar";
import { CollectionHome } from "@/components/collection-home";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { nanoid } from "nanoid";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ApiRequest, createApiRequest } from "@/types/api-request";
import { SidebarProvider } from "@/components/ui/sidebar";
import { EnvironmentEditor } from "@/components/environment-editor";
import { useToast } from "@/hooks/use-toast";

type View = "request-tabs" | "collection-home" | "environment-editor";

interface Environment {
  id: string;
  name: string;
  variables: { key: string; value: string }[];
}

const generateRouteId = (requestName: string, collectionName?: string, version?: number): string => {
  const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const baseRouteId = collectionName 
    ? `${cleanName(collectionName)}-${cleanName(requestName)}`
    : cleanName(requestName);

  return version ? `${baseRouteId}-v${version}` : baseRouteId;
};

export default function Home() {
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | null>(null);
  const [currentView, setCurrentView] = useState<View>("request-tabs");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const getCollectionById = (collectionId: string): Collection | null => {
    const savedCollections = localStorage.getItem("collections");
    if (savedCollections) {
      const collections = JSON.parse(savedCollections);
      return collections.find((c: Collection) => c.id === collectionId) || null;
    }
    return null;
  };

  const findRequestByRouteId = (routeId: string): ApiRequest | null => {
    // First check saved requests
    const savedRequests = localStorage.getItem("saved_requests");
    if (savedRequests) {
      const requests = JSON.parse(savedRequests);
      const request = requests.find((r: ApiRequest) => r.routeId === routeId);
      if (request) return request;
    }

    // Then check collections
    const savedCollections = localStorage.getItem("collections");
    if (!savedCollections) return null;

    const collections = JSON.parse(savedCollections);

    const searchInFolder = (folder: CollectionFolder, collection: Collection): ApiRequest | null => {
      const request = folder.requests.find(r => r.routeId === routeId);
      if (request) {
        return {
          ...request,
          collectionId: collection.id,
          collectionName: collection.name
        };
      }

      if (folder.folders) {
        for (const subfolder of folder.folders) {
          const found = searchInFolder(subfolder, collection);
          if (found) return found;
        }
      }
      return null;
    };

    for (const collection of collections) {
      // Check root requests
      const rootRequest = collection.requests.find(r => r.routeId === routeId);
      if (rootRequest) {
        return {
          ...rootRequest,
          collectionId: collection.id,
          collectionName: collection.name
        };
      }

      // Check in folders
      if (collection.folders) {
        for (const folder of collection.folders) {
          const request = searchInFolder(folder, collection);
          if (request) return request;
        }
      }
    }

    return null;
  };

  const handleRequestSelect = (request: ApiRequest) => {
    setCurrentView("request-tabs");
    setSelectedCollection(null);

    // Update the URL to use the route ID
    const newPath = `/request/${request.routeId}`;
    setLocation(newPath);
    window.dispatchEvent(new CustomEvent('activateTab', { detail: request.id }));
  };

  const findCollectionRequest = (path: string): ApiRequest | null => {
    const parts = path.split('/');
    if (parts.length !== 3) return null;

    const routeId = parts[2];
    return findRequestByRouteId(routeId);
  };

  const substituteVariables = (str: string, collection: Collection): string => {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const result = str.replace(variablePattern, (match, variableName) => {
      const trimmedName = variableName.trim();
      const variable = collection.variables?.find(v => v.key === trimmedName);
      return variable ? variable.value : match;
    });
    return result;
  };

  const handleEnvironmentSelect = (environment: Environment) => {
    setSelectedEnvironment(environment);
    setCurrentView("environment-editor");
  };

  const handleCollectionSelect = (collection: Collection) => {
    setSelectedCollection(collection);
    setCurrentView("collection-home");
  };

  const handleCollectionUpdate = (updatedCollection: Collection) => {
    const savedCollections = localStorage.getItem("collections");
    if (savedCollections) {
      const collections = JSON.parse(savedCollections);
      const updatedCollections = collections.map((c: Collection) =>
        c.id === updatedCollection.id ? updatedCollection : c
      );
      localStorage.setItem("collections", JSON.stringify(updatedCollections));
      setSelectedCollection(updatedCollection);
    }
  };

  const updateEnvironment = (updatedEnv: Environment) => {
    setSelectedEnvironment(updatedEnv);
    const savedEnvs = localStorage.getItem("environments");
    if (savedEnvs) {
      const environments = JSON.parse(savedEnvs);
      const updatedEnvironments = environments.map((env: Environment) =>
        env.id === updatedEnv.id ? updatedEnv : env
      );
      localStorage.setItem("environments", JSON.stringify(updatedEnvironments));
    }
  };

  const saveToHistory = (request: ApiRequest, response: any) => {
    const historyEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        queryParams: request.queryParams,
        body: request.body,
        routeId: request.routeId // Add routeId to history entry
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      }
    };

    const savedHistory = localStorage.getItem("request_history");
    const history = savedHistory ? JSON.parse(savedHistory) : [];
    const updatedHistory = [historyEntry, ...history].slice(0, 50);
    localStorage.setItem("request_history", JSON.stringify(updatedHistory));
    window.dispatchEvent(new Event("storage"));
  };

  useEffect(() => {
    if (location.startsWith('/request/')) {
      const request = findCollectionRequest(location);

      if (request) {
        const savedRequestsStr = localStorage.getItem("saved_requests");
        const savedRequests = savedRequestsStr ? JSON.parse(savedRequestsStr) : [];

        // Only save if it's not a collection request (has no collectionId)
        if (!request.collectionId) {
          const exists = savedRequests.some((r: ApiRequest) => r.routeId === request.routeId);
          if (!exists) {
            savedRequests.push(request);
            localStorage.setItem("saved_requests", JSON.stringify(savedRequests));
          }
        }

        window.dispatchEvent(new CustomEvent('activateTab', { detail: request.id }));
      } else {
        toast({
          variant: "destructive",
          title: "Request Not Found",
          description: "The requested collection or request could not be found.",
        });
        setLocation('/');
      }
    }
  }, [location, toast, setLocation]);

  const renderMainContent = () => {
    switch (currentView) {
      case "collection-home":
        return selectedCollection ? (
          <CollectionHome
            collection={selectedCollection}
            onUpdate={handleCollectionUpdate}
          />
        ) : null;
      case "environment-editor":
        return selectedEnvironment ? (
          <EnvironmentEditor
            environment={selectedEnvironment}
            onUpdate={updateEnvironment}
          />
        ) : null;
      default:
        return <RequestTabs onRequestComplete={saveToHistory} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarProvider>
        <Sidebar
          onRequestSelect={handleRequestSelect}
          onCollectionSelect={handleCollectionSelect}
          onEnvironmentSelect={handleEnvironmentSelect}
        />
      </SidebarProvider>
      <div className="flex-1">
        <header className="border-b">
          <div className="container flex items-center gap-4 py-4">
            {(currentView === "collection-home" || currentView === "environment-editor") && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCurrentView("request-tabs");
                  setSelectedCollection(null);
                  setSelectedEnvironment(null);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-2xl font-bold">
              {currentView === "collection-home" && selectedCollection
                ? selectedCollection.name
                : currentView === "environment-editor" && selectedEnvironment
                ? `Environment: ${selectedEnvironment.name}`
                : "API Request Tester"}
            </h1>
          </div>
        </header>

        <main className="p-4">
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
}