'use client'

import Link from 'next/link'
import { Truck, Package, BarChart3, Shield } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Truck className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">
                Logistics Portal
              </span>
            </div>
            <nav className="flex space-x-4">
              <Link 
                href="/auth/login" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Login
              </Link>
              <Link 
                href="/auth/register" 
                className="btn-primary text-sm"
              >
                Get Started
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-6xl">
            Streamline Your{' '}
            <span className="text-blue-600">Logistics Operations</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
            The complete logistics aggregator platform for e-commerce, B2B, and B2C enterprises. 
            Manage shipments, track deliveries, and optimize costs from one unified dashboard.
          </p>
          <div className="mt-10">
            <Link href="/auth/register" className="btn-primary text-lg px-8 py-3">
              Start Free Trial
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <Package className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Shipment Management
            </h3>
            <p className="text-gray-600">
              Create, track, and manage shipments across multiple courier partners with ease.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <BarChart3 className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Analytics & Reports
            </h3>
            <p className="text-gray-600">
              Get insights into your logistics performance with comprehensive analytics.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <Shield className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Secure & Compliant
            </h3>
            <p className="text-gray-600">
              Enterprise-grade security with GST compliance and audit trails.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <Truck className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Multi-Platform Integration
            </h3>
            <p className="text-gray-600">
              Connect with Shopify, WooCommerce, and other e-commerce platforms.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}