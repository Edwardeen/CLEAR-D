import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../../lib/dbConnect';
import Assessment from '../../../models/Assessment';
import { authOptions } from '../auth/[...nextauth]'; // Adjusted path further
import mongoose from 'mongoose';

interface WeeklyTrendData {
  _id: {
    year: number;
    week: number;
    type: string;
  };
  avgScore: number;
  count: number;
}

interface MonthlyTrendData {
  _id: {
    year: number;
    month: number;
    type: string;
  };
  avgScore: number;
  count: number;
}

// Interface for illness distribution data
interface IllnessDistributionData {
  _id: string; // This will be the illness type
  count: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    await dbConnect();

    // Determine the date range: last 52 weeks from the most recent assessment.
    // Or, if data is sparse, consider all data.
    // For now, let's get all weekly trends and let the frontend decide on display window if needed.

    const trends: WeeklyTrendData[] = await Assessment.aggregate([
      {
        $match: {
          type: { $in: ['glaucoma', 'cancer'] }, // Focus on main types, can be expanded
          totalScore: { $ne: null, $exists: true }, // Ensure totalScore is present
          createdAt: { $type: "date" } // Ensure createdAt is a BSON date type
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            week: { $isoWeek: '$createdAt' }, // Use $isoWeek for ISO 8601 week numbering
            type: '$type',
          },
          avgScore: { $avg: '$totalScore' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.week': 1,
          '_id.type': 1,
        },
      },
    ]);

    // Transform data for easier consumption by charting libraries
    // Create labels (Year-Week) and datasets for each type

    const labelsSetWeekly = new Set<string>();
    const datasetsWeeklyScores: { [key: string]: { label: string, data: (number|null)[], typeName: string } } = {};
    const datasetsWeeklyCounts: { [key: string]: { label: string, data: (number|null)[], typeName: string } } = {};

    // Find min/max year and week to create a continuous set of labels
    let minYearWeek = { year: Infinity, week: Infinity };
    let maxYearWeek = { year: 0, week: 0 };

    if (trends.length > 0) {
        trends.forEach(trend => {
            if (trend._id.year < minYearWeek.year || (trend._id.year === minYearWeek.year && trend._id.week < minYearWeek.week)) {
                minYearWeek = { year: trend._id.year, week: trend._id.week };
            }
            if (trend._id.year > maxYearWeek.year || (trend._id.year === maxYearWeek.year && trend._id.week > maxYearWeek.week)) {
                maxYearWeek = { year: trend._id.year, week: trend._id.week };
            }
        });

        // Generate all labels from minYearWeek to maxYearWeek
        let currentYearW = minYearWeek.year;
        let currentWeekW = minYearWeek.week;

        while(currentYearW < maxYearWeek.year || (currentYearW === maxYearWeek.year && currentWeekW <= maxYearWeek.week)) {
            labelsSetWeekly.add(`${currentYearW}-W${String(currentWeekW).padStart(2, '0')}`);
            currentWeekW++;
            if (currentWeekW > 53) { currentWeekW = 1; currentYearW++; }
        }
    }
    
    const sortedLabelsWeekly = Array.from(labelsSetWeekly).sort();

    trends.forEach((trend) => {
      const typeName = trend._id.type;
      // For Average Scores
      if (!datasetsWeeklyScores[typeName]) {
        datasetsWeeklyScores[typeName] = {
          label: `${typeName.charAt(0).toUpperCase() + typeName.slice(1)} Avg Score`,
          data: new Array(sortedLabelsWeekly.length).fill(null),
          typeName: typeName
        };
      }
      // For Counts
      if (!datasetsWeeklyCounts[typeName]) {
        datasetsWeeklyCounts[typeName] = {
          label: `${typeName.charAt(0).toUpperCase() + typeName.slice(1)} Assessments`,
          data: new Array(sortedLabelsWeekly.length).fill(null),
          typeName: typeName
        };
      }

      const label = `${trend._id.year}-W${String(trend._id.week).padStart(2, '0')}`;
      const labelIndex = sortedLabelsWeekly.indexOf(label);

      if (labelIndex !== -1) {
        if (datasetsWeeklyScores[typeName]) {
            datasetsWeeklyScores[typeName].data[labelIndex] = parseFloat(trend.avgScore.toFixed(2));
        }
        if (datasetsWeeklyCounts[typeName]) {
            datasetsWeeklyCounts[typeName].data[labelIndex] = trend.count;
        }
      }
    });

    // --- Aggregate Monthly Trends --- 
    const monthlyTrendsRaw: MonthlyTrendData[] = await Assessment.aggregate([
      {
        $match: {
          type: { $in: ['glaucoma', 'cancer'] },
          totalScore: { $ne: null, $exists: true },
          createdAt: { $type: "date" } 
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }, 
            type: '$type',
          },
          avgScore: { $avg: '$totalScore' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.type': 1,
        },
      },
    ]);

    // --- Process Monthly Trends ---
    const labelsSetMonthly = new Set<string>();
    const datasetsMonthlyScores: { [key: string]: { label: string, data: (number|null)[], typeName: string } } = {};
    const datasetsMonthlyCounts: { [key: string]: { label: string, data: (number|null)[], typeName: string } } = {};
    let minYearMonth = { year: Infinity, month: Infinity };
    let maxYearMonth = { year: 0, month: 0 };

    if (monthlyTrendsRaw.length > 0) {
        monthlyTrendsRaw.forEach(trend => {
            if (trend._id.year < minYearMonth.year || (trend._id.year === minYearMonth.year && trend._id.month < minYearMonth.month)) {
                minYearMonth = { year: trend._id.year, month: trend._id.month };
            }
            if (trend._id.year > maxYearMonth.year || (trend._id.year === maxYearMonth.year && trend._id.month > maxYearMonth.month)) {
                maxYearMonth = { year: trend._id.year, month: trend._id.month };
            }
        });
        
        let currentYearM = minYearMonth.year;
        let currentMonthM = minYearMonth.month;
        while(currentYearM < maxYearMonth.year || (currentYearM === maxYearMonth.year && currentMonthM <= maxYearMonth.month)) {
            labelsSetMonthly.add(`${currentYearM}-${String(currentMonthM).padStart(2, '0')}`);
            currentMonthM++;
            if (currentMonthM > 12) { currentMonthM = 1; currentYearM++; }
        }
    }
    const sortedLabelsMonthly = Array.from(labelsSetMonthly).sort();
    monthlyTrendsRaw.forEach((trend) => {
      const typeName = trend._id.type;
      // For Average Scores
      if (!datasetsMonthlyScores[typeName]) {
        datasetsMonthlyScores[typeName] = {
          label: `${typeName.charAt(0).toUpperCase() + typeName.slice(1)} Avg Score`,
          data: new Array(sortedLabelsMonthly.length).fill(null),
          typeName: typeName
        };
      }
      // For Counts
      if (!datasetsMonthlyCounts[typeName]) {
        datasetsMonthlyCounts[typeName] = {
          label: `${typeName.charAt(0).toUpperCase() + typeName.slice(1)} Assessments`,
          data: new Array(sortedLabelsMonthly.length).fill(null),
          typeName: typeName
        };
      }
      const label = `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`;
      const labelIndex = sortedLabelsMonthly.indexOf(label);

      if (labelIndex !== -1) {
        if (datasetsMonthlyScores[typeName]) {
            datasetsMonthlyScores[typeName].data[labelIndex] = parseFloat(trend.avgScore.toFixed(2));
        }
        if (datasetsMonthlyCounts[typeName]) {
            datasetsMonthlyCounts[typeName].data[labelIndex] = trend.count;
        }
      }
    });

    // +++ Aggregate Illness Distribution +++
    const illnessDistribution: IllnessDistributionData[] = await Assessment.aggregate([
      {
        $match: {
          // Optional: Add filters if needed, e.g., specific date range or other criteria
          // For now, let's count all assessments with a valid type and createdAt date
          type: { $ne: null, $exists: true },
          createdAt: { $type: "date" } 
        }
      },
      {
        $group: {
          _id: '$type', // Group by the illness type
          count: { $sum: 1 }, // Count occurrences of each type
        },
      },
      {
        $sort: {
          count: -1, // Sort by count descending, or _id: 1 for alphabetical by type
        },
      },
    ]);

    // Process illness distribution data for the chart
    const distributionLabels = illnessDistribution.map(item => 
        item._id.charAt(0).toUpperCase() + item._id.slice(1) // Capitalize type for display
    );
    const distributionData = illnessDistribution.map(item => item.count);

    res.status(200).json({
      weeklyTrends: {
        labels: sortedLabelsWeekly,
        scoreDatasets: Object.values(datasetsWeeklyScores),
        countDatasets: Object.values(datasetsWeeklyCounts),
      },
      monthlyTrends: {
        labels: sortedLabelsMonthly,
        scoreDatasets: Object.values(datasetsMonthlyScores),
        countDatasets: Object.values(datasetsMonthlyCounts),
      },
      illnessDistribution: {
        labels: distributionLabels,
        datasets: [{
          label: 'Assessment Count by Type',
          data: distributionData,
          // backgroundColor: Could be a predefined color array or dynamically generated
          // borderColor: Similarly for borders
        }]
      }
    });

  } catch (error) {
    console.error('Error fetching assessment trends:', error);
    if (error instanceof mongoose.Error) {
        return res.status(500).json({ message: 'Database error fetching trends.', details: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error fetching trends.' });
  }
} 