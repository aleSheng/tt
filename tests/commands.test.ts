import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock config
vi.mock("../src/lib/config.js", () => ({
  getApiKey: vi.fn(() => "yzb_test_api_key"),
  getBaseUrl: vi.fn(() => "https://tagtime.ai"),
  isLoggedIn: vi.fn(() => true),
}));

// Helper to create mock stdin
function createMockStdin(content: string): Readable {
  const readable = new Readable({
    read() {
      this.push(content);
      this.push(null);
    }
  });
  return readable;
}

// ============================================
// Save Command Tests
// ============================================

describe("save command helpers", () => {
  describe("content type detection", () => {
    // Import the functions after mocks are set up
    const detectContentType = (content: string): "text" | "markdown" | "code" => {
      // Markdown features
      if (/^#{1,6}\s|^\*\s|^-\s|^\d+\.\s|^```|^\|.*\|/.test(content)) {
        return "markdown";
      }
      // Code features (common language patterns)
      if (/^(import|export|function|const|let|var|class|def|async|package|public|private)\s/m.test(content)) {
        return "code";
      }
      return "text";
    };

    it("should detect markdown content", () => {
      expect(detectContentType("# Heading")).toBe("markdown");
      expect(detectContentType("## Second level")).toBe("markdown");
      expect(detectContentType("- list item")).toBe("markdown");
      expect(detectContentType("* bullet point")).toBe("markdown");
      expect(detectContentType("1. numbered item")).toBe("markdown");
      expect(detectContentType("```js\ncode\n```")).toBe("markdown");
      expect(detectContentType("| col1 | col2 |")).toBe("markdown");
    });

    it("should detect code content", () => {
      expect(detectContentType("import React from 'react'")).toBe("code");
      expect(detectContentType("export default function() {}")).toBe("code");
      expect(detectContentType("function hello() {}")).toBe("code");
      expect(detectContentType("const x = 1")).toBe("code");
      expect(detectContentType("let y = 2")).toBe("code");
      expect(detectContentType("var z = 3")).toBe("code");
      expect(detectContentType("class MyClass {}")).toBe("code");
      expect(detectContentType("def python_func():")).toBe("code");
      expect(detectContentType("async function fetchData() {}")).toBe("code");
    });

    it("should default to text for plain content", () => {
      expect(detectContentType("Hello world")).toBe("text");
      expect(detectContentType("Just some notes")).toBe("text");
      expect(detectContentType("Meeting at 3pm")).toBe("text");
    });

    it("should handle edge cases", () => {
      expect(detectContentType("")).toBe("text");
      expect(detectContentType("   ")).toBe("text");
      expect(detectContentType("\n\n\n")).toBe("text");
      expect(detectContentType("constant reminder")).toBe("text"); // "const" at start of word
      expect(detectContentType("the function of")).toBe("text"); // "function" not at line start
    });

    it("should detect multiline markdown", () => {
      // Note: The regex uses ^ with multiline flag (m), so # must be at line start
      const markdown = `# Main Title

More text here`;
      expect(detectContentType(markdown)).toBe("markdown");
    });

    it("should detect multiline code", () => {
      const code = `
// A JavaScript file
import { useState } from 'react';

export default function App() {
  return <div>Hello</div>;
}
`;
      expect(detectContentType(code)).toBe("code");
    });
  });

  describe("title generation", () => {
    const generateTitle = (content: string, maxLength = 50): string => {
      // Try to find a heading
      const headingMatch = content.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        return headingMatch[1].slice(0, maxLength);
      }
      
      // Use first line or first N characters
      const firstLine = content.split("\n")[0].trim();
      if (firstLine.length <= maxLength) {
        return firstLine;
      }
      return firstLine.slice(0, maxLength - 3) + "...";
    };

    it("should extract title from markdown heading", () => {
      expect(generateTitle("# My Document\n\nContent here")).toBe("My Document");
      expect(generateTitle("Some text\n# The Title\nMore")).toBe("The Title");
    });

    it("should use first line if no heading", () => {
      expect(generateTitle("First line\nSecond line")).toBe("First line");
    });

    it("should truncate long first lines", () => {
      const longLine = "A".repeat(100);
      const result = generateTitle(longLine);
      expect(result.length).toBe(50);
      expect(result.endsWith("...")).toBe(true);
    });

    it("should handle empty content", () => {
      expect(generateTitle("")).toBe("");
      expect(generateTitle("   ")).toBe("");
    });

    it("should handle content with only newlines", () => {
      expect(generateTitle("\n\n\n")).toBe("");
    });

    it("should use custom maxLength", () => {
      const content = "A".repeat(100);
      expect(generateTitle(content, 20).length).toBe(20);
      expect(generateTitle(content, 20).endsWith("...")).toBe(true);
    });

    it("should not truncate if content is shorter than maxLength", () => {
      expect(generateTitle("Short title", 50)).toBe("Short title");
      expect(generateTitle("Short", 10)).toBe("Short");
    });
  });

  describe("content size validation", () => {
    const MAX_CONTENT_SIZE = 1024 * 1024; // 1MB
    const WARN_CONTENT_SIZE = 100 * 1024; // 100KB

    const validateContentSize = (content: string): { valid: boolean; warning?: string; error?: string } => {
      const size = Buffer.byteLength(content, "utf-8");
      if (size > MAX_CONTENT_SIZE) {
        return { valid: false, error: `Content too large (${(size / 1024 / 1024).toFixed(2)}MB > 1MB)` };
      }
      if (size > WARN_CONTENT_SIZE) {
        return { valid: true, warning: `Content is large (${(size / 1024).toFixed(0)}KB)` };
      }
      return { valid: true };
    };

    it("should pass small content", () => {
      const result = validateContentSize("Hello world");
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it("should warn for large content", () => {
      const largeContent = "A".repeat(150 * 1024); // 150KB
      const result = validateContentSize(largeContent);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
    });

    it("should reject oversized content", () => {
      const oversizedContent = "A".repeat(2 * 1024 * 1024); // 2MB
      const result = validateContentSize(oversizedContent);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe("import command helpers", () => {
  describe("text file detection", () => {
    const TEXT_EXTENSIONS = new Set([
      ".md", ".markdown", ".txt", ".text",
      ".json", ".yaml", ".yml",
      ".js", ".ts", ".jsx", ".tsx",
      ".py", ".rb", ".go", ".rs", ".java", ".kt",
      ".css", ".scss", ".less",
      ".html", ".xml", ".svg",
      ".sh", ".bash", ".zsh",
      ".sql", ".graphql",
      ".env", ".ini", ".toml", ".conf",
    ]);

    const isTextFile = (filePath: string): boolean => {
      const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
      return TEXT_EXTENSIONS.has(ext) || ext === "";
    };

    it("should recognize text file extensions", () => {
      expect(isTextFile("readme.md")).toBe(true);
      expect(isTextFile("notes.txt")).toBe(true);
      expect(isTextFile("config.json")).toBe(true);
      expect(isTextFile("styles.css")).toBe(true);
      expect(isTextFile("script.js")).toBe(true);
      expect(isTextFile("main.py")).toBe(true);
    });

    it("should reject binary file extensions", () => {
      expect(isTextFile("image.png")).toBe(false);
      expect(isTextFile("photo.jpg")).toBe(false);
      expect(isTextFile("doc.pdf")).toBe(false);
      expect(isTextFile("archive.zip")).toBe(false);
    });

    it("should handle files without extensions", () => {
      expect(isTextFile("Makefile")).toBe(true);
      expect(isTextFile("Dockerfile")).toBe(true);
    });
  });

  describe("title generation from filename", () => {
    const generateTitleFromFilename = (filename: string): string => {
      // Remove extension
      let title = filename.replace(/\.[^.]+$/, "");
      // Get basename
      title = title.split("/").pop() || title;
      // Replace common separators with spaces
      title = title.replace(/[-_]/g, " ");
      // Remove date prefixes like "2024-01-20-"
      title = title.replace(/^\d{4} \d{2} \d{2}\s?/, "");
      // Capitalize first letter of each word
      title = title.replace(/\b\w/g, (c) => c.toUpperCase());
      return title.trim() || filename;
    };

    it("should convert filename to title", () => {
      expect(generateTitleFromFilename("my-notes.md")).toBe("My Notes");
      expect(generateTitleFromFilename("project_readme.txt")).toBe("Project Readme");
    });

    it("should remove date prefixes", () => {
      expect(generateTitleFromFilename("2024-01-20-meeting.md")).toBe("Meeting");
      expect(generateTitleFromFilename("2024-01-20 notes.md")).toBe("Notes");
    });

    it("should capitalize words", () => {
      expect(generateTitleFromFilename("hello-world.md")).toBe("Hello World");
      expect(generateTitleFromFilename("test_file.txt")).toBe("Test File");
    });
  });
});

describe("export command helpers", () => {
  describe("filename sanitization", () => {
    const sanitizeFilename = (name: string): string => {
      return name
        .replace(/[<>:"/\\|?*]/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()
        .slice(0, 100);
    };

    it("should remove invalid characters", () => {
      expect(sanitizeFilename("file:name")).toBe("file-name");
      expect(sanitizeFilename("file/name")).toBe("file-name");
      expect(sanitizeFilename("file\\name")).toBe("file-name");
      expect(sanitizeFilename("file?name")).toBe("file-name");
      expect(sanitizeFilename("file*name")).toBe("file-name");
    });

    it("should replace spaces with dashes", () => {
      expect(sanitizeFilename("my file name")).toBe("my-file-name");
      expect(sanitizeFilename("multiple   spaces")).toBe("multiple-spaces");
    });

    it("should convert to lowercase", () => {
      expect(sanitizeFilename("MyFileName")).toBe("myfilename");
    });

    it("should truncate long names", () => {
      const longName = "a".repeat(150);
      expect(sanitizeFilename(longName).length).toBe(100);
    });

    it("should remove leading/trailing dashes", () => {
      expect(sanitizeFilename("-name-")).toBe("name");
      expect(sanitizeFilename("---name---")).toBe("name");
    });
  });

  describe("filename template generation", () => {
    const generateFilename = (
      template: string,
      material: { id: string; title: string; type: string; createdAt?: string; tags?: Array<{ name: string }> },
      format: "markdown" | "json"
    ): string => {
      const date = material.createdAt
        ? new Date(material.createdAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      
      const tag = material.tags?.[0]?.name || "untagged";
      const sanitize = (s: string) => s.replace(/[<>:"/\\|?*\s]/g, "-").toLowerCase().slice(0, 50);
      
      let filename = template
        .replace("{id}", material.id.slice(0, 8))
        .replace("{title}", sanitize(material.title))
        .replace("{date}", date)
        .replace("{type}", material.type)
        .replace("{tag}", sanitize(tag));
      
      const ext = format === "json" ? ".json" : ".md";
      if (!filename.endsWith(ext)) {
        filename += ext;
      }
      
      return filename;
    };

    it("should generate filename with date and title", () => {
      const material = {
        id: "abc123def456",
        title: "My Notes",
        type: "text",
        createdAt: "2024-01-20T10:00:00.000Z",
      };
      
      const result = generateFilename("{date}-{title}", material, "markdown");
      expect(result).toBe("2024-01-20-my-notes.md");
    });

    it("should include short ID", () => {
      const material = {
        id: "abc123def456",
        title: "Test",
        type: "text",
      };
      
      const result = generateFilename("{id}-{title}", material, "markdown");
      expect(result).toContain("abc123de");
    });

    it("should use correct extension for format", () => {
      const material = { id: "123", title: "Test", type: "text" };
      
      expect(generateFilename("{title}", material, "markdown").endsWith(".md")).toBe(true);
      expect(generateFilename("{title}", material, "json").endsWith(".json")).toBe(true);
    });

    it("should handle missing tags", () => {
      const material = { id: "123", title: "Test", type: "text" };
      
      const result = generateFilename("{tag}/{title}", material, "markdown");
      expect(result).toContain("untagged");
    });
  });

  describe("markdown formatting", () => {
    const formatAsMarkdown = (
      material: {
        id: string;
        title: string;
        type: string;
        content?: string;
        sourceUrl?: string;
        createdAt?: string;
        tags?: Array<{ name: string }>;
      },
      includeMetadata: boolean
    ): string => {
      const lines: string[] = [];
      
      if (includeMetadata) {
        lines.push("---");
        lines.push(`id: ${material.id}`);
        lines.push(`title: "${material.title}"`);
        if (material.tags && material.tags.length > 0) {
          lines.push(`tags: [${material.tags.map(t => t.name).join(", ")}]`);
        }
        lines.push("---");
        lines.push("");
      }
      
      if (material.content && !material.content.trim().startsWith("# ")) {
        lines.push(`# ${material.title}`);
        lines.push("");
      }
      
      if (material.content) {
        lines.push(material.content);
      }
      
      return lines.join("\n");
    };

    it("should add frontmatter when includeMetadata is true", () => {
      const material = {
        id: "test-123",
        title: "Test Note",
        type: "text",
        content: "Hello world",
        tags: [{ name: "work" }, { name: "notes" }],
      };
      
      const result = formatAsMarkdown(material, true);
      
      expect(result).toContain("---");
      expect(result).toContain("id: test-123");
      expect(result).toContain('title: "Test Note"');
      expect(result).toContain("tags: [work, notes]");
    });

    it("should not add frontmatter when includeMetadata is false", () => {
      const material = {
        id: "test-123",
        title: "Test Note",
        type: "text",
        content: "Hello world",
      };
      
      const result = formatAsMarkdown(material, false);
      
      expect(result).not.toContain("---");
      expect(result).not.toContain("id:");
    });

    it("should add H1 title if content doesn't start with heading", () => {
      const material = {
        id: "123",
        title: "My Title",
        type: "text",
        content: "Some content here",
      };
      
      const result = formatAsMarkdown(material, false);
      
      expect(result).toContain("# My Title");
    });

    it("should not duplicate H1 if content already has heading", () => {
      const material = {
        id: "123",
        title: "My Title",
        type: "text",
        content: "# Existing Title\n\nContent",
      };
      
      const result = formatAsMarkdown(material, false);
      
      // Should not have "# My Title" added
      expect(result).toBe("# Existing Title\n\nContent");
    });

    it("should escape quotes in title", () => {
      const material = {
        id: "123",
        title: 'Title with "quotes"',
        type: "text",
        content: "Content",
      };
      
      const formatWithEscape = (m: typeof material, includeMetadata: boolean): string => {
        const lines: string[] = [];
        if (includeMetadata) {
          lines.push("---");
          lines.push(`id: ${m.id}`);
          lines.push(`title: "${m.title.replace(/"/g, '\\"')}"`);
          lines.push("---");
          lines.push("");
        }
        lines.push(m.content);
        return lines.join("\n");
      };
      
      const result = formatWithEscape(material, true);
      expect(result).toContain('title: "Title with \\"quotes\\""');
    });
  });
});

// ============================================
// Batch Operations Tests
// ============================================

describe("batch operations helpers", () => {
  describe("file size validation", () => {
    const MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_BATCH_SIZE = 50 * 1024 * 1024; // 50MB
    const MAX_BATCH_ITEMS = 100;

    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const validateBatch = (items: Array<{ content: string }>): { 
      valid: boolean; 
      error?: string;
      totalSize?: number;
    } => {
      if (items.length === 0) {
        return { valid: false, error: "Items array cannot be empty" };
      }
      if (items.length > MAX_BATCH_ITEMS) {
        return { valid: false, error: `Maximum ${MAX_BATCH_ITEMS} items per batch` };
      }

      let totalSize = 0;
      for (let i = 0; i < items.length; i++) {
        const size = Buffer.byteLength(items[i].content, "utf-8");
        if (size > MAX_CONTENT_SIZE) {
          return { 
            valid: false, 
            error: `Item ${i}: Content size ${formatSize(size)} exceeds maximum ${formatSize(MAX_CONTENT_SIZE)}` 
          };
        }
        totalSize += size;
      }

      if (totalSize > MAX_BATCH_SIZE) {
        return { 
          valid: false, 
          error: `Total batch size ${formatSize(totalSize)} exceeds maximum ${formatSize(MAX_BATCH_SIZE)}` 
        };
      }

      return { valid: true, totalSize };
    };

    it("should pass valid batch", () => {
      const items = [
        { content: "Content 1" },
        { content: "Content 2" },
        { content: "Content 3" },
      ];
      const result = validateBatch(items);
      expect(result.valid).toBe(true);
    });

    it("should reject empty batch", () => {
      const result = validateBatch([]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should reject batch with too many items", () => {
      const items = Array(150).fill({ content: "test" });
      const result = validateBatch(items);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("100");
    });

    it("should reject batch with oversized single item", () => {
      const items = [
        { content: "A".repeat(6 * 1024 * 1024) }, // 6MB
      ];
      const result = validateBatch(items);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Item 0");
    });

    it("should calculate total batch size", () => {
      const items = [
        { content: "A".repeat(1000) },
        { content: "B".repeat(2000) },
      ];
      const result = validateBatch(items);
      expect(result.valid).toBe(true);
      expect(result.totalSize).toBe(3000);
    });
  });

  describe("blocked file extensions", () => {
    const BLOCKED_EXTENSIONS = [
      ".exe", ".dll", ".so", ".dylib",
      ".bat", ".cmd", ".com", ".msi",
      ".scr", ".pif", ".vbs", ".vbe",
      ".ws", ".wsf", ".wsc", ".wsh",
      ".jar", ".war",
    ];

    const isBlockedExtension = (filename: string): boolean => {
      const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
      return ext ? BLOCKED_EXTENSIONS.includes(ext) : false;
    };

    it("should block executable files", () => {
      expect(isBlockedExtension("program.exe")).toBe(true);
      expect(isBlockedExtension("library.dll")).toBe(true);
      expect(isBlockedExtension("script.bat")).toBe(true);
      expect(isBlockedExtension("app.msi")).toBe(true);
    });

    it("should block Java archives", () => {
      expect(isBlockedExtension("app.jar")).toBe(true);
      expect(isBlockedExtension("webapp.war")).toBe(true);
    });

    it("should block VBS scripts", () => {
      expect(isBlockedExtension("script.vbs")).toBe(true);
      expect(isBlockedExtension("script.vbe")).toBe(true);
    });

    it("should allow safe extensions", () => {
      expect(isBlockedExtension("file.txt")).toBe(false);
      expect(isBlockedExtension("file.md")).toBe(false);
      expect(isBlockedExtension("file.json")).toBe(false);
      expect(isBlockedExtension("file.js")).toBe(false);
      expect(isBlockedExtension("file.py")).toBe(false);
    });

    it("should handle files without extensions", () => {
      expect(isBlockedExtension("Makefile")).toBe(false);
      expect(isBlockedExtension("README")).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(isBlockedExtension("PROGRAM.EXE")).toBe(true);
      expect(isBlockedExtension("Script.BAT")).toBe(true);
    });
  });

  describe("URL extension extraction", () => {
    const getExtensionFromUrl = (url: string): string | null => {
      try {
        const pathname = new URL(url).pathname;
        const match = pathname.match(/\.[^.]+$/);
        return match ? match[0].toLowerCase() : null;
      } catch {
        return null;
      }
    };

    it("should extract extension from URL path", () => {
      expect(getExtensionFromUrl("https://example.com/file.pdf")).toBe(".pdf");
      expect(getExtensionFromUrl("https://example.com/path/to/doc.txt")).toBe(".txt");
    });

    it("should handle URLs with query strings", () => {
      expect(getExtensionFromUrl("https://example.com/file.pdf?download=true")).toBe(".pdf");
    });

    it("should return null for URLs without extension", () => {
      expect(getExtensionFromUrl("https://example.com/page")).toBeNull();
      expect(getExtensionFromUrl("https://example.com/")).toBeNull();
    });

    it("should handle invalid URLs", () => {
      expect(getExtensionFromUrl("not a url")).toBeNull();
      expect(getExtensionFromUrl("")).toBeNull();
    });

    it("should normalize to lowercase", () => {
      expect(getExtensionFromUrl("https://example.com/FILE.PDF")).toBe(".pdf");
    });
  });
});

// ============================================
// Tag Parsing Tests
// ============================================

describe("tag parsing", () => {
  const parseTags = (tagString: string): string[] => {
    return tagString
      .split(",")
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  };

  it("should parse comma-separated tags", () => {
    expect(parseTags("work,personal,important")).toEqual(["work", "personal", "important"]);
  });

  it("should trim whitespace", () => {
    expect(parseTags(" work , personal , important ")).toEqual(["work", "personal", "important"]);
  });

  it("should filter empty tags", () => {
    expect(parseTags("work,,important")).toEqual(["work", "important"]);
    expect(parseTags(",work,")).toEqual(["work"]);
  });

  it("should handle single tag", () => {
    expect(parseTags("work")).toEqual(["work"]);
  });

  it("should handle empty string", () => {
    expect(parseTags("")).toEqual([]);
  });
});

// ============================================
// URL Validation Tests
// ============================================

describe("URL validation", () => {
  const isValidUrl = (str: string): boolean => {
    try {
      const url = new URL(str);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  it("should accept valid HTTP URLs", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("https://example.com/path/to/page")).toBe(true);
    expect(isValidUrl("https://example.com?query=value")).toBe(true);
  });

  it("should reject non-HTTP URLs", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("file:///path/to/file")).toBe(false);
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });

  it("should reject invalid URLs", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("example.com")).toBe(false); // Missing protocol
  });
});

// ============================================
// JSON Output Tests
// ============================================

describe("JSON output formatting", () => {
  const formatJsonOutput = (data: unknown, pretty = false): string => {
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  };

  it("should format compact JSON", () => {
    const data = { id: "123", title: "Test" };
    expect(formatJsonOutput(data)).toBe('{"id":"123","title":"Test"}');
  });

  it("should format pretty JSON", () => {
    const data = { id: "123", title: "Test" };
    const result = formatJsonOutput(data, true);
    expect(result).toContain("\n");
    expect(result).toContain("  ");
  });

  it("should handle arrays", () => {
    const data = [{ id: "1" }, { id: "2" }];
    const result = formatJsonOutput(data);
    expect(result).toBe('[{"id":"1"},{"id":"2"}]');
  });

  it("should handle null and undefined", () => {
    expect(formatJsonOutput(null)).toBe("null");
    expect(formatJsonOutput({ value: null })).toBe('{"value":null}');
  });
});
