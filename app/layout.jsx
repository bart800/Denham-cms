import "./globals.css";
export const metadata = { title: "Denham CMS", description: "Denham Property & Injury Law — Case Management System" };
export default function RootLayout({ children }) {
  return (<html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" /></head><body>{children}</body></html>);
}
