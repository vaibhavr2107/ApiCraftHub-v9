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
  const sanitizedName = slugify(name);

  if (collectionName) {
    // For collection requests: collectionName-requestName
    return `${slugify(collectionName)}-${sanitizedName}`;
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