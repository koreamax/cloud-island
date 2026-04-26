import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cloud Island - AWS Infrastructure 3D Visualizer",
  description:
    "Visualize your AWS CloudTrail activity as a 3D voxel cloud island. See service categories, API call volumes, and error hotspots at a glance.",
  openGraph: {
    title: "Cloud Island (Celesta)",
    description: "AWS Infrastructure 3D Visualizer",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
