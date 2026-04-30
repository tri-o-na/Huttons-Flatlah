import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import Map from './pages/Map';
import TownAnalytics from './pages/TownAnalytics';
import Comparison from './pages/Comparison';
import PropertyDetail from './pages/PropertyDetail';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="map" element={<Map />} />
        <Route path="towns" element={<TownAnalytics />} />
        <Route path="comparison" element={<Comparison />} />
        <Route path="property/:town/:street/:block" element={<PropertyDetail />} />
      </Route>
    </Routes>
  );
}

export default App;

