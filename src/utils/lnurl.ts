const ADDRESS_USER_REGEX = /^[a-zA-Z0-9._+-]+$/;
const ADDRESS_DOMAIN_REGEX = /^[a-zA-Z0-9.-]+$/;

const splitAddress = (address: string): { user: string; domain: string } => {
  const [user, domain, ...rest] = address.split('@');

  if (!user || !domain || rest.length) {
    throw new Error('Invalid money address');
  }

  if (!ADDRESS_USER_REGEX.test(user) || !ADDRESS_DOMAIN_REGEX.test(domain)) {
    throw new Error('Invalid money address');
  }

  return { user, domain };
};

export const lightningAddressToUrl = (address: string) => {
  const { user, domain } = splitAddress(address);

  return `https://${domain}/.well-known/lnurlp/${user}`;
};

export const lightningAddressToPubkeyUrl = (address: string) => {
  const { user, domain } = splitAddress(address);

  return `https://${domain}/.well-known/lnurlpubkey/${user}`;
};

export const lightningAddressToMessageUrl = (address: string) => {
  const { user, domain } = splitAddress(address);

  return `https://${domain}/message/${user}`;
};
