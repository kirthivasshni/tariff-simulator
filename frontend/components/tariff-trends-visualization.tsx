"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TariffFilters } from "@/components/tariff-filters"
import { TariffChart } from "@/components/tariff-chart"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import supabase from "@/lib/supabaseClient"
import { getApiUrl } from "@/lib/apiConfig"

export interface TariffDataPoint {
  date: string
  tariffRate: number
}

export interface TariffSeries {
  id: string
  importCountry: string
  exportCountry: string
  product: string
  data: TariffDataPoint[]
  color: string
}

export interface FilterSelection {
  exportCountries: string[]
  importCountries: string[]
  products: string[]
  dateRange: {
    start: string
    end: string
  }
}

const MAX_LINES = 10

export function TariffTrendsVisualization() {
  const [filters, setFilters] = useState<FilterSelection>({
    exportCountries: [],
    importCountries: [],
    products: [],
    dateRange: {
      start: "2020-01-01",
      end: "2024-12-31",
    },
  })

  const [chartData, setChartData] = useState<TariffSeries[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getAuthToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ""
  }

  const createAuthHeaders = (token: string): Record<string, string> => ({
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  })

  const handleFilterChange = async (newFilters: FilterSelection) => {
    setFilters(newFilters)
    setError(null)

    if (newFilters.importCountries.length === 0 || newFilters.exportCountries.length === 0 || newFilters.products.length === 0) {
      setError("Please fill in all the boxes")
      setChartData([])
      return
    }

    const totalLines =
      newFilters.importCountries.length * newFilters.exportCountries.length * newFilters.products.length

    if (totalLines > MAX_LINES) {
      setError(
        `Too many combinations (${totalLines} lines). Please reduce selections to create ${MAX_LINES} or fewer lines for optimal readability.`,
      )
      setChartData([])
      return
    }

    // Fetch data from backend
    setLoading(true)
    try {
      const data = await fetchTariffTrendsData(newFilters)
      setChartData(data)
    } catch (err) {
      setError("Unable to load tariff data. Please try again later.")
      console.error("Error fetching tariff trends data:", err)
      setChartData([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTariffTrendsData = async (filters: FilterSelection): Promise<TariffSeries[]> => {
    const token = await getAuthToken()
    
    const params = new URLSearchParams({
      startDate: filters.dateRange.start,
      endDate: filters.dateRange.end,
      importCountries: filters.importCountries.join(','),
      exportCountries: filters.exportCountries.join(','),
      products: filters.products.join(',')
    })

    const response = await fetch(`${getApiUrl("tariff-trends")}?${params}`, {
      method: 'GET',
      headers: createAuthHeaders(token),
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch tariff trends: ${response.status}`)
    }

    const result = await response.json()
    
    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to load tariff trends")
    }

    return formatTariffSeriesData(result.data)
  }

  const formatTariffSeriesData = (data: any[]): TariffSeries[] => {
    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#ec4899",
      "#14b8a6",
      "#f97316",
      "#06b6d4",
      "#84cc16",
    ]

    return data.map((series, index) => ({
      id: `${series.importCountry}-${series.exportCountry}-${series.product}`,
      importCountry: series.importCountry,
      exportCountry: series.exportCountry,
      product: series.product,
      data: series.dataPoints.map((point: any) => ({
        date: point.date,
        tariffRate: point.rate
      })),
      color: colors[index % colors.length]
    }))
  }

  const totalCombinations = filters.importCountries.length * filters.exportCountries.length * filters.products.length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Select import countries, export countries, and products to view tariff trends. Each combination creates one
            line on the chart.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TariffFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            maxLines={MAX_LINES}
            currentLines={totalCombinations}
          />
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tariff Trends Over Time</CardTitle>
          <CardDescription>
            Each line shows the tariff rate for a specific import-export-product combination
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TariffChart data={chartData} loading={loading} dateRange={filters.dateRange} />
        </CardContent>
      </Card>
    </div>
  )
}