import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { IAssessment } from '../models/Assessment';

// Define interface for populated assessments from doctor dashboard
interface PopulatedUser {
  _id: string;
  name: string;
  email: string;
}

interface PopulatedAssessment extends Omit<IAssessment, 'userId' | 'timestamp'> {
  _id: string;
  userId: PopulatedUser | null;
  timestamp: string | Date;
}

// Interface for global weekly average data
interface WeeklyAverage {
  week: string;
  avgGlaucomaScore: number;
  avgCancerScore: number;
  count: number;
}

interface AssessmentLineChartProps {
  assessments: (IAssessment | PopulatedAssessment)[];
  globalData?: WeeklyAverage[];
  showGlobal?: boolean;
  height?: number;
  width?: number;
  title?: string;
}

const AssessmentLineChart: React.FC<AssessmentLineChartProps> = ({ 
  assessments, 
  globalData = [],
  showGlobal = false,
  height = 300, 
  width = 600,
  title = 'Risk Score Trend Over Time'
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if ((!assessments.length && !globalData.length) || !chartRef.current) return;

    // Sort assessments by timestamp in ascending order
    const sortedAssessments = [...assessments].sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateA - dateB;
    });

    // Extract dates and scores for personal data
    const personalLabels = sortedAssessments.map(assessment => {
      const date = new Date(assessment.timestamp);
      return date.toLocaleDateString();
    });
    
    const personalGlaucomaScores = sortedAssessments.map(assessment => assessment.glaucomaScore);
    const personalCancerScores = sortedAssessments.map(assessment => assessment.cancerScore);

    // Prepare global data if available
    const globalLabels = globalData.map(week => `Week ${week.week.split('-')[1]}, ${week.week.split('-')[0]}`);
    const globalGlaucomaScores = globalData.map(week => week.avgGlaucomaScore);
    const globalCancerScores = globalData.map(week => week.avgCancerScore);
    
    // Determine which datasets to show
    const datasets = [];
    
    // Always add personal datasets if we have assessment data
    if (assessments.length > 0) {
      datasets.push(
        {
          label: 'Your Glaucoma Score',
          data: personalGlaucomaScores,
          borderColor: 'rgb(74, 222, 128)', // green
          backgroundColor: 'rgba(74, 222, 128, 0.2)',
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(74, 222, 128)',
        },
        {
          label: 'Your Cancer Score',
          data: personalCancerScores,
          borderColor: 'rgb(192, 132, 252)', // purple
          backgroundColor: 'rgba(192, 132, 252, 0.2)',
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(192, 132, 252)',
        }
      );
    }
    
    // Add global datasets if showing global data
    if (showGlobal && globalData.length > 0) {
      datasets.push(
        {
          label: 'Global Avg Glaucoma Score',
          data: globalGlaucomaScores,
          borderColor: 'rgb(34, 197, 94)', // darker green
          backgroundColor: 'rgba(34, 197, 94, 0.05)',
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 3,
          pointStyle: 'triangle',
          pointBackgroundColor: 'rgb(34, 197, 94)',
        },
        {
          label: 'Global Avg Cancer Score',
          data: globalCancerScores,
          borderColor: 'rgb(147, 51, 234)', // darker purple
          backgroundColor: 'rgba(147, 51, 234, 0.05)',
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 3,
          pointStyle: 'triangle',
          pointBackgroundColor: 'rgb(147, 51, 234)',
        }
      );
    }

    // Choose which labels to display (if showing global data only, use global labels)
    const labels = assessments.length > 0 ? personalLabels : globalLabels;
    
    // Destroy existing chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Create new chart
    const ctx = chartRef.current?.getContext('2d');
    if (ctx) {
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 10,
              title: {
                display: true,
                text: 'Risk Score (0-10)'
              }
            },
            x: {
              title: {
                display: true,
                text: assessments.length > 0 ? 'Assessment Date' : 'Weekly Average'
              }
            }
          },
          plugins: {
            tooltip: {
              mode: 'index',
              intersect: false,
            },
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: title
            }
          }
        }
      });
    }

    // Cleanup
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [assessments, globalData, showGlobal, title]);

  return (
    <div className="relative w-full h-72 bg-white p-2 sm:p-4 rounded-lg shadow-md">
      <canvas ref={chartRef} />
    </div>
  );
};

export default AssessmentLineChart; 