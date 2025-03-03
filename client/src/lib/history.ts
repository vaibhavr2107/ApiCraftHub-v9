import { Request } from '@shared/schema';
import { apiRequest } from '@/lib/api';

export function generateHistoryRouteId(method: string, url: string, timestamp: number): string {
  const baseRouteName = url.split('//')[1]
    .split('/').slice(1).join('-')
    .replace(/[^a-z0-9]+/g, '-');
  return `history-${method.toLowerCase()}-${baseRouteName}-${timestamp}`;
}

export async function saveHistoryRequest(request: Request) {
  try {
    const timestamp = new Date().getTime();
    const uniqueRouteId = generateHistoryRouteId(request.method, request.baseUrl, timestamp);
    const historyRequest = {
      ...request,
      routeId: uniqueRouteId,
      requestId: uniqueRouteId,
      name: `${request.method} ${request.baseUrl.split('//')[1].split('/').slice(1).join('/')}`,
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