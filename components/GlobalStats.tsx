import React, { useEffect, useState } from 'react';

interface GlobalStats {
  totalAssessments: number;
  averageGlaucomaScore: number;
  averageCancerScore: number;
}

const GlobalStats: React.FC = () => {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/global-average-stats');
        if (!response.ok) {
          if (response.status === 401) {
            setError('You do not have permission to view global statistics.');
          } else {
            setError('Failed to fetch global statistics');
          }
          setLoading(false);
          return;
        }
        const data = await response.json();
        setStats({
          totalAssessments: data.totalAssessments,
          averageGlaucomaScore: data.averageGlaucomaScore,
          averageCancerScore: data.averageCancerScore
        });
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching global stats:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 text-center">
        <p className="text-gray-500">Loading global statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null; // Hide component if no stats available
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-3 text-center">Global Risk Assessment Statistics</h2>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded p-3 text-center">
          <p className="text-sm text-gray-600">Total Assessments</p>
          <p className="text-xl font-bold text-blue-600">{stats.totalAssessments}</p>
        </div>
        <div className="bg-green-50 rounded p-3 text-center">
          <p className="text-sm text-gray-600">Avg Glaucoma Score</p>
          <p className="text-xl font-bold text-green-600">{stats.averageGlaucomaScore}/10</p>
        </div>
        <div className="bg-purple-50 rounded p-3 text-center">
          <p className="text-sm text-gray-600">Avg Cancer Score</p>
          <p className="text-xl font-bold text-purple-600">{stats.averageCancerScore}/10</p>
        </div>
      </div>
    </div>
  );
};

export default GlobalStats; 