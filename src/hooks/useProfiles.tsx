import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  department: string | null;
  company: string | null;
  role: 'admin' | 'geologist' | 'driller' | 'qa_qc' | 'executive' | 'field_tech';
  created_at: string;
  updated_at: string;
}

interface CreateProfileData {
  display_name?: string;
  phone?: string;
  department?: string;
  company?: string;
}

interface UpdateProfileData extends CreateProfileData {
  id: string;
}

export const useProfiles = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile');
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (profileData: CreateProfileData) => {
    if (!user) throw new Error('No authenticated user');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
          user_id: user.id,
          ...profileData
        }])
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      toast.success('Profile created successfully');
      return data;
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
      throw error;
    }
  };

  const updateProfile = async (profileData: UpdateProfileData) => {
    if (!user) throw new Error('No authenticated user');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', profileData.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      toast.success('Profile updated successfully');
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
      throw error;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  return {
    profile,
    loading,
    createProfile,
    updateProfile,
    refetch: fetchProfile
  };
};