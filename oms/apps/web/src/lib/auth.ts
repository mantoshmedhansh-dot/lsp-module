import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lsp-oms-api.onrender.com';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

interface AuthResponse {
  token: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId: string | null;
    companyName?: string | null;
    companyCode?: string | null;
    locationAccess: string[];
    isActive: boolean;
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Required for production on Vercel
  trustHost: true,

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const parsed = loginSchema.safeParse(credentials);

          if (!parsed.success) {
            console.log("[Auth] Invalid credentials format");
            return null;
          }

          const { email, password } = parsed.data;

          // Authenticate via FastAPI backend
          const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.log("[Auth] Authentication failed:", error.detail || 'Unknown error');
            return null;
          }

          const data: AuthResponse = await response.json();

          if (!data.user || !data.user.isActive) {
            console.log("[Auth] User not found or inactive:", email);
            return null;
          }

          console.log("[Auth] Login successful:", email, "Role:", data.user.role);

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            companyId: data.user.companyId,
            companyName: data.user.companyName,
            companyCode: data.user.companyCode,
            locationAccess: data.user.locationAccess,
          };
        } catch (error) {
          console.error("[Auth] Error during authorization:", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign in, add user data to token
      if (user && user.id) {
        token.id = user.id;
        token.role = user.role;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
        token.companyCode = user.companyCode;
        token.locationAccess = user.locationAccess;
        console.log("[Auth] JWT callback - setting token with role:", user.role);
      }
      return token;
    },
    async session({ session, token }) {
      // Pass token data to session
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.companyId = token.companyId as string | null;
        session.user.companyName = token.companyName as string | null;
        session.user.companyCode = token.companyCode as string | null;
        session.user.locationAccess = token.locationAccess as string[];
      }
      return session;
    },
    async authorized({ auth, request }) {
      // Allow access to public pages without authentication
      const { pathname } = request.nextUrl;
      const isPublicPage =
        pathname === "/login" ||
        pathname === "/signup" ||
        pathname.startsWith("/api/auth");

      if (isPublicPage) {
        return true;
      }

      // Require authentication for all other pages
      return !!auth;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  // Use AUTH_SECRET (NextAuth v5 standard) with fallback to NEXTAUTH_SECRET
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});
