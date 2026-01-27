import { useState } from 'react';
import ChatWindow from './components/ChatWindow.jsx';
import DropZone from './components/DropZone.jsx';
import './App.css';

function App() {
  const [hasData, setHasData] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  const handleDataLoaded = (count) => {
    setRowCount(count);
    setHasData(true);
  };

  return (
    <div className="app-container">
      {!hasData ? (
        <DropZone onDataLoaded={handleDataLoaded} />
      ) : (
        <ChatWindow rowCount={rowCount} />
      )}
    </div>
  );
}

export default App;
