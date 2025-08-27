# 📋 GSTR2B File Format Guide

## 🚨 **Error Resolution: "Cannot access file"**

### **Common Causes & Solutions:**

1. **File Path Not Selected**
   - **Issue**: No Excel/CSV file selected in setup
   - **Solution**: Use the setup wizard to select your GSTR2B file

2. **File Doesn't Exist**
   - **Issue**: Selected file was moved or deleted
   - **Solution**: Re-select the file in setup wizard

3. **File Permission Issues**
   - **Issue**: File is locked or protected
   - **Solution**: Close Excel, unlock file, or copy to a different location

4. **Wrong File Format**
   - **Issue**: File is not .xlsx, .xls, or .csv
   - **Solution**: Save your file in a supported format

## 📊 **Expected GSTR2B File Format**

### **Required Columns (Excel/CSV):**
```
GSTIN | Trade/Legal Name | Invoice Number | Invoice Date | Invoice Value | Place of Supply | ...
```

### **Sample Data:**
```csv
GSTIN,Trade/Legal Name,Invoice Number,Invoice Date,Invoice Value,Place of Supply
27AABCU9603R1ZM,ABC Company Ltd,INV001,01-04-2024,118000,27-Maharashtra
27AABCU9603R1ZM,ABC Company Ltd,INV002,02-04-2024,59000,27-Maharashtra
```

## 🔧 **Troubleshooting Steps**

### **Step 1: Check File Selection**
1. Go to Setup Wizard
2. Click "Select Excel File"
3. Choose your GSTR2B file
4. Verify file path appears in dashboard

### **Step 2: Verify File Format**
- ✅ **Supported**: .xlsx, .xls, .csv
- ❌ **Not Supported**: .pdf, .txt, .doc

### **Step 3: Test File Access**
1. Open file in Excel to ensure it's not corrupted
2. Save a copy if needed
3. Close Excel before processing

### **Step 4: Check File Content**
- First row should contain column headers
- Data should start from row 2
- No empty first row

## 📁 **Sample File Available**

A sample GSTR2B CSV file is included with the app:
- **Location**: `sample-gstr2b-data.csv`
- **Purpose**: Testing the row-by-row processing
- **Format**: Standard GSTR2B format with sample data

## 🎯 **Quick Fix Checklist**

- [ ] File selected in setup wizard?
- [ ] File exists at the specified path?
- [ ] File format is .xlsx, .xls, or .csv?
- [ ] File is not open in Excel?
- [ ] File contains proper headers?
- [ ] File has data rows (not just headers)?

## 📞 **Still Having Issues?**

If you continue to get file access errors:

1. **Copy your file** to the desktop
2. **Re-select it** in the setup wizard
3. **Try the sample file** first to test the system
4. **Check Windows file permissions** if needed

The row-by-row processing will work once the file is properly accessible! 🚀
