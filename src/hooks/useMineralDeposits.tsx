import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface MineralDeposit {
  id: string;
  site_id: string;
  mineral_type: string;
  grade_estimate: number;
  tonnage_estimate: number;
  confidence_level: number;
  discovery_date: string;
  geochemistry_data: any;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMineralDepositData {
  site_id: string;
  mineral_type: string;
  grade_estimate?: number;
  tonnage_estimate?: number;
  confidence_level?: number;
  discovery_date?: string;
  geochemistry_data?: any;
  notes?: string;
}

export interface UpdateMineralDepositData {
  id: string;
  mineral_type?: string;
  grade_estimate?: number;
  tonnage_estimate?: number;
  confidence_level?: number;
  discovery_date?: string;
  geochemistry_data?: any;
  notes?: string;
}

export const useMineralDeposits = (siteId?: string) => {
  const [deposits, setDeposits] = useState<MineralDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('mineral_deposits')
        .select('*')
        .order('created_at', { ascending: false });

      if (siteId) {
        query = query.eq('site_id', siteId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDeposits(data || []);
    } catch (error) {
      console.error('Error fetching mineral deposits:', error);
      toast({
        title: "Error",
        description: "Failed to fetch mineral deposits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createDeposit = async (depositData: CreateMineralDepositData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('mineral_deposits')
        .insert([{ ...depositData, created_by: user.id }])
        .select()
        .single();

      if (error) throw error;

      setDeposits(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Mineral deposit created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error creating mineral deposit:', error);
      toast({
        title: "Error",
        description: "Failed to create mineral deposit",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateDeposit = async (depositData: UpdateMineralDepositData) => {
    try {
      const { id, ...updateData } = depositData;
      const { data, error } = await supabase
        .from('mineral_deposits')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setDeposits(prev => prev.map(deposit => 
        deposit.id === id ? data : deposit
      ));
      toast({
        title: "Success",
        description: "Mineral deposit updated successfully",
      });
      return data;
    } catch (error) {
      console.error('Error updating mineral deposit:', error);
      toast({
        title: "Error",
        description: "Failed to update mineral deposit",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getDepositStats = () => {
    const totalDeposits = deposits.length;
    const mineralTypes = [...new Set(deposits.map(d => d.mineral_type))];
    const avgConfidence = deposits.length > 0
      ? deposits.reduce((acc, d) => acc + (d.confidence_level || 0), 0) / deposits.length
      : 0;
    const totalTonnage = deposits.reduce((acc, d) => acc + (d.tonnage_estimate || 0), 0);

    return {
      totalDeposits,
      mineralTypesCount: mineralTypes.length,
      mineralTypes,
      avgConfidence: Number(avgConfidence.toFixed(1)),
      totalTonnage: Number(totalTonnage.toFixed(2))
    };
  };

  const getDepositsByMineralType = () => {
    const depositsByType: Record<string, MineralDeposit[]> = {};
    deposits.forEach(deposit => {
      if (!depositsByType[deposit.mineral_type]) {
        depositsByType[deposit.mineral_type] = [];
      }
      depositsByType[deposit.mineral_type].push(deposit);
    });
    return depositsByType;
  };

  const getHighValueDeposits = (minConfidence = 80) => {
    return deposits.filter(d => (d.confidence_level || 0) >= minConfidence);
  };

  useEffect(() => {
    fetchDeposits();
  }, [siteId]);

  return {
    deposits,
    loading,
    createDeposit,
    updateDeposit,
    getDepositStats,
    getDepositsByMineralType,
    getHighValueDeposits,
    refetch: fetchDeposits
  };
};