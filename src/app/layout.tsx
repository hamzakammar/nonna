import type { Metadata } from "next";
import { Nunito, Young_Serif } from "next/font/google";
import "./globals.css";
import { PageNav } from "@/components/PageNav";

const serif = Young_Serif({
  variable: "--font-serif",
  weight: "400",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nonna.exe",
  description: "The back office that lives in Grandma's bakery",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div aria-hidden className="gingham" />
        {children}
        <PageNav />
      </body>
    </html>
  );
}
