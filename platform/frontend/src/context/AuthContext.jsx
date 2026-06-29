import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || 'Engineer',
          role: session.user.user_metadata?.role || 'member'
        });
        setOrganization({ name: session.user.user_metadata?.organization_name || 'KNCC Organization' });
      } else {
        setUser(null);
        setOrganization(null);
      }
      setLoading(false);
    });

    // Listen for changes on auth state (in, out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || 'Engineer',
          role: session.user.user_metadata?.role || 'member'
        });
        setOrganization({ name: session.user.user_metadata?.organization_name || 'KNCC Organization' });
      } else {
        setUser(null);
        setOrganization(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      throw error;
    }
  };

  const register = async (name, email, password, organization_name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          organization_name,
          role: 'admin' // First user could be admin, typically logic here is complex
        }
      }
    });

    if (error) {
      throw error;
    }
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const setupTestAccount = async (email, password, role, name) => {
    try {
      // Try login first
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // If it fails, sign up
        const { error: signUpError } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { name, organization_name: 'KNCC', role }
          }
        });
        if (signUpError) throw signUpError;
        // The user might need to confirm email depending on Supabase settings, 
        // but if auto-confirm is on, we can sign in.
        await supabase.auth.signInWithPassword({ email, password });
      }
    } catch (err) {
      console.error("Test account setup failed", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, organization, loading, login, register, logout, resetPassword, setupTestAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
