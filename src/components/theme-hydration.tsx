"use client"

import { useEffect, useState } from "react"

/**
 * 主题水合组件
 * 用于处理客户端水合，防止主题闪烁
 */
export function ThemeHydration({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return (
    <>
      <style jsx global>{`
        :root {
          --hydrated: ${isHydrated ? "true" : "false"};
        }
        
        body {
          visibility: var(--hydrated) === "true" ? visible : hidden;
        }
      `}</style>
      {children}
    </>
  )
} 