import { Ipware } from '@fullerstack/nax-ipware';
import { Request } from 'express';

const ipware = new Ipware({
  // Only the header a proxy in front of us sets. The library's default list also
  // reads x-real-ip, cf-connecting-ip and friends, which any caller can send.
  requestHeadersOrder: ['x-forwarded-for'],
  // A proxy appends the address it saw, so the caller's real one is right-most.
  // Anything a caller prepends itself sits to the left and is never read.
  proxy: { order: 'right-most' },
});

export const getIp = (req: Request): string | undefined => {
  const ipInfo = ipware.getClientIP(req);

  if (!ipInfo?.ip) return undefined;
  if (ipInfo.ip.includes('127.0.0.1')) return undefined;

  return ipInfo.ip;
};
