import "./globals.css";

export const metadata = {
  title: "AI Agents",
  description: "Dashboard for managing and monitoring AI agents",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
