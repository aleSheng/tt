import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock config
vi.mock("../src/lib/config.js", () => ({
  getApiKey: vi.fn(() => "yzb_test_api_key"),
  getBaseUrl: vi.fn(() => "https://tagtime.ai"),
}));

const { 
  ApiError, 
  verifyApiKey, 
  createMaterial, 
  searchMaterials, 
  getMaterial,
  initiateDeviceFlow,
  pollForToken,
} = await import("../src/lib/api.js");

describe("api", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("ApiError", () => {
    it("should create error with code and message", () => {
      const error = new ApiError("TEST_ERROR", "Test message", 400);
      
      expect(error.code).toBe("TEST_ERROR");
      expect(error.message).toBe("Test message");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("ApiError");
    });
  });

  describe("verifyApiKey", () => {
    it("should verify API key successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            user: {
              id: "user-123",
              email: "test@example.com",
              name: "Test User",
            },
          },
        }),
      });

      const result = await verifyApiKey("yzb_test_key", "https://tagtime.ai");

      expect(result.user.email).toBe("test@example.com");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://tagtime.ai/api/cli/v1/auth/verify",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer yzb_test_key",
          }),
        })
      );
    });

    it("should throw ApiError on invalid key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid API key",
          },
        }),
      });

      await expect(verifyApiKey("invalid_key", "https://tagtime.ai")).rejects.toThrow(ApiError);
    });
  });

  describe("createMaterial", () => {
    it("should create material successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "material-123",
            url: "https://tagtime.ai/library/material-123",
          },
        }),
      });

      const result = await createMaterial({
        type: "text",
        content: "Test content",
        title: "Test Title",
      });

      expect(result.id).toBe("material-123");
      expect(result.url).toContain("material-123");
    });

    it("should send correct request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: "123", url: "https://tagtime.ai/library/123" },
        }),
      });

      await createMaterial({
        type: "text",
        content: "Test content",
        title: "Test Title",
        tagNames: ["tag1", "tag2"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/cli/v1/materials"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            type: "text",
            content: "Test content",
            title: "Test Title",
            tagNames: ["tag1", "tag2"],
          }),
        })
      );
    });
  });

  describe("searchMaterials", () => {
    it("should search materials with query", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            total: 2,
            items: [
              { id: "1", title: "Result 1", type: "text" },
              { id: "2", title: "Result 2", type: "text" },
            ],
            hasMore: false,
          },
        }),
      });

      const result = await searchMaterials("test query", 10);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("q=test+query"),
        expect.any(Object)
      );
    });
  });

  describe("getMaterial", () => {
    it("should get material by id", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "material-123",
            type: "text",
            title: "Test Material",
            content: "Test content",
            createdAt: "2026-01-20T10:00:00.000Z",
          },
        }),
      });

      const result = await getMaterial("material-123");

      expect(result.id).toBe("material-123");
      expect(result.title).toBe("Test Material");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/cli/v1/materials/material-123"),
        expect.any(Object)
      );
    });
  });

  describe("initiateDeviceFlow", () => {
    it("should initiate device flow successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            device_code: "device-code-123",
            user_code: "ABCD-EFGH",
            verification_uri: "https://tagtime.ai/cli/verify",
            verification_uri_complete: "https://tagtime.ai/cli/verify?code=ABCD-EFGH",
            expires_in: 900,
            interval: 5,
          },
        }),
      });

      const result = await initiateDeviceFlow("https://tagtime.ai");

      expect(result.device_code).toBe("device-code-123");
      expect(result.user_code).toBe("ABCD-EFGH");
      expect(result.verification_uri).toBe("https://tagtime.ai/cli/verify");
      expect(result.expires_in).toBe(900);
      expect(result.interval).toBe(5);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://tagtime.ai/api/cli/v1/auth/device-code",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ client_name: "TagTime CLI" }),
        })
      );
    });

    it("should throw ApiError on rate limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests",
          },
        }),
      });

      await expect(initiateDeviceFlow("https://tagtime.ai")).rejects.toThrow(ApiError);
    });
  });

  describe("pollForToken", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return token when authorized", async () => {
      // First call: authorization_pending
      // Second call: success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            error: {
              code: "authorization_pending",
              message: "User has not yet authorized",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              access_token: "yzb_new_token_123",
              token_type: "Bearer",
            },
          }),
        });

      const pollPromise = pollForToken(
        "https://tagtime.ai",
        "device-code-123",
        1, // 1 second interval for faster test
        60 // 60 seconds expiry
      );

      // Advance time for first poll interval
      await vi.advanceTimersByTimeAsync(1000);
      // Advance time for second poll interval
      await vi.advanceTimersByTimeAsync(1000);

      const token = await pollPromise;
      expect(token).toBe("yzb_new_token_123");
    });

    it("should throw on access_denied", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: "access_denied",
            message: "User denied authorization",
          },
        }),
      });

      const pollPromise = pollForToken(
        "https://tagtime.ai",
        "device-code-123",
        1,
        60
      );

      // Advance time and catch the error
      vi.advanceTimersByTime(1000);
      
      try {
        await pollPromise;
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as InstanceType<typeof ApiError>).message).toBe("You denied the authorization request");
      }
    });

    it("should throw on expired_token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: {
            code: "expired_token",
            message: "Token expired",
          },
        }),
      });

      const pollPromise = pollForToken(
        "https://tagtime.ai",
        "device-code-123",
        1,
        60
      );

      // Advance time and catch the error
      vi.advanceTimersByTime(1000);
      
      try {
        await pollPromise;
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as InstanceType<typeof ApiError>).message).toContain("authorization request has expired");
      }
    });

    it("should handle slow_down by increasing interval", async () => {
      // First: slow_down, Second: authorization_pending, Third: success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            error: { code: "slow_down", message: "Slow down" },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            error: { code: "authorization_pending", message: "Pending" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { access_token: "yzb_token", token_type: "Bearer" },
          }),
        });

      const pollPromise = pollForToken(
        "https://tagtime.ai",
        "device-code-123",
        1, // Start with 1 second
        120
      );

      // First poll at 1 second
      await vi.advanceTimersByTimeAsync(1000);
      // After slow_down, interval becomes 6 seconds (1+5)
      await vi.advanceTimersByTimeAsync(6000);
      // Third poll
      await vi.advanceTimersByTimeAsync(6000);

      const token = await pollPromise;
      expect(token).toBe("yzb_token");
    });
  });
});
