"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Truck,
  Eye,
  EyeOff,
  Loader2,
  Building,
  User,
  Users,
} from "lucide-react";

// Form validation schema
const registerFormSchema = z
  .object({
    firstName: z.string().min(2, {
      message: "First name must be at least 2 characters.",
    }),
    lastName: z.string().min(2, {
      message: "Last name must be at least 2 characters.",
    }),
    email: z.string().email({
      message: "Please enter a valid email address.",
    }),
    password: z.string().min(8, {
      message: "Password must be at least 8 characters.",
    }),
    confirmPassword: z.string(),
    companyName: z.string().min(2, {
      message: "Company name must be at least 2 characters.",
    }),
    businessType: z.string({
      required_error: "Please select a business type.",
    }),
    phoneNumber: z.string().min(10, {
      message: "Phone number must be at least 10 digits.",
    }),
    agreeToTerms: z.boolean().refine((val) => val === true, {
      message: "You must agree to the terms and conditions.",
    }),
    subscribeNewsletter: z.boolean().default(false),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

const businessTypes = [
  { value: "ecommerce", label: "E-commerce", icon: Building },
  { value: "manufacturing", label: "Manufacturing", icon: Building },
  { value: "retail", label: "Retail", icon: Building },
  { value: "wholesale", label: "Wholesale", icon: Building },
  { value: "logistics", label: "Logistics Provider", icon: Truck },
  { value: "other", label: "Other", icon: Users },
];

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      companyName: "",
      phoneNumber: "",
      agreeToTerms: false,
      subscribeNewsletter: false,
    },
  });

  async function onSubmit(_data: RegisterFormValues) {
    setIsLoading(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // TODO: Replace with actual API call
    // const response = await fetch('/api/auth/register', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data)
    // })

    // Static success - redirect to dashboard
    router.push("/dashboard");
    setIsLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Truck className="h-8 w-8 text-logistics-600" />
            <span className="text-2xl font-bold text-foreground">
              Logistics Portal
            </span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            Create your account
          </h2>
          <p className="text-muted-foreground">
            Start managing your logistics operations today
          </p>
        </div>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              Create your logistics management account to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>Personal Information</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+1 (555) 123-4567"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Company Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center space-x-2">
                    <Building className="h-4 w-4" />
                    <span>Company Information</span>
                  </h3>

                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Corporation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your business type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {businessTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center space-x-2">
                                  <type.icon className="h-4 w-4" />
                                  <span>{type.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Security */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Security</h3>

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
                              placeholder="Create a strong password"
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
                        <FormDescription>
                          Password must be at least 8 characters long
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                            >
                              {showConfirmPassword ? (
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
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="agreeToTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm">
                            I agree to the{" "}
                            <Link
                              href="/terms"
                              className="text-logistics-600 hover:text-logistics-700"
                            >
                              Terms of Service
                            </Link>{" "}
                            and{" "}
                            <Link
                              href="/privacy"
                              className="text-logistics-600 hover:text-logistics-700"
                            >
                              Privacy Policy
                            </Link>
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subscribeNewsletter"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm">
                            Subscribe to our newsletter for updates and
                            logistics insights
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </Form>

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="text-logistics-600 hover:text-logistics-700 font-medium"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>© 2024 Logistics Portal. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
