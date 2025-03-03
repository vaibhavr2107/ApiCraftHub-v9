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
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface ImportProgress {
  step: 'idle' | 'cloning' | 'scanning' | 'importing' | 'complete';
  message: string;
  error?: string;
  stats?: {
    totalEndpoints: number;
    restEndpoints: number;
    soapEndpoints: number;
  };
}

export function ImportWizard({ isOpen, onClose, onImport }: ImportWizardProps) {
  const { toast } = useToast();
  const [progress, setProgress] = useState<ImportProgress>({
    step: 'idle',
    message: '',
  });

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

    try {
      // Start cloning
      setProgress({
        step: 'cloning',
        message: 'Cloning repository...',
      });

      const response = await fetch('/api/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import service');
      }

      const result = await response.json();

      // Update progress with scanning results
      setProgress({
        step: 'scanning',
        message: 'Scanning for endpoints...',
        stats: {
          totalEndpoints: result.endpoints.length,
          restEndpoints: result.endpoints.filter((e: any) => e.type === 'REST').length,
          soapEndpoints: result.endpoints.filter((e: any) => e.type === 'SOAP').length,
        },
      });

      // Start importing
      setProgress({
        step: 'importing',
        message: 'Creating API collection...',
        stats: {
          totalEndpoints: result.endpoints.length,
          restEndpoints: result.endpoints.filter((e: any) => e.type === 'REST').length,
          soapEndpoints: result.endpoints.filter((e: any) => e.type === 'SOAP').length,
        },
      });

      await onImport(formData);

      // Complete
      setProgress({
        step: 'complete',
        message: 'Import completed successfully!',
        stats: {
          totalEndpoints: result.endpoints.length,
          restEndpoints: result.endpoints.filter((e: any) => e.type === 'REST').length,
          soapEndpoints: result.endpoints.filter((e: any) => e.type === 'SOAP').length,
        },
      });

      toast({
        title: "Success",
        description: `Successfully imported ${result.endpoints.length} endpoints from ${formData.serviceName}`,
      });

      setTimeout(() => {
        onClose();
        setProgress({ step: 'idle', message: '' });
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to import service";
      setProgress({
        step: 'idle',
        message: '',
        error: errorMessage,
      });

      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const renderProgress = () => {
    if (progress.step === 'idle') return null;

    return (
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className={`h-4 w-4 ${progress.step !== 'complete' ? 'animate-spin' : ''}`} />
          <span>{progress.message}</span>
        </div>

        {progress.stats && (
          <Alert>
            <AlertDescription>
              <div className="space-y-1">
                <p>Found {progress.stats.totalEndpoints} endpoints:</p>
                <ul className="list-disc pl-4">
                  <li>{progress.stats.restEndpoints} REST endpoints</li>
                  <li>{progress.stats.soapEndpoints} SOAP endpoints</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {progress.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {progress.error}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
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

          {renderProgress()}

          <DialogFooter>
            <Button 
              variant="outline" 
              type="button" 
              onClick={onClose}
              disabled={progress.step !== 'idle' && progress.step !== 'complete'}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={progress.step !== 'idle' && progress.step !== 'complete'}
            >
              {progress.step === 'idle' ? 'Import' : progress.step === 'complete' ? 'Done' : 'Importing...'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}