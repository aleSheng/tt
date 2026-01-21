import chalk from "chalk";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// 格式化输出 - 成功
export function success(message: string): void {
  console.log(chalk.green("✓"), message);
}

// 格式化输出 - 错误
export function error(message: string): void {
  console.error(chalk.red("✗"), message);
}

// 格式化输出 - 警告
export function warn(message: string): void {
  console.log(chalk.yellow("⚠"), message);
}

// 格式化输出 - 信息
export function info(message: string): void {
  console.log(chalk.blue("ℹ"), message);
}

// 格式化输出 - 表格
export function table(data: Record<string, unknown>[]): void {
  console.table(data);
}

// 格式化单条资料
export function formatMaterial(material: {
  id: string;
  title: string;
  type: string;
  content?: string;
  snippet?: string;
  url?: string;
  createdAt?: string;
}): string {
  const lines: string[] = [];
  
  lines.push(chalk.bold(`📄 ${material.title}`));
  lines.push(chalk.dim(`   ID: ${material.id}`));
  lines.push(chalk.dim(`   Type: ${material.type}`));
  
  if (material.url) {
    lines.push(chalk.cyan(`   URL: ${material.url}`));
  }
  
  if (material.snippet) {
    lines.push("");
    lines.push(`   ${material.snippet}`);
  } else if (material.content) {
    const preview = material.content.slice(0, 200);
    lines.push("");
    lines.push(`   ${preview}${material.content.length > 200 ? "..." : ""}`);
  }
  
  if (material.createdAt) {
    lines.push("");
    lines.push(chalk.dim(`   Created: ${new Date(material.createdAt).toLocaleString()}`));
  }
  
  return lines.join("\n");
}

// 格式化搜索结果
export function formatSearchResults(
  results: {
    total: number;
    items: Array<{
      id: string;
      title: string;
      type: string;
      snippet?: string;
    }>;
    hasMore: boolean;
  },
  showIndex = false
): void {
  if (results.total === 0) {
    info("No results found.");
    return;
  }

  console.log(chalk.bold(`Found ${results.total} result(s):\n`));
  
  results.items.forEach((item, index) => {
    const prefix = showIndex 
      ? chalk.cyan(`@${index + 1}`) + " " 
      : "• ";
    console.log(chalk.bold(`${prefix}${item.title}`));
    // 显示短 ID（前8位）
    const shortId = item.id.slice(0, 8);
    console.log(chalk.dim(`   ID: ${shortId}... | Type: ${item.type}`));
    if (item.snippet) {
      console.log(`   ${item.snippet}`);
    }
    console.log("");
  });

  if (results.hasMore) {
    info("More results available. Use --limit to show more.");
  }
  
  if (showIndex) {
    console.log(chalk.dim("Tip: Use 'tt get @1' to get the first result, or 'tt get " + results.items[0]?.id.slice(0, 8) + "' with short ID"));
  }
}

// 格式化 JSON 输出
export function json(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
