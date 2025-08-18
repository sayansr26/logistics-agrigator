"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Truck, Package, MapPin } from "lucide-react";

// Form validation schema
const shipmentFormSchema = z.object({
  senderName: z.string().min(2, {
    message: "Sender name must be at least 2 characters.",
  }),
  senderEmail: z.string().email({
    message: "Please enter a valid email address.",
  }),
  senderPhone: z.string().min(10, {
    message: "Phone number must be at least 10 digits.",
  }),
  receiverName: z.string().min(2, {
    message: "Receiver name must be at least 2 characters.",
  }),
  receiverAddress: z.string().min(10, {
    message: "Address must be at least 10 characters.",
  }),
  packageType: z.string({
    required_error: "Please select a package type.",
  }),
  weight: z.string().min(1, {
    message: "Weight is required.",
  }),
  dimensions: z.string().min(5, {
    message: "Dimensions are required (e.g., 10x10x10).",
  }),
  specialInstructions: z.string().optional(),
  insuranceRequired: z.boolean().default(false),
  signatureRequired: z.boolean().default(false),
});

type ShipmentFormValues = z.infer<typeof shipmentFormSchema>;

// Default values
const defaultValues: Partial<ShipmentFormValues> = {
  senderName: "",
  senderEmail: "",
  senderPhone: "",
  receiverName: "",
  receiverAddress: "",
  weight: "",
  dimensions: "",
  specialInstructions: "",
  insuranceRequired: false,
  signatureRequired: false,
};

export default function FormsDemo() {
  const form = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues,
  });

  function onSubmit(data: ShipmentFormValues) {
    console.log("Form submitted:", data);
    alert("Form submitted successfully! Check console for data.");
  }

  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Demo", href: "/demo" },
    { title: "Form Components" },
  ];

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Package className="h-8 w-8 text-logistics-600" />
            <h1 className="text-3xl font-bold text-foreground">
              Form Components Demo
            </h1>
          </div>
          <p className="text-muted-foreground">
            shadcn/ui forms integrated with React Hook Form and Zod validation
          </p>
        </div>

        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Truck className="h-5 w-5" />
              <span>Create Shipment</span>
            </CardTitle>
            <CardDescription>
              Fill out the form below to create a new shipment. All fields with
              * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* Sender Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center space-x-2">
                    <MapPin className="h-4 w-4" />
                    <span>Sender Information</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="senderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sender Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="senderEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="john@example.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="senderPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} />
                        </FormControl>
                        <FormDescription>
                          Include country code for international numbers
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Package Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Package Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="packageType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Package Type *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="document">Document</SelectItem>
                              <SelectItem value="package">Package</SelectItem>
                              <SelectItem value="envelope">Envelope</SelectItem>
                              <SelectItem value="box">Box</SelectItem>
                              <SelectItem value="fragile">
                                Fragile Item
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weight (kg) *</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="2.5" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dimensions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dimensions (cm) *</FormLabel>
                          <FormControl>
                            <Input placeholder="20x15x10" {...field} />
                          </FormControl>
                          <FormDescription>
                            Length x Width x Height
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Additional Options</h3>
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="insuranceRequired"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Insurance Required</FormLabel>
                            <FormDescription>
                              Add insurance coverage for this shipment
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="signatureRequired"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Signature Required</FormLabel>
                            <FormDescription>
                              Require signature upon delivery
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                  >
                    Reset Form
                  </Button>
                  <Button type="submit">Create Shipment</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Form State Display */}
        <Card>
          <CardHeader>
            <CardTitle>Form State (Development)</CardTitle>
            <CardDescription>
              Current form values and validation state
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Form Values:</Label>
                <pre className="mt-2 p-4 bg-muted rounded-md text-sm overflow-auto">
                  {JSON.stringify(form.watch(), null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
