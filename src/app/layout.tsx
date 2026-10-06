import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { NotificationInit } from "@/components/NotificationInit";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

export const metadata: Metadata = {
  title: "SGA Tata CRM",
  description: "Lead management CRM dashboard for SGA Tata — track, manage, and close leads from Google Sheets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content="4MCfkQa__0lBxmitWK0CAVBLNyeoxQfRiTetnULxtHY" />
      </head>
      <body>
        <ImpersonationBanner />
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
        <NotificationInit />
      </body>
    </html>
  );
}

