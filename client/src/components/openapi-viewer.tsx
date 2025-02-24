import { useState } from "react";
import { load } from "js-yaml";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ApiRequest } from "@/types/api-request";
import { createApiRequest } from "@/types/api-request";
import { Upload } from "lucide-react";

interface OpenAPISpec {
  paths: Record<string, Record<string, any>>;
  servers?: { url: string }[];
  openapi: string;
  info: {
    title: string;
    version: string;
  };
}

interface OpenAPIViewerProps {
  onRequestSelect: (request: ApiRequest) => void;
}

export function OpenAPIViewer({ onRequestSelect }: OpenAPIViewerProps) {
  const [spec, setSpec] = useState<OpenAPISpec | null>(null);
  const { toast } = useToast();

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

      setSpec(parsed);
      toast({
        title: "Success",
        description: "OpenAPI specification loaded successfully",
      });
    } catch (error: any) {
      console.error('Error parsing OpenAPI spec:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to parse OpenAPI specification",
      });
    }
  };

  const createRequestFromOperation = (path: string, method: string, operation: any) => {
    const baseUrl = spec?.servers?.[0]?.url || "https://api.example.com";
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

  return (
    <div className="p-4 space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Import OpenAPI Specification</h2>
          <Input
            type="file"
            accept=".yaml,.yml,.json"
            onChange={handleFileUpload}
            className="cursor-pointer"
          />
          <p className="text-sm text-muted-foreground">
            Upload an OpenAPI specification file (YAML or JSON)
          </p>
        </div>
      </Card>

      {spec && (
        <div className="space-y-4">
          <h3 className="font-medium">Available Endpoints</h3>
          {Object.entries(spec.paths).map(([path, methods]) => (
            <Card key={path} className="p-4">
              <h4 className="font-medium mb-2">{path}</h4>
              <div className="space-y-2">
                {Object.entries(methods).map(([method, operation]) => (
                  <Button
                    key={`${path}-${method}`}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() =>
                      onRequestSelect(createRequestFromOperation(path, method, operation))
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="uppercase font-mono">{method}</span>
                      <span className="truncate">{operation.summary || path}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}