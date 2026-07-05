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
        setUser(prev => {
          if (prev && prev.id === session.user.id) return prev;
          return {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || 'Engineer',
            role: session.user.user_metadata?.role || 'member'
          };
        });
        setOrganization(prev => {
          const newOrgName = session.user.user_metadata?.organization_name || 'KNCC Organization';
          if (prev && prev.name === newOrgName) return prev;
          return { name: newOrgName };
        });
      } else {
        setUser(null);
        setOrganization(null);
      }
      setLoading(false);
    });

    // Listen for changes on auth state (in, out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(prev => {
          if (prev && prev.id === session.user.id) return prev;
          return {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || 'Engineer',
            role: session.user.user_metadata?.role || 'member'
          };
        });
        setOrganization(prev => {
          const newOrgName = session.user.user_metadata?.organization_name || 'KNCC Organization';
          if (prev && prev.name === newOrgName) return prev;
          return { name: newOrgName };
        });
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
    localStorage.removeItem('kncc_demo_user');
    await supabase.auth.signOut();
    setUser(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider value={{ user, organization, loading, login, register, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
