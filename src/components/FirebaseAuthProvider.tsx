import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const FirebaseAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If auth is not initialized (missing config), stop loading immediately
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Display a helpful error if Firebase or Supabase configuration is missing (common on deployment)
  const isMissingConfig = !auth || !supabase;

  if (isMissingConfig && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Configuration Required</h1>
        <p className="text-muted-foreground max-w-md mb-4">
          The following services are not configured correctly:
        </p>
        <div className="bg-muted p-4 rounded-lg mb-8 space-y-2 text-sm font-mono">
          {!auth && <p className="text-destructive">❌ Firebase (Missing API Key)</p>}
          {!supabase && <p className="text-destructive">❌ Supabase (Missing URL)</p>}
        </div>
        <p className="text-sm text-muted-foreground max-w-md mb-8">
          Please add your environment variables (VITE_FIREBASE_* and VITE_SUPABASE_*) to your **GitHub Repository Settings &gt; Secrets &gt; Actions** and trigger a new build.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useFirebaseAuth = () => useContext(AuthContext);
