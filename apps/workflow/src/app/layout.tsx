import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "FlyRank Workflow Studio", description: "Build and run visual AI decision workflows" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
