"use client";

import dynamic from 'next/dynamic';

// Dynamically import the Terrain component
const Terrain = dynamic(() => import('./background'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: 'rgb(8, 0, 36)',
      }}
    />
  ),
});

export default Terrain;
