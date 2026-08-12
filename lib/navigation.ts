export function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}
