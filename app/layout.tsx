import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "桃源学境",
  description: "一炷香，桃源梦",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
