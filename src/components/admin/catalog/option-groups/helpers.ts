export function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const isSizeGroup = (g: { name?: string; key?: string }): boolean =>
  /(tamanho|size|pizza-size)/i.test(g.key ?? "") ||
  /(tamanho|size)/i.test(g.name ?? "");
