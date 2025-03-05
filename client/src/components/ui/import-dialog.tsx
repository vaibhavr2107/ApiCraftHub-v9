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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { z } from "zod";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Common URL schema for environment URLs
const envUrlSchema = z.object({
  devUrl: z.string().url("Invalid URL").optional(),
  qa01Url: z.string().url("Invalid URL").optional(),
  qa02Url: z.string().url("Invalid URL").optional(),
  qa03Url: z.string().url("Invalid URL").optional(),
  perfUrl: z.string().url("Invalid URL").optional(),
});

// Import form schemas
const githubImportSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  projectType: z.enum(["REST", "SOAP", "BOTH"]),
  wsdlPath: z.string().optional(),
  openApiPath: z.string().optional(),
  githubUrl: z.string().url("Invalid GitHub URL"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
}).merge(envUrlSchema);

const wsdlImportSchema = z.object({
  wsdlUrl: z.string().url("Invalid WSDL URL"),
}).merge(envUrlSchema);

const openApiUrlImportSchema = z.object({
  openApiUrl: z.string().url("Invalid OpenAPI URL"),
}).merge(envUrlSchema);

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
      devUrl: "",
      qa01Url: "",
      qa02Url: "",
      qa03Url: "",
      perfUrl: "",
    },
  });

  const wsdlForm = useForm({
    resolver: zodResolver(wsdlImportSchema),
    defaultValues: {
      devUrl: "",
      qa01Url: "",
      qa02Url: "",
      qa03Url: "",
      perfUrl: "",
    },
  });

  const openApiUrlForm = useForm({
    resolver: zodResolver(openApiUrlImportSchema),
    defaultValues: {
      devUrl: "",
      qa01Url: "",
      qa02Url: "",
      qa03Url: "",
      perfUrl: "",
    },
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

  const renderEnvironmentUrls = (form: any) => (
    <div className="space-y-2">
      <h4 className="text-xs font-medium mb-1">Environment URLs</h4>
      <FormField
        control={form.control}
        name="devUrl"
        render={({ field }) => (
          <FormItem className="space-y-1">
            <FormLabel className="text-xs">Dev URL</FormLabel>
            <FormControl>
              <Input className="h-8 text-sm" placeholder="https://dev.example.com" {...field} />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="qa01Url"
        render={({ field }) => (
          <FormItem className="space-y-1">
            <FormLabel className="text-xs">QA01 URL</FormLabel>
            <FormControl>
              <Input className="h-8 text-sm" placeholder="https://qa01.example.com" {...field} />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="qa02Url"
        render={({ field }) => (
          <FormItem className="space-y-1">
            <FormLabel className="text-xs">QA02 URL</FormLabel>
            <FormControl>
              <Input className="h-8 text-sm" placeholder="https://qa02.example.com" {...field} />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="qa03Url"
        render={({ field }) => (
          <FormItem className="space-y-1">
            <FormLabel className="text-xs">QA03 URL</FormLabel>
            <FormControl>
              <Input className="h-8 text-sm" placeholder="https://qa03.example.com" {...field} />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="perfUrl"
        render={({ field }) => (
          <FormItem className="space-y-1">
            <FormLabel className="text-xs">PERF URL</FormLabel>
            <FormControl>
              <Input className="h-8 text-sm" placeholder="https://perf.example.com" {...field} />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </div>
  );

  const getActiveForm = () => {
    switch (importType) {
      case "GITHUB":
        return githubForm;
      case "WSDL":
        return wsdlForm;
      case "OPENAPI_URL":
        return openApiUrlForm;
      default:
        return null;
    }
  };

  const activeForm = getActiveForm();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[70vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-2 border-b">
          <DialogTitle className="text-lg">Import API</DialogTitle>
          <DialogDescription className="text-sm">
            Choose an import method to add APIs to your collection.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-2 border-b">
          <Select
            value={importType}
            onValueChange={(value) => setImportType(value as ImportType)}
          >
            <SelectTrigger className="h-8 text-sm">
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
        </div>

        <div className="flex-1">
          <ScrollArea className="h-[calc(100vh-70vh-10rem)]">
            <div className="p-4 space-y-4">
              {importType === "GITHUB" && (
                <Form {...githubForm}>
                  <form id="githubForm" onSubmit={githubForm.handleSubmit(handleImport)} className="space-y-3">
                    <FormField
                      control={githubForm.control}
                      name="projectName"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Project Name</FormLabel>
                          <FormControl>
                            <Input className="h-8 text-sm" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={githubForm.control}
                      name="projectType"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">Project Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="REST">REST</SelectItem>
                              <SelectItem value="SOAP">SOAP</SelectItem>
                              <SelectItem value="BOTH">Both</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    {githubForm.watch("projectType") === "SOAP" && (
                      <FormField
                        control={githubForm.control}
                        name="wsdlPath"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">WSDL Folder Path</FormLabel>
                            <FormControl>
                              <Input className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    )}

                    {githubForm.watch("projectType") === "REST" && (
                      <FormField
                        control={githubForm.control}
                        name="openApiPath"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">OpenAPI Folder Path</FormLabel>
                            <FormControl>
                              <Input className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    )}

                    {renderEnvironmentUrls(githubForm)}

                    <FormField
                      control={githubForm.control}
                      name="githubUrl"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">GitHub URL</FormLabel>
                          <FormControl>
                            <Input className="h-8 text-sm" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={githubForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">GitHub Username</FormLabel>
                          <FormControl>
                            <Input className="h-8 text-sm" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={githubForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">GitHub Password/Token</FormLabel>
                          <FormControl>
                            <Input type="password" className="h-8 text-sm" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              )}

              {importType === "WSDL" && (
                <Form {...wsdlForm}>
                  <form id="wsdlForm" onSubmit={wsdlForm.handleSubmit(handleImport)} className="space-y-3">
                    <FormField
                      control={wsdlForm.control}
                      name="wsdlUrl"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">WSDL URL</FormLabel>
                          <FormControl>
                            <Input className="h-8 text-sm" placeholder="https://example.com/service.wsdl" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    {renderEnvironmentUrls(wsdlForm)}
                  </form>
                </Form>
              )}

              {importType === "OPENAPI_URL" && (
                <Form {...openApiUrlForm}>
                  <form id="openApiForm" onSubmit={openApiUrlForm.handleSubmit(handleImport)} className="space-y-3">
                    <FormField
                      control={openApiUrlForm.control}
                      name="openApiUrl"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">OpenAPI URL</FormLabel>
                          <FormControl>
                            <Input className="h-8 text-sm" placeholder="https://example.com/openapi.yaml" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    {renderEnvironmentUrls(openApiUrlForm)}
                  </form>
                </Form>
              )}

              {importType === "COLLECTION" && (
                <div className="space-y-2">
                  <div className="text-xs font-medium mb-1">Upload Collection</div>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={(e) => handleFileUpload(e, "COLLECTION")}
                    className="text-sm h-8"
                  />
                  <div className="text-xs text-muted-foreground">
                    Upload a collection JSON file to import API requests
                  </div>
                </div>
              )}

              {importType === "OPENAPI_FILE" && (
                <div className="space-y-2">
                  <div className="text-xs font-medium mb-1">Upload OpenAPI Specification</div>
                  <Input
                    type="file"
                    accept=".yaml,.yml,.json"
                    onChange={(e) => handleFileUpload(e, "OPENAPI_FILE")}
                    className="text-sm h-8"
                  />
                  <div className="text-xs text-muted-foreground">
                    Upload an OpenAPI specification file (YAML or JSON)
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="border-t p-4">
          <DialogFooter>
            {activeForm ? (
              <Button
                type="submit"
                form={
                  importType === "GITHUB" ? "githubForm" :
                    importType === "WSDL" ? "wsdlForm" :
                      "openApiForm"
                }
                className="h-8 text-sm w-full sm:w-auto"
              >
                Import
              </Button>
            ) : null}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}