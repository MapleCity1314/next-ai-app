"use server";

import { LanguageModelV1, streamText } from "ai";
import { Message } from "../chat/types";
import { deepseek } from "@ai-sdk/deepseek";
import React, { Suspense } from "react";
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import '@/styles/markdown.css';
import { marked } from 'marked';

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

// 使用marked处理流式内容
const processStreamWithMarked = async (stream: ReadableStream<string>): Promise<string> => {
  const reader = stream.getReader();
  let buffer = '';
  let fullContent = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // 处理剩余的缓冲区
        if (buffer) {
          fullContent += buffer;
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
        for (const line of lines) {
          fullContent += line + '\n';
        }
      }
    }
    
    // 使用marked处理完整内容
    const markedResult = marked(fullContent);
    let html = typeof markedResult === 'string' ? markedResult : await markedResult;
    
    // 手动处理代码高亮
    html = html.replace(/<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g, (match: string, language: string, code: string) => {
      try {
        if (language && hljs.getLanguage(language)) {
          return `<pre><code class="language-${language}">${hljs.highlight(code, { language }).value}</code></pre>`;
        }
      } catch (err) {
        console.error('代码高亮失败:', err);
      }
      return match;
    });
    
    
    return html;
  } catch (error) {
    logDebug(`流处理出错:`, error);
    return `<p class="text-red-500">处理出错: ${String(error)}</p>`;
  }
};

// 获取消息的 React 节点
export const getMessageReactNode = async (message: Message) => {
  logDebug(`获取消息 React 节点，消息ID: ${message.id}`);
  
  return (
    <Suspense fallback={<div>AI 助手正在思考...</div>}>
      <StreamableAIMessage message={message} />
    </Suspense>
  );
};

// 流式 AI 消息组件
const StreamableAIMessage = async ({ message }: { message: Message }) => {
  const stream = await getAssistantMessageStream([message]);
  const html = await processStreamWithMarked(stream);
  logDebug("转换后完整内容:", html);
  return (
    <div 
      className="markdown-content prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
