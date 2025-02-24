import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload } from "lucide-react";
import { useState, useEffect } from "react";
import { nanoid } from "nanoid";
import { useToast } from "@/hooks/use-toast";
import { ApiRequest, createApiRequest } from "@/types/api-request";

export interface Collection {
  id: string;
  name: string;
  description?: string;
  requests: ApiRequest[];
  folders?: CollectionFolder[];
  variables: CollectionVariable[];
  auth?: {
    type: "none" | "basic" | "bearer" | "oauth2";
    basic?: { username: string; password: string; };
    bearer?: { token: string; };
    oauth2?: any;
  };
}

export interface CollectionVariable {
  id: string;
  key: string;
  value: string;
  type: "default" | "secret";
  description?: string;
}

export interface CollectionFolder {
  id: string;
  name: string;
  requests: ApiRequest[];
  folders?: CollectionFolder[];
}

interface SidebarProps {
  onRequestSelect: (request: ApiRequest) => void;
  onCollectionSelect: (collection: Collection) => void;
}

export function Sidebar({ onRequestSelect, onCollectionSelect }: SidebarProps) {
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Load collections from localStorage on component mount
  useEffect(() => {
    const savedCollections = localStorage.getItem("collections");
    if (savedCollections) {
      try {
        setCollections(JSON.parse(savedCollections));
      } catch (error) {
        console.error("Failed to load collections:", error);
      }
    }
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newCollections: Collection[] = [];
    const existingCollections = new Set(collections.map(c => c.name.toLowerCase()));

    const filePromises = Array.from(files).map(async (file) => {
      try {
        const content = await file.text();
        if (file.name.endsWith('.json')) {
          const json = JSON.parse(content);
          const collection = parsePostmanCollection(json);

          // Check if collection already exists
          if (existingCollections.has(collection.name.toLowerCase())) {
            toast({
              variant: "destructive",
              title: "Error",
              description: `Collection "${collection.name}" already exists.`,
            });
            return;
          }

          newCollections.push(collection);
          existingCollections.add(collection.name.toLowerCase());

          toast({
            title: "Success",
            description: `Imported collection: ${collection.name}`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: `Unsupported file format: ${file.name}`,
          });
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to import ${file.name}. Please check the file format.`,
        });
      }
    });

    await Promise.all(filePromises);

    if (newCollections.length > 0) {
      const updatedCollections = [...collections, ...newCollections];
      setCollections(updatedCollections);
      localStorage.setItem("collections", JSON.stringify(updatedCollections));
    }

    event.target.value = '';
  };

  const parsePostmanCollection = (json: any): Collection => {
    // Parse collection variables
    const variables: CollectionVariable[] = (json.variable || []).map((v: any) => ({
      id: nanoid(),
      key: v.key || '',
      value: v.value || '',
      type: v.type === 'secret' ? 'secret' : 'default',
      description: v.description
    }));

    const collectionId = nanoid();

    const parseItem = (item: any): ApiRequest | CollectionFolder => {
      if (item.request) {
        // Parse URL components
        const url = typeof item.request.url === 'string'
          ? { raw: item.request.url }
          : item.request.url;

        const queryParams = url?.query?.map((q: any) => ({
          key: q.key || '',
          value: q.value || '',
          enabled: !q.disabled
        })) || [];

        const pathVariables = url?.variable?.map((v: any) => ({
          key: v.key || '',
          value: v.value || '',
          enabled: true
        })) || [];

        // Validate and parse request body mode
        const validBodyModes = ["none", "form-data", "x-www-form-urlencoded", "raw"] as const;
        const validRawFormats = ["json", "text", "xml", "html"] as const;

        const bodyMode = item.request.body?.mode;
        const validatedMode = validBodyModes.find(m => m === bodyMode) || "none";

        // Parse request body with proper type validation
        const body = item.request.body ? {
          type: validatedMode,
          rawFormat: validatedMode === "raw"
            ? (validRawFormats.find(f => f === item.request.body.options?.raw?.language) || "json")
            : undefined,
          content: validatedMode === "raw" ? item.request.body[validatedMode] : undefined,
          formData: validatedMode === "form-data" ? item.request.body.formdata?.map((f: any) => ({
            key: f.key,
            value: f.value,
            type: f.type === "file" ? "file" : "text",
            enabled: !f.disabled
          })) : undefined,
          urlEncoded: validatedMode === "x-www-form-urlencoded" ? item.request.body.urlencoded?.map((u: any) => ({
            key: u.key,
            value: u.value,
            enabled: !u.disabled
          })) : undefined
        } : {
          type: "none" as const,
          rawFormat: "json" as const,
          content: ""
        };

        // Parse authentication
        const auth = item.request.auth || json.auth;
        const authData = auth ? {
          type: auth.type as "none" | "basic" | "bearer" | "oauth2",
          basic: auth.type === 'basic' ? {
            username: auth.basic?.[0]?.value || '',
            password: auth.basic?.[1]?.value || ''
          } : undefined,
          bearer: auth.type === 'bearer' ? {
            token: auth.bearer?.[0]?.value || ''
          } : undefined,
          oauth2: auth.type === 'oauth2' ? auth.oauth2 : undefined
        } : { type: "none" as const };

        return createApiRequest({
          name: item.name,
          method: item.request.method,
          url: url?.raw || "",
          collectionId,
          headers: (item.request.header || []).map((h: any) => ({
            key: h.key,
            value: h.value,
            enabled: !h.disabled
          })),
          queryParams,
          pathVariables,
          body,
          auth: authData
        });
      } else {
        // This is a folder
        const { requests, folders } = processItems(item.item || []);
        return {
          id: nanoid(),
          name: item.name,
          requests,
          folders
        };
      }
    };

    const processItems = (items: any[] = []): { requests: ApiRequest[], folders: CollectionFolder[] } => {
      const requests: ApiRequest[] = [];
      const folders: CollectionFolder[] = [];

      items.forEach(item => {
        const parsed = parseItem(item);
        if ('url' in parsed) {
          requests.push(parsed as ApiRequest);
        } else {
          folders.push(parsed as CollectionFolder);
        }
      });

      return { requests, folders };
    };

    const { requests, folders } = processItems(json.item);
    return {
      id: collectionId,
      name: json.info?.name || "Imported Collection",
      description: json.info?.description,
      requests,
      folders,
      variables,
      auth: json.auth ? {
        type: json.auth.type as "none" | "basic" | "bearer" | "oauth2",
        basic: json.auth.type === 'basic' ? {
          username: json.auth.basic?.[0]?.value || '',
          password: json.auth.basic?.[1]?.value || ''
        } : undefined,
        bearer: json.auth.type === 'bearer' ? {
          token: json.auth.bearer?.[0]?.value || ''
        } : undefined,
        oauth2: json.auth.type === 'oauth2' ? json.auth.oauth2 : undefined
      } : { type: "none" }
    };
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFolder = (folder: CollectionFolder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const paddingLeft = `${level * 1.5}rem`;

    return (
      <div key={folder.id}>
        <Button
          variant="ghost"
          className="w-full justify-start"
          style={{ paddingLeft }}
          onClick={() => toggleFolder(folder.id)}
        >
          <span className="mr-2">{isExpanded ? "📂" : "📁"}</span>
          {folder.name}
        </Button>
        {isExpanded && (
          <div>
            {folder.requests.map((request) => renderRequest(request, level + 1))}
            {folder.folders?.map((subfolder) =>
              renderFolder(subfolder, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderRequest = (request: ApiRequest, level = 0) => {
    const paddingLeft = `${level * 1.5}rem`;
    const methodColors: Record<string, string> = {
      GET: "text-green-600",
      POST: "text-blue-600",
      PUT: "text-orange-600",
      DELETE: "text-red-600",
      PATCH: "text-purple-600"
    };

    return (
      <Button
        key={request.id}
        variant="ghost"
        className="w-full justify-start"
        style={{ paddingLeft }}
        onClick={() => onRequestSelect(request)}
      >
        <span className={`mr-2 font-mono font-semibold ${methodColors[request.method] || "text-gray-600"}`}>
          {request.method}
        </span>
        {request.name}
      </Button>
    );
  };

  return (
    <div className="w-64 border-r bg-muted/40 h-screen">
      <div className="p-4 border-b">
        <div className="cursor-pointer">
          <input
            type="file"
            accept=".json"
            className="hidden"
            multiple
            onChange={handleFileUpload}
            id="collection-import"
          />
          <label htmlFor="collection-import">
            <Button variant="outline" className="w-full" asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Import Collection
              </span>
            </Button>
          </label>
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-5rem)]">
        <div className="p-2">
          {collections.map((collection) => (
            <div key={collection.id} className="mb-4">
              <Button
                variant="ghost"
                className="w-full justify-start font-medium px-2 py-1"
                onClick={() => onCollectionSelect(collection)}
              >
                {collection.name}
              </Button>
              {collection.folders?.map((folder) => renderFolder(folder))}
              {collection.requests.map((request) => renderRequest(request))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}