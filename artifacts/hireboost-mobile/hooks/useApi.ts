import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "@tanstack/react-query";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const TOKEN_KEY = "hireboost_auth_token";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Resume rewrite status
export function useRewriteStatus() {
  return useQuery({
    queryKey: ["rewrite-status"],
    queryFn: () =>
      apiFetch<{ freeUsed: number; freeLimit: number; hasPaidCredit: boolean }>(
        "/api/resume/rewrite-status"
      ),
  });
}

// Parse file (multipart)
export function useParseFile() {
  return useMutation({
    mutationFn: async (formData: FormData) =>
      apiFetch<{ text: string; wordCount: number }>("/api/resume/parse-file", {
        method: "POST",
        body: formData,
      }),
  });
}

// Resume rewrite
export function useResumeRewrite() {
  return useMutation({
    mutationFn: (body: { resumeText: string; analysisId: number }) =>
      apiFetch<{ rewrittenText: string; message?: string }>("/api/resume/rewrite", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

// Payment: create order
export function useCreateOrder() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ orderId: string; amount: number; currency: string; key: string }>(
        "/api/payment/create-order",
        { method: "POST" }
      ),
  });
}

// Payment: verify
export function useVerifyPayment() {
  return useMutation({
    mutationFn: (body: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) =>
      apiFetch<{ message: string }>("/api/payment/verify", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

// JD Prep
export function useJdPrep() {
  return useMutation({
    mutationFn: (body: { jobDescription: string }) =>
      apiFetch<{
        roleInsights: {
          title: string;
          seniority: string;
          keySkills: string[];
          responsibilities: string[];
        };
        questions: Array<{
          question: string;
          modelAnswer: string;
          tip: string;
          category: string;
        }>;
      }>("/api/interview/jd-prep", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

// LinkedIn generate
export function useLinkedInGenerate() {
  return useMutation({
    mutationFn: (body: { topic: string; tone: string }) =>
      apiFetch<{ hook: string; body: string; hashtags: string[] }>(
        "/api/linkedin/generate",
        { method: "POST", body: JSON.stringify(body) }
      ),
  });
}

// LinkedIn make viral
export function useLinkedInMakeViral() {
  return useMutation({
    mutationFn: (body: { post: string }) =>
      apiFetch<{ hook: string; body: string; hashtags: string[] }>(
        "/api/linkedin/make-viral",
        { method: "POST", body: JSON.stringify(body) }
      ),
  });
}

// Salary generate
export function useSalaryGenerate() {
  return useMutation({
    mutationFn: (body: {
      jobRole: string;
      experience: number;
      currentCtc: number;
      offeredCtc: number;
      location?: string;
    }) =>
      apiFetch<{
        counterOffer: number;
        marketInsights: string[];
        negotiationTips: string[];
        verbalScript: string;
        emailTemplate: string;
      }>("/api/salary/generate", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
