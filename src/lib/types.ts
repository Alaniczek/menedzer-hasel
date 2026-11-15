export interface Entry {
  id: string;
  name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export type EntryInput = Omit<Entry, "id" | "createdAt" | "updatedAt">;

export interface VaultData {
  entries: Entry[];
}
