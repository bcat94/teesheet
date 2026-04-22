'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestPage() {
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    supabase.from('rounds').select('count').then(({ error }) => {
      setStatus(error ? `Error: ${error.message}` : '✅ Connected to Supabase!');
    });
  }, []);

  return <main className="p-8 text-lg">{status}</main>;
}