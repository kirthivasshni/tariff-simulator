"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { MultiSelect } from "@/components/multi-select"
import { DateRangePicker } from "@/components/date-range-picker"
import supabase from "@/lib/supabaseClient"
import type { FilterSelection } from "@/components/tariff-trends-visualization"

interface TariffFiltersProps {
  filters: FilterSelection
  onFilterChange: (filters: FilterSelection) => void
  maxLines: number
  currentLines: number
}

const API_BASE_URL = "http://localhost:8080/api"

export function TariffFilters({ filters, onFilterChange, maxLines, currentLines }: TariffFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FilterSelection>(filters)
  const [exportCountries, setExportCountries] = useState<string[]>([])
  const [importCountries, setImportCountries] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const getAuthToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ""
  }

  const createAuthHeaders = (token: string): Record<string, string> => ({
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  })

  const fetchCountries = async (): Promise<string[]> => {
    try {
      const token = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}/countries`, {
        headers: createAuthHeaders(token),
        credentials: 'include'
      })
      
      if (!response.ok) {
        console.error(`Countries endpoint failed: ${response.status}`)
        return []
      }
      
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error("Error fetching countries:", error)
      return []
    }
  }

  const fetchProducts = async (): Promise<string[]> => {
    try {
      const token = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: createAuthHeaders(token),
        credentials: 'include'
      })
      
      if (!response.ok) {
        console.error(`Products endpoint failed: ${response.status}`)
        return []
      }
      
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error("Error fetching products:", error)
      return []
    }
  }

  const loadFilterOptions = async () => {
    try {
      setIsLoading(true)
      const [countriesData, productsData] = await Promise.all([
        fetchCountries(),
        fetchProducts()
      ])

      setExportCountries(countriesData)
      setImportCountries(countriesData)
      setProducts(productsData)
    } catch (error) {
      console.error("Error loading filter options:", error)
      setExportCountries([])
      setImportCountries([])
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadFilterOptions()
  }, [])

  const handleApplyFilters = () => {
    onFilterChange(localFilters)
  }

  const handleReset = () => {
    const resetFilters: FilterSelection = {
      exportCountries: [],
      importCountries: [],
      products: [],
      dateRange: {
        start: "2020-01-01",
        end: "2024-12-31",
      },
    }
    setLocalFilters(resetFilters)
    onFilterChange(resetFilters)
  }

  const localLines =
    localFilters.importCountries.length * localFilters.exportCountries.length * localFilters.products.length

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center text-muted-foreground py-8">
          Loading filter options...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="import-countries" className="text-sm font-medium block">
            Import Countries <span className="text-destructive">*</span>
          </Label>
          <div className="w-full">
            <MultiSelect
              options={importCountries.map((c) => ({ label: c, value: c }))}
              selected={localFilters.importCountries}
              onChange={(values) => setLocalFilters({ ...localFilters, importCountries: values })}
              placeholder="Select import countries"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 break-words">Countries importing the goods</p>
        </div>

        <div className="space-y-2 min-w-0">
          <Label htmlFor="export-countries" className="text-sm font-medium block">
            Export Countries <span className="text-destructive">*</span>
          </Label>
          <div className="w-full">
            <MultiSelect
              options={exportCountries.map((c) => ({ label: c, value: c }))}
              selected={localFilters.exportCountries}
              onChange={(values) => setLocalFilters({ ...localFilters, exportCountries: values })}
              placeholder="Select export countries"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 break-words">Countries exporting the goods</p>
        </div>

        <div className="space-y-2 min-w-0">
          <Label htmlFor="products" className="text-sm font-medium block">
            Products <span className="text-destructive">*</span>
          </Label>
          <div className="w-full">
            <MultiSelect
              options={products.map((p) => ({ label: p, value: p }))}
              selected={localFilters.products}
              onChange={(values) => setLocalFilters({ ...localFilters, products: values })}
              placeholder="Select products"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 break-words">Product categories to compare</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium block">Date Range</Label>
        <DateRangePicker
          dateRange={localFilters.dateRange}
          onChange={(range) => setLocalFilters({ ...localFilters, dateRange: range })}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap pt-2">
        <Button onClick={handleApplyFilters} size="default">Apply Filters</Button>
        <Button variant="outline" onClick={handleReset} size="default">
          Reset
        </Button>
        <span className={`text-sm ml-2 ${localLines > maxLines ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {localLines} {localLines === 1 ? "line" : "lines"} will be displayed (max {maxLines})
        </span>
      </div>
    </div>
  )
}