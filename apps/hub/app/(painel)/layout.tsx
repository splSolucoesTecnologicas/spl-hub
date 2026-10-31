'use client';

import { ProvedorSessao } from '@/lib/auth';
import { Shell } from '@/components/Shell';

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <ProvedorSessao><Shell>{children}</Shell></ProvedorSessao>;
}
