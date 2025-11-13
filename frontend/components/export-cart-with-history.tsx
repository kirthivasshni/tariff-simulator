"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, Trash2, ShoppingCart, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getApiUrl } from "@/lib/apiConfig"

interface CartItem {
  id: string
  productName: string
  exportingFrom: string
  importingTo: string
  quantity: number
  unit: string
  productCost: number
  totalCost: number
  tariffType: string
  source?: string  // "global" or "simulator"
  calculationDate: string
  currency?: string
  breakdown?: Array<{
    description: string
    type: string
    rate: string
    amount: number
  }>
}

interface ExportCartWithHistoryProps {
  onCartCountChange?: () => void
}

export function ExportCartWithHistory({ onCartCountChange }: ExportCartWithHistoryProps = {}) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [historyItems, setHistoryItems] = useState<CartItem[]>([])
  const [selectedCartItems, setSelectedCartItems] = useState<Set<string>>(new Set())
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<Set<string>>(new Set())
  const [isLoadingCart, setIsLoadingCart] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)

  useEffect(() => {
    loadCartItems()
    loadHistory()
  }, [])

  const loadCartItems = async () => {
    try {
      setIsLoadingCart(true)
      const supabase = (await import("@/lib/supabaseClient")).default
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const response = await fetch(getApiUrl('export-cart'), {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (response.status === 204) {
        setCartItems([])
        return
      }

      if (!response.ok) {
        throw new Error("Failed to load export cart")
      }

      const result = await response.json()
      setCartItems(result || [])
    } catch (err) {
      console.error("Error loading cart:", err)
      setError("Failed to load export cart")
    } finally {
      setIsLoadingCart(false)
    }
  }

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true)
      const supabase = (await import("@/lib/supabaseClient")).default
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const response = await fetch(getApiUrl('tariff/history'), {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (response.status === 204) {
        setHistoryItems([])
        return
      }

      if (!response.ok) {
        throw new Error("Failed to load history")
      }

      const result = await response.json()
      
      // Filter out items that are already in cart
      const cartIds = new Set(cartItems.map(item => item.id))
      const filteredHistory = (result || []).filter((item: CartItem) => !cartIds.has(item.id))
      setHistoryItems(filteredHistory)
    } catch (err) {
      console.error("Error loading history:", err)
      // Don't show error if history is just empty
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleSelectCartItem = (id: string) => {
    const newSelected = new Set(selectedCartItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedCartItems(newSelected)
  }

  const handleSelectAllCart = () => {
    if (selectedCartItems.size === cartItems.length) {
      setSelectedCartItems(new Set())
    } else {
      setSelectedCartItems(new Set(cartItems.map(item => item.id)))
    }
  }

  const handleSelectHistoryItem = (id: string) => {
    const newSelected = new Set(selectedHistoryItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedHistoryItems(newSelected)
  }

  const handleSelectAllHistory = () => {
    if (selectedHistoryItems.size === historyItems.length) {
      setSelectedHistoryItems(new Set())
    } else {
      setSelectedHistoryItems(new Set(historyItems.map(item => item.id)))
    }
  }

  const formatCurrency = (value: number, currencyCode?: string) => {
    const code = currencyCode || "USD"
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(value)
    } catch {
      return `${code} ${value.toFixed(2)}`
    }
  }

  const handleDeleteFromCart = async () => {
    if (selectedCartItems.size === 0) {
      setError("Please select at least one item to delete")
      setTimeout(() => setError(""), 3000)
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedCartItems.size} selected item${selectedCartItems.size !== 1 ? 's' : ''}?`)) {
      return
    }

    try {
      setError("")
      let successCount = 0
      const supabase = (await import("@/lib/supabaseClient")).default
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      for (const id of selectedCartItems) {
        try {
          const response = await fetch(getApiUrl(`export-cart/remove/${id}`), {
            method: 'DELETE',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          })

          if (response.ok) {
            successCount++
          }
        } catch (err) {
          console.error(`Error deleting ${id}:`, err)
        }
      }

      if (successCount > 0) {
        setSuccessMessage(`Successfully deleted ${successCount} item${successCount !== 1 ? 's' : ''}`)
        setTimeout(() => setSuccessMessage(""), 3000)
        setSelectedCartItems(new Set())
        await loadCartItems()
        await loadHistory() // Refresh to show items back in history
        // Notify parent to update cart count
        if (onCartCountChange) {
          onCartCountChange()
        }
      }
    } catch (err) {
      console.error("Error deleting items:", err)
      setError("Failed to delete items")
    }
  }

  const handleClearCart = async () => {
    if (!confirm("Are you sure you want to clear all items from the cart?")) {
      return
    }

    try {
      setError("")
      const supabase = (await import("@/lib/supabaseClient")).default
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const response = await fetch(getApiUrl('export-cart/clear'), {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error("Failed to clear cart")
      }

      setSuccessMessage("Export cart cleared successfully")
      setTimeout(() => setSuccessMessage(""), 3000)
      setSelectedCartItems(new Set())
      await loadCartItems()
      await loadHistory()
      // Notify parent to update cart count
      if (onCartCountChange) {
        onCartCountChange()
      }
    } catch (err) {
      console.error("Error clearing cart:", err)
      setError("Failed to clear cart")
    }
  }

  const handleAddToCart = async () => {
    if (selectedHistoryItems.size === 0) {
      setError("Please select at least one calculation to add to cart")
      setTimeout(() => setError(""), 3000)
      return
    }

    try {
      setError("")
      let successCount = 0
      const supabase = (await import("@/lib/supabaseClient")).default
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      for (const id of selectedHistoryItems) {
        try {
          const response = await fetch(getApiUrl(`export-cart/add/${id}`), {
            method: 'POST',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          })

          if (response.ok) {
            successCount++
          }
        } catch (err) {
          console.error(`Error adding ${id} to cart:`, err)
        }
      }

      if (successCount > 0) {
        setSuccessMessage(`Successfully added ${successCount} item${successCount !== 1 ? 's' : ''} to cart`)
        setTimeout(() => setSuccessMessage(""), 3000)
        setSelectedHistoryItems(new Set())
        await loadCartItems()
        await loadHistory()
        // Notify parent to update cart count
        if (onCartCountChange) {
          onCartCountChange()
        }
      }
    } catch (err) {
      console.error("Error adding to cart:", err)
      setError("Failed to add items to cart")
    }
  }

  const handleDownloadCart = async () => {
    try {
      setError("")
      setShowDownloadDialog(false)

      if (cartItems.length === 0) {
        setError("Export cart is empty")
        return
      }

      const supabase = (await import("@/lib/supabaseClient")).default
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(getApiUrl('export-cart/export'), {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error("Failed to download CSV")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `tariff-calculations-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setSuccessMessage("Successfully downloaded cart as CSV")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err) {
      console.error("Error downloading CSV:", err)
      setError("Failed to download CSV")
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Export Cart Section - Takes 2/3 width */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">Export Cart</CardTitle>
                  <CardDescription>
                    Items ready for export ({cartItems.length})
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCart ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading cart...</p>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Your export cart is empty</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Add calculations from session history or the calculator
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground w-12">
                            <Checkbox
                              checked={selectedCartItems.size === cartItems.length && cartItems.length > 0}
                              onCheckedChange={handleSelectAllCart}
                            />
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Product</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Route</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Quantity</th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Cost</th>
                        </tr>
                      </thead>
                        <tbody>
                          {cartItems.map((item) => (
                            <tr key={item.id} className="border-b border-border hover:bg-muted/50">
                              <td className="py-3 px-4">
                                <Checkbox
                                  checked={selectedCartItems.has(item.id)}
                                  onCheckedChange={() => handleSelectCartItem(item.id)}
                                />
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-col gap-1.5">
                                  <div className="font-medium text-foreground">
                                    {item.productName}
                                  </div>
                                  {item.source && (
                                    <Badge 
                                      variant="secondary"
                                      className="text-xs h-6 px-2.5 font-medium w-fit capitalize"
                                    >
                                      {item.source}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                            <td className="py-3 px-4 text-muted-foreground text-sm">
                              {item.exportingFrom} → {item.importingTo}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-sm">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-foreground">
                              {formatCurrency(item.totalCost, item.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-border">
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDeleteFromCart}
                        disabled={selectedCartItems.size === 0}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete ({selectedCartItems.size})
                      </Button>
                      <Button
                        onClick={handleClearCart}
                        variant="outline"
                        size="sm"
                      >
                        Clear All
                      </Button>
                    </div>
                    <Button
                      onClick={() => cartItems.length > 0 && handleDownloadCart()}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                      size="sm"
                      disabled={cartItems.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download CSV
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Session History Sidebar - Takes 1/3 width */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-foreground">Session History</CardTitle>
                  <CardDescription className="text-xs">
                    Calculations not yet in cart
                  </CardDescription>
                </div>
                <Button
                  onClick={loadHistory}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : historyItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No history items</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Make calculations to see them here
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {historyItems.map((item) => (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-3 transition-colors ${
                          selectedHistoryItems.has(item.id)
                            ? 'bg-accent/10 border-accent'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => handleSelectHistoryItem(item.id)}
                          >
                            <div className="font-medium text-sm text-foreground truncate">
                              {item.productName}
                            </div>
                            {item.source && (
                              <Badge 
                                variant="secondary"
                                className="text-[10px] h-5 px-2 font-medium w-fit mt-1 capitalize"
                              >
                                {item.source}
                              </Badge>
                            )}
                            <div className="text-xs text-muted-foreground mt-1.5">
                              {item.exportingFrom} → {item.importingTo}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>
                              <span className="text-sm font-medium text-foreground">
                                {formatCurrency(item.totalCost, item.currency)}
                              </span>
                            </div>
                          </div>
                          <Checkbox
                            checked={selectedHistoryItems.has(item.id)}
                            onCheckedChange={() => handleSelectHistoryItem(item.id)}
                            className="ml-2 flex-shrink-0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <Button
                      onClick={handleAddToCart}
                      disabled={selectedHistoryItems.size === 0}
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                      size="sm"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add to Cart ({selectedHistoryItems.size})
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

