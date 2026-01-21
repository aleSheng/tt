import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

// Mock conf module
vi.mock("conf", () => {
  const store = new Map<string, unknown>();
  return {
    default: class MockConf {
      constructor() {}
      get(key: string) {
        if (key === "baseUrl" && !store.has(key)) {
          return "https://tagtime.ai";
        }
        return store.get(key);
      }
      set(key: string, value: unknown) {
        store.set(key, value);
      }
      clear() {
        store.clear();
      }
    },
  };
});

// Import after mocking
const { getConfig, setApiKey, setUser, setBaseUrl, clearConfig, isLoggedIn, getApiKey, getBaseUrl } = await import("../src/lib/config.js");

describe("config", () => {
  beforeEach(() => {
    clearConfig();
  });

  afterEach(() => {
    clearConfig();
  });

  describe("getConfig", () => {
    it("should return default config when not logged in", () => {
      const config = getConfig();
      expect(config.apiKey).toBeUndefined();
      expect(config.baseUrl).toBe("https://tagtime.ai");
      expect(config.user).toBeUndefined();
    });

    it("should return stored config after login", () => {
      setApiKey("test_key");
      setUser({ id: "123", email: "test@example.com", name: "Test User" });
      
      const config = getConfig();
      expect(config.apiKey).toBe("test_key");
      expect(config.user?.email).toBe("test@example.com");
    });
  });

  describe("setApiKey / getApiKey", () => {
    it("should store and retrieve API key", () => {
      setApiKey("yzb_test_api_key_12345");
      expect(getApiKey()).toBe("yzb_test_api_key_12345");
    });
  });

  describe("setBaseUrl / getBaseUrl", () => {
    it("should store and retrieve base URL", () => {
      setBaseUrl("http://localhost:3000");
      expect(getBaseUrl()).toBe("http://localhost:3000");
    });

    it("should return default base URL when not set", () => {
      expect(getBaseUrl()).toBe("https://tagtime.ai");
    });
  });

  describe("isLoggedIn", () => {
    it("should return false when not logged in", () => {
      expect(isLoggedIn()).toBe(false);
    });

    it("should return true when logged in", () => {
      setApiKey("test_key");
      expect(isLoggedIn()).toBe(true);
    });
  });

  describe("clearConfig", () => {
    it("should clear all stored config", () => {
      setApiKey("test_key");
      setUser({ id: "123", email: "test@example.com", name: null });
      
      clearConfig();
      
      expect(isLoggedIn()).toBe(false);
      expect(getApiKey()).toBeUndefined();
    });
  });
});
