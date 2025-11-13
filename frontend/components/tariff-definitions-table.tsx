"use client"

import { useState, useEffect } from "react"
import supabase from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Download, Plus, Trash2, Pencil } from "lucide-react"

interface TariffDefinition {
  id: string
  product: string
  exportingFrom: string
  importingTo: string
  type: string
  rate: number
  effectiveDate: string
  expirationDate: string
}

interface TariffDefinitionsResponse {
  success: boolean
  data?: TariffDefinition[]
  error?: string
}

interface TariffDefinitionsTableProps {
  userRole: "admin" | "general"
  simulatorMode?: boolean
}

interface Filters {
  product: string
  exportingFrom: string
  importingTo: string
}

interface NewTariff {
  product: string
  exportingFrom: string
  importingTo: string
  type: string
  rate: string
  effectiveDate: string
  expirationDate: string
}

const API_BASE_URL = "http://localhost:8080/api"
const TARIFF_TYPE_AHS = "AHS"
const TARIFF_TYPE_MFN = "MFN"
const FILTER_ALL_VALUE = "all"
const MINIMUM_RATE = 0
const USER_ID_PREFIX = "user"
const ADMIN_MODIFIED_PREFIX = "admin-modified"

const createInitialFilters = (): Filters => ({
  product: "",
  exportingFrom: "",
  importingTo: "",
})

const createInitialNewTariff = (): NewTariff => ({
  product: "",
  exportingFrom: "",
  importingTo: "",
  type: "",
  rate: "",
  effectiveDate: "",
  expirationDate: "",
})

export function TariffDefinitionsTable({ userRole, simulatorMode = false }: TariffDefinitionsTableProps) {
  const [globalTariffs, setGlobalTariffs] = useState<TariffDefinition[]>([])
  const [modifiedGlobalTariffs, setModifiedGlobalTariffs] = useState<TariffDefinition[]>([])
  const [userTariffs, setUserTariffs] = useState<TariffDefinition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingTariff, setEditingTariff] = useState<TariffDefinition | null>(null)
  const [alertDialog, setAlertDialog] = useState({ open: false, title: "", message: "" })
  const [filters, setFilters] = useState<Filters>(createInitialFilters())
  const [newTariff, setNewTariff] = useState<NewTariff>(createInitialNewTariff())
  const [countries, setCountries] = useState<string[]>([])
  const [products, setProducts] = useState<string[]>([])

  const isAdminRole = (): boolean => {
    return userRole === "admin"
  }

  const getAuthToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ""
  }

  const createAuthHeaders = (token: string): Record<string, string> => ({
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  })

  const fetchDataWithAuth = async (endpoint: string): Promise<Response> => {
    const token = await getAuthToken()
    return fetch(`${API_BASE_URL}${endpoint}`, {
      headers: createAuthHeaders(token),
      credentials: 'include'
    })
  }

  const showAlert = (title: string, message: string) => {
    setAlertDialog({ open: true, title, message })
  }

  const closeAlert = () => {
    setAlertDialog({ ...alertDialog, open: false })
  }

  const handleEditTariff = (tariff: TariffDefinition) => {
    setEditingTariff(tariff)
    setNewTariff({
      product: tariff.product,
      exportingFrom: tariff.exportingFrom,
      importingTo: tariff.importingTo,
      type: tariff.type,
      rate: tariff.rate.toString(),
      effectiveDate: tariff.effectiveDate,
      expirationDate: tariff.expirationDate,
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateTariff = async () => {
    if (!editingTariff) {
      return
    }

    if (!validateTariffInput()) {
      return
    }

    const payload = {
      product: newTariff.product,
      exportingFrom: newTariff.exportingFrom,
      importingTo: newTariff.importingTo,
      type: newTariff.type,
      rate: Number.parseFloat(newTariff.rate),
      effectiveDate: newTariff.effectiveDate,
      expirationDate: newTariff.expirationDate,
    }

    try {
      const token = await getAuthToken()
      const isUserTariff = simulatorMode || editingTariff.id.startsWith(USER_ID_PREFIX)
      const endpoint = isUserTariff
        ? `${API_BASE_URL}/tariff-definitions/user/${editingTariff.id}`
        : `${API_BASE_URL}/tariff-definitions/modified/${editingTariff.id}`

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: createAuthHeaders(token),
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Update failed ${res.status}: ${errorText}`)
      }

      if (isUserTariff) {
        await reloadUserTariffs()
        showAlert("Success", "Tariff has been successfully updated.")
      } else {
        await reloadModifiedTariffs()
        showAlert("Success", "Tariff has been successfully updated.")
      }

      setEditingTariff(null)
      setNewTariff(createInitialNewTariff())
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error("Failed to update tariff", error)
      showAlert("Error", "Failed to update tariff. Please try again.")
    }
  }

  const loadGlobalTariffs = async () => {
    const globalRes = await fetchDataWithAuth("/tariff-definitions/global")
    if (!globalRes.ok) throw new Error(`Global defs failed ${globalRes.status}`)
    const globalData: TariffDefinitionsResponse = await globalRes.json()
    
    if (globalData.success && globalData.data) {
      setGlobalTariffs(globalData.data)
    }
  }

  const loadModifiedGlobalTariffs = async () => {
    if (!isAdminRole()) return

    const modifiedRes = await fetchDataWithAuth("/tariff-definitions/modified")
    if (modifiedRes.ok) {
      const modifiedData: TariffDefinitionsResponse = await modifiedRes.json()
      if (modifiedData.success && modifiedData.data) {
        setModifiedGlobalTariffs(modifiedData.data)
      }
    }
  }

  const loadUserTariffs = async () => {
    const userRes = await fetchDataWithAuth("/tariff-definitions/user")
    if (!userRes.ok) throw new Error(`User defs failed ${userRes.status}`)
    const userData: TariffDefinitionsResponse = await userRes.json()
    
    if (userData.success && userData.data) {
      setUserTariffs(userData.data)
    }
  }

  const loadCountriesAndProducts = async () => {
    const [countriesRes, productsRes] = await Promise.all([
      fetchDataWithAuth("/countries"),
      fetchDataWithAuth("/products"),
    ])

    if (!countriesRes.ok) throw new Error(`Countries failed ${countriesRes.status}`)
    if (!productsRes.ok) throw new Error(`Products failed ${productsRes.status}`)

    const countriesList: string[] = await countriesRes.json()
    const productsList: string[] = await productsRes.json()

    setCountries(countriesList)
    setProducts(productsList)
  }

  const loadTariffs = async () => {
    try {
      if (!simulatorMode) {
        await loadGlobalTariffs()
        await loadModifiedGlobalTariffs()
      }

      if (simulatorMode) {
        await loadUserTariffs()
      }

      await loadCountriesAndProducts()
    } catch (err) {
      showAlert("Error", "An unexpected error occurred while loading tariffs")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTariffs()
  }, [userRole, simulatorMode])

  const validateAllFieldsFilled = (): boolean => {
    if (
      !newTariff.product ||
      !newTariff.exportingFrom ||
      !newTariff.importingTo ||
      !newTariff.type ||
      !newTariff.rate ||
      !newTariff.effectiveDate ||
      !newTariff.expirationDate
    ) {
      showAlert("Incomplete Information", "Please fill in all required fields before submitting.")
      return false
    }
    return true
  }

  const validateRate = (): boolean => {
    const rateValue = Number.parseFloat(newTariff.rate)
    if (isNaN(rateValue) || rateValue < MINIMUM_RATE) {
      showAlert("Invalid Rate", "Please enter a valid positive number for the tariff rate.")
      return false
    }
    return true
  }

  const validateCountryPair = (): boolean => {
    if (newTariff.exportingFrom === newTariff.importingTo) {
      showAlert("Invalid Country Pair", "Exporting and importing countries must be different.")
      return false
    }
    return true
  }

  const validateTariffInput = (): boolean => {
    return validateAllFieldsFilled() && validateRate() && validateCountryPair()
  }

  const generateTariffId = (): string => {
    const prefix = simulatorMode || !isAdminRole() ? USER_ID_PREFIX : ADMIN_MODIFIED_PREFIX
    const timestamp = Date.now()
    return `${prefix}-${timestamp}`
  }

  const createTariffPayload = () => {
    return {
      id: generateTariffId(),
      product: newTariff.product,
      exportingFrom: newTariff.exportingFrom,
      importingTo: newTariff.importingTo,
      type: newTariff.type,
      rate: Number.parseFloat(newTariff.rate),
      effectiveDate: newTariff.effectiveDate,
      expirationDate: newTariff.expirationDate,
    }
  }

  const getAddTariffEndpoint = (): string => {
    if (!simulatorMode && isAdminRole()) {
      return `${API_BASE_URL}/tariff-definitions/modified`
    }
    return `${API_BASE_URL}/tariff-definitions/user`
  }

  const addTariffToBackend = async (payload: any): Promise<TariffDefinitionsResponse> => {
    const token = await getAuthToken()
    const endpoint = getAddTariffEndpoint()

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': token ? `Bearer ${token}` : ''
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    })

    if (!res.ok) throw new Error(`Add tariff failed ${res.status}`)
    return res.json()
  }

  const reloadUserTariffs = async () => {
    const token = await getAuthToken()
    const userRes = await fetch(`${API_BASE_URL}/tariff-definitions/user`, {
      headers: createAuthHeaders(token),
      credentials: 'include'
    })
    
    if (userRes.ok) {
      const userData: TariffDefinitionsResponse = await userRes.json()
      if (userData.success && userData.data) {
        setUserTariffs(userData.data)
      }
    }
  }

  const checkIfTariffReplaced = (payload: any): boolean => {
    return modifiedGlobalTariffs.some(
      t => t.product === payload.product && 
           t.exportingFrom === payload.exportingFrom && 
           t.importingTo === payload.importingTo
    )
  }

  const showSimulatorSuccessMessage = () => {
    showAlert("Success", "Simulated tariff has been successfully added.")
  }

  const showAdminSuccessMessage = (payload: any) => {
    const replaced = checkIfTariffReplaced(payload)
    
    if (replaced) {
      showAlert(
        "Tariff Updated",
        `The global tariff for ${payload.product} from ${payload.exportingFrom} to ${payload.importingTo} has been updated.`
      )
    } else {
      showAlert("Success", "New global tariff has been successfully added to the system.")
    }
  }

  const handleSimulatorModeSuccess = async (response: TariffDefinitionsResponse) => {
    await reloadUserTariffs()
    showSimulatorSuccessMessage()
  }

  const handleAdminModeSuccess = (response: TariffDefinitionsResponse, payload: any) => {
    setModifiedGlobalTariffs((prev) => [...prev, ...response.data!])
    showAdminSuccessMessage(payload)
  }

  const resetNewTariffForm = () => {
    setNewTariff(createInitialNewTariff())
    setIsDialogOpen(false)
  }

  const handleAddTariff = async () => {
    if (!validateTariffInput()) {
      return
    }

    const payload = createTariffPayload()

    try {
      const response = await addTariffToBackend(payload)

      if (!response.success || !response.data) {
        throw new Error(response.error || "Add failed")
      }

      if (simulatorMode) {
        await handleSimulatorModeSuccess(response)
      } else if (isAdminRole()) {
        handleAdminModeSuccess(response, payload)
      }

      resetNewTariffForm()
    } catch (e) {
      showAlert("Error", "Failed to add tariff. Please try again.")
    }
  }

  const deleteTariffFromBackend = async (id: string, isModifiedGlobal: boolean): Promise<Response> => {
    const token = await getAuthToken()
    const endpoint = isModifiedGlobal 
      ? `${API_BASE_URL}/tariff-definitions/modified/${id}`
      : `${API_BASE_URL}/tariff-definitions/user/${id}`

    return fetch(endpoint, {
      method: "DELETE",
      headers: createAuthHeaders(token),
      credentials: 'include'
    })
  }

  const reloadModifiedTariffs = async () => {
    const token = await getAuthToken()
    const modifiedRes = await fetch(`${API_BASE_URL}/tariff-definitions/modified`, {
      headers: createAuthHeaders(token),
      credentials: 'include'
    })
    
    if (modifiedRes.ok) {
      const modifiedData: TariffDefinitionsResponse = await modifiedRes.json()
      if (modifiedData.success && modifiedData.data) {
        setModifiedGlobalTariffs(modifiedData.data)
      }
    }
  }

  const handleDeleteTariff = async (id: string, isModifiedGlobal: boolean) => {
    try {
      const res = await deleteTariffFromBackend(id, isModifiedGlobal)

      if (!res.ok) throw new Error(`Delete failed ${res.status}`)

      if (isModifiedGlobal) {
        await reloadModifiedTariffs()
        showAlert("Deleted", "Modified global tariff has been successfully deleted.")
      } else {
        await reloadUserTariffs()
        showAlert("Deleted", "User-defined tariff has been successfully deleted.")
      }
    } catch (e) {
      showAlert("Error", "Failed to delete tariff. Please try again.")
    }
  }

  const handleExportCSV = () => {
    window.location.href = `${API_BASE_URL}/tariff-definitions/export`
  }

  const matchesProductFilter = (tariff: TariffDefinition): boolean => {
    return !filters.product || tariff.product === filters.product
  }

  const matchesExportingFilter = (tariff: TariffDefinition): boolean => {
    return !filters.exportingFrom || tariff.exportingFrom === filters.exportingFrom
  }

  const matchesImportingFilter = (tariff: TariffDefinition): boolean => {
    return !filters.importingTo || tariff.importingTo === filters.importingTo
  }

  const getFilteredTariffs = (tariffs: TariffDefinition[]) => {
    return tariffs.filter((tariff) => {
      return matchesProductFilter(tariff) && 
             matchesExportingFilter(tariff) && 
             matchesImportingFilter(tariff)
    })
  }

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value === FILTER_ALL_VALUE ? "" : value,
    }))
  }

  const clearFilters = () => {
    setFilters(createInitialFilters())
  }

  const getBadgeVariant = (type: string): "default" | "secondary" => {
    return type === TARIFF_TYPE_AHS ? "default" : "secondary"
  }

  const getBadgeClassName = (type: string): string => {
    return type === TARIFF_TYPE_AHS ? "bg-accent/20 text-accent-foreground" : ""
  }

  const canManageTariffs = (): boolean => {
    return simulatorMode || isAdminRole()
  }

  const getDialogTitle = (): string => {
    return simulatorMode ? "Define Simulated Tariff" : "Define/Edit Global Tariff"
  }

  const getDialogDescription = (): string => {
    if (simulatorMode) {
      return "Create a temporary tariff for simulation purposes. This will not affect global tariffs."
    }
    return "Add or update a global tariff in the system. If a tariff already exists for the same product and country pair, it will be replaced."
  }

  const getAddButtonText = (): string => {
    return simulatorMode ? "Define Simulated Tariff" : "Define/Edit Global Tariff"
  }

  const getSubmitButtonText = (): string => {
    return simulatorMode ? "Add Simulated Tariff" : "Save Global Tariff"
  }

  const renderTariffTable = (
    tariffs: TariffDefinition[],
    title: string,
    description: string,
    showActions = false,
    isModifiedGlobal = false,
  ) => {
    const displayTariffs = getFilteredTariffs(tariffs)

    if (tariffs.length === 0 && showActions) {
      return null
    }

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Exporting From</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Importing To</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rate</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Effective Date</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Expiration Date</th>
                  {showActions && <th className="text-center py-3 px-4 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayTariffs.map((tariff) => (
                  <tr key={tariff.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 text-foreground font-medium">{tariff.product}</td>
                    <td className="py-3 px-4 text-muted-foreground">{tariff.exportingFrom}</td>
                    <td className="py-3 px-4 text-muted-foreground">{tariff.importingTo}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={getBadgeVariant(tariff.type)}
                        className={getBadgeClassName(tariff.type)}
                      >
                        {tariff.type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-foreground">{tariff.rate}%</td>
                    <td className="py-3 px-4 text-muted-foreground">{tariff.effectiveDate}</td>
                    <td className="py-3 px-4 text-muted-foreground">{tariff.expirationDate}</td>
                    {showActions && (
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTariff(tariff)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Edit tariff"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTariff(tariff.id, isModifiedGlobal)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete tariff"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  const mergeTariffs = (): TariffDefinition[] => {
    const mergedGlobalTariffs = [...globalTariffs]
    modifiedGlobalTariffs.forEach((modifiedTariff) => {
      const existingIndex = mergedGlobalTariffs.findIndex(
        (t) =>
          t.product === modifiedTariff.product &&
          t.exportingFrom === modifiedTariff.exportingFrom &&
          t.importingTo === modifiedTariff.importingTo,
      )
      if (existingIndex !== -1) {
        mergedGlobalTariffs[existingIndex] = modifiedTariff
      } else {
        mergedGlobalTariffs.push(modifiedTariff)
      }
    })
    return mergedGlobalTariffs
  }

  const getGlobalTariffsDescription = (): string => {
    if (isAdminRole()) {
      return "System tariffs that can be edited by administrators. Modified tariffs are highlighted."
    }
    return "Standard tariffs from the global database."
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading tariff definitions...</p>
        </CardContent>
      </Card>
    )
  }

  const mergedGlobalTariffs = mergeTariffs()

  return (
    <div>
      <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog({ ...alertDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={closeAlert}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-2">
          <Button onClick={handleExportCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {canManageTariffs() && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {getAddButtonText()}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {getDialogTitle()}
                  </DialogTitle>
                  <DialogDescription>
                    {getDialogDescription()}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid gap-2">
                    <Label htmlFor="product">Product *</Label>
                    <Select
                      value={newTariff.product}
                      onValueChange={(value) => setNewTariff((prev) => ({ ...prev, product: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
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
                  <div className="grid gap-2">
                    <Label htmlFor="exportingFrom">Exporting From *</Label>
                    <Select
                      value={newTariff.exportingFrom}
                      onValueChange={(value) => setNewTariff((prev) => ({ ...prev, exportingFrom: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select exporting country" />
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
                  <div className="grid gap-2">
                    <Label htmlFor="importingTo">Importing To *</Label>
                    <Select
                      value={newTariff.importingTo}
                      onValueChange={(value) => setNewTariff((prev) => ({ ...prev, importingTo: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select importing country" />
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
                  <div className="grid gap-2">
                    <Label htmlFor="type">Tariff Type *</Label>
                    <Select
                      value={newTariff.type}
                      onValueChange={(value) => setNewTariff((prev) => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tariff type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TARIFF_TYPE_AHS}>AHS (Harmonized System)</SelectItem>
                        <SelectItem value={TARIFF_TYPE_MFN}>MFN (Most Favored Nation)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rate">Tariff Rate (%) *</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      min={MINIMUM_RATE}
                      placeholder="e.g., 5.25"
                      value={newTariff.rate}
                      onChange={(e) => setNewTariff((prev) => ({ ...prev, rate: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="effectiveDate">Effective Date *</Label>
                    <Input
                      id="effectiveDate"
                      type="date"
                      value={newTariff.effectiveDate}
                      onChange={(e) => setNewTariff((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="expirationDate">Expiration Date *</Label>
                    <Input
                      id="expirationDate"
                      placeholder='e.g., "Ongoing" or "2025-12-31"'
                      value={newTariff.expirationDate}
                      onChange={(e) => setNewTariff((prev) => ({ ...prev, expirationDate: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">Enter "Ongoing" for indefinite tariffs</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" onClick={handleAddTariff}>
                    {getSubmitButtonText()}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Edit Dialog */}
        {(userRole === "admin") && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Tariff Definition</DialogTitle>
                <DialogDescription>
                  Update the tariff details below. Changes will be saved to the database.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid gap-2">
                  <Label htmlFor="product">Product *</Label>
                  <Select
                    value={newTariff.product}
                    onValueChange={(value) => setNewTariff((prev) => ({ ...prev, product: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
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
                <div className="grid gap-2">
                  <Label htmlFor="exportingFrom">Exporting From *</Label>
                  <Select
                    value={newTariff.exportingFrom}
                    onValueChange={(value) => setNewTariff((prev) => ({ ...prev, exportingFrom: value }))}
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select exporting country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Country pair cannot be changed</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="importingTo">Importing To *</Label>
                  <Select
                    value={newTariff.importingTo}
                    onValueChange={(value) => setNewTariff((prev) => ({ ...prev, importingTo: value }))}
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select importing country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Country pair cannot be changed</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Tariff Type *</Label>
                  <Select
                    value={newTariff.type}
                    onValueChange={(value) => setNewTariff((prev) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tariff type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AHS">AHS (Harmonized System)</SelectItem>
                      <SelectItem value="MFN">MFN (Most Favored Nation)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rate">Tariff Rate (%) *</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g., 5.25"
                    value={newTariff.rate}
                    onChange={(e) => setNewTariff((prev) => ({ ...prev, rate: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="effectiveDate">Effective Date *</Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={newTariff.effectiveDate}
                    onChange={(e) => setNewTariff((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expirationDate">Expiration Date *</Label>
                  <Input
                    id="expirationDate"
                    placeholder='e.g., "Ongoing" or "2025-12-31"'
                    value={newTariff.expirationDate}
                    onChange={(e) => setNewTariff((prev) => ({ ...prev, expirationDate: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Enter "Ongoing" for indefinite tariffs</p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false)
                    setEditingTariff(null)
                    setNewTariff({
                      product: "",
                      exportingFrom: "",
                      importingTo: "",
                      type: "",
                      rate: "",
                      effectiveDate: "",
                      expirationDate: "",
                    })
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" onClick={handleUpdateTariff}>
                  Update Tariff
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Filter Tariffs</CardTitle>
          <CardDescription>Filter tariffs by product, exporting country, or importing country.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={filters.product || FILTER_ALL_VALUE} onValueChange={(value) => handleFilterChange("product", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL_VALUE}>All Products</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exporting From</Label>
              <Select
                value={filters.exportingFrom || FILTER_ALL_VALUE}
                onValueChange={(value) => handleFilterChange("exportingFrom", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL_VALUE}>All Countries</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Importing To</Label>
              <Select
                value={filters.importingTo || FILTER_ALL_VALUE}
                onValueChange={(value) => handleFilterChange("importingTo", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL_VALUE}>All Countries</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={clearFilters} variant="outline" size="sm">
              Clear All Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {simulatorMode ? (
        <>
          {userTariffs.length > 0 ? (
            renderTariffTable(
              userTariffs,
              "Simulated Tariffs",
              "Temporary tariffs for testing different scenarios. These do not affect global data.",
              true,
              false,
            )
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-48 text-center">
                <p className="text-muted-foreground mb-4">No simulated tariffs defined yet.</p>
                <p className="text-sm text-muted-foreground">
                  Click "Define Simulated Tariff" above to create temporary tariffs for testing.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          {renderTariffTable(
            mergedGlobalTariffs,
            "Global Tariffs",
            getGlobalTariffsDescription(),
            isAdminRole(),
            false,
          )}
        </>
      )}
    </div>
  )
}