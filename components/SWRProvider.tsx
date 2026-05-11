"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

export function SWRProvider({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ dedupingInterval: 2000 }}>{children}</SWRConfig>;
}
