"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Form validation schema
const loginFormSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
  rememberMe: z.boolean().default(false),
});

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    login,
    isLoggingIn,
    isHydrated,
    isAuthenticated,
    error,
    clearError,
    redirectIfAuthenticated,
  } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  // Credentials are accepted well before the destination route has finished
  // loading. Without this the button would snap back to "Sign In" and the page
  // would just sit there, so we keep the spinner up until navigation happens.
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Where to land after a successful login (set by the route guards).
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const sessionExpired = searchParams.get("expired") === "1";

  const isSubmitting = isLoggingIn || isRedirecting;

  // Once credentials are accepted the form must never be shown again - the
  // navigation takes a moment, and re-exposing a filled form with a live
  // "Sign In" button reads as if the login silently failed. Deriving this from
  // `isAuthenticated` (not just local state) also covers a remount, where
  // local state resets but the browser would re-autofill the fields.
  const isLeaving = isRedirecting || (isHydrated && isAuthenticated);

  const form = useForm({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  // Redirect if already authenticated. Gated on hydration - firing before
  // Redux has read localStorage is what caused the login/dashboard ping-pong.
  useEffect(() => {
    if (!isHydrated) return;
    if (redirectIfAuthenticated(redirectTo)) {
      // Already signed in and leaving - keep the page in its busy state.
      setIsRedirecting(true);
    }
  }, [isHydrated, redirectIfAuthenticated, redirectTo]);

  // Warm the destination route so the post-login navigation isn't a cold load.
  useEffect(() => {
    router.prefetch(redirectTo);
  }, [router, redirectTo]);

  // Clear error when form changes
  useEffect(() => {
    const subscription = form.watch(() => {
      if (error) clearError();
    });
    return () => subscription.unsubscribe();
  }, [form, error, clearError]);

  async function onSubmit(data) {
    try {
      await login({
        email: data.email,
        password: data.password,
      });
      // Stay busy across the navigation - it is not instant, and the
      // login mutation has already settled by this point.
      setIsRedirecting(true);
      router.replace(redirectTo);
    } catch (error) {
      setIsRedirecting(false);
      console.error("Login failed:", error);
    }
  }

  // Hydrating, or already on the way out: show a standalone status screen
  // instead of the form. Rendering the form here would flash it at users who
  // are already signed in and, after a submit, make a completed login look
  // like it had reset itself.
  if (!isHydrated || isLeaving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <Truck className="h-8 w-8 text-logistics-600" />
            <span className="text-2xl font-bold text-foreground">
              Logistics Portal
            </span>
          </div>
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-logistics-600" />
          <p className="text-muted-foreground">
            {isLeaving ? "Signing you in..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Truck className="h-8 w-8 text-logistics-600" />
            <span className="text-2xl font-bold text-foreground">
              Logistics Portal
            </span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            Welcome back
          </h2>
          <p className="text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>

        {/* Session Expired Notice */}
        {sessionExpired && !error && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Your session has expired. Please sign in again.
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your logistics dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@company.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between">
                  <FormField
                    control={form.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm">Remember me</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-logistics-600 hover:text-logistics-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isLoggingIn ? "Signing in..." : "Taking you in..."}
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>

            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  href="/auth/register"
                  className="text-logistics-600 dark:text-blue-400 font-medium hover:underline"
                >
                  Create one now
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>© 2024 Logistics Portal. All rights reserved.</p>
          <div className="mt-2 space-x-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/support" className="hover:text-foreground">
              Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
