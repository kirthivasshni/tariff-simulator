import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart } from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getApiUrl } from "@/lib/apiConfig"

interface ResultsTableProps {
  results: any
  onAddToCart: (calculation: any) => boolean | Promise<boolean>
}

const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_NOT_FOUND = 404
const SUCCESS_MESSAGE_DURATION = 3000

export function ResultsTable({ results, onAddToCart }: ResultsTableProps) {
  const [exportError, setExportError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [debugInfo, setDebugInfo] = useState("")

  const clearMessages = () => {
    setExportError("")
    setSuccessMessage("")
    setDebugInfo("")
  }

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(""), SUCCESS_MESSAGE_DURATION)
  }

  const extractCalculationData = () => {
    return results?.data || results
  }

  const getCalculationId = () => {
    const data = extractCalculationData()
    return data?.calculationId
  }

  const getAuthToken = async (): Promise<string> => {
    const supabase = (await import("@/lib/supabaseClient")).default
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ""
  }

  const createAuthHeaders = (token: string): Record<string, string> => {
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    }
  }

  const parseErrorResponse = async (response: Response): Promise<string> => {
    const responseText = await response.text()
    let errorMessage = `Server returned ${response.status}`
    
    try {
      const errorData = JSON.parse(responseText)
      errorMessage = errorData.message || errorData.error || errorMessage
    } catch {
      errorMessage = responseText || errorMessage
    }
    
    return errorMessage
  }

  const handleBadRequestError = (errorMessage: string) => {
    if (errorMessage.includes("already in cart")) {
      setExportError("This calculation is already in your export cart")
    } else {
      setExportError(`Failed to add to cart: ${errorMessage}`)
    }
  }

  const handleNotFoundError = () => {
    setExportError("Calculation not found in history. Please calculate again.")
  }

  const handleApiError = async (response: Response) => {
    const errorMessage = await parseErrorResponse(response)
    
    if (response.status === HTTP_STATUS_BAD_REQUEST) {
      handleBadRequestError(errorMessage)
    } else if (response.status === HTTP_STATUS_NOT_FOUND) {
      handleNotFoundError()
    } else {
      setExportError(`Failed to add to cart: ${errorMessage}`)
    }
  }

  const validateCalculationData = (): boolean => {
    if (!results) {
      setExportError("No calculation data available")
      return false
    }

    const calculationId = getCalculationId()
    if (!calculationId) {
      setExportError("Calculation ID not found. Please calculate again.")
      return false
    }

    return true
  }

  const addToCartApi = async (calculationId: string, token: string): Promise<Response> => {
    return await fetch(getApiUrl(`export-cart/add/${encodeURIComponent(calculationId)}`), {
      method: 'POST',
      headers: createAuthHeaders(token),
      credentials: 'include'
    })
  }

  const handleAddingExport = async () => {
    try {
      clearMessages()

      if (!validateCalculationData()) {
        return
      }

      const calculationId = getCalculationId()
      if (!calculationId) {
        setExportError("Calculation ID not found. Please calculate again.")
        return
      }
      const token = await getAuthToken()
      const response = await addToCartApi(calculationId, token)

      if (!response.ok) {
        await handleApiError(response)
        return
      }

      showSuccessMessage("Calculation added to export cart successfully!")
      await onAddToCart(results)

    } catch (error: any) {
      console.error("Error adding to cart:", error)
      setExportError(`Failed to add to cart: ${error.message}`)
    }
  }

  const data = extractCalculationData()
  
  if (!data || !data.breakdown) {
    return null
  }

  const getRouteDisplayText = (): string => {
    return `${data.exportingFrom} → ${data.importingTo}`
  }

  const getQuantityDisplayText = (): string => {
    return `${data.quantity} x ${data.unit}`
  }

  const currencyCode = data?.currency || "USD"

  const formatCurrency = (value: number): string => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
      }).format(value)
    } catch (err) {
      return `${currencyCode} ${value.toFixed(2)}`
    }
  }

  const getProductCostDisplayText = (): string => {
    return `Total Product Cost: ${formatCurrency(data.productCost)}`
  }

  const getTotalCostDisplayText = (): string => {
    return formatCurrency(data.totalCost)
  }

  const getBadgeClassName = (type: string): string => {
    const typeNormalized = type?.toLowerCase()
    
    if (typeNormalized === "tariff") {
      return "bg-accent text-accent-foreground"
    }
    if (typeNormalized === "ahs") {
      return "bg-primary text-primary-foreground"
    }
    return ""
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl font-semibold text-foreground">Calculation Results</CardTitle>
          <CardDescription>Detailed breakdown of import costs and tariffs</CardDescription>
        </div>
        <Button
          onClick={handleAddingExport}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 bg-transparent"
        >
          <ShoppingCart className="h-4 w-4" />
          Add To Export Cart
        </Button>
      </CardHeader>
      <CardContent>
        {exportError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{exportError}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mb-4">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {debugInfo && (
          <Alert className="mb-4 bg-yellow-50 border-yellow-200">
            <AlertDescription>
              <details>
                <summary className="cursor-pointer font-semibold">Debug Information</summary>
                <pre className="mt-2 text-xs overflow-auto max-h-40">{debugInfo}</pre>
              </details>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold text-foreground mb-2">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Product</p>
                <p className="font-medium">{data.product}</p>
                <p className="text-xs text-muted-foreground">Currency: {currencyCode}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Route</p>
                <p className="font-medium">{getRouteDisplayText()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Quantity</p>
                <p className="font-medium">{getQuantityDisplayText()}</p>
                <p className="text-xs text-muted-foreground">{getProductCostDisplayText()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Cost</p>
                <p className="font-bold text-foreground">{getTotalCostDisplayText()}</p>
                <p className="text-xs text-muted-foreground">{data.tariffType}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Description</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Type</th>
                  <th className="text-right py-3 px-4 font-semibold text-foreground">Rate</th>
                  <th className="text-right py-3 px-4 font-semibold text-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.map((item: any, index: number) => (
                  <tr key={index} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-foreground">{item.description}</td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className={getBadgeClassName(item.type)}>
                        {item.type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">{item.rate}</td>
                  <td className="py-3 px-4 text-right font-medium text-foreground">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-muted/50">
                  <td className="py-3 px-4 font-bold text-foreground" colSpan={3}>
                    Total Cost
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-foreground">{getTotalCostDisplayText()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}