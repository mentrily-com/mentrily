import { NextRequest, NextResponse } from "next/server";

const ALLOWED_DOWNLOAD_HOSTS = [
  'nyc3.digitaloceanspaces.com',
  'digitaloceanspaces.com',
  'blockscode.me',
  'www.blockscode.me',
  'blockscode-production.vercel.app',
];

function isAllowedDownloadUrl(inputUrl: string): boolean {
  try {
    const parsed = new URL(inputUrl);
    if (!['https:', 'http:'].includes(parsed.protocol)) return false;

    const host = parsed.hostname.toLowerCase();
    return ALLOWED_DOWNLOAD_HOSTS.some((allowed) =>
      host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const name = req.nextUrl.searchParams.get("name") || "download";

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  if (!isAllowedDownloadUrl(url)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
    }

    const blob = await res.blob();
    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") || "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
    if (res.headers.get("content-length")) {
      headers.set("Content-Length", res.headers.get("content-length")!);
    }

    return new NextResponse(blob, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
