# Data Migration Guide

This document explains how to run the data migration script to convert old assessment formats to the new standardized format.

## Background

The application has two different data formats for assessments:

1. **Old Format**: Used individual properties like `glaucomaScore` and `cancerScore` directly on the assessment document, with a single `recommendation` field.

2. **New Format**: Uses standardized `responses` array, `totalScore` field, and `recommendations` array (plural).

This migration script converts old format assessments to the new format to ensure consistency.

## Running the Migration

1. Make sure your `.env.local` file is correctly set up with the MongoDB connection string:

```
MONGODB_URI=mongodb+srv://username:password@yourcluster.mongodb.net/yourdatabase
```

2. Run the migration script:

```bash
# Option 1: Run directly
node scripts/seed-data.js

# Option 2: Run using the helper script (recommended)
node scripts/run-seed.js
```

3. The script will output progress as it migrates each assessment and will indicate when the process is complete.

## How the Migration Works

The script performs the following steps:

1. Connects to your MongoDB database
2. Finds all assessments with old format properties but missing the new format arrays
3. Converts each assessment:
   - Maps `glaucomaScore` or `cancerScore` to `totalScore`
   - Converts single `recommendation` to `recommendations` array
   - Removes old format properties
4. Updates the database with the new format

## After Migration

After running the migration, all assessments will follow the new format, which will make the application work consistently with all data.

## Troubleshooting

If you encounter issues:

1. Check your MongoDB connection string
2. Ensure you have proper access rights to the database
3. Check the console output for specific error messages
4. For large databases, consider increasing the Node.js memory limit by modifying the `--max-old-space-size` parameter in `run-seed.js` 