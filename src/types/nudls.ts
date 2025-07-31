// NUDLS Event Types based on documentation v1.4.7-a5, build 10
// Feed endpoint: https://dinoparks.herokuapp.com/nudls/feed

export interface NudlsEventBase {
  time: string; // ISO datetime string
  park_id: number;
}

export interface DinoAddedEvent extends NudlsEventBase {
  kind: 'dino_added';
  name: string;
  species: string;
  gender: string;
  id: number; // NUDLS dinosaur ID
  digestion_period_in_hours: number;
  herbivore: boolean; // Note: opposite of isCarnivore
}

export interface DinoRemovedEvent extends NudlsEventBase {
  kind: 'dino_removed';
  id: number; // NUDLS dinosaur ID
}

export interface DinoLocationUpdatedEvent extends NudlsEventBase {
  kind: 'dino_location_updated';
  location: string; // Zone ID like "E10"
  dinosaur_id: number; // NUDLS dinosaur ID
}

export interface DinoFedEvent extends NudlsEventBase {
  kind: 'dino_fed';
  dinosaur_id: number; // NUDLS dinosaur ID
}

export interface MaintenancePerformedEvent extends NudlsEventBase {
  kind: 'maintenance_performed';
  location: string; // Zone ID like "E7"
}

export type NudlsEvent = 
  | DinoAddedEvent 
  | DinoRemovedEvent 
  | DinoLocationUpdatedEvent 
  | DinoFedEvent 
  | MaintenancePerformedEvent;

// NUDLS feed response type (array of events)
export type NudlsFeedResponse = NudlsEvent[];

// Service status types
export interface NudlsServiceStatus {
  isRunning: boolean;
  lastSuccessfulPoll: Date | null;
  consecutiveFailures: number;
  totalEvents: number;
  eventsProcessed: {
    dino_added: number;
    dino_removed: number;
    dino_location_updated: number;
    dino_fed: number;
    maintenance_performed: number;
  };
}