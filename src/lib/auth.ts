import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { createServerClient } from '@/lib/supabase';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const supabase = createServerClient();
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('email', credentials.email as string)
          .single();

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      // For Google sign-in, create or link user in our users table
      if (account?.provider === 'google' && user.email) {
        const supabase = createServerClient();
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();

        if (!existing) {
          // Create new user for Google sign-in
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              name: user.name,
              email: user.email,
              image: user.image,
            })
            .select('id')
            .single();
          if (newUser) user.id = newUser.id;
        } else {
          user.id = existing.id;
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
