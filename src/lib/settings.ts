const STORAGE_KEY = 'gme_sales_settings'

export const DEFAULT_OWNERS = ['Andrew', 'Jacey', 'Violet', 'John']
export const DEFAULT_SOURCES = ['Expo', 'Referral', 'Website', 'Cold Call', 'Partner', 'Offline Visit']
export const DEFAULT_BUSINESS_TYPES = ['Korean Restaurant', 'Travel Agency', 'Korean Grocery', 'Education/Academy', 'Import/Export', 'Other Korean Business']
export const DEFAULT_CORRIDORS = ['Korea → Japan', 'Korea → Australia', 'Korea → USA', 'Korea → Vietnam', 'Korea → Singapore', 'Korea → Philippines', 'Japan → Korea', 'Other']

export interface SalesSettingsData {
  owners: string[]
  sources: string[]
  businessTypes: string[]
  corridors: string[]
}

export function loadSalesSettings(): SalesSettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        owners: parsed.owners || DEFAULT_OWNERS,
        sources: parsed.sources || DEFAULT_SOURCES,
        businessTypes: parsed.businessTypes || DEFAULT_BUSINESS_TYPES,
        corridors: parsed.corridors || DEFAULT_CORRIDORS,
      }
    }
  } catch { /* ignore */ }
  return { owners: DEFAULT_OWNERS, sources: DEFAULT_SOURCES, businessTypes: DEFAULT_BUSINESS_TYPES, corridors: DEFAULT_CORRIDORS }
}

export function saveSalesSettings(data: Partial<SalesSettingsData>) {
  const current = loadSalesSettings()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...data }))
}
