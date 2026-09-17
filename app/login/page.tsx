'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { SiteBrandName } from "@/components/SiteBrandName";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('from') || '/';

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        setLoading(false);
        return;
      }

      // Store session expiration timestamp
      if (data.expiresAt) {
        sessionStorage.setItem('dash_expires_at', String(data.expiresAt));
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2.5 text-destructive text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs font-medium">
          Master Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            className="pr-10 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !password}
        className="w-full gap-2 font-medium"
      >
        {loading ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            Authenticating...
          </>
        ) : (
          <>
            Unlock Dashboard
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Lock className="w-6 h-6" />
          </div>
          <SiteBrandName className="font-bold text-xl tracking-tight" />
          <p className="text-xs text-muted-foreground">Admin Authentication</p>
        </div>

        {/* Login Card */}
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-xl font-bold">Dashboard Access</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Enter your master password to access the administrative dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Suspense fallback={<div className="text-center py-4 text-xs text-muted-foreground">Loading login form...</div>}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
