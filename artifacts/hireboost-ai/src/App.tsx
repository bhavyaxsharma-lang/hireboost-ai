import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, ProtectedRoute } from "@/components/auth-provider";
import { Layout } from "@/components/layout";

// Pages
import Home from "@/pages/home";
import Auth from "@/pages/auth";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import JDPrep from "@/pages/jd-prep";
import Dashboard from "@/pages/dashboard";
import ResumeAnalyzer from "@/pages/resume";
import InterviewHub from "@/pages/interview-hub";
import InterviewSession from "@/pages/interview-session";
import History from "@/pages/history";

import SalaryNegotiation from "@/pages/salary";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Layout>
          <Home />
        </Layout>
      </Route>
      <Route path="/auth">
        <Layout>
          <Auth />
        </Layout>
      </Route>

      <Route path="/forgot-password">
        <Layout>
          <ForgotPassword />
        </Layout>
      </Route>

      <Route path="/reset-password">
        <Layout>
          <ResetPassword />
        </Layout>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/resume">
        <ProtectedRoute>
          <Layout>
            <ResumeAnalyzer />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/interview">
        <ProtectedRoute>
          <Layout>
            <InterviewHub />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/jd-prep">
        <ProtectedRoute>
          <Layout>
            <JDPrep />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/interview/:id">
        <ProtectedRoute>
          <Layout>
            <InterviewSession />
          </Layout>
        </ProtectedRoute>
      </Route>

   

      <Route path="/salary">
        <ProtectedRoute>
          <Layout>
            <SalaryNegotiation />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/history">
        <ProtectedRoute>
          <Layout>
            <History />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route>
        <Layout>
          <NotFound />
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="hireboost-theme">
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
