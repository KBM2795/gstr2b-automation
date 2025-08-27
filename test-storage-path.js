// Test storage path generation
const path = require('path');

// Simulate the new file path logic
function testStoragePath() {
  const storagePath = 'C:\\Data\\GSTR';
  const finYear = '2024-25';
  const quarter = 'Q1';
  const month = 'April';
  const client_folder = 'ClientABC';
  
  // Create the folder structure: {storagePath}/{finYear}/{quarter}/{month}/{client_folder}/
  const yearFolder = path.join(storagePath, finYear.replace(/\s+/g, ''));
  const quarterFolder = path.join(yearFolder, quarter.replace(/\s+/g, ''));
  const monthFolder = path.join(quarterFolder, month.replace(/\s+/g, ''));
  const clientFolder = client_folder ? path.join(monthFolder, client_folder) : monthFolder;
  
  const targetBase = `GSTR-2B-${finYear.replace(/\s+/g,'')}-${quarter.replace(/\s+/g,'')}-${month.replace(/\s+/g,'')}`;
  const finalPath = path.join(clientFolder, `${targetBase}.xlsx`);
  
  console.log('Storage Path:', storagePath);
  console.log('Year Folder:', yearFolder);
  console.log('Quarter Folder:', quarterFolder);
  console.log('Month Folder:', monthFolder);
  console.log('Client Folder:', clientFolder);
  console.log('Final Path:', finalPath);
  console.log('\nExpected structure:');
  console.log('C:\\Data\\GSTR\\2024-25\\Q1\\April\\ClientABC\\GSTR-2B-2024-25-Q1-April.xlsx');
}

testStoragePath();
