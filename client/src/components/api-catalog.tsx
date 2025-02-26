import { Upload, FileJson } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Collection } from "./sidebar";

interface ApiCatalogProps {
  onRequestSelect: (request: any) => void;
  onCollectionSelect: (collection: Collection) => void;
}

export function ApiCatalog({ onRequestSelect, onCollectionSelect }: ApiCatalogProps) {
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>(() => {
    const saved = localStorage.getItem("collections");
    return saved ? JSON.parse(saved) : [];
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newCollections: Collection[] = [];
    const existingCollections = new Set(collections.map(c => c.name.toLowerCase()));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const content = await file.text();
        if (file.name.endsWith('.json')) {
          const json = JSON.parse(content);
          const collection = json; // You'll need to parse this based on your collection structure

          if (existingCollections.has(collection.name.toLowerCase())) {
            toast({
              variant: "destructive",
              title: "Error",
              description: `Collection "${collection.name}" already exists.`,
            });
            continue;
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
    }

    if (newCollections.length > 0) {
      const updatedCollections = [...collections, ...newCollections];
      setCollections(updatedCollections);
      localStorage.setItem("collections", JSON.stringify(updatedCollections));
    }

    event.target.value = '';
  };

  return (
    <div className="p-4 space-y-4">
      <Tabs defaultValue="collections" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="collections" className="flex-1">Collections</TabsTrigger>
          <TabsTrigger value="openapi" className="flex-1">OpenAPI</TabsTrigger>
          <TabsTrigger value="saved" className="flex-1">Saved</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="space-y-4">
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

          <ScrollArea className="h-[calc(100vh-12rem)]">
            {collections.map((collection) => (
              <div key={collection.id} className="mb-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => onCollectionSelect(collection)}
                >
                  <span className="font-mono text-sm truncate">{collection.name}</span>
                </Button>
              </div>
            ))}
            {collections.length === 0 && (
              <div className="text-sm text-muted-foreground text-center">
                No collections imported
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="openapi" className="space-y-4">
          <Button variant="outline" className="w-full">
            <FileJson className="mr-2 h-4 w-4" />
            Import OpenAPI Spec
          </Button>
          <div className="text-sm text-muted-foreground text-center">
            Import an OpenAPI specification to get started
          </div>
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          <ScrollArea className="h-[calc(100vh-12rem)]">
            {/* Add saved requests list here */}
            <div className="text-sm text-muted-foreground text-center">
              Your saved requests will appear here
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}