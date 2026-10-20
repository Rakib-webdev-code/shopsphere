export const desktopNavLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/categories", label: "Categories" },
  { href: "/about", label: "About" },
] as const;

export const mobileNavLinks = [
  ...desktopNavLinks,
  { href: "/account", label: "Account" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/cart", label: "Cart" },
] as const;

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
