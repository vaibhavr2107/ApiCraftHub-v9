import { ViewSection } from "@/components/view-section";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Upload, ChevronDown, ChevronRight, FolderClosed, FolderOpen, FileText, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { nanoid } from "nanoid";
import { useToast } from "@/hooks/use-toast";
import { ApiRequest, createApiRequest } from "@/types/api-request";
import { generateRequestId } from "@/lib/utils";
import cn from 'classnames';
import { OpenAPIViewer } from "./openapi-viewer";

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

interface Environment {
  id: string;
  name: string;
  variables: { key: string; value: string }[];
}

interface SidebarProps {
  onRequestSelect: (request: ApiRequest) => void;
  onCollectionSelect: (collection: Collection) => void;
  onEnvironmentSelect: (environment: Environment) => void;
}

interface SearchResult {
  collectionName: string;
  itemType: 'request' | 'folder';
  request?: ApiRequest;
  folder?: CollectionFolder;
  path: string[];
}


const parsePostmanCollection = (json: any): Collection => {
  try {
    const collectionName = json.info?.name || "Imported Collection";
    const collectionId = nanoid();

    const parseItem = (item: any): ApiRequest | CollectionFolder => {
      if (item.request) {
        let urlData = item.request.url;
        if (typeof urlData === 'string') {
          urlData = { raw: urlData };
        }

        const pathVariables = urlData.variable?.map((v: {
          key: string;
          value: string;
          description?: string
        }) => ({
          key: v.key || '',
          value: v.value || '',
          enabled: true,
          description: v.description
        })) || [];

        if (urlData.path) {
          urlData.path.forEach((segment: string) => {
            if (typeof segment === 'string' && segment.startsWith(':')) {
              const varName = segment.substring(1);
              if (!pathVariables.some(v => v.key === varName)) {
                pathVariables.push({
                  key: varName,
                  value: '',
                  enabled: true
                });
              }
            }
          });
        }

        let queryParams: Array<{ key: string; value: string; enabled: boolean; description?: string }> = [];

        if (urlData.query) {
          queryParams = urlData.query.map((q: any) => ({
            key: q.key || '',
            value: q.value || '',
            enabled: !q.disabled,
            description: q.description
          }));
        }

        if (urlData.raw && queryParams.length === 0) {
          try {
            const urlString = urlData.raw;
            const questionMarkIndex = urlString.indexOf('?');
            if (questionMarkIndex !== -1) {
              const queryString = urlString.substring(questionMarkIndex + 1);
              const searchParams = new URLSearchParams(queryString);
              const urlQueryParams = Array.from(searchParams.entries()).map(([key, value]) => ({
                key,
                value,
                enabled: true
              }));
              queryParams = [...queryParams, ...urlQueryParams];
            }
          } catch (e) {
            console.error('Error parsing URL query parameters:', e);
          }
        }

        let baseUrl = urlData.raw || '';
        const questionMarkIndex = baseUrl.indexOf('?');
        if (questionMarkIndex !== -1) {
          baseUrl = baseUrl.substring(0, questionMarkIndex);
        }

        pathVariables.forEach(variable => {
          baseUrl = baseUrl.replace(`:${variable.key}`, `{{${variable.key}}}`);
        });


        const validBodyModes = ["none", "form-data", "x-www-form-urlencoded", "raw"] as const;
        const validRawFormats = ["json", "text", "xml", "html"] as const;

        const bodyMode = item.request.body?.mode;
        const validatedMode = validBodyModes.find(m => m === bodyMode) || "none";

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
          url: baseUrl,
          collectionId,
          collectionName: collectionName,
          id: generateRequestId(item.name, collectionName),
          headers: (item.request.header || []).map((h: any) => ({
            key: h.key,
            value: h.value,
            enabled: !h.disabled,
            description: h.description
          })),
          queryParams,
          pathVariables,
          body,
          auth: authData
        });
      } else {
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
    const collection: Collection = {
      id: collectionId,
      name: json.info?.name || "Imported Collection",
      description: json.info?.description,
      requests,
      folders,
      variables: (json.variable || []).map((v: {
        key: string;
        value: string;
        type: string;
        description?: string;
      }) => ({
        id: nanoid(),
        key: v.key || '',
        value: v.value || '',
        type: v.type === 'secret' ? 'secret' : 'default',
        description: v.description
      })),
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

    return collection;
  } catch (error) {
    console.error('Error parsing Postman collection:', error);
    throw new Error(`Failed to parse Postman collection: ${error}`);
  }
};

const loadCollectionsFromFiles = async (): Promise<Collection[]> => {
  try {
    const response = await fetch('/collections');
    if (!response.ok) throw new Error('Failed to fetch collections');

    const files = await response.json();
    const collections: Collection[] = [];
    const existingCollections = new Set<string>();

    const savedCollections = localStorage.getItem("collections");
    if (savedCollections) {
      const parsed = JSON.parse(savedCollections);
      parsed.forEach((c: Collection) => existingCollections.add(c.name.toLowerCase()));
      collections.push(...parsed);
    }

    for (const file of files) {
      try {
        const fileResponse = await fetch(`/collections/${file}`);
        if (!fileResponse.ok) continue;

        const content = await fileResponse.json();
        const collection = parsePostmanCollection(content);

        const allRequests = [...collection.requests];
        collection.folders?.forEach(folder => {
          const getFolderRequests = (f: CollectionFolder): ApiRequest[] => {
            const requests = [...f.requests];
            f.folders?.forEach(subFolder => {
              requests.push(...getFolderRequests(subFolder));
            });
            return requests;
          };
          allRequests.push(...getFolderRequests(folder));
        });

        const savedRequests = localStorage.getItem("saved_requests");
        const existingRequests = savedRequests ? JSON.parse(savedRequests) : [];
        const updatedRequests = [...existingRequests, ...allRequests];
        localStorage.setItem("saved_requests", JSON.stringify(updatedRequests));


        if (existingCollections.has(collection.name.toLowerCase())) continue;

        collections.push(collection);
        existingCollections.add(collection.name.toLowerCase());
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
      }
    }

    return collections;
  } catch (error) {
    console.error('Error loading collections:', error);
    return [];
  }
};

export function Sidebar({ onRequestSelect, onCollectionSelect, onEnvironmentSelect }: SidebarProps) {
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [view, setView] = useState<'collections' | 'openapi' | 'environment'>('collections');
  const [searchQuery, setSearchQuery] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      const initializeCollections = async () => {
        const collections = await loadCollectionsFromFiles();
        if (collections.length > 0) {
          setCollections(collections);
          localStorage.setItem("collections", JSON.stringify(collections));
        }
        setInitialized(true);
      };

      initializeCollections();
    }
  }, [initialized]);

  const toggleCollection = (collectionId: string) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(collectionId)) {
      newExpanded.delete(collectionId);
    } else {
      newExpanded.add(collectionId);
    }
    setExpandedCollections(newExpanded);
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

  const handleRequestSelect = (request: ApiRequest) => {
    setSelectedItem(request.id);
    setView('collections');
    onRequestSelect(request);
  };

  const handleCollectionSelect = (collection: Collection) => {
    setSelectedItem(collection.id);
    onCollectionSelect(collection);
  };

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

          if (existingCollections.has(collection.name.toLowerCase())) {
            toast({
              variant: "destructive",
              title: "Error",
              description: `Collection "${collection.name}" already exists.`,
            });
            return;
          }

          const allRequests = [...collection.requests];
          collection.folders?.forEach(folder => {
            const getFolderRequests = (f: CollectionFolder): ApiRequest[] => {
              const requests = [...f.requests];
              f.folders?.forEach(subFolder => {
                requests.push(...getFolderRequests(subFolder));
              });
              return requests;
            };
            allRequests.push(...getFolderRequests(folder));
          });

          const savedRequests = localStorage.getItem("saved_requests");
          const existingRequests = savedRequests ? JSON.parse(savedRequests) : [];
          const updatedRequests = [...existingRequests, ...allRequests];
          localStorage.setItem("saved_requests", JSON.stringify(updatedRequests));

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

  const renderFolder = (folder: CollectionFolder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const paddingLeft = `${level * 1.5}rem`;

    return (
      <div key={folder.id} className="text-sm">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start hover:bg-muted/50",
            selectedItem === folder.id && "bg-muted"
          )}
          style={{ paddingLeft }}
          onClick={() => toggleFolder(folder.id)}
        >
          <span className="mr-2">
            {isExpanded ? (
              <>
                <ChevronDown className="inline-block w-4 h-4 mr-1" />
                <FolderOpen className="inline-block w-4 h-4" />
              </>
            ) : (
              <>
                <ChevronRight className="inline-block w-4 h-4 mr-1" />
                <FolderClosed className="inline-block w-4 h-4" />
              </>
            )}
          </span>
          <span className="truncate">{folder.name}</span>
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
      GET: "text-emerald-500",
      POST: "text-blue-500",
      PUT: "text-amber-500",
      DELETE: "text-red-500",
      PATCH: "text-purple-500",
      HEAD: "text-gray-500",
      OPTIONS: "text-gray-500"
    };

    return (
      <Button
        key={request.id}
        variant="ghost"
        className={cn(
          "w-full justify-start hover:bg-muted/50 h-auto py-1.5",
          selectedItem === request.id && "bg-muted"
        )}
        style={{ paddingLeft }}
        onClick={() => handleRequestSelect(request)}
      >
        <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
        <div className="flex flex-col items-start">
          <span className="truncate text-sm">{request.name}</span>
          <span className={`text-xs font-mono font-medium ${methodColors[request.method]}`}>
            {request.method}
          </span>
        </div>
      </Button>
    );
  };

  const searchCollections = (query: string): SearchResult[] => {
    if (!query) return [];

    const results: SearchResult[] = [];
    const searchLower = query.toLowerCase();

    collections.forEach(collection => {
      const searchInFolder = (folder: CollectionFolder, parentPath: string[]) => {
        if (folder.name.toLowerCase().includes(searchLower)) {
          results.push({
            collectionName: collection.name,
            itemType: 'folder',
            folder,
            path: [...parentPath, folder.name]
          });
        }

        folder.requests.forEach(request => {
          if (
            request.name.toLowerCase().includes(searchLower) ||
            request.url.toLowerCase().includes(searchLower) ||
            request.method.toLowerCase().includes(searchLower)
          ) {
            results.push({
              collectionName: collection.name,
              itemType: 'request',
              request,
              path: [...parentPath, folder.name]
            });
          }
        });

        folder.folders?.forEach(subfolder => {
          searchInFolder(subfolder, [...parentPath, folder.name]);
        });
      };

      if (collection.name.toLowerCase().includes(searchLower)) {
        results.push({
          collectionName: collection.name,
          itemType: 'folder',
          folder: { id: collection.id, name: collection.name, requests: [], folders: collection.folders },
          path: []
        });
        collection.requests.forEach(request => {
          results.push({
            collectionName: collection.name,
            itemType: 'request',
            request,
            path: []
          });
        });
      }

      collection.requests.forEach(request => {
        if (
          request.name.toLowerCase().includes(searchLower) ||
          request.url.toLowerCase().includes(searchLower) ||
          request.method.toLowerCase().includes(searchLower)
        ) {
          results.push({
            collectionName: collection.name,
            itemType: 'request',
            request,
            path: []
          });
        }
      });

      collection.folders?.forEach(folder => {
        searchInFolder(folder, []);
      });
    });

    return results;
  };

  const searchResults = searchQuery ? searchCollections(searchQuery) : null;

  return (
    <div className="w-64 flex-shrink-0 border-r bg-background/95 h-screen">
      <ViewSection
        onEnvironmentSelect={onEnvironmentSelect}
        onViewChange={(v: 'collections' | 'openapi' | 'environment') => setView(v)}
      />
      <div className="p-4 border-b">
        {view === 'collections' ? (
          <div className="space-y-2">
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
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        ) : (
          <OpenAPIViewer onRequestSelect={onRequestSelect} />
        )}
      </div>
      {view === 'collections' && (
        <ScrollArea className="h-[calc(100vh-5rem)] flex-grow">
          <div className="p-2">
            {searchQuery ? (
              <div className="space-y-1">
                {searchResults?.map((result, index) => (
                  <Button
                    key={`${result.request?.id || result.folder?.id}-${index}`}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => {
                      if (result.itemType === 'request' && result.request) {
                        handleRequestSelect(result.request);
                      }
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    <div className="flex flex-col items-start">
                      <span className="text-xs text-muted-foreground">
                        {result.collectionName}
                        {result.path.length > 0 && ` › ${result.path.join(' › ')}`}
                      </span>
                      {result.itemType === 'request' && result.request && (
                        <div className="flex items-center">
                          <span className="font-mono uppercase text-xs mr-2 text-muted-foreground">
                            {result.request.method}
                          </span>
                          <span className="truncate">{result.request.name}</span>
                        </div>
                      )}
                      {result.itemType === 'folder' && result.folder && (
                        <div className="flex items-center">
                          <FolderClosed className="h-4 w-4 mr-2" />
                          <span className="truncate">{result.folder.name}</span>
                        </div>
                      )}
                    </div>
                  </Button>
                ))}
                {searchResults?.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center p-4">
                    No matching items found
                  </div>
                )}
              </div>
            ) : (
              collections.map((collection) => (
                <div key={collection.id} className="mb-4">
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start font-medium hover:bg-muted/50",
                      selectedItem === collection.id && "bg-muted"
                    )}
                    onClick={() => {
                      toggleCollection(collection.id);
                      handleCollectionSelect(collection);
                    }}
                  >
                    <span className="mr-2">
                      {expandedCollections.has(collection.id) ? (
                        <>
                          <ChevronDown className="inline-block w-4 h-4 mr-1" />
                          <FolderOpen className="inline-block w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <ChevronRight className="inline-block w-4 h-4 mr-1" />
                          <FolderClosed className="inline-block w-4 h-4" />
                        </>
                      )}
                    </span>
                    {collection.name}
                  </Button>
                  {expandedCollections.has(collection.id) && (
                    <div>
                      {collection.folders?.map((folder) => renderFolder(folder))}
                      {collection.requests.map((request) => renderRequest(request))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}