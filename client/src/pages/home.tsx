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

const generateRequestId = (requestName: string, collectionName?: string): string => {
  const cleanName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return collectionName 
    ? `${cleanName(collectionName)}-${cleanName(requestName)}`
    : cleanName(requestName);
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

  const handleRequestSelect = (request: ApiRequest) => {
    setCurrentView("request-tabs");
    setSelectedCollection(null);

    // Find parent collection if this is a collection request
    const parentCollection = request.collectionId ? getCollectionById(request.collectionId) : null;

    // Generate the route ID based on collection name if available
    const routeId = parentCollection 
      ? generateRequestId(request.name, parentCollection.name)
      : request.id;

    // Update the URL to reflect the collection structure if applicable
    const newPath = parentCollection
      ? `/request/${generateRequestId(parentCollection.name)}/${generateRequestId(request.name)}`
      : `/request/${routeId}`;

    setLocation(newPath);
    window.dispatchEvent(new CustomEvent('activateTab', { detail: routeId }));
  };

  const findCollectionRequest = (path: string): ApiRequest | null => {
    const parts = path.split('/');
    if (parts.length < 3) return null;

    // Check if this is a direct request ID path
    if (parts.length === 3) {
      const savedRequests = localStorage.getItem("saved_requests");
      if (savedRequests) {
        const requests = JSON.parse(savedRequests);
        return requests.find((r: ApiRequest) => r.id === parts[2]) || null;
      }
      return null;
    }

    // Handle collection request path: /request/collection-name/request-name
    const collectionName = parts[2];
    const requestPath = parts.slice(3).join('-');

    const savedCollections = localStorage.getItem("collections");
    if (!savedCollections) return null;

    const collections = JSON.parse(savedCollections);
    const collection = collections.find((c: Collection) =>
      generateRequestId(c.name) === collectionName
    );

    if (!collection) return null;

    const searchInFolder = (folder: CollectionFolder): ApiRequest | null => {
      const request = folder.requests.find(r => generateRequestId(r.name, collection.name) === requestPath);

      if (request) {
        return {
          ...request,
          collectionId: collection.id,
          collectionName: collection.name,
          id: generateRequestId(request.name, collection.name)
        };
      }

      if (folder.folders) {
        for (const subfolder of folder.folders) {
          const found = searchInFolder(subfolder);
          if (found) return found;
        }
      }
      return null;
    };

    // Search in root requests
    let request = collection.requests.find(r => generateRequestId(r.name, collection.name) === requestPath);

    if (request) {
      request = {
        ...request,
        collectionId: collection.id,
        collectionName: collection.name,
        id: generateRequestId(request.name, collection.name)
      };
    }

    // If not found in root, search in folders
    if (!request && collection.folders) {
      for (const folder of collection.folders) {
        request = searchInFolder(folder);
        if (request) break;
      }
    }

    return request;
  };

  const generateRouteId = (collection: Collection | null, request: ApiRequest): string => {
    const collectionName = collection ? collection.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'request';
    const requestName = request.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${collectionName}-${requestName}`;
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
        body: request.body
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
          const exists = savedRequests.some((r: ApiRequest) => r.id === request.id);
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