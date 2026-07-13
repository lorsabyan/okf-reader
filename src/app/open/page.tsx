import type { Metadata } from 'next';
import OpenViewer from '@/components/open/OpenViewer';

export const metadata: Metadata = {
  title: 'Open a bundle — OKF Reader',
  description: 'Browse a local directory or public GitHub repo as an OKF bundle, entirely in your browser.',
};

export default function OpenPage() {
  return <OpenViewer />;
}
