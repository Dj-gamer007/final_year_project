import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import Meeting from "./pages/Meeting";
import MeetingDemo from "./pages/MeetingDemo";
import SetupMeeting from "./pages/SetupMeeting";
import JoinMeeting from "./pages/JoinMeeting";
import NotFound from "./pages/NotFound";
import { FirebaseAuthProvider } from "@/components/FirebaseAuthProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <FirebaseAuthProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/meeting" element={<ProtectedRoute><Meeting /></ProtectedRoute>} />
              <Route path="/setup" element={<ProtectedRoute><SetupMeeting /></ProtectedRoute>} />
              <Route path="/join" element={<ProtectedRoute><JoinMeeting /></ProtectedRoute>} />
              <Route path="/meeting-demo" element={<ProtectedRoute><MeetingDemo /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </FirebaseAuthProvider>
  </QueryClientProvider>
);

export default App;
