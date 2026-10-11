import * as React from "react";
import { cn } from "@/lib/utils";
export function Button({ className, variant = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" | "destructive" }) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50", variant === "default" && "bg-indigo-600 text-white hover:bg-indigo-500", variant === "outline" && "border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800", variant === "ghost" && "text-slate-300 hover:bg-slate-800", variant === "destructive" && "bg-red-600 text-white hover:bg-red-500", className)} {...props} />;
}
