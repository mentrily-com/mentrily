import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { siteConfig } from "./config/site";
import { cookies, headers } from "next/headers";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

import { ToastProvider } from "./components/Common/Toast";
import { OrganizationProvider } from "./context/OrganizationContext";
import { Toaster } from "@/components/ui/toaster";
import NextTopLoader from "nextjs-toploader";

type InitialOrgBranding = {
  name: string;
  logo: string | null;
  primaryColor: string;
  domain: string;
} | null;

function normalizeHost(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/:\d+$/, "");
}

function resolveSubdomain(host: string, rootDomain: string): string {
  if (!host) return "";

  if (host === "localhost" || host.endsWith(".localhost")) {
    const localParts = host.split(".");
    if (localParts.length > 1) {
      return localParts[0] || "";
    }
    return "";
  }

  if (!rootDomain || !host.endsWith(`.${rootDomain}`)) {
    return "";
  }

  const prefix = host.slice(0, -(`.${rootDomain}`.length));
  if (!prefix) return "";

  return prefix.split(".")[0] || "";
}

async function getInitialOrganization(): Promise<InitialOrgBranding> {
  const headerStore = await headers();
  const cookieStore = await cookies();

  const rootDomain = normalizeHost(siteConfig.domain);
  const host = normalizeHost(headerStore.get("x-forwarded-host") || headerStore.get("host"));

  let subdomain = resolveSubdomain(host, rootDomain);

  if (!subdomain && host === "localhost") {
    subdomain = String(cookieStore.get("org_subdomain")?.value || "").toLowerCase();
  }

  if (!subdomain || ["www", "app", "api", "admin"].includes(subdomain)) {
    return null;
  }

  const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/$/, "");

  try {
    const res = await fetch(`${apiBase}/organization/public?domain=${encodeURIComponent(subdomain)}`, {
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      name: data.name,
      logo: data.logo,
      primaryColor: data.primaryColor || "#fc751b",
      domain: data.domain,
    };
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialOrganization = await getInitialOrganization();
  const initialBrand = initialOrganization?.primaryColor || "#4394FF";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{`
          :root {
            --brand: ${initialBrand};
            --brand-light: ${initialBrand}20;
            --brand-lighter: ${initialBrand}08;
            --brand-dark: ${initialBrand};
          }
        `}</style>
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                console.log = function() {};
                console.debug = function() {};
                console.info = function() {};
              `,
            }}
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <NextTopLoader color="#4394FF" showSpinner={false} speed={400} />
        <OrganizationProvider initialOrganization={initialOrganization}>
          <ToastProvider>
            {children}
            <Toaster />
          </ToastProvider>
        </OrganizationProvider>
      </body>
    </html>
  );
}
