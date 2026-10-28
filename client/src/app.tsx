import React from 'react';
import { Route, Routes } from 'react-router-dom';

// This is a temporary placeholder component from spark-framework
import Layout from './components/Layout';
import RsipPage from './pages/RsipPage/RsipPage';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import FocusPage from './pages/FocusPage/FocusPage';
import NotFound from './pages/NotFound/NotFound';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<RsipPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="focus" element={<FocusPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
