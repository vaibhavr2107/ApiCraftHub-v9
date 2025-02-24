import { RequestTabs } from "@/components/request-tabs";
import { Sidebar, type Collection, type CollectionFolder } from "@/components/sidebar";
import { CollectionHome } from "@/components/collection-home";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { useLocation } from "wouter";
import { ApiRequest, createApiRequest } from "@/types/api-request";
import { SidebarProvider } from "@/components/ui/sidebar";
import { EnvironmentEditor } from "@/components/environment-editor";

type View = "request-tabs" | "collection-home" | "environment-editor";

interface Environment {
  id: string;
  name: string;
  variables: { key: string; value: string }[];
}

export default function Home() {
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | null>(null);
  const [currentView, setCurrentView] = useState<View>("request-tabs");
  const [, setLocation] = useLocation();

  const getCollectionById = (collectionId: string): Collection | null => {
    const savedCollections = localStorage.getItem("collections");
    if (savedCollections) {
      const collections = JSON.parse(savedCollections);
      return collections.find((c: Collection) => c.id === collectionId) || null;
    }
    return null;
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

  const handleRequestSelect = (request: ApiRequest) => {
    const parentCollection = request.collectionId ? getCollectionById(request.collectionId) : null;

    // Check if request tab already exists
    const savedRequests = localStorage.getItem("saved_requests");
    const requests = savedRequests ? JSON.parse(savedRequests) : [];
    const routeId = generateRouteId(parentCollection, request);

    const existingRequest = requests.find((r: ApiRequest) =>
      generateRouteId(parentCollection, r) === routeId
    );

    if (existingRequest) {
      // If request exists, just activate its tab
      window.dispatchEvent(new CustomEvent('activateTab', { detail: existingRequest.id }));
      return;
    }

    // Process URL and query parameters
    let processedUrl = request.url;
    let processedQueryParams = [...request.queryParams];

    if (parentCollection) {
      try {
        // Substitute variables in the URL
        processedUrl = substituteVariables(processedUrl, parentCollection);

        // Handle query parameters
        const urlParts = processedUrl.split('?');
        const baseUrl = urlParts[0];
        const queryString = urlParts[1];

        // Process existing query parameters from URL
        if (queryString) {
          const existingParams = new URLSearchParams(queryString);
          const urlQueryParams = Array.from(existingParams.entries()).map(([key, value]) => ({
            key: substituteVariables(key, parentCollection),
            value: substituteVariables(decodeURIComponent(value), parentCollection),
            enabled: true
          }));

          // Combine URL query params with explicit query params
          processedQueryParams = [...urlQueryParams, ...processedQueryParams].map(param => ({
            key: substituteVariables(param.key, parentCollection),
            value: substituteVariables(param.value, parentCollection),
            enabled: param.enabled ?? true
          }));
        }

        // Format URL properly
        processedUrl = baseUrl;
        if (!processedUrl.startsWith('{{') && !processedUrl.match(/^https?:\/\//i)) {
          processedUrl = `https://${processedUrl}`;
        }

        // Remove trailing slash if present
        if (processedUrl.endsWith('/')) {
          processedUrl = processedUrl.slice(0, -1);
        }
      } catch (e) {
        console.error('Error processing URL:', e);
      }
    }

    // Create a new request using the factory function
    const newRequest = createApiRequest({
      name: request.name,
      method: request.method,
      url: processedUrl,
      collectionId: request.collectionId,
      queryParams: processedQueryParams.length > 0 ? processedQueryParams : [{ key: "", value: "", enabled: true }],
      pathVariables: request.pathVariables?.map(param => ({
        key: parentCollection ? substituteVariables(param.key, parentCollection) : param.key,
        value: parentCollection ? substituteVariables(param.value, parentCollection) : param.value,
        enabled: param.enabled ?? true
      })) || [],
      headers: request.headers,
      auth: request.auth,
      body: request.body
    });

    // Add request to local storage
    localStorage.setItem("saved_requests", JSON.stringify([...requests, newRequest]));

    // Force RequestTabs to reload and activate the new tab
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent('activateTab', { detail: newRequest.id }));
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
    // Update the collection in localStorage
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
    // Get all environments and update the specific one
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
    const updatedHistory = [historyEntry, ...history].slice(0, 50); // Keep last 50 requests
    localStorage.setItem("request_history", JSON.stringify(updatedHistory));

    // Trigger storage event for history updates
    window.dispatchEvent(new Event("storage"));
  };

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