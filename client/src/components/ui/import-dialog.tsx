import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { z } from "zod";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Import form schemas
const githubImportSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  projectType: z.enum(["REST", "SOAP", "BOTH"]),
  wsdlPath: z.string().optional(),
  openApiPath: z.string().optional(),
  devUrl: z.string().url("Invalid URL").optional(),
  qa01Url: z.string().url("Invalid URL").optional(),
  qa02Url: z.string().url("Invalid URL").optional(),
  qa03Url: z.string().url("Invalid URL").optional(),
  perfUrl: z.string().url("Invalid URL").optional(),
  githubUrl: z.string().url("Invalid GitHub URL"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const wsdlImportSchema = z.object({
  wsdlUrl: z.string().url("Invalid WSDL URL"),
});

const openApiUrlImportSchema = z.object({
  openApiUrl: z.string().url("Invalid OpenAPI URL"),
});

type ImportType = "GITHUB" | "WSDL" | "OPENAPI_URL" | "COLLECTION" | "OPENAPI_FILE";

interface ImportDialogProps {
  onImport: (type: ImportType, data: any) => Promise<void>;
}

export function ImportDialog({ onImport }: ImportDialogProps) {
  const [importType, setImportType] = useState<ImportType>("GITHUB");
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const githubForm = useForm({
    resolver: zodResolver(githubImportSchema),
    defaultValues: {
      projectType: "REST",
    },
  });

  const wsdlForm = useForm({
    resolver: zodResolver(wsdlImportSchema),
  });

  const openApiUrlForm = useForm({
    resolver: zodResolver(openApiUrlImportSchema),
  });

  const handleImport = async (data: any) => {
    try {
      await onImport(importType, data);
      setIsOpen(false);
      toast({
        title: "Success",
        description: "Import completed successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Import failed",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: ImportType) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      await onImport(type, { content, fileName: file.name });
      setIsOpen(false);
      toast({
        title: "Success",
        description: `${file.name} imported successfully`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import file",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import API</DialogTitle>
          <DialogDescription>
            Choose an import method to add APIs to your collection.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Select
            value={importType}
            onValueChange={(value) => setImportType(value as ImportType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select import type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GITHUB">GitHub Repository</SelectItem>
              <SelectItem value="WSDL">WSDL URL</SelectItem>
              <SelectItem value="OPENAPI_URL">OpenAPI URL</SelectItem>
              <SelectItem value="COLLECTION">Collection JSON</SelectItem>
              <SelectItem value="OPENAPI_FILE">OpenAPI File</SelectItem>
            </SelectContent>
          </Select>

          {importType === "GITHUB" && (
            <Form {...githubForm}>
              <form onSubmit={githubForm.handleSubmit(handleImport)} className="space-y-4">
                <FormField
                  control={githubForm.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={githubForm.control}
                  name="projectType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REST">REST</SelectItem>
                          <SelectItem value="SOAP">SOAP</SelectItem>
                          <SelectItem value="BOTH">Both</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(githubForm.watch("projectType") === "SOAP" || 
                  githubForm.watch("projectType") === "BOTH") && (
                  <FormField
                    control={githubForm.control}
                    name="wsdlPath"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WSDL Folder Path</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {(githubForm.watch("projectType") === "REST" || 
                  githubForm.watch("projectType") === "BOTH") && (
                  <FormField
                    control={githubForm.control}
                    name="openApiPath"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OpenAPI Folder Path</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={githubForm.control}
                  name="githubUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub URL</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={githubForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={githubForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub Password/Token</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit">Import from GitHub</Button>
                </DialogFooter>
              </form>
            </Form>
          )}

          {importType === "WSDL" && (
            <Form {...wsdlForm}>
              <form onSubmit={wsdlForm.handleSubmit(handleImport)} className="space-y-4">
                <FormField
                  control={wsdlForm.control}
                  name="wsdlUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WSDL URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com/service.wsdl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">Import from WSDL</Button>
                </DialogFooter>
              </form>
            </Form>
          )}

          {importType === "OPENAPI_URL" && (
            <Form {...openApiUrlForm}>
              <form onSubmit={openApiUrlForm.handleSubmit(handleImport)} className="space-y-4">
                <FormField
                  control={openApiUrlForm.control}
                  name="openApiUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OpenAPI URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com/openapi.yaml" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">Import from URL</Button>
                </DialogFooter>
              </form>
            </Form>
          )}

          {importType === "COLLECTION" && (
            <div className="space-y-4">
              <Input
                type="file"
                accept=".json"
                onChange={(e) => handleFileUpload(e, "COLLECTION")}
              />
              <FormDescription>
                Upload a collection JSON file to import API requests
              </FormDescription>
            </div>
          )}

          {importType === "OPENAPI_FILE" && (
            <div className="space-y-4">
              <Input
                type="file"
                accept=".yaml,.yml,.json"
                onChange={(e) => handleFileUpload(e, "OPENAPI_FILE")}
              />
              <FormDescription>
                Upload an OpenAPI specification file (YAML or JSON)
              </FormDescription>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
