import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload } from "lucide-react";
import { useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "@/hooks/use-toast";

export interface Collection {
  id: string;
  name: string;
  requests: CollectionRequest[];
  folders?: CollectionFolder[];
}

export interface CollectionFolder {
  id: string;
  name: string;
  requests: CollectionRequest[];
  folders?: CollectionFolder[];
}

export interface CollectionRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: { key: string; value: string; enabled: boolean; }[];
  queryParams?: { key: string; value: string; }[];
  pathVariables?: { key: string; value: string; }[];
  body?: {
    type: "none" | "form-data" | "x-www-form-urlencoded" | "raw";
    rawFormat?: "json" | "text" | "xml" | "html";
    content?: any;
    formData?: { key: string; value: string; type: "text" | "file"; }[];
    urlEncoded?: { key: string; value: string; }[];
  };
  auth?: {
    type: "none" | "basic" | "bearer" | "oauth2";
    basic?: { username: string; password: string; };
    bearer?: { token: string; };
    oauth2?: any;
  };
}

interface SidebarProps {
  onRequestSelect: (request: CollectionRequest) => void;
}

export function Sidebar({ onRequestSelect }: SidebarProps) {
  const [collections, setCollections] = useState<Collection[]>(() => {
    const saved = localStorage.getItem("collections");
    return saved ? JSON.parse(saved) : [];
  });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newCollections: Collection[] = [];
    const filePromises = Array.from(files).map(async (file) => {
      try {
        const content = await file.text();
        let collection: Collection;

        if (file.name.endsWith('.json')) {
          const json = JSON.parse(content);
          collection = parsePostmanCollection(json);
          newCollections.push(collection);
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
  };

  const parsePostmanCollection = (json: any): Collection => {
    const parseItem = (item: any): CollectionRequest | CollectionFolder => {
      if (item.request) {
        // Parse URL components
        const url = typeof item.request.url === 'string' 
          ? { raw: item.request.url } 
          : item.request.url;

        const queryParams = url.query?.map((q: any) => ({
          key: q.key || '',
          value: q.value || '',
        })) || [];

        const pathVariables = url.variable?.map((v: any) => ({
          key: v.key || '',
          value: v.value || '',
        })) || [];

        // Parse request body
        const body = item.request.body ? {
          type: item.request.body.mode || "none",
          rawFormat: item.request.body.mode === 'raw' ? (item.request.body.options?.raw?.language || 'json') : undefined,
          content: item.request.body[item.request.body.mode],
          formData: item.request.body.formdata?.map((f: any) => ({
            key: f.key,
            value: f.value,
            type: f.type || 'text'
          })),
          urlEncoded: item.request.body.urlencoded?.map((u: any) => ({
            key: u.key,
            value: u.value
          }))
        } : undefined;

        // Parse authentication
        const auth = item.request.auth || json.auth;
        const authData = auth ? {
          type: auth.type || 'none',
          basic: auth.type === 'basic' ? {
            username: auth.basic?.[0]?.value || '',
            password: auth.basic?.[1]?.value || ''
          } : undefined,
          bearer: auth.type === 'bearer' ? {
            token: auth.bearer?.[0]?.value || ''
          } : undefined,
          oauth2: auth.type === 'oauth2' ? auth.oauth2 : undefined
        } : { type: 'none' };

        return {
          id: nanoid(),
          name: item.name,
          method: item.request.method,
          url: url.raw || "", // Handle cases where url.raw might be undefined.
          headers: (item.request.header || []).map((h: any) => ({
            key: h.key,
            value: h.value,
            enabled: !h.disabled
          })),
          queryParams,
          pathVariables,
          body,
          auth: authData
        };
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

    const processItems = (items: any[] = []): { requests: CollectionRequest[], folders: CollectionFolder[] } => {
      const requests: CollectionRequest[] = [];
      const folders: CollectionFolder[] = [];

      items.forEach(item => {
        const parsed = parseItem(item);
        if ('url' in parsed) {
          requests.push(parsed as CollectionRequest);
        } else {
          folders.push(parsed as CollectionFolder);
        }
      });

      return { requests, folders };
    };

    const { requests, folders } = processItems(json.item);
    return {
      id: nanoid(),
      name: json.info?.name || "Imported Collection",
      requests,
      folders
    };
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

  const renderRequest = (request: CollectionRequest, level = 0) => {
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
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".json"
            className="hidden"
            multiple
            onChange={handleFileUpload}
          />
          <Button variant="outline" className="w-full">
            <Upload className="mr-2 h-4 w-4" />
            Import Collection
          </Button>
        </label>
      </div>
      <ScrollArea className="h-[calc(100vh-5rem)]">
        <div className="p-2">
          {collections.map((collection) => (
            <div key={collection.id} className="mb-4">
              <div className="font-medium px-2 py-1">{collection.name}</div>
              {collection.folders?.map((folder) => renderFolder(folder))}
              {collection.requests.map((request) => renderRequest(request))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}