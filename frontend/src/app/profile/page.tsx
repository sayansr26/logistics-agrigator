"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authApiService, userApiService } from "@/services";
import { UpdateProfileData } from "@/services/api/user-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  User,
  Mail,
  Shield,
  Building,
  Calendar,
  Save,
  RefreshCw,
} from "lucide-react";
import { User as UserType } from "@/types/auth";

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  companyName: string;
  designation: string;
  department: string;
  timezone: string;
  language: string;
}

export default function ProfilePage() {
  const { user, accessToken, isAuthenticated, requireAuth, getCurrentUser } =
    useAuth();
  const [profileData, setProfileData] = useState<UserType | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    companyName: "",
    designation: "",
    department: "",
    timezone: "",
    language: "en",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initialize with auth store user data and fetch additional profile data
  useEffect(() => {
    const initializeProfile = async () => {
      // Check authentication first
      if (!isAuthenticated) {
        requireAuth();
        return;
      }

      if (!accessToken) {
        setError("No access token available. Please log in again.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Set the access token for API calls
        authApiService.setAccessToken(accessToken);
        userApiService.setAccessToken(accessToken);

        // If we already have user data from auth store, use it immediately
        if (user) {
          console.log("User data from auth store:", user);
          setProfileData(user);

          // Handle different possible name structures
          const userName = user.name || (user as any).firstName || "";
          const nameParts = userName ? userName.split(" ") : [];

          console.log("Extracted name:", userName, "Parts:", nameParts);

          // Temporary debug alert to help identify the issue
          if (!userName) {
            console.warn(
              "No name found in user data. Available fields:",
              Object.keys(user),
            );
          }

          setFormData({
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            email: user.email || "",
            phoneNumber: "",
            companyName: "",
            designation: "",
            department: "",
            timezone: "",
            language: "en",
          });
        }

        // Try to fetch detailed profile from user service
        try {
          const userProfileResponse = await userApiService.getMyProfile();

          if (
            userProfileResponse.status === "success" &&
            userProfileResponse.data
          ) {
            const detailedProfile = userProfileResponse.data.profile;
            setFormData({
              firstName:
                detailedProfile.firstName || user?.name?.split(" ")[0] || "",
              lastName:
                detailedProfile.lastName ||
                user?.name?.split(" ").slice(1).join(" ") ||
                "",
              email: detailedProfile.email || user?.email || "",
              phoneNumber: detailedProfile.phoneNumber || "",
              companyName: detailedProfile.companyName || "",
              designation: detailedProfile.designation || "",
              department: detailedProfile.department || "",
              timezone: detailedProfile.timezone || "",
              language: detailedProfile.language || "en",
            });
          }
        } catch (profileErr) {
          console.warn(
            "Could not fetch detailed profile, using basic user data:",
            profileErr,
          );
          // This is fine - we'll just use the basic user data we already have
        }

        // Also try to refresh basic user data from auth service
        try {
          const authResponse = await authApiService.getUserProfile();
          if (authResponse.status === "success" && authResponse.data) {
            const userData = authResponse.data.user;
            setProfileData(userData);
          }
        } catch (authErr) {
          console.warn("Could not refresh auth profile:", authErr);
          // This is also fine - we'll use what we have
        }
      } catch (err) {
        console.error("Error initializing profile:", err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    initializeProfile();
  }, [accessToken, isAuthenticated, user, requireAuth]);

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleUpdateProfile = async () => {
    if (!accessToken || !profileData) return;

    try {
      setIsUpdating(true);
      setError(null);
      setSuccess(null);

      // Set the access token for API calls
      userApiService.setAccessToken(accessToken);

      // Prepare update data
      const updateData: UpdateProfileData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber || undefined,
        companyName: formData.companyName || undefined,
        designation: formData.designation || undefined,
        department: formData.department || undefined,
        timezone: formData.timezone || undefined,
        language: formData.language,
      };

      // Try to update profile via user service
      try {
        const response = await userApiService.updateProfile(
          profileData.id,
          updateData,
        );

        if (response.status === "success") {
          setSuccess("Profile updated successfully!");
          // Refresh profile data
          const updatedResponse = await userApiService.getMyProfile();
          if (updatedResponse.status === "success" && updatedResponse.data) {
            const detailedProfile = updatedResponse.data.profile;
            setFormData({
              firstName: detailedProfile.firstName || "",
              lastName: detailedProfile.lastName || "",
              email: detailedProfile.email || "",
              phoneNumber: detailedProfile.phoneNumber || "",
              companyName: detailedProfile.companyName || "",
              designation: detailedProfile.designation || "",
              department: detailedProfile.department || "",
              timezone: detailedProfile.timezone || "",
              language: detailedProfile.language || "en",
            });
          }
        } else {
          throw new Error(
            response.error?.message || "Failed to update profile",
          );
        }
      } catch (updateErr) {
        console.warn(
          "Profile update failed, trying to create profile:",
          updateErr,
        );

        // If update fails, try to create a new profile
        try {
          const createData = {
            userId: profileData.id,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phoneNumber: formData.phoneNumber || undefined,
            companyName: formData.companyName || undefined,
            designation: formData.designation || undefined,
            department: formData.department || undefined,
            timezone: formData.timezone || undefined,
            language: formData.language,
            clientId: profileData.clientId,
          };

          const createResponse = await userApiService.createProfile(createData);

          if (createResponse.status === "success") {
            setSuccess("Profile created successfully!");
          } else {
            throw new Error(
              createResponse.error?.message || "Failed to create profile",
            );
          }
        } catch (createErr) {
          throw new Error(
            createErr instanceof Error
              ? createErr.message
              : "Failed to update or create profile",
          );
        }
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRefreshProfile = async () => {
    if (!accessToken) {
      setError("No access token available. Please log in again.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      authApiService.setAccessToken(accessToken);
      userApiService.setAccessToken(accessToken);

      // Refresh user data from auth store first
      await getCurrentUser();

      // Fetch from auth service
      const authResponse = await authApiService.getUserProfile();

      if (authResponse.status === "success" && authResponse.data) {
        const userData = authResponse.data.user;
        setProfileData(userData);

        // Try to fetch detailed profile from user service
        try {
          const userProfileResponse = await userApiService.getMyProfile();
          if (
            userProfileResponse.status === "success" &&
            userProfileResponse.data
          ) {
            const detailedProfile = userProfileResponse.data.profile;
            setFormData({
              firstName: detailedProfile.firstName || "",
              lastName: detailedProfile.lastName || "",
              email: detailedProfile.email || userData.email || "",
              phoneNumber: detailedProfile.phoneNumber || "",
              companyName: detailedProfile.companyName || "",
              designation: detailedProfile.designation || "",
              department: detailedProfile.department || "",
              timezone: detailedProfile.timezone || "",
              language: detailedProfile.language || "en",
            });
          } else {
            // Fallback to basic user data
            const userName = userData.name || (userData as any).firstName || "";
            const nameParts = userName ? userName.split(" ") : [];

            setFormData({
              firstName: nameParts[0] || "",
              lastName: nameParts.slice(1).join(" ") || "",
              email: userData.email || "",
              phoneNumber: "",
              companyName: "",
              designation: "",
              department: "",
              timezone: "",
              language: "en",
            });
          }
        } catch (profileErr) {
          console.warn("Could not fetch detailed profile:", profileErr);
          // Fallback to basic user data
          const userName = userData.name || (userData as any).firstName || "";
          const nameParts = userName ? userName.split(" ") : [];

          setFormData({
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            email: userData.email || "",
            phoneNumber: "",
            companyName: "",
            designation: "",
            department: "",
            timezone: "",
            language: "en",
          });
        }

        setSuccess("Profile refreshed successfully!");
      } else {
        throw new Error(
          authResponse.error?.message || "Failed to refresh profile",
        );
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
      setError(
        err instanceof Error ? err.message : "Failed to refresh profile",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "finance":
        return "bg-green-100 text-green-800 border-green-200";
      case "operations":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "client":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "support":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Show loading state only if we don't have any user data
  if (isLoading && !user && !profileData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading profile...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Authentication Required
            </h2>
            <p className="text-gray-600 mb-4">
              Please log in to view your profile.
            </p>
            <Button onClick={() => (window.location.href = "/auth/login")}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
            <p className="text-gray-600 mt-1">
              Manage your account information and preferences
            </p>
          </div>
          {/* <Button
            variant="outline"
            onClick={handleRefreshProfile}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button> */}
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile Information</span>
              </CardTitle>
              <CardDescription>
                Update your personal information and account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      handleInputChange("firstName", e.target.value)
                    }
                    placeholder="Enter your first name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      handleInputChange("lastName", e.target.value)
                    }
                    placeholder="Enter your last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="Enter your email"
                    disabled // Email is usually not editable
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      handleInputChange("phoneNumber", e.target.value)
                    }
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) =>
                      handleInputChange("companyName", e.target.value)
                    }
                    placeholder="Enter your company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="designation">Designation</Label>
                  <Input
                    id="designation"
                    value={formData.designation}
                    onChange={(e) =>
                      handleInputChange("designation", e.target.value)
                    }
                    placeholder="Enter your designation"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) =>
                      handleInputChange("department", e.target.value)
                    }
                    placeholder="Enter your department"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) =>
                      handleInputChange("timezone", e.target.value)
                    }
                    placeholder="Enter your timezone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <select
                    id="language"
                    value={formData.language}
                    onChange={(e) =>
                      handleInputChange("language", e.target.value)
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleUpdateProfile}
                  disabled={isUpdating}
                  className="flex items-center space-x-2"
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{isUpdating ? "Updating..." : "Update Profile"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Account Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(profileData || user) && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Full Name</span>
                    </div>
                    <p className="text-sm font-medium">
                      {(() => {
                        const name =
                          profileData?.name ||
                          user?.name ||
                          (user as any)?.firstName ||
                          "";
                        if (name) return name;

                        // Try to construct from form data
                        const fullName =
                          `${formData.firstName} ${formData.lastName}`.trim();
                        if (fullName) return fullName;

                        // Fallback to email if no name is available
                        const email = profileData?.email || user?.email || "";
                        return email ? `User (${email})` : "Not set";
                      })()}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Email</span>
                    </div>
                    <p className="text-sm font-medium">
                      {profileData?.email || user?.email}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Role</span>
                    </div>
                    <Badge
                      className={getRoleColor(
                        profileData?.role || user?.role || "client",
                      )}
                    >
                      {(profileData?.role || user?.role || "client")
                        .charAt(0)
                        .toUpperCase() +
                        (profileData?.role || user?.role || "client").slice(1)}
                    </Badge>
                  </div>

                  {(profileData?.clientId || user?.clientId) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Building className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            Client ID
                          </span>
                        </div>
                        <p className="text-sm font-medium">
                          {profileData?.clientId || user?.clientId}
                        </p>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">User ID</span>
                    </div>
                    <p className="text-sm font-mono text-gray-600">
                      {profileData?.id || user?.id}
                    </p>
                  </div>

                  {((profileData?.permissions &&
                    profileData.permissions.length > 0) ||
                    (user?.permissions && user.permissions.length > 0)) && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Shield className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            Permissions
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(profileData?.permissions || user?.permissions || [])
                            .slice(0, 3)
                            .map((permission) => (
                              <Badge
                                key={permission}
                                variant="secondary"
                                className="text-xs"
                              >
                                {permission}
                              </Badge>
                            ))}
                          {(profileData?.permissions || user?.permissions || [])
                            .length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +
                              {(
                                profileData?.permissions ||
                                user?.permissions ||
                                []
                              ).length - 3}{" "}
                              more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
