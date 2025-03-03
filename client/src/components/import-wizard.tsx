import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (importData: ImportData) => Promise<void>;
}

export interface ImportData {
  serviceName: string;
  devUrl: string;
  qa01Url: string;
  qa02Url: string;
  qa03Url: string;
  perfUrl: string;
  gitUrl: string;
  username: string;
  password: string;
}

export function ImportWizard({ isOpen, onClose, onImport }: ImportWizardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<ImportData>({
    serviceName: "",
    devUrl: "",
    qa01Url: "",
    qa02Url: "",
    qa03Url: "",
    perfUrl: "",
    gitUrl: "",
    username: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await onImport(formData);
      toast({
        title: "Success",
        description: "Service import initiated successfully",
      });
      onClose();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import service",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Import Service</DialogTitle>
            <DialogDescription>
              Enter service details to import API endpoints
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="serviceName">Service/Domain Name *</Label>
              <Input
                id="serviceName"
                name="serviceName"
                value={formData.serviceName}
                onChange={handleInputChange}
                placeholder="Enter service name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Base URLs</Label>
              <div className="grid gap-2">
                <Input
                  name="devUrl"
                  value={formData.devUrl}
                  onChange={handleInputChange}
                  placeholder="DEV URL"
                />
                <Input
                  name="qa01Url"
                  value={formData.qa01Url}
                  onChange={handleInputChange}
                  placeholder="QA01 URL"
                />
                <Input
                  name="qa02Url"
                  value={formData.qa02Url}
                  onChange={handleInputChange}
                  placeholder="QA02 URL"
                />
                <Input
                  name="qa03Url"
                  value={formData.qa03Url}
                  onChange={handleInputChange}
                  placeholder="QA03 URL"
                />
                <Input
                  name="perfUrl"
                  value={formData.perfUrl}
                  onChange={handleInputChange}
                  placeholder="PERF URL"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gitUrl">Git Repository URL *</Label>
              <Input
                id="gitUrl"
                name="gitUrl"
                value={formData.gitUrl}
                onChange={handleInputChange}
                placeholder="https://github.com/username/repo"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Git Username *</Label>
              <Input
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Git username"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Git Password/Token *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Git password or access token"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
