import React from 'react';
import TestChart from '../components/TestChart';

const TestChartPage = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Chart Testing Page</h1>
      <p className="mb-4">
        This page tests chart rendering with simple, static data to isolate any chart display issues.
      </p>
      
      <div className="mb-8">
        <TestChart />
      </div>
      
      <div className="bg-blue-50 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Debugging Information</h2>
        <p>
          This page uses a simple test chart component with hard-coded data.
          If this chart renders correctly but other charts in the application don`&apos;`t,
          the issue is likely related to data formatting rather than chart configuration.
        </p>
      </div>
    </div>
  );
};

export default TestChartPage; 