import { create } from 'zustand'
import { Message } from '@/app/chat/types'

interface ChatState {
  messages: Message[]
  currentContext: string
  setCurrentContext: (context: string) => void
  addMessage: (message: Message) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  currentContext: '',
  setCurrentContext: (context) => set({ currentContext: context }),
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  clearMessages: () => set({ messages: [] })
})) 