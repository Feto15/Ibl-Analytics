import { create } from "zustand";

// UI-only state. Analytical filters live in URL query params (source of truth).
// This store holds ephemeral shell/display preferences only, per the design guide.

interface UIStore {
  mobileFiltersOpen: boolean;
  setMobileFiltersOpen: (open: boolean) => void;
  pbpCollapsed: boolean;
  togglePbpCollapsed: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  mobileFiltersOpen: false,
  setMobileFiltersOpen: (open) => set({ mobileFiltersOpen: open }),
  pbpCollapsed: false,
  togglePbpCollapsed: () => set((s) => ({ pbpCollapsed: !s.pbpCollapsed })),
}));
