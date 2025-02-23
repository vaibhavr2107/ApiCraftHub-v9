import { RequestTabs } from "@/components/request-tabs";
import { Sidebar, type Collection, type CollectionRequest } from "@/components/sidebar";
import { CollectionHome } from "@/components/collection-home";
import { nanoid } from "nanoid";
import { useState } from "react";

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

    // Convert CollectionRequest to SavedRequest format with all parameters
    const newRequest = {
      id: nanoid(),
      name: request.name,
      method: request.method,
      url: parentCollection ? substituteVariables(request.url, parentCollection) : request.url,
      queryParams: request.queryParams?.map(param => ({
        key: parentCollection ? substituteVariables(param.key, parentCollection) : param.key,
        value: parentCollection ? substituteVariables(param.value, parentCollection) : param.value
      })) || [{ key: "", value: "" }],
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

    // Add request to local storage
    const savedRequests = localStorage.getItem("saved_requests");
    const requests = savedRequests ? JSON.parse(savedRequests) : [];
    localStorage.setItem("saved_requests", JSON.stringify([...requests, newRequest]));

    // Force RequestTabs to reload
    window.dispatchEvent(new Event("storage"));
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
          <div className="container py-4">
            <h1 className="text-2xl font-bold">API Request Tester</h1>
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