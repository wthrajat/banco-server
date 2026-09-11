import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { fetch } from 'undici';

const BLOCKED_HOSTNAME_SUFFIXES = [
  'localhost',
  '.local',
  '.internal',
  '.localdomain',
];

const isPrivateIpv4 = (ip: string): boolean => {
  const [a, b] = ip.split('.').map(Number);

  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;

  return false;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');

  if (normalized === '::' || normalized === '::1') return true;
  if (/^f[cd]/.test(normalized)) return true;
  if (normalized.startsWith('fe80')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }

  return false;
};

export const isPrivateAddress = (ip: string): boolean => {
  const version = isIP(ip);

  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);

  return true;
};

export const assertPublicUrl = async (raw: string): Promise<URL> => {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Only https URLs are allowed');
  }

  if (url.username || url.password) {
    throw new Error('Credentials are not allowed in URLs');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');

  if (BLOCKED_HOSTNAME_SUFFIXES.some((s) => hostname.endsWith(s))) {
    throw new Error('Host is not allowed');
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error('Host is not allowed');
    }

    return url;
  }

  const resolved = await lookup(hostname, { all: true });

  if (!resolved.length || resolved.some((r) => isPrivateAddress(r.address))) {
    throw new Error('Host is not allowed');
  }

  return url;
};

export const publicFetch: typeof fetch = async (input, init) => {
  await assertPublicUrl(input.toString());
  return fetch(input, init);
};
