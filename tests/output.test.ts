import { describe, it, expect } from "vitest";

// Import output utilities
const { formatMaterial, formatSearchResults } = await import("../src/lib/output.js");

describe("output", () => {
  describe("formatMaterial", () => {
    it("should format material with all fields", () => {
      const material = {
        id: "test-id-123",
        title: "Test Title",
        type: "text",
        content: "This is the content of the material",
        url: "https://tagtime.ai/library/test-id-123",
        createdAt: "2026-01-20T10:00:00.000Z",
      };

      const output = formatMaterial(material);

      expect(output).toContain("Test Title");
      expect(output).toContain("test-id-123");
      expect(output).toContain("text");
      expect(output).toContain("This is the content");
    });

    it("should truncate long content", () => {
      const longContent = "a".repeat(300);
      const material = {
        id: "test-id",
        title: "Test",
        type: "text",
        content: longContent,
      };

      const output = formatMaterial(material);

      expect(output).toContain("...");
      expect(output.length).toBeLessThan(longContent.length + 200);
    });

    it("should handle snippet instead of content", () => {
      const material = {
        id: "test-id",
        title: "Test",
        type: "text",
        snippet: "This is a snippet",
      };

      const output = formatMaterial(material);

      expect(output).toContain("This is a snippet");
    });
  });
});
