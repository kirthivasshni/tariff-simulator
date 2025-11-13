"use client"

import { useEffect, useState } from "react"
import supabase from "@/lib/supabaseClient"
import { LoginForm } from "@/components/login-form"
import { SignupForm } from "@/components/signup-form"
import { TariffCalculatorForm } from "@/components/tariff-calculator-form"
import { ResultsTable } from "@/components/results-table"
import { TariffDefinitionsTable } from "@/components/tariff-definitions-table"
import { ExportCartWithHistory } from "@/components/export-cart-with-history"
import { SimulatorCalculator } from "@/components/simulator-calculator"
import { AdminDashboard } from "@/components/admin-dashboard"
import { TradeInsightsView } from "@/components/trade-insights-view"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LogOut, User, Shield } from "lucide-react"
import { TariffTrendsVisualization } from "@/components/tariff-trends-visualization"
import { TariffComparisonPanel } from "@/components/tariff-comparison-panel"
import { API_BASE_URL, getApiUrl } from "@/lib/apiConfig"


type AuthView = "login" | "signup"
type DashboardView = "dashboard" | "global-tariffs" | "simulator-tariffs" | "cart" | "trade-insights" | "admin"

const EMPTY_CART_STATUS = 204


export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [authView, setAuthView] = useState<"login" | "signup">("login")
  const [calculationResults, setCalculationResults] = useState<any>(null)
  const [currentView, setCurrentView] = useState<DashboardView>("dashboard")
  const [cartCount, setCartCount] = useState<number>(0)

  const handleLogin = (userData: any) => {
    setUser(userData)
  }

  const handleSignup = (userData: any) => {
    setUser(userData)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setCalculationResults(null)
    setCartCount(0)
  }

  const fetchCartCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(getApiUrl("export-cart"), {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (response.status === 204 || !response.ok) {
        setCartCount(0)
      } else if (response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          try {
            const cartData = await response.json()
            setCartCount(Array.isArray(cartData) ? cartData.length : 0)
          } catch (parseError) {
            console.error("Error parsing cart data:", parseError)
            setCartCount(0)
          }
        } else {
          setCartCount(0)
        }
      }
    } catch (err) {
      console.error("Error fetching cart count:", err)
      setCartCount(0)
    }
  }

  const getAuthToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ""
  }

  const createAuthHeaders = (token: string): Record<string, string> => ({
    "Authorization": token ? `Bearer ${token}` : "",
    "Content-Type": "application/json"
  })

  const parseCartResponse = async (response: Response): Promise<number> => {
    if (response.status === EMPTY_CART_STATUS || !response.ok) {
      return 0
    }

    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      return 0
    }

    try {
      const cartData = await response.json()
      return Array.isArray(cartData) ? cartData.length : 0
    } catch (error) {
      console.error("Error parsing cart data:", error)
      return 0
    }
  }

  const fetchUserProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", userId)
      .single()

    return profile?.role
  }

  const resolveUserRole = async (sessionUser: any) => {
    const metadataRole = (sessionUser.app_metadata?.role || sessionUser.user_metadata?.role)
    if (metadataRole) {
      return String(metadataRole).toLowerCase()
    }

    const profileRole = await fetchUserProfile(sessionUser.id)
    return (profileRole || "user").toLowerCase()
  }

  const initializeUser = async (sessionUser: any) => {
    const role = await resolveUserRole(sessionUser)
    const name = sessionUser.user_metadata?.full_name || sessionUser.email?.split("@")[0] || "User"

    setUser({
      ...sessionUser,
      role,
      name
    })

    await fetchCartCount()
  }


  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        const role = (data.session.user.app_metadata?.role ||
                     data.session.user.user_metadata?.role ||
                     'user').toLowerCase()

        setUser({
          ...data.session.user,
          role: role,
          name: data.session.user.user_metadata?.full_name ||
                data.session.user.email?.split('@')[0] ||
                'User'
        })

        fetchCartCount()
      }
    }
    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const role = (session.user.app_metadata?.role ||
                     session.user.user_metadata?.role ||
                     'user').toLowerCase()

        setUser({
          ...session.user,
          role: role,
          name: session.user.user_metadata?.full_name ||
                session.user.email?.split('@')[0] ||
                'User'
        })

        fetchCartCount()
      } else {
        setUser(null)
        setCartCount(0)
      }
    })

    return () => {
      subscription.subscription?.unsubscribe()
    }
  }, [])

  const handleCalculationComplete = async (results: any) => {
    const calculationWithId = {
      data: results,
      calculationId: results.calculationId || `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      calculationDate: results.calculationDate || new Date().toISOString()
    }

    setCalculationResults(calculationWithId)
  }

  const handleAddToCart = async () => {
    await fetchCartCount()
    return true
  }

  const handleRemoveFromCart = async () => {
    await fetchCartCount()
  }

  const handleClearCart = async () => {
    await fetchCartCount()
  }

  const generateCalculationId = (): string => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `calc_${timestamp}_${random}`
  }

  const wrapCalculationWithMetadata = (results: any) => {
    return {
      data: results,
      calculationId: results?.calculationId || generateCalculationId(),
      calculationDate: results?.calculationDate || new Date().toISOString()
    }
  }

  const navigateToCart = async () => {
    setCurrentView("cart")
    await fetchCartCount()
  }

  const renderAuthView = () => {
    if (authView === "login") {
      return <LoginForm onLogin={handleLogin} onSwitchToSignup={() => setAuthView("signup")} />
    }
    return <SignupForm onSignup={handleSignup} onSwitchToLogin={() => setAuthView("login")} />
  }

  const getNavButtonClasses = (view: DashboardView): string => {
    const baseClasses = "px-3 py-2 text-sm font-medium rounded-md"
    const activeClasses = "bg-slate-100 text-slate-900"
    const inactiveClasses = "text-slate-600 hover:text-slate-900"
    return `${baseClasses} ${currentView === view ? activeClasses : inactiveClasses}`
  }

  const getUserDisplayName = (): string => {
    return user?.name || "User"
  }

  const getUserRoleLabel = (): string => {
    return user?.role === "admin" ? "Admin" : "User"
  }

  const renderUserRoleIcon = () => {
    return user?.role === "admin"
      ? <Shield className="h-4 w-4 text-accent" />
      : <User className="h-4 w-4" />
  }

  const getCalculationProductName = (): string => {
    return calculationResults?.data?.product || calculationResults?.product || "selected products"
  }

  const getCalculationExportingFrom = (): string => {
    return calculationResults?.data?.exportingFrom || calculationResults?.exportingFrom || "various countries"
  }

  const getCalculationImportingTo = (): string => {
    return calculationResults?.data?.importingTo || calculationResults?.importingTo || "destination countries"
  }

  if (!user) {
    return renderAuthView()
  }

  if (!user) {
    if (authView === "login") {
      return <LoginForm onLogin={handleLogin} onSwitchToSignup={() => setAuthView("signup")} />
    } else {
      return <SignupForm onSignup={handleSignup} onSwitchToLogin={() => setAuthView("login")} />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-slate-900">TariffWise</h1>
              <nav className="flex space-x-4">
                <button
                  onClick={() => setCurrentView("dashboard")}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    currentView === "dashboard" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView("global-tariffs")}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    currentView === "global-tariffs"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Tariff Definitions
                </button>
                <button
                  onClick={() => setCurrentView("simulator-tariffs")}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    currentView === "simulator-tariffs"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Tariff Simulator
                </button>
                <button
                  onClick={() => {
                    setCurrentView("cart")
                    fetchCartCount()
                  }}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    currentView === "cart" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Export Cart ({cartCount})
                </button>
                <button
                  onClick={() => setCurrentView("trade-insights")}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    currentView === "trade-insights"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Trade Insights
                </button>
                {user.role === "admin" && (
                  <button
                    onClick={() => setCurrentView("admin")}
                    className={`px-3 py-2 text-sm font-medium rounded-md flex items-center space-x-1 ${
                      currentView === "admin" ? "bg-indigo-100 text-indigo-900" : "text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50"
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    <span>Admin</span>
                  </button>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                {user.role === "admin" ? <Shield className="h-4 w-4 text-accent" /> : <User className="h-4 w-4" />}
                <span>{user.name}</span>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded-full">
                  {user.role === "admin" ? "Admin" : "User"}
                </span>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2 bg-transparent"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === "dashboard" && (
          <>
            <div className="mb-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">Tariff Calculator</h2>
                  <p className="text-slate-600">
                    Calculate import costs using official global tariffs. For custom scenarios, visit the Tariff Simulator tab.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <TariffCalculatorForm
                onCalculationComplete={handleCalculationComplete}
                tariffSource="global"
              />

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-900">Historical Trends</CardTitle>
                  <CardDescription>
                    Visualize tariff changes over time for {getCalculationProductName()} from {getCalculationExportingFrom()} to {getCalculationImportingTo()}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TariffTrendsVisualization />
                </CardContent>
              </Card>
            </div>

            <TariffComparisonPanel />

            {calculationResults && (
              <div className="mb-8">
                <ResultsTable results={calculationResults} onAddToCart={handleAddToCart} />
              </div>
            )}
          </>
        )}

        {currentView === "global-tariffs" && (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Global Tariff Definitions</h2>
              <p className="text-slate-600">
                {user.role === "admin"
                  ? "View and manage global tariffs. As an admin, you can edit existing tariffs."
                  : "View official global tariff rates for all country pairs and products."}
              </p>
            </div>
            <TariffDefinitionsTable userRole={user.role} simulatorMode={false} />
          </>
        )}

        {currentView === "simulator-tariffs" && (
          <>
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <div className="h-3 w-3 bg-purple-500 rounded-full animate-pulse"></div>
                <h2 className="text-2xl font-bold text-purple-900">Tariff Simulator</h2>
              </div>
              <p className="text-purple-700">
                Test different tariff scenarios by entering custom parameters directly. Calculate import costs in real-time without affecting global data.
              </p>
            </div>
            <SimulatorCalculator />
          </>
        )}

        {currentView === "cart" && (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Export Cart & Session History</h2>
              <p className="text-slate-600">Manage your cart and view session calculations. Add items from history to your cart for export.</p>
            </div>
            <ExportCartWithHistory onCartCountChange={fetchCartCount} />
          </>
        )}

        {currentView === "trade-insights" && (
          <TradeInsightsView apiBaseUrl={API_BASE_URL} getAuthToken={getAuthToken} />
        )}

        {currentView === "admin" && user.role === "admin" && (
          <AdminDashboard />
        )}

      </main>
    </div>
  )
}

