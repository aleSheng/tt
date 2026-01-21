/**
 * 自定义分词器 - 支持中英文混合
 */

// 中文字符范围
const CJK_REGEX = /[\u4e00-\u9fa5\u3400-\u4dbf]/g;

// 英文分词符号
const WORD_BOUNDARY_REGEX = /[\s\-_./\\,;:!?'"()\[\]{}|<>@#$%^&*+=~`]+/;

/**
 * 分词函数
 * - 英文: 按空格和标点分词
 * - 中文: 按字符分词 (简单但有效的方案)
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  
  const lowerText = text.toLowerCase();
  const tokens: string[] = [];
  
  // 提取英文单词
  const englishTokens = lowerText
    .split(WORD_BOUNDARY_REGEX)
    .filter(t => t.length > 0 && !/^[\u4e00-\u9fa5]+$/.test(t));
  
  tokens.push(...englishTokens);
  
  // 提取中文字符 (单字)
  const chineseChars = text.match(CJK_REGEX);
  if (chineseChars) {
    tokens.push(...chineseChars);
  }
  
  // 提取连续中文作为词组 (2-4字)
  const chineseGroups = text.match(/[\u4e00-\u9fa5]{2,4}/g);
  if (chineseGroups) {
    tokens.push(...chineseGroups);
  }
  
  return tokens.filter(t => t.length > 0);
}

/**
 * 搜索查询分词
 * 与索引分词略有不同，保留原始查询词
 */
export function tokenizeQuery(text: string): string[] {
  if (!text) return [];
  
  const tokens = tokenize(text);
  
  // 同时保留原始完整词 (用于精确匹配)
  const originalWords = text.toLowerCase().split(WORD_BOUNDARY_REGEX).filter(t => t.length > 0);
  
  // 去重
  return [...new Set([...tokens, ...originalWords])];
}

/**
 * 处理 term (小写化，过滤停用词)
 */
export function processTerm(term: string): string | null {
  if (!term || term.length === 0) return null;
  
  // 过滤太短的英文词 (保留中文单字)
  if (term.length === 1 && /[a-z]/.test(term)) return null;
  
  // 过滤常见停用词
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'as', 'if', 'then', 'else', 'when', 'where', 'why', 'how',
    '的', '是', '在', '和', '了', '有', '我', '他', '她', '它', '们', '这', '那',
  ]);
  
  if (stopWords.has(term)) return null;
  
  return term.toLowerCase();
}
