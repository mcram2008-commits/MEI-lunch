import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Student Lunch & Leave Pass System",
    description: "Advanced student management for college lunch and leave passes",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased min-h-screen bg-gray-50/50">
                {children}
            </body>
        </html>
    );
}
