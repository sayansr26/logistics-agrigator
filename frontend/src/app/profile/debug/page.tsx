"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authApiService, userApiService } from "@/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ProfileDebugPage() {
  const { user, accessToken, isAuthenticated } = useAuth();
  const [authResponse, setAuthResponse] = useState<any>(null);
  const [userResponse, setUserResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testAuthAPI = async () => {
    if (!accessToken) {
      setError("No access token available");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      authApiService.setAccessToken(accessToken);
      const response = await authApiService.getUserProfile();
      setAuthResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth API failed");
    } finally {
      setIsLoading(false);
    }
  };

  const testUserAPI = async () => {
    if (!accessToken) {
      setError("No access token available");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      userApiService.setAccessToken(accessToken);
      const response = await userApiService.getMyProfile();
      setUserResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "User API failed");
    } finally {
      setIsLoading(false);
    }
  };

  const testBothAPIs = async () => {
    await testAuthAPI();
    await testUserAPI();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Profile API Debug
          </h1>
          <p className="text-gray-600 mt-1">Test API endpoints directly</p>
        </div>

        {/* Authentication Status */}
        <Card>
          <CardHeader>
            <CardTitle>Authentication Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>
                <strong>Authenticated:</strong> {isAuthenticated ? "Yes" : "No"}
              </p>
              <p>
                <strong>User:</strong>{" "}
                {user ? JSON.stringify(user, null, 2) : "None"}
              </p>
              <p>
                <strong>Access Token:</strong>{" "}
                {accessToken ? `${accessToken.substring(0, 20)}...` : "None"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Test Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>API Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <Button onClick={testAuthAPI} disabled={isLoading}>
                Test Auth API
              </Button>
              <Button onClick={testUserAPI} disabled={isLoading}>
                Test User API
              </Button>
              <Button onClick={testBothAPIs} disabled={isLoading}>
                Test Both APIs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Auth API Response */}
        {authResponse && (
          <Card>
            <CardHeader>
              <CardTitle>Auth API Response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
                {JSON.stringify(authResponse, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* User API Response */}
        {userResponse && (
          <Card>
            <CardHeader>
              <CardTitle>User API Response</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
                {JSON.stringify(userResponse, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
