"use client"

import Chat from "./chat"
import { getMessageReactNode } from "./action"
import { Bot } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * @description 聊天页面        
 * @author maplecity1314
 * @date 2025-04-09
 * @version 1.0.0
 */

const Page = () => {
    return (
        <div className="flex flex-col h-screen">
            <header className="border-b">
                <div className="container flex h-16 items-center px-4 justify-between">
                    <div className="flex items-center">
                        <Bot className="h-6 w-6 mr-2" />
                        <h1 className="text-xl font-bold">AI 助手</h1>
                    </div>
                    <ThemeToggle />
                </div>
            </header>
            <main className="flex-1 overflow-hidden">
                <Chat getMessageReactNode={getMessageReactNode} />
            </main>
        </div>
    )
}

export default Page



