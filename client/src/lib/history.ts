import { Request } from '@shared/schema';
import { apiRequest } from '@/lib/api';

export function generateHistoryRouteId(method: string, timestamp: string): string {
  return `history-${method.toLowerCase()}-${timestamp}`;
}

export async function saveHistoryRequest(request: Request) {
  try {
    const timestamp = request.id || request.routeId?.split('-').pop() || new Date().getTime().toString();
    const uniqueRouteId = generateHistoryRouteId(request.method, timestamp);

    const historyRequest = {
      ...request,
      routeId: uniqueRouteId,
      requestId: uniqueRouteId,
      name: `${request.method} Request (${new Date().toLocaleString()})`,
      timestamp: request.timestamp || new Date().toISOString() //Use existing timestamp if available
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