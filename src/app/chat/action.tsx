"use server"

import { LanguageModelV1, streamText } from "ai";
import { Message } from "./types";
import { deepseek } from "@ai-sdk/deepseek";
import React, { Suspense } from "react";
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import '@/styles/markdown.css';

// 调试信息
const DEBUG = true;
const logDebug = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Action Debug] ${message}`, data ? data : '');
  }
};

// 获取 Deepseek API 的文本流
const getTextStreamFromDeepseek = async (messages: Message[]) => {
  logDebug(`请求 Deepseek API，消息数量: ${messages.length}`);
  
  const { textStream } = await streamText({
    model: deepseek("deepseek-chat") as LanguageModelV1,
    messages,
  });

  return textStream;
};

// 简化函数名
const getTextStream = getTextStreamFromDeepseek;

// 获取助手消息内容流
export const getAssistantMessageStream = async (
  messages: Message[]
): Promise<ReadableStream<string>> => {
  logDebug(`获取助手消息流，消息数量: ${messages.length}`);
  return await getTextStream(messages);
};

// 将 ReadableStream 转换为 AsyncGenerator
async function* streamToAsyncGenerator(stream: ReadableStream<string>): AsyncGenerator<string> {
  const reader = stream.getReader();
  let buffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // 处理剩余的缓冲区
        if (buffer) {
          yield buffer;
        }
        break;
      }
      
      // 累积内容
      buffer += value;
      
      // 处理完整行
      const lines = buffer.split('\n');
      if (lines.length > 1) {
        // 保留最后一行
        buffer = lines.pop() || '';
        
        // 处理完整行
        const newContent = lines.join('\n');
        yield newContent;
      }
    }
  } catch (error) {
    console.error('流处理出错:', error);
    yield `<p class="text-red-500">处理出错: ${String(error)}</p>`;
  } finally {
    reader.releaseLock();
  }
}

// 状态机
class MarkdownRenderer {
  private buffer = '';
  private fullContent = '';
  private renderedContent = '';
  private onContentUpdate: ((content: string) => void) | null = null;
  
  // 设置内容更新回调
  setContentUpdateCallback(callback: (content: string) => void) {
    this.onContentUpdate = callback;
  }
  
  // 处理流式内容
  async processStream(stream: ReadableStream<string>): Promise<string> {
    const reader = stream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // 处理剩余的缓冲区
          if (this.buffer) {
            this.fullContent += this.buffer;
            this.processAndRenderIncremental(this.buffer);
          }
          break;
        }
        
        // 累积内容
        this.buffer += value;
        
        // 处理完整行
        const lines = this.buffer.split('\n');
        if (lines.length > 1) {
          // 保留最后一行
          this.buffer = lines.pop() || '';
          
          // 处理完整行
          const newContent = lines.join('\n');
          this.fullContent += newContent + '\n';
          
          // 处理增量内容
          this.processAndRenderIncremental(newContent);
        }
      }
      
      // 完整内容
      return this.renderedContent;
    } catch (error) {
      logDebug(`流处理出错:`, error);
      return `<p class="text-red-500">处理出错: ${String(error)}</p>`;
    }
  }
  
  // 处理增量内容并触发渲染
  private processAndRenderIncremental(newContent: string) {
    // 检查是否有完整的段落或代码块
    const hasCompleteParagraph = /\n\n/.test(newContent);
    const hasCompleteCodeBlock = /```[\s\S]*?```/.test(newContent);
    
    if (hasCompleteParagraph || hasCompleteCodeBlock) {
      // 处理 Markdown 内容
      const processedContent = this.processMarkdown(this.fullContent);
      
      // 更新渲染内容
      this.renderedContent = processedContent;
      
      // 触发内容更新回调
      if (this.onContentUpdate) {
        this.onContentUpdate(this.renderedContent);
      }
    }
  }
  
  // 处理完整的 Markdown 内容
  processMarkdown(markdown: string): string {
    // 预处理
    let html = markdown;
    
    // 处理代码块
    html = this.processCodeBlocks(html);
    
    // 分割为段落
    const paragraphs = html.split(/\n\n+/);
    let result = '';
    
    for (let paragraph of paragraphs) {
      paragraph = paragraph.trim();
      if (!paragraph) continue;
      
      // 跳过已处理的代码块
      if (paragraph.startsWith('<pre>') && paragraph.endsWith('</pre>')) {
        result += paragraph;
        continue;
      }
      
      // 处理标题
      if (/^#{1,6}\s/.test(paragraph)) {
        result += this.processHeading(paragraph);
        continue;
      }
      
      // 处理列表
      if (paragraph.startsWith('-') || paragraph.startsWith('*') || paragraph.startsWith('+') || /^\d+\.\s/.test(paragraph.split('\n')[0])) {
        result += this.processList(paragraph);
        continue;
      }
      
      // 处理引用
      if (paragraph.startsWith('>')) {
        result += this.processBlockquote(paragraph);
        continue;
      }
      
      // 处理表格
      if (paragraph.includes('|') && paragraph.includes('\n') && paragraph.split('\n').length >= 3) {
        const possibleTable = this.processTable(paragraph);
        if (possibleTable) {
          result += possibleTable;
          continue;
        }
      }
      
      // 处理水平线
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(paragraph)) {
        result += '<hr>';
        continue;
      }
      
      // 默认处理为段落
      result += `<p>${this.processInlineElements(paragraph)}</p>`;
    }
    
    return result;
  }
  
  // 处理代码块
  private processCodeBlocks(markdown: string): string {
    // 匹配代码块
    const regex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
    
    return markdown.replace(regex, (match, language, code) => {
      try {
        const lang = language.trim() || 'plaintext';
        const escapedCode = this.escapeHtml(code);
        let highlighted = escapedCode;
        
        // 代码高亮
        try {
          highlighted = hljs.highlight(code, { language: lang }).value;
        } catch {
          console.log(`代码高亮失败: ${lang}`);
        }
        
        return `<pre><code class="language-${lang}">${highlighted}</code></pre>`;
      } catch {
        // 如果处理失败，返回原始代码块
        return `<pre><code>${this.escapeHtml(code)}</code></pre>`;
      }
    });
  }
  
  // 处理标题
  private processHeading(text: string): string {
    const match = text.match(/^(#{1,6})\s+(.+)$/m);
    if (match) {
      const level = match[1].length;
      const content = match[2].trim();
      return `<h${level}>${this.processInlineElements(content)}</h${level}>`;
    }
    return `<p>${this.processInlineElements(text)}</p>`;
  }
  
  // 处理列表
  private processList(text: string): string {
    const lines = text.split('\n');
    const firstLine = lines[0];
    
    // 检查是否为有序列表
    const isOrdered = /^\d+\.\s/.test(firstLine);
    
    let listHtml = isOrdered ? '<ol>' : '<ul>';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      if (isOrdered) {
        const match = line.match(/^\d+\.\s+(.+)$/);
        if (match) {
          listHtml += `<li>${this.processInlineElements(match[1])}</li>`;
        } else {
          listHtml += `<li>${this.processInlineElements(line)}</li>`;
        }
      } else {
        const match = line.match(/^[-*+]\s+(.+)$/);
        if (match) {
          listHtml += `<li>${this.processInlineElements(match[1])}</li>`;
        } else {
          listHtml += `<li>${this.processInlineElements(line)}</li>`;
        }
      }
    }
    
    listHtml += isOrdered ? '</ol>' : '</ul>';
    return listHtml;
  }
  
  // 处理引用
  private processBlockquote(text: string): string {
    const content = text
      .split('\n')
      .map(line => line.replace(/^>\s?/, ''))
      .join('\n');
    
    return `<blockquote>${this.processInlineElements(content)}</blockquote>`;
  }
  
  // 处理表格
  private processTable(text: string): string | null {
    const lines = text.split('\n');
    
    // 需要至少有表头、分隔行和一行数据
    if (lines.length < 3) return null;
    
    // 检查第二行是否为分隔行
    if (!lines[1].includes('|') || !lines[1].includes('-')) return null;
    
    let tableHtml = '<table><thead><tr>';
    
    // 处理表头
    const headers = lines[0].split('|').map(cell => cell.trim()).filter(cell => cell);
    for (const header of headers) {
      tableHtml += `<th>${this.processInlineElements(header)}</th>`;
    }
    
    tableHtml += '</tr></thead><tbody>';
    
    // 处理数据行
    for (let i = 2; i < lines.length; i++) {
      if (!lines[i].includes('|')) continue;
      
      const cells = lines[i].split('|').map(cell => cell.trim()).filter(cell => cell);
      if (cells.length) {
        tableHtml += '<tr>';
        for (const cell of cells) {
          tableHtml += `<td>${this.processInlineElements(cell)}</td>`;
        }
        tableHtml += '</tr>';
      }
    }
    
    tableHtml += '</tbody></table>';
    return tableHtml;
  }
  
  // 处理内联元素
  private processInlineElements(text: string): string {
    let processed = text;
    
    // 处理代码
    processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 处理粗体
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // 处理斜体
    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    processed = processed.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // 处理删除线
    processed = processed.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    
    // 处理链接
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // 处理图片
    processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
    
    return processed;
  }
  
  // 转义 HTML 字符
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// 获取消息的 React 节点
export const getMessageReactNode = async (message: Message) => {
  logDebug(`获取消息 React 节点，消息ID: ${message.id}`);
  
  return (
    <Suspense fallback={<div>AI 助手正在思考...</div>}>
      <StreamableAIMessage message={message} />
    </Suspense>
  );
};

const StreamableAIMessage = async ({ message }: { message: Message }) => {
  const stream = await getAssistantMessageStream([message]);
  const renderer = new MarkdownRenderer();

  const generator = streamToAsyncGenerator(stream);
  
  return (
    <StreamableRenderFromAsyncGenerator g={generator} renderer={renderer} />
  );
};

const StreamableRenderFromAsyncGenerator = async ({
  g,
  renderer
}: {
  g: AsyncGenerator<string>;
  renderer: MarkdownRenderer;
}) => {
  const { done, value } = await g.next();
  
  if (done) {
    return <div className="markdown-content prose prose-sm dark:prose-invert max-w-none" />;
  }
  
  // 处理当前内容
  const processedContent = renderer.processMarkdown(value);
  
  return (
    <>
      <div 
        className="markdown-content prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
      <Suspense fallback={<div>...</div>}>
        <StreamableRenderFromAsyncGenerator g={g} renderer={renderer} />
      </Suspense>
    </>
  );
};
