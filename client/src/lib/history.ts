import { Request } from '@shared/schema';
import { apiRequest } from '@/lib/api';

export async function saveHistoryRequest(request: Request) {
  try {
    const response = await apiRequest('/api/history', {
      method: 'POST',
      body: JSON.stringify(request)
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