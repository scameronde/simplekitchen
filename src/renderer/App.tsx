import React from 'react';

function App() {
  const { platform, versions } = window.electron;

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>SimpleKitchen</h1>
      <p>Intelligent cooking companion for just-in-time dinner decision support</p>

      <div style={{ marginTop: '2rem', opacity: 0.7, fontSize: '0.9rem' }}>
        <p>Platform: {platform}</p>
        <p>Electron: {versions.electron}</p>
        <p>Node: {versions.node}</p>
        <p>Chrome: {versions.chrome}</p>
      </div>

      <p style={{ marginTop: '2rem', fontStyle: 'italic' }}>
        Phase 0 scaffold complete. Recipe management features coming in Phase 1-6.
      </p>
    </div>
  );
}

export default App;
