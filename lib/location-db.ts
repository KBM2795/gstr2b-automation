import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join } from 'path';

// Define the type for your data
export type Location = {
  id: string;
  path: string;
  type: 'file' | 'folder';
};

export type LocationDB = {
  locations: Location[];
};

// Set up the database file path
const file = join(process.cwd(), 'locations.json');
const adapter = new JSONFile<LocationDB>(file);
const db = new Low<LocationDB>(adapter, { locations: [] });

// Initialize the database with default structure if empty
export async function initDB() {
  await db.read();
  db.data ||= { locations: [] };
  await db.write();
}

export async function addLocation(location: Location) {
  await db.read();
  db.data ||= { locations: [] };
  db.data.locations.push(location);
  await db.write();
}

export async function getLocations() {
  await db.read();
  return db.data?.locations || [];
}

export async function removeLocation(id: string) {
  await db.read();
  db.data ||= { locations: [] };
  db.data.locations = db.data.locations.filter(loc => loc.id !== id);
  await db.write();
}
