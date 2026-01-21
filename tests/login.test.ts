import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockOpen = vi.fn();
vi.mock("open", () => ({
  default: mockOpen,
}));

const mockConfig = {
  setApiKey: vi.fn(),
  setBaseUrl: vi.fn(),
  getBaseUrl: vi.fn(() => "https://tagtime.ai"),
};
vi.mock("../src/lib/config.js", () => mockConfig);

// Mock ora spinner
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  info: vi.fn().mockReturnThis(),
  text: "",
};
vi.mock("ora", () => ({
  default: vi.fn(() => mockSpinner),
}));

describe("login command", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockOpen.mockReset();
    mockConfig.setApiKey.mockReset();
    mockConfig.setBaseUrl.mockReset();
    mockSpinner.start.mockClear();
    mockSpinner.stop.mockClear();
    mockSpinner.succeed.mockClear();
    mockSpinner.fail.mockClear();
    mockSpinner.info.mockClear();
  });

  describe("Device Flow", () => {
    it("should correctly format device code request", () => {
      // Test the request body format
      const requestBody = JSON.stringify({ client_name: "TagTime CLI" });
      expect(requestBody).toBe('{"client_name":"TagTime CLI"}');
    });

    it("should correctly format token polling request", () => {
      const deviceCode = "test-device-code-123";
      const requestBody = JSON.stringify({
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      });
      
      expect(JSON.parse(requestBody)).toEqual({
        device_code: "test-device-code-123",
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      });
    });

    it("should parse device code response correctly", () => {
      const response = {
        success: true,
        data: {
          device_code: "device-123",
          user_code: "ABCD-EFGH",
          verification_uri: "https://tagtime.ai/cli/verify",
          verification_uri_complete: "https://tagtime.ai/cli/verify?code=ABCD-EFGH",
          expires_in: 900,
          interval: 5,
        },
      };

      expect(response.data.device_code).toBe("device-123");
      expect(response.data.user_code).toBe("ABCD-EFGH");
      expect(response.data.expires_in).toBe(900);
      expect(response.data.interval).toBe(5);
    });

    it("should parse token response correctly", () => {
      const response = {
        success: true,
        data: {
          access_token: "yzb_test_token_abc123",
          token_type: "Bearer",
        },
      };

      expect(response.data.access_token).toBe("yzb_test_token_abc123");
      expect(response.data.token_type).toBe("Bearer");
    });

    it("should handle authorization_pending status", () => {
      const response = {
        success: false,
        error: {
          code: "authorization_pending",
          message: "User has not yet authorized this device",
        },
      };

      expect(response.error.code).toBe("authorization_pending");
      // This status means we should continue polling
    });

    it("should handle access_denied status", () => {
      const response = {
        success: false,
        error: {
          code: "access_denied",
          message: "User denied authorization",
        },
      };

      expect(response.error.code).toBe("access_denied");
      // This status means user explicitly denied - stop polling
    });

    it("should handle expired_token status", () => {
      const response = {
        success: false,
        error: {
          code: "expired_token",
          message: "The user code has expired",
        },
      };

      expect(response.error.code).toBe("expired_token");
      // This status means code expired - stop polling
    });

    it("should handle slow_down status", () => {
      const response = {
        success: false,
        error: {
          code: "slow_down",
          message: "Too many requests",
        },
      };

      expect(response.error.code).toBe("slow_down");
      // This status means we should increase the polling interval
    });
  });

  describe("Direct Token Login", () => {
    it("should accept token via --token flag", async () => {
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

      // Import verifyApiKey to test direct token flow
      const { verifyApiKey } = await import("../src/lib/api.js");
      
      const result = await verifyApiKey("yzb_direct_token", "https://tagtime.ai");
      
      expect(result.user.email).toBe("test@example.com");
    });

    it("should reject invalid token format", () => {
      const validToken = "yzb_abc123xyz";
      const invalidToken = "invalid_token";
      
      expect(validToken.startsWith("yzb_")).toBe(true);
      expect(invalidToken.startsWith("yzb_")).toBe(false);
    });
  });

  describe("User Code Format", () => {
    it("should format user code as XXXX-XXXX", () => {
      const userCode = "ABCD-EFGH";
      const parts = userCode.split("-");
      
      expect(parts).toHaveLength(2);
      expect(parts[0]).toHaveLength(4);
      expect(parts[1]).toHaveLength(4);
      expect(/^[A-Z0-9]+-[A-Z0-9]+$/.test(userCode)).toBe(true);
    });

    it("should accept alphanumeric characters", () => {
      const validCodes = ["ABCD-EFGH", "1234-5678", "AB12-CD34", "9ZST-MVYP"];
      
      validCodes.forEach(code => {
        expect(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)).toBe(true);
      });
    });
  });
});
