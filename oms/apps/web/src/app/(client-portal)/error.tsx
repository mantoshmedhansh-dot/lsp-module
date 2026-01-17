"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react";

export default function ClientPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Client Portal error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-2" />
          <CardTitle>Page Error</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {error.message || "An error occurred while loading this page."}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex gap-2 justify-center pt-4">
            <Button onClick={reset} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => window.history.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
          <Button
            onClick={() => window.location.href = "/client"}
            variant="ghost"
            className="w-full"
          >
            <Home className="h-4 w-4 mr-2" />
            Return to Portal Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
