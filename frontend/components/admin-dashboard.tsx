"use client"

import { useState, useEffect } from "react"
import supabase from "@/lib/supabaseClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TariffDefinitionsTable } from "@/components/tariff-definitions-table"
import { getApiUrl } from "@/lib/apiConfig"
import { 
  Database, 
  Globe, 
  Package, 
  Users, 
  TrendingUp, 
  Activity,
  Shield,
  Settings,
  FileText,
  BarChart3
} from "lucide-react"

interface DashboardStats {
  totalTariffs: number
  totalProducts: number
  totalCountries: number
  totalCountryPairs: number
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeView, setActiveView] = useState<"overview" | "tariffs">("overview")

  useEffect(() => {
    const loadStats = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        const response = await fetch(getApiUrl("admin/dashboard/stats"), {
          headers: {
            "Authorization": token ? `Bearer ${token}` : "",
            "Content-Type": "application/json"
          },
          credentials: "include"
        })

        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (err) {
        console.error("Error loading dashboard stats:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading admin dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-2">
          <Shield className="h-8 w-8 text-indigo-600" />
          <h2 className="text-3xl font-bold text-slate-900">Admin Dashboard</h2>
        </div>
        <p className="text-slate-600">
          Manage tariff definitions, view system statistics, and configure global settings.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-border">
        <button
          onClick={() => setActiveView("overview")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeView === "overview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Overview</span>
          </div>
        </button>
        <button
          onClick={() => setActiveView("tariffs")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeView === "tariffs"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <div className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Manage Tariffs</span>
          </div>
        </button>
      </div>

      {/* Overview Tab */}
      {activeView === "overview" && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>Total Tariffs</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {stats?.totalTariffs || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active tariff definitions
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <Package className="h-4 w-4" />
                  <span>Products</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {stats?.totalProducts || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Available products
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <Globe className="h-4 w-4" />
                  <span>Countries</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {stats?.totalCountries || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Supported countries
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Country Pairs</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {stats?.totalCountryPairs || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Trade relationships
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex flex-col items-center space-y-2"
                  onClick={() => setActiveView("tariffs")}
                >
                  <Database className="h-6 w-6 text-blue-600" />
                  <div className="text-center">
                    <div className="font-semibold">Manage Tariffs</div>
                    <div className="text-xs text-muted-foreground">Add, edit, or delete tariffs</div>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex flex-col items-center space-y-2"
                  onClick={() => window.location.href = getApiUrl("tariff-definitions/export")}
                >
                  <FileText className="h-6 w-6 text-green-600" />
                  <div className="text-center">
                    <div className="font-semibold">Export Data</div>
                    <div className="text-xs text-muted-foreground">Download tariff definitions</div>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex flex-col items-center space-y-2"
                  disabled
                >
                  <Settings className="h-6 w-6 text-slate-400" />
                  <div className="text-center">
                    <div className="font-semibold">System Settings</div>
                    <div className="text-xs text-muted-foreground">Coming soon</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">System Information</CardTitle>
              <CardDescription>Current system status and configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">System Status</span>
                  </div>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Operational
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Database</span>
                  </div>
                  <Badge variant="default" className="bg-blue-100 text-blue-800">
                    Connected
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">User Management</span>
                  </div>
                  <Badge variant="default" className="bg-purple-100 text-purple-800">
                    Supabase Auth
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tariffs Tab */}
      {activeView === "tariffs" && (
        <div>
          <TariffDefinitionsTable userRole="admin" simulatorMode={false} />
        </div>
      )}
    </div>
  )
}

