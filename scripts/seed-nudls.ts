#!/usr/bin/env tsx

// NUDLS Database Seeding Script
// Run this once to populate database with historical NUDLS events as if you are a 'new system' integrating with them, 
// because we only have access to their GET endpoint for now.
// In future, we will process incoming webhook events from them

// Load environment variables FIRST before any other imports
import { config } from 'dotenv';
config();

// Import types (doesn't trigger database connection)
import type { NudlsFeedResponse } from '../src/types/nudls';

// Check for required environment variables
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.error('   Make sure you have a .env file with DATABASE_URL set');
  process.exit(1);
}

const NUDLS_FEED_URL = process.env.NUDLS_FEED_URL || 'https://dinoparks.herokuapp.com/nudls/feed';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

/**
 * Utility function for delays
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch NUDLS feed with retry logic
 */
async function fetchNudlsFeed(retryCount = 0): Promise<NudlsFeedResponse> {
  try {
    console.log(`📡 Fetching NUDLS feed... (attempt ${retryCount + 1})`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(NUDLS_FEED_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Dinopark-Maintenance-API/1.0.0'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as NudlsFeedResponse;
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid NUDLS feed response: expected array');
    }

    console.log(`✅ Successfully fetched ${data.length} events from NUDLS feed`);
    return data;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ NUDLS fetch failed (attempt ${retryCount + 1}):`, errorMessage);

    // Retry with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const delayMs = Math.min(
        BASE_RETRY_DELAY * Math.pow(2, retryCount),
        MAX_RETRY_DELAY
      );
      
      console.log(`⏳ Retrying in ${delayMs}ms...`);
      await delay(delayMs);
      return fetchNudlsFeed(retryCount + 1);
    }

    throw new Error(`NUDLS feed fetch failed after ${MAX_RETRIES + 1} attempts: ${errorMessage}`);
  }
}

/**
 * Main seeding function
 */
async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting NUDLS database seeding...');
  console.log(`   Feed URL: ${NUDLS_FEED_URL}`);
  console.log(`   Database: ${process.env.DATABASE_URL ? 'Connected' : 'URL not found'}`);
  
  try {
    // Fetch all historical events from NUDLS
    const events = await fetchNudlsFeed();
    
    if (events.length === 0) {
      console.log('📭 No events from NUDLS feed - database seeding complete (empty feed)');
      return;
    }

    // Lazy import to ensure database connection happens after env vars are loaded
    const { NudlsEventProcessors } = await import('../src/services/nudls-processors');
    
    // Process all events using existing processors
    console.log(`🔄 Processing ${events.length} historical events...`);
    const result = await NudlsEventProcessors.processEvents(events);
    
    // Report results
    console.log(`✅ NUDLS database seeding completed successfully!`);
    console.log(`   📊 Total events: ${events.length}`);
    console.log(`   ✅ Processed: ${result.processed}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    
    // Show event breakdown
    const eventCounts = events.reduce((acc, event) => {
      acc[event.kind] = (acc[event.kind] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`   📈 Event breakdown:`);
    Object.entries(eventCounts).forEach(([kind, count]) => {
      console.log(`      ${kind}: ${count}`);
    });
    
    if (result.failed > 0) {
      console.warn(`⚠️  ${result.failed} events failed to process:`);
      result.errors.forEach(error => console.error(`      ❌ ${error.message}`));
      process.exit(1); // Exit with error code
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ NUDLS database seeding failed: ${errorMessage}`);
    process.exit(1);
  } finally {
    // Close database connection to allow script to exit
    const { closeConnection } = await import('../src/lib/database');
    await closeConnection();
    process.exit(0);
  }
}

// Run the seeding if this script is executed directly
if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('💥 Unhandled error during seeding:', error);
    process.exit(1);
  });
}