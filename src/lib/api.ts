import { getApiKey, getBaseUrl } from "./config.js";
import type { ApiResponse } from "./output.js";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ApiError("NOT_AUTHENTICATED", "Please login first with: tt login --token <your-api-key>");
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !json.success) {
    const error = json.error || { code: "UNKNOWN_ERROR", message: "An unknown error occurred" };
    throw new ApiError(error.code, error.message, response.status);
  }

  return json.data as T;
}

// Auth API
export interface VerifyResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export async function verifyApiKey(apiKey: string, baseUrl: string): Promise<VerifyResponse> {
  const url = `${baseUrl}/api/cli/v1/auth/verify`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const json = (await response.json()) as ApiResponse<VerifyResponse>;

  if (!response.ok || !json.success) {
    const error = json.error || { code: "UNKNOWN_ERROR", message: "An unknown error occurred" };
    throw new ApiError(error.code, error.message, response.status);
  }

  return json.data as VerifyResponse;
}

// Materials API
export interface Material {
  id: string;
  type: string;
  title: string;
  content?: string;
  sourceUrl?: string;
  createdAt: string;
  tags?: Array<{ id: string; name: string }>;
}

export interface CreateMaterialRequest {
  type: "text" | "link";
  title?: string;
  content: string;
  tagNames?: string[];
}

export interface CreateMaterialResponse {
  id: string;
  url: string;
}

export async function createMaterial(data: CreateMaterialRequest): Promise<CreateMaterialResponse> {
  return request<CreateMaterialResponse>("/api/cli/v1/materials", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface SearchResult {
  total: number;
  items: Array<{
    id: string;
    title: string;
    type: string;
    snippet?: string;
  }>;
  hasMore: boolean;
}

export async function searchMaterials(
  query: string,
  limit = 10
): Promise<SearchResult> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  return request<SearchResult>(`/api/cli/v1/materials/search?${params}`);
}

export async function getMaterial(id: string): Promise<Material> {
  return request<Material>(`/api/cli/v1/materials/${id}`);
}

export async function getRecentMaterials(limit = 10): Promise<SearchResult> {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  return request<SearchResult>(`/api/cli/v1/materials/recent?${params}`);
}

// Device Flow API
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export async function initiateDeviceFlow(baseUrl: string): Promise<DeviceCodeResponse> {
  const url = `${baseUrl}/api/cli/v1/auth/device-code`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_name: "TagTime CLI",
    }),
  });

  const json = (await response.json()) as ApiResponse<DeviceCodeResponse>;

  if (!response.ok || !json.success) {
    const error = json.error || { code: "UNKNOWN_ERROR", message: "An unknown error occurred" };
    throw new ApiError(error.code, error.message, response.status);
  }

  return json.data as DeviceCodeResponse;
}

export async function pollForToken(
  baseUrl: string,
  deviceCode: string,
  interval: number,
  expiresIn: number
): Promise<string> {
  const url = `${baseUrl}/api/cli/v1/auth/token`;
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1000;

  while (Date.now() < expiresAt) {
    // Wait for the interval
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const json = (await response.json()) as ApiResponse<{ access_token: string; token_type: string }>;

    if (response.ok && json.success && json.data?.access_token) {
      return json.data.access_token;
    }

    // Check for terminal errors
    const errorCode = json.error?.code;
    
    if (errorCode === "authorization_pending") {
      // Continue polling
      continue;
    }
    
    if (errorCode === "slow_down") {
      // Increase interval and continue
      interval = Math.min(interval + 5, 30);
      continue;
    }
    
    if (errorCode === "access_denied") {
      throw new ApiError("access_denied", "You denied the authorization request");
    }
    
    if (errorCode === "expired_token") {
      throw new ApiError("expired_token", "The authorization request has expired. Please try again.");
    }

    // Other errors
    throw new ApiError(
      errorCode || "UNKNOWN_ERROR",
      json.error?.message || "Authorization failed"
    );
  }

  throw new ApiError("expired_token", "The authorization request has expired. Please try again.");
}
