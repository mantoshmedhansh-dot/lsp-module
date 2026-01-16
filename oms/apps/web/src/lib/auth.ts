import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@oms/database";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

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

          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              Company: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          });

          if (!user || !user.isActive) {
            console.log("[Auth] User not found or inactive:", email);
            return null;
          }

          const passwordMatch = await bcrypt.compare(password, user.password);

          if (!passwordMatch) {
            console.log("[Auth] Password mismatch for:", email);
            return null;
          }

          // Update last login
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          console.log("[Auth] Login successful:", email, "Role:", user.role);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId,
            companyName: user.Company?.name ?? null,
            companyCode: user.Company?.code ?? null,
            locationAccess: user.locationAccess,
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
      // Allow access to login page without authentication
      const isLoginPage = request.nextUrl.pathname === "/login";
      const isApiAuth = request.nextUrl.pathname.startsWith("/api/auth");

      if (isLoginPage || isApiAuth) {
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
