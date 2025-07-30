// NUDLS Polling Service - Fault-tolerant service that polls NUDLS feed and processes events

import { NudlsEventProcessors } from './nudls-processors';
import type { NudlsFeedResponse, NudlsServiceStatus } from '../types/nudls';

export class NudlsService {
  private static instance: NudlsService;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly feedUrl: string;
  private readonly pollIntervalMs: number;
  
  // Service statistics
  private status: NudlsServiceStatus = {
    isRunning: false,
    lastSuccessfulPoll: null,
    consecutiveFailures: 0,
    totalEvents: 0,
    eventsProcessed: {
      dino_added: 0,
      dino_removed: 0,
      dino_location_updated: 0,
      dino_fed: 0,
      maintenance_performed: 0
    }
  };

  // Retry configuration
  private readonly maxRetries = 3;
  private readonly baseRetryDelay = 1000; // 1 second
  private readonly maxRetryDelay = 30000; // 30 seconds

  constructor(feedUrl?: string, pollIntervalMs?: number) {
    this.feedUrl = feedUrl || process.env.NUDLS_FEED_URL || 'https://dinoparks.herokuapp.com/nudls/feed';
    this.pollIntervalMs = pollIntervalMs || parseInt(process.env.NUDLS_POLL_INTERVAL || '120000');
    
    console.log(`🦕 NUDLS Service initialized:`);
    console.log(`   Feed URL: ${this.feedUrl}`);
    console.log(`   Poll Interval: ${this.pollIntervalMs}ms (${this.pollIntervalMs / 1000}s)`);
  }

  /**
   * Singleton pattern - get or create instance
   */
  static getInstance(feedUrl?: string, pollIntervalMs?: number): NudlsService {
    if (!NudlsService.instance) {
      NudlsService.instance = new NudlsService(feedUrl, pollIntervalMs);
    }
    return NudlsService.instance;
  }

  /**
   * Start the polling service
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ NUDLS Service already running');
      return;
    }

    console.log('🚀 Starting NUDLS polling service...');
    this.isRunning = true;
    this.status.isRunning = true;

    // Start immediate first poll, then set up interval
    this.pollNudlsFeed();
    this.pollInterval = setInterval(() => {
      this.pollNudlsFeed();
    }, this.pollIntervalMs);

    console.log(`✅ NUDLS Service started - polling every ${this.pollIntervalMs / 1000} seconds`);
  }

  /**
   * Stop the polling service
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ NUDLS Service not running');
      return;
    }

    console.log('🛑 Stopping NUDLS polling service...');
    this.isRunning = false;
    this.status.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    console.log('✅ NUDLS Service stopped');
  }

  /**
   * Get current service status
   */
  getStatus(): NudlsServiceStatus {
    return { ...this.status };
  }

  /**
   * Fetch data from NUDLS feed with exponential backoff retry
   */
  private async fetchNudlsFeed(retryCount = 0): Promise<NudlsFeedResponse> {
    try {
      console.log(`📡 Fetching NUDLS feed... (attempt ${retryCount + 1})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(this.feedUrl, {
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
      if (retryCount < this.maxRetries) {
        const delay = Math.min(
          this.baseRetryDelay * Math.pow(2, retryCount),
          this.maxRetryDelay
        );
        
        console.log(`⏳ Retrying in ${delay}ms...`);
        await this.delay(delay);
        return this.fetchNudlsFeed(retryCount + 1);
      }

      throw new Error(`NUDLS feed fetch failed after ${this.maxRetries + 1} attempts: ${errorMessage}`);
    }
  }

  /**
   * Main polling function - fetch and process NUDLS events
   */
  private async pollNudlsFeed(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Fetch events from NUDLS feed
      const events = await this.fetchNudlsFeed();
      
      if (events.length === 0) {
        console.log('📭 No new events from NUDLS feed');
        this.status.lastSuccessfulPoll = new Date();
        this.status.consecutiveFailures = 0;
        return;
      }

      // Process all events
      const result = await NudlsEventProcessors.processEvents(events);
      
      // Update service statistics
      this.status.lastSuccessfulPoll = new Date();
      this.status.consecutiveFailures = 0;
      this.status.totalEvents += events.length;

      // Update event type counters
      events.forEach(event => {
        this.status.eventsProcessed[event.kind]++;
      });

      console.log(`🎉 Successfully processed ${result.processed}/${events.length} events`);
      
      if (result.failed > 0) {
        console.warn(`⚠️ ${result.failed} events failed to process`);
        result.errors.forEach(error => console.error('   Error:', error.message));
      }

    } catch (error) {
      this.status.consecutiveFailures++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`❌ NUDLS polling failed (${this.status.consecutiveFailures} consecutive failures):`, errorMessage);
      
      // If too many consecutive failures, consider implementing circuit breaker
      if (this.status.consecutiveFailures >= 5) {
        console.error('🚨 NUDLS service experiencing prolonged outage - consider manual intervention');
      }
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manual trigger for testing/debugging
   */
  async pollOnce(): Promise<void> {
    console.log('🔧 Manual NUDLS poll triggered');
    await this.pollNudlsFeed();
  }

  /**
   * Reset service statistics
   */
  resetStatistics(): void {
    this.status.totalEvents = 0;
    this.status.consecutiveFailures = 0;
    this.status.eventsProcessed = {
      dino_added: 0,
      dino_removed: 0,
      dino_location_updated: 0,
      dino_fed: 0,
      maintenance_performed: 0
    };
    console.log('📊 NUDLS service statistics reset');
  }
}