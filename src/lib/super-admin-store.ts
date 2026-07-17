// Client-side mock store for SUPER_ADMIN area.
// Persists organizations & platform users in localStorage.
// Isolated from existing admin/operational data — safe placeholder until backend endpoints exist.

export const PLATFORM_MODULES = [
  "ONLINE_ORDERS",
  "TOTEM",
  "EVENTS",
  "PAYMENTS",
  "PRINTING",
  "NFC_CASHLESS",
  "FINANCIAL",
  "DEVICES",
  "REPORTS",
  "DELIVERY",
  "WHATSAPP",
  "LOYALTY",
] as const;

export type PlatformModule = (typeof PLATFORM_MODULES)[number];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  city: string;
  whatsapp: string;
  active: boolean;
  modules: PlatformModule[];
  createdAt: string;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  organizationId: string;
  role: "ADMIN" | "OPERATOR";
  active: boolean;
  createdAt: string;
}

const ORG_KEY = "super_admin_orgs";
const USR_KEY = "super_admin_users";
const SELECTED_ORG_KEY = "selected_organization_id";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function seedIfEmpty() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(ORG_KEY)) {
    const now = new Date().toISOString();
    const orgs: Organization[] = [
      {
        id: uid(),
        name: "Defumar Events",
        slug: "defumar",
        city: "São Paulo",
        whatsapp: "+55 11 99999-0000",
        active: true,
        modules: ["ONLINE_ORDERS", "TOTEM", "EVENTS", "PAYMENTS", "PRINTING", "NFC_CASHLESS", "FINANCIAL", "DEVICES", "REPORTS"],
        createdAt: now,
      },
    ];
    write(ORG_KEY, orgs);
  }
  if (!localStorage.getItem(USR_KEY)) {
    write(USR_KEY, [] as PlatformUser[]);
  }
}

export const superAdminStore = {
  listOrganizations(): Organization[] {
    seedIfEmpty();
    return read<Organization[]>(ORG_KEY, []);
  },
  createOrganization(input: Omit<Organization, "id" | "createdAt">): Organization {
    const orgs = this.listOrganizations();
    const org: Organization = { ...input, id: uid(), createdAt: new Date().toISOString() };
    write(ORG_KEY, [org, ...orgs]);
    return org;
  },
  updateOrganization(id: string, patch: Partial<Organization>): Organization | null {
    const orgs = this.listOrganizations();
    const idx = orgs.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    orgs[idx] = { ...orgs[idx], ...patch };
    write(ORG_KEY, orgs);
    return orgs[idx];
  },
  deleteOrganization(id: string) {
    write(ORG_KEY, this.listOrganizations().filter((o) => o.id !== id));
  },

  listUsers(): PlatformUser[] {
    seedIfEmpty();
    return read<PlatformUser[]>(USR_KEY, []);
  },
  createUser(input: Omit<PlatformUser, "id" | "createdAt">): PlatformUser {
    const users = this.listUsers();
    const user: PlatformUser = { ...input, id: uid(), createdAt: new Date().toISOString() };
    write(USR_KEY, [user, ...users]);
    return user;
  },
  updateUser(id: string, patch: Partial<PlatformUser>): PlatformUser | null {
    const users = this.listUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...patch };
    write(USR_KEY, users);
    return users[idx];
  },
  deleteUser(id: string) {
    write(USR_KEY, this.listUsers().filter((u) => u.id !== id));
  },

  selectOrganization(id: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(SELECTED_ORG_KEY, id);
  },
  getSelectedOrganizationId(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(SELECTED_ORG_KEY);
  },
};
