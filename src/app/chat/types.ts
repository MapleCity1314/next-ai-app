export interface Message {
  id: string;
  role: "user" | "assistant"; // 消息角色
  content: string; // 消息内容
  isOptimistic?: boolean; // 是否是乐观消息
}

export interface ChatMessage extends Message {
  timestamp: number;
}
