import { useState, useEffect } from "react";
import { load } from "js-yaml";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ApiRequest } from "@/types/api-request";
import { createApiRequest } from "@/types/api-request";
import { Upload, ChevronDown, ChevronRight, FileText, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface OpenAPISpec {
  paths: Record<string, Record<string, any>>;
  servers?: { url: string }[];
  openapi: string;
  info: {
    title: string;
    version: string;
  };
}

interface StoredSpec extends OpenAPISpec {
  id: string;
  fileName: string;
}

interface OpenAPIViewerProps {
  onRequestSelect: (request: ApiRequest) => void;
}

export function OpenAPIViewer({ onRequestSelect }: OpenAPIViewerProps) {
  const [specs, setSpecs] = useState<StoredSpec[]>([]);
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Load saved specs on mount
  useEffect(() => {
    const savedSpecs = localStorage.getItem("openapi_specs");
    if (savedSpecs) {
      try {
        setSpecs(JSON.parse(savedSpecs));
      } catch (error) {
        console.error("Failed to load saved OpenAPI specs:", error);
      }
    }
  }, []);

  const validateOpenAPISpec = (spec: any): spec is OpenAPISpec => {
    return (
      spec &&
      typeof spec === 'object' &&
      typeof spec.openapi === 'string' &&
      spec.paths &&
      typeof spec.paths === 'object' &&
      (!spec.servers || Array.isArray(spec.servers)) &&
      spec.info &&
      typeof spec.info.title === 'string' &&
      typeof spec.info.version === 'string'
    );
  };

  const filterOperations = (specs: StoredSpec[], query: string) => {
    if (!query) return null;

    const searchLower = query.toLowerCase();
    const results: Array<{
      specId: string;
      specName: string;
      path: string;
      method: string;
      operation: any;
    }> = [];

    specs.forEach(spec => {
      Object.entries(spec.paths).forEach(([path, methods]) => {
        Object.entries(methods).forEach(([method, operation]) => {
          const summary = operation.summary || '';
          const description = operation.description || '';
          const matchString = `${path} ${method} ${summary} ${description}`.toLowerCase();

          if (matchString.includes(searchLower)) {
            results.push({
              specId: spec.id,
              specName: spec.fileName,
              path,
              method,
              operation
            });
          }
        });
      });
    });

    return results;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = load(text);

      // Validate OpenAPI spec structure
      if (!validateOpenAPISpec(parsed)) {
        throw new Error("Invalid OpenAPI specification format");
      }

      const newSpec: StoredSpec = {
        ...parsed,
        id: crypto.randomUUID(),
        fileName: file.name
      };

      const updatedSpecs = [...specs, newSpec];
      setSpecs(updatedSpecs);
      localStorage.setItem("openapi_specs", JSON.stringify(updatedSpecs));

      toast({
        title: "Success",
        description: `OpenAPI specification "${file.name}" loaded successfully`,
      });
    } catch (error: any) {
      console.error('Error parsing OpenAPI spec:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to parse OpenAPI specification",
      });
    }

    // Reset file input
    event.target.value = '';
  };

  const createRequestFromOperation = (spec: StoredSpec, path: string, method: string, operation: any) => {
    const baseUrl = spec.servers?.[0]?.url || "https://api.example.com";
    const url = `${baseUrl}${path}`;

    return createApiRequest({
      name: operation.summary || `${method.toUpperCase()} ${path}`,
      method: method.toUpperCase() as ApiRequest["method"],
      url,
      queryParams: operation.parameters
        ?.filter((p: any) => p.in === "query")
        .map((p: any) => ({
          key: p.name,
          value: "",
          enabled: true,
        })) || [{ key: "", value: "", enabled: true }],
      headers: operation.parameters
        ?.filter((p: any) => p.in === "header")
        .map((p: any) => ({
          key: p.name,
          value: "",
          enabled: true,
        })) || [],
      pathVariables: operation.parameters
        ?.filter((p: any) => p.in === "path")
        .map((p: any) => ({
          key: p.name,
          value: "",
          enabled: true,
        })) || [],
      body: {
        type: operation.requestBody ? "raw" : "none",
        rawFormat: "json",
        content: operation.requestBody
          ? JSON.stringify(operation.requestBody.content?.["application/json"]?.example || {}, null, 2)
          : "",
      },
    });
  };

  const toggleSpec = (specId: string) => {
    const newExpanded = new Set(expandedSpecs);
    if (newExpanded.has(specId)) {
      newExpanded.delete(specId);
    } else {
      newExpanded.add(specId);
    }
    setExpandedSpecs(newExpanded);
  };

  const searchResults = filterOperations(specs, searchQuery);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-end">
          <div className="relative">
            <input
              type="file"
              accept=".yaml,.yml,.json"
              onChange={handleFileUpload}
              className="hidden"
              id="openapi-import"
            />
            <label htmlFor="openapi-import">
              <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </span>
              </Button>
            </label>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search APIs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="space-y-2">
        {searchQuery ? (
          // Show search results
          <div className="space-y-1">
            {searchResults?.map(({ specId, specName, path, method, operation }) => (
              <Button
                key={`${specId}-${path}-${method}`}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() =>
                  onRequestSelect(
                    createRequestFromOperation(
                      specs.find(s => s.id === specId)!,
                      path,
                      method,
                      operation
                    )
                  )
                }
              >
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                <div className="flex flex-col items-start">
                  <span className="text-xs text-muted-foreground">{specName}</span>
                  <div className="flex items-center">
                    <span className="font-mono uppercase text-xs mr-2 text-muted-foreground">
                      {method}
                    </span>
                    <span className="truncate">{operation.summary || path}</span>
                  </div>
                </div>
              </Button>
            ))}
            {searchResults?.length === 0 && (
              <div className="text-sm text-muted-foreground text-center p-4">
                No matching APIs found
              </div>
            )}
          </div>
        ) : (
          // Show normal spec list
          specs.map((spec) => (
            <Card key={spec.id} className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-start font-medium text-sm"
                onClick={() => toggleSpec(spec.id)}
              >
                {expandedSpecs.has(spec.id) ? (
                  <ChevronDown className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                {spec.fileName}
              </Button>
              {expandedSpecs.has(spec.id) && (
                <div className="mt-2 space-y-1 pl-6">
                  {Object.entries(spec.paths).map(([path, methods]) => (
                    <div key={path}>
                      {Object.entries(methods).map(([method, operation]) => (
                        <Button
                          key={`${path}-${method}`}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-sm"
                          onClick={() =>
                            onRequestSelect(createRequestFromOperation(spec, path, method, operation))
                          }
                        >
                          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="font-mono uppercase text-xs mr-2 text-muted-foreground">
                            {method}
                          </span>
                          <span className="truncate">{operation.summary || path}</span>
                        </Button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
        {specs.length === 0 && (
          <div className="text-sm text-muted-foreground text-center p-4">
            No OpenAPI specifications imported yet
          </div>
        )}
      </div>
    </div>
  );
}