"use client";

import { Message, ChatMessage } from "./types";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, User } from "lucide-react";
import { useChatStore } from "@/store/chat-store";

/**
 * @description 聊天页面核心
 * @author maplecity1314
 * @date 2025-04-09
 * @version 1.0.0
 */

// 调试信息
const DEBUG = true;
const logDebug = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Chat Debug] ${message}`, data ? data : "");
  }
};

interface ChatProps {
  getMessageReactNode: (message: Message) => Promise<React.ReactNode>;
}

const Chat = ({ getMessageReactNode }: ChatProps) => {
  const { addMessage } = useChatStore();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 本地状态管理聊天消息
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 存储 AI 响应节点
  const [aiResponseNodes, setAiResponseNodes] = useState<
    Map<string, React.ReactNode>
  >(new Map());

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiResponseNodes]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleMessageSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // 创建用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    logDebug(`创建用户消息: ${userMessage.id}`, input);

    // 添加到本地状态
    const newUserMessage: ChatMessage = {
      id: userMessage.id,
      role: "user",
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newUserMessage]);

    // 添加到 store 作为上下文管理
    addMessage(userMessage);

    setInput("");
    setIsLoading(true);

    try {
      logDebug(`开始获取 AI 响应，用户消息 ID: ${userMessage.id}`);

      // 占位
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now().toString()}`,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // 获取 AI 消息节点
      const aiNode = await getMessageReactNode(userMessage);

      logDebug(`获取到 AI 响应节点，AI 消息 ID: ${aiMessage.id}`);

      // 更新 AI 响应节点
      setAiResponseNodes((prev) => {
        const newMap = new Map(prev);
        newMap.set(aiMessage.id, aiNode);
        return newMap;
      });

      setIsLoading(false);
    } catch (error) {
      console.error("获取 AI 响应时出错:", error);
      logDebug(`获取 AI 响应出错:`, error);
      setIsLoading(false);
    }
  };

  // 渲染用户消息
  const renderUserMessage = (message: ChatMessage) => (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <User className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1">
        <div className="font-medium mb-1">您</div>
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );

  // 渲染 AI 消息
  const renderAIMessage = (message: ChatMessage) => {
    const aiNode = aiResponseNodes.get(message.id);

    return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-medium mb-1">AI 助手</div>
          {aiNode ? (
            <div className="ai-response">{aiNode}</div>
          ) : (
            <div className="flex items-center">
              <div className="h-4 w-4 animate-spin mr-2 border-2 border-primary border-t-transparent rounded-full"></div>
              <span className="text-sm text-muted-foreground">
                AI 正在思考...
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Bot className="h-12 w-12 mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">欢迎使用 AI 助手</h2>
            <p className="text-muted-foreground max-w-md">
              您可以向 AI 助手提问任何问题
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "user"
                  ? renderUserMessage(message)
                  : renderAIMessage(message)}
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleMessageSubmit} className="flex gap-2">
        <Textarea
          value={input}
          onChange={handleInputChange}
          placeholder="输入您的问题..."
          className="min-h-[60px] resize-none"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default Chat;
