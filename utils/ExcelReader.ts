
import ExcelJS from 'exceljs';

export async function getExcelValue(
  filePath: string,
  sheetName: string,
  cellAddress: string
): Promise<string> {

  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const value = worksheet.getCell(cellAddress).value;

  if (value === null || value === undefined) {
    throw new Error(`No value found in ${cellAddress}`);
  }

  return String(value);
}