import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { tokenize, tokenizeQuery, processTerm } from "../src/lib/local/tokenizer.js";
import { getSearchIndex, clearIndexCache } from "../src/lib/local/index-manager.js";
import { searchLocal } from "../src/lib/local/search.js";

// ============================================
// Tokenizer Tests
// ============================================

describe("tokenizer", () => {
  describe("tokenize", () => {
    it("should tokenize English text", () => {
      const tokens = tokenize("Hello world");
      expect(tokens).toContain("hello");
      expect(tokens).toContain("world");
    });

    it("should split on punctuation and special chars", () => {
      const tokens = tokenize("path/to/file.md");
      expect(tokens).toContain("path");
      expect(tokens).toContain("to");
      expect(tokens).toContain("file");
      expect(tokens).toContain("md");
    });

    it("should tokenize Chinese characters", () => {
      const tokens = tokenize("你好世界");
      expect(tokens).toContain("你");
      expect(tokens).toContain("好");
      expect(tokens).toContain("世");
      expect(tokens).toContain("界");
    });

    it("should extract Chinese phrases (2-4 chars)", () => {
      const tokens = tokenize("数据分析");
      // Full phrase is captured
      expect(tokens).toContain("数据分析");
      // Individual characters are also captured
      expect(tokens).toContain("数");
      expect(tokens).toContain("据");
    });

    it("should handle mixed English and Chinese", () => {
      const tokens = tokenize("JavaScript 入门指南");
      expect(tokens).toContain("javascript");
      expect(tokens).toContain("入");
      expect(tokens).toContain("门");
      // Full phrase captured
      expect(tokens).toContain("入门指南");
    });

    it("should handle empty input", () => {
      expect(tokenize("")).toEqual([]);
      expect(tokenize("   ")).toEqual([]);
    });

    it("should lowercase English tokens", () => {
      const tokens = tokenize("JavaScript TypeScript");
      expect(tokens).toContain("javascript");
      expect(tokens).toContain("typescript");
      expect(tokens).not.toContain("JavaScript");
    });
  });

  describe("tokenizeQuery", () => {
    it("should include original words for exact matching", () => {
      const tokens = tokenizeQuery("JavaScript programming");
      expect(tokens).toContain("javascript");
      expect(tokens).toContain("programming");
    });

    it("should deduplicate tokens", () => {
      const tokens = tokenizeQuery("test test test");
      const testCount = tokens.filter(t => t === "test").length;
      expect(testCount).toBe(1);
    });
  });

  describe("processTerm", () => {
    it("should filter stop words", () => {
      expect(processTerm("the")).toBeNull();
      expect(processTerm("and")).toBeNull();
      expect(processTerm("is")).toBeNull();
      expect(processTerm("的")).toBeNull();
      expect(processTerm("是")).toBeNull();
    });

    it("should keep meaningful words", () => {
      expect(processTerm("javascript")).toBe("javascript");
      expect(processTerm("function")).toBe("function");
      expect(processTerm("数据")).toBe("数据");
    });

    it("should filter single English letters", () => {
      expect(processTerm("a")).toBeNull();
      expect(processTerm("x")).toBeNull();
    });

    it("should keep single Chinese characters", () => {
      expect(processTerm("好")).toBe("好");
    });

    it("should handle empty input", () => {
      expect(processTerm("")).toBeNull();
    });

    it("should lowercase output", () => {
      expect(processTerm("JavaScript")).toBe("javascript");
    });
  });
});

// ============================================
// Index Manager Tests
// ============================================

describe("index-manager", () => {
  let testDir: string;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `tt-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("getSearchIndex", () => {
    it("should build index from vault files", async () => {
      // Create test files
      await writeFile(
        join(testDir, "note1.md"),
        "---\ntitle: Test Note\ntags: [test, example]\n---\n# Test Note\n\nThis is a test note."
      );
      await writeFile(
        join(testDir, "note2.md"),
        "# Another Note\n\nAnother test document about JavaScript."
      );

      const vaultConfig = {
        path: testDir,
        type: "markdown" as const,
      };

      clearIndexCache();
      const index = await getSearchIndex("test-vault", vaultConfig);

      expect(index).toBeDefined();
      expect(index.documentCount).toBe(2);
    });

    it("should find documents by content", async () => {
      await writeFile(
        join(testDir, "javascript.md"),
        "# JavaScript Guide\n\nLearn JavaScript programming."
      );
      await writeFile(
        join(testDir, "python.md"),
        "# Python Guide\n\nLearn Python programming."
      );

      const vaultConfig = {
        path: testDir,
        type: "markdown" as const,
      };

      clearIndexCache();
      const index = await getSearchIndex("test-vault", vaultConfig);
      
      const results = index.search("javascript");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("javascript.md");
    });

    it("should support fuzzy search", async () => {
      await writeFile(
        join(testDir, "javascript.md"),
        "# JavaScript Guide\n\nLearn JavaScript."
      );

      const vaultConfig = {
        path: testDir,
        type: "markdown" as const,
      };

      clearIndexCache();
      const index = await getSearchIndex("test-vault", vaultConfig);
      
      // "javascrpt" (typo) should match "javascript"
      const results = index.search("javascrpt", { fuzzy: 0.2 });
      expect(results.length).toBeGreaterThan(0);
    });

    it("should support prefix search", async () => {
      await writeFile(
        join(testDir, "typescript.md"),
        "# TypeScript Guide\n\nLearn TypeScript."
      );

      const vaultConfig = {
        path: testDir,
        type: "markdown" as const,
      };

      clearIndexCache();
      const index = await getSearchIndex("test-vault", vaultConfig);
      
      // "type" should match "typescript"
      const results = index.search("type", { prefix: true });
      expect(results.length).toBeGreaterThan(0);
    });

    it("should parse frontmatter tags", async () => {
      await writeFile(
        join(testDir, "tagged.md"),
        "---\ntitle: Tagged Note\ntags: [tutorial, beginner]\n---\n# Tagged Note\n\nContent here."
      );

      const vaultConfig = {
        path: testDir,
        type: "markdown" as const,
      };

      clearIndexCache();
      const index = await getSearchIndex("test-vault", vaultConfig);
      
      const results = index.search("tutorial");
      expect(results.length).toBe(1);
      expect(results[0].tags).toContain("tutorial");
    });

    it("should boost title matches", async () => {
      await writeFile(
        join(testDir, "title-match.md"),
        "# JavaScript Tutorial\n\nSome content about programming."
      );
      await writeFile(
        join(testDir, "content-match.md"),
        "# Other Note\n\nThis note mentions javascript in the content."
      );

      const vaultConfig = {
        path: testDir,
        type: "markdown" as const,
      };

      clearIndexCache();
      const index = await getSearchIndex("test-vault", vaultConfig);
      
      const results = index.search("javascript");
      expect(results.length).toBe(2);
      // Title match should rank higher
      expect(results[0].id).toBe("title-match.md");
    });
  });
});

// ============================================
// Search Module Tests
// ============================================

describe("searchLocal", () => {
  let testDir: string;
  
  beforeEach(async () => {
    testDir = join(tmpdir(), `tt-search-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    clearIndexCache();
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should return search results with score", async () => {
    await writeFile(
      join(testDir, "note.md"),
      "# Test Note\n\nThis is test content."
    );

    const results = await searchLocal("test", {
      path: testDir,
      type: "markdown",
    }, {}, "test-search");

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Test Note");
    expect(results[0].score).toBeDefined();
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("should filter by folder", async () => {
    await mkdir(join(testDir, "folder1"), { recursive: true });
    await mkdir(join(testDir, "folder2"), { recursive: true });
    
    await writeFile(
      join(testDir, "folder1", "note.md"),
      "# Folder1 Note\n\nJavaScript content."
    );
    await writeFile(
      join(testDir, "folder2", "note.md"),
      "# Folder2 Note\n\nJavaScript content."
    );

    const results = await searchLocal("javascript", {
      path: testDir,
      type: "markdown",
    }, { folder: "folder1" }, "test-folder");

    expect(results.length).toBe(1);
    expect(results[0].path).toContain("folder1");
  });

  it("should filter by tag", async () => {
    await writeFile(
      join(testDir, "tagged.md"),
      "---\ntags: [tutorial]\n---\n# Tagged\n\nContent here."
    );
    await writeFile(
      join(testDir, "untagged.md"),
      "# Untagged\n\nContent here too."
    );

    const results = await searchLocal("content", {
      path: testDir,
      type: "markdown",
    }, { tag: "tutorial" }, "test-tag");

    expect(results.length).toBe(1);
    expect(results[0].tags).toContain("tutorial");
  });

  it("should support exact match mode", async () => {
    await writeFile(
      join(testDir, "exact.md"),
      "# JavaScript Guide\n\nLearn JavaScript."
    );

    // Typo should NOT match in exact mode
    const results = await searchLocal("javascrpt", {
      path: testDir,
      type: "markdown",
    }, { exact: true }, "test-exact");

    expect(results.length).toBe(0);
  });

  it("should respect limit option", async () => {
    for (let i = 0; i < 5; i++) {
      await writeFile(
        join(testDir, `note${i}.md`),
        `# Note ${i}\n\nTest content here.`
      );
    }

    const results = await searchLocal("test", {
      path: testDir,
      type: "markdown",
    }, { limit: 3 }, "test-limit");

    expect(results.length).toBe(3);
  });

  it("should include matched fields", async () => {
    await writeFile(
      join(testDir, "note.md"),
      "---\ntitle: JavaScript Tutorial\n---\n# JavaScript Tutorial\n\nContent."
    );

    const results = await searchLocal("javascript", {
      path: testDir,
      type: "markdown",
    }, {}, "test-fields");

    expect(results.length).toBe(1);
    expect(results[0].matchedFields).toBeDefined();
    // MiniSearch returns matched terms, not field names
    expect(results[0].matchedFields!.length).toBeGreaterThan(0);
  });

  it("should search Chinese content", async () => {
    await writeFile(
      join(testDir, "chinese.md"),
      "# 数据分析指南\n\n使用 Python 进行数据处理。"
    );

    const results = await searchLocal("数据", {
      path: testDir,
      type: "markdown",
    }, {}, "test-chinese");

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("数据分析指南");
  });
});
