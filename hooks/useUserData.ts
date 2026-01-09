'use client';
import { useState, useEffect, useCallback } from 'react';

type UserData = {
  SystemUserID: number;
  UserName: string;
  UserTypeID: number;
  UserType: string;
  FirstName: string;
  LastName: string;
  MiddleName: string;
  Email: string;
};

type UserType = {
  UserTypeID: number;
  Type: string;
};

export const useUserData = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserTypes = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/catalogs/user-types');
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setUserTypes(data);
    } catch (error) {
      console.error('Error fetching user types:', error);
      setError('Error al cargar tipos de usuario');
      return Promise.reject(error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/system-admin-dashboard/crud-users/get-post');
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setUsers(data);
      return data;
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Error al cargar usuarios');
      return Promise.reject(error);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    if (dataLoading) return;
    
    setDataLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchUsers(),
        fetchUserTypes()
      ]);
    } catch (error) {
      console.error('Error loading all data:', error);
    } finally {
      setDataLoading(false);
    }
  }, [fetchUsers, fetchUserTypes, dataLoading]);

  // Cargar datos iniciales
  useEffect(() => {
    loadAllData();
  }, []);

  const refreshData = useCallback(async () => {
    return loadAllData();
  }, [loadAllData]);

  return {
    users,
    userTypes,
    dataLoading,
    error,
    fetchUserTypes,
    fetchUsers,
    loadAllData,
    refreshData,
    setUsers
  };
};