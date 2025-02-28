import { useToast } from "@/hooks/use-toast";
import { ViewSection } from "@/components/view-section";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Upload, Wand2, Search, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { Request } from "@shared/schema";

interface SidebarProps {
  onRequestSelect: (request: Request) => void;
}

export function Sidebar({ onRequestSelect }: SidebarProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<Request[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const content = await file.text();
      const json = JSON.parse(content);

      // You can add validation here for different file types (Postman, OpenAPI, etc.)

      const savedRequests = localStorage.getItem("saved_requests");
      const existingRequests = savedRequests ? JSON.parse(savedRequests) : [];
      const updatedRequests = [...existingRequests, json];

      setRequests(updatedRequests);
      localStorage.setItem("saved_requests", JSON.stringify(updatedRequests));

      toast({
        title: "Success",
        description: `Imported: ${file.name}`,
      });
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to import ${file.name}. Please check the file format.`,
      });
    }

    event.target.value = '';
  };

  const handleImportWizard = () => {
    toast({
      title: "Coming Soon",
      description: "Import Wizard feature will be implemented soon!",
    });
  };

  return (
    <div className="w-64 flex-shrink-0 border-r bg-background/95 h-screen">
      <div className="p-4 border-b space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="file"
              accept=".json,.yaml,.yml"
              className="hidden"
              onChange={handleFileUpload}
              id="request-import"
            />
            <label htmlFor="request-import" className="flex-1">
              <Button variant="outline" className="w-full" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </span>
              </Button>
            </label>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleImportWizard}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Wizard
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-8rem)]">
        <div className="p-2">
          {requests.map((request) => (
            <Button
              key={request.requestId}
              variant="ghost"
              className="w-full justify-start hover:bg-muted/50 h-auto py-1.5"
              onClick={() => {
                onRequestSelect(request);
              }}
            >
              <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
              <div className="flex flex-col items-start">
                <span className="truncate text-sm">{request.name}</span>
                <span className="text-xs font-mono font-medium">
                  {request.method}
                </span>
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}