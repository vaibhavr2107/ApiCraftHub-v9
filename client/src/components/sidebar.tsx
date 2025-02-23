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
  body?: {
    type: "none" | "form-data" | "x-www-form-urlencoded" | "raw";
    content?: any;
  };
}

interface SidebarProps {
  onRequestSelect: (request: CollectionRequest) => void;
}

export function Sidebar({ onRequestSelect }: SidebarProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
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
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      let collection: Collection;

      if (file.name.endsWith('.json')) {
        // Parse Postman Collection
        const json = JSON.parse(content);
        collection = parsePostmanCollection(json);
      } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        // Parse OpenAPI YAML
        collection = parseOpenAPICollection(content);
      } else {
        throw new Error('Unsupported file format');
      }

      setCollections([...collections, collection]);
      toast({
        title: "Success",
        description: `Imported collection: ${collection.name}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to import collection. Please check the file format.",
      });
    }
  };

  const parsePostmanCollection = (json: any): Collection => {
    const parseItem = (item: any): CollectionRequest | CollectionFolder => {
      if (item.request) {
        // This is a request
        return {
          id: nanoid(),
          name: item.name,
          method: item.request.method,
          url: typeof item.request.url === 'string' ? item.request.url : item.request.url.raw,
          headers: (item.request.header || []).map((h: any) => ({
            key: h.key,
            value: h.value,
            enabled: !h.disabled
          })),
          body: item.request.body ? {
            type: item.request.body.mode || "none",
            content: item.request.body[item.request.body.mode]
          } : undefined
        };
      } else {
        // This is a folder
        return {
          id: nanoid(),
          name: item.name,
          requests: [],
          folders: [],
          ...processItems(item.item)
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

  const parseOpenAPICollection = (yaml: string): Collection => {
    // Basic OpenAPI parsing
    return {
      id: nanoid(),
      name: "OpenAPI Collection",
      requests: [], // TODO: Implement full parsing
      folders: [], // TODO: Implement full parsing
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

    return (
      <Button
        key={request.id}
        variant="ghost"
        className="w-full justify-start"
        style={{ paddingLeft }}
        onClick={() => onRequestSelect(request)}
      >
        <span className="mr-2">📄</span>
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
            accept=".json,.yaml,.yml"
            className="hidden"
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