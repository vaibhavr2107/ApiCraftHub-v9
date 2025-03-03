import { Request } from '@shared/schema';
import { apiRequest } from '@/lib/api';

export function generateHistoryRouteId(request: Request): string {
  const timestamp = new Date().getTime();
  const baseRouteName = request.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // Just append timestamp without datetime string
  return `history-${baseRouteName}-${timestamp}`;
}

export async function saveHistoryRequest(request: Request) {
  try {
    const uniqueRouteId = generateHistoryRouteId(request);
    const historyRequest = {
      ...request,
      routeId: uniqueRouteId,
      name: `${request.name} (${new Date().toLocaleString()})`,
      timestamp: new Date().toISOString()
    };

    const existingFiles = await listRequestFiles();
    const historyFiles = existingFiles.filter(file => file.startsWith('history-'));

    if (historyFiles.length >= 5) {
      historyFiles.sort((a, b) => {
        const timestampA = parseInt(a.split('-').pop() || '0');
        const timestampB = parseInt(b.split('-').pop() || '0');
        return timestampA - timestampB;
      });

      await apiRequest(`/api/history/${historyFiles[0]}`, {
        method: 'DELETE'
      });
    }

    const response = await apiRequest('/api/history', {
      method: 'POST',
      body: JSON.stringify(historyRequest)
    });
    return { success: true };
  } catch (error) {
    console.error('Error saving history request:', error);
    return { success: false, error };
  }
}

export async function loadHistoryRequest(routeId: string): Promise<Request | null> {
  try {
    const response = await apiRequest(`/api/history/${routeId}`, {
      method: 'GET'
    });
    return response;
  } catch (error) {
    console.error('Error loading history request:', error);
    return null;
  }
}

export async function listRequestFiles(): Promise<string[]> {
  try {
    const response = await apiRequest('/api/history/files', {
      method: 'GET'
    });
    return response;
  } catch (error) {
    console.error('Error listing history files:', error);
    return [];
  }
}