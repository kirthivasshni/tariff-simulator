"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiSelect } from "@/components/multi-select"
import supabase from "@/lib/supabaseClient"
import { API_BASE_URL, getApiUrl } from "@/lib/apiConfig"
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts"

interface CurrencyOption {
  code: string
  name: string
  rate: number
  lastUpdated: string
}

interface CountryComparison {
  country: string
  tariffRate: number
  tariffType: string
  productCost: number
  tariffAmount: number
  totalCost: number
  hasFTA: boolean
  rank: number
}

interface ComparisonChartData {
  countries: string[]
  tariffRates: number[]
  tariffAmounts: number[]
  totalCosts: number[]
  tariffTypes: string[]
}

interface ComparisonData {
  product: string
  exportingFrom: string
  quantity: number
  unit: string
  productCostPerUnit: number
  currency: string
  comparisons: CountryComparison[]
  chartData: ComparisonChartData
}

interface TariffComparisonResult {
  success: boolean
  data?: ComparisonData
  error?: string
}

interface ComparisonFormData {
  product: string
  exportingFrom: string
  importingToCountries: string[]
  quantity: string
  customCost: string
  currency: string
}

const INITIAL_FORM_DATA: ComparisonFormData = {
  product: "",
  exportingFrom: "",
  importingToCountries: [],
  quantity: "1",
  customCost: "",
  currency: "USD",
}

const FALLBACK_CURRENCIES: CurrencyOption[] = [
  { code: "USD", name: "United States Dollar", rate: 1.0, lastUpdated: new Date().toISOString().split("T")[0] },
  { code: "SGD", name: "Singapore Dollar", rate: 1.35, lastUpdated: new Date().toISOString().split("T")[0] },
  { code: "EUR", name: "Euro", rate: 0.93, lastUpdated: new Date().toISOString().split("T")[0] },
  { code: "CNY", name: "Chinese Yuan", rate: 7.12, lastUpdated: new Date().toISOString().split("T")[0] },
]

export function TariffComparisonPanel() {
  const [formData, setFormData] = useState<ComparisonFormData>(INITIAL_FORM_DATA)
  const [products, setProducts] = useState<string[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [currencies, setCurrencies] = useState<CurrencyOption[]>(FALLBACK_CURRENCIES)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TariffComparisonResult | null>(null)

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ""
  }

  const createAuthHeaders = (token: string) => ({
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  })

  const loadProductsAndCountries = async () => {
    try {
      setLoadingOptions(true)
      const token = await getAuthToken()
      const headers = createAuthHeaders(token)
      const [productsResponse, countriesResponse] = await Promise.all([
        fetch(getApiUrl("products"), { headers, credentials: "include" }),
        fetch(getApiUrl("countries"), { headers, credentials: "include" }),
      ])

      const productsData = await productsResponse.json()
      const countriesData = await countriesResponse.json()

      setProducts(Array.isArray(productsData) ? productsData : [])
      setCountries(Array.isArray(countriesData) ? countriesData : [])
    } catch (err) {
      console.error("Failed to load products/countries", err)
      setProducts([])
      setCountries([])
    } finally {
      setLoadingOptions(false)
    }
  }

  const loadCurrencies = async () => {
    try {
      const token = await getAuthToken()
      const response = await fetch(getApiUrl("tariffs/currencies"), {
        headers: createAuthHeaders(token),
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`Failed to load currencies: ${response.status}`)
      }

      const payload = await response.json()
      const currencyList = Array.isArray(payload?.currency) ? (payload.currency as CurrencyOption[]) : []

      if (currencyList.length === 0) {
        throw new Error("Currency list is empty")
      }

      setCurrencies(currencyList)
      setFormData((prev) => ({
        ...prev,
        currency: currencyList.some((c) => c.code === prev.currency) ? prev.currency : currencyList[0].code,
      }))
    } catch (err) {
      console.warn("Falling back to static currency list", err)
      setCurrencies(FALLBACK_CURRENCIES)
      setFormData((prev) => ({
        ...prev,
        currency: prev.currency || FALLBACK_CURRENCIES[0].code,
      }))
    }
  }

  useEffect(() => {
    loadProductsAndCountries()
    loadCurrencies()
  }, [])

  const handleInputChange = (field: keyof ComparisonFormData, value: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    setError(null)
  }

  const validateForm = () => {
    if (!formData.product || !formData.exportingFrom || formData.importingToCountries.length === 0) {
      setError("Please select a product, an exporting country, and at least one importing country.")
      return false
    }

    const quantityValue = Number.parseFloat(formData.quantity)
    if (Number.isNaN(quantityValue) || quantityValue <= 0) {
      setError("Quantity must be greater than 0.")
      return false
    }

    if (formData.customCost) {
      const costValue = Number.parseFloat(formData.customCost)
      if (Number.isNaN(costValue) || costValue <= 0) {
        setError("Custom unit cost must be greater than 0.")
        return false
      }
    }

    return true
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validateForm()) {
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setResult(null)

      const token = await getAuthToken()
      const payload = {
        product: formData.product,
        exportingFrom: formData.exportingFrom,
        importingToCountries: formData.importingToCountries,
        quantity: Number.parseFloat(formData.quantity),
        customCost: formData.customCost ? formData.customCost : undefined,
        currency: formData.currency,
      }

      const response = await fetch(getApiUrl("tariffs/compare"), {
        method: "POST",
        headers: createAuthHeaders(token),
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const body = (await response.json()) as TariffComparisonResult

      if (!response.ok || !body.success) {
        throw new Error(body.error || "Comparison failed. Please try again.")
      }

      if (body.data) {
        body.data.currency = body.data.currency || formData.currency
      }

      setResult(body)
    } catch (err: any) {
      console.error("Comparison error:", err)
      setError(err?.message || "Unable to complete comparison. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const formattedChartData = useMemo(() => {
    if (!result?.data || !Array.isArray(result.data.comparisons)) {
      return []
    }

    return result.data.comparisons.map((item) => ({
      country: item.country,
      productCost: item.productCost,
      tariffAmount: item.tariffAmount,
      totalCost: item.totalCost,
      tariffRate: item.tariffRate,
      tariffType: item.tariffType,
      hasFTA: item.hasFTA,
    }))
  }, [result])

  const currencyCode = result?.data?.currency || formData.currency || "USD"

  const formatCurrency = (value: number) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(value)
    } catch {
      return `${currencyCode} ${value.toFixed(2)}`
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground">Multi-Country Comparison</CardTitle>
        <CardDescription>
          Compare total landed costs for the same product across multiple importing countries. Results include ranked totals and estimated tariff amounts in the selected currency.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Product</label>
              <Select
                disabled={loadingOptions}
                value={formData.product}
                onValueChange={(value) => handleInputChange("product", value)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder={loadingOptions ? "Loading..." : "Select product"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Exporting From</label>
              <Select
                disabled={loadingOptions}
                value={formData.exportingFrom}
                onValueChange={(value) => handleInputChange("exportingFrom", value)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder={loadingOptions ? "Loading..." : "Select country"} />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Importing To (multi-select)</label>
              <MultiSelect
                options={countries.map((country) => ({ label: country, value: country }))}
                selected={formData.importingToCountries}
                onChange={(values) => handleInputChange("importingToCountries", values)}
                placeholder={loadingOptions ? "Loading countries..." : "Select one or more countries"}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(event) => handleInputChange("quantity", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Unit Cost (optional)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.customCost}
                  onChange={(event) => handleInputChange("customCost", event.target.value)}
                  placeholder="Default database cost"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Currency</label>
              <Select
                value={formData.currency}
                onValueChange={(value) => handleInputChange("currency", value)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} &middot; {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 md:col-span-2 flex items-end">
              <div className="text-xs text-muted-foreground">
                Last updated:{" "}
                {currencies.find((c) => c.code === formData.currency)?.lastUpdated ||
                  currencies[0]?.lastUpdated ||
                  "N/A"}
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full md:w-auto" disabled={submitting}>
            {submitting ? "Computing..." : "Compare Countries"}
          </Button>
        </form>

        {result?.data && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Comparison Results
              </h3>
              <p className="text-sm text-muted-foreground">
                Showing total landed cost in {currencyCode} for {result.data.product} exported from {result.data.exportingFrom}.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse">
                <thead className="bg-muted">
                  <tr className="text-left text-sm text-muted-foreground">
                    <th className="py-3 px-4 font-medium">Rank</th>
                    <th className="py-3 px-4 font-medium">Importing Country</th>
                    <th className="py-3 px-4 font-medium">Tariff Type</th>
                    <th className="py-3 px-4 font-medium text-right">Tariff Rate (%)</th>
                    <th className="py-3 px-4 font-medium text-right">Product Cost</th>
                    <th className="py-3 px-4 font-medium text-right">Tariff Amount</th>
                    <th className="py-3 px-4 font-medium text-right">Total Cost</th>
                    <th className="py-3 px-4 font-medium text-center">FTA?</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {result.data.comparisons.map((comparison) => (
                    <tr key={comparison.country} className="border-t border-border hover:bg-muted/40">
                      <td className="py-3 px-4 font-semibold text-foreground">{comparison.rank}</td>
                      <td className="py-3 px-4 text-foreground">{comparison.country}</td>
                      <td className="py-3 px-4 text-muted-foreground">{comparison.tariffType}</td>
                      <td className="py-3 px-4 text-right">{comparison.tariffRate.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(comparison.productCost)}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(comparison.tariffAmount)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-foreground">
                        {formatCurrency(comparison.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {comparison.hasFTA ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {formattedChartData.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-md font-semibold text-foreground">Cost Breakdown</h4>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={formattedChartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="country" />
                    <YAxis tickFormatter={(value) => formatCurrency(value as number)} />
                    <Tooltip
                      formatter={(value: number, key: string) => {
                        if (key === "tariffRate") {
                          return [`${(value as number).toFixed(2)} %`, "Tariff Rate"]
                        }
                        return [formatCurrency(value as number), key === "productCost" ? "Product Cost" : "Tariff Amount"]
                      }}
                    />
                    <Legend />
                    <Bar dataKey="productCost" stackId="a" name="Product Cost" fill="#2563eb" />
                    <Bar dataKey="tariffAmount" stackId="a" name="Tariff Amount" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

