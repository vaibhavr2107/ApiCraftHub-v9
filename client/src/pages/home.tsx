import { RequestTabs } from "@/components/request-tabs";
import { Sidebar, type Collection, type CollectionRequest } from "@/components/sidebar";
import { CollectionHome } from "@/components/collection-home";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { nanoid } from "nanoid";
import { useState } from "react";
import { useLocation } from "wouter";

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
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [, setLocation] = useLocation();

  const substituteVariables = (str: string, collection: Collection): string => {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    return str.replace(variablePattern, (match, variableName) => {
      const variable = collection.variables?.find(v => v.key === variableName);
      return variable ? variable.value : match;
    });
  };

  const handleRequestSelect = (request: CollectionRequest) => {
    // Get the parent collection for this request to access its variables
    const parentCollection = selectedCollection;

    // Process URL and query parameters
    let processedUrl = request.url;
    let processedQueryParams = request.queryParams || [];

    if (parentCollection) {
      processedUrl = substituteVariables(request.url, parentCollection);
      // Extract existing query parameters from the URL
      const urlObj = new URL(processedUrl, 'http://placeholder.com');
      const urlQueryParams = Array.from(urlObj.searchParams.entries()).map(([key, value]) => ({
        key,
        value
      }));
      // Combine URL query params with explicit query params
      processedQueryParams = [...urlQueryParams, ...(request.queryParams || [])].map(param => ({
        key: substituteVariables(param.key, parentCollection),
        value: substituteVariables(param.value, parentCollection)
      }));
      // Remove query string from URL as we're handling them separately
      processedUrl = urlObj.origin + urlObj.pathname;
    }

    // Convert CollectionRequest to SavedRequest format with all parameters
    const newRequest = {
      id: nanoid(),
      name: request.name,
      method: request.method,
      url: processedUrl,
      queryParams: processedQueryParams.length > 0 ? processedQueryParams : [{ key: "", value: "" }],
      pathVariables: request.pathVariables?.map(param => ({
        key: parentCollection ? substituteVariables(param.key, parentCollection) : param.key,
        value: parentCollection ? substituteVariables(param.value, parentCollection) : param.value
      })) || [],
      headers: request.headers?.map(header => ({
        key: parentCollection ? substituteVariables(header.key, parentCollection) : header.key,
        value: parentCollection ? substituteVariables(header.value, parentCollection) : header.value,
        enabled: header.enabled
      })) || [
        { key: "Accept", value: "*/*", enabled: true },
        { key: "User-Agent", value: "API-Tester/1.0", enabled: true },
        { key: "Content-Type", value: "application/json", enabled: true }
      ],
      auth: request.auth || parentCollection?.auth || { type: "none" },
      body: request.body ? {
        type: request.body.type,
        rawFormat: request.body.rawFormat || "json",
        raw: parentCollection && typeof request.body.content === 'string' 
          ? substituteVariables(request.body.content, parentCollection)
          : request.body.content || "",
        formData: request.body.formData?.map(field => ({
          key: parentCollection ? substituteVariables(field.key, parentCollection) : field.key,
          value: parentCollection ? substituteVariables(field.value, parentCollection) : field.value,
          type: field.type
        })) || [],
        urlEncoded: request.body.urlEncoded?.map(field => ({
          key: parentCollection ? substituteVariables(field.key, parentCollection) : field.key,
          value: parentCollection ? substituteVariables(field.value, parentCollection) : field.value
        })) || []
      } : {
        type: "none",
        rawFormat: "json",
        raw: "",
        formData: [],
        urlEncoded: []
      }
    };

    // Add request to local storage and navigate to its tab
    const savedRequests = localStorage.getItem("saved_requests");
    const requests = savedRequests ? JSON.parse(savedRequests) : [];
    localStorage.setItem("saved_requests", JSON.stringify([...requests, newRequest]));

    // Switch to request view and navigate to the new request's tab
    setSelectedCollection(null);
    setLocation(`/request/${newRequest.id}`);
  };

  const handleCollectionSelect = (collection: Collection) => {
    setSelectedCollection(collection);
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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar 
        onRequestSelect={handleRequestSelect}
        onCollectionSelect={handleCollectionSelect}
      />
      <div className="flex-1">
        <header className="border-b">
          <div className="container flex items-center gap-4 py-4">
            {selectedCollection && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedCollection(null)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-2xl font-bold">
              {selectedCollection ? selectedCollection.name : "API Request Tester"}
            </h1>
          </div>
        </header>

        <main className="p-4">
          {selectedCollection ? (
            <CollectionHome
              collection={selectedCollection}
              onUpdate={handleCollectionUpdate}
            />
          ) : (
            <RequestTabs />
          )}
        </main>
      </div>
    </div>
  );
}