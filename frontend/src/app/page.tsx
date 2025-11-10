"use client";

import Link from "next/link";
import {
  Truck,
  Package,
  Globe,
  Shield,
  Zap,
  Users,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Building,
  Clock,
  MapPin,
  ChevronRight,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  // Remove automatic redirect for authenticated users - let them see the landing page
  // They can click login/dashboard to navigate if they want

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 border-b">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Logistics Portal</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="#features"
                className="text-sm font-medium hover:text-primary transition"
              >
                Features
              </Link>
              <Link
                href="#partners"
                className="text-sm font-medium hover:text-primary transition"
              >
                Partners
              </Link>
              <Link
                href="#stats"
                className="text-sm font-medium hover:text-primary transition"
              >
                Statistics
              </Link>
              <Link
                href="#contact"
                className="text-sm font-medium hover:text-primary transition"
              >
                Contact
              </Link>
            </nav>
            <div className="flex items-center gap-4">
              <Button asChild>
                <Link href="/auth/login">Login</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="text-sm px-3 py-1">
                India's Leading Logistics Aggregator
              </Badge>
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
                Simplify Your Logistics with{" "}
                <span className="text-primary">One Platform</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Connect with 75+ courier partners, manage shipments, track
                deliveries, and scale your business with our comprehensive
                logistics solution. Built for Indian e-commerce.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild>
                  <Link href="/auth/login">
                    Login to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#features">Learn More</Link>
                </Button>
              </div>
              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">75+ Courier Partners</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Enterprise Ready</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-3xl blur-3xl" />
              <Card className="relative">
                <CardContent className="p-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Package className="h-8 w-8 text-primary" />
                      <p className="text-2xl font-bold">50K+</p>
                      <p className="text-sm text-muted-foreground">
                        Daily Shipments
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Users className="h-8 w-8 text-primary" />
                      <p className="text-2xl font-bold">5000+</p>
                      <p className="text-sm text-muted-foreground">
                        Active Merchants
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Globe className="h-8 w-8 text-primary" />
                      <p className="text-2xl font-bold">29000+</p>
                      <p className="text-sm text-muted-foreground">
                        Pincodes Covered
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Star className="h-8 w-8 text-primary" />
                      <p className="text-2xl font-bold">4.8/5</p>
                      <p className="text-sm text-muted-foreground">
                        Customer Rating
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold">
              Powerful Features for Modern Logistics
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your logistics operations
              efficiently
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Truck className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Multi-Courier Integration</CardTitle>
                <CardDescription>
                  Connect with 75+ courier partners through a single API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Automatic courier selection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Best rate comparison</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Unified tracking</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  Bank-grade security with role-based access control
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>11-role RBAC system</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>JWT authentication</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>API Gateway protection</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Real-time Tracking</CardTitle>
                <CardDescription>
                  Track all your shipments in real-time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Live status updates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>SMS & Email notifications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>NDR management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>
                  Comprehensive insights and reporting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Performance metrics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Cost analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Custom reports</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Building className="h-8 w-8 text-primary mb-2" />
                <CardTitle>White-Label Solution</CardTitle>
                <CardDescription>
                  Customize and brand as your own
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Custom branding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Multi-tenant architecture</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>License management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Globe className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Platform Integrations</CardTitle>
                <CardDescription>
                  Connect with popular e-commerce platforms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Shopify integration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>WooCommerce support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>REST API access</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section id="partners" className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold">Trusted Courier Partners</h2>
            <p className="text-muted-foreground">
              We work with India's leading logistics providers
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
            {[
              "Delhivery",
              "Blue Dart",
              "DTDC",
              "Ecom Express",
              "Xpressbees",
              "Shadowfax",
            ].map((partner) => (
              <div
                key={partner}
                className="flex items-center justify-center p-4 bg-background rounded-lg"
              >
                <span className="font-semibold text-muted-foreground">
                  {partner}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="py-16 px-4">
        <div className="container mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold">Impressive Numbers</h2>
            <p className="text-muted-foreground">
              Trusted by thousands of businesses across India
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">98.5%</p>
              <p className="text-muted-foreground mt-2">
                Delivery Success Rate
              </p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">24/7</p>
              <p className="text-muted-foreground mt-2">Customer Support</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">₹2.5Cr+</p>
              <p className="text-muted-foreground mt-2">Monthly Transactions</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">&lt; 2hrs</p>
              <p className="text-muted-foreground mt-2">
                Average Resolution Time
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Transform Your Logistics?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Join thousands of businesses already using our platform
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/auth/login">
              Login Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              <span className="font-semibold">Logistics Portal</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Logistics Portal. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
