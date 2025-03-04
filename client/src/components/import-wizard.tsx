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
import { Loader2, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (importData: ImportData) => Promise<void>;
}

export interface ImportData {
  type: 'openapi' | 'collection' | 'git';
  serviceName: string;
  devUrl?: string;
  qa01Url?: string;
  qa02Url?: string;
  qa03Url?: string;
  perfUrl?: string;
  gitUrl?: string;
  username?: string;
  password?: string;
  file?: File;
}

interface ImportProgress {
  step: 'idle' | 'parsing' | 'importing' | 'complete';
  message: string;
  error?: string;
  stats?: {
    totalEndpoints: number;
    parseSuccess: number;
    parseErrors: number;
  };
}

export function ImportWizard({ isOpen, onClose, onImport }: ImportWizardProps) {
  const { toast } = useToast();
  const [progress, setProgress] = useState<ImportProgress>({
    step: 'idle',
    message: '',
  });

  const [formData, setFormData] = useState<ImportData>({
    type: 'openapi',
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
      // Start parsing/cloning
      setProgress({
        step: 'parsing',
        message: formData.type === 'git' 
          ? 'Cloning repository...' 
          : 'Parsing import file...',
      });

      await onImport(formData);

      // Complete
      setProgress({
        step: 'complete',
        message: 'Import completed successfully!',
      });

      toast({
        title: "Success",
        description: "Successfully imported API collection",
      });

      setTimeout(() => {
        onClose();
        setProgress({ step: 'idle', message: '' });
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to import";
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
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        file,
        serviceName: file.name.split('.')[0], // Set default service name from filename
      }));
    }
  };

  const handleTypeChange = (value: 'openapi' | 'collection' | 'git') => {
    setFormData(prev => ({
      ...prev,
      type: value,
      // Reset file if switching to git, or git credentials if switching to file
      ...(value === 'git' ? { file: undefined } : { gitUrl: '', username: '', password: '' }),
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
                <p>Processing {progress.stats.totalEndpoints} endpoints:</p>
                <ul className="list-disc pl-4">
                  <li>{progress.stats.parseSuccess} successful</li>
                  <li>{progress.stats.parseErrors} errors</li>
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
            <DialogTitle>Import API Collection</DialogTitle>
            <DialogDescription>
              Import from OpenAPI specification, existing collection, or Git repository
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Import Type</Label>
              <Select
                value={formData.type}
                onValueChange={handleTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select import type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openapi">OpenAPI Specification</SelectItem>
                  <SelectItem value="collection">API Collection</SelectItem>
                  <SelectItem value="git">Git Repository</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="serviceName">Service/Collection Name *</Label>
              <Input
                id="serviceName"
                name="serviceName"
                value={formData.serviceName}
                onChange={handleInputChange}
                placeholder="Enter service name"
                required
              />
            </div>

            {formData.type !== 'git' ? (
              <div className="grid gap-2">
                <Label htmlFor="file">Import File *</Label>
                <div className="flex gap-2">
                  <Input
                    id="file"
                    name="file"
                    type="file"
                    accept={formData.type === 'openapi' ? '.json,.yaml,.yml' : '.json'}
                    onChange={handleFileChange}
                    className="flex-1"
                    required
                  />
                </div>
                <p className="text-sm text-gray-500">
                  {formData.type === 'openapi' 
                    ? 'Upload OpenAPI specification (JSON or YAML)' 
                    : 'Upload collection file (JSON)'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>Environment URLs</Label>
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
              </>
            )}
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