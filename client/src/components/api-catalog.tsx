import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImportDialog } from "@/components/ui/import-dialog";
import { useToast } from "@/hooks/use-toast";
import { Collection } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { useState } from "react";

interface ApiCatalogProps {
  onRequestSelect: (request: any) => void;
  onCollectionSelect: (collection: Collection) => void;
  setLocation: (location: string) => void;
}

export function ApiCatalog({ onRequestSelect, onCollectionSelect, setLocation }: ApiCatalogProps) {
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>(() => {
    const saved = localStorage.getItem("collections");
    return saved ? JSON.parse(saved) : [];
  });

  const handleRequestSelect = (request: any) => {
    onRequestSelect(request);
    setLocation(`/request/${request.routeId}`);
  };

  const handleImport = async (type: string, data: any) => {
    try {
      let response;
      switch (type) {
        case 'GITHUB':
          response = await fetch('/api/import/github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          break;
        case 'WSDL':
          response = await fetch('/api/import/wsdl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: data.wsdlUrl })
          });
          break;
        case 'OPENAPI_URL':
          response = await fetch('/api/import/openapi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: data.openApiUrl })
          });
          break;
        case 'COLLECTION':
        case 'OPENAPI_FILE':
          response = await fetch(`/api/import/${type.toLowerCase()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: data.content,
              fileName: data.fileName
            })
          });
          break;
        default:
          throw new Error('Invalid import type');
      }

      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Update collections in state and localStorage
      const updatedCollections = [...collections, result];
      setCollections(updatedCollections);
      localStorage.setItem("collections", JSON.stringify(updatedCollections));

      toast({
        title: "Success",
        description: "Import completed successfully",
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Import failed",
      });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Tabs defaultValue="collections" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="collections" className="flex-1">Collections</TabsTrigger>
          <TabsTrigger value="imported" className="flex-1">Imported</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="space-y-4">
          <ImportDialog onImport={handleImport} />

          <ScrollArea className="h-[calc(100vh-12rem)]">
            {collections.map((collection) => (
              <Card key={collection.id} className="mb-2 p-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => onCollectionSelect(collection)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="font-mono text-sm truncate">{collection.name}</span>
                </Button>
              </Card>
            ))}
            {collections.length === 0 && (
              <div className="text-sm text-muted-foreground text-center">
                No collections imported
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="imported" className="space-y-4">
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="text-sm text-muted-foreground text-center">
              Recently imported collections will appear here
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}