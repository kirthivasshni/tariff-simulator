export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api";

export function getApiUrl(endpoint: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  // Ensure API_BASE_URL ends with /api, then append endpoint
  const baseUrl = API_BASE_URL.endsWith("/api") 
    ? API_BASE_URL 
    : `${API_BASE_URL}/api`;
  return `${baseUrl}/${cleanEndpoint}`;
}
