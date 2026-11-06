import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from 'next/script';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ascii OS",
  description: "Ascii OS Desktop Environment",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Muat Puter.js setelah halaman selesai interaktif */}
        <Script 
          src="https://js.puter.com/v2/" 
          strategy="afterInteractive" 
        />
      </body>
    </html>
  );
}

