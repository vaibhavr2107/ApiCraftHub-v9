import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function generateRequestId(name: string, collectionName?: string): string {
  if (!name) return Date.now().toString();

  const sanitizedName = slugify(name);

  // For collection requests: always use collectionName-requestName format
  if (collectionName) {
    const sanitizedCollectionName = slugify(collectionName);
    return `${sanitizedCollectionName}-${sanitizedName}`;
  }

  // For new requests: Check localStorage for existing requests
  const savedRequests = localStorage.getItem("saved_requests");
  if (!savedRequests) {
    return sanitizedName;
  }

  try {
    const requests = JSON.parse(savedRequests);
    const existingIds = new Set(requests.map((r: any) => r.id));

    // If the base name doesn't exist, use it
    if (!existingIds.has(sanitizedName)) {
      return sanitizedName;
    }

    // Find the next available version number
    let version = 1;
    while (existingIds.has(`${sanitizedName}-v${version}`)) {
      version++;
    }
    return `${sanitizedName}-v${version}`;
  } catch (e) {
    console.error("Error parsing saved requests:", e);
    return `${sanitizedName}-${Date.now()}`;
  }
}

// New function for generating route IDs
export function generateRouteId(name: string, collectionName?: string): string {
  if (!name) return Date.now().toString();

  const sanitizedName = slugify(name);

  // For collection requests: always use collectionName-requestName format
  if (collectionName) {
    const sanitizedCollectionName = slugify(collectionName);
    return `${sanitizedCollectionName}-${sanitizedName}`;
  }

  // For new requests: Check localStorage for existing routes
  const savedRequests = localStorage.getItem("saved_requests");
  if (!savedRequests) {
    return sanitizedName;
  }

  try {
    const requests = JSON.parse(savedRequests);
    const existingRouteIds = new Set(requests.map((r: any) => r.routeId));

    // If the base name doesn't exist, use it
    if (!existingRouteIds.has(sanitizedName)) {
      return sanitizedName;
    }

    // Find the next available version number
    let version = 1;
    while (existingRouteIds.has(`${sanitizedName}-v${version}`)) {
      version++;
    }
    return `${sanitizedName}-v${version}`;
  } catch (e) {
    console.error("Error parsing saved requests:", e);
    return `${sanitizedName}-${Date.now()}`;
  }
}