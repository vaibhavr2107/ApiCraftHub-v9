import { JavaParser } from './JavaParser';
import { SpringEndpoint } from '../types/spring';
import fs from 'fs';
import path from 'path';
import { SpringBootScanner } from '../services/SpringBootScanner';

export class SpringParser {
  private static modelCache: Map<string, Record<string, any>> = new Map();

  static async scanProject(projectPath: string) {
    console.log('Starting Spring project scan...');

    const endpoints: SpringEndpoint[] = [];
    this.modelCache.clear();

    try {
      // First find Spring Boot application and project structure
      const springBootInfo = await SpringBootScanner.findSpringBootApp(projectPath);
      if (!springBootInfo.srcMainJava) {
        throw new Error('Could not find Java source directory');
      }

      console.log('Spring Boot application info:', springBootInfo);

      // First pass: Scan and cache all models/DTOs
      await this.scanForModels(springBootInfo.srcMainJava);
      console.log(`Found ${this.modelCache.size} models/DTOs`);

      // Second pass: Scan for endpoints
      await this.scanForEndpoints(springBootInfo.srcMainJava, endpoints);
      console.log(`Found ${endpoints.length} endpoints`);

      return {
        endpoints,
        models: Object.fromEntries(this.modelCache),
        basePackage: springBootInfo.basePackage
      };
    } catch (error) {
      console.error('Error scanning Spring project:', error);
      throw error;
    }
  }

  private static async scanForModels(srcMainJava: string) {
    console.log('Scanning for models...');

    const processJavaFile = async (filePath: string) => {
      try {
        const content = await fs.promises.readFile(filePath, 'utf8');

        // Check if file contains model/DTO
        if (filePath.endsWith('DTO.java') || 
            filePath.endsWith('Model.java') || 
            content.includes('@Entity') ||
            content.includes('implements Serializable')) {

          console.log('Processing potential model file:', filePath);
          const ast = JavaParser.parseContent(content);
          if (!ast) return;

          const modelClasses = JavaParser.findAnnotatedClasses(ast, [
            '@Entity', 
            '@Data', 
            '@Getter', 
            '@Setter',
            '@JsonIgnoreProperties'
          ]);

          for (const modelClass of modelClasses) {
            console.log('Found model class:', modelClass.name);
            const fields = this.extractModelFields(modelClass);
            this.modelCache.set(modelClass.name, fields);
          }
        }
      } catch (error) {
        console.error('Error processing Java file:', filePath, error);
      }
    };

    const scanDir = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['build', 'target', 'node_modules', '.git'].includes(entry.name)) {
            await scanDir(fullPath);
          }
        } else if (entry.name.endsWith('.java')) {
          await processJavaFile(fullPath);
        }
      }
    };

    await scanDir(srcMainJava);
  }

  private static async scanForEndpoints(srcMainJava: string, endpoints: SpringEndpoint[]) {
    console.log('Scanning for endpoints...');

    const processJavaFile = async (filePath: string) => {
      try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const ast = JavaParser.parseContent(content);
        if (!ast) return;

        // Process REST controllers
        if (content.includes('@RestController') || content.includes('@Controller')) {
          console.log('Processing REST controller:', filePath);
          const controllers = JavaParser.findAnnotatedClasses(ast, ['@RestController', '@Controller']);

          for (const controller of controllers) {
            console.log('Found controller:', controller.name);
            const restEndpoints = this.processRestController(controller);
            if (restEndpoints.length > 0) {
              console.log(`Found ${restEndpoints.length} REST endpoints in ${controller.name}`);
              endpoints.push(...restEndpoints);
            }
          }
        }

        // Process SOAP endpoints
        if (content.includes('@WebService') || content.includes('@Endpoint')) {
          console.log('Processing SOAP service:', filePath);
          const services = JavaParser.findAnnotatedClasses(ast, ['@WebService', '@Endpoint']);

          for (const service of services) {
            console.log('Found SOAP service:', service.name);
            const soapEndpoints = this.processSoapService(service);
            if (soapEndpoints.length > 0) {
              console.log(`Found ${soapEndpoints.length} SOAP endpoints in ${service.name}`);
              endpoints.push(...soapEndpoints);
            }
          }
        }
      } catch (error) {
        console.error('Error processing Java file:', filePath, error);
      }
    };

    const scanDir = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!['build', 'target', 'node_modules', '.git'].includes(entry.name)) {
            await scanDir(fullPath);
          }
        } else if (entry.name.endsWith('.java')) {
          await processJavaFile(fullPath);
        }
      }
    };

    await scanDir(srcMainJava);
  }

  private static processRestController(controller: any): SpringEndpoint[] {
    const endpoints: SpringEndpoint[] = [];
    const basePath = this.getBaseRequestMapping(controller.annotations);

    controller.methods.forEach((method: any) => {
      const mappingAnn = method.annotations.find((ann: any) => 
        ann.name.endsWith('Mapping') || ann.name === '@RequestMapping'
      );

      if (!mappingAnn) return;

      const endpoint: SpringEndpoint = {
        type: 'REST',
        path: path.join(basePath, mappingAnn.args.value || ''),
        method: this.getHttpMethod(mappingAnn.name),
        parameters: this.processMethodParameters(method),
        headers: {},
        consumes: [],
        produces: []
      };

      // Process request body
      const requestBodyParam = method.parameters.find((p: any) => 
        p.annotations.some((a: any) => a.name === '@RequestBody')
      );

      if (requestBodyParam) {
        endpoint.requestBody = {
          type: requestBodyParam.type,
          fields: this.modelCache.get(requestBodyParam.type) || {},
          required: true
        };
      }

      // Process response body
      if (method.returnType !== 'void' && this.modelCache.has(method.returnType)) {
        endpoint.responseBody = {
          type: method.returnType,
          fields: this.modelCache.get(method.returnType) || {}
        };
      }

      endpoints.push(endpoint);
    });

    return endpoints;
  }

  private static processSoapService(service: any): SpringEndpoint[] {
    const endpoints: SpringEndpoint[] = [];
    const webServiceAnn = service.annotations.find((ann: any) => 
      ann.name === '@WebService' || ann.name === '@Endpoint'
    );

    if (!webServiceAnn) return endpoints;

    const namespace = webServiceAnn.args?.targetNamespace || '';

    service.methods.forEach((method: any) => {
      const webMethodAnn = method.annotations.find((ann: any) => 
        ann.name === '@WebMethod' || ann.name === '@PayloadRoot'
      );

      if (!webMethodAnn) return;

      const operationName = webMethodAnn.args?.operationName || method.name;
      const endpoint: SpringEndpoint = {
        type: 'SOAP',
        path: `${namespace}/${operationName}`,
        method: 'POST',
        parameters: this.processMethodParameters(method),
        headers: {
          'Content-Type': 'text/xml',
          'SOAPAction': `${namespace}/${operationName}`
        },
        consumes: ['text/xml'],
        produces: ['text/xml']
      };

      // Process request wrapper
      const requestWrapperAnn = method.annotations.find((ann: any) => 
        ann.name === '@RequestWrapper'
      );

      if (requestWrapperAnn && method.parameters.length > 0) {
        const paramType = method.parameters[0].type;
        endpoint.requestBody = {
          type: paramType,
          fields: this.modelCache.get(paramType) || {},
          required: true
        };
      }

      // Process response wrapper
      const responseWrapperAnn = method.annotations.find((ann: any) => 
        ann.name === '@ResponseWrapper'
      );

      if (responseWrapperAnn && method.returnType !== 'void') {
        endpoint.responseBody = {
          type: method.returnType,
          fields: this.modelCache.get(method.returnType) || {}
        };
      }

      endpoints.push(endpoint);
    });

    return endpoints;
  }

  private static getBaseRequestMapping(annotations: any[]): string {
    const requestMapping = annotations.find(ann => ann.name === '@RequestMapping');
    return requestMapping?.args?.value || '';
  }

  private static getHttpMethod(mappingAnnotation: string): string {
    const methodMap: Record<string, string> = {
      '@GetMapping': 'GET',
      '@PostMapping': 'POST',
      '@PutMapping': 'PUT',
      '@DeleteMapping': 'DELETE',
      '@PatchMapping': 'PATCH',
      '@RequestMapping': 'GET'
    };
    return methodMap[mappingAnnotation] || 'GET';
  }

  private static processMethodParameters(method: any) {
    return method.parameters.map((param: any) => {
      const paramAnn = param.annotations.find((a: any) => 
        ['@PathVariable', '@RequestParam', '@RequestHeader', '@RequestBody'].includes(a.name)
      );

      return {
        name: param.name,
        type: param.type,
        required: true,
        in: this.getParameterType(paramAnn?.name)
      };
    });
  }

  private static getParameterType(annotationType: string | undefined): string {
    const typeMap: Record<string, string> = {
      '@PathVariable': 'path',
      '@RequestParam': 'query',
      '@RequestHeader': 'header',
      '@RequestBody': 'body'
    };
    return typeMap[annotationType || ''] || 'query';
  }

  private static extractModelFields(modelClass: any): Record<string, any> {
    const fields: Record<string, any> = {};

    if (!modelClass.body || !modelClass.body.declarations) {
      return fields;
    }

    modelClass.body.declarations
      .filter((decl: any) => decl.type === 'FieldDeclaration')
      .forEach((field: any) => {
        const name = field.declarator.name;
        const type = field.type.name;

        fields[name] = {
          type,
          required: !field.annotations.some((ann: any) => 
            ann.name === '@Nullable' || ann.name === '@JsonIgnore'
          )
        };
      });

    return fields;
  }
}