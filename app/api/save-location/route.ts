import { NextRequest, NextResponse } from 'next/server';
import { addLocation, getLocations, initDB } from '@/lib/location-db';

export async function GET() {
	try {
		const locations = await getLocations();
		return NextResponse.json({ locations });
	} catch (error) {
		return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
	}
}

// Ensure DB is initialized
initDB();

export async function POST(req: NextRequest) {
	try {
		const { path, type } = await req.json();
		if (!path || !type || (type !== 'file' && type !== 'folder')) {
			return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
		}
		// Use timestamp as a simple unique id
		const location = { id: Date.now().toString(), path, type };
		await addLocation(location);
		return NextResponse.json({ success: true, location });
	} catch (error) {
		return NextResponse.json({ error: 'Failed to save location' }, { status: 500 });
	}
}
