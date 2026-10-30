"use client";

import { createContext, useContext } from "react";

// Lets the chat screen report its live unread total to the app shell, so the
// menu badge drops as soon as a channel is read instead of waiting for the
// layout to re-render (App Router keeps it mounted across navigations).
export const ChatUnreadContext = createContext<(total: number) => void>(() => {});

export function useReportChatUnread() {
  return useContext(ChatUnreadContext);
}
