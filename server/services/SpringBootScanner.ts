import fs from 'fs';
import path from 'path';
import { JavaParser } from '../parser/JavaParser';

export class SpringBootScanner {
  private static readonly SPRING_BOOT_ANNOTATIONS = [
    '@SpringBootApplication',
    '@EnableAutoConfiguration',
    '@ComponentScan'
  ];

  private static readonly BUILD_FILES = [
    'pom.xml',
    'build.gradle',
    'build.gradle.kts'
  ];

  static async findSpringBootApp(rootDir: string): Promise<{
    mainClass?: string;
    basePackage?: string;
    componentScanPaths?: string[];
    srcMainJava?: string;
  }> {
    console.log('Looking for Spring Boot application...');

    // First, find the src/main/java directory
    const srcMainJava = await this.findSrcMainJava(rootDir);
    if (!srcMainJava) {
      console.log('Could not find src/main/java directory');
      return {};
    }
    console.log('Found src/main/java at:', srcMainJava);

    // Find Spring Boot application class
    const springBootApp = await this.findSpringBootAppClass(srcMainJava);
    if (!springBootApp) {
      console.log('Could not find Spring Boot application class');
      return { srcMainJava };
    }

    console.log('Found Spring Boot application:', springBootApp);
    return {
      ...springBootApp,
      srcMainJava
    };
  }

  private static async findSrcMainJava(rootDir: string): Promise<string | undefined> {
    // Look for Maven/Gradle build files first
    const hasBuildFile = this.BUILD_FILES.some(file => 
      fs.existsSync(path.join(rootDir, file))
    );

    if (!hasBuildFile) {
      console.log('No Maven/Gradle build files found');
      return undefined;
    }

    // Standard Maven/Gradle project structure
    const srcMainJava = path.join(rootDir, 'src', 'main', 'java');
    if (fs.existsSync(srcMainJava)) {
      return srcMainJava;
    }

    // Try to find it recursively (for multi-module projects)
    return await this.findDirRecursively(rootDir, 'src/main/java');
  }

  private static async findDirRecursively(dir: string, target: string): Promise<string | undefined> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);

        // Skip common non-source directories
        if (['node_modules', '.git', 'target', 'build'].includes(entry.name)) {
          continue;
        }

        // Check if this is the target directory
        if (fullPath.endsWith(target)) {
          return fullPath;
        }

        // Recurse into subdirectories
        const found = await this.findDirRecursively(fullPath, target);
        if (found) return found;
      }
    }

    return undefined;
  }

  private static async findSpringBootAppClass(srcMainJava: string): Promise<{
    mainClass?: string;
    basePackage?: string;
    componentScanPaths?: string[];
  } | undefined> {
    console.log('Scanning for Spring Boot application class in:', srcMainJava);

    async function scanDir(dir: string): Promise<{
      mainClass?: string;
      basePackage?: string;
      componentScanPaths?: string[];
    } | undefined> {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const result = await scanDir(path.join(dir, entry.name));
          if (result) return result;
        } else if (entry.isFile() && entry.name.endsWith('.java')) {
          const filePath = path.join(dir, entry.name);
          const content = fs.readFileSync(filePath, 'utf8');

          // Quick check before parsing
          if (!content.includes('@SpringBootApplication')) {
            continue;
          }

          console.log('Found potential Spring Boot application:', filePath);

          try {
            const ast = JavaParser.parseContent(content);
            if (!ast) continue;

            // Find class with Spring Boot annotations
            const springBootClasses = JavaParser.findAnnotatedClasses(ast, this.SPRING_BOOT_ANNOTATIONS);

            if (springBootClasses.length > 0) {
              const mainClass = springBootClasses[0];
              console.log('Confirmed Spring Boot application class:', mainClass.name);

              // Extract package
              const packageMatch = content.match(/package\s+([\w.]+);/);
              const basePackage = packageMatch ? packageMatch[1] : undefined;

              // Extract component scan paths
              const componentScanPaths = this.extractComponentScanPaths(mainClass);

              return {
                mainClass: mainClass.name,
                basePackage,
                componentScanPaths
              };
            }
          } catch (error) {
            console.error('Error parsing Java file:', error);
          }
        }
      }

      return undefined;
    }

    return await scanDir(srcMainJava);
  }

  private static extractComponentScanPaths(classAst: any): string[] {
    const paths: string[] = [];

    // Look for @ComponentScan annotation
    const componentScan = classAst.annotations.find(ann => 
      ann.name === '@ComponentScan'
    );

    if (componentScan && componentScan.args) {
      if (Array.isArray(componentScan.args.basePackages)) {
        paths.push(...componentScan.args.basePackages);
      } else if (componentScan.args.value) {
        paths.push(componentScan.args.value);
      }
    }

    return paths;
  }
}