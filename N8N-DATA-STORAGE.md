# n8n Workflow Data Storage Guide

## Where n8n Data is Saved

### Primary Data Location
n8n stores all its data in: **`%APPDATA%\gstr2b-automation\.n8n`**

On Windows, this expands to:
```
C:\Users\[USERNAME]\AppData\Roaming\gstr2b-automation\.n8n\
```

### Data Structure
```
%APPDATA%\gstr2b-automation\.n8n\
├── database.sqlite          # Main n8n database (workflows, executions, settings)
├── workflows/              # JSON workflow files (backup/templates)
├── credentials/            # Encrypted credential data
├── nodes/                  # Custom node modules (if any)
├── logs/                   # n8n server logs
├── .workflows-installed    # Marker file for initial setup
└── config/                 # n8n configuration files
```

## What Gets Stored Where

### 1. Workflows 📋
- **Primary**: SQLite database (`database.sqlite`)
- **Templates**: `workflows/` folder (JSON files)
- **User-created**: Stored in database, can be exported to JSON

### 2. Workflow Executions 🔄
- **Location**: SQLite database
- **Contains**: Execution history, results, error logs
- **Retention**: Configurable (default: keep recent executions)

### 3. Credentials 🔐
- **Location**: `credentials/` folder + database
- **Encryption**: AES-256 encrypted
- **Types**: API keys, database connections, OAuth tokens

### 4. Settings ⚙️
- **Location**: SQLite database
- **Contains**: User preferences, n8n configuration, node settings

## Development vs Production

### During Development (Your Machine)
```
Local Path: D:\gstr2b-app-main\resources\n8n-templates\
Purpose: Template storage for bundling with app
Content: Workflow JSON files that ship with your app
```

### After Distribution (User Machines)
```
User Path: C:\Users\[USERNAME]\AppData\Roaming\gstr2b-automation\.n8n\
Purpose: User's actual n8n data
Content: All workflows, executions, credentials, settings
```

## Data Persistence & Backup

### What Persists:
✅ All workflows created by users
✅ Workflow execution history
✅ User credentials and settings
✅ Custom node configurations
✅ n8n server preferences

### What Gets Reset:
❌ Nothing! All data persists between app restarts
❌ Workflows survive app updates (stored in user data)

## Workflow Distribution Flow

### 1. Development Phase
```
You create workflows → Save to resources/n8n-templates/ → Bundle with app
```

### 2. User Installation
```
App installs → Copies templates to user .n8n folder → User gets starter workflows
```

### 3. User Customization
```
User modifies workflows → Saved to their database → Preserved forever
```

## Backup & Migration

### Manual Backup
Users can backup their data by copying:
```
%APPDATA%\gstr2b-automation\.n8n\
```

### Workflow Export
Users can export individual workflows as JSON files from the n8n editor.

### Migration Between Machines
Copy the entire `.n8n` folder to transfer all data to a new machine.

## Security & Privacy

### Local Storage
- All data stored locally on user's machine
- No cloud synchronization unless user configures it
- Full control over their automation data

### Encryption
- Credentials are encrypted at rest
- Database uses SQLite with file-level security
- Access restricted to the user account

## Summary

🗂️ **Main Database**: `%APPDATA%\gstr2b-automation\.n8n\database.sqlite`
📁 **Templates**: `%APPDATA%\gstr2b-automation\.n8n\workflows\`
🔐 **Credentials**: `%APPDATA%\gstr2b-automation\.n8n\credentials\`
📊 **Executions**: Stored in main database
⚙️ **Settings**: Stored in main database

Your users get complete ownership of their workflow data with full persistence across app restarts and updates!
