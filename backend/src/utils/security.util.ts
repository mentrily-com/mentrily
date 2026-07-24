import * as dns from 'dns';
import * as net from 'net';

/**
 * Checks if an IP address is a private, loopback, or link-local address.
 */
export function isPrivateIP(ip: string): boolean {
  if (!net.isIP(ip)) return false;

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    return (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      parts[0] === 0
    );
  } else if (net.isIPv6(ip)) {
    const ipLower = ip.toLowerCase();
    return (
      ipLower === '::1' ||
      ipLower.startsWith('fc') ||
      ipLower.startsWith('fd') ||
      ipLower.startsWith('fe8') ||
      ipLower.startsWith('fe9') ||
      ipLower.startsWith('fea') ||
      ipLower.startsWith('feb') ||
      ipLower.startsWith('::ffff:127.') ||
      ipLower.startsWith('::ffff:169.254.')
    );
  }
  return false;
}

/**
 * Validates a URL to prevent Server-Side Request Forgery (SSRF) attacks.
 * It resolves the hostname via DNS and returns the first safe, non-private IP address found.
 * If all resolved IPs are private or if resolution fails, it returns null.
 */
export async function getSafeIPFromUrl(
  urlString: string,
): Promise<string | null> {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1'
    ) {
      return null;
    }

    // If it's already an IP address, just check it directly
    if (net.isIP(url.hostname)) {
      return isPrivateIP(url.hostname) ? null : url.hostname;
    }

    const addresses = await dns.promises.lookup(url.hostname, { all: true });

    for (const addr of addresses) {
      if (!isPrivateIP(addr.address)) {
        return addr.address;
      }
    }

    return null;
  } catch (_e) {
    return null;
  }
}
