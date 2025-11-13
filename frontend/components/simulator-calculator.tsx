"use client"
import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ResultsTable } from "@/components/results-table"
import supabase from "@/lib/supabaseClient"
import { getApiUrl } from "@/lib/apiConfig"

interface SimulatorCalculatorProps {
  onCartCountChange?: () => void
}

export function SimulatorCalculator({ onCartCountChange }: SimulatorCalculatorProps = {}) {
  const [formData, setFormData] = useState({
    product: "",
    unit: "",
    exportingFrom: "",
    importingTo: "",
    tariffType: "percentage",
    tariffRate: "",
    quantity: "1",
    customCost: "",
    calculationDate: new Date().toISOString().split("T")[0],
  })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [calculationResult, setCalculationResult] = useState<any>(null)

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    // Validate required fields
    if (
      !formData.product ||
      !formData.unit ||
      !formData.exportingFrom ||
      !formData.importingTo ||
      !formData.tariffRate ||
      !formData.quantity ||
      !formData.customCost
    ) {
      setError("Please fill in all required fields")
      setIsLoading(false)
      return
    }

    if (Number.parseFloat(formData.quantity) <= 0) {
      setError("Quantity must be greater than 0")
      setIsLoading(false)
      return
    }

    if (Number.parseFloat(formData.customCost) <= 0) {
      setError("Unit cost must be greater than 0")
      setIsLoading(false)
      return
    }

    if (Number.parseFloat(formData.tariffRate) < 0) {
      setError("Tariff rate cannot be negative")
      setIsLoading(false)
      return
    }

    try {
      // Calculate locally based on the input
      const quantity = Number.parseFloat(formData.quantity)
      const unitCost = Number.parseFloat(formData.customCost)
      const tariffRate = Number.parseFloat(formData.tariffRate)
      const productCost = unitCost * quantity

      let tariffCost = 0
      if (formData.tariffType === "percentage") {
        tariffCost = (productCost * tariffRate) / 100
      } else if (formData.tariffType === "fixed") {
        tariffCost = tariffRate * quantity
      }

      const totalCost = productCost + tariffCost
      const unitLabel = formData.unit

      // Create breakdown array matching the ResultsTable format
      const breakdown = [
        {
          description: `${formData.product}`,
          type: "Product Cost",
          rate: `$${unitCost.toFixed(2)}/${unitLabel || "unit"}`,
          amount: productCost
        },
        {
          description: `Tariff from ${formData.exportingFrom} to ${formData.importingTo}`,
          type: "Tariff",
          rate: formData.tariffType === "percentage" ? `${tariffRate}%` : `$${tariffRate}/${unitLabel || "unit"}`,
          amount: tariffCost
        }
      ]

      const result = {
        product: formData.product,
        exportingFrom: formData.exportingFrom,
        importingTo: formData.importingTo,
        quantity: quantity,
        unit: unitLabel,
        costPerUnit: unitCost,
        productCost: productCost,
        tariffType: formData.tariffType === "percentage" ? `${tariffRate}% Tariff` : `$${tariffRate} Fixed Tariff`,
        tariffRate: tariffRate,
        tariffCost: tariffCost,
        totalCost: totalCost,
        calculationDate: formData.calculationDate,
        breakdown: breakdown,
        mode: "simulator",
        currency: "USD",
      }

      // Save to history and get the backend-generated ID
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        // Prepare data in the format backend expects
        const calculationData = {
          calculationData: {
            success: true,
            data: {
              product: result.product,
              exportingFrom: result.exportingFrom,
              importingTo: result.importingTo,
              quantity: result.quantity,
              unit: result.unit,
              productCost: result.productCost,
              costPerUnit: result.costPerUnit,
              totalCost: result.totalCost,
              tariffRate: result.tariffRate,
              tariffType: result.tariffType,
              breakdown: result.breakdown,
              source: "simulator",  // Mark this calculation as from simulator
              currency: result.currency,
            }
          }
        }

        const historyResponse = await fetch(getApiUrl('tariff/history/save'), {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(calculationData)
        })

        if (historyResponse.ok) {
          const savedCalculation = await historyResponse.json()
          console.log("✅ Saved to history successfully:", savedCalculation)
          // The backend returns the saved calculation with an ID
          result.calculationId = savedCalculation.id || savedCalculation.calculationId
        } else {
          const errorText = await historyResponse.text()
          console.error("❌ Failed to save to history:", historyResponse.status, errorText)
          // Fetch the latest history to try to get the ID
          const getHistoryResponse = await fetch(getApiUrl('tariff/history'), {
            method: 'GET',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          })

          if (getHistoryResponse.ok) {
            const historyData = await getHistoryResponse.json()
            if (Array.isArray(historyData) && historyData.length > 0) {
              // Get the most recent calculation (first in array)
              const latestCalculation = historyData[0]
              result.calculationId = latestCalculation.id || latestCalculation.calculationId
            }
          }
        }
      } catch (err) {
        console.error("Could not save to history:", err)
        // If saving to history fails, create a local ID as fallback
        result.calculationId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      // Ensure we have a calculationId before setting result
      if (!result.calculationId) {
        result.calculationId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      console.log("📊 Final calculation with ID:", result.calculationId)
      setCalculationResult(result)
    } catch (err) {
      console.error("Calculation error:", err)
      setError("An unexpected error occurred during calculation")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToCart = async (calculation: any) => {
    // Placeholder callback for ResultsTable - returns true on success
    return true
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center space-x-2">
            <div className="h-3 w-3 bg-purple-500 rounded-full animate-pulse"></div>
            <span>Simulator Calculator</span>
          </CardTitle>
          <CardDescription>
            Enter custom tariff parameters and calculate import costs in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Product *</label>
                <Input
                  type="text"
                  value={formData.product}
                  onChange={(e) => handleInputChange("product", e.target.value)}
                  placeholder="e.g., Oranges, Rice, Electronics"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Unit *</label>
                <Input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => handleInputChange("unit", e.target.value)}
                  placeholder="e.g., kg, lbs, units"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Exporting From *</label>
                <Input
                  type="text"
                  value={formData.exportingFrom}
                  onChange={(e) => handleInputChange("exportingFrom", e.target.value)}
                  placeholder="e.g., Thailand, Vietnam"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Importing To *</label>
                <Input
                  type="text"
                  value={formData.importingTo}
                  onChange={(e) => handleInputChange("importingTo", e.target.value)}
                  placeholder="e.g., Philippines, Singapore"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Tariff Type *</label>
                <Select value={formData.tariffType} onValueChange={(value) => handleInputChange("tariffType", value)}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed per Unit ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Tariff Rate * {formData.tariffType === "percentage" ? "(%)" : "($ per unit)"}
                </label>
                <Input
                  type="number"
                  value={formData.tariffRate}
                  onChange={(e) => handleInputChange("tariffRate", e.target.value)}
                  placeholder={formData.tariffType === "percentage" ? "e.g., 15" : "e.g., 0.50"}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Quantity * {formData.unit ? `(${formData.unit})` : ""}
                </label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange("quantity", e.target.value)}
                  placeholder="1"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Unit Cost (USD) *</label>
                <Input
                  type="number"
                  value={formData.customCost}
                  onChange={(e) => handleInputChange("customCost", e.target.value)}
                  placeholder="e.g., 2.50"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Calculation Date</label>
                <Input
                  type="date"
                  value={formData.calculationDate}
                  onChange={(e) => handleInputChange("calculationDate", e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? "Calculating..." : "Calculate Import Cost"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {calculationResult && (
        <ResultsTable results={calculationResult} onAddToCart={handleAddToCart} />
      )}
    </div>
  )
}
