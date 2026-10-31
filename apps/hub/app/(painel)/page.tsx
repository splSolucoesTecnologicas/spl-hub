'use client';

import { Suspense } from 'react';
import { Inicio } from '@/components/Inicio';

export default function Page() {
  return <Suspense fallback={<p className="pagina">Carregando radar…</p>}><Inicio /></Suspense>;
}
