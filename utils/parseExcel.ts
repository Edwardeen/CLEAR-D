import * as XLSX from 'xlsx';
import { IFormData } from '../models/Assessment';

// Define the expected structure of the Excel row data
interface ExcelRow {
  ElevatedIOP?: string | boolean; // Allow string "Yes"/"No" or boolean true/false
  FamilyHistoryGlaucoma?: string | boolean;
  SuddenEyePain?: string | boolean;
  EthnicityRisk?: string | boolean;
  AgeOver40?: string | boolean;
  SteroidUse?: string | boolean;
  Diabetes?: string | boolean; // Shared
  EyeInjury?: string | boolean;
  PoorVision?: string | boolean;
  HalosOrTunnelVision?: string | boolean;
  UnexplainedWeightLoss?: string | boolean;
  FamilyHistoryCancer?: string | boolean;
  TobaccoOrAlcohol?: string | boolean;
  HighRiskEnvironment?: string | boolean;
  RegularScreening?: string | boolean;
  // Add other columns if necessary
}

// Function to normalize boolean values (handles "Yes"/"No", true/false, 1/0)
const normalizeBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowerVal = value.toLowerCase().trim();
    return lowerVal === 'yes' || lowerVal === 'true' || lowerVal === '1';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false; // Default to false if unrecognized
};

export const parseExcel = (file: File): Promise<Partial<IFormData>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) {
          throw new Error('File reading failed.');
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'data');

        if (!sheetName) {
          throw new Error("Sheet named 'Data' not found.");
        }

        const worksheet = workbook.Sheets[sheetName];
        // Use { header: 1 } to get arrays of rows, then process the header manually
        // Or use sheet_to_json with a transformer if headers are consistent
        const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

        if (jsonData.length === 0) {
          throw new Error("No data found in the 'Data' sheet.");
        }

        const firstRow = jsonData[0];

        // Map Excel data to IFormData structure, normalizing boolean values
        const formData: Partial<IFormData> = {
          elevatedIOP: normalizeBoolean(firstRow.ElevatedIOP),
          familyHistoryGlaucoma: normalizeBoolean(firstRow.FamilyHistoryGlaucoma),
          suddenEyePain: normalizeBoolean(firstRow.SuddenEyePain),
          ethnicityRisk: normalizeBoolean(firstRow.EthnicityRisk),
          ageOver40: normalizeBoolean(firstRow.AgeOver40),
          steroidUse: normalizeBoolean(firstRow.SteroidUse),
          diabetes: normalizeBoolean(firstRow.Diabetes),
          eyeInjury: normalizeBoolean(firstRow.EyeInjury),
          poorVision: normalizeBoolean(firstRow.PoorVision),
          halosOrTunnelVision: normalizeBoolean(firstRow.HalosOrTunnelVision),
          unexplainedWeightLoss: normalizeBoolean(firstRow.UnexplainedWeightLoss),
          familyHistoryCancer: normalizeBoolean(firstRow.FamilyHistoryCancer),
          tobaccoOrAlcohol: normalizeBoolean(firstRow.TobaccoOrAlcohol),
          highRiskEnvironment: normalizeBoolean(firstRow.HighRiskEnvironment),
          regularScreening: normalizeBoolean(firstRow.RegularScreening),
        };

        resolve(formData);
      } catch (error: any) {
        console.error("Excel parsing error:", error);
        reject(new Error(`Failed to parse Excel file: ${error.message}`));
      }
    };

    reader.onerror = (error) => {
      console.error("File reading error:", error);
      reject(new Error('Error reading file.'));
    };

    reader.readAsBinaryString(file);
  });
}; 